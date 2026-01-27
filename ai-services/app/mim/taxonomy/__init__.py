"""
MIM Taxonomy Module
===================

Strict, non-collapsible root cause and subtype definitions.

This module exports:
- ROOT_CAUSES: 4 coarse-grained categories (predicted by Model A)
- SUBTYPES: Fine-grained subtypes per root cause (predicted by Model B)
- ROOT_CAUSE_TO_SUBTYPES: Canonical constraint map (authoritative)
- derive_failure_mechanism(): Deterministic derivation (NOT predicted)

CRITICAL:
- ROOT_CAUSE and SUBTYPE are the ONLY model outputs
- FAILURE_MECHANISM is NEVER predicted by ML
- Some subtypes are valid for MULTIPLE root causes (intentional)
- validate_subtype() MUST be called after Model B inference
"""

from .root_causes import (
    ROOT_CAUSES,
    ROOT_CAUSE_DESCRIPTIONS,
    validate_root_cause,
    OLD_TO_NEW_ROOT_CAUSE,
)
from .subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    SUBTYPE_TO_ROOT_CAUSES,
    SUBTYPES,
    validate_subtype as validate_subtype_pair,
    get_valid_subtypes,
    get_valid_root_causes,
    is_valid_pair,
    SubtypeValidationError,
)
from .subtypes import (
    SUBTYPES_BY_ROOT_CAUSE,
    SUBTYPE_TO_ROOT_CAUSE,
    SUBTYPE_DESCRIPTIONS,
    validate_subtype,
    get_valid_subtypes_for_root_cause,
)
from .failure_mechanism_rules import (
    derive_failure_mechanism,
    FAILURE_MECHANISMS,
)

__all__ = [
    # Root causes
    "ROOT_CAUSES",
    "ROOT_CAUSE_DESCRIPTIONS",
    "validate_root_cause",
    "OLD_TO_NEW_ROOT_CAUSE",
    
    # Subtype masks (authoritative)
    "ROOT_CAUSE_TO_SUBTYPES",
    "SUBTYPE_TO_ROOT_CAUSES",
    "SUBTYPES",
    "validate_subtype_pair",
    "get_valid_subtypes",
    "get_valid_root_causes",
    "is_valid_pair",
    "SubtypeValidationError",
    
    # Legacy subtype aliases
    "SUBTYPES_BY_ROOT_CAUSE",
    "SUBTYPE_TO_ROOT_CAUSE",
    "SUBTYPE_DESCRIPTIONS",
    "validate_subtype",
    "get_valid_subtypes_for_root_cause",
    
    # Failure mechanisms
    "derive_failure_mechanism",
    "FAILURE_MECHANISMS",
]
