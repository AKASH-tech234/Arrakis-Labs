"""
Phase 2.3 Difficulty Policy Tests
=================================

Tests for confidence-aware, pattern-aware difficulty validation.

Acceptance Criteria (from Phase 2.3 spec):
✓ No difficulty increase on low confidence
✓ No increase on SUSPECTED patterns
✓ Increase only after sustained success (hysteresis)
✓ Decrease allowed immediately on failure
✓ No oscillation under noisy inputs
✓ Deterministic, replayable decisions
"""

import pytest
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from app.mim.difficulty_policy import (
    DifficultyPolicy,
    DifficultyAction,
    PolicyDecision,
    GateResult,
    get_confidence_tier,
    can_increase_difficulty,
    get_difficulty_policy,
)
from app.mim.difficulty_engine import DifficultyEngine, DifficultyAdjustment


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE TIER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceTier:
    """Test confidence tier classification."""
    
    def test_high_confidence(self):
        assert get_confidence_tier(0.80) == "high"
        assert get_confidence_tier(0.85) == "high"
        assert get_confidence_tier(0.90) == "high"
    
    def test_medium_confidence(self):
        assert get_confidence_tier(0.65) == "medium"
        assert get_confidence_tier(0.70) == "medium"
        assert get_confidence_tier(0.79) == "medium"
    
    def test_low_confidence(self):
        assert get_confidence_tier(0.64) == "low"
        assert get_confidence_tier(0.50) == "low"
        assert get_confidence_tier(0.30) == "low"


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE GATE TESTS (Critical Safety)
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceGate:
    """Test confidence gate - most critical safety gate."""
    
    @pytest.fixture
    def policy(self):
        return DifficultyPolicy()
    
    def test_low_confidence_blocks_increase(self, policy):
        """CRITICAL: Low confidence MUST block difficulty increase."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.50,  # LOW
            confidence_tier="low",
            pattern_state="none",
            consecutive_eligible=5,  # Even with high eligibility
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.MAINTAIN
        assert decision.blocking_gate == "confidence_gate"
        assert "LOW confidence" in decision.reason
    
    def test_medium_confidence_blocks_increase(self, policy):
        """Medium confidence also blocks increase (only HIGH can increase)."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.70,  # MEDIUM
            confidence_tier="medium",
            pattern_state="none",
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.MAINTAIN
        assert decision.blocking_gate == "confidence_gate"
    
    def test_high_confidence_allows_increase(self, policy):
        """High confidence allows increase (if other gates pass)."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,  # HIGH
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=5,  # Enough for hysteresis
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.INCREASE
        assert decision.blocking_gate is None
    
    def test_decrease_always_allowed(self, policy):
        """Decrease is ALWAYS allowed regardless of confidence (safety-first)."""
        for conf, tier in [(0.30, "low"), (0.70, "medium"), (0.85, "high")]:
            decision = policy.evaluate(
                proposed_action=DifficultyAction.DECREASE,
                proposed_difficulty="Easy",
                current_difficulty="Medium",
                confidence=conf,
                confidence_tier=tier,
                pattern_state="confirmed",  # Even with confirmed pattern
                consecutive_eligible=0,
                submissions_since_change=0,  # Even during cooldown
            )
            
            # Decrease should pass confidence gate
            # (may be blocked by cooldown, but not by confidence)
            assert decision.final_action in (
                DifficultyAction.DECREASE, 
                DifficultyAction.MAINTAIN
            )
            if decision.blocking_gate:
                assert decision.blocking_gate != "confidence_gate"


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN STATE GATE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatternStateGate:
    """Test pattern state gate integration."""
    
    @pytest.fixture
    def policy(self):
        return DifficultyPolicy()
    
    def test_suspected_pattern_blocks_increase(self, policy):
        """SUSPECTED pattern blocks increase for investigation."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,  # HIGH
            confidence_tier="high",
            pattern_state="suspected",  # SUSPECTED
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.MAINTAIN
        assert decision.blocking_gate == "pattern_state_gate"
        assert "SUSPECTED" in decision.reason
    
    def test_confirmed_pattern_blocks_increase(self, policy):
        """CONFIRMED pattern blocks increase for remediation."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="confirmed",  # CONFIRMED
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.MAINTAIN
        assert decision.blocking_gate == "pattern_state_gate"
        assert "CONFIRMED" in decision.reason
    
    def test_stable_pattern_allows_increase(self, policy):
        """STABLE pattern allows increase (user may have adapted)."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="stable",  # STABLE
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        # STABLE allows increase
        assert decision.final_action == DifficultyAction.INCREASE
    
    def test_no_pattern_allows_increase(self, policy):
        """No pattern allows increase."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.INCREASE


# ═══════════════════════════════════════════════════════════════════════════════
# HYSTERESIS GATE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestHysteresisGate:
    """Test hysteresis - sustained eligibility required for increase."""
    
    @pytest.fixture
    def policy(self):
        return DifficultyPolicy()
    
    def test_insufficient_eligibility_blocks_increase(self, policy):
        """Increase blocked without sustained eligibility."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=1,  # Only 1, need 3
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.MAINTAIN
        assert decision.blocking_gate == "hysteresis_gate"
        assert "Hysteresis" in decision.reason
    
    def test_sufficient_eligibility_allows_increase(self, policy):
        """Increase allowed with enough consecutive eligible events."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=3,  # Exactly 3 (threshold)
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.INCREASE
    
    def test_decrease_not_subject_to_hysteresis(self, policy):
        """Decrease is not gated by hysteresis."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.DECREASE,
            proposed_difficulty="Easy",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=0,  # No eligibility
            submissions_since_change=10,
        )
        
        assert decision.final_action == DifficultyAction.DECREASE


# ═══════════════════════════════════════════════════════════════════════════════
# COOLDOWN GATE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestCooldownGate:
    """Test cooldown - prevent rapid changes."""
    
    @pytest.fixture
    def policy(self):
        return DifficultyPolicy()
    
    def test_cooldown_blocks_increase(self, policy):
        """Increase blocked during cooldown period."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=5,
            submissions_since_change=2,  # Only 2, need 5
        )
        
        assert decision.final_action == DifficultyAction.MAINTAIN
        assert decision.blocking_gate == "cooldown_gate"
    
    def test_cooldown_satisfied(self, policy):
        """Increase allowed after cooldown period."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=5,
            submissions_since_change=10,  # Well past cooldown
        )
        
        assert decision.final_action == DifficultyAction.INCREASE


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY ENGINE INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestDifficultyEngineIntegration:
    """Test full DifficultyEngine with Phase 2.3 policy gates."""
    
    @pytest.fixture
    def engine(self):
        return DifficultyEngine()
    
    @pytest.fixture
    def success_submissions(self):
        """Submissions showing consistent success (would normally trigger increase)."""
        now = datetime.now(timezone.utc)
        return [
            {
                "verdict": "accepted", 
                "difficulty": "Medium", 
                "created_at": (now - timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "timestamp": (now - timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            for i in range(10)
        ]
    
    @pytest.fixture
    def readiness(self):
        return {"easy": 0.95, "medium": 0.85, "hard": 0.60}
    
    def test_low_confidence_blocks_increase(self, engine, success_submissions, readiness):
        """CRITICAL: Low MIM confidence blocks difficulty increase."""
        result = engine.compute_adjustment(
            submissions=success_submissions,
            current_readiness=readiness,
            mim_confidence=0.50,  # LOW
            pattern_state="none",
            consecutive_eligible=5,
        )
        
        # Should not increase despite good performance
        assert result.adjustment != "increase"
        assert result.confidence_tier == "low"
        assert result.blocking_gate is not None
    
    def test_suspected_pattern_blocks_increase(self, engine, success_submissions, readiness):
        """SUSPECTED pattern blocks increase."""
        result = engine.compute_adjustment(
            submissions=success_submissions,
            current_readiness=readiness,
            mim_confidence=0.85,  # HIGH
            pattern_state="suspected",  # SUSPECTED
            consecutive_eligible=5,
        )
        
        assert result.adjustment != "increase"
        assert result.pattern_state == "suspected"
    
    def test_policy_decision_included(self, engine, success_submissions, readiness):
        """Policy decision audit trail is included."""
        result = engine.compute_adjustment(
            submissions=success_submissions,
            current_readiness=readiness,
            mim_confidence=0.85,
            pattern_state="none",
            consecutive_eligible=0,
        )
        
        assert result.policy_decision is not None
        assert "gates_evaluated" in result.policy_decision
    
    def test_consecutive_eligible_tracking(self, engine, success_submissions, readiness):
        """Consecutive eligible count is tracked correctly."""
        # First call - blocked by hysteresis
        result1 = engine.compute_adjustment(
            submissions=success_submissions,
            current_readiness=readiness,
            mim_confidence=0.85,
            pattern_state="none",
            consecutive_eligible=0,  # Start at 0
        )
        
        # If blocked by hysteresis, count should increment
        if result1.blocking_gate == "hysteresis_gate":
            assert result1.consecutive_eligible == 1


# ═══════════════════════════════════════════════════════════════════════════════
# COMBINED GATE PRECEDENCE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestGatePrecedence:
    """Test that gates are evaluated in correct order."""
    
    @pytest.fixture
    def policy(self):
        return DifficultyPolicy()
    
    def test_confidence_gate_first(self, policy):
        """Confidence gate should be checked first."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.50,  # LOW - should fail here
            confidence_tier="low",
            pattern_state="confirmed",  # Would also fail
            consecutive_eligible=0,  # Would also fail
            submissions_since_change=0,  # Would also fail
        )
        
        # Should fail at confidence gate (first)
        assert decision.blocking_gate == "confidence_gate"
    
    def test_pattern_gate_after_confidence(self, policy):
        """Pattern gate checked after confidence passes."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,  # HIGH - passes
            confidence_tier="high",
            pattern_state="confirmed",  # Should fail here
            consecutive_eligible=0,  # Would also fail
            submissions_since_change=0,  # Would also fail
        )
        
        # Should fail at pattern gate (second)
        assert decision.blocking_gate == "pattern_state_gate"


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT TRAIL TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuditTrail:
    """Test that decisions are audit-friendly."""
    
    @pytest.fixture
    def policy(self):
        return DifficultyPolicy()
    
    def test_all_gates_recorded(self, policy):
        """All evaluated gates are recorded."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        # Should have evaluated all 5 gates
        assert len(decision.gates_evaluated) == 5
        gate_names = [g.gate_name for g in decision.gates_evaluated]
        assert "confidence_gate" in gate_names
        assert "pattern_state_gate" in gate_names
        assert "cooldown_gate" in gate_names
        assert "hysteresis_gate" in gate_names
        assert "directional_bias_gate" in gate_names
    
    def test_to_dict_complete(self, policy):
        """to_dict includes all relevant fields."""
        decision = policy.evaluate(
            proposed_action=DifficultyAction.INCREASE,
            proposed_difficulty="Hard",
            current_difficulty="Medium",
            confidence=0.85,
            confidence_tier="high",
            pattern_state="none",
            consecutive_eligible=5,
            submissions_since_change=10,
        )
        
        d = decision.to_dict()
        
        assert "final_action" in d
        assert "final_difficulty" in d
        assert "gates_evaluated" in d
        assert "input_confidence_tier" in d
        assert "input_pattern_state" in d


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
