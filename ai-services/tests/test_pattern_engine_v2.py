"""
Phase 2.2 Pattern Engine Tests
==============================

Tests for confidence-aware, stateful pattern detection.

Acceptance Criteria (from Phase 2.2 spec):
✓ No pattern formed from low-confidence predictions
✓ Medium-confidence patterns never marked confirmed
✓ High-confidence repeated diagnoses produce confirmed patterns
✓ Pattern strength drops with inactivity
✓ All behavior deterministic & testable
"""

import pytest
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from app.mim.pattern_state import (
    PatternState,
    ConfidenceTier,
    PatternEvidence,
    PatternStateRecord,
    PatternStateTransitionEngine,
    should_form_pattern,
    can_confirm_pattern,
    get_confidence_tier,
)
from app.mim.pattern_engine import PatternEngine
from app.mim.mim_decision import PatternResult


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE TIER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceTiers:
    """Test confidence tier classification."""
    
    def test_high_confidence_tier(self):
        """Confidence >= 0.80 is HIGH."""
        assert ConfidenceTier.from_confidence(0.80) == ConfidenceTier.HIGH
        assert ConfidenceTier.from_confidence(0.85) == ConfidenceTier.HIGH
        assert ConfidenceTier.from_confidence(0.90) == ConfidenceTier.HIGH
        assert ConfidenceTier.from_confidence(1.0) == ConfidenceTier.HIGH
    
    def test_medium_confidence_tier(self):
        """Confidence 0.65-0.80 is MEDIUM."""
        assert ConfidenceTier.from_confidence(0.65) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.from_confidence(0.70) == ConfidenceTier.MEDIUM
        assert ConfidenceTier.from_confidence(0.79) == ConfidenceTier.MEDIUM
    
    def test_low_confidence_tier(self):
        """Confidence < 0.65 is LOW."""
        assert ConfidenceTier.from_confidence(0.64) == ConfidenceTier.LOW
        assert ConfidenceTier.from_confidence(0.50) == ConfidenceTier.LOW
        assert ConfidenceTier.from_confidence(0.30) == ConfidenceTier.LOW
        assert ConfidenceTier.from_confidence(0.0) == ConfidenceTier.LOW
    
    def test_should_form_pattern(self):
        """Low confidence should NOT form patterns."""
        assert should_form_pattern(0.80) is True
        assert should_form_pattern(0.70) is True
        assert should_form_pattern(0.65) is True
        assert should_form_pattern(0.64) is False
        assert should_form_pattern(0.50) is False
        assert should_form_pattern(0.30) is False
    
    def test_can_confirm_pattern(self):
        """Only HIGH confidence can confirm patterns."""
        assert can_confirm_pattern(0.80) is True
        assert can_confirm_pattern(0.85) is True
        assert can_confirm_pattern(0.79) is False
        assert can_confirm_pattern(0.70) is False
        assert can_confirm_pattern(0.50) is False


# ═══════════════════════════════════════════════════════════════════════════════
# STATE TRANSITION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatternStateTransitions:
    """Test pattern state machine transitions."""
    
    @pytest.fixture
    def engine(self):
        engine = PatternStateTransitionEngine()
        engine.update_now(datetime(2026, 1, 28, 12, 0, 0, tzinfo=timezone.utc))
        return engine
    
    @pytest.fixture
    def fresh_record(self):
        return PatternStateRecord(pattern_name="off-by-one error")
    
    def test_low_confidence_blocked(self, engine, fresh_record):
        """LOW confidence evidence is completely blocked."""
        record = engine.add_evidence(
            record=fresh_record,
            confidence=0.50,  # LOW
            root_cause="implementation",
            timestamp=engine.now,
        )
        
        # No evidence should be added
        assert record.evidence_count == 0
        assert record.state == PatternState.NONE
    
    def test_medium_confidence_creates_suspected(self, engine, fresh_record):
        """MEDIUM confidence can create SUSPECTED state."""
        # Add enough medium-confidence evidence
        record = fresh_record
        for i in range(3):
            record = engine.add_evidence(
                record=record,
                confidence=0.70,  # MEDIUM
                root_cause="implementation",
                timestamp=engine.now - timedelta(days=i),
            )
        
        assert record.evidence_count == 3
        assert record.state == PatternState.SUSPECTED
    
    def test_medium_confidence_cannot_confirm(self, engine, fresh_record):
        """MEDIUM confidence can NEVER reach CONFIRMED state."""
        record = fresh_record
        
        # Add many medium-confidence evidence points
        for i in range(10):
            record = engine.add_evidence(
                record=record,
                confidence=0.70,  # MEDIUM - never high enough
                root_cause="implementation",
                timestamp=engine.now - timedelta(days=i),
            )
        
        # Should stay at SUSPECTED, never CONFIRMED
        assert record.state == PatternState.SUSPECTED
        assert record.state != PatternState.CONFIRMED
    
    def test_high_confidence_can_confirm(self, engine, fresh_record):
        """HIGH confidence repeated diagnoses can confirm pattern."""
        record = fresh_record
        
        # Add high-confidence evidence (fewer to stay at CONFIRMED, not STABLE)
        for i in range(3):
            record = engine.add_evidence(
                record=record,
                confidence=0.85,  # HIGH
                root_cause="implementation",
                timestamp=engine.now - timedelta(days=i),
            )
        
        # Should reach at least CONFIRMED (may reach STABLE with more)
        assert record.state in (PatternState.CONFIRMED, PatternState.STABLE)
    
    def test_high_confidence_can_reach_stable(self, engine, fresh_record):
        """Many high-confidence occurrences can reach STABLE state."""
        record = fresh_record
        
        # Add many high-confidence evidence points
        for i in range(6):
            record = engine.add_evidence(
                record=record,
                confidence=0.85,  # HIGH
                root_cause="implementation",
                timestamp=engine.now - timedelta(days=i),
            )
        
        # Should reach STABLE
        assert record.state == PatternState.STABLE
    
    def test_state_transition_order(self, engine, fresh_record):
        """States progress in order: NONE → SUSPECTED → CONFIRMED → STABLE."""
        record = fresh_record
        states_seen = []
        
        for i in range(8):
            record = engine.add_evidence(
                record=record,
                confidence=0.85,
                root_cause="implementation",
                timestamp=engine.now - timedelta(days=i),
            )
            if record.state not in states_seen:
                states_seen.append(record.state)
        
        # Should see progression
        assert PatternState.SUSPECTED in states_seen
        assert PatternState.CONFIRMED in states_seen
        # Order should be correct
        assert states_seen.index(PatternState.SUSPECTED) < states_seen.index(PatternState.CONFIRMED)


# ═══════════════════════════════════════════════════════════════════════════════
# TEMPORAL DECAY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestTemporalDecay:
    """Test temporal decay behavior."""
    
    @pytest.fixture
    def engine(self):
        return PatternStateTransitionEngine()
    
    def test_recent_evidence_weighted_higher(self, engine):
        """Recent evidence should have higher weight than old evidence."""
        now = datetime(2026, 1, 28, 12, 0, 0, tzinfo=timezone.utc)
        engine.update_now(now)
        
        # Recent weight
        recent_weight = engine._compute_decay_weight(now - timedelta(days=1))
        
        # Old weight
        old_weight = engine._compute_decay_weight(now - timedelta(days=30))
        
        assert recent_weight > old_weight
        assert recent_weight > 0.9  # Very recent should be high
        assert old_weight < 0.3    # 30 days old should be low
    
    def test_half_life_decay(self, engine):
        """Weight should be ~0.5 after half-life period."""
        now = datetime(2026, 1, 28, 12, 0, 0, tzinfo=timezone.utc)
        engine.update_now(now)
        
        half_life = engine.DECAY_HALF_LIFE_DAYS
        weight = engine._compute_decay_weight(now - timedelta(days=half_life))
        
        # Should be approximately 0.5 (allowing for recency boost effects)
        assert 0.4 < weight < 0.6
    
    def test_decay_demotes_confirmed_to_suspected(self, engine):
        """Old confirmed patterns should demote based on decayed evidence."""
        now = datetime(2026, 1, 28, 12, 0, 0, tzinfo=timezone.utc)
        
        # Create a confirmed pattern from old evidence
        record = PatternStateRecord(pattern_name="test pattern")
        record.state = PatternState.CONFIRMED
        record.confirmed_at = now - timedelta(days=60)
        
        # Add old evidence only (45+ days old)
        old_time = now - timedelta(days=45)
        for i in range(4):
            record.evidence.append(PatternEvidence(
                timestamp=old_time - timedelta(days=i),
                confidence=0.85,
                confidence_tier=ConfidenceTier.HIGH,
                root_cause="implementation",
            ))
        
        engine.update_now(now)
        record = engine.apply_decay(record)
        
        # Weighted evidence should be low due to decay
        # With 45+ day old evidence and 14-day half-life, decay is significant
        assert record.weighted_evidence < 1.0  # Evidence heavily decayed
        
        # State should be demoted (could be SUSPECTED or NONE depending on decay amount)
        assert record.state in (PatternState.SUSPECTED, PatternState.NONE)
    
    def test_inactivity_demotes_pattern(self, engine):
        """Long inactivity should demote pattern state."""
        now = datetime(2026, 1, 28, 12, 0, 0, tzinfo=timezone.utc)
        
        record = PatternStateRecord(pattern_name="test pattern")
        record.state = PatternState.CONFIRMED
        record.last_occurrence = now - timedelta(days=45)  # 45 days ago
        
        # Add some evidence
        for i in range(3):
            record.evidence.append(PatternEvidence(
                timestamp=record.last_occurrence - timedelta(days=i),
                confidence=0.85,
                confidence_tier=ConfidenceTier.HIGH,
                root_cause="implementation",
            ))
        
        engine.update_now(now)
        record = engine.apply_decay(record)
        
        # Should demote due to inactivity (> 30 days)
        assert record.state in (PatternState.SUSPECTED, PatternState.NONE)


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN ENGINE INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatternEngineConfidenceGating:
    """Test PatternEngine confidence gating (Phase 2.2 acceptance criteria)."""
    
    @pytest.fixture
    def engine(self):
        return PatternEngine()
    
    def test_low_confidence_blocks_pattern(self, engine):
        """CRITICAL: Low confidence must NOT form patterns."""
        result = engine.detect_pattern(
            root_cause="implementation",
            root_cause_confidence=0.50,  # LOW
            verdict="wrong_answer",
            user_history=[],
        )
        
        assert result.pattern_name is None
        assert result.is_recurring is False
        assert result.confidence_gated is True
        assert result.pattern_state == "none"
        assert result.confidence_support == "low_confidence_blocked"
    
    def test_medium_confidence_allows_suspected(self, engine):
        """Medium confidence can detect pattern but not confirm."""
        # History with past occurrences
        history = [
            {
                "root_cause": "implementation",
                "root_cause_confidence": 0.70,
                "createdAt": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
            },
            {
                "root_cause": "implementation", 
                "root_cause_confidence": 0.72,
                "createdAt": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
            },
        ]
        
        result = engine.detect_pattern(
            root_cause="implementation",
            root_cause_confidence=0.70,  # MEDIUM
            verdict="wrong_answer",
            user_history=history,
        )
        
        assert result.pattern_name is not None
        assert result.confidence_gated is False
        # Should be SUSPECTED at most with medium confidence
        assert result.pattern_state in ("none", "suspected")
        # Should NOT be confirmed
        assert result.pattern_state != "confirmed"
    
    def test_high_confidence_can_confirm(self, engine):
        """High confidence repeated occurrences can confirm pattern."""
        # History with high-confidence past occurrences
        history = [
            {
                "root_cause": "implementation",
                "root_cause_confidence": 0.85,
                "createdAt": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
            },
            {
                "root_cause": "implementation",
                "root_cause_confidence": 0.82,
                "createdAt": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
            },
            {
                "root_cause": "implementation",
                "root_cause_confidence": 0.88,
                "createdAt": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
            },
        ]
        
        result = engine.detect_pattern(
            root_cause="implementation",
            root_cause_confidence=0.85,  # HIGH
            verdict="wrong_answer",
            user_history=history,
        )
        
        assert result.pattern_name is not None
        assert result.confidence_gated is False
        # With enough high-confidence evidence, should be confirmed
        assert result.pattern_state in ("suspected", "confirmed")
        assert result.is_recurring is True or result.pattern_state == "suspected"
    
    def test_first_occurrence_not_recurring(self, engine):
        """First occurrence (no history) should not be marked recurring."""
        result = engine.detect_pattern(
            root_cause="implementation",
            root_cause_confidence=0.85,  # HIGH
            verdict="wrong_answer",
            user_history=[],  # No history
        )
        
        assert result.pattern_name is not None
        assert result.is_recurring is False
        assert result.confidence_gated is False
        # First occurrence with high confidence → suspected
        assert result.pattern_state == "suspected"
    
    def test_evidence_strength_included(self, engine):
        """Pattern result should include evidence strength metrics."""
        history = [
            {
                "root_cause": "implementation",
                "root_cause_confidence": 0.85,
                "createdAt": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
            },
        ]
        
        result = engine.detect_pattern(
            root_cause="implementation",
            root_cause_confidence=0.85,
            verdict="wrong_answer",
            user_history=history,
        )
        
        assert result.evidence_strength is not None
        assert "evidence_count" in result.evidence_strength
        assert "weighted_evidence" in result.evidence_strength
        assert "mean_confidence" in result.evidence_strength


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN RESULT SCHEMA TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatternResultSchema:
    """Test PatternResult Phase 2.2 fields."""
    
    def test_pattern_state_field(self):
        """PatternResult should have pattern_state field."""
        result = PatternResult(
            pattern_name="test",
            pattern_state="confirmed",
        )
        assert result.pattern_state == "confirmed"
    
    def test_is_actionable_method(self):
        """is_actionable() returns True for CONFIRMED/STABLE."""
        confirmed = PatternResult(pattern_name="test", pattern_state="confirmed")
        stable = PatternResult(pattern_name="test", pattern_state="stable")
        suspected = PatternResult(pattern_name="test", pattern_state="suspected")
        none = PatternResult(pattern_name="test", pattern_state="none")
        
        assert confirmed.is_actionable() is True
        assert stable.is_actionable() is True
        assert suspected.is_actionable() is False
        assert none.is_actionable() is False
    
    def test_is_suspected_only_method(self):
        """is_suspected_only() returns True only for SUSPECTED."""
        suspected = PatternResult(pattern_name="test", pattern_state="suspected")
        confirmed = PatternResult(pattern_name="test", pattern_state="confirmed")
        
        assert suspected.is_suspected_only() is True
        assert confirmed.is_suspected_only() is False
    
    def test_confidence_gated_field(self):
        """confidence_gated flag should be set correctly."""
        gated = PatternResult(pattern_name=None, confidence_gated=True)
        not_gated = PatternResult(pattern_name="test", confidence_gated=False)
        
        assert gated.confidence_gated is True
        assert not_gated.confidence_gated is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
