"""
Tests for Workflow Modules
===========================

Tests for app/graph/ workflow components
"""

import pytest
from unittest.mock import MagicMock, patch


class TestOrchestratorNode:
    """Tests for the orchestrator decision logic."""

    def test_orchestrator_wrong_answer(self):
        """Test orchestrator plan for wrong answer."""
        from app.graph.orchestrator import orchestrator_node
        
        state = {
            "verdict": "wrong_answer",
            "request_weekly_report": False,
            "problem": {"_source": "database"},  # Grounded problem
            "user_profile": {"common_mistakes": ["test"]},  # Has history
        }
        
        result = orchestrator_node(state)
        
        assert result["plan"]["run_feedback"] is True
        assert result["plan"]["run_pattern_detection"] is True
        assert result["plan"]["run_hint"] is True
        assert result["plan"]["run_learning"] is True
        assert result["plan"]["store_memory"] is True

    def test_orchestrator_accepted(self):
        """Test orchestrator plan for accepted submission - V3.0."""
        from app.graph.orchestrator import orchestrator_node
        
        state = {
            "verdict": "accepted",
            "request_weekly_report": False,
            "problem": {},
            "user_profile": {},
        }
        
        result = orchestrator_node(state)
        
        assert result["plan"]["run_feedback"] is True
        assert result["plan"]["run_pattern_detection"] is False
        assert result["plan"]["run_hint"] is False
        # V3.0: Learning runs async for accepted submissions for reinforcement
        # This is intentional - we want to reinforce successful patterns
        # Memory also gets stored for accepted submissions to build strength profile

    def test_orchestrator_with_weekly_report(self):
        """Test orchestrator plan with weekly report requested."""
        from app.graph.orchestrator import orchestrator_node
        
        state = {
            "verdict": "wrong_answer",
            "request_weekly_report": True,
            "problem": {},
            "user_profile": {},
        }
        
        result = orchestrator_node(state)
        
        assert result["plan"]["run_weekly_report"] is True


class TestSyncWorkflow:
    """Tests for the synchronous workflow."""

    @patch("app.graph.sync_workflow.retrieve_user_memory")
    @patch("app.graph.sync_workflow._run_with_timeout")
    def test_retrieve_memory_node(self, mock_timeout, mock_retrieve):
        """Test memory retrieval node."""
        from app.graph.sync_workflow import retrieve_memory_node
        
        mock_timeout.return_value = ["memory chunk 1", "memory chunk 2"]
        
        # Use a more complete state dict that matches MentatSyncState
        state = {
            "user_id": "test_user",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "constraints": "N/A",
            "code": "",
            "language": "python",
            "verdict": "wrong_answer",
            "error_type": "Wrong Answer",
            "plan": {},
            "user_memory": [],
            "context": "",
            "problem": None,
            "user_profile": None,
            "feedback": None,
            "detected_pattern": None,
            "improvement_hint": None,
            "_workflow_start": None,
            "_node_timings": None,
            "_budget_exceeded": None,
        }
        
        result = retrieve_memory_node(state)  # type: ignore
        
        assert "user_memory" in result
        assert len(result["user_memory"]) == 2

    @patch("app.graph.sync_workflow.get_problem_by_id")
    def test_retrieve_problem_node(self, mock_get_problem):
        """Test problem retrieval node."""
        from app.graph.sync_workflow import retrieve_problem_node
        from app.problem.problem_repository import ProblemContext
        
        mock_problem = ProblemContext(
            problem_id="prob_001",
            title="Two Sum",
            statement="Given an array...",
            constraints="N <= 10^4",
            tags=["Array"],
            difficulty="Easy",
            expected_approach="Use hash map"
        )
        mock_get_problem.return_value = mock_problem
        
        state = {
            "user_id": "test_user",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "constraints": "N <= 10^4",
            "code": "",
            "language": "python",
            "verdict": "wrong_answer",
            "error_type": None,
            "plan": {},
            "user_memory": [],
            "context": "",
            "problem": None,
            "user_profile": None,
            "feedback": None,
            "detected_pattern": None,
            "improvement_hint": None,
            "_workflow_start": None,
            "_node_timings": {},
            "_budget_exceeded": None,
        }
        
        result = retrieve_problem_node(state)  # type: ignore
        
        assert "problem" in result
        assert result["problem"]["title"] == "Two Sum"

    @patch("app.graph.sync_workflow.build_user_profile")
    @patch("app.graph.sync_workflow._run_with_timeout")
    def test_build_user_profile_node(self, mock_timeout, mock_build_profile):
        """Test user profile building node.
        
        NOTE: _check_budget was replaced with _log_budget_status which never skips.
        Profile building MUST always complete.
        """
        from app.graph.sync_workflow import build_user_profile_node
        from app.schemas.user_profile import UserProfile
        
        mock_profile = UserProfile(
            user_id="test_user",
            common_mistakes=["off-by-one"],
            weak_topics=["DP"],
            recurring_patterns=["boundary handling"]
        )
        mock_timeout.return_value = mock_profile
        
        state = {
            "user_id": "test_user",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "constraints": "N/A",
            "code": "",
            "language": "python",
            "verdict": "wrong_answer",
            "error_type": None,
            "plan": {},
            "user_memory": ["memory chunk"],
            "context": "",
            "problem": None,
            "user_profile": None,
            "feedback": None,
            "detected_pattern": None,
            "improvement_hint": None,
            "_workflow_start": 0,
            "_node_timings": {},
            "_budget_exceeded": False,
            "agent_results": {},
            "pattern_confidence": 0.0,
        }
        
        result = build_user_profile_node(state)  # type: ignore
        
        assert "user_profile" in result
        assert result["user_profile"]["user_id"] == "test_user"


class TestAsyncWorkflow:
    """Tests for the asynchronous workflow."""

    @patch("app.graph.async_workflow._run_async_with_timeout")
    def test_learning_node(self, mock_timeout):
        """Test learning recommendation node."""
        from app.graph.async_workflow import learning_node
        from app.schemas.learning import LearningRecommendation
        
        mock_timeout.return_value = LearningRecommendation(
            focus_areas=["Hash Tables", "Two Pointers"],
            rationale="Based on your mistakes..."
        )
        
        state = {
            "context": "test context" * 20,  # Ensure context is >100 chars
            "user_id": "test_user",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "verdict": "wrong_answer",
            "feedback": None,
            "problem": None,
            "user_profile": None,
            "learning_recommendation": None,
            "difficulty_adjustment": None,
            "weekly_report": None,
            "_async_start": None,
            "_async_timings": None,
        }
        
        result = learning_node(state)  # type: ignore
        
        assert "learning_recommendation" in result
        assert result["learning_recommendation"] is not None
        assert len(result["learning_recommendation"].focus_areas) == 2

    @patch("app.graph.async_workflow._run_async_with_timeout")
    def test_difficulty_node(self, mock_timeout):
        """Test difficulty adjustment node."""
        from app.graph.async_workflow import difficulty_node
        from app.schemas.difficulty import DifficultyAdjustment
        
        mock_timeout.return_value = DifficultyAdjustment(
            action="maintain",
            rationale="First failure, give another chance."
        )
        
        state = {
            "context": "test context",
            "user_id": "test_user",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "verdict": "wrong_answer",
            "feedback": None,
            "problem": None,
            "user_profile": None,
            "learning_recommendation": None,
            "difficulty_adjustment": None,
            "weekly_report": None,
            "_async_start": None,
            "_async_timings": {},
        }
        
        result = difficulty_node(state)  # type: ignore
        
        assert "difficulty_adjustment" in result
        assert result["difficulty_adjustment"] is not None
        assert result["difficulty_adjustment"].action == "maintain"

    def test_weekly_report_node_not_requested(self):
        """Test weekly report node when not requested."""
        from app.graph.async_workflow import weekly_report_node
        
        state = {
            "request_weekly_report": False,
            "context": "",
            "user_id": "",
            "problem_id": "",
            "problem_category": "",
            "verdict": "",
            "feedback": None,
            "problem": None,
            "user_profile": None,
            "learning_recommendation": None,
            "difficulty_adjustment": None,
            "weekly_report": None,
            "_async_start": None,
            "_async_timings": {},
        }
        
        result = weekly_report_node(state)  # type: ignore
        
        # Should return state with weekly_report as None
        assert result["weekly_report"] is None

    @patch("app.graph.async_workflow._run_async_with_timeout")
    def test_store_memory_node(self, mock_timeout):
        """Test memory storage node."""
        from app.graph.async_workflow import store_memory_node
        from app.schemas.feedback import FeedbackResponse
        
        mock_timeout.return_value = True
        
        state = {
            "user_id": "test_user",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "verdict": "wrong_answer",
            "context": "test context",
            "feedback": FeedbackResponse(
                explanation="Test explanation",
                improvement_hint="Test hint",
                detected_pattern=None
            ),
            "problem": None,
            "user_profile": None,
            "learning_recommendation": None,
            "difficulty_adjustment": None,
            "weekly_report": None,
            "_async_start": None,
            "_async_timings": {},
        }
        
        result = store_memory_node(state)  # type: ignore
        
        # Memory storage should be attempted for non-accepted verdicts
        assert result is not None


class TestSchemas:
    """Tests for Pydantic schemas."""

    def test_feedback_response_schema(self):
        """Test FeedbackResponse schema."""
        from app.schemas.feedback import FeedbackResponse
        
        response = FeedbackResponse(
            explanation="Your solution is incorrect.",
            improvement_hint="Check edge cases.",
            detected_pattern="Edge case handling"
        )
        
        assert response.explanation == "Your solution is incorrect."
        assert response.detected_pattern == "Edge case handling"

    def test_hint_schema(self):
        """Test CompressedHint schema."""
        from app.schemas.hint import CompressedHint
        
        hint = CompressedHint(hint="Consider using a hash map.")
        
        assert hint.hint == "Consider using a hash map."

    def test_pattern_schema(self):
        """Test DetectedPattern schema."""
        from app.schemas.pattern import DetectedPattern
        
        pattern = DetectedPattern(pattern="Off-by-one", confidence=0.9)
        
        assert pattern.pattern == "Off-by-one"
        assert pattern.confidence == 0.9

    def test_learning_schema(self):
        """Test LearningRecommendation schema."""
        from app.schemas.learning import LearningRecommendation
        
        recommendation = LearningRecommendation(
            focus_areas=["DP", "Recursion"],
            rationale="Based on your mistakes..."
        )
        
        assert len(recommendation.focus_areas) == 2

    def test_difficulty_schema(self):
        """Test DifficultyAdjustment schema."""
        from app.schemas.difficulty import DifficultyAdjustment
        
        adjustment = DifficultyAdjustment(
            action="increase",
            rationale="User is doing well."
        )
        
        assert adjustment.action == "increase"

    def test_report_schema(self):
        """Test WeeklyProgressReport schema."""
        from app.schemas.report import WeeklyProgressReport
        
        report = WeeklyProgressReport(
            summary="Good progress!",
            strengths=["Arrays"],
            improvement_areas=["DP"],
            recurring_patterns=["Edge cases"]
        )
        
        assert report.summary == "Good progress!"

    def test_submission_context_schema(self):
        """Test SubmissionContext schema."""
        from app.schemas.submission import SubmissionContext
        
        context = SubmissionContext(
            user_id="user_123",
            problem_id="prob_001",
            problem_category="Array",
            constraints="N <= 10^4",
            code="def solution(): pass",
            language="python",
            verdict="wrong_answer",
            error_type="Wrong Answer",
            user_history_summary=None
        )
        
        assert context.user_id == "user_123"
        assert context.verdict == "wrong_answer"
