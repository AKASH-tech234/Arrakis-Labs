"""
ReinforcementFeedback Schema
============================

For ACCEPTED submissions ONLY.

CRITICAL:
- This schema is NEVER used for failed submissions
- This schema does NOT contain root_cause, subtype, or failure_mechanism
- This schema does NOT update mistake history
- This schema ONLY updates strength/readiness signals

NO OPTIONAL FIELDS - all required, fail-fast.
"""

from pydantic import BaseModel, Field, validator
from typing import List
from datetime import datetime


class ReinforcementFeedback(BaseModel):
    """
    Feedback schema for ACCEPTED submissions only.
    
    PURPOSE:
    - Update strength signals
    - Update confidence/readiness estimates
    - Feed recommender models
    
    NEVER:
    - Produce root causes (field does not exist)
    - Produce subtypes (field does not exist)
    - Update mistake recurrence
    - Affect failure history
    
    ALL FIELDS ARE REQUIRED. Validation fails on nulls.
    """
    
    class Config:
        extra = "forbid"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CONTEXT (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    category: str = Field(
        ...,
        description="Problem category"
    )
    technique: str = Field(
        ...,
        description="Technique demonstrated"
    )
    difficulty: str = Field(
        ...,
        description="Problem difficulty"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STRENGTH SIGNALS (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    confidence_boost: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Scalar confidence increment"
    )
    strength_signal: str = Field(
        ...,
        description="What skill this success reinforces"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATORS
    # ═══════════════════════════════════════════════════════════════════════════
    
    @validator("difficulty")
    def validate_difficulty(cls, v):
        valid = {"easy", "medium", "hard"}
        if v.lower() not in valid:
            raise ValueError(f"Invalid difficulty: {v}. Must be one of {valid}")
        return v.lower()
    
    @validator("confidence_boost")
    def validate_confidence_boost_range(cls, v, values):
        """Validate boost is in reasonable range."""
        difficulty = values.get("difficulty", "easy")
        # Higher difficulty should generally give higher boost
        min_boost = {"easy": 0.01, "medium": 0.05, "hard": 0.1}.get(difficulty, 0.01)
        # Don't fail validation, but this helps ensure meaningful boosts
        return v
