"""
MIM Failure Mechanism Rules
===========================

DETERMINISTIC derivation of failure_mechanism.

CRITICAL:
- This is NOT an ML model
- This is a PURE FUNCTION
- No randomness, no LLM calls
- Every subtype MUST resolve to a concrete mechanism
- NEVER returns "unknown" or "generic"

Rule precedence:
1. Subtype + specific signal → most specific mechanism
2. Subtype + category → category-aware mechanism  
3. Subtype → default mechanism (fallback)
"""

from typing import Dict, Any, Set


# ═══════════════════════════════════════════════════════════════════════════════
# FAILURE MECHANISM ENUM
# ═══════════════════════════════════════════════════════════════════════════════

FAILURE_MECHANISMS: Set[str] = {
    # From wrong_invariant
    "off_by_one",
    "invariant_drift",
    "pointer_desync",
    "array_invariant_violation",
    
    # From incorrect_boundary
    "boundary_miss",
    "window_overflow", 
    "boundary_condition_error",
    "search_bounds_error",
    
    # From brute_force_under_constraints
    "exponential_path_explosion",
    "state_space_blowup",
    "quadratic_scan",
    "complexity_explosion",
    
    # From state_loss
    "missing_state_dimension",
    "visited_state_reset",
    "state_not_preserved",
    "memoization_miss",
    
    # From premature_optimization
    "optimized_wrong_logic",
    
    # From misread_constraint
    "constraint_blindness",
    "constraint_misinterpretation",
    
    # From partial_case_handling
    "edge_case_omission",
    "null_handling_miss",
    "empty_input_crash",
    
    # From comparison_logic_error
    "operator_confusion",
    "equality_vs_inequality",
    
    # From suboptimal_data_structure
    "linear_where_hash_needed",
    "wrong_container_choice",
    
    # From redundant_computation
    "repeated_subproblem",
    "no_memoization",
    
    # From off_by_one
    "index_off_by_one",
    "loop_bounds_error",
    "fence_post_error",
    
    # From type_coercion_bug
    "integer_division_truncation",
    "implicit_cast_error",
    
    # From overflow_underflow
    "integer_overflow",
    "multiplication_overflow",
    
    # From understanding gap subtypes
    "wrong_output_format",
    "missed_special_case_requirement",
    "inverted_problem_logic",
    
    # Ultimate fallback
    "logic_misalignment",
}


# ═══════════════════════════════════════════════════════════════════════════════
# DEFAULT FALLBACK MAP (subtype → default mechanism)
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_FAILURE_MECHANISM: Dict[str, str] = {
    "wrong_invariant": "invariant_drift",
    "incorrect_boundary": "boundary_miss",
    "brute_force_under_constraints": "complexity_explosion",
    "state_loss": "state_not_preserved",
    "premature_optimization": "optimized_wrong_logic",
    "misread_constraint": "constraint_blindness",
    "partial_case_handling": "edge_case_omission",
    "comparison_logic_error": "operator_confusion",
    "suboptimal_data_structure": "wrong_container_choice",
    "redundant_computation": "repeated_subproblem",
    "state_space_blowup": "state_space_blowup",
    "off_by_one": "index_off_by_one",
    "type_coercion_bug": "implicit_cast_error",
    "overflow_underflow": "integer_overflow",
    "ignored_edge_specification": "missed_special_case_requirement",
    "wrong_problem_model": "inverted_problem_logic",
}


# ═══════════════════════════════════════════════════════════════════════════════
# RULE ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def derive_failure_mechanism(
    *,
    root_cause: str,
    subtype: str,
    category: str,
    signals: Dict[str, Any],
) -> str:
    """
    Deterministically derive FAILURE_MECHANISM from predictions + signals.

    Parameters
    ----------
    root_cause : str
        One of: correctness, efficiency, implementation, understanding_gap
    subtype : str
        Fine-grained subtype predicted by Model B
    category : str
        Problem category (arrays, graph, dp, strings, trees, etc.)
    signals : Dict[str, Any]
        Code + execution signals extracted from submission.
        Keys can include:
        - loop_bounds: bool
        - prefix_sum: bool
        - two_pointers: bool
        - binary_search: bool
        - sliding_window: bool
        - large_n: bool
        - recursion_depth: bool
        - verdict: str

    Returns
    -------
    str
        failure_mechanism (NEVER generic, NEVER empty)
    """
    
    category_lower = category.lower() if category else ""
    
    # ───────────────────────────────────────────────────────────────────────────
    # WRONG INVARIANT
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "wrong_invariant":
        if signals.get("loop_bounds"):
            return "off_by_one"
        if signals.get("prefix_sum"):
            return "invariant_drift"
        if signals.get("two_pointers"):
            return "pointer_desync"
        if category_lower in ("arrays", "array"):
            return "array_invariant_violation"
        return "invariant_drift"

    # ───────────────────────────────────────────────────────────────────────────
    # INCORRECT BOUNDARY
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "incorrect_boundary":
        if signals.get("binary_search"):
            return "boundary_miss"
        if signals.get("sliding_window"):
            return "window_overflow"
        if category_lower in ("binary search", "binary_search"):
            return "search_bounds_error"
        return "boundary_condition_error"

    # ───────────────────────────────────────────────────────────────────────────
    # PARTIAL CASE HANDLING
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "partial_case_handling":
        if signals.get("null_check"):
            return "null_handling_miss"
        if signals.get("empty_input"):
            return "empty_input_crash"
        return "edge_case_omission"

    # ───────────────────────────────────────────────────────────────────────────
    # COMPARISON LOGIC ERROR
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "comparison_logic_error":
        if signals.get("equality_check"):
            return "equality_vs_inequality"
        return "operator_confusion"

    # ───────────────────────────────────────────────────────────────────────────
    # BRUTE FORCE UNDER CONSTRAINTS
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "brute_force_under_constraints":
        if category_lower in ("graph", "graphs"):
            return "exponential_path_explosion"
        if category_lower in ("dp", "dynamic programming", "dynamic_programming"):
            return "state_space_blowup"
        if category_lower in ("strings", "string"):
            return "quadratic_scan"
        return "complexity_explosion"

    # ───────────────────────────────────────────────────────────────────────────
    # SUBOPTIMAL DATA STRUCTURE
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "suboptimal_data_structure":
        if signals.get("linear_search"):
            return "linear_where_hash_needed"
        return "wrong_container_choice"

    # ───────────────────────────────────────────────────────────────────────────
    # REDUNDANT COMPUTATION
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "redundant_computation":
        if signals.get("no_memo"):
            return "no_memoization"
        return "repeated_subproblem"

    # ───────────────────────────────────────────────────────────────────────────
    # STATE SPACE BLOWUP
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "state_space_blowup":
        return "state_space_blowup"

    # ───────────────────────────────────────────────────────────────────────────
    # STATE LOSS
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "state_loss":
        if category_lower in ("dp", "dynamic programming", "dynamic_programming"):
            return "missing_state_dimension"
        if category_lower in ("graph", "graphs"):
            return "visited_state_reset"
        if signals.get("memo"):
            return "memoization_miss"
        return "state_not_preserved"

    # ───────────────────────────────────────────────────────────────────────────
    # PREMATURE OPTIMIZATION
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "premature_optimization":
        return "optimized_wrong_logic"

    # ───────────────────────────────────────────────────────────────────────────
    # OFF BY ONE
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "off_by_one":
        if signals.get("loop_bounds"):
            return "loop_bounds_error"
        if signals.get("fence_post"):
            return "fence_post_error"
        return "index_off_by_one"

    # ───────────────────────────────────────────────────────────────────────────
    # TYPE COERCION BUG
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "type_coercion_bug":
        if signals.get("division"):
            return "integer_division_truncation"
        return "implicit_cast_error"

    # ───────────────────────────────────────────────────────────────────────────
    # OVERFLOW/UNDERFLOW
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "overflow_underflow":
        if signals.get("multiplication"):
            return "multiplication_overflow"
        return "integer_overflow"

    # ───────────────────────────────────────────────────────────────────────────
    # MISREAD CONSTRAINT
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "misread_constraint":
        if signals.get("large_n"):
            return "constraint_blindness"
        return "constraint_misinterpretation"

    # ───────────────────────────────────────────────────────────────────────────
    # IGNORED EDGE SPECIFICATION
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "ignored_edge_specification":
        return "missed_special_case_requirement"

    # ───────────────────────────────────────────────────────────────────────────
    # WRONG PROBLEM MODEL
    # ───────────────────────────────────────────────────────────────────────────
    if subtype == "wrong_problem_model":
        return "inverted_problem_logic"

    # ───────────────────────────────────────────────────────────────────────────
    # FALLBACK (GUARANTEED NON-GENERIC)
    # ───────────────────────────────────────────────────────────────────────────
    return DEFAULT_FAILURE_MECHANISM.get(subtype, "logic_misalignment")


def validate_failure_mechanism(mechanism: str) -> bool:
    """
    Validate that a failure mechanism is in the allowed set.
    """
    if mechanism not in FAILURE_MECHANISMS:
        raise ValueError(
            f"Invalid failure_mechanism: '{mechanism}'. "
            f"Must be one of: {sorted(FAILURE_MECHANISMS)}"
        )
    return True
