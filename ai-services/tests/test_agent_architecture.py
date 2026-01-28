"""
Agent Architecture Tests
========================

Tests for the architecture upgrade ensuring agents:
1. Receive structured input via AgentInput
2. Use confidence-aware language
3. Use pattern-state-aware language
4. Handle missing RAG context gracefully
5. Never contradict MIM decisions

These tests validate the separation of concerns:
- MIM DECIDES
- Agents EXPLAIN
"""

import pytest
from typing import Dict, Any
from unittest.mock import MagicMock

from app.agents.agent_input import (
    AgentInput,
    AgentConfidenceInfo,
    AgentPatternInfo,
    AgentDifficultyInfo,
    AgentDiagnosisInfo,
    AgentRAGContext,
    build_agent_input,
)
from app.agents.feedback_agent import (
    get_confidence_language_guidance,
    get_pattern_language_guidance,
)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE LANGUAGE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceLanguageGuidance:
    """Test confidence-aware language guidance."""
    
    def test_high_confidence_direct_language(self):
        """HIGH confidence should use direct language."""
        guidance = get_confidence_language_guidance("high")
        
        assert "direct" in guidance.lower() or "confident" in guidance.lower()
        assert "DO NOT" in guidance  # Should warn against hedging
        assert "may" in guidance or "might" in guidance  # Words to avoid
    
    def test_medium_confidence_moderate_hedging(self):
        """MEDIUM confidence should use moderate hedging."""
        guidance = get_confidence_language_guidance("medium")
        
        assert "appears" in guidance.lower() or "likely" in guidance.lower() or "seems" in guidance.lower()
        assert "DO NOT be too certain" in guidance or "certain" in guidance.lower()
    
    def test_low_confidence_strong_hedging(self):
        """LOW confidence should use strong hedging."""
        guidance = get_confidence_language_guidance("low")
        
        assert "may be" in guidance.lower() or "possible" in guidance.lower()
        assert "uncertainty" in guidance.lower() or "certain" in guidance.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN LANGUAGE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatternLanguageGuidance:
    """Test pattern-state-aware language guidance."""
    
    def test_none_pattern_no_recurrence(self):
        """NONE pattern should not mention recurrence."""
        guidance = get_pattern_language_guidance("none", None, 0)
        
        assert "DO NOT" in guidance
        assert "recurring" in guidance.lower()
    
    def test_suspected_pattern_tentative(self):
        """SUSPECTED pattern should use tentative language."""
        guidance = get_pattern_language_guidance("suspected", "off_by_one", 2)
        
        assert "may be" in guidance.lower() or "could be" in guidance.lower()
        assert "off_by_one" in guidance
        assert "DO NOT say" in guidance  # Warn against certainty
    
    def test_confirmed_pattern_definite(self):
        """CONFIRMED pattern should use definite language."""
        guidance = get_pattern_language_guidance("confirmed", "off_by_one", 3)
        
        assert "confirmed" in guidance.lower()
        assert "off_by_one" in guidance
        assert "3 times" in guidance
    
    def test_stable_pattern_persistent(self):
        """STABLE pattern should mention persistence."""
        guidance = get_pattern_language_guidance("stable", "boundary_error", 5)
        
        assert "persistent" in guidance.lower() or "long-standing" in guidance.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT INPUT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAgentInput:
    """Test unified AgentInput schema."""
    
    @pytest.fixture
    def sample_diagnosis(self):
        return AgentDiagnosisInfo(
            root_cause="correctness",
            subtype="off_by_one",
            failure_mechanism="Loop boundary off by one",
            category="Array",
            difficulty="Medium",
            is_efficiency_issue=False,
        )
    
    @pytest.fixture
    def sample_confidence(self):
        return AgentConfidenceInfo(
            confidence_level="high",
            combined_confidence=0.85,
            conservative_mode=False,
            calibration_applied=True,
        )
    
    @pytest.fixture
    def sample_pattern(self):
        return AgentPatternInfo(
            pattern_state="confirmed",
            pattern_name="boundary_error",
            recurrence_count=3,
            evidence_strength={"weighted": 2.5},
            confidence_gated=False,
        )
    
    def test_confidence_info_certainty_prefix(self):
        """Confidence info should provide correct certainty prefix."""
        high = AgentConfidenceInfo("high", 0.85, False, True)
        medium = AgentConfidenceInfo("medium", 0.70, False, True)
        low = AgentConfidenceInfo("low", 0.50, True, True)
        
        assert high.get_certainty_prefix() == ""  # Direct
        assert "appears" in medium.get_certainty_prefix().lower()
        assert "may" in low.get_certainty_prefix().lower()
    
    def test_confidence_info_should_hedge(self):
        """should_hedge() returns correct value."""
        high = AgentConfidenceInfo("high", 0.85, False, True)
        medium = AgentConfidenceInfo("medium", 0.70, False, True)
        low = AgentConfidenceInfo("low", 0.50, True, True)
        
        assert high.should_hedge() is False
        assert medium.should_hedge() is True
        assert low.should_hedge() is True
    
    def test_pattern_info_recurrence_phrase(self):
        """Pattern info should provide correct recurrence phrase."""
        none_pattern = AgentPatternInfo("none", None, 0, None, False)
        suspected = AgentPatternInfo("suspected", "off_by_one", 2, None, False)
        confirmed = AgentPatternInfo("confirmed", "off_by_one", 3, None, False)
        gated = AgentPatternInfo("confirmed", "off_by_one", 3, None, True)  # Confidence gated
        
        assert none_pattern.get_recurrence_phrase() is None
        assert "may be" in suspected.get_recurrence_phrase().lower()
        assert "confirmed" in confirmed.get_recurrence_phrase().lower()
        assert gated.get_recurrence_phrase() is None  # Gated returns None
    
    def test_pattern_info_is_actionable(self):
        """is_actionable() returns True only for confirmed/stable."""
        none_pattern = AgentPatternInfo("none", None, 0, None, False)
        suspected = AgentPatternInfo("suspected", "test", 2, None, False)
        confirmed = AgentPatternInfo("confirmed", "test", 3, None, False)
        stable = AgentPatternInfo("stable", "test", 5, None, False)
        
        assert none_pattern.is_actionable() is False
        assert suspected.is_actionable() is False
        assert confirmed.is_actionable() is True
        assert stable.is_actionable() is True
    
    def test_difficulty_info_explanation(self):
        """Difficulty info should provide user-friendly explanations."""
        # Blocked by confidence gate
        conf_blocked = AgentDifficultyInfo(
            current_difficulty="Medium",
            action="maintain",
            next_difficulty="Medium",
            confidence=0.7,
            reason="Test",
            blocking_gate="confidence_gate",
        )
        assert "confidence" in conf_blocked.get_explanation().lower()
        
        # Blocked by pattern gate
        pattern_blocked = AgentDifficultyInfo(
            current_difficulty="Medium",
            action="maintain",
            next_difficulty="Medium",
            confidence=0.7,
            reason="Test",
            blocking_gate="pattern_state_gate",
        )
        assert "pattern" in pattern_blocked.get_explanation().lower()
        
        # Increase allowed
        increase = AgentDifficultyInfo(
            current_difficulty="Medium",
            action="increase",
            next_difficulty="Hard",
            confidence=0.9,
            reason="Test",
            blocking_gate=None,
        )
        assert "Hard" in increase.get_explanation()
    
    def test_rag_context_empty(self):
        """Empty RAG context should handle gracefully."""
        empty = AgentRAGContext.empty()
        
        assert empty.has_context is False
        assert empty.memories == []
        assert empty.get_memory_reference() is None
    
    def test_rag_context_with_memories(self):
        """RAG context with memories should provide reference."""
        with_memories = AgentRAGContext(
            has_context=True,
            memories=["Previous mistake: off by one in loop"],
            avg_relevance=0.75,
            query_used="off by one implementation",
        )
        
        assert with_memories.has_context is True
        reference = with_memories.get_memory_reference()
        assert reference is not None
        assert "history" in reference.lower()
    
    def test_agent_input_to_dict(self, sample_diagnosis, sample_confidence, sample_pattern):
        """AgentInput.to_dict() should include all key fields."""
        agent_input = AgentInput(
            user_id="test_user",
            problem_id="test_problem",
            submission_id="test_submission",
            diagnosis=sample_diagnosis,
            confidence=sample_confidence,
            pattern=sample_pattern,
        )
        
        d = agent_input.to_dict()
        
        assert d["user_id"] == "test_user"
        assert d["diagnosis"]["root_cause"] == "correctness"
        assert d["confidence"]["level"] == "high"
        assert d["pattern"]["state"] == "confirmed"


# ═══════════════════════════════════════════════════════════════════════════════
# BUILD AGENT INPUT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestBuildAgentInput:
    """Test building AgentInput from MIM output."""
    
    def test_build_from_correctness_feedback(self):
        """Build AgentInput from correctness feedback."""
        # Create mock MIM output
        mim_output = MagicMock()
        mim_output.user_id = "test_user"
        mim_output.problem_id = "test_problem"
        mim_output.submission_id = "test_submission"
        mim_output.feedback_type = "correctness"
        
        # Mock correctness feedback
        cf = MagicMock()
        cf.root_cause = "correctness"
        cf.subtype = "off_by_one"
        cf.failure_mechanism = "Loop boundary error"
        cf.category = "Array"
        cf.difficulty = "Medium"
        mim_output.correctness_feedback = cf
        mim_output.performance_feedback = None
        mim_output.reinforcement_feedback = None
        
        # Mock confidence metadata
        cm = MagicMock()
        cm.confidence_level = "high"
        cm.combined_confidence = 0.85
        cm.conservative_mode = False
        cm.calibration_applied = True
        mim_output.confidence_metadata = cm
        
        # Build
        agent_input = build_agent_input(mim_output)
        
        assert agent_input.user_id == "test_user"
        assert agent_input.diagnosis.root_cause == "correctness"
        assert agent_input.diagnosis.subtype == "off_by_one"
        assert agent_input.confidence.confidence_level == "high"
    
    def test_build_with_pattern_result(self):
        """Build AgentInput with pattern result."""
        mim_output = MagicMock()
        mim_output.user_id = "test_user"
        mim_output.problem_id = "test_problem"
        mim_output.submission_id = "test_submission"
        mim_output.feedback_type = "correctness"
        mim_output.correctness_feedback = MagicMock(
            root_cause="correctness",
            subtype="off_by_one",
            failure_mechanism="Test",
            category="Array",
            difficulty="Medium",
        )
        mim_output.performance_feedback = None
        mim_output.reinforcement_feedback = None
        mim_output.confidence_metadata = MagicMock(
            confidence_level="medium",
            combined_confidence=0.70,
            conservative_mode=False,
            calibration_applied=True,
        )
        
        # Mock pattern result
        pattern_result = MagicMock()
        pattern_result.pattern_state = "confirmed"
        pattern_result.pattern_name = "off_by_one"
        pattern_result.recurrence_count = 3
        pattern_result.evidence_strength = {"test": 1}
        pattern_result.confidence_gated = False
        
        agent_input = build_agent_input(mim_output, pattern_result=pattern_result)
        
        assert agent_input.pattern.pattern_state == "confirmed"
        assert agent_input.pattern.recurrence_count == 3
    
    def test_build_with_empty_rag(self):
        """Build AgentInput with no RAG memories."""
        mim_output = MagicMock()
        mim_output.user_id = "test_user"
        mim_output.problem_id = "test_problem"
        mim_output.submission_id = "test_submission"
        mim_output.feedback_type = "correctness"
        mim_output.correctness_feedback = MagicMock(
            root_cause="correctness",
            subtype="test",
            failure_mechanism="Test",
            category="Test",
            difficulty="Medium",
        )
        mim_output.performance_feedback = None
        mim_output.reinforcement_feedback = None
        mim_output.confidence_metadata = None
        
        agent_input = build_agent_input(mim_output, rag_memories=[])
        
        assert agent_input.rag_context.has_context is False
        assert agent_input.rag_context.get_memory_reference() is None


# ═══════════════════════════════════════════════════════════════════════════════
# SEPARATION OF CONCERNS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSeparationOfConcerns:
    """Test that architecture maintains proper separation."""
    
    def test_diagnosis_info_is_read_only(self):
        """Diagnosis info should be treated as facts (read-only)."""
        diagnosis = AgentDiagnosisInfo(
            root_cause="correctness",
            subtype="off_by_one",
            failure_mechanism="Test",
            category="Array",
            difficulty="Medium",
            is_efficiency_issue=False,
        )
        
        # User-friendly methods should not change underlying data
        friendly_cause = diagnosis.get_user_friendly_root_cause()
        assert diagnosis.root_cause == "correctness"  # Unchanged
        
        friendly_subtype = diagnosis.get_user_friendly_subtype()
        assert diagnosis.subtype == "off_by_one"  # Unchanged
    
    def test_difficulty_cannot_be_overridden(self):
        """Difficulty info explains, does not suggest alternatives."""
        diff = AgentDifficultyInfo(
            current_difficulty="Medium",
            action="maintain",
            next_difficulty="Medium",
            confidence=0.7,
            reason="Blocked by confidence gate",
            blocking_gate="confidence_gate",
        )
        
        # get_explanation should explain the decision, not suggest different
        explanation = diff.get_explanation()
        
        # Should NOT suggest increasing difficulty
        assert "increase" not in explanation.lower() or "ready" not in explanation.lower()
        # Should explain the hold
        assert "confidence" in explanation.lower() or "current" in explanation.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
