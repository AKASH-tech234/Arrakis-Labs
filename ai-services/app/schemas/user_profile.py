"""
User Profile Schema
===================

Structured user profile derived from RAG memory chunks.
Agents consume this structured profile, NOT raw memory text.

v3.2: Added MIM decision integration and update tracking
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class UserProfile(BaseModel):
    """
    Structured user profile for agent consumption.
    
    This is derived from raw RAG memory chunks and provides:
    - Aggregated mistake patterns
    - Weak topics identification
    - Learning history summary
    - Current MIM decision (v3.2)
    
    Agents should NEVER see raw memory text directly.
    """
    user_id: str
    
    # Derived from memory chunks
    common_mistakes: List[str]  # Recurring mistake patterns
    weak_topics: List[str]  # Topics where user struggles
    recurring_patterns: List[str]  # Abstract patterns (e.g., "off-by-one errors")
    
    # Statistics (if available)
    total_submissions: Optional[int] = None
    success_rate: Optional[float] = None
    
    # Recent context
    recent_categories: List[str] = []  # Last N categories attempted
    last_verdict: Optional[str] = None
    
    # v3.2: Current MIM Decision (Single Immutable Decision)
    current_mim_root_cause: Optional[str] = Field(
        default=None,
        description="Current MIM-diagnosed root cause for this submission"
    )
    current_mim_confidence: Optional[float] = Field(
        default=None,
        description="MIM confidence in root cause diagnosis"
    )
    mim_decision_id: Optional[str] = Field(
        default=None,
        description="Unique ID to enforce single immutable MIM decision per submission"
    )
    
    # v3.2: Profile-MIM Agreement Tracking
    profile_mim_agreement: Optional[bool] = Field(
        default=None,
        description="True if profile history agrees with MIM diagnosis"
    )
    profile_mim_disagreement_reason: Optional[str] = Field(
        default=None,
        description="Reason for disagreement if profile and MIM don't align"
    )
    
    # v3.2: Update Tracking Metric
    profile_updated_after_submission: bool = Field(
        default=False,
        description="True if profile was updated after this submission"
    )
    last_profile_update: Optional[datetime] = Field(
        default=None,
        description="Timestamp of last profile update"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "common_mistakes": [
                    "Forgets to handle empty arrays",
                    "Off-by-one errors in binary search"
                ],
                "weak_topics": ["Dynamic Programming", "Graph Traversal"],
                "recurring_patterns": ["boundary condition handling", "edge case coverage"],
                "total_submissions": 45,
                "success_rate": 0.67,
                "recent_categories": ["Array", "Binary Search", "DP"],
                "last_verdict": "Wrong Answer",
                "current_mim_root_cause": "boundary_condition_blindness",
                "current_mim_confidence": 0.85,
                "mim_decision_id": "mim_abc123",
                "profile_mim_agreement": True,
                "profile_updated_after_submission": True
            }
        }
