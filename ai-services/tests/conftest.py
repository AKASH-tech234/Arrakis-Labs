"""
Test Configuration and Fixtures
================================

Common fixtures and configuration for all tests.
"""

import pytest 
import os
from unittest.mock import MagicMock, patch
from typing import Dict, Any

# Set test environment variables before imports
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("GOOGLE_API_KEY", "test-api-key")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/test")


# ============================================================================
# SAMPLE DATA FIXTURES
# ============================================================================

@pytest.fixture
def sample_submission_payload() -> Dict[str, Any]:
    """Sample submission payload for testing."""
    return {
        "user_id": "test_user_123",
        "problem_id": "prob_001",
        "problem_category": "Array",
        "constraints": "1 <= n <= 10^4",
        "code": """
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
""",
        "language": "python",
        "verdict": "wrong_answer",
        "error_type": "Wrong Answer on test case 5",
        "user_history_summary": "User has solved 5 array problems. Common mistakes: off-by-one errors.",
    }


@pytest.fixture
def sample_accepted_submission() -> Dict[str, Any]:
    """Sample accepted submission for testing."""
    return {
        "user_id": "test_user_123",
        "problem_id": "prob_001",
        "problem_category": "Array",
        "constraints": "1 <= n <= 10^4",
        "code": """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
""",
        "language": "python",
        "verdict": "Accepted",
        "error_type": None,
        "user_history_summary": "User has solved 5 array problems. Showing good progress with hash tables.",
    }


@pytest.fixture
def sample_tle_submission() -> Dict[str, Any]:
    """Sample TLE submission for testing."""
    return {
        "user_id": "test_user_123",
        "problem_id": "prob_002",
        "problem_category": "Dynamic Programming",
        "constraints": "1 <= n <= 10^6",
        "code": """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
""",
        "language": "python",
        "verdict": "time_limit_exceeded",
        "error_type": "Time Limit Exceeded",
        "user_history_summary": "User struggles with DP optimization. Needs practice with memoization.",
    }


@pytest.fixture
def sample_problem_context() -> Dict[str, Any]:
    """Sample problem context for testing."""
    return {
        "problem_id": "prob_001",
        "title": "Two Sum",
        "statement": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        "constraints": "2 <= nums.length <= 10^4",
        "tags": ["Array", "Hash Table"],
        "difficulty": "Easy",
        "expected_approach": "Use a hash map to store complements for O(n) solution",
        "time_complexity_hint": "O(n)",
        "space_complexity_hint": "O(n)",
        "common_mistakes": ["Not handling duplicate values", "Off-by-one errors"],
    }


@pytest.fixture
def sample_user_profile() -> Dict[str, Any]:
    """Sample user profile for testing."""
    return {
        "user_id": "test_user_123",
        "common_mistakes": ["off-by-one", "edge case missing"],
        "weak_topics": ["Dynamic Programming", "Binary Search"],
        "recurring_patterns": ["boundary condition handling"],
        "total_submissions": 50,
        "success_rate": 0.65,
        "recent_categories": ["Array", "String", "DP"],
        "last_verdict": "Wrong Answer",
    }


@pytest.fixture
def sample_user_memory() -> list:
    """Sample RAG memory chunks for testing."""
    return [
        "[Array] Problem prob_001: User forgot to handle empty array edge case",
        "[Binary Search] Problem prob_002: Off-by-one error in boundary condition",
        "[DP] Problem prob_003: Wrong state transition in dynamic programming",
    ]


# ============================================================================
# MOCK FIXTURES
# ============================================================================

@pytest.fixture
def mock_redis_cache():
    """Mock Redis cache for testing."""
    with patch("app.cache.redis_cache.redis_cache") as mock:
        mock.enabled = True
        mock.get.return_value = None  # Default to cache miss
        mock.set.return_value = True
        yield mock


@pytest.fixture
def mock_llm():
    """Mock LLM for testing (avoids actual API calls)."""
    with patch("app.services.llm.get_llm") as mock:
        mock_llm_instance = MagicMock()
        mock.return_value = mock_llm_instance
        yield mock_llm_instance


@pytest.fixture
def mock_vector_store():
    """Mock vector store for testing."""
    with patch("app.rag.vector_store.user_memory_store") as mock:
        mock.similarity_search_with_relevance_scores.return_value = []
        mock.add_documents.return_value = None
        yield mock


@pytest.fixture
def mock_mongodb():
    """Mock MongoDB client for testing."""
    with patch("app.db.mongodb.mongo_client") as mock:
        mock.db = MagicMock()
        mock.get_user_submissions.return_value = []
        mock.get_user_profile_data.return_value = {}
        yield mock


# ============================================================================
# TEST UTILITIES
# ============================================================================

def assert_valid_feedback_response(response: Dict[str, Any]):
    """Assert that a feedback response has required fields."""
    assert "explanation" in response
    assert "improvement_hint" in response
    assert isinstance(response["explanation"], str)
    assert isinstance(response["improvement_hint"], str)


def assert_valid_hint_response(response: Dict[str, Any]):
    """Assert that a hint response has required fields."""
    assert "hint" in response
    assert isinstance(response["hint"], str)
    assert len(response["hint"]) <= 200  # Hints should be concise


def assert_valid_pattern_response(response: Dict[str, Any]):
    """Assert that a pattern detection response has required fields."""
    assert "pattern" in response or response.get("pattern") is None
    assert "confidence" in response
    assert 0.0 <= response["confidence"] <= 1.0
