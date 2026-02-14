"""
MIM Signals Module (v3.x Intelligence Upgrade)
==============================================

Rule-based signal augmentation for MIM decision pipeline.

This module contains deterministic signal processors that enhance
MIM's decision-making without modifying ML models or architecture.

REQUIREMENTS ADDRESSED:
----------------------
1. REGRESSION SIGNAL: Detect when experienced user fails unexpectedly
2. RECURRENCE BOOST: Make recurrence actionable in confidence
3. COLD START DAMPING: Reduce specificity for new users
4. PROBLEM UNDERSTANDING: Separate misread constraints from correctness
5. CONFIDENCE ADJUSTMENT: Context-aware adjusted_confidence
6. PATTERN UNBLOCKING: Allow patterns with contextual evidence
7. FALLBACK ANNOTATION: Make v2 fallback mode explicit

INTEGRATION:
-----------
from app.mim.signals import (
    # Regression detection
    detect_regression,
    RegressionSignal,
    RegressionSeverity,
    
    # Confidence adjustment
    adjust_confidence_with_context,
    ConfidenceAdjustment,
    
    # Context enrichment
    enrich_mim_context,
    EnrichedContext,
    
    # Integration
    enrich_mim_output,
    compute_contextual_signals,
)
"""

from app.mim.signals.regression_signal import (
    RegressionSignal,
    RegressionSeverity,
    detect_regression,
    compute_regression_for_mim_input,
)
from app.mim.signals.confidence_adjuster import (
    ConfidenceAdjustment,
    AdjustmentReason,
    adjust_confidence_with_context,
    compute_combined_confidence,
    should_allow_pattern_detection,
)
from app.mim.signals.context_enricher import (
    EnrichedContext,
    ExecutionMode,
    CognitiveVersion,
    ProblemUnderstandingDimension,
    enrich_mim_context,
    create_enriched_metadata,
)
from app.mim.signals.integration import (
    EnrichedMIMOutput,
    enrich_mim_output,
    compute_contextual_signals,
    print_enriched_output,
)

__all__ = [
    # Regression detection
    "RegressionSignal",
    "RegressionSeverity",
    "detect_regression",
    "compute_regression_for_mim_input",
    # Confidence adjustment
    "ConfidenceAdjustment",
    "AdjustmentReason",
    "adjust_confidence_with_context",
    "compute_combined_confidence",
    "should_allow_pattern_detection",
    # Context enrichment
    "EnrichedContext",
    "ExecutionMode",
    "CognitiveVersion",
    "ProblemUnderstandingDimension",
    "enrich_mim_context",
    "create_enriched_metadata",
    # Integration
    "EnrichedMIMOutput",
    "enrich_mim_output",
    "compute_contextual_signals",
    "print_enriched_output",
]
