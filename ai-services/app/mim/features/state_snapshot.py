"""
MIM User State Snapshot Builder
===============================

Builds pre-inference user state snapshots.

CRITICAL:
- This snapshot MUST be injected into MIM decision node
- This snapshot MUST be injected into feedback generation
- This snapshot MUST be injected into explanation logic
- Without this snapshot, feedback will be generic

The snapshot answers:
- What does this user struggle with?
- Where are they improving?
- Where are they stuck?
- What transitions have they made?
"""

from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone


# ═══════════════════════════════════════════════════════════════════════════════
# DATA TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class UserStateSnapshot:
    """
    Pre-inference user state snapshot.
    
    MANDATORY: All fields are required, no optional fields.
    """
    user_id: str
    
    # Dominant patterns (from failed submissions)
    dominant_failure_modes: List[str]  # Top 3 subtypes
    dominant_root_causes: List[str]    # Top 2 root causes
    
    # Trajectory signals
    improving_areas: List[str]     # Categories with decreasing failure rate
    stagnant_areas: List[str]      # Categories with no improvement
    regressing_areas: List[str]    # Categories with increasing failure rate
    
    # Strength signals (from accepted submissions)
    strong_categories: List[str]   # High success rate
    strong_techniques: List[str]   # Techniques that work for this user
    
    # Transitions (behavioral)
    recent_transitions: Dict[str, bool]  # e.g., brute_force_to_optimized
    
    # Metadata
    total_failed: int
    total_accepted: int
    history_span_days: int
    snapshot_timestamp: str
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "user_id": self.user_id,
            "dominant_failure_modes": self.dominant_failure_modes,
            "dominant_root_causes": self.dominant_root_causes,
            "improving_areas": self.improving_areas,
            "stagnant_areas": self.stagnant_areas,
            "regressing_areas": self.regressing_areas,
            "strong_categories": self.strong_categories,
            "strong_techniques": self.strong_techniques,
            "recent_transitions": self.recent_transitions,
            "total_failed": self.total_failed,
            "total_accepted": self.total_accepted,
            "history_span_days": self.history_span_days,
            "snapshot_timestamp": self.snapshot_timestamp,
        }
    
    @classmethod
    def empty(cls, user_id: str) -> "UserStateSnapshot":
        """Create empty snapshot for new users."""
        return cls(
            user_id=user_id,
            dominant_failure_modes=[],
            dominant_root_causes=[],
            improving_areas=[],
            stagnant_areas=[],
            regressing_areas=[],
            strong_categories=[],
            strong_techniques=[],
            recent_transitions={
                "brute_force_to_optimized": False,
                "optimized_to_brute_force": False,
                "new_category_attempted": False,
            },
            total_failed=0,
            total_accepted=0,
            history_span_days=0,
            snapshot_timestamp=datetime.utcnow().isoformat(),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SNAPSHOT BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

def build_user_state_snapshot(
    *,
    user_id: str,
    failed_submissions: List[Dict],
    accepted_submissions: List[Dict],
    lookback_days: int = 30,
) -> UserStateSnapshot:
    """
    Build a pre-inference user state snapshot.
    
    Parameters
    ----------
    user_id : str
        User identifier
    failed_submissions : List[Dict]
        Chronological list of FAILED submissions.
        Each dict should contain:
        - subtype: str
        - root_cause: str
        - category: str
        - timestamp: datetime or ISO string
    accepted_submissions : List[Dict]
        Chronological list of ACCEPTED submissions.
        Each dict should contain:
        - category: str
        - technique: str (optional)
        - timestamp: datetime or ISO string
    lookback_days : int
        How far back to look for trajectory analysis
        
    Returns
    -------
    UserStateSnapshot
        Pre-inference snapshot (MUST be injected into MIM)
    """
    
    if not failed_submissions and not accepted_submissions:
        return UserStateSnapshot.empty(user_id)
    
    # Use timezone-aware UTC timestamps to avoid naive/aware arithmetic bugs.
    now = datetime.now(tz=timezone.utc)
    
    # ───────────────────────────────────────────────────────────────────────────
    # DOMINANT FAILURE MODES (from failed submissions)
    # ───────────────────────────────────────────────────────────────────────────
    subtype_counts = Counter(
        s.get("subtype") for s in failed_submissions 
        if s.get("subtype")
    )
    dominant_failure_modes = [
        subtype for subtype, _ in subtype_counts.most_common(3)
    ]
    
    root_cause_counts = Counter(
        s.get("root_cause") for s in failed_submissions
        if s.get("root_cause")
    )
    dominant_root_causes = [
        rc for rc, _ in root_cause_counts.most_common(2)
    ]
    
    # ───────────────────────────────────────────────────────────────────────────
    # TRAJECTORY ANALYSIS (improving / stagnant / regressing)
    # ───────────────────────────────────────────────────────────────────────────
    improving_areas, stagnant_areas, regressing_areas = _compute_trajectories(
        failed_submissions=failed_submissions,
        accepted_submissions=accepted_submissions,
        lookback_days=lookback_days,
    )
    
    # ───────────────────────────────────────────────────────────────────────────
    # STRENGTH SIGNALS (from accepted submissions)
    # ───────────────────────────────────────────────────────────────────────────
    strong_categories, strong_techniques = _compute_strengths(
        accepted_submissions=accepted_submissions,
        failed_submissions=failed_submissions,
    )
    
    # ───────────────────────────────────────────────────────────────────────────
    # RECENT TRANSITIONS
    # ───────────────────────────────────────────────────────────────────────────
    recent_transitions = _detect_transitions(
        failed_submissions=failed_submissions,
        accepted_submissions=accepted_submissions,
    )
    
    # ───────────────────────────────────────────────────────────────────────────
    # METADATA
    # ───────────────────────────────────────────────────────────────────────────
    all_submissions = failed_submissions + accepted_submissions
    
    if all_submissions:
        timestamps = [_parse_timestamp(s.get("timestamp")) for s in all_submissions]
        timestamps = [t for t in timestamps if t is not None]
        if timestamps:
            earliest = min(timestamps)
            history_span_days = (now - earliest).days
        else:
            history_span_days = 0
    else:
        history_span_days = 0
    
    return UserStateSnapshot(
        user_id=user_id,
        dominant_failure_modes=dominant_failure_modes,
        dominant_root_causes=dominant_root_causes,
        improving_areas=improving_areas,
        stagnant_areas=stagnant_areas,
        regressing_areas=regressing_areas,
        strong_categories=strong_categories,
        strong_techniques=strong_techniques,
        recent_transitions=recent_transitions,
        total_failed=len(failed_submissions),
        total_accepted=len(accepted_submissions),
        history_span_days=history_span_days,
        snapshot_timestamp=now.isoformat(),
    )


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


def _compute_trajectories(
    *,
    failed_submissions: List[Dict],
    accepted_submissions: List[Dict],
    lookback_days: int,
) -> tuple:
    """
    Compute category trajectories: improving, stagnant, regressing.
    
    Logic:
    - Split history into two halves (early vs recent)
    - Compare failure rates per category
    - Improving: failure rate decreased
    - Stagnant: failure rate unchanged (±5%)
    - Regressing: failure rate increased
    """
    
    if len(failed_submissions) < 4:
        # Not enough data for trajectory analysis
        return [], [], []
    
    # Split into early and recent halves
    all_submissions = sorted(
        [{"status": "failed", **s} for s in failed_submissions] +
        [{"status": "accepted", **s} for s in accepted_submissions],
        key=lambda x: _parse_timestamp(x.get("timestamp")) or datetime.min
    )
    
    mid = len(all_submissions) // 2
    early = all_submissions[:mid]
    recent = all_submissions[mid:]
    
    # Compute failure rate per category in each half
    def failure_rate_by_category(submissions: List[Dict]) -> Dict[str, float]:
        category_stats = defaultdict(lambda: {"failed": 0, "total": 0})
        for s in submissions:
            cat = s.get("category", "unknown").lower()
            category_stats[cat]["total"] += 1
            if s.get("status") == "failed":
                category_stats[cat]["failed"] += 1
        
        return {
            cat: stats["failed"] / stats["total"] if stats["total"] > 0 else 0
            for cat, stats in category_stats.items()
        }
    
    early_rates = failure_rate_by_category(early)
    recent_rates = failure_rate_by_category(recent)
    
    # Classify categories
    improving = []
    stagnant = []
    regressing = []
    
    all_categories = set(early_rates.keys()) | set(recent_rates.keys())
    
    for cat in all_categories:
        early_rate = early_rates.get(cat, 0)
        recent_rate = recent_rates.get(cat, 0)
        
        diff = recent_rate - early_rate
        
        if diff < -0.1:  # Failure rate decreased by >10%
            improving.append(cat)
        elif diff > 0.1:  # Failure rate increased by >10%
            regressing.append(cat)
        else:
            stagnant.append(cat)
    
    return improving, stagnant, regressing


def _compute_strengths(
    *,
    accepted_submissions: List[Dict],
    failed_submissions: List[Dict],
) -> tuple:
    """
    Compute strong categories and techniques.
    
    Strong category: >70% success rate with ≥3 attempts
    Strong technique: technique used in ≥2 accepted solutions
    """
    
    # Category success rates
    category_stats = defaultdict(lambda: {"accepted": 0, "failed": 0})
    
    for s in accepted_submissions:
        cat = s.get("category", "unknown").lower()
        category_stats[cat]["accepted"] += 1
    
    for s in failed_submissions:
        cat = s.get("category", "unknown").lower()
        category_stats[cat]["failed"] += 1
    
    strong_categories = []
    for cat, stats in category_stats.items():
        total = stats["accepted"] + stats["failed"]
        if total >= 3:
            success_rate = stats["accepted"] / total
            if success_rate >= 0.7:
                strong_categories.append(cat)
    
    # Strong techniques
    technique_counts = Counter(
        s.get("technique") for s in accepted_submissions
        if s.get("technique")
    )
    strong_techniques = [
        tech for tech, count in technique_counts.items()
        if count >= 2
    ]
    
    return strong_categories, strong_techniques


def _detect_transitions(
    *,
    failed_submissions: List[Dict],
    accepted_submissions: List[Dict],
) -> Dict[str, bool]:
    """
    Detect behavioral transitions.
    """
    
    transitions = {
        "brute_force_to_optimized": False,
        "optimized_to_brute_force": False,
        "new_category_attempted": False,
        "subtype_repeat_broken": False,
    }
    
    if len(failed_submissions) < 3:
        return transitions
    
    recent_5 = failed_submissions[-5:] if len(failed_submissions) >= 5 else failed_submissions
    
    # Check complexity transitions
    complexities = [
        s.get("used_complexity", "") for s in recent_5
    ]
    
    # Brute force indicators
    brute_force = {"O(n^2)", "O(n^3)", "O(2^n)", "O(n!)"}
    optimal = {"O(n)", "O(n log n)", "O(log n)", "O(1)"}
    
    early_brute = any(c in brute_force for c in complexities[:2])
    recent_optimal = any(c in optimal for c in complexities[-2:])
    
    if early_brute and recent_optimal:
        transitions["brute_force_to_optimized"] = True
    
    early_optimal = any(c in optimal for c in complexities[:2])
    recent_brute = any(c in brute_force for c in complexities[-2:])
    
    if early_optimal and recent_brute:
        transitions["optimized_to_brute_force"] = True
    
    # New category attempted
    all_categories = set(s.get("category", "").lower() for s in failed_submissions[:-1])
    latest_category = failed_submissions[-1].get("category", "").lower() if failed_submissions else ""
    
    if latest_category and latest_category not in all_categories:
        transitions["new_category_attempted"] = True
    
    # Subtype repeat broken
    if len(recent_5) >= 3:
        recent_subtypes = [s.get("subtype") for s in recent_5 if s.get("subtype")]
        if len(recent_subtypes) >= 3:
            # Check if last subtype is different from the mode of previous
            mode = Counter(recent_subtypes[:-1]).most_common(1)
            if mode and recent_subtypes[-1] != mode[0][0]:
                transitions["subtype_repeat_broken"] = True
    
    return transitions
