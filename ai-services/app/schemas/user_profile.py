"""
User Profile Schema
===================

Structured user profile derived from RAG memory chunks.
Agents consume this structured profile, NOT raw memory text.
"""

from typing import List, Optional
from pydantic import BaseModel


class UserProfile(BaseModel):
    """
    Structured user profile for agent consumption.
    
    This is derived from raw RAG memory chunks and provides:
    - Aggregated mistake patterns
    - Weak topics identification
    - Learning history summary
    
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
                "last_verdict": "Wrong Answer"
            }
        }
