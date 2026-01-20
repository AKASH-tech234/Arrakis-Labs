from pydantic import BaseModel
from typing import Optional


class DetectedPattern(BaseModel):
    pattern: Optional[str]
    confidence: float
