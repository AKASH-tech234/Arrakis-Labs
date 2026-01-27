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
        
        # Build datasets
        failure_df = self._build_failure_transitions(failed_submissions, accepted_submissions)
        reinforcement_df = self._build_reinforcement_events(accepted_submissions)
        
        # Save to parquet
        failure_path = self.output_dir / "mim_failure_transitions.parquet"
        reinforcement_path = self.output_dir / "mim_reinforcement_events.parquet"
        
        failure_df.to_parquet(failure_path, index=False)
        reinforcement_df.to_parquet(reinforcement_path, index=False)
        
        logger.info(f"Saved: {failure_path} ({len(failure_df)} samples)")
        logger.info(f"Saved: {reinforcement_path} ({len(reinforcement_df)} samples)")
        
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
