"""
MIM Schemas Module
==================

STRICT schemas for MIM inputs/outputs.

CRITICAL DESIGN:
- NO OPTIONAL FIELDS (all fields required)
- NO SCHEMA REUSE across paths (correctness ≠ performance ≠ reinforcement)
- VALIDATION ON CONSTRUCTION (reject nulls, reject missing)
- FAIL-FAST (no silent degradation)

Three SEPARATE feedback schemas:
1. CorrectnessFeedback - for correctness root cause
2. PerformanceFeedback - for efficiency root cause  
3. ReinforcementFeedback - for ACCEPTED submissions ONLY
"""

from .correctness_feedback import CorrectnessFeedback
from .performance_feedback import PerformanceFeedback
from .reinforcement_feedback import ReinforcementFeedback
from .mim_input import MIMInput
from .mim_output import MIMOutput

__all__ = [
    "CorrectnessFeedback",
    "PerformanceFeedback",
    "ReinforcementFeedback",
    "MIMInput",
    "MIMOutput",
]
