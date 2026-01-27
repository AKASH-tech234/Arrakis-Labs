from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SubmissionContext(BaseModel):
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: Optional[str] = None
    user_history_summary: Optional[str] = None
    problem: Optional[Dict[str, Any]] = None
    user_profile: Optional[Dict[str, Any]] = None
    test_case: Optional[Dict[str, Any]] = None
