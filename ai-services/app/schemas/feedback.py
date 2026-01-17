from pydantic import BaseModel
from typing import Optional


class FeedbackResponse(BaseModel):
    explanation: str
    improvement_hint: str
    detected_pattern: Optional[str] = None
