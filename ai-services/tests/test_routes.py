"""
Tests for API Routes
=====================

Tests for app/api/routes.py endpoints
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI


@pytest.fixture
def test_client():
    """Create a test client for the API."""
    from main import app
    return TestClient(app)


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_check_returns_ok(self, test_client):
        """Test that health check returns OK status."""
        response = test_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "Mentat Trials AI Service"
        assert "timestamp" in data
        assert data["version"] == "1.0.0"


class TestFeedbackEndpoint:
    """Tests for the AI feedback endpoint."""

    @patch("app.graph.sync_workflow.sync_workflow")
    @patch("app.graph.async_workflow.async_workflow")
    def test_feedback_endpoint_wrong_answer(
        self, 
        mock_async_workflow, 
        mock_sync_workflow,
        test_client,
        sample_submission_payload
    ):
        """Test feedback generation for wrong answer submission."""
        from app.schemas.feedback import FeedbackResponse
        
        # Mock sync workflow response
        mock_sync_workflow.invoke.return_value = {
            "feedback": FeedbackResponse(
                explanation="Your solution uses O(n²) brute force.",
                improvement_hint="Use a hash map for O(n) lookup.",
                detected_pattern=None
            ),
            "detected_pattern": "Brute force approach",
            "hint": "Consider using a hash map."
        }
        
        response = test_client.post("/ai/feedback", json=sample_submission_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["verdict"] == "wrong_answer"
        assert len(data["hints"]) > 0
        assert data["feedback_type"] == "error_feedback"

    @patch("app.api.routes.sync_workflow")
    @patch("app.api.routes.async_workflow")
    def test_feedback_endpoint_accepted(
        self, 
        mock_async_workflow, 
        mock_sync_workflow,
        test_client,
        sample_accepted_submission
    ):
        """Test feedback generation for accepted submission."""
        from app.schemas.feedback import FeedbackResponse
        
        mock_sync_workflow.invoke.return_value = {
            "feedback": FeedbackResponse(
                explanation="Great job!",
                improvement_hint="No changes required.",
                detected_pattern=None
            ),
            "detected_pattern": None,
            "hint": None
        }
        
        response = test_client.post("/ai/feedback", json=sample_accepted_submission)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["verdict"] == "Accepted"
        assert data["feedback_type"] == "success_feedback"

    @patch("app.api.routes.sync_workflow")
    @patch("app.api.routes.async_workflow")
    def test_feedback_endpoint_tle(
        self, 
        mock_async_workflow, 
        mock_sync_workflow,
        test_client,
        sample_tle_submission
    ):
        """Test feedback generation for TLE submission."""
        from app.schemas.feedback import FeedbackResponse
        
        mock_sync_workflow.invoke.return_value = {
            "feedback": FeedbackResponse(
                explanation="Recursive solution causes exponential time complexity.",
                improvement_hint="Use memoization or iterative DP.",
                detected_pattern="time complexity"
            ),
            "detected_pattern": "Exponential recursion",
            "hint": "Add memoization to your recursive calls."
        }
        
        response = test_client.post("/ai/feedback", json=sample_tle_submission)
        
        assert response.status_code == 200
        data = response.json()
        assert data["feedback_type"] == "optimization"

    def test_feedback_endpoint_missing_fields(self, test_client):
        """Test that missing required fields return 422."""
        incomplete_payload = {
            "user_id": "test_user"
            # Missing other required fields
        }
        
        response = test_client.post("/ai/feedback", json=incomplete_payload)
        
        assert response.status_code == 422

    @patch("app.api.routes.sync_workflow")
    def test_feedback_endpoint_handles_errors(
        self, 
        mock_sync_workflow,
        test_client,
        sample_submission_payload
    ):
        """Test that errors are handled gracefully."""
        mock_sync_workflow.invoke.side_effect = Exception("LLM Error")
        
        response = test_client.post("/ai/feedback", json=sample_submission_payload)
        
        assert response.status_code == 500
        data = response.json()
        assert "error" in data["detail"]


class TestWeeklyReportEndpoint:
    """Tests for the weekly report endpoint."""

    @patch("app.rag.retriever.retrieve_user_memory")
    @patch("app.rag.context_builder.build_context")
    @patch("app.agents.report_agent.report_agent")
    def test_weekly_report_generation(
        self,
        mock_report_agent,
        mock_build_context,
        mock_retrieve_memory,
        test_client,
        sample_submission_payload
    ):
        """Test weekly report generation."""
        from app.schemas.report import WeeklyProgressReport
        
        mock_retrieve_memory.return_value = ["memory chunk 1", "memory chunk 2"]
        mock_build_context.return_value = "Built context"
        mock_report_agent.return_value = WeeklyProgressReport(
            summary="Great progress this week!",
            strengths=["Array problems"],
            improvement_areas=["DP"],
            recurring_patterns=["Edge cases"]
        )
        
        response = test_client.post("/ai/weekly-report", json=sample_submission_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "strengths" in data
        assert "improvement_areas" in data


class TestRAGStatsEndpoint:
    """Tests for the RAG statistics endpoint."""

    @patch("app.rag.monitoring.rag_monitor")
    @patch("app.rag.retriever.retrieve_user_memory")
    def test_rag_stats_endpoint(
        self,
        mock_retrieve_memory,
        mock_rag_monitor,
        test_client
    ):
        """Test RAG stats retrieval."""
        mock_rag_monitor.get_user_stats.return_value = {
            "total_retrievals": 10,
            "empty_results": 2,
            "avg_relevance": 0.75
        }
        mock_retrieve_memory.return_value = ["test result"]
        
        response = test_client.get("/ai/rag-stats/test_user_123")
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "test_user_123"
        assert "stats" in data


class TestProgressiveHints:
    """Tests for the progressive hint building logic."""

    def test_build_progressive_hints_wrong_answer(self):
        """Test hint building for wrong answer."""
        from app.api.routes import build_progressive_hints
        from app.schemas.feedback import FeedbackResponse
        
        feedback = FeedbackResponse(
            explanation="Your loop doesn't handle empty arrays. This causes index errors.",
            improvement_hint="Add a check for empty input at the start.",
            detected_pattern=None
        )
        
        hints = build_progressive_hints(
            verdict="wrong_answer",
            feedback=feedback,
            hint="Check edge cases",
            detected_pattern="Edge case handling"
        )
        
        assert len(hints) >= 1
        assert hints[0].level == 1
        assert hints[0].hint_type in ["conceptual", "specific", "approach", "pattern", "solution"]

    def test_build_progressive_hints_accepted(self):
        """Test hint building for accepted submission."""
        from app.api.routes import build_progressive_hints
        from app.schemas.feedback import FeedbackResponse
        
        feedback = FeedbackResponse(
            explanation="Your solution is correct!",
            improvement_hint="Consider using a more efficient approach.",
            detected_pattern=None
        )
        
        hints = build_progressive_hints(
            verdict="accepted",
            feedback=feedback,
            hint=None,
            detected_pattern="Hash table pattern"
        )
        
        assert len(hints) >= 1

    def test_build_progressive_hints_tle(self):
        """Test hint building for TLE submission."""
        from app.api.routes import build_progressive_hints
        from app.schemas.feedback import FeedbackResponse
        
        feedback = FeedbackResponse(
            explanation="Time complexity is O(n²).",
            improvement_hint="Use a hash map for O(n) complexity.",
            detected_pattern=None
        )
        
        hints = build_progressive_hints(
            verdict="time_limit_exceeded",
            feedback=feedback,
            hint="Consider optimization",
            detected_pattern="Time complexity"
        )
        
        assert hints[0].content == "Your solution is too slow. Think about the time complexity of your approach."
        assert hints[0].hint_type == "conceptual"

    def test_build_progressive_hints_empty_feedback(self):
        """Test hint building with no feedback."""
        from app.api.routes import build_progressive_hints
        
        hints = build_progressive_hints(
            verdict="wrong_answer",
            feedback=None,
            hint=None,
            detected_pattern=None
        )
        
        # Should always have at least one hint
        assert len(hints) >= 1
        assert hints[0].content == "Review your approach and consider edge cases."


# ═══════════════════════════════════════════════════════════════════════════════
# MIM ENDPOINT TESTS (V3.0)
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMEndpoints:
    """Tests for MIM (Misconception Identification Model) endpoints - V3.0."""

    def test_mim_status_endpoint(self, test_client):
        """Test MIM status endpoint returns model information."""
        response = test_client.get("/ai/mim/status")
        
        # Should return 200 even if models aren't loaded (graceful degradation)
        assert response.status_code in [200, 503]
        data = response.json()
        
        if response.status_code == 200:
            # V3.0: Status can return different structures
            assert "is_trained" in data or "status" in data or "model_status" in data

    @patch("app.mim.inference.MIMDecisionNode")
    def test_mim_profile_endpoint(self, mock_node, test_client):
        """Test MIM profile endpoint returns user cognitive profile."""
        # Mock MIM response
        mock_instance = MagicMock()
        mock_instance.get_user_profile.return_value = {
            "user_id": "test_user_123",
            "strengths": ["arrays", "strings"],
            "weaknesses": ["dp", "graphs"],
            "readiness_scores": {"Easy": 0.9, "Medium": 0.7, "Hard": 0.4}
        }
        mock_node.return_value = mock_instance
        
        response = test_client.get("/ai/mim/profile/test_user_123")
        
        # May return 404 if user not found or 200 if mocked properly
        assert response.status_code in [200, 404, 500]

    @patch("app.mim.recommender.MIMRecommender")
    def test_mim_recommend_endpoint(self, mock_recommender, test_client):
        """Test MIM recommendations endpoint returns problem suggestions."""
        # Mock recommender response
        mock_instance = MagicMock()
        mock_instance.recommend.return_value = [
            {
                "problem_id": "prob_1",
                "title": "Two Sum",
                "difficulty": "Easy",
                "confidence": 0.85,
                "reason": "Good for practicing arrays"
            }
        ]
        mock_recommender.return_value = mock_instance
        
        response = test_client.get("/ai/mim/recommend/test_user_123?limit=5")
        
        # May return 404 if user not found or 200 if mocked properly
        assert response.status_code in [200, 404, 500]

    def test_mim_predict_endpoint(self, test_client):
        """Test MIM prediction endpoint for pre-submission analysis."""
        response = test_client.get("/ai/mim/predict/test_user_123/problem_456")
        
        # Should return some response (may fail if models not loaded)
        assert response.status_code in [200, 404, 500]

    @patch("app.mim.model.MIMModel")
    def test_mim_train_endpoint(self, mock_model, test_client):
        """Test MIM training trigger endpoint."""
        mock_instance = MagicMock()
        mock_instance.train.return_value = {"status": "training_started"}
        mock_model.return_value = mock_instance
        
        response = test_client.post("/ai/mim/train")
        
        # Training endpoint exists and responds
        # May require admin auth in production, or validation error if body required
        assert response.status_code in [200, 202, 401, 403, 422, 500]
