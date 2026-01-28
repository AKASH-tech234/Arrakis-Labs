"""
MIM Dataset Builder
===================

Builds training datasets from MongoDB exports.

CRITICAL:
- Two SEPARATE datasets:
  1. mim_failure_transitions.parquet (FAILED submissions only)
  2. mim_reinforcement_events.parquet (ACCEPTED submissions only)
  
- NO cross-contamination
- Delta features computed from FAILED history only
- Per-user time-ordered splits
"""

import os
import json
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from collections import defaultdict
from pathlib import Path

import pandas as pd
import numpy as np

from app.mim.features.delta_features import compute_delta_features, DeltaFeatures
from app.mim.features.state_snapshot import build_user_state_snapshot
from app.mim.taxonomy.root_causes import ROOT_CAUSES, migrate_old_root_cause
from app.mim.taxonomy.subtype_masks import SUBTYPES, ROOT_CAUSE_TO_SUBTYPES, is_valid_pair

# Phase 1.3: Code-signal bridge dataset materialization (deterministic)
from app.mim.code_signals import extract_code_signals as extract_structural_code_signals

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

MIN_SUBMISSIONS_PER_USER = 3  # Users with fewer submissions excluded from val/test


@dataclass
class FailureTransitionSample:
    """
    Training sample for failure transition model.
    
    ALL FIELDS REQUIRED.
    """
    # Identifiers
    user_id: str
    problem_id: str
    submission_id: str
    
    # Labels (model outputs)
    root_cause: str
    subtype: str
    
    # Delta features (model inputs)
    delta_attempts_same_category: float
    delta_root_cause_repeat_rate: float
    delta_complexity_mismatch: float
    delta_time_to_accept: float
    delta_optimization_transition: float
    is_cold_start: float
    
    # User state context
    dominant_failure_modes: List[str]
    stagnant_areas: List[str]
    improving_areas: List[str]
    
    # Problem context
    category: str
    difficulty: str
    
    # Metadata
    timestamp: str
    split: str  # train, val, test


@dataclass
class ReinforcementEventSample:
    """
    Training sample for reinforcement model.
    
    ALL FIELDS REQUIRED.
    """
    # Identifiers
    user_id: str
    problem_id: str
    submission_id: str
    
    # Reinforcement signal
    category: str
    difficulty: str
    technique: str
    confidence_boost: float
    
    # Performance metrics
    time_to_solve_seconds: float
    attempt_count: int
    was_optimal: bool
    
    # Metadata
    timestamp: str
    split: str


# ═══════════════════════════════════════════════════════════════════════════════
# DATASET BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_code_text(sub: Dict[str, Any]) -> str:
    """Extract code text from a raw submission export with best-effort field mapping."""
    for key in (
        "code",
        "user_code",
        "userCode",
        "source_code",
        "sourceCode",
        "submittedCode",
        "solution",
    ):
        val = sub.get(key)
        if isinstance(val, str) and val.strip():
            return val
    return ""


def _code_signal_numeric_columns() -> List[str]:
    """Authoritative code-signal numeric columns to materialize in v2 parquet."""
    return [
        # AST
        "ast_max_loop_depth",
        "ast_max_condition_depth",
        "ast_total_loops",
        "ast_total_conditions",
        "ast_has_recursion",
        "ast_off_by_one_risk",
        # Pattern summary
        "pattern_off_by_one_count",
        "pattern_boundary_risk_count",
        "pattern_inefficiency_count",
        "pattern_correctness_risk",
        "pattern_efficiency_risk",
        "pattern_implementation_risk",
        # Combined risks
        "code_boundary_risk",
        "code_efficiency_risk",
        "code_implementation_risk",
        "code_understanding_risk",
    ]


def _compute_code_signal_numeric_features(sub: Dict[str, Any]) -> Dict[str, float]:
    """
    Compute deterministic code-signal numeric features for a submission.

    IMPORTANT:
    - Excludes any label-proxy fields like `code_likely_root_cause`.
    - Always returns all columns with safe defaults.
    """
    code = _extract_code_text(sub)
    verdict = (sub.get("verdict") or "").lower()
    tags = sub.get("tags") or sub.get("problem_tags") or sub.get("problemTags") or []
    if isinstance(tags, str):
        tags = [tags]
    constraints = sub.get("constraints") or {}

    out: Dict[str, float] = {k: 0.0 for k in _code_signal_numeric_columns()}

    if not code.strip():
        return out

    try:
        # IMPORTANT: training features must be verdict-neutral to avoid
        # leakage-by-construction (especially on synthetic datasets).
        # Verdict can be used at inference for explanation and mechanism narration,
        # but the ML feature surface should primarily reflect code structure.
        struct = extract_structural_code_signals(
            code=code,
            verdict="",  # verdict-neutral
            problem_tags=tags,
            constraints=constraints if isinstance(constraints, dict) else {},
        )

        # Derived training-time code risk scores (verdict-neutral)
        # We intentionally do NOT use struct.boundary_risk/etc because those can
        # incorporate verdict-based amplification.
        code_boundary = max(
            float(struct.ast_features.off_by_one_risk_score),
            float(struct.detected_patterns.correctness_risk),
        )
        code_eff = float(struct.detected_patterns.efficiency_risk)
        if struct.ast_features.has_nested_loops:
            code_eff = min(1.0, code_eff + 0.2)
        code_impl = float(struct.detected_patterns.implementation_risk)

        # Understanding risk (verdict-neutral): varies based on how much structure is present
        # vs what the problem tags imply. This is intentionally heuristic and conservative.
        code_under = 0.1
        if not struct.ast_features.parse_success:
            code_under += 0.2
        if struct.ast_features.total_loops == 0:
            code_under += 0.1
        if struct.ast_features.total_conditions == 0:
            code_under += 0.05

        # Tag-structure mismatch heuristic
        tagset = {str(t).lower().replace(' ', '_') for t in (tags or [])}
        if 'dynamic_programming' in tagset and not struct.ast_features.has_recursion:
            code_under += 0.2
        if 'binary_search' in tagset and not struct.ast_features.has_while_loop:
            code_under += 0.15
        if 'two_pointers' in tagset and struct.ast_features.max_loop_depth == 0:
            code_under += 0.1

        code_under = float(max(0.0, min(1.0, code_under)))

        out.update({
            "ast_max_loop_depth": float(struct.ast_features.max_loop_depth),
            "ast_max_condition_depth": float(struct.ast_features.max_condition_depth),
            "ast_total_loops": float(struct.ast_features.total_loops),
            "ast_total_conditions": float(struct.ast_features.total_conditions),
            "ast_has_recursion": float(struct.ast_features.has_recursion),
            "ast_off_by_one_risk": float(struct.ast_features.off_by_one_risk_score),
            "pattern_off_by_one_count": float(len(struct.detected_patterns.off_by_one_indicators)),
            "pattern_boundary_risk_count": float(len(struct.detected_patterns.boundary_risks)),
            "pattern_inefficiency_count": float(len(struct.detected_patterns.inefficiency_patterns)),
            "pattern_correctness_risk": float(struct.detected_patterns.correctness_risk),
            "pattern_efficiency_risk": float(struct.detected_patterns.efficiency_risk),
            "pattern_implementation_risk": float(struct.detected_patterns.implementation_risk),
            "code_boundary_risk": code_boundary,
            "code_efficiency_risk": code_eff,
            "code_implementation_risk": code_impl,
            "code_understanding_risk": code_under,
        })

    except Exception:
        # Conservative degradation: keep zeros
        pass

    return out


class DatasetBuilder:
    """
    Builds training datasets from raw submission data.
    
    CRITICAL:
    - Separates failed vs accepted at the source
    - Computes delta features only from failed history
    - Applies per-user time-ordered splits
    """
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def build_from_mongodb_export(
        self,
        submissions_json_path: str,
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Build datasets from MongoDB JSON export.
        
        Parameters
        ----------
        submissions_json_path : str
            Path to JSON file with submissions
            
        Returns
        -------
        Tuple[pd.DataFrame, pd.DataFrame]
            (failure_transitions_df, reinforcement_events_df)
        """
        
        logger.info(f"Loading submissions from {submissions_json_path}")
        
        with open(submissions_json_path, 'r') as f:
            raw_submissions = json.load(f)
        
        # Separate by verdict AT THE SOURCE
        failed_submissions = []
        accepted_submissions = []
        
        for sub in raw_submissions:
            verdict = sub.get("verdict", "").lower()
            if verdict in ("accepted", "ac"):
                accepted_submissions.append(sub)
            else:
                failed_submissions.append(sub)
        
        logger.info(f"Separated: {len(failed_submissions)} failed, {len(accepted_submissions)} accepted")

        # Phase 1.3 acceptance gate: enforce code presence rate before generating v2
        # This prevents producing a misleading v2 dataset with degenerate code-signal columns.
        code_total = len(raw_submissions)
        code_present = 0
        for sub in raw_submissions:
            if _extract_code_text(sub).strip():
                code_present += 1
        code_present_rate = (code_present / code_total) if code_total else 0.0
        logger.info(
            f"code_present_rate={code_present_rate:.3f} ({code_present}/{code_total})"
        )

        # Build datasets
        failure_df = self._build_failure_transitions(failed_submissions, accepted_submissions)
        reinforcement_df = self._build_reinforcement_events(accepted_submissions)

        
        # Save to parquet (v1 outputs)
        failure_path = self.output_dir / "mim_failure_transitions.parquet"
        reinforcement_path = self.output_dir / "mim_reinforcement_events.parquet"

        failure_df.to_parquet(failure_path, index=False)
        reinforcement_df.to_parquet(reinforcement_path, index=False)

        logger.info(f"Saved: {failure_path} ({len(failure_df)} samples)")
        logger.info(f"Saved: {reinforcement_path} ({len(reinforcement_df)} samples)")

        # Phase 1.3: Also emit v2 failure transitions with baked code-signal numeric columns
        # Hard gate: require >= 70% code presence in the raw export.
        if code_present_rate < 0.70:
            logger.error(
                "Refusing to generate mim_failure_transitions_v2.parquet: "
                f"code_present_rate={code_present_rate:.3f} < 0.70. "
                "Export is missing code and violates the training data contract."
            )
            return failure_df, reinforcement_df

        failure_df_v2 = self._build_failure_transitions_v2(failed_submissions, accepted_submissions)

        # Additional acceptance gate: code-signal feature non-degeneracy
        # Block if any code-signal column is near-constant across the dataset.
        try:
            degenerate = []
            for c in _code_signal_numeric_columns():
                if c not in failure_df_v2.columns:
                    degenerate.append(f"{c} (missing)")
                    continue
                var = float(pd.Series(failure_df_v2[c]).var())
                if var < 1e-6:
                    degenerate.append(f"{c} (var={var:.2e})")
            if degenerate:
                logger.error(
                    "Refusing to write mim_failure_transitions_v2.parquet: degenerate code-signal columns detected: "
                    + ", ".join(degenerate)
                )
                return failure_df, reinforcement_df
        except Exception as e:
            logger.warning(f"Could not validate code-signal non-degeneracy: {e}")

        failure_v2_path = self.output_dir / "mim_failure_transitions_v2.parquet"
        failure_df_v2.to_parquet(failure_v2_path, index=False)
        logger.info(f"Saved: {failure_v2_path} ({len(failure_df_v2)} samples)")

        # Sidecar metadata for v2
        try:
            import hashlib
            import json as _json
            from app.mim.offline_eval.snapshot_metadata import get_snapshot_metadata

            meta = get_snapshot_metadata(failure_v2_path)
            schema_path = Path("app/mim/training/feature_schema_v2.json")
            schema_hash = hashlib.sha256(schema_path.read_bytes()).hexdigest() if schema_path.exists() else None

            sidecar = {
                "schema_version": "v2",
                "feature_schema_v2_sha256": schema_hash,
                "source_export_path": submissions_json_path,
                "dataset_snapshot": meta.to_dict(),
            }
            (self.output_dir / "mim_failure_transitions_v2_metadata.json").write_text(
                _json.dumps(sidecar, indent=2)
            )
        except Exception as e:
            logger.warning(f"Failed to write v2 dataset metadata: {e}")

        return failure_df, reinforcement_df
    
    def _build_failure_transitions(
        self,
        failed_submissions: List[Dict],
        accepted_submissions: List[Dict],
    ) -> pd.DataFrame:
        """
        Build failure transition samples.
        
        CRITICAL: Delta features computed from FAILED history only.
        """
        
        # Group by user
        user_failed = defaultdict(list)
        user_accepted = defaultdict(list)
        
        for sub in failed_submissions:
            user_id = sub.get("userId") or sub.get("user_id", "unknown")
            user_failed[user_id].append(sub)
        
        for sub in accepted_submissions:
            user_id = sub.get("userId") or sub.get("user_id", "unknown")
            user_accepted[user_id].append(sub)
        
        # Sort by timestamp within each user
        for user_id in user_failed:
            user_failed[user_id].sort(
                key=lambda x: _parse_timestamp(x.get("timestamp")) or datetime.min
            )
        
        for user_id in user_accepted:
            user_accepted[user_id].sort(
                key=lambda x: _parse_timestamp(x.get("timestamp")) or datetime.min
            )
        
        samples = []
        
        for user_id, submissions in user_failed.items():
            n = len(submissions)
            
            # Per-user time-ordered split indices
            train_end = int(n * TRAIN_RATIO)
            val_end = int(n * (TRAIN_RATIO + VAL_RATIO))
            
            for i, sub in enumerate(submissions):
                # Determine split
                if i < train_end:
                    split = "train"
                elif i < val_end:
                    split = "val"
                else:
                    split = "test"
                
                # History is all FAILED submissions BEFORE this one
                history = submissions[:i]
                
                # Compute delta features
                delta = compute_delta_features(
                    user_history=history,
                    current_submission=sub,
                )
                
                # Build user state snapshot
                accepted_before = [
                    a for a in user_accepted.get(user_id, [])
                    if _parse_timestamp(a.get("timestamp")) < _parse_timestamp(sub.get("timestamp"))
                ]
                
                snapshot = build_user_state_snapshot(
                    user_id=user_id,
                    failed_submissions=history,
                    accepted_submissions=accepted_before,
                )
                
                # Extract or migrate root cause
                old_root_cause = sub.get("root_cause", sub.get("rootCause", ""))
                if old_root_cause in ROOT_CAUSES:
                    root_cause = old_root_cause
                else:
                    root_cause = migrate_old_root_cause(old_root_cause)
                
                # Extract or infer subtype
                subtype = sub.get("subtype", "")
                if not subtype or subtype not in SUBTYPES:
                    subtype = _infer_subtype(root_cause, sub)
                
                sample = FailureTransitionSample(
                    user_id=user_id,
                    problem_id=sub.get("questionId") or sub.get("problem_id", ""),
                    submission_id=sub.get("_id") or sub.get("submission_id", str(i)),
                    root_cause=root_cause,
                    subtype=subtype,
                    delta_attempts_same_category=delta.delta_attempts_same_category,
                    delta_root_cause_repeat_rate=delta.delta_root_cause_repeat_rate,
                    delta_complexity_mismatch=delta.delta_complexity_mismatch,
                    delta_time_to_accept=delta.delta_time_to_accept,
                    delta_optimization_transition=delta.delta_optimization_transition,
                    is_cold_start=delta.is_cold_start,
                    dominant_failure_modes=snapshot.dominant_failure_modes,
                    stagnant_areas=snapshot.stagnant_areas,
                    improving_areas=snapshot.improving_areas,
                    category=sub.get("category", sub.get("topic", "unknown")),
                    difficulty=sub.get("difficulty", "medium"),
                    timestamp=sub.get("timestamp", datetime.utcnow().isoformat()),
                    split=split,
                )
                samples.append(asdict(sample))
        
        return pd.DataFrame(samples)

    def _build_failure_transitions_v2(
        self,
        failed_submissions: List[Dict],
        accepted_submissions: List[Dict],
    ) -> pd.DataFrame:
        """Build v2 failure transitions with baked code-signal numeric columns.

        Notes:
        - This does NOT change labels.
        - This does NOT add label-proxy features (e.g., likely_root_cause).
        - Safe degradation: missing code yields zeros.
        """
        df_v1 = self._build_failure_transitions(failed_submissions, accepted_submissions)

        # Build lookup from submission_id to raw submission for code access
        raw_by_id: Dict[str, Dict[str, Any]] = {}
        for idx, sub in enumerate(failed_submissions):
            sid = str(sub.get("_id") or sub.get("submission_id") or idx)
            raw_by_id[sid] = sub

        # Ensure columns exist
        for c in _code_signal_numeric_columns():
            if c not in df_v1.columns:
                df_v1[c] = 0.0

        # Populate per-row
        for i, row in df_v1.iterrows():
            sid = str(row.get("submission_id"))
            raw = raw_by_id.get(sid, {})
            feats = _compute_code_signal_numeric_features(raw)
            for k, v in feats.items():
                df_v1.at[i, k] = v

        return df_v1
    
    def _build_reinforcement_events(
        self,
        accepted_submissions: List[Dict],
    ) -> pd.DataFrame:
        """
        Build reinforcement event samples.
        
        CRITICAL: This NEVER touches failure history.
        """
        
        # Group by user
        user_accepted = defaultdict(list)
        
        for sub in accepted_submissions:
            user_id = sub.get("userId") or sub.get("user_id", "unknown")
            user_accepted[user_id].append(sub)
        
        # Sort by timestamp
        for user_id in user_accepted:
            user_accepted[user_id].sort(
                key=lambda x: _parse_timestamp(x.get("timestamp")) or datetime.min
            )
        
        samples = []
        
        for user_id, submissions in user_accepted.items():
            n = len(submissions)
            
            train_end = int(n * TRAIN_RATIO)
            val_end = int(n * (TRAIN_RATIO + VAL_RATIO))
            
            for i, sub in enumerate(submissions):
                if i < train_end:
                    split = "train"
                elif i < val_end:
                    split = "val"
                else:
                    split = "test"
                
                # Compute confidence boost based on difficulty
                difficulty = sub.get("difficulty", "medium").lower()
                base_boost = {"easy": 0.1, "medium": 0.15, "hard": 0.25}.get(difficulty, 0.15)
                
                # Adjust by attempt count (fewer attempts = higher boost)
                attempt_count = sub.get("attemptCount", sub.get("attempt_count", 1))
                attempt_factor = 1.0 / max(1, attempt_count ** 0.5)
                confidence_boost = base_boost * attempt_factor
                
                sample = ReinforcementEventSample(
                    user_id=user_id,
                    problem_id=sub.get("questionId") or sub.get("problem_id", ""),
                    submission_id=sub.get("_id") or sub.get("submission_id", str(i)),
                    category=sub.get("category", sub.get("topic", "unknown")),
                    difficulty=difficulty,
                    technique=sub.get("technique", _infer_technique(sub)),
                    confidence_boost=confidence_boost,
                    time_to_solve_seconds=sub.get("timeToSolve", sub.get("time_to_solve", 0.0)),
                    attempt_count=attempt_count,
                    was_optimal=sub.get("wasOptimal", sub.get("was_optimal", True)),
                    timestamp=sub.get("timestamp", datetime.utcnow().isoformat()),
                    split=split,
                )
                samples.append(asdict(sample))
        
        return pd.DataFrame(samples)


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def build_failure_transitions_dataset(
    submissions_json_path: str,
    output_dir: str,
) -> pd.DataFrame:
    """Build failure transitions dataset."""
    builder = DatasetBuilder(output_dir)
    failure_df, _ = builder.build_from_mongodb_export(submissions_json_path)
    return failure_df


def build_reinforcement_events_dataset(
    submissions_json_path: str,
    output_dir: str,
) -> pd.DataFrame:
    """Build reinforcement events dataset."""
    builder = DatasetBuilder(output_dir)
    _, reinforcement_df = builder.build_from_mongodb_export(submissions_json_path)
    return reinforcement_df


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_timestamp(ts) -> Optional[datetime]:
    """Parse timestamp from various formats."""
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _infer_subtype(root_cause: str, submission: Dict) -> str:
    """
    Infer subtype from submission data when not explicitly labeled.
    
    This is a fallback for migration. New data should have explicit subtypes.
    """
    
    verdict = submission.get("verdict", "").lower()
    category = submission.get("category", "").lower()
    
    # Default subtypes per root cause
    defaults = {
        "correctness": "wrong_invariant",
        "efficiency": "brute_force_under_constraints",
        "implementation": "off_by_one",
        "understanding_gap": "misread_constraint",
    }
    
    # More specific inference based on signals
    if root_cause == "correctness":
        if "boundary" in str(submission).lower():
            return "incorrect_boundary"
        if "edge" in str(submission).lower():
            return "partial_case_handling"
        return "wrong_invariant"
    
    elif root_cause == "efficiency":
        if verdict in ("time_limit_exceeded", "tle"):
            if category in ("graph", "graphs"):
                return "state_space_blowup"
            return "brute_force_under_constraints"
        return "suboptimal_data_structure"
    
    elif root_cause == "implementation":
        if "overflow" in str(submission).lower():
            return "overflow_underflow"
        if "type" in str(submission).lower():
            return "type_coercion_bug"
        return "off_by_one"
    
    elif root_cause == "understanding_gap":
        if "constraint" in str(submission).lower():
            return "misread_constraint"
        return "wrong_problem_model"
    
    return defaults.get(root_cause, "wrong_invariant")


def _infer_technique(submission: Dict) -> str:
    """
    Infer technique from submission when not explicitly labeled.
    """
    
    category = submission.get("category", "").lower()
    tags = submission.get("tags", [])
    
    tag_lower = [t.lower() for t in tags] if tags else []
    
    if "two_pointers" in tag_lower or "two pointers" in category:
        return "two_pointers"
    if "binary_search" in tag_lower or "binary search" in category:
        return "binary_search"
    if "prefix" in str(submission).lower():
        return "prefix_sum"
    if "sliding" in str(submission).lower():
        return "sliding_window"
    if category in ("dp", "dynamic programming"):
        return "dynamic_programming"
    if category in ("graph", "graphs"):
        return "graph_traversal"
    
    return "general"
