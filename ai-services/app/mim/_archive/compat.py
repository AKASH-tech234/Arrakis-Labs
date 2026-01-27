"""
MIM V2 Compatibility Layer
==========================

Provides backward-compatible imports from old schemas to new schemas_v2.

DEPRECATION WARNING:
The old 15-category ROOT_CAUSE system is deprecated.
New code should use:
- app.mim.taxonomy.root_causes for ROOT_CAUSES (4 categories)
- app.mim.taxonomy.subtypes for SUBTYPES (16 fine-grained types)
- app.mim.schemas_v2 for new Pydantic schemas

Migration Guide:
1. Replace ROOT_CAUSE_CATEGORIES with ROOT_CAUSES
2. Map old categories using OLD_TO_NEW_ROOT_CAUSE
3. Use schemas_v2.CorrectnessFeedback for failed submissions
4. Use schemas_v2.ReinforcementFeedback for accepted submissions
"""

import warnings
from typing import Dict

# New taxonomy
from app.mim.taxonomy.root_causes import ROOT_CAUSES, OLD_TO_NEW_ROOT_CAUSE
from app.mim.taxonomy.subtypes import SUBTYPES, SUBTYPE_TO_ROOT_CAUSE

# New schemas
from app.mim.schemas_v2.mim_input import MIMInput
from app.mim.schemas_v2.mim_output import MIMOutput
from app.mim.schemas_v2.correctness_feedback import CorrectnessFeedback
from app.mim.schemas_v2.performance_feedback import PerformanceFeedback
from app.mim.schemas_v2.reinforcement_feedback import ReinforcementFeedback

# For backward compatibility, re-export old schemas with deprecation warnings
def _get_deprecated_root_cause_categories():
    """Return old ROOT_CAUSE_CATEGORIES with deprecation warning."""
    warnings.warn(
        "ROOT_CAUSE_CATEGORIES is deprecated. Use ROOT_CAUSES from "
        "app.mim.taxonomy.root_causes instead (4 categories).",
        DeprecationWarning,
        stacklevel=2,
    )
    return [
        "boundary_condition_blindness",
        "off_by_one_error",
        "integer_overflow",
        "wrong_data_structure",
        "logic_error",
        "time_complexity_issue",
        "recursion_issue",
        "comparison_error",
        "algorithm_choice",
        "edge_case_handling",
        "input_parsing",
        "misread_problem",
        "partial_solution",
        "type_error",
        "unknown",
    ]


def migrate_old_root_cause(old_category: str) -> str:
    """
    Migrate old root cause category to new 4-category system.
    
    Parameters
    ----------
    old_category : str
        Old root cause category (15 categories)
        
    Returns
    -------
    str
        New root cause category (4 categories)
        
    Example
    -------
    >>> migrate_old_root_cause("off_by_one_error")
    'correctness'
    >>> migrate_old_root_cause("time_complexity_issue")
    'efficiency'
    """
    return OLD_TO_NEW_ROOT_CAUSE.get(old_category, "correctness")


def migrate_old_prediction(old_prediction: Dict) -> Dict:
    """
    Migrate old MIM prediction format to new format.
    
    Parameters
    ----------
    old_prediction : dict
        Old prediction with root_cause, readiness, etc.
        
    Returns
    -------
    dict
        New prediction format compatible with schemas_v2
    """
    warnings.warn(
        "migrate_old_prediction is a temporary compatibility function. "
        "Update your code to use the new MIMDecisionNode for inference.",
        DeprecationWarning,
        stacklevel=2,
    )
    
    old_root_cause = old_prediction.get("root_cause", {}).get("failure_cause", "unknown")
    new_root_cause = migrate_old_root_cause(old_root_cause)
    
    return {
        "root_cause": new_root_cause,
        "subtype": _infer_subtype_from_old(old_root_cause),
        "confidence": old_prediction.get("root_cause", {}).get("confidence", 0.5),
        "readiness": old_prediction.get("readiness", {}),
    }


def _infer_subtype_from_old(old_category: str) -> str:
    """Infer subtype from old category (best effort)."""
    
    OLD_TO_SUBTYPE = {
        "off_by_one_error": "off_by_one",
        "boundary_condition_blindness": "edge_case_miss",
        "integer_overflow": "overflow",
        "wrong_data_structure": "suboptimal_data_structure",
        "logic_error": "wrong_invariant",
        "time_complexity_issue": "brute_force_when_optimal_exists",
        "recursion_issue": "stack_overflow",
        "comparison_error": "wrong_comparator",
        "algorithm_choice": "missed_technique",
        "edge_case_handling": "edge_case_miss",
        "input_parsing": "input_format_error",
        "misread_problem": "wrong_invariant",
        "partial_solution": "incomplete_logic",
        "type_error": "type_conversion_bug",
        "unknown": "wrong_invariant",
    }
    
    return OLD_TO_SUBTYPE.get(old_category, "wrong_invariant")


# ═══════════════════════════════════════════════════════════════════════════════
# EXPORT FOR BACKWARD COMPATIBILITY
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    # New (recommended)
    "ROOT_CAUSES",
    "SUBTYPES",
    "SUBTYPE_TO_ROOT_CAUSE",
    "MIMInput",
    "MIMOutput",
    "CorrectnessFeedback",
    "PerformanceFeedback",
    "ReinforcementFeedback",
    
    # Migration helpers
    "migrate_old_root_cause",
    "migrate_old_prediction",
    "OLD_TO_NEW_ROOT_CAUSE",
]
