from pydantic import BaseModel
from typing import List, Optional

class SubmissionContext(BaseModel):
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: Optional[str]
    user_history_summary: Optional[str]
