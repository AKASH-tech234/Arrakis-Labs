"""
MIM Root Cause Taxonomy
=======================

STRICT 4-category root cause classification.

These are the ONLY valid root causes. No "algorithm_choice" collapse.
No "unknown" escape hatch.

Root causes are PREDICTED by Model A (LightGBM).
"""

from typing import Literal, Set


# ═══════════════════════════════════════════════════════════════════════════════
# ROOT CAUSE ENUM (STRICT)
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSES: Set[str] = {
    "correctness",
    "efficiency", 
    "implementation",
    "understanding_gap",
}

RootCauseType = Literal[
    "correctness",
    "efficiency",
    "implementation",
    "understanding_gap",
]


# ═══════════════════════════════════════════════════════════════════════════════
# DESCRIPTIONS (for feedback generation)
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSE_DESCRIPTIONS = {
    "correctness": {
        "name": "Correctness Error",
        "description": "The algorithm logic produces wrong outputs for some inputs.",
        "manifestation": "Wrong Answer (WA) verdicts",
        "learning_focus": "Invariant maintenance, boundary conditions, state tracking",
    },
    "efficiency": {
        "name": "Efficiency Problem", 
        "description": "The solution is too slow or uses too much memory for constraints.",
        "manifestation": "Time Limit Exceeded (TLE) or Memory Limit Exceeded (MLE)",
        "learning_focus": "Complexity analysis, optimal algorithm selection, space-time tradeoffs",
    },
    "implementation": {
        "name": "Implementation Issue",
        "description": "The approach is correct but code has bugs or edge case gaps.",
        "manifestation": "Runtime errors, partial test case failures",
        "learning_focus": "Code hygiene, defensive programming, systematic testing",
    },
    "understanding_gap": {
        "name": "Understanding Gap",
        "description": "The problem requirements or constraints were misunderstood.",
        "manifestation": "Solution solves a different problem, ignores constraints",
        "learning_focus": "Problem decomposition, constraint analysis, requirement extraction",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def validate_root_cause(root_cause: str) -> bool:
    """
    Validate that a root cause is in the allowed set.
    
    Raises ValueError if invalid (fail-fast, no silent degradation).
    """
    if root_cause not in ROOT_CAUSES:
        raise ValueError(
            f"Invalid root_cause: '{root_cause}'. "
            f"Must be one of: {sorted(ROOT_CAUSES)}"
        )
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# MIGRATION MAPPING (from old 15-category system)
# ═══════════════════════════════════════════════════════════════════════════════

OLD_TO_NEW_ROOT_CAUSE = {
    # Correctness
    "logic_error": "correctness",
    "off_by_one_error": "correctness",
    "comparison_error": "correctness",
    "boundary_condition_blindness": "correctness",
    
    # Efficiency  
    "time_complexity_issue": "efficiency",
    "wrong_data_structure": "efficiency",
    "algorithm_choice": "efficiency",  # The collapse category - maps to efficiency
    
    # Implementation
    "recursion_issue": "implementation",
    "integer_overflow": "implementation",
    "type_error": "implementation",
    "edge_case_handling": "implementation",
    "partial_solution": "implementation",
    
    # Understanding gap
    "misread_problem": "understanding_gap",
    "input_parsing": "understanding_gap",
    
    # Fallback
    "unknown": "implementation",  # Force categorization
}


def migrate_old_root_cause(old_root_cause: str) -> str:
    """
    Convert old 15-category root cause to new 4-category system.
    
    Used for data migration only. New training should not use this.
    """
    return OLD_TO_NEW_ROOT_CAUSE.get(old_root_cause, "implementation")
