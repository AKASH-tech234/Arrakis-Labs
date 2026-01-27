"""
PerformanceFeedback Schema
==========================

For submissions with root_cause = "efficiency".

STRICTLY REQUIRED FIELDS - no optional fields allowed.

CRITICAL:
- ONLY valid when root_cause == "efficiency"
- No Optional[...] fields
- Rejects nulls
- Rejects missing fields
"""

from pydantic import BaseModel, Field, validator
from typing import List
from datetime import datetime

from app.mim.taxonomy.subtype_masks import ROOT_CAUSE_TO_SUBTYPES, validate_subtype


class PerformanceFeedback(BaseModel):
    """
    Feedback schema for EFFICIENCY failures only.
    
    Use for:
    - Time Limit Exceeded (TLE)
    - Memory Limit Exceeded (MLE)
    - Suboptimal complexity
    
    DO NOT use this schema for:
    - Correctness problems (use CorrectnessFeedback)
    - Accepted submissions (use ReinforcementFeedback)
    
    ALL FIELDS ARE REQUIRED. Validation fails on nulls.
    """
    
    class Config:
        extra = "forbid"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CORE CLASSIFICATION (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    root_cause: str = Field(
        default="efficiency",
        description="Must be 'efficiency' for this schema"
    )
    subtype: str = Field(
        ...,
        description="Efficiency-related subtype"
    )
    failure_mechanism: str = Field(
        ...,
        description="Deterministic output from failure_mechanism_rules"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # COMPLEXITY ANALYSIS (required, performance-specific)
    # ═══════════════════════════════════════════════════════════════════════════
    
    expected_complexity: str = Field(
        ...,
        description="Expected Big-O from constraints"
    )
    observed_complexity: str = Field(
        ...,
        description="Inferred Big-O from code"
    )
    optimization_direction: str = Field(
        ...,
        min_length=10,
        description="What algorithmic shift is required"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATORS
    # ═══════════════════════════════════════════════════════════════════════════
    
    @validator("root_cause")
    def validate_efficiency_only(cls, v):
        """PerformanceFeedback is ONLY for efficiency root_cause."""
        if v != "efficiency":
            raise ValueError(
                f"root_cause must be 'efficiency' for PerformanceFeedback, got '{v}'. "
                "Use CorrectnessFeedback for other root causes."
            )
        return v
    
    @validator("subtype")
    def validate_efficiency_subtype(cls, v, values):
        """Validate subtype is valid for efficiency."""
        root_cause = values.get("root_cause", "efficiency")
        try:
            validate_subtype(root_cause, v)
        except Exception as e:
            raise ValueError(str(e))
        return v
    
    @validator("expected_complexity", "observed_complexity")
    def validate_complexity_format(cls, v):
        """Ensure complexity is in Big-O notation."""
        if not v.startswith("O("):
            raise ValueError(f"Complexity must be in Big-O notation: {v}")
        return v
