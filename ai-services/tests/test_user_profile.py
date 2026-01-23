"""
Tests for User Profile Builder
===============================

Tests for app/user_profile/profile_builder.py
"""

import pytest


class TestMistakeDerivation:
    """Tests for mistake pattern extraction."""

    def test_derive_mistakes_empty_text(self):
        """Test with empty memory text."""
        from app.user_profile.profile_builder import derive_mistakes_from_memory
        
        result = derive_mistakes_from_memory("")
        
        assert result == []

    def test_derive_mistakes_off_by_one(self):
        """Test detection of off-by-one errors."""
        from app.user_profile.profile_builder import derive_mistakes_from_memory
        
        memory = "User had an off by one error in the loop boundary"
        result = derive_mistakes_from_memory(memory)
        
        assert "off-by-one" in result

    def test_derive_mistakes_empty_input(self):
        """Test detection of empty input handling issues."""
        from app.user_profile.profile_builder import derive_mistakes_from_memory
        
        memory = "Solution failed to handle empty array edge case"
        result = derive_mistakes_from_memory(memory)
        
        assert "empty input handling" in result

    def test_derive_mistakes_time_complexity(self):
        """Test detection of time complexity issues."""
        from app.user_profile.profile_builder import derive_mistakes_from_memory
        
        memory = "Solution got TLE due to O(n^2) brute force approach"
        result = derive_mistakes_from_memory(memory)
        
        assert "time complexity" in result

    def test_derive_mistakes_multiple(self):
        """Test detection of multiple mistake types."""
        from app.user_profile.profile_builder import derive_mistakes_from_memory
        
        memory = """
        User had off by one error in boundary check.
        Also forgot to handle empty array case.
        Solution was too slow due to brute force.
        """
        result = derive_mistakes_from_memory(memory)
        
        assert len(result) >= 2


class TestWeakTopicsDerivation:
    """Tests for weak topic extraction."""

    def test_derive_weak_topics_empty_text(self):
        """Test with empty memory text."""
        from app.user_profile.profile_builder import derive_weak_topics_from_memory
        
        result = derive_weak_topics_from_memory("")
        
        assert result == []

    def test_derive_weak_topics_dp(self):
        """Test detection of DP weakness."""
        from app.user_profile.profile_builder import derive_weak_topics_from_memory
        
        memory = "User struggled with dynamic programming, wrong state transition"
        result = derive_weak_topics_from_memory(memory)
        
        assert "Dynamic Programming" in result

    def test_derive_weak_topics_binary_search(self):
        """Test detection of binary search weakness."""
        from app.user_profile.profile_builder import derive_weak_topics_from_memory
        
        memory = "Binary search implementation was incorrect, wrong boundary"
        result = derive_weak_topics_from_memory(memory)
        
        assert "Binary Search" in result

    def test_derive_weak_topics_no_negatives(self):
        """Test that positive mentions don't create weak topics."""
        from app.user_profile.profile_builder import derive_weak_topics_from_memory
        
        # No negative indicators
        memory = "User solved the binary search problem correctly"
        result = derive_weak_topics_from_memory(memory)
        
        # Should not mark as weak without negative indicators
        # (The implementation checks for negative indicators)
        assert len(result) == 0 or "Binary Search" not in result


class TestRecurringPatterns:
    """Tests for recurring pattern extraction."""

    def test_extract_recurring_patterns_empty(self):
        """Test with empty memory text."""
        from app.user_profile.profile_builder import extract_recurring_patterns
        
        result = extract_recurring_patterns("")
        
        assert result == []

    def test_extract_recurring_patterns_boundary(self):
        """Test detection of boundary condition patterns."""
        from app.user_profile.profile_builder import extract_recurring_patterns
        
        memory = "User keeps having issues with boundary and edge cases"
        result = extract_recurring_patterns(memory)
        
        assert "boundary condition handling" in result

    def test_extract_recurring_patterns_input_validation(self):
        """Test detection of input validation patterns."""
        from app.user_profile.profile_builder import extract_recurring_patterns
        
        memory = "User forgot to validate input and check for null values"
        result = extract_recurring_patterns(memory)
        
        assert "input validation" in result


class TestRecentCategories:
    """Tests for recent category extraction."""

    def test_extract_recent_categories_empty(self):
        """Test with empty memory text."""
        from app.user_profile.profile_builder import extract_recent_categories
        
        result = extract_recent_categories("")
        
        assert result == []

    def test_extract_recent_categories_array(self):
        """Test detection of array category."""
        from app.user_profile.profile_builder import extract_recent_categories
        
        memory = "User was working on array manipulation problems"
        result = extract_recent_categories(memory)
        
        assert "Array" in result

    def test_extract_recent_categories_multiple(self):
        """Test detection of multiple categories."""
        from app.user_profile.profile_builder import extract_recent_categories
        
        memory = """
        User worked on array problems, string problems,
        and binary search problems this week.
        """
        result = extract_recent_categories(memory)
        
        assert len(result) >= 2
        assert len(result) <= 5  # Max 5 categories

    def test_extract_recent_categories_limit(self):
        """Test that categories are limited to 5."""
        from app.user_profile.profile_builder import extract_recent_categories
        
        memory = """
        array string binary search graph tree linked list
        dynamic programming dp stack queue heap hash greedy
        """
        result = extract_recent_categories(memory)
        
        assert len(result) <= 5


class TestBuildUserProfile:
    """Tests for the main profile building function."""

    def test_build_user_profile_basic(self):
        """Test basic profile building."""
        from app.user_profile.profile_builder import build_user_profile
        
        profile = build_user_profile(
            user_id="test_user",
            memory_text="User had off by one error in array problem",
            last_verdict="Wrong Answer"
        )
        
        assert profile.user_id == "test_user"
        assert profile.last_verdict == "Wrong Answer"
        assert isinstance(profile.common_mistakes, list)
        assert isinstance(profile.weak_topics, list)

    def test_build_user_profile_with_stats(self):
        """Test profile building with submission stats."""
        from app.user_profile.profile_builder import build_user_profile
        
        profile = build_user_profile(
            user_id="test_user",
            memory_text="User struggled with DP problems",
            submission_stats={
                "total_submissions": 50,
                "success_rate": 0.65
            },
            last_verdict="Accepted"
        )
        
        assert profile.total_submissions == 50
        assert profile.success_rate == 0.65

    def test_build_user_profile_empty_memory(self):
        """Test profile building with no memory."""
        from app.user_profile.profile_builder import build_user_profile
        
        profile = build_user_profile(
            user_id="new_user",
            memory_text="",
            last_verdict=None
        )
        
        assert profile.user_id == "new_user"
        assert profile.common_mistakes == []
        assert profile.weak_topics == []


class TestFormatProfileForPrompt:
    """Tests for profile prompt formatting."""

    def test_format_profile_full(self):
        """Test formatting a full profile."""
        from app.user_profile.profile_builder import format_profile_for_prompt, build_user_profile
        
        profile = build_user_profile(
            user_id="test_user",
            memory_text="User had off by one errors and struggled with DP",
            submission_stats={"total_submissions": 30, "success_rate": 0.6},
            last_verdict="Wrong Answer"
        )
        
        formatted = format_profile_for_prompt(profile)
        
        assert isinstance(formatted, str)
        assert len(formatted) > 0

    def test_format_profile_empty(self):
        """Test formatting an empty profile."""
        from app.user_profile.profile_builder import format_profile_for_prompt, build_user_profile
        
        profile = build_user_profile(
            user_id="new_user",
            memory_text=""
        )
        
        formatted = format_profile_for_prompt(profile)
        
        assert "No historical data" in formatted
