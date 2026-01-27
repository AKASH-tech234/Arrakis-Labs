"""
MIM V3.0 Canonical Dataset Schemas
==================================

PHASE 2: Dataset Reconstruction

Pydantic schemas for fail-fast validation of training datasets.
These are AUTHORITATIVE - any row that fails validation is REJECTED.

Two Canonical Datasets:
1. mim_failure_transitions.parquet - FAILED submissions only
2. mim_reinforcement_events.parquet - ACCEPTED submissions only

NO CROSS-CONTAMINATION. NO OPTIONAL FIELDS.
"""

from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Any
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# DATASET A: FAILURE TRANSITIONS (FAILED SUBMISSIONS ONLY)
# ═══════════════════════════════════════════════════════════════════════════════

class FailureTransitionRow(BaseModel):
    """
    Schema for mim_failure_transitions.parquet.
    
    One row = one FAILED state transition.
    
    MANDATORY COLUMNS:
    - user_id
    - timestamp
    - root_cause (label)
    - subtype (label)
    - delta_* features
    - is_cold_start
    
    ❌ NO accepted submissions
    ❌ NO absolute counts
    """
    
    class Config:
        extra = "forbid"  # Reject unknown fields
    
    # ─────────────────────────────────────────────────────────────────────────
    # IDENTIFIERS (required)
    # ─────────────────────────────────────────────────────────────────────────
    
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
    timestamp: str = Field(
        ...,
        min_length=1,
        description="ISO8601 timestamp"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # LABELS (Model outputs - required)
    # ─────────────────────────────────────────────────────────────────────────
    
    root_cause: str = Field(
        ...,
        description="One of: correctness, efficiency, implementation, understanding_gap"
    )
    subtype: str = Field(
        ...,
        description="Valid subtype for the root_cause"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # DELTA FEATURES (Model inputs - required, NO absolute counts)
    # ─────────────────────────────────────────────────────────────────────────
    
    delta_attempts_same_category: float = Field(
        ...,
        description="Change in attempts for same category"
    )
    delta_root_cause_repeat_rate: float = Field(
        ...,
        description="Change in root cause repetition"
    )
    delta_complexity_mismatch: float = Field(
        ...,
        description="Change in complexity mismatch rate"
    )
    delta_time_to_accept: float = Field(
        ...,
        description="Change in time to acceptance"
    )
    delta_optimization_transition: float = Field(
        ...,
        description="Transition signal (brute->optimized)"
    )
    is_cold_start: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="1.0 if cold start, 0.0 otherwise"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # USER STATE CONTEXT (required for personalization)
    # ─────────────────────────────────────────────────────────────────────────
    
    dominant_failure_modes: List[str] = Field(
        ...,
        description="User's dominant failure modes at time of submission"
    )
    stagnant_areas: List[str] = Field(
        ...,
        description="Categories with no improvement"
    )
    improving_areas: List[str] = Field(
        ...,
        description="Categories with improvement"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # PROBLEM CONTEXT (required)
    # ─────────────────────────────────────────────────────────────────────────
    
    category: str = Field(
        ...,
        description="Problem category"
    )
    difficulty: str = Field(
        ...,
        description="Problem difficulty"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # METADATA
    # ─────────────────────────────────────────────────────────────────────────
    
    split: str = Field(
        ...,
        description="train, val, or test"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # VALIDATORS
    # ─────────────────────────────────────────────────────────────────────────
    
    @model_validator(mode="after")
    def validate_root_cause(self):
        """Validate root_cause is one of the 4 canonical values."""
        valid_root_causes = {"correctness", "efficiency", "implementation", "understanding_gap"}
        if self.root_cause not in valid_root_causes:
            raise ValueError(
                f"Invalid root_cause '{self.root_cause}'. "
                f"Must be one of: {sorted(valid_root_causes)}"
            )
        return self
    
    @model_validator(mode="after")
    def validate_taxonomy(self):
        """Validate (root_cause, subtype) pair is valid."""
        from app.mim.taxonomy.subtype_masks import is_valid_pair
        
        if not is_valid_pair(self.root_cause, self.subtype):
            raise ValueError(
                f"Invalid taxonomy: subtype '{self.subtype}' not valid for "
                f"root_cause '{self.root_cause}'"
            )
        return self
    
    @model_validator(mode="after")
    def validate_split(self):
        """Validate split is valid."""
        valid_splits = {"train", "val", "test"}
        if self.split not in valid_splits:
            raise ValueError(
                f"Invalid split '{self.split}'. "
                f"Must be one of: {sorted(valid_splits)}"
            )
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# DATASET B: REINFORCEMENT EVENTS (ACCEPTED SUBMISSIONS ONLY)
# ═══════════════════════════════════════════════════════════════════════════════

class ReinforcementEventRow(BaseModel):
    """
    Schema for mim_reinforcement_events.parquet.
    
    One row = one ACCEPTED event.
    
    MANDATORY COLUMNS:
    - user_id
    - timestamp
    - category
    - technique
    - difficulty
    - confidence_boost
    - strength_signal
    
    ❌ NO root_cause
    ❌ NO subtype
    """
    
    class Config:
        extra = "forbid"  # Reject unknown fields
    
    # ─────────────────────────────────────────────────────────────────────────
    # IDENTIFIERS (required)
    # ─────────────────────────────────────────────────────────────────────────
    
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
    timestamp: str = Field(
        ...,
        min_length=1,
        description="ISO8601 timestamp"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # REINFORCEMENT SIGNALS (required)
    # ─────────────────────────────────────────────────────────────────────────
    
    category: str = Field(
        ...,
        description="Problem category"
    )
    technique: str = Field(
        ...,
        description="Technique used (e.g., two_pointers, binary_search)"
    )
    difficulty: str = Field(
        ...,
        description="Problem difficulty"
    )
    confidence_boost: float = Field(
        ...,
        ge=-1.0,
        le=1.0,
        description="Confidence change signal"
    )
    strength_signal: str = Field(
        ...,
        description="Human-readable strength description"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # PERFORMANCE METRICS (required)
    # ─────────────────────────────────────────────────────────────────────────
    
    time_to_solve_seconds: float = Field(
        ...,
        ge=0.0,
        description="Time to solve in seconds"
    )
    attempt_count: int = Field(
        ...,
        ge=1,
        description="Number of attempts before acceptance"
    )
    was_optimal: bool = Field(
        ...,
        description="Whether solution was optimal"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # METADATA
    # ─────────────────────────────────────────────────────────────────────────
    
    split: str = Field(
        ...,
        description="train, val, or test"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # VALIDATORS
    # ─────────────────────────────────────────────────────────────────────────
    
    @model_validator(mode="after")
    def validate_no_mistake_fields(self):
        """Ensure no mistake-related fields are present."""
        # These fields should NEVER appear in reinforcement data
        forbidden = {"root_cause", "subtype", "failure_mechanism"}
        for field in forbidden:
            if hasattr(self, field):
                raise ValueError(
                    f"FORBIDDEN: '{field}' found in reinforcement event. "
                    f"Reinforcement events MUST NOT have mistake-related fields."
                )
        return self
    
    @model_validator(mode="after")
    def validate_split(self):
        """Validate split is valid."""
        valid_splits = {"train", "val", "test"}
        if self.split not in valid_splits:
            raise ValueError(
                f"Invalid split '{self.split}'. "
                f"Must be one of: {sorted(valid_splits)}"
            )
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# DATASET VALIDATORS
# ═══════════════════════════════════════════════════════════════════════════════

def validate_failure_transitions_dataframe(df) -> Dict[str, Any]:
    """
    Validate entire failure transitions DataFrame.
    
    Returns
    -------
    Dict with:
        - valid: bool
        - total_rows: int
        - valid_rows: int
        - invalid_rows: int
        - errors: List[Dict] (first 100 errors)
    """
    errors = []
    valid_count = 0
    
    for idx, row in df.iterrows():
        try:
            FailureTransitionRow(**row.to_dict())
            valid_count += 1
        except Exception as e:
            errors.append({
                "row_index": idx,
                "error": str(e),
            })
            if len(errors) >= 100:
                break
    
    return {
        "valid": len(errors) == 0,
        "total_rows": len(df),
        "valid_rows": valid_count,
        "invalid_rows": len(errors),
        "errors": errors,
    }


def validate_reinforcement_events_dataframe(df) -> Dict[str, Any]:
    """
    Validate entire reinforcement events DataFrame.
    
    Returns
    -------
    Dict with:
        - valid: bool
        - total_rows: int
        - valid_rows: int
        - invalid_rows: int
        - errors: List[Dict] (first 100 errors)
    """
    errors = []
    valid_count = 0
    
    for idx, row in df.iterrows():
        try:
            ReinforcementEventRow(**row.to_dict())
            valid_count += 1
        except Exception as e:
            errors.append({
                "row_index": idx,
                "error": str(e),
            })
            if len(errors) >= 100:
                break
    
    return {
        "valid": len(errors) == 0,
        "total_rows": len(df),
        "valid_rows": valid_count,
        "invalid_rows": len(errors),
        "errors": errors,
    }


def validate_no_cross_contamination(
    failure_df,
    reinforcement_df,
) -> Dict[str, Any]:
    """
    Validate no row appears in both datasets.
    
    Check based on submission_id.
    """
    failure_ids = set(failure_df["submission_id"].unique())
    reinforcement_ids = set(reinforcement_df["submission_id"].unique())
    
    overlap = failure_ids & reinforcement_ids
    
    return {
        "valid": len(overlap) == 0,
        "failure_count": len(failure_ids),
        "reinforcement_count": len(reinforcement_ids),
        "overlap_count": len(overlap),
        "overlapping_ids": list(overlap)[:20],  # First 20
    }
