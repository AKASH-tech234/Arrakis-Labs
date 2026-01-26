from pydantic import BaseModel
from typing import List, Optional


class LearningRecommendation(BaseModel):
    """
    Learning recommendation schema.
    
    NOTE: All fields have sensible defaults to prevent crashes
    in reinforcement mode (Accepted submissions).
    """
    focus_areas: List[str] = []
    rationale: str = "Reinforcement signal - continue current trajectory."
    
    # Optional fields for richer recommendations
    skill_gap: Optional[str] = None
    exercises: Optional[List[str]] = None
    summary: Optional[str] = None
