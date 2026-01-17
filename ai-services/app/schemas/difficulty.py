from pydantic import BaseModel
from typing import Literal


class DifficultyAdjustment(BaseModel):
    action: Literal["increase", "maintain", "decrease"]
    rationale: str
