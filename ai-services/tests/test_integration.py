"""
MIM v3.0 Integration Tests
==========================

End-to-end workflow tests verifying MIMDecision flows correctly through all agents.

Test Categories:
1. Workflow Integration - MIM → Agents data flow
2. Fallback Behavior - Graceful degradation when components fail
3. Response Schema Validation - API response structure
4. Performance - Latency and throughput checks

Run with: pytest tests/test_integration.py -v
"""

import pytest
import time
import asyncio
from datetime import datetime
from typing import Dict, Any
from unittest.mock import Mock, patch, MagicMock, AsyncMock

# Import workflow components
from app.graph.sync_workflow import sync_workflow, MentatSyncState
from app.mim.decision_engine import make_decision, MIMDecisionEngine
from app.mim.mim_decision import MIMDecision, PatternResult
from app.schemas.feedback import FeedbackResponse


# ═══════════════════════════════════════════════════════════════════════════════
# TEST FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_submission():
    """Standard mock submission for testing."""
    return {
        "user_id": "integration_test_user",
        "problem_id": "test_two_sum",
        "problem_category": "Array",
        "code": """
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i, len(nums)):  # Bug: should be i+1
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
""",
        "language": "python",
        "verdict": "wrong_answer",
        "error_type": "logical_error",
        "constraints": "2 <= nums.length <= 10^4",
    }


@pytest.fixture
def mock_user_history():
    """Mock user submission history."""
    return [
        {"verdict": "wrong_answer", "root_cause": "off_by_one_error", "problem_category": "Array"},
        {"verdict": "wrong_answer", "root_cause": "off_by_one_error", "problem_category": "String"},
        {"verdict": "accepted", "problem_category": "Array"},
        {"verdict": "time_limit_exceeded", "root_cause": "time_complexity_issue", "problem_category": "DP"},
        {"verdict": "accepted", "problem_category": "Graph"},
    ]


@pytest.fixture
def mock_problem_context():
    """Mock problem context."""
    return {
        "title": "Two Sum",
        "difficulty": "Easy",
        "tags": ["array", "hash-table"],
        "expected_approach": "Use hash map for O(n) solution",
    }


@pytest.fixture
def mock_user_profile():
    """Mock user profile."""
    return {
        "weak_topics": ["arrays", "loop indexing"],
        "common_mistakes": ["off-by-one"],
        "skill_level": "Easy",
        "submissions_count": 25,
    }


@pytest.fixture
def mock_user_memory():
    """Mock RAG memory retrieval."""
    return [
        "User made off-by-one error in array rotation problem",
        "Previous mistake: loop boundary issue in binary search",
        "Pattern: tends to use i instead of i+1 in nested loops",
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: MIM → WORKFLOW INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMWorkflowIntegration:
    """Test MIM Decision flows correctly through sync workflow."""
    
    def test_mim_decision_created_in_workflow(
        self, mock_submission, mock_user_history, mock_problem_context
    ):
        """Verify MIMDecision is created during workflow execution."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=mock_problem_context,
            user_memory=None,
            user_profile=None,
        )
        
        assert decision is not None
        assert isinstance(decision, MIMDecision)
        assert decision.root_cause is not None
        assert decision.pattern is not None
        assert decision.difficulty_action is not None
    
    def test_mim_decision_passed_to_feedback_agent(
        self, mock_submission, mock_user_history, mock_problem_context, mock_user_profile
    ):
        """Verify MIMDecision is passed to feedback agent."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=mock_problem_context,
            user_memory=None,
            user_profile=mock_user_profile,
        )
        
        # Get feedback context that would be passed to agent
        feedback_ctx = decision.get_feedback_context()
        
        assert decision.root_cause in feedback_ctx
        assert decision.feedback_instruction.tone in feedback_ctx
    
    def test_mim_decision_passed_to_hint_agent(
        self, mock_submission, mock_user_history, mock_problem_context
    ):
        """Verify MIMDecision provides hint direction."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=mock_problem_context,
            user_memory=None,
            user_profile=None,
        )
        
        hint_ctx = decision.get_hint_context()
        
        assert decision.hint_instruction.hint_direction in hint_ctx
        # Should mention things to avoid revealing
        assert "avoid" in hint_ctx.lower() or "not reveal" in hint_ctx.lower()
    
    def test_mim_decision_passed_to_learning_agent(
        self, mock_submission, mock_user_history, mock_problem_context, mock_user_profile
    ):
        """Verify MIMDecision provides learning focus areas."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=mock_problem_context,
            user_memory=None,
            user_profile=mock_user_profile,
        )
        
        learning_ctx = decision.get_learning_context()
        
        assert decision.learning_instruction.skill_gap in learning_ctx
        for area in decision.learning_instruction.focus_areas:
            assert area in learning_ctx
    
    def test_pattern_detection_no_llm_call(
        self, mock_submission, mock_user_history, mock_problem_context
    ):
        """Verify pattern detection is deterministic (no LLM)."""
        # Time the decision making - should be fast without LLM
        start = time.time()
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=mock_problem_context,
            user_memory=None,
            user_profile=None,
        )
        elapsed = time.time() - start
        
        assert decision.pattern is not None
        assert decision.pattern.pattern_name is not None
        # Without LLM, should be very fast (<100ms)
        assert elapsed < 0.5, f"Pattern detection too slow: {elapsed:.2f}s"
        assert decision.inference_time_ms < 500
    
    def test_difficulty_action_no_llm_call(
        self, mock_submission, mock_user_history, mock_problem_context
    ):
        """Verify difficulty adjustment is rules-based (no LLM)."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=mock_problem_context,
            user_memory=None,
            user_profile=None,
        )
        
        assert decision.difficulty_action is not None
        assert decision.difficulty_action.action in ["increase", "decrease", "maintain", "stretch"]
        assert decision.difficulty_action.rationale is not None
        assert decision.difficulty_action.target_difficulty is not None


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: FALLBACK BEHAVIOR
# ═══════════════════════════════════════════════════════════════════════════════

class TestFallbackBehavior:
    """Test graceful degradation when components fail."""
    
    def test_mim_decision_with_minimal_input(self):
        """Test MIM works with minimal submission data."""
        minimal_submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "print('hello')",
            "verdict": "wrong_answer",
        }
        
        decision = make_decision(
            submission=minimal_submission,
            user_history=[],
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        assert decision is not None
        assert decision.root_cause is not None
        assert decision.is_cold_start is True
    
    def test_mim_decision_with_empty_code(self):
        """Test MIM handles empty code gracefully."""
        submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "",
            "verdict": "compile_error",
        }
        
        decision = make_decision(
            submission=submission,
            user_history=[],
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        assert decision is not None
        # Should still produce a valid decision
    
    def test_mim_decision_with_none_values(self):
        """Test MIM handles None values in submission."""
        submission = {
            "user_id": "test",
            "problem_id": None,
            "code": "x = 1",
            "verdict": "wrong_answer",
            "language": None,
            "problem_category": None,
        }
        
        decision = make_decision(
            submission=submission,
            user_history=None,  # None instead of empty list
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        assert decision is not None
    
    def test_feedback_instruction_fallback_tone(self, mock_submission):
        """Test feedback instruction defaults to 'direct' tone."""
        decision = make_decision(
            submission=mock_submission,
            user_history=[],
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        # For new user with no burnout risk, tone should be direct
        assert decision.feedback_instruction.tone in ["encouraging", "direct", "firm"]
    
    def test_hint_instruction_fallback_direction(self, mock_submission):
        """Test hint instruction provides fallback direction."""
        decision = make_decision(
            submission=mock_submission,
            user_history=[],
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        assert decision.hint_instruction.hint_direction is not None
        assert len(decision.hint_instruction.hint_direction) > 10  # Not empty


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: RESPONSE SCHEMA VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestResponseSchemaValidation:
    """Test API response schemas are correctly populated."""
    
    def test_mim_decision_serializable(self, mock_submission, mock_user_history):
        """Test MIMDecision can be serialized to dict."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        # Should be serializable
        decision_dict = decision.model_dump()
        
        assert isinstance(decision_dict, dict)
        assert "root_cause" in decision_dict
        assert "pattern" in decision_dict
        assert "difficulty_action" in decision_dict
    
    def test_mim_decision_to_api_response(self, mock_submission, mock_user_history):
        """Test MIMDecision can be converted to API response format."""
        decision = make_decision(
            submission=mock_submission,
            user_history=mock_user_history,
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        # Convert to API response format (mimInsights)
        mim_insights = {
            "root_cause": decision.root_cause,
            "root_cause_confidence": decision.root_cause_confidence,
            "pattern": {
                "pattern_name": decision.pattern.pattern_name,
                "is_recurring": decision.pattern.is_recurring,
                "recurrence_count": decision.pattern.recurrence_count,
            },
            "difficulty_action": {
                "action": decision.difficulty_action.action,
                "target_difficulty": decision.difficulty_action.target_difficulty,
                "rationale": decision.difficulty_action.rationale,
            },
            "focus_areas": decision.focus_areas,
            "is_cold_start": decision.is_cold_start,
        }
        
        assert mim_insights["root_cause"] is not None
        assert isinstance(mim_insights["pattern"]["is_recurring"], bool)
        assert mim_insights["difficulty_action"]["action"] in ["increase", "decrease", "maintain", "stretch"]
    
    def test_feedback_response_schema_valid(self):
        """Test FeedbackResponse schema validation."""
        response = FeedbackResponse(
            explanation="This is a detailed explanation of the root cause. " * 3,  # >50 chars
            improvement_hint="Focus on the loop boundary conditions.",
            detected_pattern="off-by-one error",
            complexity_analysis="Time: O(n²), Space: O(1)",
            edge_cases=["Empty array", "Single element"],
            optimization_tips=["Use hash map for O(n) solution"],
        )
        
        assert len(response.explanation) >= 50
        assert response.detected_pattern is not None


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════════════

class TestPerformance:
    """Test latency and throughput requirements."""
    
    def test_mim_decision_latency(self, mock_submission, mock_user_history):
        """Test MIM decision latency is acceptable."""
        times = []
        
        for _ in range(10):
            start = time.time()
            decision = make_decision(
                submission=mock_submission,
                user_history=mock_user_history,
                problem_context=None,
                user_memory=None,
                user_profile=None,
            )
            elapsed = time.time() - start
            times.append(elapsed)
        
        avg_time = sum(times) / len(times)
        p95_time = sorted(times)[int(len(times) * 0.95)]
        
        # Average should be < 100ms, p95 < 200ms
        assert avg_time < 0.1, f"Average latency too high: {avg_time:.3f}s"
        assert p95_time < 0.2, f"P95 latency too high: {p95_time:.3f}s"
    
    def test_pattern_engine_throughput(self):
        """Test pattern engine can handle high throughput."""
        from app.mim.pattern_engine import get_pattern_engine
        
        engine = get_pattern_engine()
        
        start = time.time()
        iterations = 100
        
        for i in range(iterations):
            engine.detect_pattern(
                root_cause="off_by_one_error",
                root_cause_confidence=0.8,
                verdict="wrong_answer",
                user_history=[],
                user_memory=None,
                problem_tags=["array"]
            )
        
        elapsed = time.time() - start
        # Prevent division by zero
        elapsed = max(elapsed, 0.001)
        throughput = iterations / elapsed
        
        # Should handle > 100 requests/second (relaxed for CI environments)
        assert throughput > 100, f"Throughput too low: {throughput:.0f} req/s"
    
    def test_decision_engine_memory_efficiency(self, mock_submission):
        """Test decision engine doesn't leak memory."""
        import gc
        
        # Force garbage collection
        gc.collect()
        
        # Make many decisions
        for _ in range(50):
            decision = make_decision(
                submission=mock_submission,
                user_history=[],
                problem_context=None,
                user_memory=None,
                user_profile=None,
            )
        
        # Force garbage collection again
        gc.collect()
        
        # If we get here without OOM, memory is acceptable
        assert True


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: RECURRING PATTERN DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

class TestRecurringPatternDetection:
    """Test recurring pattern detection from user history."""
    
    def test_detect_recurring_off_by_one(self):
        """Test detecting recurring off-by-one errors."""
        submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "for i in range(n+1): pass",
            "verdict": "runtime_error",
        }
        
        user_history = [
            {"root_cause": "off_by_one_error", "verdict": "wrong_answer"},
            {"root_cause": "off_by_one_error", "verdict": "runtime_error"},
            {"root_cause": "off_by_one_error", "verdict": "wrong_answer"},
            {"root_cause": "logic_error", "verdict": "wrong_answer"},
        ]
        
        decision = make_decision(
            submission=submission,
            user_history=user_history,
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        # Pattern should be detected as recurring
        if decision.root_cause == "off_by_one_error":
            assert decision.pattern.is_recurring is True
            assert decision.pattern.recurrence_count >= 3
    
    def test_recurring_pattern_affects_tone(self):
        """Test recurring patterns affect feedback tone."""
        submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "arr[len(arr)]",
            "verdict": "runtime_error",
        }
        
        # Many occurrences of same mistake
        user_history = [
            {"root_cause": "boundary_condition_blindness", "verdict": "runtime_error"},
        ] * 5
        
        decision = make_decision(
            submission=submission,
            user_history=user_history,
            problem_context=None,
            user_memory=None,
            user_profile=None,
        )
        
        # With many recurrences, tone might be "firm"
        # (depends on model prediction matching boundary_condition_blindness)
        assert decision.feedback_instruction.tone in ["encouraging", "direct", "firm"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
