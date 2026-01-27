"""
MIM Subtype Masks
=================

Authoritative constraint map: ROOT_CAUSE → valid SUBTYPES.

CRITICAL:
- This is NOT documentation — this is a runtime constraint
- Any prediction outside these masks is a BUG and MUST raise
- Some subtypes appear under multiple roots (intentional)

Used for:
- Masking Model B outputs during inference
- Validating training labels
- Runtime assertion checks
"""

from typing import Dict, Set, FrozenSet


# ═══════════════════════════════════════════════════════════════════════════════
# CANONICAL ROOT CAUSES (5 categories - V3.1 taxonomy)
# ═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSES: FrozenSet[str] = frozenset({
    "correctness",
    "efficiency",
    "implementation",
    "understanding_gap",
    "problem_misinterpretation",  # V3.1: NEW - code doesn't match problem schema
})


# ═══════════════════════════════════════════════════════════════════════════════
# CANONICAL ROOT_CAUSE → SUBTYPE MAP (AUTHORITATIVE)
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSE_TO_SUBTYPES: Dict[str, FrozenSet[str]] = {
    "correctness": frozenset({
        "wrong_invariant",
        "incorrect_boundary",
        "partial_case_handling",
        "state_loss",
    }),

    "efficiency": frozenset({
        "brute_force_under_constraints",
        "premature_optimization",
    }),

    "implementation": frozenset({
        "incorrect_boundary",
        "state_loss",
        "partial_case_handling",
    }),

    "understanding_gap": frozenset({
        "misread_constraint",
        "wrong_invariant",
    }),
    
    # V3.1: NEW - Problem misinterpretation (code doesn't match problem)
    "problem_misinterpretation": frozenset({
        "wrong_input_format",      # Code expects different input structure
        "wrong_problem_entirely",  # Solving a completely different problem
        "misread_constraints",     # Constraints misunderstood (different from misread_constraint)
    }),
}

# Why some subtypes appear under multiple roots:
# - incorrect_boundary: can be logic error (correctness) or coding bug (implementation)
# - state_loss: can be conceptual (correctness) or mechanical (implementation)
# - partial_case_handling: can be logical oversight or coding omission
# - wrong_invariant: can be logical error or conceptual misunderstanding
# This overlap is INTENTIONAL and reflects real debugging scenarios.


# ═══════════════════════════════════════════════════════════════════════════════
# REVERSE MASK (for validation)
# ═══════════════════════════════════════════════════════════════════════════════

# Build reverse mapping: subtype → set of valid root causes
SUBTYPE_TO_ROOT_CAUSES: Dict[str, FrozenSet[str]] = {}

_all_subtypes: Set[str] = set()
for root, subtypes in ROOT_CAUSE_TO_SUBTYPES.items():
    _all_subtypes.update(subtypes)

for subtype in _all_subtypes:
    valid_roots = frozenset(
        root
        for root, subtypes in ROOT_CAUSE_TO_SUBTYPES.items()
        if subtype in subtypes
    )
    SUBTYPE_TO_ROOT_CAUSES[subtype] = valid_roots


# ═══════════════════════════════════════════════════════════════════════════════
# CANONICAL SUBTYPES LIST
# ═══════════════════════════════════════════════════════════════════════════════

SUBTYPES: FrozenSet[str] = frozenset(_all_subtypes)

# For reference:
# {
#     "wrong_invariant",        # correctness, understanding_gap
#     "incorrect_boundary",     # correctness, implementation
#     "partial_case_handling",  # correctness, implementation
#     "state_loss",             # correctness, implementation
#     "brute_force_under_constraints",  # efficiency only
#     "premature_optimization",         # efficiency only
#     "misread_constraint",             # understanding_gap only
# }


# ═══════════════════════════════════════════════════════════════════════════════
# HARD RUNTIME GUARD (MANDATORY)
# ═══════════════════════════════════════════════════════════════════════════════

class SubtypeValidationError(ValueError):
    """Raised when subtype validation fails."""
    pass


def validate_subtype(root_cause: str, subtype: str) -> None:
    """
    Validate that subtype is valid for given root_cause.
    
    Parameters
    ----------
    root_cause : str
        One of the 4 ROOT_CAUSES
    subtype : str
        Predicted subtype
        
    Raises
    ------
    SubtypeValidationError
        If root_cause is unknown or subtype is invalid for root_cause
        
    MUST be called:
    - After Model B inference
    - During dataset construction
    - During training validation
    """
    allowed = ROOT_CAUSE_TO_SUBTYPES.get(root_cause)
    
    if allowed is None:
        raise SubtypeValidationError(
            f"Unknown root_cause: '{root_cause}'. "
            f"Valid values: {list(ROOT_CAUSE_TO_SUBTYPES.keys())}"
        )
    
    if subtype not in allowed:
        raise SubtypeValidationError(
            f"Invalid subtype '{subtype}' for root_cause '{root_cause}'. "
            f"Allowed subtypes: {sorted(allowed)}"
        )


def get_valid_subtypes(root_cause: str) -> FrozenSet[str]:
    """
    Get valid subtypes for a root cause.
    
    Parameters
    ----------
    root_cause : str
        One of the 4 ROOT_CAUSES
        
    Returns
    -------
    FrozenSet[str]
        Valid subtypes for this root cause
        
    Raises
    ------
    ValueError
        If root_cause is unknown
    """
    if root_cause not in ROOT_CAUSE_TO_SUBTYPES:
        raise ValueError(
            f"Unknown root_cause: '{root_cause}'. "
            f"Valid values: {list(ROOT_CAUSE_TO_SUBTYPES.keys())}"
        )
    return ROOT_CAUSE_TO_SUBTYPES[root_cause]


def get_valid_root_causes(subtype: str) -> FrozenSet[str]:
    """
    Get valid root causes for a subtype.
    
    Parameters
    ----------
    subtype : str
        A valid subtype
        
    Returns
    -------
    FrozenSet[str]
        Valid root causes for this subtype
        
    Raises
    ------
    ValueError
        If subtype is unknown
    """
    if subtype not in SUBTYPE_TO_ROOT_CAUSES:
        raise ValueError(
            f"Unknown subtype: '{subtype}'. "
            f"Valid values: {sorted(SUBTYPES)}"
        )
    return SUBTYPE_TO_ROOT_CAUSES[subtype]


def is_valid_pair(root_cause: str, subtype: str) -> bool:
    """
    Check if (root_cause, subtype) pair is valid.
    
    Returns
    -------
    bool
        True if valid, False otherwise
    """
    allowed = ROOT_CAUSE_TO_SUBTYPES.get(root_cause)
    if allowed is None:
        return False
    return subtype in allowed
