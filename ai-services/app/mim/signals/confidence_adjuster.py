"""
Confidence Adjuster (v3.x Intelligence Upgrade)
================================================

PURPOSE:
--------
Adds CONTEXTUAL confidence adjustment layer on top of base model confidence.
Separates "base_confidence" (from ML model) from "adjusted_confidence" (for actionability).

WHY THIS EXISTS:
----------------
Problems observed in production:
1. Recurrence is detected but has no decision weight
2. Cold start is underutilized (beginner given overly specific diagnosis)
3. Confidence aggregation suppresses escalation too aggressively
4. Regression cases don't benefit from historical evidence

Solution:
- Keep base_confidence unchanged (model output)
- Add adjusted_confidence that incorporates contextual signals
- Expose BOTH for transparency and debugging

DESIGN PRINCIPLES:
------------------
1. NEVER override base_confidence - only add adjustment
2. adjusted_confidence MUST be >= base_confidence - damping (safety floor)
3. adjusted_confidence MUST NOT exceed max_confidence (safety cap)
4. All adjustments are deterministic and explainable
5. Cold start REDUCES specificity, regression/recurrence INCREASES confidence

INTEGRATION:
------------
Called AFTER root cause/subtype prediction, BEFORE feedback generation
Output is merged into confidence_metadata

SAFETY INVARIANTS:
------------------
- adjusted_confidence <= max_confidence (always capped)
- adjusted_confidence >= base_confidence - max_damping (never too low)
- cold_start applies damping (not boost)
- recurrence_count >= 1 can only boost (never dampen)
"""

import logging
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

from app.mim.signals.regression_signal import RegressionSignal, RegressionSeverity

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Maximum confidence (safety cap - NEVER exceeded)
MAX_CONFIDENCE = 0.90

# Maximum damping (floor protection)
MAX_DAMPING = 0.15

# Cold start damping
COLD_START_DAMPING = 0.10

# Recurrence boost factors (cumulative up to a point)
RECURRENCE_BOOST_TIER_1 = 0.05  # recurrence_count >= 1
RECURRENCE_BOOST_TIER_2 = 0.08  # recurrence_count >= 2
RECURRENCE_BOOST_TIER_3 = 0.10  # recurrence_count >= 3

# Regression boost factors (from RegressionSeverity)
# Imported from regression_signal.py via RegressionSeverity.to_boost_factor()

# Problem understanding boost (when misread_constraint detected)
PROBLEM_UNDERSTANDING_BOOST = 0.05


# ═══════════════════════════════════════════════════════════════════════════════
# ADJUSTMENT REASON ENUM
# ═══════════════════════════════════════════════════════════════════════════════

class AdjustmentReason(str, Enum):
    """
    Reasons for confidence adjustment.
    
    Used for explainability and debugging.
    """
    COLD_START_DAMPING = "cold_start_damping"
    RECURRENCE_BOOST = "recurrence_boost"
    REGRESSION_BOOST = "regression_boost"
    PATTERN_CONTEXT_BOOST = "pattern_context_boost"
    PROBLEM_UNDERSTANDING_FLAG = "problem_understanding_flag"
    NO_ADJUSTMENT = "no_adjustment"
    
    def __str__(self) -> str:
        return self.value


# ═══════════════════════════════════════════════════════════════════════════════
# ADJUSTMENT OUTPUT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ConfidenceAdjustment:
    """
    Result of confidence adjustment.
    
    Contains both original and adjusted confidence with full audit trail.
    
    Attributes
    ----------
    base_confidence : float
        Original model confidence (unchanged)
    adjusted_confidence : float
        Contextually adjusted confidence for actionability
    total_boost : float
        Sum of all positive adjustments applied
    total_damping : float
        Sum of all negative adjustments applied
    adjustments_applied : List[Dict[str, Any]]
        Detailed list of adjustments for audit trail
    escalation_eligible : bool
        Whether this confidence level allows escalation
    conservative_mode : bool
        Whether system is in conservative mode (low confidence)
    """
    base_confidence: float = 0.0
    adjusted_confidence: float = 0.0
    total_boost: float = 0.0
    total_damping: float = 0.0
    adjustments_applied: List[Dict[str, Any]] = field(default_factory=list)
    escalation_eligible: bool = False
    conservative_mode: bool = False
    
    # Additional context flags
    is_cold_start: bool = False
    has_recurrence: bool = False
    has_regression: bool = False
    problem_understanding_detected: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "base_confidence": round(self.base_confidence, 4),
            "adjusted_confidence": round(self.adjusted_confidence, 4),
            "total_boost": round(self.total_boost, 4),
            "total_damping": round(self.total_damping, 4),
            "adjustments_applied": self.adjustments_applied,
            "escalation_eligible": self.escalation_eligible,
            "conservative_mode": self.conservative_mode,
            "context_flags": {
                "is_cold_start": self.is_cold_start,
                "has_recurrence": self.has_recurrence,
                "has_regression": self.has_regression,
                "problem_understanding_detected": self.problem_understanding_detected,
            },
        }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ADJUSTMENT FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def adjust_confidence_with_context(
    base_confidence: float,
    is_cold_start: bool = False,
    recurrence_count: int = 0,
    regression_signal: Optional[RegressionSignal] = None,
    root_cause: str = "",
    subtype: str = "",
    dominant_failure_modes: Optional[List[str]] = None,
    max_confidence: float = MAX_CONFIDENCE,
) -> ConfidenceAdjustment:
    """
    Adjust confidence based on contextual signals.
    
    ALGORITHM:
    ----------
    1. Start with base_confidence
    2. Apply damping (cold start only, caps at MAX_DAMPING)
    3. Apply boosts (recurrence, regression, problem understanding)
    4. Cap at max_confidence
    5. Ensure floor at base_confidence - MAX_DAMPING
    
    Parameters
    ----------
    base_confidence : float
        Original model confidence (0.0 to 1.0)
    is_cold_start : bool
        User has limited history (< MIN_SUBMISSIONS)
    recurrence_count : int
        Number of times user made this mistake before
    regression_signal : Optional[RegressionSignal]
        Regression detection result
    root_cause : str
        Predicted root cause
    subtype : str
        Predicted subtype
    dominant_failure_modes : Optional[List[str]]
        User's dominant failure modes from snapshot
    max_confidence : float
        Maximum allowed confidence (safety cap)
        
    Returns
    -------
    ConfidenceAdjustment
        Full adjustment result with audit trail
    """
    
    adjustments = []
    total_boost = 0.0
    total_damping = 0.0
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Apply cold start damping
    # ─────────────────────────────────────────────────────────────────────────
    
    if is_cold_start:
        total_damping += COLD_START_DAMPING
        adjustments.append({
            "reason": str(AdjustmentReason.COLD_START_DAMPING),
            "delta": -COLD_START_DAMPING,
            "rationale": "Reduced confidence due to limited user history (cold start). "
                        "Feedback should be more general, not overly specific.",
        })
        logger.debug(f"Cold start damping applied: -{COLD_START_DAMPING}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Apply recurrence boost
    # ─────────────────────────────────────────────────────────────────────────
    
    if recurrence_count >= 1:
        if recurrence_count >= 3:
            boost = RECURRENCE_BOOST_TIER_3
        elif recurrence_count >= 2:
            boost = RECURRENCE_BOOST_TIER_2
        else:
            boost = RECURRENCE_BOOST_TIER_1
        
        total_boost += boost
        adjustments.append({
            "reason": str(AdjustmentReason.RECURRENCE_BOOST),
            "delta": boost,
            "recurrence_count": recurrence_count,
            "rationale": f"Boosted confidence due to recurring mistake (count={recurrence_count}). "
                        f"Pattern evidence supports diagnosis.",
        })
        logger.debug(f"Recurrence boost applied: +{boost} (count={recurrence_count})")
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Apply regression boost
    # ─────────────────────────────────────────────────────────────────────────
    
    has_regression = False
    if regression_signal and regression_signal.regression_detected:
        has_regression = True
        boost = regression_signal.get_confidence_boost()
        if boost > 0:
            total_boost += boost
            adjustments.append({
                "reason": str(AdjustmentReason.REGRESSION_BOOST),
                "delta": boost,
                "severity": str(regression_signal.regression_severity),
                "violation_score": regression_signal.expectation_violation_score,
                "rationale": f"Boosted confidence due to regression detection "
                            f"(severity={regression_signal.regression_severity}). "
                            f"User historically succeeded in this area.",
            })
            logger.debug(f"Regression boost applied: +{boost}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: Check for problem understanding pattern
    # ─────────────────────────────────────────────────────────────────────────
    
    problem_understanding_detected = False
    dominant_modes = dominant_failure_modes or []
    
    # Detect if misread_constraint is a dominant pattern
    if subtype == "misread_constraint" or "misread_constraint" in dominant_modes:
        problem_understanding_detected = True
        # Only boost if this subtype matches user's pattern
        if "misread_constraint" in dominant_modes or subtype == "misread_constraint":
            total_boost += PROBLEM_UNDERSTANDING_BOOST
            adjustments.append({
                "reason": str(AdjustmentReason.PROBLEM_UNDERSTANDING_FLAG),
                "delta": PROBLEM_UNDERSTANDING_BOOST,
                "rationale": "Problem understanding issue detected. "
                            "User tends to misread constraints - feedback should clarify requirements.",
            })
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: Compute adjusted confidence with safety bounds
    # ─────────────────────────────────────────────────────────────────────────
    
    # Net adjustment
    net_adjustment = total_boost - total_damping
    adjusted = base_confidence + net_adjustment
    
    # Apply safety cap (never exceed max_confidence)
    adjusted = min(adjusted, max_confidence)
    
    # Apply safety floor (never go below base - MAX_DAMPING)
    floor = max(0.0, base_confidence - MAX_DAMPING)
    adjusted = max(adjusted, floor)
    
    # Determine escalation eligibility
    # Escalation is allowed when:
    # - adjusted_confidence >= 0.65 (medium tier), OR
    # - regression_detected with severity >= MEDIUM, OR
    # - recurrence_count >= 2
    escalation_eligible = (
        adjusted >= 0.65 or
        (has_regression and regression_signal.regression_severity 
         in [RegressionSeverity.MEDIUM, RegressionSeverity.HIGH]) or
        recurrence_count >= 2
    )
    
    # Conservative mode when adjusted confidence is low
    conservative_mode = adjusted < 0.50
    
    if not adjustments:
        adjustments.append({
            "reason": str(AdjustmentReason.NO_ADJUSTMENT),
            "delta": 0.0,
            "rationale": "No contextual adjustments applied.",
        })
    
    result = ConfidenceAdjustment(
        base_confidence=base_confidence,
        adjusted_confidence=adjusted,
        total_boost=total_boost,
        total_damping=total_damping,
        adjustments_applied=adjustments,
        escalation_eligible=escalation_eligible,
        conservative_mode=conservative_mode,
        is_cold_start=is_cold_start,
        has_recurrence=recurrence_count >= 1,
        has_regression=has_regression,
        problem_understanding_detected=problem_understanding_detected,
    )
    
    logger.info(
        f"📊 CONFIDENCE ADJUSTED | base={base_confidence:.3f} → "
        f"adjusted={adjusted:.3f} | boost={total_boost:.3f}, "
        f"damping={total_damping:.3f} | escalation={escalation_eligible}"
    )
    
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_combined_confidence(
    root_cause_confidence: float,
    subtype_confidence: float,
    adjustment: Optional[ConfidenceAdjustment] = None,
) -> Tuple[float, float]:
    """
    Compute combined confidence from root cause and subtype.
    
    Returns
    -------
    Tuple[float, float]
        (base_combined, adjusted_combined)
    """
    # Standard combination: average
    base_combined = (root_cause_confidence + subtype_confidence) / 2
    
    if adjustment:
        # Apply adjustment ratio to combined
        if adjustment.base_confidence > 0:
            ratio = adjustment.adjusted_confidence / adjustment.base_confidence
            adjusted_combined = base_combined * ratio
        else:
            adjusted_combined = adjustment.adjusted_confidence
        
        # Cap
        adjusted_combined = min(adjusted_combined, MAX_CONFIDENCE)
    else:
        adjusted_combined = base_combined
    
    return base_combined, adjusted_combined


def should_allow_pattern_detection(
    base_confidence: float,
    regression_signal: Optional[RegressionSignal] = None,
    recurrence_count: int = 0,
) -> Tuple[bool, str]:
    """
    Determine if pattern detection should be unblocked.
    
    REQUIREMENT 6: Unblock pattern detection safely when:
    - regression_detected == true, OR
    - recurrence_count >= 2
    
    Even at low base confidence, these contextual signals provide
    evidence that pattern detection is meaningful.
    
    Returns
    -------
    Tuple[bool, str]
        (allowed, reason)
    """
    # Standard confidence gate
    if base_confidence >= 0.65:
        return True, "confidence_sufficient"
    
    # Contextual unblocking
    if regression_signal and regression_signal.regression_detected:
        return True, "regression_override"
    
    if recurrence_count >= 2:
        return True, "recurrence_override"
    
    # Still blocked
    return False, "low_confidence_blocked"
