from pydantic import BaseModel
from typing import List, Optional


class WeeklyProgressReport(BaseModel):
    summary: str
    strengths: List[str]
    improvement_areas: List[str]
    recurring_patterns: Optional[List[str]] = None
