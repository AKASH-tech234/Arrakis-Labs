from pydantic import BaseModel
from typing import List


class LearningRecommendation(BaseModel):
    focus_areas: List[str]
    rationale: str
