"""
Tests for Problem Repository
=============================

Tests for app/problem/problem_repository.py
"""

import pytest
from unittest.mock import patch, MagicMock


class TestProblemContext:
    """Tests for ProblemContext schema."""

    def test_problem_context_creation(self):
        """Test creating a valid ProblemContext."""
        from app.problem.problem_repository import ProblemContext
        
        context = ProblemContext(
            problem_id="prob_001",
            title="Two Sum",
            statement="Given an array...",
            constraints="2 <= n <= 10^4",
            tags=["Array", "Hash Table"],
            difficulty="Easy",
            expected_approach="Use hash map",
            common_mistakes=["Off-by-one errors"]
        )
        
        assert context.problem_id == "prob_001"
        assert context.difficulty == "Easy"
        assert "Array" in context.tags

    def test_problem_context_defaults(self):
        """Test ProblemContext with default values."""
        from app.problem.problem_repository import ProblemContext
        
        context = ProblemContext(
            problem_id="prob_001",
            title="Test",
            statement="Test statement",
            constraints="N/A",
            tags=[],
            difficulty="Medium",
            expected_approach="N/A"
        )
        
        assert context.time_complexity_hint is None
        assert context.space_complexity_hint is None
        assert context.common_mistakes == []


class TestApproachInference:
    """Tests for approach inference from tags."""

    def test_infer_approach_array(self):
        """Test approach inference for array problems."""
        from app.problem.problem_repository import _infer_approach
        
        approach = _infer_approach(["Array"], "Easy")
        
        assert "pointer" in approach.lower() or "hash" in approach.lower()

    def test_infer_approach_dp(self):
        """Test approach inference for DP problems."""
        from app.problem.problem_repository import _infer_approach
        
        approach = _infer_approach(["Dynamic Programming"], "Medium")
        
        assert "subproblem" in approach.lower()

    def test_infer_approach_binary_search(self):
        """Test approach inference for binary search problems."""
        from app.problem.problem_repository import _infer_approach
        
        approach = _infer_approach(["Binary Search"], "Medium")
        
        assert "binary search" in approach.lower()

    def test_infer_approach_unknown_tag(self):
        """Test approach inference for unknown tags."""
        from app.problem.problem_repository import _infer_approach
        
        approach = _infer_approach(["Unknown Tag"], "Easy")
        
        assert "brute force" in approach.lower()

    def test_infer_approach_hard_difficulty(self):
        """Test approach inference for hard problems."""
        from app.problem.problem_repository import _infer_approach
        
        approach = _infer_approach([], "Hard")
        
        assert "advanced" in approach.lower()


class TestCommonMistakes:
    """Tests for common mistakes by tag."""

    def test_get_common_mistakes_array(self):
        """Test common mistakes for array problems."""
        from app.problem.problem_repository import _get_common_mistakes
        
        mistakes = _get_common_mistakes(["Array"])
        
        assert len(mistakes) > 0
        assert any("off-by-one" in m.lower() or "index" in m.lower() for m in mistakes)

    def test_get_common_mistakes_binary_search(self):
        """Test common mistakes for binary search problems."""
        from app.problem.problem_repository import _get_common_mistakes
        
        mistakes = _get_common_mistakes(["Binary Search"])
        
        assert len(mistakes) > 0

    def test_get_common_mistakes_multiple_tags(self):
        """Test common mistakes for multiple tags."""
        from app.problem.problem_repository import _get_common_mistakes
        
        mistakes = _get_common_mistakes(["Array", "Binary Search"])
        
        # Should combine mistakes from both tags (deduplicated)
        assert len(mistakes) <= 5  # Limited to 5

    def test_get_common_mistakes_unknown_tag(self):
        """Test common mistakes for unknown tag."""
        from app.problem.problem_repository import _get_common_mistakes
        
        mistakes = _get_common_mistakes(["Unknown"])
        
        assert mistakes == []


class TestGetProblemById:
    """Tests for the main get_problem_by_id function."""

    @patch("app.problem.problem_repository._cached_get_problem")
    def test_get_problem_from_cache(self, mock_cached_get):
        """Test getting problem from cache."""
        from app.problem.problem_repository import get_problem_by_id
        
        mock_cached_get.return_value = {
            "title": "Two Sum",
            "description": "Given an array...",
            "constraints": "2 <= n <= 10^4",
            "tags": ["Array", "Hash Table"],
            "difficulty": "Easy"
        }
        
        result = get_problem_by_id("prob_001")
        
        assert result.problem_id == "prob_001"
        assert result.title == "Two Sum"
        assert result.difficulty == "Easy"

    @patch("app.problem.problem_repository._cached_get_problem")
    def test_get_problem_fallback(self, mock_cached_get):
        """Test fallback when problem not found."""
        from app.problem.problem_repository import get_problem_by_id
        
        mock_cached_get.return_value = None
        
        result = get_problem_by_id(
            "prob_unknown",
            category="Array",
            constraints="N <= 1000"
        )
        
        assert result.problem_id == "prob_unknown"
        assert "Array" in result.tags
        assert result.constraints == "N <= 1000"

    @patch("app.problem.problem_repository._cached_get_problem")
    def test_get_problem_with_string_tags(self, mock_cached_get):
        """Test handling of comma-separated tags."""
        from app.problem.problem_repository import get_problem_by_id
        
        mock_cached_get.return_value = {
            "title": "Test",
            "description": "Test",
            "constraints": "N/A",
            "tags": "Array, Hash Table, Two Pointers",  # String instead of list
            "difficulty": "Medium"
        }
        
        result = get_problem_by_id("prob_001")
        
        assert isinstance(result.tags, list)
        assert len(result.tags) == 3


class TestTruncateStatement:
    """Tests for statement truncation."""

    def test_truncate_short_statement(self):
        """Test that short statements are not truncated."""
        from app.problem.problem_repository import _truncate_statement
        
        statement = "This is a short statement."
        result = _truncate_statement(statement, max_length=500)
        
        assert result == statement

    def test_truncate_long_statement(self):
        """Test that long statements are truncated."""
        from app.problem.problem_repository import _truncate_statement
        
        statement = "This is a very long statement. " * 100
        result = _truncate_statement(statement, max_length=100)
        
        assert len(result) <= 103  # 100 + "..."
        assert result.endswith("...")

    def test_truncate_empty_statement(self):
        """Test handling of empty statement."""
        from app.problem.problem_repository import _truncate_statement
        
        result = _truncate_statement("", max_length=500)
        
        assert "not available" in result.lower()
