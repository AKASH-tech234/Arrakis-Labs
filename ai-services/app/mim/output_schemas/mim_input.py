"""
MIM Input Schema
================

Input to MIM inference pipeline.

ALL FIELDS ARE REQUIRED.
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, Any, List
from datetime import datetime


class MIMInput(BaseModel):
    """
    Input schema for MIM decision node.
    
    CRITICAL: User state snapshot MUST be provided.
    Without it, feedback will be generic.
    
    ALL FIELDS ARE REQUIRED.
    """
    
    class Config:
        extra = "forbid"
        validate_all = True
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SUBMISSION DATA (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    user_id: str = Field(
        ...,
        min_length=1,
        description="User identifier"
    )
    problem_id: str = Field(
        ...,
        min_length=1,
        description="Problem identifier"
    )
    submission_id: str = Field(
        ...,
        min_length=1,
        description="Submission identifier"
    )
    code: str = Field(
        ...,
        min_length=1,
        description="Submitted code"
    )
    verdict: str = Field(
        ...,
        description="Execution verdict (accepted, wrong_answer, etc.)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PROBLEM CONTEXT (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    category: str = Field(
        ...,
        description="Problem category (arrays, dp, graph, etc.)"
    )
    difficulty: str = Field(
        ...,
        description="Problem difficulty (easy, medium, hard)"
    )
    expected_complexity: str = Field(
        ...,
        description="Expected time complexity (e.g., O(n log n))"
    )
    constraints: Dict[str, Any] = Field(
        ...,
        description="Problem constraints (e.g., {'n': 100000})"
    )
    problem_tags: List[str] = Field(
        ...,
        description="Problem tags (e.g., ['binary_search', 'two_pointers'])"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # USER STATE SNAPSHOT (required - CRITICAL)
    # ═══════════════════════════════════════════════════════════════════════════
    
    user_state_snapshot: Dict[str, Any] = Field(
        ...,
        description="Pre-built user state snapshot (MANDATORY for personalization)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELTA FEATURES (required for failed submissions)
    # ═══════════════════════════════════════════════════════════════════════════
    
    delta_features: Dict[str, float] = Field(
        ...,
        description="Delta-based behavioral features"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # METADATA (required)
    # ═══════════════════════════════════════════════════════════════════════════
    
    timestamp: str = Field(
        ...,
        description="Submission timestamp (ISO format)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATORS
    # ═══════════════════════════════════════════════════════════════════════════
    
    @validator("user_state_snapshot")
    def validate_snapshot_not_empty(cls, v):
        if not v:
            raise ValueError(
                "user_state_snapshot cannot be empty. "
                "Build snapshot using build_user_state_snapshot() before inference."
            )
        required_keys = {"dominant_failure_modes", "improving_areas", "stagnant_areas"}
        missing = required_keys - set(v.keys())
        if missing:
            raise ValueError(f"user_state_snapshot missing required keys: {missing}")
        return v
    
    @validator("delta_features")
    def validate_delta_features(cls, v, values):
        verdict = values.get("verdict", "")
        # For failed submissions, delta features are critical
        if verdict.lower() not in ("accepted", "ac"):
            required_delta_keys = {
                "delta_attempts_same_category",
                "delta_root_cause_repeat_rate",
                "is_cold_start",
            }
            missing = required_delta_keys - set(v.keys())
            if missing:
                raise ValueError(f"delta_features missing required keys for failed submission: {missing}")
        return v
    
    @validator("verdict")
    def normalize_verdict(cls, v):
        return v.lower().strip()
    
    def is_accepted(self) -> bool:
        """Check if this is an accepted submission."""
        return self.verdict in ("accepted", "ac")
