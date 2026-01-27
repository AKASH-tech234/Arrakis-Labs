from pydantic import BaseModel
from typing import Optional, List


class FeedbackResponse(BaseModel):
    """
    v3.3: Enhanced feedback response with all UI-required fields.
    
    Includes:
    - Core feedback (explanation, hints)
    - MIM diagnosis (root_cause, subtype, failure_mechanism)
    - Complexity analysis
    - Correct code solution (for "show full explanation" section)
    """
    # Core feedback
    explanation: str
    improvement_hint: str
    detected_pattern: Optional[str] = None
    
    # v3.3: Enhanced fields for UI
    complexity_analysis: Optional[str] = None
    edge_cases: Optional[List[str]] = None
    optimization_tips: Optional[List[str]] = None
    
    # v3.3: MIM diagnosis details for UI display
    root_cause: Optional[str] = None
    root_cause_subtype: Optional[str] = None
    failure_mechanism: Optional[str] = None
    
    # v3.3: Correct code solution (shown in "full explanation" section)
    correct_code: Optional[str] = None
    correct_code_explanation: Optional[str] = None
    
    # v3.3: Concept-level learning signal
    concept_reinforcement: Optional[str] = None
