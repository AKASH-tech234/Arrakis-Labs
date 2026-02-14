"""
Context Enricher (v3.x Intelligence Upgrade)
=============================================

PURPOSE:
--------
Enriches MIM output with contextual intelligence layers without 
modifying the core decision pipeline.

WHY THIS EXISTS:
----------------
Problems observed in production:
1. Misread constraints collapse into generic correctness
2. Pattern detection blocked by low confidence
3. Fallback (v2) execution is silent and misleading
4. Regression cases indistinguishable from beginner failures

Solution:
- Add problem_understanding dimension (separate from correctness)
- Add execution_mode annotation for observability
- Provide enriched context for downstream agents

DESIGN PRINCIPLES:
------------------
1. ADDITIVE ONLY - never modify existing outputs
2. PRESERVES existing diagnosis - only adds context
3. Backward compatible - consumers can ignore enrichment
4. Deterministic - same inputs produce same outputs

INTEGRATION:
------------
Called at the END of MIM inference, AFTER feedback generation
Wraps MIMOutput with additional context layer
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from app.mim.signals.regression_signal import RegressionSignal
from app.mim.signals.confidence_adjuster import ConfidenceAdjustment

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# EXECUTION MODE (REQUIREMENT 7: Make Fallback Explicit)
# ═══════════════════════════════════════════════════════════════════════════════

class ExecutionMode(str, Enum):
    """
    Explicit execution mode annotation.
    
    Addresses REQUIREMENT 7: When v2 fallback rules are used,
    annotate output with execution_mode for observability.
    """
    ML_FULL = "ml_full"             # Full ML pipeline (models loaded)
    ML_PARTIAL = "ml_partial"       # Some models loaded, some fallback
    RULES_FALLBACK = "rules_fallback"  # All rule-based (v2 cognitive model)
    HYBRID = "hybrid"               # ML + contextual rules augmentation
    
    def __str__(self) -> str:
        return self.value


# ═══════════════════════════════════════════════════════════════════════════════
# COGNITIVE VERSION (for auditing)
# ═══════════════════════════════════════════════════════════════════════════════

class CognitiveVersion(str, Enum):
    """Cognitive model version used for inference."""
    V2 = "v2"    # Legacy rule-based fallback
    V3 = "v3"    # ML-based primary with rule augmentation
    
    def __str__(self) -> str:
        return self.value


# ═══════════════════════════════════════════════════════════════════════════════
# PROBLEM UNDERSTANDING DIMENSION (REQUIREMENT 4)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ProblemUnderstandingDimension:
    """
    Diagnostic dimension for problem understanding issues.
    
    REQUIREMENT 4: Separate misread constraints from generic correctness
    
    This dimension is PARALLEL to root_cause, not a replacement.
    When detected, downstream agents should prefer constraint clarification.
    
    Attributes
    ----------
    detected : bool
        Whether problem understanding issue is detected
    confidence : float
        Confidence in this detection (0.0 to 1.0)
    subtype : str
        Specific type of understanding issue
    original_root_cause : str
        The original correctness diagnosis (preserved)
    agent_guidance : str
        Guidance for downstream feedback agent
    """
    detected: bool = False
    confidence: float = 0.0
    subtype: str = ""
    original_root_cause: str = ""
    agent_guidance: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "detected": self.detected,
            "confidence": round(self.confidence, 3),
            "subtype": self.subtype,
            "original_root_cause_preserved": self.original_root_cause,
            "agent_guidance": self.agent_guidance,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# ENRICHED CONTEXT OUTPUT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass  
class EnrichedContext:
    """
    Full enriched context for MIM output.
    
    This wraps the original MIM output with additional intelligence layers.
    All fields are ADDITIVE - the original output is untouched.
    
    Attributes
    ----------
    execution_mode : ExecutionMode
        How inference was executed (ml_full, rules_fallback, etc.)
    cognitive_version : CognitiveVersion
        Which cognitive model was used (v2 or v3)
    pipeline_version : str
        Pipeline version (e.g., "v3.x")
    regression_signal : Optional[RegressionSignal]
        Regression detection result
    confidence_adjustment : Optional[ConfidenceAdjustment]
        Confidence adjustment details
    problem_understanding : Optional[ProblemUnderstandingDimension]
        Problem understanding dimension (parallel to correctness)
    pattern_unblocked : bool
        Whether pattern detection was contextually unblocked
    pattern_unblock_reason : str
        Why pattern detection was unblocked (if applicable)
    observability : Dict[str, Any]
        Additional observability metadata
    """
    execution_mode: ExecutionMode = ExecutionMode.ML_FULL
    cognitive_version: CognitiveVersion = CognitiveVersion.V3
    pipeline_version: str = "v3.x"
    
    regression_signal: Optional[RegressionSignal] = None
    confidence_adjustment: Optional[ConfidenceAdjustment] = None
    problem_understanding: Optional[ProblemUnderstandingDimension] = None
    
    pattern_unblocked: bool = False
    pattern_unblock_reason: str = ""
    
    observability: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "execution_mode": str(self.execution_mode),
            "cognitive_version": str(self.cognitive_version),
            "pipeline_version": self.pipeline_version,
            "regression": self.regression_signal.to_dict() if self.regression_signal else None,
            "confidence_adjustment": (
                self.confidence_adjustment.to_dict() 
                if self.confidence_adjustment else None
            ),
            "problem_understanding": (
                self.problem_understanding.to_dict() 
                if self.problem_understanding else None
            ),
            "pattern_detection": {
                "unblocked": self.pattern_unblocked,
                "reason": self.pattern_unblock_reason,
            },
            "observability": self.observability,
        }
    
    def should_emphasize_constraint_clarification(self) -> bool:
        """Check if feedback should emphasize constraint clarification."""
        if self.problem_understanding and self.problem_understanding.detected:
            return self.problem_understanding.confidence >= 0.5
        return False
    
    def get_agent_guidance(self) -> str:
        """Get consolidated guidance for downstream agents."""
        guidance_parts = []
        
        if self.execution_mode == ExecutionMode.RULES_FALLBACK:
            guidance_parts.append(
                "⚠️ FALLBACK MODE: Using rule-based inference (models not available). "
                "Diagnosis confidence may be lower than usual."
            )
        
        if self.regression_signal and self.regression_signal.regression_detected:
            guidance_parts.append(
                f"🔄 REGRESSION DETECTED ({self.regression_signal.regression_severity}): "
                f"User historically succeeded in this area. Feedback should acknowledge "
                f"this is a temporary setback, not a fundamental skill gap."
            )
        
        if self.problem_understanding and self.problem_understanding.detected:
            guidance_parts.append(
                f"📝 PROBLEM UNDERSTANDING ISSUE: {self.problem_understanding.agent_guidance}"
            )
        
        if self.pattern_unblocked:
            guidance_parts.append(
                f"🔓 PATTERN DETECTION UNBLOCKED: {self.pattern_unblock_reason}. "
                f"Pattern analysis is relevant despite lower base confidence."
            )
        
        if self.confidence_adjustment:
            if self.confidence_adjustment.escalation_eligible:
                guidance_parts.append(
                    "✅ ESCALATION ELIGIBLE: Confidence level supports detailed feedback."
                )
            if self.confidence_adjustment.conservative_mode:
                guidance_parts.append(
                    "🔒 CONSERVATIVE MODE: Keep feedback general due to low confidence."
                )
        
        return "\n".join(guidance_parts) if guidance_parts else ""


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ENRICHMENT FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def enrich_mim_context(
    root_cause: str,
    subtype: str,
    confidence: float,
    user_state_snapshot: Dict[str, Any],
    category: str,
    difficulty: str,
    verdict: str,
    is_cold_start: bool = False,
    recurrence_count: int = 0,
    models_loaded: bool = True,
    problem_tags: Optional[List[str]] = None,
) -> EnrichedContext:
    """
    Enrich MIM context with additional intelligence signals.
    
    This is the main integration point for all contextual augmentations.
    
    Parameters
    ----------
    root_cause : str
        Predicted root cause from MIM
    subtype : str
        Predicted subtype from MIM
    confidence : float
        Base confidence from MIM (already calibrated)
    user_state_snapshot : Dict[str, Any]
        User's cognitive state snapshot
    category : str
        Problem category
    difficulty : str
        Problem difficulty
    verdict : str
        Submission verdict
    is_cold_start : bool
        Whether user has limited history
    recurrence_count : int
        Number of times this mistake has occurred
    models_loaded : bool
        Whether ML models were loaded successfully
    problem_tags : Optional[List[str]]
        Problem tags for additional context
        
    Returns
    -------
    EnrichedContext
        Full enriched context with all signals
    """
    
    from app.mim.signals.regression_signal import detect_regression
    from app.mim.signals.confidence_adjuster import (
        adjust_confidence_with_context,
        should_allow_pattern_detection,
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Determine execution mode (REQUIREMENT 7)
    # ─────────────────────────────────────────────────────────────────────────
    
    if models_loaded:
        execution_mode = ExecutionMode.HYBRID  # ML + rule augmentation
        cognitive_version = CognitiveVersion.V3
    else:
        execution_mode = ExecutionMode.RULES_FALLBACK
        cognitive_version = CognitiveVersion.V2
        logger.warning(
            f"⚠️ FALLBACK MODE: Using v2 rule-based inference | "
            f"root_cause={root_cause}, confidence={confidence:.3f}"
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Detect regression (REQUIREMENT 1)
    # ─────────────────────────────────────────────────────────────────────────
    
    regression_signal = detect_regression(
        user_state_snapshot=user_state_snapshot,
        category=category,
        difficulty=difficulty,
        verdict=verdict,
        problem_tags=problem_tags,
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Adjust confidence (REQUIREMENTS 2, 3, 5)
    # ─────────────────────────────────────────────────────────────────────────
    
    dominant_failure_modes = user_state_snapshot.get("dominant_failure_modes", [])
    
    confidence_adjustment = adjust_confidence_with_context(
        base_confidence=confidence,
        is_cold_start=is_cold_start,
        recurrence_count=recurrence_count,
        regression_signal=regression_signal,
        root_cause=root_cause,
        subtype=subtype,
        dominant_failure_modes=dominant_failure_modes,
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: Detect problem understanding issues (REQUIREMENT 4)
    # ─────────────────────────────────────────────────────────────────────────
    
    problem_understanding = _detect_problem_understanding(
        root_cause=root_cause,
        subtype=subtype,
        dominant_failure_modes=dominant_failure_modes,
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: Check pattern detection unblocking (REQUIREMENT 6)
    # ─────────────────────────────────────────────────────────────────────────
    
    pattern_allowed, pattern_reason = should_allow_pattern_detection(
        base_confidence=confidence,
        regression_signal=regression_signal,
        recurrence_count=recurrence_count,
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 6: Build observability metadata
    # ─────────────────────────────────────────────────────────────────────────
    
    observability = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "input_summary": {
            "category": category,
            "difficulty": difficulty,
            "verdict": verdict,
            "is_cold_start": is_cold_start,
            "recurrence_count": recurrence_count,
        },
        "signals_computed": [
            "regression" if regression_signal.regression_detected else None,
            "confidence_adjustment",
            "problem_understanding" if problem_understanding.detected else None,
        ],
        "models_loaded": models_loaded,
    }
    # Remove None values
    observability["signals_computed"] = [
        s for s in observability["signals_computed"] if s
    ]
    
    return EnrichedContext(
        execution_mode=execution_mode,
        cognitive_version=cognitive_version,
        pipeline_version="v3.x",
        regression_signal=regression_signal,
        confidence_adjustment=confidence_adjustment,
        problem_understanding=problem_understanding,
        pattern_unblocked=pattern_allowed and confidence < 0.65,  # Only flag if it WAS unblocked
        pattern_unblock_reason=pattern_reason if pattern_allowed and confidence < 0.65 else "",
        observability=observability,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROBLEM UNDERSTANDING DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

def _detect_problem_understanding(
    root_cause: str,
    subtype: str,
    dominant_failure_modes: List[str],
) -> ProblemUnderstandingDimension:
    """
    Detect problem understanding issues (REQUIREMENT 4).
    
    If misread_constraint dominates failure modes:
    - Annotate root cause as problem_understanding
    - Preserve original correctness diagnosis internally
    - Provide guidance for constraint clarification
    
    Returns
    -------
    ProblemUnderstandingDimension
        Detection result with agent guidance
    """
    
    # Check for misread_constraint in subtype or dominant modes
    understanding_subtypes = {
        "misread_constraint",
        "misread_constraints",
        "wrong_input_format", 
        "wrong_problem_entirely",
    }
    
    is_understanding_subtype = subtype in understanding_subtypes
    understanding_modes_count = sum(
        1 for mode in dominant_failure_modes 
        if mode in understanding_subtypes
    )
    
    # Detect if this is a problem understanding issue
    detected = False
    confidence = 0.0
    actual_subtype = ""
    guidance = ""
    
    if is_understanding_subtype:
        detected = True
        actual_subtype = subtype
        confidence = 0.7
        guidance = (
            f"User has {subtype} pattern. Feedback should clarify problem requirements "
            f"before addressing code-level issues."
        )
    elif understanding_modes_count >= 2:
        # Dominant pattern is understanding issues
        detected = True
        actual_subtype = "dominant_understanding_pattern"
        confidence = 0.6
        guidance = (
            "User frequently misreads constraints. Feedback should ALWAYS include "
            "constraint summary before explaining the code issue."
        )
    elif understanding_modes_count >= 1:
        # Some evidence of understanding issues
        detected = True
        actual_subtype = "occasional_understanding_issue"
        confidence = 0.4
        guidance = (
            "User sometimes misreads constraints. Consider mentioning relevant "
            "constraints in feedback."
        )
    
    return ProblemUnderstandingDimension(
        detected=detected,
        confidence=confidence,
        subtype=actual_subtype,
        original_root_cause=root_cause,
        agent_guidance=guidance,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION FOR MIMDecisionNode INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

def create_enriched_metadata(
    mim_input: Any,  # MIMInput type
    root_cause: str,
    subtype: str,
    confidence: float,
    recurrence_count: int,
    models_loaded: bool,
) -> Dict[str, Any]:
    """
    Create enriched metadata dictionary for MIMOutput.
    
    Convenience function for easy integration into MIMDecisionNode.
    """
    snapshot = mim_input.user_state_snapshot or {}
    is_cold_start = snapshot.get("is_cold_start", False)
    
    # Check delta features for cold start flag
    if hasattr(mim_input, 'delta_features') and mim_input.delta_features:
        is_cold_start = mim_input.delta_features.get("is_cold_start", 0) == 1
    
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
        problem_tags=mim_input.problem_tags,
    )
    
    return {
        "enriched_context": enriched.to_dict(),
        "agent_guidance": enriched.get_agent_guidance(),
    }
