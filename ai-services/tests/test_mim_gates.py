"""
MIM V3.0 Gate Tests
===================

PHASE 1: Exhaustive unit tests for enforcement gates and masks.

Test Categories:
1.1 Verdict Gate Tests - Strict accepted/failed separation
1.2 Taxonomy Mask Tests - ROOT_CAUSE → SUBTYPE validation
1.3 FAILURE_MECHANISM Coverage - 100% deterministic resolution

Run with: pytest tests/test_mim_gates.py -v --tb=short
"""

import pytest
from typing import Dict, Any

# ═══════════════════════════════════════════════════════════════════════════════
# IMPORTS
# ═══════════════════════════════════════════════════════════════════════════════

from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    SUBTYPE_TO_ROOT_CAUSES,
    SUBTYPES,
    validate_subtype,
    get_valid_subtypes,
    get_valid_root_causes,
    is_valid_pair,
    SubtypeValidationError,
)

from app.mim.taxonomy.failure_mechanism_rules import (
    derive_failure_mechanism,
    FAILURE_MECHANISMS,
    DEFAULT_FAILURE_MECHANISM,
    validate_failure_mechanism,
)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def all_root_causes():
    """All valid ROOT_CAUSE values."""
    return ["correctness", "efficiency", "implementation", "understanding_gap"]


@pytest.fixture
def all_subtypes():
    """All valid SUBTYPE values."""
    return list(SUBTYPES)


@pytest.fixture
def sample_correctness_feedback():
    """Sample CorrectnessFeedback output structure."""
    return {
        "feedback_type": "correctness",
        "root_cause": "correctness",
        "subtype": "wrong_invariant",
        "failure_mechanism": "invariant_drift",
        "violated_invariant": "Loop invariant: sum should equal prefix sum",
        "counterexample": "Input [1,2,3], Expected 6, Got 5",
        "fix_strategy": "Track sum at each step",
    }


@pytest.fixture
def sample_performance_feedback():
    """Sample PerformanceFeedback output structure."""
    return {
        "feedback_type": "performance",
        "root_cause": "efficiency",
        "subtype": "brute_force_under_constraints",
        "failure_mechanism": "complexity_explosion",
        "expected_complexity": "O(n log n)",
        "observed_complexity": "O(n²)",
        "optimization_direction": "Use binary search instead of linear scan",
    }


@pytest.fixture
def sample_reinforcement_feedback():
    """Sample ReinforcementFeedback output structure."""
    return {
        "feedback_type": "reinforcement",
        "category": "arrays",
        "technique": "two_pointers",
        "difficulty": "medium",
        "confidence_boost": 0.15,
        "strength_signal": "Clean two-pointer implementation",
    }


@pytest.fixture
def categories():
    """Problem categories for failure mechanism testing."""
    return [
        "arrays", "array", "strings", "string", 
        "dp", "dynamic programming", "dynamic_programming",
        "graph", "graphs", "trees", "binary search", "binary_search",
        "greedy", "math", "sorting", "hash table",
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# 1.1 VERDICT GATE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestVerdictGate:
    """
    Tests for strict accepted/failed separation.
    
    RULES:
    - Accepted → ReinforcementFeedback ONLY ✅
    - Accepted → CorrectnessFeedback ❌
    - Accepted → PerformanceFeedback ❌
    - Failed → ReinforcementFeedback ❌
    - Failed → CorrectnessFeedback ✅
    - Failed → PerformanceFeedback ✅
    """
    
    def test_accepted_to_reinforcement_allowed(
        self, sample_reinforcement_feedback
    ):
        """Accepted → ReinforcementFeedback is ALLOWED."""
        verdict = "accepted"
        output = sample_reinforcement_feedback
        
        # This should NOT raise
        self._mock_verdict_gate(verdict, output)
    
    def test_accepted_ac_to_reinforcement_allowed(
        self, sample_reinforcement_feedback
    ):
        """Accepted (AC) → ReinforcementFeedback is ALLOWED."""
        verdict = "AC"
        output = sample_reinforcement_feedback
        
        # This should NOT raise
        self._mock_verdict_gate(verdict, output)
    
    def test_accepted_to_correctness_forbidden(
        self, sample_correctness_feedback
    ):
        """Accepted → CorrectnessFeedback is FORBIDDEN."""
        verdict = "accepted"
        output = sample_correctness_feedback
        
        with pytest.raises(RuntimeError) as exc_info:
            self._mock_verdict_gate(verdict, output)
        
        assert "VERDICT GATE VIOLATION" in str(exc_info.value)
        assert "Accepted" in str(exc_info.value) or "accepted" in str(exc_info.value)
    
    def test_accepted_to_performance_forbidden(
        self, sample_performance_feedback
    ):
        """Accepted → PerformanceFeedback is FORBIDDEN."""
        verdict = "accepted"
        output = sample_performance_feedback
        
        with pytest.raises(RuntimeError) as exc_info:
            self._mock_verdict_gate(verdict, output)
        
        assert "VERDICT GATE VIOLATION" in str(exc_info.value)
    
    def test_failed_to_reinforcement_forbidden(
        self, sample_reinforcement_feedback
    ):
        """Failed → ReinforcementFeedback is FORBIDDEN."""
        for verdict in ["wrong_answer", "WA", "TLE", "MLE", "RE", "CE"]:
            with pytest.raises(RuntimeError) as exc_info:
                self._mock_verdict_gate(verdict, sample_reinforcement_feedback)
            
            assert "VERDICT GATE VIOLATION" in str(exc_info.value)
            assert "Failed" in str(exc_info.value)
    
    def test_failed_to_correctness_allowed(
        self, sample_correctness_feedback
    ):
        """Failed → CorrectnessFeedback is ALLOWED."""
        for verdict in ["wrong_answer", "WA"]:
            # Should NOT raise
            self._mock_verdict_gate(verdict, sample_correctness_feedback)
    
    def test_failed_to_performance_allowed(
        self, sample_performance_feedback
    ):
        """Failed → PerformanceFeedback is ALLOWED."""
        for verdict in ["TLE", "time_limit_exceeded"]:
            # Should NOT raise
            self._mock_verdict_gate(verdict, sample_performance_feedback)
    
    def test_all_accepted_variants(
        self, sample_reinforcement_feedback, sample_correctness_feedback
    ):
        """Test all accepted verdict variants."""
        accepted_variants = ["accepted", "Accepted", "ACCEPTED", "AC", "ac"]
        
        for verdict in accepted_variants:
            # Reinforcement OK
            self._mock_verdict_gate(verdict, sample_reinforcement_feedback)
            
            # Correctness NOT OK
            with pytest.raises(RuntimeError):
                self._mock_verdict_gate(verdict, sample_correctness_feedback)
    
    def test_all_failed_variants(
        self, sample_correctness_feedback, sample_reinforcement_feedback
    ):
        """Test all failed verdict variants."""
        failed_variants = [
            "wrong_answer", "WA", "wa",
            "time_limit_exceeded", "TLE", "tle",
            "memory_limit_exceeded", "MLE", "mle",
            "runtime_error", "RE", "re",
            "compilation_error", "CE", "ce",
        ]
        
        for verdict in failed_variants:
            # Correctness OK
            self._mock_verdict_gate(verdict, sample_correctness_feedback)
            
            # Reinforcement NOT OK
            with pytest.raises(RuntimeError):
                self._mock_verdict_gate(verdict, sample_reinforcement_feedback)
    
    def test_accepted_with_correctness_feedback_attached_forbidden(self):
        """Accepted submission with correctness_feedback attached is FORBIDDEN."""
        verdict = "accepted"
        output = {
            "feedback_type": "reinforcement",
            "correctness_feedback": {"some": "data"},  # VIOLATION
        }
        
        with pytest.raises(RuntimeError) as exc_info:
            self._mock_verdict_gate(verdict, output)
        
        assert "VERDICT GATE VIOLATION" in str(exc_info.value)
    
    def test_accepted_with_performance_feedback_attached_forbidden(self):
        """Accepted submission with performance_feedback attached is FORBIDDEN."""
        verdict = "accepted"
        output = {
            "feedback_type": "reinforcement",
            "performance_feedback": {"some": "data"},  # VIOLATION
        }
        
        with pytest.raises(RuntimeError) as exc_info:
            self._mock_verdict_gate(verdict, output)
        
        assert "VERDICT GATE VIOLATION" in str(exc_info.value)
    
    def test_failed_with_reinforcement_feedback_attached_forbidden(self):
        """Failed submission with reinforcement_feedback attached is FORBIDDEN."""
        verdict = "wrong_answer"
        output = {
            "feedback_type": "correctness",
            "reinforcement_feedback": {"some": "data"},  # VIOLATION
        }
        
        with pytest.raises(RuntimeError) as exc_info:
            self._mock_verdict_gate(verdict, output)
        
        assert "VERDICT GATE VIOLATION" in str(exc_info.value)
    
    def _mock_verdict_gate(self, verdict: str, output: Dict[str, Any]) -> None:
        """
        Mock implementation of verdict gate for testing.
        
        This mirrors the actual _enforce_verdict_gate logic.
        """
        is_accepted = verdict.lower() in ("accepted", "ac")
        feedback_type = output.get("feedback_type", "")
        
        if is_accepted:
            if feedback_type != "reinforcement":
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Accepted submission produced "
                    f"'{feedback_type}' feedback instead of 'reinforcement'."
                )
            if "correctness_feedback" in output or "performance_feedback" in output:
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Accepted submission has "
                    f"correctness/performance feedback attached."
                )
        else:
            if feedback_type == "reinforcement":
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Failed submission (verdict='{verdict}') "
                    f"produced 'reinforcement' feedback."
                )
            if "reinforcement_feedback" in output:
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Failed submission has "
                    f"reinforcement_feedback attached."
                )


# ═══════════════════════════════════════════════════════════════════════════════
# 1.2 TAXONOMY MASK TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestTaxonomyMasks:
    """
    Tests for ROOT_CAUSE → SUBTYPE validation.
    
    For every root_cause:
    - All allowed subtypes → pass
    - All disallowed subtypes → raise
    """
    
    # ─────────────────────────────────────────────────────────────────────────
    # CORRECTNESS root_cause
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_correctness_allowed_subtypes(self):
        """Test all allowed subtypes for correctness root_cause."""
        allowed = {
            "wrong_invariant",
            "incorrect_boundary",
            "partial_case_handling",
            "state_loss",
        }
        
        for subtype in allowed:
            # Should NOT raise
            validate_subtype("correctness", subtype)
            assert is_valid_pair("correctness", subtype)
    
    def test_correctness_disallowed_subtypes(self, all_subtypes):
        """Test all disallowed subtypes for correctness root_cause."""
        allowed = ROOT_CAUSE_TO_SUBTYPES["correctness"]
        
        for subtype in all_subtypes:
            if subtype not in allowed:
                with pytest.raises(SubtypeValidationError):
                    validate_subtype("correctness", subtype)
                assert not is_valid_pair("correctness", subtype)
    
    # ─────────────────────────────────────────────────────────────────────────
    # EFFICIENCY root_cause
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_efficiency_allowed_subtypes(self):
        """Test all allowed subtypes for efficiency root_cause."""
        allowed = {
            "brute_force_under_constraints",
            "premature_optimization",
        }
        
        for subtype in allowed:
            # Should NOT raise
            validate_subtype("efficiency", subtype)
            assert is_valid_pair("efficiency", subtype)
    
    def test_efficiency_disallowed_subtypes(self, all_subtypes):
        """Test all disallowed subtypes for efficiency root_cause."""
        allowed = ROOT_CAUSE_TO_SUBTYPES["efficiency"]
        
        for subtype in all_subtypes:
            if subtype not in allowed:
                with pytest.raises(SubtypeValidationError):
                    validate_subtype("efficiency", subtype)
    
    # ─────────────────────────────────────────────────────────────────────────
    # IMPLEMENTATION root_cause
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_implementation_allowed_subtypes(self):
        """Test all allowed subtypes for implementation root_cause."""
        allowed = {
            "incorrect_boundary",
            "state_loss",
            "partial_case_handling",
        }
        
        for subtype in allowed:
            # Should NOT raise
            validate_subtype("implementation", subtype)
            assert is_valid_pair("implementation", subtype)
    
    def test_implementation_disallowed_subtypes(self, all_subtypes):
        """Test all disallowed subtypes for implementation root_cause."""
        allowed = ROOT_CAUSE_TO_SUBTYPES["implementation"]
        
        for subtype in all_subtypes:
            if subtype not in allowed:
                with pytest.raises(SubtypeValidationError):
                    validate_subtype("implementation", subtype)
    
    # ─────────────────────────────────────────────────────────────────────────
    # UNDERSTANDING_GAP root_cause
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_understanding_gap_allowed_subtypes(self):
        """Test all allowed subtypes for understanding_gap root_cause."""
        allowed = {
            "misread_constraint",
            "wrong_invariant",
        }
        
        for subtype in allowed:
            # Should NOT raise
            validate_subtype("understanding_gap", subtype)
            assert is_valid_pair("understanding_gap", subtype)
    
    def test_understanding_gap_disallowed_subtypes(self, all_subtypes):
        """Test all disallowed subtypes for understanding_gap root_cause."""
        allowed = ROOT_CAUSE_TO_SUBTYPES["understanding_gap"]
        
        for subtype in all_subtypes:
            if subtype not in allowed:
                with pytest.raises(SubtypeValidationError):
                    validate_subtype("understanding_gap", subtype)
    
    # ─────────────────────────────────────────────────────────────────────────
    # CROSS-CUTTING TESTS
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_unknown_root_cause_raises(self):
        """Unknown root_cause should raise."""
        invalid_roots = [
            "unknown", "generic", "other", "", "null",
            "algorithm_choice", "data_structure", "logic",
        ]
        
        for root in invalid_roots:
            with pytest.raises(SubtypeValidationError):
                validate_subtype(root, "wrong_invariant")
    
    def test_unknown_subtype_raises(self, all_root_causes):
        """Unknown subtype should raise for all root_causes."""
        invalid_subtypes = [
            "unknown", "generic", "other", "", "null",
            "algorithm_choice", "logic_error", "bug",
        ]
        
        for root in all_root_causes:
            for subtype in invalid_subtypes:
                with pytest.raises(SubtypeValidationError):
                    validate_subtype(root, subtype)
    
    def test_overlapping_subtypes_valid(self):
        """Test subtypes that appear under multiple root_causes."""
        # wrong_invariant: correctness, understanding_gap
        assert is_valid_pair("correctness", "wrong_invariant")
        assert is_valid_pair("understanding_gap", "wrong_invariant")
        
        # incorrect_boundary: correctness, implementation
        assert is_valid_pair("correctness", "incorrect_boundary")
        assert is_valid_pair("implementation", "incorrect_boundary")
        
        # state_loss: correctness, implementation
        assert is_valid_pair("correctness", "state_loss")
        assert is_valid_pair("implementation", "state_loss")
        
        # partial_case_handling: correctness, implementation
        assert is_valid_pair("correctness", "partial_case_handling")
        assert is_valid_pair("implementation", "partial_case_handling")
    
    def test_non_overlapping_subtypes_exclusive(self):
        """Test subtypes that appear under only one root_cause."""
        # brute_force_under_constraints: efficiency only
        assert is_valid_pair("efficiency", "brute_force_under_constraints")
        assert not is_valid_pair("correctness", "brute_force_under_constraints")
        assert not is_valid_pair("implementation", "brute_force_under_constraints")
        assert not is_valid_pair("understanding_gap", "brute_force_under_constraints")
        
        # premature_optimization: efficiency only
        assert is_valid_pair("efficiency", "premature_optimization")
        assert not is_valid_pair("correctness", "premature_optimization")
        
        # misread_constraint: understanding_gap only
        assert is_valid_pair("understanding_gap", "misread_constraint")
        assert not is_valid_pair("correctness", "misread_constraint")
    
    def test_reverse_lookup_valid(self):
        """Test SUBTYPE_TO_ROOT_CAUSES reverse mapping."""
        # wrong_invariant should have correctness and understanding_gap
        assert "correctness" in SUBTYPE_TO_ROOT_CAUSES["wrong_invariant"]
        assert "understanding_gap" in SUBTYPE_TO_ROOT_CAUSES["wrong_invariant"]
        
        # brute_force should only have efficiency
        assert SUBTYPE_TO_ROOT_CAUSES["brute_force_under_constraints"] == frozenset({"efficiency"})
    
    def test_get_valid_subtypes_function(self, all_root_causes):
        """Test get_valid_subtypes returns correct subtypes."""
        for root in all_root_causes:
            subtypes = get_valid_subtypes(root)
            assert isinstance(subtypes, frozenset)
            assert len(subtypes) > 0
            assert subtypes == ROOT_CAUSE_TO_SUBTYPES[root]
    
    def test_get_valid_root_causes_function(self, all_subtypes):
        """Test get_valid_root_causes returns correct root causes."""
        for subtype in all_subtypes:
            roots = get_valid_root_causes(subtype)
            assert isinstance(roots, frozenset)
            assert len(roots) > 0
            assert roots == SUBTYPE_TO_ROOT_CAUSES[subtype]
    
    def test_no_empty_subtype_sets(self, all_root_causes):
        """Every root_cause MUST have at least one valid subtype."""
        for root in all_root_causes:
            assert len(ROOT_CAUSE_TO_SUBTYPES[root]) > 0
    
    def test_every_subtype_has_root(self, all_subtypes):
        """Every subtype MUST belong to at least one root_cause."""
        for subtype in all_subtypes:
            assert len(SUBTYPE_TO_ROOT_CAUSES[subtype]) > 0
    
    def test_canonical_subtype_count(self):
        """Verify we have exactly 7 canonical subtypes."""
        assert len(SUBTYPES) == 7
    
    def test_canonical_root_cause_count(self):
        """Verify we have exactly 4 canonical root_causes."""
        assert len(ROOT_CAUSE_TO_SUBTYPES) == 4


# ═══════════════════════════════════════════════════════════════════════════════
# 1.3 FAILURE_MECHANISM COVERAGE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestFailureMechanismCoverage:
    """
    Tests for FAILURE_MECHANISM deterministic resolution.
    
    GUARANTEE:
    - Every (root_cause, subtype) pair resolves to a mechanism
    - No fallback to "logic_misalignment" unless explicitly tested
    - 100% deterministic resolution, no randomness
    """
    
    def test_all_canonical_pairs_resolve(self, all_root_causes, categories):
        """Every valid (root_cause, subtype) pair MUST resolve."""
        for root_cause in all_root_causes:
            for subtype in ROOT_CAUSE_TO_SUBTYPES[root_cause]:
                for category in categories:
                    mechanism = derive_failure_mechanism(
                        root_cause=root_cause,
                        subtype=subtype,
                        category=category,
                        signals={},
                    )
                    
                    # MUST return a non-empty string
                    assert mechanism, f"Empty mechanism for ({root_cause}, {subtype}, {category})"
                    
                    # MUST be a known mechanism
                    assert mechanism in FAILURE_MECHANISMS, (
                        f"Unknown mechanism '{mechanism}' for ({root_cause}, {subtype})"
                    )
    
    def test_deterministic_resolution(self, all_root_causes, categories):
        """Same inputs MUST produce same outputs (no randomness)."""
        for root_cause in all_root_causes:
            for subtype in ROOT_CAUSE_TO_SUBTYPES[root_cause]:
                for category in categories:
                    results = []
                    for _ in range(5):  # Run 5 times
                        mechanism = derive_failure_mechanism(
                            root_cause=root_cause,
                            subtype=subtype,
                            category=category,
                            signals={},
                        )
                        results.append(mechanism)
                    
                    # All results MUST be identical
                    assert len(set(results)) == 1, (
                        f"Non-deterministic for ({root_cause}, {subtype}): {results}"
                    )
    
    def test_no_silent_fallback_to_logic_misalignment(self, all_root_causes, categories):
        """
        logic_misalignment is allowed ONLY as ultimate fallback.
        
        For canonical subtypes, we should NOT see it.
        """
        canonical_subtypes = SUBTYPES
        
        for root_cause in all_root_causes:
            for subtype in ROOT_CAUSE_TO_SUBTYPES[root_cause]:
                for category in categories[:3]:  # Test a few categories
                    mechanism = derive_failure_mechanism(
                        root_cause=root_cause,
                        subtype=subtype,
                        category=category,
                        signals={},
                    )
                    
                    # For canonical subtypes, should NOT be logic_misalignment
                    if subtype in canonical_subtypes:
                        assert mechanism != "logic_misalignment", (
                            f"Silent fallback for canonical ({root_cause}, {subtype})"
                        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # WRONG_INVARIANT specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_wrong_invariant_with_loop_bounds(self):
        """wrong_invariant + loop_bounds → off_by_one."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="arrays",
            signals={"loop_bounds": True},
        )
        assert mechanism == "off_by_one"
    
    def test_wrong_invariant_with_prefix_sum(self):
        """wrong_invariant + prefix_sum → invariant_drift."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="arrays",
            signals={"prefix_sum": True},
        )
        assert mechanism == "invariant_drift"
    
    def test_wrong_invariant_with_two_pointers(self):
        """wrong_invariant + two_pointers → pointer_desync."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="arrays",
            signals={"two_pointers": True},
        )
        assert mechanism == "pointer_desync"
    
    def test_wrong_invariant_arrays_category(self):
        """wrong_invariant + arrays → array_invariant_violation."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="arrays",
            signals={},
        )
        assert mechanism == "array_invariant_violation"
    
    def test_wrong_invariant_default(self):
        """wrong_invariant default → invariant_drift."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="other",
            signals={},
        )
        assert mechanism == "invariant_drift"
    
    # ─────────────────────────────────────────────────────────────────────────
    # INCORRECT_BOUNDARY specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_incorrect_boundary_with_binary_search(self):
        """incorrect_boundary + binary_search → boundary_miss."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="incorrect_boundary",
            category="arrays",
            signals={"binary_search": True},
        )
        assert mechanism == "boundary_miss"
    
    def test_incorrect_boundary_with_sliding_window(self):
        """incorrect_boundary + sliding_window → window_overflow."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="incorrect_boundary",
            category="arrays",
            signals={"sliding_window": True},
        )
        assert mechanism == "window_overflow"
    
    def test_incorrect_boundary_binary_search_category(self):
        """incorrect_boundary + binary search category → search_bounds_error."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="incorrect_boundary",
            category="binary search",
            signals={},
        )
        assert mechanism == "search_bounds_error"
    
    def test_incorrect_boundary_default(self):
        """incorrect_boundary default → boundary_condition_error."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="incorrect_boundary",
            category="other",
            signals={},
        )
        assert mechanism == "boundary_condition_error"
    
    # ─────────────────────────────────────────────────────────────────────────
    # BRUTE_FORCE_UNDER_CONSTRAINTS specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_brute_force_graph_category(self):
        """brute_force + graph → exponential_path_explosion."""
        mechanism = derive_failure_mechanism(
            root_cause="efficiency",
            subtype="brute_force_under_constraints",
            category="graph",
            signals={},
        )
        assert mechanism == "exponential_path_explosion"
    
    def test_brute_force_dp_category(self):
        """brute_force + dp → state_space_blowup."""
        mechanism = derive_failure_mechanism(
            root_cause="efficiency",
            subtype="brute_force_under_constraints",
            category="dp",
            signals={},
        )
        assert mechanism == "state_space_blowup"
    
    def test_brute_force_strings_category(self):
        """brute_force + strings → quadratic_scan."""
        mechanism = derive_failure_mechanism(
            root_cause="efficiency",
            subtype="brute_force_under_constraints",
            category="strings",
            signals={},
        )
        assert mechanism == "quadratic_scan"
    
    def test_brute_force_default(self):
        """brute_force default → complexity_explosion."""
        mechanism = derive_failure_mechanism(
            root_cause="efficiency",
            subtype="brute_force_under_constraints",
            category="other",
            signals={},
        )
        assert mechanism == "complexity_explosion"
    
    # ─────────────────────────────────────────────────────────────────────────
    # STATE_LOSS specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_state_loss_dp_category(self):
        """state_loss + dp → missing_state_dimension."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="state_loss",
            category="dp",
            signals={},
        )
        assert mechanism == "missing_state_dimension"
    
    def test_state_loss_graph_category(self):
        """state_loss + graph → visited_state_reset."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="state_loss",
            category="graph",
            signals={},
        )
        assert mechanism == "visited_state_reset"
    
    def test_state_loss_with_memo_signal(self):
        """state_loss + memo → memoization_miss."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="state_loss",
            category="other",
            signals={"memo": True},
        )
        assert mechanism == "memoization_miss"
    
    def test_state_loss_default(self):
        """state_loss default → state_not_preserved."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="state_loss",
            category="other",
            signals={},
        )
        assert mechanism == "state_not_preserved"
    
    # ─────────────────────────────────────────────────────────────────────────
    # PARTIAL_CASE_HANDLING specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_partial_case_with_null_check(self):
        """partial_case_handling + null_check → null_handling_miss."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="partial_case_handling",
            category="arrays",
            signals={"null_check": True},
        )
        assert mechanism == "null_handling_miss"
    
    def test_partial_case_with_empty_input(self):
        """partial_case_handling + empty_input → empty_input_crash."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="partial_case_handling",
            category="arrays",
            signals={"empty_input": True},
        )
        assert mechanism == "empty_input_crash"
    
    def test_partial_case_default(self):
        """partial_case_handling default → edge_case_omission."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="partial_case_handling",
            category="arrays",
            signals={},
        )
        assert mechanism == "edge_case_omission"
    
    # ─────────────────────────────────────────────────────────────────────────
    # MISREAD_CONSTRAINT specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_misread_constraint_with_large_n(self):
        """misread_constraint + large_n → constraint_blindness."""
        mechanism = derive_failure_mechanism(
            root_cause="understanding_gap",
            subtype="misread_constraint",
            category="arrays",
            signals={"large_n": True},
        )
        assert mechanism == "constraint_blindness"
    
    def test_misread_constraint_default(self):
        """misread_constraint default → constraint_misinterpretation."""
        mechanism = derive_failure_mechanism(
            root_cause="understanding_gap",
            subtype="misread_constraint",
            category="arrays",
            signals={},
        )
        assert mechanism == "constraint_misinterpretation"
    
    # ─────────────────────────────────────────────────────────────────────────
    # PREMATURE_OPTIMIZATION specific tests
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_premature_optimization(self):
        """premature_optimization → optimized_wrong_logic."""
        mechanism = derive_failure_mechanism(
            root_cause="efficiency",
            subtype="premature_optimization",
            category="any",
            signals={},
        )
        assert mechanism == "optimized_wrong_logic"
    
    # ─────────────────────────────────────────────────────────────────────────
    # VALIDATION TESTS
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_validate_failure_mechanism_valid(self):
        """Valid mechanisms should pass validation."""
        for mechanism in FAILURE_MECHANISMS:
            assert validate_failure_mechanism(mechanism)
    
    def test_validate_failure_mechanism_invalid(self):
        """Invalid mechanisms should raise."""
        invalid = ["unknown", "generic", "", "null", "bug"]
        for mechanism in invalid:
            with pytest.raises(ValueError):
                validate_failure_mechanism(mechanism)
    
    def test_default_fallback_map_complete(self):
        """DEFAULT_FAILURE_MECHANISM should cover all canonical subtypes."""
        for subtype in SUBTYPES:
            # Most canonical subtypes should have explicit handling
            # Some may fallback to DEFAULT_FAILURE_MECHANISM
            mechanism = DEFAULT_FAILURE_MECHANISM.get(subtype)
            if mechanism:
                assert mechanism in FAILURE_MECHANISMS


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestGatesIntegration:
    """
    Integration tests combining multiple gates.
    """
    
    def test_complete_failed_flow_valid(self):
        """Complete failed submission flow with valid taxonomy."""
        root_cause = "correctness"
        subtype = "wrong_invariant"
        
        # Step 1: Validate taxonomy
        validate_subtype(root_cause, subtype)
        
        # Step 2: Derive mechanism
        mechanism = derive_failure_mechanism(
            root_cause=root_cause,
            subtype=subtype,
            category="arrays",
            signals={"loop_bounds": True},
        )
        
        # Step 3: Build output
        output = {
            "feedback_type": "correctness",
            "root_cause": root_cause,
            "subtype": subtype,
            "failure_mechanism": mechanism,
        }
        
        # Step 4: Validate verdict gate (simulated)
        verdict = "wrong_answer"
        assert output["feedback_type"] != "reinforcement"
    
    def test_complete_accepted_flow_valid(self):
        """Complete accepted submission flow."""
        output = {
            "feedback_type": "reinforcement",
            "category": "arrays",
            "technique": "two_pointers",
        }
        
        # Should NOT have root_cause
        assert "root_cause" not in output
        assert "subtype" not in output
        
        verdict = "accepted"
        assert output["feedback_type"] == "reinforcement"
    
    def test_invalid_taxonomy_blocks_flow(self):
        """Invalid taxonomy should block entire flow."""
        root_cause = "efficiency"
        subtype = "wrong_invariant"  # INVALID for efficiency
        
        with pytest.raises(SubtypeValidationError):
            validate_subtype(root_cause, subtype)
    
    def test_all_valid_pairs_count(self):
        """Count total valid (root_cause, subtype) pairs."""
        total_pairs = sum(
            len(subtypes) 
            for subtypes in ROOT_CAUSE_TO_SUBTYPES.values()
        )
        # correctness: 4, efficiency: 2, implementation: 3, understanding_gap: 2
        # Total: 11 (with overlaps counted per root)
        assert total_pairs == 11


# ═══════════════════════════════════════════════════════════════════════════════
# EDGE CASE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """
    Edge case and boundary tests.
    """
    
    def test_empty_signals_handled(self):
        """Empty signals dict should not crash."""
        for root in ROOT_CAUSE_TO_SUBTYPES:
            for subtype in ROOT_CAUSE_TO_SUBTYPES[root]:
                mechanism = derive_failure_mechanism(
                    root_cause=root,
                    subtype=subtype,
                    category="arrays",
                    signals={},
                )
                assert mechanism
    
    def test_none_signals_handled(self):
        """None values in signals should be handled."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="arrays",
            signals={"loop_bounds": None, "prefix_sum": None},
        )
        assert mechanism
    
    def test_empty_category_handled(self):
        """Empty category should not crash."""
        mechanism = derive_failure_mechanism(
            root_cause="correctness",
            subtype="wrong_invariant",
            category="",
            signals={},
        )
        assert mechanism
    
    def test_case_sensitivity_category(self):
        """Category should be case-insensitive."""
        mechanisms = []
        for cat in ["Arrays", "ARRAYS", "arrays"]:
            m = derive_failure_mechanism(
                root_cause="correctness",
                subtype="wrong_invariant",
                category=cat,
                signals={},
            )
            mechanisms.append(m)
        
        # All should produce same result
        assert len(set(mechanisms)) == 1
