"""
MIM Subtype Taxonomy
====================

Fine-grained subtypes, conditioned on ROOT_CAUSE.

Subtypes are PREDICTED by Model B (LightGBM), given ROOT_CAUSE.

CRITICAL DESIGN:
- Some subtypes appear under MULTIPLE root causes (intentional)
- This reflects real-world debugging: same bug type can have different causes
- Model B output is MASKED to only allow valid subtypes per root cause

See subtype_masks.py for the authoritative constraint map.
"""

from typing import Dict, Set, List, Literal, FrozenSet

# Import canonical definitions from subtype_masks
from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    SUBTYPE_TO_ROOT_CAUSES,
    SUBTYPES,
    validate_subtype as _validate_subtype_pair,
    get_valid_subtypes,
    get_valid_root_causes,
    is_valid_pair,
    SubtypeValidationError,
)


# ═══════════════════════════════════════════════════════════════════════════════
# TYPE ALIASES (for type hints)
# ═══════════════════════════════════════════════════════════════════════════════

SubtypeType = Literal[
    "wrong_invariant",
    "incorrect_boundary", 
    "partial_case_handling",
    "state_loss",
    "brute_force_under_constraints",
    "premature_optimization",
    "misread_constraint",
]


# ═══════════════════════════════════════════════════════════════════════════════
# LEGACY ALIASES (for backward compatibility)
# ═══════════════════════════════════════════════════════════════════════════════

# Old name → new name
SUBTYPES_BY_ROOT_CAUSE = ROOT_CAUSE_TO_SUBTYPES

# Inverse mapping: for subtypes with MULTIPLE valid roots, returns the PRIMARY one
# Use SUBTYPE_TO_ROOT_CAUSES for the full set of valid roots
SUBTYPE_TO_ROOT_CAUSE: Dict[str, str] = {
    # Primary assignments (when subtype has multiple valid roots)
    "wrong_invariant": "correctness",  # also: understanding_gap
    "incorrect_boundary": "correctness",  # also: implementation
    "partial_case_handling": "correctness",  # also: implementation
    "state_loss": "implementation",  # also: correctness
    "brute_force_under_constraints": "efficiency",
    "premature_optimization": "efficiency",
    "misread_constraint": "understanding_gap",
}


# ═══════════════════════════════════════════════════════════════════════════════
# SUBTYPE DESCRIPTIONS (for feedback generation)
# ═══════════════════════════════════════════════════════════════════════════════

SUBTYPE_DESCRIPTIONS: Dict[str, Dict[str, str]] = {
    "wrong_invariant": {
        "name": "Wrong Invariant",
        "description": "Loop or recursion invariant does not hold",
        "example": "Prefix sum not correctly maintained across iterations",
        "fix_direction": "Trace invariant manually on small input",
    },
    "incorrect_boundary": {
        "name": "Incorrect Boundary",
        "description": "Start/end conditions are wrong",
        "example": "Binary search terminates one step early",
        "fix_direction": "Check boundary conditions with examples: 0, 1, n-1, n",
    },
    "partial_case_handling": {
        "name": "Partial Case Handling",
        "description": "Some valid input cases are not handled",
        "example": "Empty array, single element, all duplicates not covered",
        "fix_direction": "Enumerate edge cases systematically before coding",
    },
    "state_loss": {
        "name": "State Loss",
        "description": "Critical state not preserved across calls/iterations",
        "example": "Visited set reset inside loop instead of outside",
        "fix_direction": "Track state lifetime explicitly",
    },
    "brute_force_under_constraints": {
        "name": "Brute Force Under Constraints",
        "description": "Solution complexity exceeds what constraints allow",
        "example": "O(n²) solution for n=10^5 (needs O(n log n))",
        "fix_direction": "Calculate required complexity from constraints first",
    },
    "premature_optimization": {
        "name": "Premature Optimization",
        "description": "Optimized code that doesn't solve the problem correctly",
        "example": "Clever bit manipulation that misses edge cases",
        "fix_direction": "Get correct solution first, then optimize",
    },
    "misread_constraint": {
        "name": "Misread Constraint",
        "description": "Constraint value or meaning was misunderstood",
        "example": "Assumed n ≤ 1000 when n ≤ 10^6",
        "fix_direction": "Re-read constraints before coding, annotate in code",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def validate_subtype(subtype: str, root_cause: str = None) -> bool:
    """
    Validate that a subtype is valid (and optionally valid for given root cause).
    
    Parameters
    ----------
    subtype : str
        The subtype to validate
    root_cause : str, optional
        If provided, also validates that subtype is valid for this root cause
        
    Returns
    -------
    bool
        True if valid
        
    Raises
    ------
    ValueError
        If subtype is invalid or not valid for root_cause
        
    IMPORTANT:
    - Some subtypes are valid for MULTIPLE root causes
    - Use is_valid_pair() to check if (root_cause, subtype) is valid
    """
    if subtype not in SUBTYPES:
        raise ValueError(
            f"Invalid subtype: '{subtype}'. "
            f"Must be one of: {sorted(SUBTYPES)}"
        )
    
    if root_cause is not None:
        # Use the canonical validation from subtype_masks
        _validate_subtype_pair(root_cause, subtype)
    
    return True


def get_valid_subtypes_for_root_cause(root_cause: str) -> List[str]:
    """
    Get all valid subtypes for a given root cause.
    
    Parameters
    ----------
    root_cause : str
        One of the 4 ROOT_CAUSES
        
    Returns
    -------
    List[str]
        Sorted list of valid subtypes
    """
    return sorted(get_valid_subtypes(root_cause))


# ═══════════════════════════════════════════════════════════════════════════════
# EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    # Canonical types
    "SUBTYPES",
    "ROOT_CAUSE_TO_SUBTYPES",
    "SUBTYPE_TO_ROOT_CAUSES",
    "SubtypeType",
    "SubtypeValidationError",
    
    # Legacy aliases
    "SUBTYPES_BY_ROOT_CAUSE",
    "SUBTYPE_TO_ROOT_CAUSE",
    
    # Descriptions
    "SUBTYPE_DESCRIPTIONS",
    
    # Validation functions
    "validate_subtype",
    "get_valid_subtypes_for_root_cause",
    "get_valid_subtypes",
    "get_valid_root_causes",
    "is_valid_pair",
]
