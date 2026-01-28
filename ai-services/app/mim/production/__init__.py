"""
MIM Production Readiness Module (Phase 4)
=========================================

Components for safe production deployment:
- Model Registry: Version tracking, rollback, comparison
- Drift Detection: Feature and prediction drift monitoring
- Shadow Mode: Safe experimentation without affecting users

Guarantees:
- All model updates are offline and validated
- Rollback is always possible
- Drift is detected and alerted
- New models can be tested in shadow mode before promotion
"""

from .model_registry import (
    ModelRegistry,
    ModelVersion,
    get_active_model,
    rollback_model,
)

from .drift_detector import (
    DriftDetector,
    DriftReport,
    check_feature_drift,
    check_prediction_drift,
)

from .shadow_mode import (
    ShadowModeEvaluator,
    run_shadow_comparison,
)

__all__ = [
    # Registry
    "ModelRegistry",
    "ModelVersion",
    "get_active_model",
    "rollback_model",
    # Drift
    "DriftDetector",
    "DriftReport",
    "check_feature_drift",
    "check_prediction_drift",
    # Shadow
    "ShadowModeEvaluator",
    "run_shadow_comparison",
]
