"""
MIM Inference Module
====================

Core inference components for the new MIM architecture.

CRITICAL DESIGN:
- State snapshot MUST be injected
- Failed vs Accepted are COMPLETELY SEPARATE paths
- No generic feedback allowed
"""

from .mim_decision_node import (
    MIMDecisionNode,
    run_mim_inference,
)
from .feedback_generator import (
    generate_correctness_feedback,
    generate_performance_feedback,
    generate_reinforcement_feedback,
)

__all__ = [
    "MIMDecisionNode",
    "run_mim_inference",
    "generate_correctness_feedback",
    "generate_performance_feedback",
    "generate_reinforcement_feedback",
]
