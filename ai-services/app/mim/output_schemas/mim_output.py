"""
MIM Output Schema
=================

Output from MIM inference pipeline.

Polymorphic: returns different feedback types based on submission verdict and root cause.
"""

from pydantic import BaseModel, Field, model_validator
from typing import Union, Literal, Optional, Dict, Any
from datetime import datetime

from .correctness_feedback import CorrectnessFeedback
from .performance_feedback import PerformanceFeedback
from .reinforcement_feedback import ReinforcementFeedback


class ConfidenceMetadata(BaseModel):
    """
    Confidence calibration metadata (Phase 2.1).
    
    Provides transparency about prediction confidence for downstream consumers.
    
    v3.x Intelligence Upgrade Additions:
    - adjusted_confidence: Context-adjusted confidence for actionability
    - regression_detected: Whether regression was detected
    - pattern_unblocked: Whether pattern detection was contextually unblocked
    - execution_mode: Whether ML or fallback rules were used
    """
    root_cause_confidence: float = Field(
        ..., ge=0, le=1,
        description="Calibrated confidence for root cause prediction"
    )
    subtype_confidence: float = Field(
        ..., ge=0, le=1,
        description="Calibrated confidence for subtype prediction"
    )
    combined_confidence: float = Field(
        ..., ge=0, le=1,
        description="Combined calibrated confidence"
    )
    confidence_level: Literal["high", "medium", "low"] = Field(
        ...,
        description="Confidence tier for decision-making"
    )
    conservative_mode: bool = Field(
        ...,
        description="True if confidence too low for aggressive decisions"
    )
    calibration_applied: bool = Field(
        ...,
        description="Whether isotonic calibration was applied"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # v3.x INTELLIGENCE UPGRADE: Contextual Signal Enrichment (Optional/Additive)
    # ═══════════════════════════════════════════════════════════════════════════
    
    # Adjusted confidence incorporating contextual signals
    adjusted_confidence: Optional[float] = Field(
        default=None, ge=0, le=1,
        description="Context-adjusted confidence (recurrence, regression boosts; cold start damping)"
    )
    
    # Regression detection (REQUIREMENT 1)
    regression_detected: Optional[bool] = Field(
        default=None,
        description="True if user's failure contradicts historical competence"
    )
    regression_severity: Optional[Literal["none", "low", "medium", "high"]] = Field(
        default=None,
        description="Severity of detected regression"
    )
    
    # Pattern unblocking (REQUIREMENT 6)
    pattern_unblocked: Optional[bool] = Field(
        default=None,
        description="True if pattern detection was contextually unblocked despite low confidence"
    )
    pattern_unblock_reason: Optional[str] = Field(
        default=None,
        description="Reason pattern detection was unblocked (regression_override, recurrence_override)"
    )
    
    # Escalation eligibility (REQUIREMENT 5)
    escalation_eligible: Optional[bool] = Field(
        default=None,
        description="True if adjusted confidence supports detailed/escalated feedback"
    )
    
    # Execution mode annotation (REQUIREMENT 7)
    execution_mode: Optional[Literal["ml_full", "ml_partial", "rules_fallback", "hybrid"]] = Field(
        default=None,
        description="How inference was executed (ml_full, rules_fallback, hybrid)"
    )
    cognitive_version: Optional[Literal["v2", "v3"]] = Field(
        default=None,
        description="Cognitive model version used (v2=fallback rules, v3=ML+rules)"
    )
    pipeline_version: Optional[str] = Field(
        default=None,
        description="Pipeline version (e.g., v3.x)"
    )


class MIMOutput(BaseModel):
    """
    Output schema from MIM decision node.
    
    Contains exactly ONE of:
    - correctness_feedback (if root_cause = correctness)
    - performance_feedback (if root_cause = efficiency)
    - reinforcement_feedback (if verdict = accepted)
    - implementation_feedback (if root_cause = implementation)
    - understanding_feedback (if root_cause = understanding_gap)
    
    NOTE: For implementation and understanding_gap, we reuse CorrectnessFeedback
    with appropriate subtypes, as the feedback structure is similar.
    """
    
    class Config:
        extra = "forbid"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ROUTING INFO (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    feedback_type: Literal[
        "correctness",
        "efficiency", 
        "implementation",
        "understanding_gap",
        "reinforcement",
    ] = Field(
        ...,
        description="Which feedback path was taken"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FEEDBACK PAYLOAD (exactly one will be populated)
    # ═══════════════════════════════════════════════════════════════════════════
    
    # For correctness failures
    correctness_feedback: Optional[CorrectnessFeedback] = Field(
        default=None,
        description="Populated when root_cause = correctness"
    )
    
    # For efficiency failures
    performance_feedback: Optional[PerformanceFeedback] = Field(
        default=None,
        description="Populated when root_cause = efficiency"
    )
    
    # For accepted submissions
    reinforcement_feedback: Optional[ReinforcementFeedback] = Field(
        default=None,
        description="Populated when verdict = accepted"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # METADATA (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    user_id: str = Field(..., description="User identifier")
    problem_id: str = Field(..., description="Problem identifier")
    submission_id: str = Field(..., description="Submission identifier")
    inference_latency_ms: float = Field(..., ge=0, description="Inference time in milliseconds")
    model_version: str = Field(..., description="MIM model version used")
    timestamp: str = Field(..., description="ISO timestamp of inference")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CONFIDENCE METADATA (Phase 2.1)
    # ═══════════════════════════════════════════════════════════════════════════
    
    confidence_metadata: Optional[ConfidenceMetadata] = Field(
        default=None,
        description="Calibrated confidence information (only for failed submissions)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATORS
    # ═══════════════════════════════════════════════════════════════════════════
    
    @model_validator(mode="after")
    def check_feedback_consistency(self):
        """Validate that appropriate feedback is provided for feedback_type."""
        # Map feedback_type to expected field
        expected_fields = {
            "correctness": "correctness_feedback",
            "implementation": "correctness_feedback",  # Reuses correctness structure
            "understanding_gap": "correctness_feedback",  # Reuses correctness structure
            "efficiency": "performance_feedback",
            "reinforcement": "reinforcement_feedback",
        }
        
        expected_field = expected_fields.get(self.feedback_type)
        
        if expected_field:
            feedback_value = getattr(self, expected_field, None)
            if feedback_value is None:
                raise ValueError(
                    f"For feedback_type='{self.feedback_type}', {expected_field} must be provided"
                )
        
        return self
    
    def get_feedback(self) -> Union[CorrectnessFeedback, PerformanceFeedback, ReinforcementFeedback]:
        """Get the appropriate feedback object based on type."""
        if self.feedback_type in ("correctness", "implementation", "understanding_gap"):
            return self.correctness_feedback
        elif self.feedback_type == "efficiency":
            return self.performance_feedback
        elif self.feedback_type == "reinforcement":
            return self.reinforcement_feedback
        else:
            raise ValueError(f"Unknown feedback_type: {self.feedback_type}")
