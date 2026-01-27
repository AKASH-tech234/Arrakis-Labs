"""
Tests for Agent Modules
========================

Tests for all AI agents in app/agents/
"""

import pytest
from unittest.mock import MagicMock, patch
from pydantic import BaseModel
import importlib.util


# v3.2: Check if archived agents exist (for backwards compatibility)
def _agent_exists(module_name: str) -> bool:
    """Check if an agent module exists (not archived)."""
    spec = importlib.util.find_spec(module_name)
    return spec is not None


class TestFeedbackAgent:
    """Tests for the feedback agent."""

    def test_feedback_agent_accepted_verdict(self, sample_accepted_submission):
        """Test that accepted submissions return minimal feedback."""
        from app.agents.feedback_agent import feedback_agent
        
        result = feedback_agent(
            context="Test context",
            payload=sample_accepted_submission
        )
        
        assert result.explanation == "Your solution passed all test cases successfully."
        assert result.improvement_hint == "No changes required."
        assert result.detected_pattern is None

    @patch("app.agents.feedback_agent.run_json_agent")
    def test_feedback_agent_wrong_answer(self, mock_run_json_agent, sample_submission_payload):
        """Test feedback generation for wrong answer."""
        from app.agents.feedback_agent import feedback_agent
        from app.schemas.feedback import FeedbackResponse
        
        mock_response = FeedbackResponse(
            explanation="Your solution uses O(n²) brute force which is inefficient.",
            improvement_hint="Consider using a hash map for O(n) lookup.",
            detected_pattern="Brute force instead of optimal approach"
        )
        mock_run_json_agent.return_value = mock_response
        
        result = feedback_agent(
            context="Test context",
            payload=sample_submission_payload
        )
        
        assert result == mock_response
        mock_run_json_agent.assert_called_once()

    def test_feedback_agent_cache_key_includes_code(self, sample_submission_payload):
        """Test that cache key is sensitive to code changes."""
        from app.cache.cache_key import build_cache_key
        
        payload1 = {**sample_submission_payload, "code": "def a(): pass"}
        payload2 = {**sample_submission_payload, "code": "def b(): pass"}
        
        key1 = build_cache_key("feedback_agent", payload1)
        key2 = build_cache_key("feedback_agent", payload2)
        
        assert key1 != key2


class TestHintAgent:
    """Tests for the hint compression agent."""

    @patch("app.agents.hint_agent.run_json_agent")
    def test_hint_agent_compression(self, mock_run_json_agent, sample_submission_payload):
        """Test hint compression."""
        from app.agents.hint_agent import hint_agent
        from app.schemas.hint import CompressedHint
        
        mock_response = CompressedHint(hint="Consider using a hash map for faster lookups.")
        mock_run_json_agent.return_value = mock_response
        
        result = hint_agent(
            raw_hint="Your solution uses nested loops which results in O(n²) time complexity. This is inefficient for large inputs. Consider using a hash map to store values as you iterate, allowing O(1) lookups.",
            payload=sample_submission_payload
        )
        
        assert result == mock_response
        assert len(result.hint) <= 200  # Hints should be concise

    def test_hint_agent_includes_problem_context(self, sample_submission_payload, sample_problem_context):
        """Test that hint agent includes problem context."""
        payload_with_problem = {
            **sample_submission_payload,
            "problem": sample_problem_context
        }
        
        from app.cache.cache_key import build_cache_key
        
        key = build_cache_key("hint_compression_agent", {
            **payload_with_problem,
            "expected_approach": sample_problem_context.get("expected_approach", ""),
        })
        
        assert isinstance(key, str)


@pytest.mark.skipif(
    not _agent_exists("app.agents.pattern_detection_agent"),
    reason="pattern_detection_agent archived - not in production workflow"
)
class TestPatternDetectionAgent:
    """Tests for the pattern detection agent."""

    @patch("app.agents.pattern_detection_agent.run_json_agent")
    def test_pattern_detection_identifies_pattern(self, mock_run_json_agent, sample_submission_payload):
        """Test pattern detection identifies mistakes."""
        from app.agents.pattern_detection_agent import pattern_detection_agent
        from app.schemas.pattern import DetectedPattern
        
        mock_response = DetectedPattern(
            pattern="Brute force approach",
            confidence=0.85
        )
        mock_run_json_agent.return_value = mock_response
        
        result = pattern_detection_agent(
            context="Test context with brute force code",
            payload=sample_submission_payload
        )
        
        assert result.pattern == "Brute force approach"
        assert result.confidence == 0.85

    @patch("app.agents.pattern_detection_agent.run_json_agent")
    def test_pattern_detection_no_pattern(self, mock_run_json_agent, sample_submission_payload):
        """Test pattern detection when no pattern found."""
        from app.agents.pattern_detection_agent import pattern_detection_agent
        from app.schemas.pattern import DetectedPattern
        
        mock_response = DetectedPattern(pattern=None, confidence=0.0)
        mock_run_json_agent.return_value = mock_response
        
        result = pattern_detection_agent(
            context="Test context",
            payload=sample_submission_payload
        )
        
        assert result.pattern is None
        assert result.confidence == 0.0


class TestLearningAgent:
    """Tests for the learning recommendation agent."""

    @patch("app.agents.learning_agent.run_json_agent")
    def test_learning_agent_recommendations(self, mock_run_json_agent, sample_submission_payload, sample_user_profile):
        """Test learning recommendations generation."""
        from app.agents.learning_agent import learning_agent
        from app.schemas.learning import LearningRecommendation
        
        mock_response = LearningRecommendation(
            focus_areas=["Hash Table Techniques", "Array Optimization"],
            rationale="Your brute force approach suggests reviewing efficient lookup techniques."
        )
        mock_run_json_agent.return_value = mock_response
        
        payload = {**sample_submission_payload, "user_profile": sample_user_profile}
        
        result = learning_agent(
            context="Test context",
            payload=payload
        )
        
        assert len(result.focus_areas) > 0
        assert isinstance(result.rationale, str)


@pytest.mark.skipif(
    not _agent_exists("app.agents.difficulty_agent"),
    reason="difficulty_agent archived - not in production workflow"
)
class TestDifficultyAgent:
    """Tests for the difficulty adjustment agent."""

    @patch("app.agents.difficulty_agent.run_json_agent")
    def test_difficulty_maintain(self, mock_run_json_agent, sample_submission_payload):
        """Test difficulty maintenance decision."""
        from app.agents.difficulty_agent import difficulty_agent
        from app.schemas.difficulty import DifficultyAdjustment
        
        mock_response = DifficultyAdjustment(
            action="maintain",
            rationale="First attempt failure - give user another chance."
        )
        mock_run_json_agent.return_value = mock_response
        
        result = difficulty_agent(
            context="Test context",
            payload=sample_submission_payload
        )
        
        assert result.action == "maintain"

    @patch("app.agents.difficulty_agent.run_json_agent")
    def test_difficulty_decrease_on_struggle(self, mock_run_json_agent, sample_submission_payload, sample_user_profile):
        """Test difficulty decrease for struggling user."""
        from app.agents.difficulty_agent import difficulty_agent
        from app.schemas.difficulty import DifficultyAdjustment
        
        # Simulate struggling user
        struggling_profile = {**sample_user_profile, "success_rate": 0.2}
        
        mock_response = DifficultyAdjustment(
            action="decrease",
            rationale="User success rate is below 30%, suggesting easier problems."
        )
        mock_run_json_agent.return_value = mock_response
        
        payload = {**sample_submission_payload, "user_profile": struggling_profile}
        
        result = difficulty_agent(
            context="Test context",
            payload=payload
        )
        
        assert result.action == "decrease"


class TestReportAgent:
    """Tests for the weekly report agent."""

    @patch("app.agents.report_agent.run_json_agent")
    def test_weekly_report_generation(self, mock_run_json_agent, sample_submission_payload, sample_user_profile):
        """Test weekly report generation."""
        from app.agents.report_agent import report_agent
        from app.schemas.report import WeeklyProgressReport
        
        mock_response = WeeklyProgressReport(
            summary="Good progress this week with 65% success rate.",
            strengths=["Array manipulation", "String processing"],
            improvement_areas=["Dynamic Programming", "Binary Search"],
            recurring_patterns=["Off-by-one errors"]
        )
        mock_run_json_agent.return_value = mock_response
        
        payload = {**sample_submission_payload, "user_profile": sample_user_profile}
        
        result = report_agent(
            context="Test context",
            payload=payload
        )
        
        assert isinstance(result.summary, str)
        assert isinstance(result.strengths, list)
        assert isinstance(result.improvement_areas, list)


class TestBaseJsonAgent:
    """Tests for the base JSON agent."""

    def test_non_deterministic_agents_list(self):
        """Test that certain agents are marked as non-deterministic."""
        from app.agents.base_json_agent import NON_DETERMINISTIC_AGENTS
        
        assert "feedback_agent" in NON_DETERMINISTIC_AGENTS
        assert "hint_compression_agent" in NON_DETERMINISTIC_AGENTS

    @patch("app.agents.base_json_agent.redis_cache")
    @patch("app.agents.base_json_agent.get_llm")
    def test_run_json_agent_uses_redis_cache(self, mock_get_llm, mock_redis_cache):
        """Test that run_json_agent uses Redis caching."""
        from app.agents.base_json_agent import run_json_agent
        from pydantic import BaseModel
        
        class TestSchema(BaseModel):
            result: str
        
        # Configure mock to return cached value
        mock_redis_cache.enabled = True
        mock_redis_cache.get.return_value = {"result": "cached"}
        
        result = run_json_agent(
            context="test",
            cache_key="test_key",
            schema=TestSchema,
            system_prompt="test prompt",
            fallback=TestSchema(result="fallback"),
            agent_name="test_agent"
        )
        
        # Should use cached value
        mock_redis_cache.get.assert_called()
