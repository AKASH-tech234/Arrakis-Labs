"""
Regression Signal Detection (v3.x Intelligence Upgrade)
========================================================

PURPOSE:
--------
Detects when a user's current performance contradicts their historical 
competence. Regression is a FIRST-CLASS SIGNAL that distinguishes 
beginner failures from experienced user mistakes.

WHY THIS EXISTS:
----------------
Problem observed in production logs:
- A user with 50+ successful graph problems fails on a basic graph question
- MIM treats this identically to a beginner failing their first graph problem
- The feedback given is unhelpful because it assumes lack of knowledge

Solution:
- Regression detection adds contextual awareness
- When detected, downstream systems can:
  - Adjust confidence interpretation
  - Modify feedback tone (from teaching to refreshing)
  - Flag for pattern analysis despite low base confidence

DESIGN PRINCIPLES:
------------------
1. NO ML - Pure deterministic rules
2. NO architecture changes - Additive signal only
3. NO API changes - Output is metadata enrichment
4. ALWAYS backward compatible

INTEGRATION:
------------
Called by MIMDecisionNode._handle_failed() AFTER root cause prediction
Output is attached to confidence_metadata for downstream consumers
"""

import logging
from enum import Enum
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# REGRESSION SEVERITY LEVELS
# ═══════════════════════════════════════════════════════════════════════════════

class RegressionSeverity(str, Enum):
    """
    Severity of detected regression.
    
    Determines how strongly the regression signal affects downstream decisions.
    """
    NONE = "none"       # No regression detected
    LOW = "low"         # Minor expectation violation (1 std deviation)
    MEDIUM = "medium"   # Significant regression (2 std deviations)
    HIGH = "high"       # Severe regression (3+ std deviations, warrants attention)
    
    def __str__(self) -> str:
        return self.value
    
    def to_boost_factor(self) -> float:
        """
        Convert severity to confidence boost factor.
        
        Higher severity = more confidence boost (because we're more certain
        this is a regression case, not a genuine skill gap).
        """
        return {
            RegressionSeverity.NONE: 0.0,
            RegressionSeverity.LOW: 0.05,
            RegressionSeverity.MEDIUM: 0.10,
            RegressionSeverity.HIGH: 0.15,
        }.get(self, 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# REGRESSION SIGNAL OUTPUT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RegressionSignal:
    """
    Output of regression detection.
    
    This is a CONTEXTUAL SIGNAL - it augments MIM's base prediction
    without overriding it.
    
    Attributes
    ----------
    regression_detected : bool
        True if user's performance contradicts historical competence
    regression_severity : RegressionSeverity
        How severe the regression is (affects downstream decisions)
    expectation_violation_score : float
        0.0-1.0 score indicating how much reality diverges from expectation
    historical_success_rate : float
        User's historical success rate in this category
    expected_success : bool
        Based on history, did we expect this user to succeed?
    evidence : Dict[str, Any]
        Supporting evidence for regression detection (for explainability)
    """
    regression_detected: bool = False
    regression_severity: RegressionSeverity = RegressionSeverity.NONE
    expectation_violation_score: float = 0.0
    historical_success_rate: float = 0.0
    expected_success: bool = False
    evidence: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "regression_detected": self.regression_detected,
            "regression_severity": str(self.regression_severity),
            "expectation_violation_score": round(self.expectation_violation_score, 3),
            "historical_success_rate": round(self.historical_success_rate, 3),
            "expected_success": self.expected_success,
            "evidence": self.evidence,
        }
    
    def get_confidence_boost(self) -> float:
        """
        Get confidence boost based on regression severity.
        
        RATIONALE:
        When regression is detected, we're MORE confident in our diagnosis
        because we have historical evidence that this user CAN do better.
        """
        return self.regression_severity.to_boost_factor()


# ═══════════════════════════════════════════════════════════════════════════════
# DETECTION THRESHOLDS
# ═══════════════════════════════════════════════════════════════════════════════

# Minimum submissions in category to consider user "experienced"
MIN_CATEGORY_SUBMISSIONS = 5

# Success rate thresholds for considering user "strong" in category
STRONG_SUCCESS_RATE = 0.70  # 70%+ success rate = strong
MODERATE_SUCCESS_RATE = 0.50  # 50-70% = moderate

# Expectation violation thresholds
LOW_VIOLATION_THRESHOLD = 0.30
MEDIUM_VIOLATION_THRESHOLD = 0.50
HIGH_VIOLATION_THRESHOLD = 0.70

# Difficulty expectation adjustments
DIFFICULTY_EXPECTATIONS = {
    "easy": 0.15,     # Easy problems should be 15% easier than baseline
    "medium": 0.0,    # Medium = baseline
    "hard": -0.15,    # Hard problems can be 15% harder than baseline
}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN DETECTION FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def detect_regression(
    user_state_snapshot: Dict[str, Any],
    category: str,
    difficulty: str,
    verdict: str,
    problem_tags: Optional[List[str]] = None,
) -> RegressionSignal:
    """
    Detect if current failure represents a regression from expected performance.
    
    ALGORITHM:
    ----------
    1. Check if user has sufficient history in this category
    2. Calculate expected success probability based on:
       - Historical success rate in category
       - Difficulty adjustment
       - Strong/weak category flags
    3. Compare actual outcome (failure) with expectation
    4. Score the violation and determine severity
    
    Parameters
    ----------
    user_state_snapshot : Dict[str, Any]
        User's cognitive state snapshot containing:
        - strong_categories: List[str]
        - weak_categories: List[str]
        - category_success_rates: Dict[str, float] (optional)
        - category_submission_counts: Dict[str, int] (optional)
        - dominant_failure_modes: List[str]
    category : str
        Problem category (e.g., "arrays", "dp", "graph")
    difficulty : str
        Problem difficulty (e.g., "easy", "medium", "hard")
    verdict : str
        Submission verdict (assumed to be a failure type)
    problem_tags : Optional[List[str]]
        Additional problem tags for context
        
    Returns
    -------
    RegressionSignal
        Detection result with severity and evidence
    """
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Extract user history from snapshot
    # ─────────────────────────────────────────────────────────────────────────
    
    strong_categories = set(user_state_snapshot.get("strong_categories", []))
    weak_categories = set(user_state_snapshot.get("weak_categories", []))
    improving_categories = set(user_state_snapshot.get("improving_areas", []))
    stagnant_categories = set(user_state_snapshot.get("stagnant_areas", []))
    
    # Get category-specific stats if available
    category_success_rates = user_state_snapshot.get("category_success_rates", {})
    category_submission_counts = user_state_snapshot.get("category_submission_counts", {})
    
    # Normalize category name for matching
    category_lower = category.lower().strip()
    difficulty_lower = difficulty.lower().strip()
    
    # Find success rate (try exact match, then prefix match)
    historical_success_rate = _find_category_stat(
        category_lower, category_success_rates, default=0.0
    )
    submission_count = _find_category_stat(
        category_lower, category_submission_counts, default=0
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Determine if user is "experienced" in this category
    # ─────────────────────────────────────────────────────────────────────────
    
    is_category_strong = _is_category_match(category_lower, strong_categories)
    is_category_weak = _is_category_match(category_lower, weak_categories)
    is_improving = _is_category_match(category_lower, improving_categories)
    
    # User must have meaningful history OR be marked as strong
    has_history = submission_count >= MIN_CATEGORY_SUBMISSIONS
    is_experienced = has_history or is_category_strong
    
    evidence = {
        "category": category,
        "difficulty": difficulty,
        "is_category_strong": is_category_strong,
        "is_category_weak": is_category_weak,
        "is_improving": is_improving,
        "submission_count": submission_count,
        "has_sufficient_history": has_history,
    }
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Early exit if not experienced
    # ─────────────────────────────────────────────────────────────────────────
    
    if not is_experienced:
        logger.debug(
            f"No regression: insufficient history in {category} "
            f"(count={submission_count}, strong={is_category_strong})"
        )
        return RegressionSignal(
            regression_detected=False,
            regression_severity=RegressionSeverity.NONE,
            expectation_violation_score=0.0,
            historical_success_rate=historical_success_rate,
            expected_success=False,
            evidence=evidence,
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: Calculate expected success probability
    # ─────────────────────────────────────────────────────────────────────────
    
    # Start with historical success rate or infer from strong/weak flags
    if historical_success_rate > 0:
        base_expectation = historical_success_rate
    elif is_category_strong:
        base_expectation = STRONG_SUCCESS_RATE
    elif is_category_weak:
        base_expectation = 0.35  # Below moderate
    else:
        base_expectation = MODERATE_SUCCESS_RATE
    
    # Adjust for difficulty
    difficulty_adj = DIFFICULTY_EXPECTATIONS.get(difficulty_lower, 0.0)
    expected_success_prob = min(1.0, max(0.0, base_expectation + difficulty_adj))
    
    # Determine if we expected success
    expected_success = expected_success_prob >= MODERATE_SUCCESS_RATE
    
    evidence.update({
        "base_expectation": round(base_expectation, 3),
        "difficulty_adjustment": difficulty_adj,
        "expected_success_probability": round(expected_success_prob, 3),
        "expected_success": expected_success,
    })
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: Calculate expectation violation score
    # ─────────────────────────────────────────────────────────────────────────
    
    # Actual outcome is failure (0.0), expected was success probability
    # Violation = how much the failure surprises us given expectations
    
    if not expected_success:
        # We didn't expect success anyway - no regression
        expectation_violation = 0.0
        regression_detected = False
    else:
        # We expected success but got failure
        # Higher expected probability = higher violation score
        expectation_violation = expected_success_prob
        
        # Boost violation if this is a strong category
        if is_category_strong:
            expectation_violation = min(1.0, expectation_violation * 1.2)
        
        # Reduce violation if user is improving (learning dip is normal)
        if is_improving:
            expectation_violation *= 0.8
        
        regression_detected = expectation_violation >= LOW_VIOLATION_THRESHOLD
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 6: Determine severity
    # ─────────────────────────────────────────────────────────────────────────
    
    if not regression_detected:
        severity = RegressionSeverity.NONE
    elif expectation_violation >= HIGH_VIOLATION_THRESHOLD:
        severity = RegressionSeverity.HIGH
    elif expectation_violation >= MEDIUM_VIOLATION_THRESHOLD:
        severity = RegressionSeverity.MEDIUM
    else:
        severity = RegressionSeverity.LOW
    
    evidence.update({
        "expectation_violation_score": round(expectation_violation, 3),
        "regression_severity": str(severity),
    })
    
    if regression_detected:
        logger.info(
            f"🔄 REGRESSION DETECTED | category={category}, "
            f"severity={severity}, violation={expectation_violation:.3f}, "
            f"expected_success_prob={expected_success_prob:.3f}"
        )
    
    return RegressionSignal(
        regression_detected=regression_detected,
        regression_severity=severity,
        expectation_violation_score=expectation_violation,
        historical_success_rate=historical_success_rate,
        expected_success=expected_success,
        evidence=evidence,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _find_category_stat(
    category: str,
    stats_dict: Dict[str, Any],
    default: Any = None,
) -> Any:
    """
    Find statistic for category with fuzzy matching.
    
    Handles variations like "arrays" vs "array", "dp" vs "dynamic_programming".
    """
    # Try exact match first
    if category in stats_dict:
        return stats_dict[category]
    
    # Try prefix/suffix variations
    for key, value in stats_dict.items():
        key_lower = key.lower().strip()
        if key_lower == category or key_lower.startswith(category) or category.startswith(key_lower):
            return value
    
    # Common aliases
    aliases = {
        "dp": ["dynamic_programming", "dynamic programming"],
        "arrays": ["array"],
        "strings": ["string"],
        "graphs": ["graph"],
        "trees": ["tree"],
        "binary_search": ["binary search", "bsearch"],
    }
    
    for alias_key, alias_list in aliases.items():
        if category == alias_key:
            for alias in alias_list:
                if alias in stats_dict:
                    return stats_dict[alias]
        elif category in alias_list:
            if alias_key in stats_dict:
                return stats_dict[alias_key]
    
    return default


def _is_category_match(category: str, category_set: set) -> bool:
    """
    Check if category matches any in the set with fuzzy matching.
    """
    if not category_set:
        return False
    
    # Normalize for matching
    normalized_set = {c.lower().strip() for c in category_set}
    
    if category in normalized_set:
        return True
    
    # Check prefix matches
    for c in normalized_set:
        if c.startswith(category) or category.startswith(c):
            return True
    
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION FOR SNAPSHOT INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

def compute_regression_for_mim_input(
    mim_input: Any,  # MIMInput type
) -> RegressionSignal:
    """
    Convenience wrapper for computing regression from MIMInput.
    
    Used by MIMDecisionNode for easy integration.
    """
    return detect_regression(
        user_state_snapshot=mim_input.user_state_snapshot or {},
        category=mim_input.category,
        difficulty=mim_input.difficulty,
        verdict=mim_input.verdict,
        problem_tags=mim_input.problem_tags,
    )
