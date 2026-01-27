"""
CorrectnessFeedback Schema
==========================

For submissions with root_cause in {correctness, implementation, understanding_gap}.

STRICTLY REQUIRED FIELDS - no optional fields allowed.

CRITICAL:
- No Optional[...] fields
- Rejects nulls
- Rejects missing fields
- extra="forbid" prevents unknown fields
"""

from pydantic import BaseModel, Field, validator
from typing import List
from datetime import datetime

from app.mim.taxonomy.subtype_masks import ROOT_CAUSE_TO_SUBTYPES, validate_subtype


class CorrectnessFeedback(BaseModel):
    """
    Feedback schema for CORRECTNESS failures.
    
    Valid for root_cause in: correctness, implementation, understanding_gap
    
    DO NOT use this schema for:
    - Efficiency problems (use PerformanceFeedback)
    - Accepted submissions (use ReinforcementFeedback)
    
    ALL FIELDS ARE REQUIRED. Validation fails on nulls.
    """
    
    class Config:
        # Fail on extra fields
        extra = "forbid"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # METADATA (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    user_id: str = Field(..., description="User identifier")
    problem_id: str = Field(..., description="Problem identifier")
    submission_id: str = Field(..., description="Submission identifier")
    category: str = Field(..., description="Problem category")
    difficulty: str = Field(..., description="Problem difficulty")
    timestamp: str = Field(..., description="ISO timestamp")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CORE CLASSIFICATION (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    root_cause: str = Field(
        ...,
        description="One of the 4 ROOT_CAUSE values"
    )
    subtype: str = Field(
        ...,
        description="Masked by root_cause - validated against ROOT_CAUSE_TO_SUBTYPES"
    )
    failure_mechanism: str = Field(
        ...,
        description="Deterministic output from failure_mechanism_rules"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence in classification"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DIAGNOSTIC CONTENT (required, specific)
    # ═══════════════════════════════════════════════════════════════════════════
    
    explanation: str = Field(
        ...,
        min_length=5,
        description="Personalized explanation of the issue"
    )
    fix_direction: str = Field(
        ...,
        min_length=10,
        description="Concrete strategy to repair logic"
    )
    example_fix: str = Field(
        ...,
        description="Code example showing the fix"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # RECURRENCE TRACKING (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    is_recurring: bool = Field(
        ...,
        description="Whether this is a repeated mistake"
    )
    recurrence_count: int = Field(
        ...,
        ge=0,
        description="How many times this mistake has occurred"
    )
    related_past_problems: List[str] = Field(
        ...,
        description="Problem IDs with similar mistakes"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATORS
    # ═══════════════════════════════════════════════════════════════════════════
    
    @validator("root_cause")
    def validate_not_efficiency(cls, v):
        """CorrectnessFeedback is NOT for efficiency root_cause."""
        if v == "efficiency":
            raise ValueError(
                "root_cause='efficiency' must use PerformanceFeedback, not CorrectnessFeedback"
            )
        valid_root_causes = {"correctness", "implementation", "understanding_gap"}
        if v not in valid_root_causes:
            raise ValueError(
                f"Invalid root_cause '{v}' for CorrectnessFeedback. "
                f"Must be one of: {valid_root_causes}"
            )
        return v
    
    @validator("subtype")
    def validate_subtype_for_root_cause(cls, v, values):
        """Validate subtype is valid for the given root_cause."""
        root_cause = values.get("root_cause")
        if root_cause:
            try:
                validate_subtype(root_cause, v)
            except Exception as e:
                raise ValueError(str(e))
        return v
    
    @validator("explanation", "fix_direction")
    def reject_generic_phrases(cls, v):
        """Reject generic, non-specific feedback."""
        generic_phrases = [
            "review your code",
            "check for errors",
            "try again",
            "debug your solution",
            "fix the bug",
        ]
        v_lower = v.lower()
        for phrase in generic_phrases:
            if phrase in v_lower and len(v) < 50:
                raise ValueError(
                    f"Feedback appears generic: '{v}'. "
                    "Provide specific, personalized feedback."
                )
        return v
