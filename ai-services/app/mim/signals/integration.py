"""
MIM Signal Integration (v3.x Intelligence Upgrade)
===================================================

PURPOSE:
--------
Provides the integration layer between MIM signals and the decision pipeline.
This module is the SINGLE entry point for all contextual signal augmentation.

USAGE:
------
This module should be called AFTER MIM inference completes, to enrich
the output with contextual signals. The enrichment is ADDITIVE and
does not modify the original MIM output.

Example:
    from app.mim.signals.integration import enrich_mim_output
    
    # After MIM inference
    mim_output = node.infer(mim_input)
    
    # Enrich with contextual signals
    enriched_output = enrich_mim_output(
        mim_output=mim_output,
        mim_input=mim_input,
        models_loaded=True,
    )
    
    # Access enriched data
    print(enriched_output.enriched_context)
    print(enriched_output.agent_guidance)

DESIGN:
-------
- All signals are computed and attached as metadata
- Original MIMOutput fields are NEVER modified
- Additional fields are exposed through enriched_context dict
- Agent guidance is provided as a consolidated string
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.mim.signals.regression_signal import (
    RegressionSignal,
    detect_regression,
)
from app.mim.signals.confidence_adjuster import (
    ConfidenceAdjustment,
    adjust_confidence_with_context,
    should_allow_pattern_detection,
)
from app.mim.signals.context_enricher import (
    EnrichedContext,
    ExecutionMode,
    CognitiveVersion,
    enrich_mim_context,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# ENRICHED OUTPUT WRAPPER
# ═══════════════════════════════════════════════════════════════════════════════

class EnrichedMIMOutput:
    """
    Wrapper that adds enriched context to MIMOutput.
    
    This wrapper PRESERVES the original MIMOutput while adding
    contextual intelligence signals.
    
    Attributes
    ----------
    mim_output : MIMOutput
        Original MIM output (unchanged)
    enriched_context : EnrichedContext
        Full enriched context with all signals
    agent_guidance : str
        Consolidated guidance for downstream agents
    """
    
    def __init__(
        self,
        mim_output: Any,  # MIMOutput type
        enriched_context: EnrichedContext,
    ):
        self.mim_output = mim_output
        self.enriched_context = enriched_context
        self.agent_guidance = enriched_context.get_agent_guidance()
    
    def __getattr__(self, name: str) -> Any:
        """Delegate attribute access to original MIMOutput."""
        return getattr(self.mim_output, name)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert to dictionary with enriched context.
        
        This is the primary way to serialize the enriched output.
        """
        # Get base MIMOutput dict
        if hasattr(self.mim_output, 'model_dump'):
            base = self.mim_output.model_dump()
        elif hasattr(self.mim_output, 'dict'):
            base = self.mim_output.dict()
        else:
            base = {}
        
        # Add enriched context
        base['enriched_context'] = self.enriched_context.to_dict()
        base['agent_guidance'] = self.agent_guidance
        
        return base
    
    def get_adjusted_confidence(self) -> float:
        """Get the context-adjusted confidence."""
        adj = self.enriched_context.confidence_adjustment
        if adj:
            return adj.adjusted_confidence
        # Fallback to base confidence
        cm = getattr(self.mim_output, 'confidence_metadata', None)
        if cm:
            return cm.combined_confidence
        return 0.5  # Default
    
    def is_regression_case(self) -> bool:
        """Check if this is a regression case."""
        rs = self.enriched_context.regression_signal
        return rs is not None and rs.regression_detected
    
    def should_emphasize_constraints(self) -> bool:
        """Check if feedback should emphasize constraint clarification."""
        return self.enriched_context.should_emphasize_constraint_clarification()
    
    def is_fallback_mode(self) -> bool:
        """Check if inference used fallback (v2) rules."""
        return self.enriched_context.execution_mode == ExecutionMode.RULES_FALLBACK


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN INTEGRATION FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def enrich_mim_output(
    mim_output: Any,  # MIMOutput type
    mim_input: Any,   # MIMInput type
    models_loaded: bool = True,
) -> EnrichedMIMOutput:
    """
    Enrich MIM output with contextual signals.
    
    This is the main integration function that should be called
    AFTER MIM inference completes.
    
    Parameters
    ----------
    mim_output : MIMOutput
        Original MIM inference output
    mim_input : MIMInput
        Original MIM inference input
    models_loaded : bool
        Whether ML models were loaded successfully
        
    Returns
    -------
    EnrichedMIMOutput
        Wrapped output with enriched context
    """
    
    # Extract required fields from MIMOutput
    feedback_type = mim_output.feedback_type
    
    # For reinforcement feedback, no enrichment needed
    if feedback_type == "reinforcement":
        # Create minimal enriched context for accepted submissions
        enriched = EnrichedContext(
            execution_mode=ExecutionMode.ML_FULL if models_loaded else ExecutionMode.RULES_FALLBACK,
            cognitive_version=CognitiveVersion.V3 if models_loaded else CognitiveVersion.V2,
            pipeline_version="v3.x",
            observability={
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "feedback_type": "reinforcement",
                "enrichment_skipped": True,
                "reason": "Accepted submission - no failure analysis needed",
            }
        )
        return EnrichedMIMOutput(mim_output, enriched)
    
    # Extract diagnosis info from feedback
    feedback = mim_output.get_feedback()
    root_cause = getattr(feedback, 'root_cause', feedback_type)
    subtype = getattr(feedback, 'subtype', '')
    is_recurring = getattr(feedback, 'is_recurring', False)
    recurrence_count = getattr(feedback, 'recurrence_count', 0)
    
    # Get confidence from metadata
    cm = mim_output.confidence_metadata
    if cm:
        confidence = cm.combined_confidence
    else:
        confidence = getattr(feedback, 'confidence', 0.5)
    
    # Extract user state
    snapshot = getattr(mim_input, 'user_state_snapshot', {}) or {}
    delta_features = getattr(mim_input, 'delta_features', {}) or {}
    is_cold_start = delta_features.get('is_cold_start', 0) == 1
    
    # Generate enriched context
    enriched = enrich_mim_context(
        root_cause=root_cause,
        subtype=subtype,
        confidence=confidence,
        user_state_snapshot=snapshot,
        category=mim_input.category,
        difficulty=mim_input.difficulty,
        verdict=mim_input.verdict,
        is_cold_start=is_cold_start,
        recurrence_count=recurrence_count,
        models_loaded=models_loaded,
        problem_tags=getattr(mim_input, 'problem_tags', None),
    )
    
    # Log enrichment summary
    _log_enrichment_summary(mim_output, enriched)
    
    return EnrichedMIMOutput(mim_output, enriched)


# ═══════════════════════════════════════════════════════════════════════════════
# INLINE ENRICHMENT (for use within MIMDecisionNode)
# ═══════════════════════════════════════════════════════════════════════════════

def compute_contextual_signals(
    root_cause: str,
    subtype: str,
    base_confidence: float,
    user_state_snapshot: Dict[str, Any],
    category: str,
    difficulty: str,
    verdict: str,
    is_cold_start: bool,
    recurrence_count: int,
    models_loaded: bool,
    problem_tags: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Compute contextual signals for inline use in MIMDecisionNode.
    
    This function can be called from within _handle_failed() to
    add enriched context to confidence_metadata.
    
    Returns
    -------
    Dict[str, Any]
        Dictionary containing all signal computations
    """
    
    # 1. Detect regression
    regression_signal = detect_regression(
        user_state_snapshot=user_state_snapshot,
        category=category,
        difficulty=difficulty,
        verdict=verdict,
        problem_tags=problem_tags,
    )
    
    # 2. Adjust confidence
    dominant_modes = user_state_snapshot.get("dominant_failure_modes", [])
    confidence_adjustment = adjust_confidence_with_context(
        base_confidence=base_confidence,
        is_cold_start=is_cold_start,
        recurrence_count=recurrence_count,
        regression_signal=regression_signal,
        root_cause=root_cause,
        subtype=subtype,
        dominant_failure_modes=dominant_modes,
    )
    
    # 3. Check pattern unblocking
    pattern_allowed, pattern_reason = should_allow_pattern_detection(
        base_confidence=base_confidence,
        regression_signal=regression_signal,
        recurrence_count=recurrence_count,
    )
    
    # 4. Determine execution mode
    if models_loaded:
        execution_mode = str(ExecutionMode.HYBRID)
        cognitive_version = str(CognitiveVersion.V3)
    else:
        execution_mode = str(ExecutionMode.RULES_FALLBACK)
        cognitive_version = str(CognitiveVersion.V2)
    
    return {
        "execution_mode": execution_mode,
        "cognitive_version": cognitive_version,
        "pipeline_version": "v3.x",
        "regression": regression_signal.to_dict(),
        "confidence_adjustment": confidence_adjustment.to_dict(),
        "pattern_detection_unblocked": pattern_allowed and base_confidence < 0.65,
        "pattern_unblock_reason": pattern_reason if pattern_allowed and base_confidence < 0.65 else None,
        "adjusted_confidence": confidence_adjustment.adjusted_confidence,
        "escalation_eligible": confidence_adjustment.escalation_eligible,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _log_enrichment_summary(mim_output: Any, enriched: EnrichedContext) -> None:
    """Log enrichment summary for observability."""
    
    parts = [f"execution_mode={enriched.execution_mode}"]
    
    if enriched.regression_signal and enriched.regression_signal.regression_detected:
        parts.append(f"regression={enriched.regression_signal.regression_severity}")
    
    if enriched.confidence_adjustment:
        adj = enriched.confidence_adjustment
        parts.append(f"base_conf={adj.base_confidence:.3f}")
        parts.append(f"adj_conf={adj.adjusted_confidence:.3f}")
    
    if enriched.pattern_unblocked:
        parts.append(f"pattern_unblocked=True")
    
    if enriched.problem_understanding and enriched.problem_understanding.detected:
        parts.append(f"problem_understanding={enriched.problem_understanding.subtype}")
    
    logger.info(f"🧠 MIM ENRICHMENT | {' | '.join(parts)}")


# ═══════════════════════════════════════════════════════════════════════════════
# CONSOLE LOGGING FOR ENRICHED OUTPUT
# ═══════════════════════════════════════════════════════════════════════════════

def print_enriched_output(enriched: EnrichedMIMOutput) -> None:
    """
    Print enriched MIM output to console.
    
    For debugging and demonstration purposes.
    """
    print("\n" + "=" * 70)
    print("🧠 MIM ENRICHED CONTEXT (v3.x Intelligence Upgrade)")
    print("=" * 70)
    
    ctx = enriched.enriched_context
    
    # Execution mode
    print(f"  EXECUTION MODE: {ctx.execution_mode}")
    print(f"  COGNITIVE VERSION: {ctx.cognitive_version}")
    print(f"  PIPELINE VERSION: {ctx.pipeline_version}")
    
    # Regression signal
    if ctx.regression_signal:
        rs = ctx.regression_signal
        print(f"\n  REGRESSION SIGNAL:")
        print(f"    └─ detected:          {rs.regression_detected}")
        if rs.regression_detected:
            print(f"    └─ severity:          {rs.regression_severity}")
            print(f"    └─ violation_score:   {rs.expectation_violation_score:.3f}")
            print(f"    └─ expected_success:  {rs.expected_success}")
    
    # Confidence adjustment
    if ctx.confidence_adjustment:
        ca = ctx.confidence_adjustment
        print(f"\n  CONFIDENCE ADJUSTMENT:")
        print(f"    └─ base_confidence:    {ca.base_confidence:.3f}")
        print(f"    └─ adjusted_confidence: {ca.adjusted_confidence:.3f}")
        print(f"    └─ total_boost:        +{ca.total_boost:.3f}")
        print(f"    └─ total_damping:      -{ca.total_damping:.3f}")
        print(f"    └─ escalation_eligible: {ca.escalation_eligible}")
        print(f"    └─ conservative_mode:   {ca.conservative_mode}")
    
    # Problem understanding
    if ctx.problem_understanding and ctx.problem_understanding.detected:
        pu = ctx.problem_understanding
        print(f"\n  PROBLEM UNDERSTANDING:")
        print(f"    └─ detected:           {pu.detected}")
        print(f"    └─ subtype:            {pu.subtype}")
        print(f"    └─ confidence:         {pu.confidence:.3f}")
        print(f"    └─ guidance:           {pu.agent_guidance[:60]}...")
    
    # Pattern unblocking
    if ctx.pattern_unblocked:
        print(f"\n  PATTERN DETECTION:")
        print(f"    └─ unblocked:          True")
        print(f"    └─ reason:             {ctx.pattern_unblock_reason}")
    
    # Agent guidance
    if enriched.agent_guidance:
        print(f"\n  AGENT GUIDANCE:")
        for line in enriched.agent_guidance.split('\n'):
            if line.strip():
                print(f"    {line}")
    
    print("=" * 70 + "\n")
