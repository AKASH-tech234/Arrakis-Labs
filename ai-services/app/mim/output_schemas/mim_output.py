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
