"""
MIM Delta Feature Extraction
============================

Convert submission history → state transition features.

CRITICAL DESIGN PRINCIPLES:
- ONLY failed submissions feed into this module
- Accepted submissions are NEVER processed here
- Cold-start handled with zero-fill + explicit flag
- All features are deltas (what changed), not absolutes

Feature Vector:
- delta_attempts_same_category: Change in attempts for this category
- delta_root_cause_repeat_rate: How often same subtype recurs
- delta_complexity_mismatch: Did user exceed expected complexity
- delta_time_to_accept: Change in time-to-solve
- delta_optimization_transition: Did user transition from brute force
- is_cold_start: Explicit cold-start flag
"""

from typing import Dict, List, Optional, NamedTuple
from collections import Counter
from dataclasses import dataclass
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# DATA TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DeltaFeatures:
    """
    Delta-based feature vector for MIM inference.
    
    All fields are REQUIRED. No optional fields.
    """
    delta_attempts_same_category: float
    delta_root_cause_repeat_rate: float
    delta_complexity_mismatch: float
    delta_time_to_accept: float
    delta_optimization_transition: float
    is_cold_start: float  # 1.0 if cold start, 0.0 otherwise
    
    # Additional context (not used by model, but for logging)
    history_length: int
    category: str
    
    def to_vector(self) -> List[float]:
        """Convert to model-ready vector."""
        return [
            self.delta_attempts_same_category,
            self.delta_root_cause_repeat_rate,
            self.delta_complexity_mismatch,
            self.delta_time_to_accept,
            self.delta_optimization_transition,
            self.is_cold_start,
        ]
    
    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary for JSON serialization."""
        return {
            "delta_attempts_same_category": self.delta_attempts_same_category,
            "delta_root_cause_repeat_rate": self.delta_root_cause_repeat_rate,
            "delta_complexity_mismatch": self.delta_complexity_mismatch,
            "delta_time_to_accept": self.delta_time_to_accept,
            "delta_optimization_transition": self.delta_optimization_transition,
            "is_cold_start": self.is_cold_start,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# CORE DELTA COMPUTATION
# ═══════════════════════════════════════════════════════════════════════════════

def compute_delta_features(
    *,
    user_history: List[Dict],
    current_submission: Dict,
) -> DeltaFeatures:
    """
    Compute delta-based behavioral features for a FAILED submission.

    Parameters
    ----------
    user_history : List[Dict]
        Chronological list of PAST FAILED submissions only.
        Each dict must contain:
        - subtype: str (predicted subtype)
        - category: str (problem category)
        - timestamp: datetime or ISO string
        - attempts_in_category: int (optional)
        - time_to_accept: float (optional, seconds)
        - used_complexity: str (optional, e.g., "O(n^2)")
        - expected_complexity: str (optional)
        
    current_submission : Dict
        Current FAILED submission with same schema.

    Returns
    -------
    DeltaFeatures
        Delta feature vector (model-ready)
        
    IMPORTANT:
    - This function assumes user_history contains ONLY failed submissions
    - Accepted submissions must be filtered out BEFORE calling this
    """
    
    history_len = len(user_history)
    current_category = current_submission.get("category", "unknown")
    
    # ───────────────────────────────────────────────────────────────────────────
    # COLD-START HANDLING (exact rules per requirements)
    # ───────────────────────────────────────────────────────────────────────────
    # Rule:
    #   < 2 failed submissions:  zero-fill deltas, is_cold_start = 1
    #   2-4 submissions:         compute deltas, is_cold_start = 1
    #   >= 5 submissions:        compute deltas, is_cold_start = 0
    # ───────────────────────────────────────────────────────────────────────────
    
    if history_len < 2:
        # Zero-fill: not enough history to compute meaningful deltas
        return DeltaFeatures(
            delta_attempts_same_category=0.0,
            delta_root_cause_repeat_rate=0.0,
            delta_complexity_mismatch=_complexity_mismatch(current_submission),
            delta_time_to_accept=0.0,
            delta_optimization_transition=0.0,
            is_cold_start=1.0,
            history_length=history_len,
            category=current_category,
        )
    
    last_submission = user_history[-1]
    
    # ───────────────────────────────────────────────────────────────────────────
    # DELTA: Attempts in Same Category
    # ───────────────────────────────────────────────────────────────────────────
    # Count how many submissions in history are in same category
    same_category_history = [
        s for s in user_history 
        if s.get("category", "").lower() == current_category.lower()
    ]
    prev_attempts = len(same_category_history)
    
    # Current attempt is +1 from history
    delta_attempts_same_category = 1.0  # We're adding one more attempt
    
    # ───────────────────────────────────────────────────────────────────────────
    # DELTA: Root Cause Repeat Rate
    # ───────────────────────────────────────────────────────────────────────────
    # Look at last k submissions (window), compute subtype repetition rate
    k = min(5, history_len)
    recent = user_history[-k:]
    
    subtype_counts = Counter(
        s.get("subtype") for s in recent if s.get("subtype") is not None
    )
    
    current_subtype = current_submission.get("subtype")
    if current_subtype and k > 0:
        # How often did this subtype appear in recent window?
        repeat_count = subtype_counts.get(current_subtype, 0)
        repeat_rate = repeat_count / k
    else:
        repeat_rate = 0.0
    
    # ───────────────────────────────────────────────────────────────────────────
    # DELTA: Complexity Mismatch
    # ───────────────────────────────────────────────────────────────────────────
    delta_complexity_mismatch = _complexity_mismatch(current_submission)
    
    # ───────────────────────────────────────────────────────────────────────────
    # DELTA: Time to Accept
    # ───────────────────────────────────────────────────────────────────────────
    prev_tta = last_submission.get("time_to_accept")
    curr_tta = current_submission.get("time_to_accept")
    
    if prev_tta is not None and curr_tta is not None:
        # Normalize to reasonable range (-1 to 1 for most cases)
        delta_time_to_accept = (curr_tta - prev_tta) / max(prev_tta, 1.0)
        delta_time_to_accept = max(-2.0, min(2.0, delta_time_to_accept))  # Clip
    else:
        delta_time_to_accept = 0.0
    
    # ───────────────────────────────────────────────────────────────────────────
    # DELTA: Optimization Transition
    # ───────────────────────────────────────────────────────────────────────────
    delta_optimization_transition = _optimization_transition(
        user_history, current_submission
    )
    
    # Determine cold-start flag:
    #   2-4 submissions: is_cold_start = 1 (still learning)
    #   >= 5 submissions: is_cold_start = 0 (full personalization)
    is_cold_start = 1.0 if history_len < 5 else 0.0
    
    return DeltaFeatures(
        delta_attempts_same_category=float(delta_attempts_same_category),
        delta_root_cause_repeat_rate=float(repeat_rate),
        delta_complexity_mismatch=float(delta_complexity_mismatch),
        delta_time_to_accept=float(delta_time_to_accept),
        delta_optimization_transition=float(delta_optimization_transition),
        is_cold_start=is_cold_start,
        history_length=history_len,
        category=current_category,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _complexity_mismatch(submission: Dict) -> float:
    """
    Returns 1.0 if used complexity exceeds expected complexity, else 0.0.
    """
    expected = submission.get("expected_complexity")
    used = submission.get("used_complexity")
    
    if not expected or not used:
        return 0.0
    
    return 1.0 if _complexity_rank(used) > _complexity_rank(expected) else 0.0


def _complexity_rank(complexity: str) -> int:
    """
    Ordinal ranking for Big-O comparison.
    """
    order = {
        "O(1)": 1,
        "O(log n)": 2,
        "O(sqrt(n))": 3,
        "O(n)": 4,
        "O(n log n)": 5,
        "O(n^2)": 6,
        "O(n^2 log n)": 7,
        "O(n^3)": 8,
        "O(2^n)": 9,
        "O(n!)": 10,
    }
    
    # Normalize input
    complexity_clean = complexity.strip().replace(" ", "")
    
    return order.get(complexity_clean, 5)  # Default to O(n) if unknown


def _optimization_transition(
    history: List[Dict], 
    current: Dict
) -> float:
    """
    Detect if user transitioned from brute force to optimized.
    
    Returns:
    - 1.0: User previously used brute force, now using optimal
    - -1.0: User regressed from optimal to brute force
    - 0.0: No transition detected
    """
    if len(history) < 2:
        return 0.0
    
    # Check last 3 submissions for complexity pattern
    recent = history[-3:]
    
    current_complexity = _complexity_rank(current.get("used_complexity", ""))
    
    # Get average complexity of recent submissions
    recent_complexities = [
        _complexity_rank(s.get("used_complexity", ""))
        for s in recent
        if s.get("used_complexity")
    ]
    
    if not recent_complexities:
        return 0.0
    
    avg_recent = sum(recent_complexities) / len(recent_complexities)
    
    # Significant improvement (lower complexity = better)
    if current_complexity < avg_recent - 1:
        return 1.0
    # Significant regression
    elif current_complexity > avg_recent + 1:
        return -1.0
    
    return 0.0


def compute_delta_features_batch(
    user_histories: Dict[str, List[Dict]],
    submissions: List[Dict],
) -> List[DeltaFeatures]:
    """
    Batch compute delta features for multiple submissions.
    
    Parameters
    ----------
    user_histories : Dict[str, List[Dict]]
        Mapping of user_id → list of past failed submissions
    submissions : List[Dict]
        Current submissions to process (must have user_id field)
        
    Returns
    -------
    List[DeltaFeatures]
        Delta features for each submission
    """
    results = []
    
    for submission in submissions:
        user_id = submission.get("user_id", "")
        history = user_histories.get(user_id, [])
        
        features = compute_delta_features(
            user_history=history,
            current_submission=submission,
        )
        results.append(features)
    
    return results
