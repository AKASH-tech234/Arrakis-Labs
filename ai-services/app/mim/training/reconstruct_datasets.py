"""
MIM V3.0 Dataset Reconstruction Script
======================================

PHASE 2: Build Canonical Training Datasets from Scratch

This script:
1. Archives old training artifacts
2. Builds mim_failure_transitions.parquet (FAILED only)
3. Builds mim_reinforcement_events.parquet (ACCEPTED only)
4. Validates schemas and taxonomy
5. Ensures no cross-contamination

Run with:
    python -m app.mim.training.reconstruct_datasets --input submissions.json --output ./data/mim_v3
"""

import argparse
import json
import logging
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Any
from collections import defaultdict

import pandas as pd
import numpy as np

from app.mim.training.canonical_dataset_schemas import (
    FailureTransitionRow,
    ReinforcementEventRow,
    validate_failure_transitions_dataframe,
    validate_reinforcement_events_dataframe,
    validate_no_cross_contamination,
)
from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    is_valid_pair,
    validate_subtype,
    SubtypeValidationError,
)
from app.mim.features.delta_features import compute_delta_features
from app.mim.features.state_snapshot import build_user_state_snapshot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

OLD_ARTIFACTS_TO_ARCHIVE = [
    "mim_training_data.csv",
    "mim_training_data.parquet",
    "mim_mixed_dataset.csv",
    "mim_combined.parquet",
    # Any file matching these patterns
]

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

# NOTE: Cold-start thresholds are defined in app.mim.features.delta_features
# Single source of truth for cold-start logic


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: ARCHIVE OLD ARTIFACTS
# ═══════════════════════════════════════════════════════════════════════════════

def archive_old_artifacts(data_dir: Path, archive_dir: Path) -> List[str]:
    """
    Move old training artifacts to archive (do not delete).
    
    Returns list of archived files.
    """
    archived = []
    archive_dir.mkdir(parents=True, exist_ok=True)
    
    # Timestamp for archive
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    
    for pattern in OLD_ARTIFACTS_TO_ARCHIVE:
        for old_file in data_dir.glob(pattern):
            archive_name = f"{old_file.stem}_archived_{ts}{old_file.suffix}"
            archive_path = archive_dir / archive_name
            
            logger.info(f"Archiving: {old_file} -> {archive_path}")
            shutil.move(str(old_file), str(archive_path))
            archived.append(str(archive_path))
    
    # Also check for any file with "mixed" in name
    for mixed_file in data_dir.glob("*mixed*"):
        archive_name = f"{mixed_file.stem}_archived_{ts}{mixed_file.suffix}"
        archive_path = archive_dir / archive_name
        
        logger.info(f"Archiving mixed file: {mixed_file} -> {archive_path}")
        shutil.move(str(mixed_file), str(archive_path))
        archived.append(str(archive_path))
    
    return archived


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: SEPARATE BY VERDICT
# ═══════════════════════════════════════════════════════════════════════════════

def separate_by_verdict(
    submissions: List[Dict]
) -> Tuple[List[Dict], List[Dict]]:
    """
    Separate submissions by verdict AT THE SOURCE.
    
    Returns (failed_submissions, accepted_submissions)
    """
    failed = []
    accepted = []
    
    for sub in submissions:
        verdict = sub.get("verdict", "").lower()
        if verdict in ("accepted", "ac"):
            accepted.append(sub)
        else:
            # All non-accepted are failed (WA, TLE, MLE, RE, CE, etc.)
            failed.append(sub)
    
    logger.info(f"Separated: {len(failed)} failed, {len(accepted)} accepted")
    return failed, accepted


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: BUILD FAILURE TRANSITIONS DATASET
# ═══════════════════════════════════════════════════════════════════════════════

def build_failure_transitions(
    failed_submissions: List[Dict],
    all_submissions: List[Dict],
) -> pd.DataFrame:
    """
    Build mim_failure_transitions.parquet.
    
    CRITICAL:
    - Delta features computed from user's FAILED history
    - Taxonomy validated for every row
    - Per-user time-ordered splits
    
    ❌ NO absolute counts
    ❌ NO accepted submissions
    """
    
    # Group submissions by user
    user_submissions = defaultdict(list)
    for sub in all_submissions:
        user_id = sub.get("userId") or sub.get("user_id", "unknown")
        user_submissions[user_id].append(sub)
    
    # Sort each user's submissions by time
    for user_id in user_submissions:
        user_submissions[user_id].sort(
            key=lambda x: x.get("timestamp") or x.get("created_at", "")
        )
    
    # Build samples
    samples = []
    invalid_taxonomy_count = 0
    
    for sub in failed_submissions:
        user_id = sub.get("userId") or sub.get("user_id", "unknown")
        
        # Get user's history BEFORE this submission
        user_history = []
        sub_time = sub.get("timestamp") or sub.get("created_at", "")
        for prev_sub in user_submissions[user_id]:
            prev_time = prev_sub.get("timestamp") or prev_sub.get("created_at", "")
            if prev_time < sub_time:
                user_history.append(prev_sub)
        
        # Get FAILED history only
        failed_history = [
            s for s in user_history 
            if s.get("verdict", "").lower() not in ("accepted", "ac")
        ]
        
        # Compute delta features using CENTRALIZED function (handles cold-start internally)
        delta_result = compute_delta_features(
            user_history=failed_history,
            current_submission=sub,
        )
        delta_features = delta_result.to_dict()
        is_cold_start = delta_result.is_cold_start
        
        # Build user state snapshot
        snapshot = _build_snapshot_from_history(user_id, failed_history, user_history)
        
        # Get labels (root_cause, subtype)
        root_cause = sub.get("root_cause") or sub.get("rootCause", "correctness")
        subtype = sub.get("subtype") or sub.get("mistake_subtype", "wrong_invariant")
        
        # Migrate old labels if needed
        root_cause = _migrate_root_cause(root_cause)
        subtype = _migrate_subtype(subtype, root_cause)
        
        # Validate taxonomy
        if not is_valid_pair(root_cause, subtype):
            invalid_taxonomy_count += 1
            logger.warning(f"Invalid taxonomy: ({root_cause}, {subtype}) - skipping")
            continue
        
        # Create sample
        sample = {
            "user_id": user_id,
            "problem_id": sub.get("problemId") or sub.get("problem_id", "unknown"),
            "submission_id": sub.get("submissionId") or sub.get("submission_id") or sub.get("_id", "unknown"),
            "timestamp": sub_time,
            "root_cause": root_cause,
            "subtype": subtype,
            "delta_attempts_same_category": delta_features["delta_attempts_same_category"],
            "delta_root_cause_repeat_rate": delta_features["delta_root_cause_repeat_rate"],
            "delta_complexity_mismatch": delta_features["delta_complexity_mismatch"],
            "delta_time_to_accept": delta_features["delta_time_to_accept"],
            "delta_optimization_transition": delta_features["delta_optimization_transition"],
            "is_cold_start": is_cold_start,
            "dominant_failure_modes": snapshot.get("dominant_failure_modes", []),
            "stagnant_areas": snapshot.get("stagnant_areas", []),
            "improving_areas": snapshot.get("improving_areas", []),
            "category": sub.get("category") or sub.get("problemCategory", "unknown"),
            "difficulty": sub.get("difficulty") or sub.get("problemDifficulty", "unknown"),
            "split": "",  # Will be assigned later
        }
        samples.append(sample)
    
    logger.info(f"Built {len(samples)} failure transition samples")
    logger.info(f"Skipped {invalid_taxonomy_count} with invalid taxonomy")
    
    # Assign splits (per-user time-ordered)
    samples = _assign_splits_per_user(samples)
    
    return pd.DataFrame(samples)


# DELETED: _compute_delta_features_from_history()
# Use compute_delta_features() from app.mim.features.delta_features instead
# This ensures single source of truth for delta computation logic


def _build_snapshot_from_history(
    user_id: str,
    failed_history: List[Dict],
    all_history: List[Dict],
) -> Dict[str, Any]:
    """Build user state snapshot from history."""
    if not failed_history:
        return {
            "dominant_failure_modes": [],
            "stagnant_areas": [],
            "improving_areas": [],
        }
    
    # Count subtypes
    subtype_counts = defaultdict(int)
    for sub in failed_history[-20:]:  # Recent 20
        st = sub.get("subtype") or sub.get("mistake_subtype", "")
        if st:
            subtype_counts[st] += 1
    
    # Top 3 subtypes
    sorted_subtypes = sorted(subtype_counts.items(), key=lambda x: -x[1])
    dominant = [s[0] for s in sorted_subtypes[:3]]
    
    # Category analysis (simplified)
    category_failures = defaultdict(int)
    for sub in failed_history[-20:]:
        cat = sub.get("category") or sub.get("problemCategory", "")
        if cat:
            category_failures[cat] += 1
    
    # Stagnant = high failure count
    stagnant = [cat for cat, count in category_failures.items() if count >= 3]
    
    # Improving = lower recent failure rate (simplified)
    improving = []
    
    return {
        "dominant_failure_modes": dominant,
        "stagnant_areas": stagnant,
        "improving_areas": improving,
    }


def _migrate_root_cause(root_cause: str) -> str:
    """Migrate old root cause labels to canonical."""
    migrations = {
        "logic_error": "correctness",
        "algorithm_choice": "efficiency",
        "performance": "efficiency",
        "time_limit": "efficiency",
        "memory_limit": "efficiency",
        "runtime_error": "implementation",
        "coding_error": "implementation",
        "understanding": "understanding_gap",
        "misunderstanding": "understanding_gap",
    }
    return migrations.get(root_cause.lower(), root_cause.lower())


def _migrate_subtype(subtype: str, root_cause: str) -> str:
    """Migrate old subtype labels to canonical."""
    migrations = {
        "off_by_one": "wrong_invariant",
        "loop_error": "wrong_invariant",
        "boundary_error": "incorrect_boundary",
        "edge_case": "partial_case_handling",
        "algorithm_inefficiency": "brute_force_under_constraints",
        "tle": "brute_force_under_constraints",
    }
    migrated = migrations.get(subtype.lower(), subtype.lower())
    
    # Ensure valid for root_cause
    if not is_valid_pair(root_cause, migrated):
        # Fall back to first valid subtype for this root
        valid_subtypes = ROOT_CAUSE_TO_SUBTYPES.get(root_cause, frozenset())
        if valid_subtypes:
            return sorted(valid_subtypes)[0]
    
    return migrated


def _assign_splits_per_user(samples: List[Dict]) -> List[Dict]:
    """
    Assign train/val/test splits per-user, time-ordered.
    
    Early submissions → train
    Middle submissions → val  
    Recent submissions → test
    """
    user_samples = defaultdict(list)
    for s in samples:
        user_samples[s["user_id"]].append(s)
    
    # Sort each user's samples by timestamp
    for user_id in user_samples:
        user_samples[user_id].sort(key=lambda x: x["timestamp"])
    
    # Assign splits
    for user_id, user_samps in user_samples.items():
        n = len(user_samps)
        train_end = int(n * TRAIN_RATIO)
        val_end = int(n * (TRAIN_RATIO + VAL_RATIO))
        
        for i, s in enumerate(user_samps):
            if i < train_end:
                s["split"] = "train"
            elif i < val_end:
                s["split"] = "val"
            else:
                s["split"] = "test"
    
    return samples


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: BUILD REINFORCEMENT EVENTS DATASET
# ═══════════════════════════════════════════════════════════════════════════════

def build_reinforcement_events(
    accepted_submissions: List[Dict],
) -> pd.DataFrame:
    """
    Build mim_reinforcement_events.parquet.
    
    CRITICAL:
    - NO root_cause
    - NO subtype
    - NO failure_mechanism
    
    Only positive reinforcement signals.
    """
    
    samples = []
    
    for sub in accepted_submissions:
        user_id = sub.get("userId") or sub.get("user_id", "unknown")
        
        # Extract technique from tags or code patterns
        technique = _extract_technique(sub)
        
        # Compute confidence boost
        confidence_boost = _compute_confidence_boost(sub)
        
        # Build strength signal
        strength_signal = _build_strength_signal(sub, technique)
        
        sample = {
            "user_id": user_id,
            "problem_id": sub.get("problemId") or sub.get("problem_id", "unknown"),
            "submission_id": sub.get("submissionId") or sub.get("submission_id") or sub.get("_id", "unknown"),
            "timestamp": sub.get("timestamp") or sub.get("created_at", ""),
            "category": sub.get("category") or sub.get("problemCategory", "unknown"),
            "technique": technique,
            "difficulty": sub.get("difficulty") or sub.get("problemDifficulty", "unknown"),
            "confidence_boost": confidence_boost,
            "strength_signal": strength_signal,
            "time_to_solve_seconds": float(sub.get("timeToSolve") or sub.get("runtime_ms", 0)),
            "attempt_count": int(sub.get("attemptCount") or sub.get("attempt_count", 1)),
            "was_optimal": bool(sub.get("wasOptimal") or sub.get("is_optimal", False)),
            "split": "",  # Will be assigned later
        }
        samples.append(sample)
    
    logger.info(f"Built {len(samples)} reinforcement event samples")
    
    # Assign splits
    samples = _assign_splits_per_user(samples)
    
    return pd.DataFrame(samples)


def _extract_technique(sub: Dict) -> str:
    """Extract technique from submission."""
    tags = sub.get("tags") or sub.get("problemTags") or []
    
    technique_keywords = {
        "two_pointers": ["two pointer", "two pointers", "2 pointer"],
        "binary_search": ["binary search", "bisect"],
        "sliding_window": ["sliding window"],
        "dp": ["dynamic programming", "dp", "memoization"],
        "greedy": ["greedy"],
        "dfs": ["dfs", "depth first"],
        "bfs": ["bfs", "breadth first"],
        "hash_table": ["hash", "hashmap", "hashtable"],
        "sorting": ["sort", "sorting"],
        "stack": ["stack"],
        "queue": ["queue"],
        "heap": ["heap", "priority queue"],
    }
    
    for technique, keywords in technique_keywords.items():
        for tag in tags:
            if any(kw in tag.lower() for kw in keywords):
                return technique
    
    return "general"


def _compute_confidence_boost(sub: Dict) -> float:
    """Compute confidence boost from submission."""
    difficulty = (sub.get("difficulty") or sub.get("problemDifficulty", "easy")).lower()
    was_optimal = sub.get("wasOptimal") or sub.get("is_optimal", False)
    attempt_count = int(sub.get("attemptCount") or sub.get("attempt_count", 1))
    
    # Base boost by difficulty
    base_boost = {"easy": 0.05, "medium": 0.10, "hard": 0.20}.get(difficulty, 0.05)
    
    # Bonus for optimal
    if was_optimal:
        base_boost *= 1.5
    
    # Penalty for many attempts
    if attempt_count > 5:
        base_boost *= 0.5
    elif attempt_count > 3:
        base_boost *= 0.75
    
    return min(base_boost, 1.0)


def _build_strength_signal(sub: Dict, technique: str) -> str:
    """Build human-readable strength signal."""
    difficulty = (sub.get("difficulty") or sub.get("problemDifficulty", "")).lower()
    was_optimal = sub.get("wasOptimal") or sub.get("is_optimal", False)
    
    if was_optimal:
        return f"Optimal {technique} solution for {difficulty} problem"
    else:
        return f"Successful {technique} approach on {difficulty} problem"


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN RECONSTRUCTION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def reconstruct_datasets(
    input_path: str,
    output_dir: str,
    archive_dir: str = None,
) -> Dict[str, Any]:
    """
    Main reconstruction pipeline.
    
    Parameters
    ----------
    input_path : str
        Path to raw submissions JSON
    output_dir : str
        Output directory for parquet files
    archive_dir : str, optional
        Archive directory for old artifacts
        
    Returns
    -------
    Dict with reconstruction report
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "input_path": input_path,
        "output_dir": output_dir,
    }
    
    # Step 1: Archive old artifacts
    if archive_dir:
        archive_path = Path(archive_dir)
        archived = archive_old_artifacts(output_path, archive_path)
        report["archived_files"] = archived
    
    # Step 2: Load raw submissions
    logger.info(f"Loading submissions from {input_path}")
    with open(input_path, 'r') as f:
        raw_submissions = json.load(f)
    report["total_submissions"] = len(raw_submissions)
    
    # Step 3: Separate by verdict
    failed, accepted = separate_by_verdict(raw_submissions)
    report["failed_count"] = len(failed)
    report["accepted_count"] = len(accepted)
    
    # Step 4: Build failure transitions dataset
    failure_df = build_failure_transitions(failed, raw_submissions)
    
    # Step 5: Build reinforcement events dataset
    reinforcement_df = build_reinforcement_events(accepted)
    
    # Step 6: Validate datasets
    logger.info("Validating failure transitions schema...")
    failure_validation = validate_failure_transitions_dataframe(failure_df)
    report["failure_validation"] = failure_validation
    
    logger.info("Validating reinforcement events schema...")
    reinforcement_validation = validate_reinforcement_events_dataframe(reinforcement_df)
    report["reinforcement_validation"] = reinforcement_validation
    
    # Step 7: Validate no cross-contamination
    logger.info("Validating no cross-contamination...")
    contamination_check = validate_no_cross_contamination(failure_df, reinforcement_df)
    report["cross_contamination"] = contamination_check
    
    # Step 8: Save if all valid
    all_valid = (
        failure_validation["valid"] and
        reinforcement_validation["valid"] and
        contamination_check["valid"]
    )
    
    if all_valid:
        failure_path = output_path / "mim_failure_transitions.parquet"
        reinforcement_path = output_path / "mim_reinforcement_events.parquet"
        
        failure_df.to_parquet(failure_path, index=False)
        reinforcement_df.to_parquet(reinforcement_path, index=False)
        
        logger.info(f"✅ Saved: {failure_path} ({len(failure_df)} rows)")
        logger.info(f"✅ Saved: {reinforcement_path} ({len(reinforcement_df)} rows)")
        
        report["success"] = True
        report["failure_path"] = str(failure_path)
        report["reinforcement_path"] = str(reinforcement_path)
    else:
        logger.error("❌ Validation failed - datasets not saved")
        report["success"] = False
    
    # Save report
    report_path = output_path / f"reconstruction_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    logger.info(f"Report saved: {report_path}")
    
    return report


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="MIM V3.0 Dataset Reconstruction"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Path to raw submissions JSON file"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory for parquet files"
    )
    parser.add_argument(
        "--archive", "-a",
        default=None,
        help="Archive directory for old artifacts"
    )
    
    args = parser.parse_args()
    
    report = reconstruct_datasets(
        input_path=args.input,
        output_dir=args.output,
        archive_dir=args.archive,
    )
    
    if report["success"]:
        print("\n✅ Dataset reconstruction successful!")
        print(f"   Failure transitions: {report.get('failure_path')}")
        print(f"   Reinforcement events: {report.get('reinforcement_path')}")
    else:
        print("\n❌ Dataset reconstruction failed!")
        print("   Check reconstruction report for details.")


if __name__ == "__main__":
    main()
