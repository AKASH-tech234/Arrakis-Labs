"""
MIM Confidence Calibration Module (Phase 2.1)
=============================================

Provides empirical calibration for MIM model confidence scores.

Goals:
- Reliability diagrams (confidence vs actual accuracy)
- Expected Calibration Error (ECE) computation
- Empirical threshold validation
- Calibration wrappers (isotonic regression or Platt scaling)

Design Principles:
- Confidence remains a CONTROL signal, not a prediction target.
- Calibration is OFFLINE only (no online adaptation).
- Thresholds are empirically validated, not hand-tuned.
- High confidence → high correctness must hold.

Usage:
    from app.mim.calibration import (
        CalibrationEvaluator,
        CalibrationWrapper,
        compute_ece,
        plot_reliability_diagram,
    )
"""

from .evaluator import (
    CalibrationEvaluator,
    CalibrationResult,
    compute_ece,
    compute_reliability_curve,
)

from .wrapper import (
    CalibrationWrapper,
    apply_isotonic_calibration,
    apply_platt_calibration,
)

from .thresholds import (
    ThresholdValidator,
    validate_confidence_thresholds,
    recommend_thresholds,
)

__all__ = [
    # Evaluator
    "CalibrationEvaluator",
    "CalibrationResult",
    "compute_ece",
    "compute_reliability_curve",
    # Wrapper
    "CalibrationWrapper",
    "apply_isotonic_calibration",
    "apply_platt_calibration",
    # Thresholds
    "ThresholdValidator",
    "validate_confidence_thresholds",
    "recommend_thresholds",
]
