"""
Difficulty Policy (Phase 2.3)
=============================

Defines confidence-aware, pattern-aware difficulty adjustment policy.

Safety-First Design:
- Difficulty is a CONTROL output, not a prediction
- Must be safer than MIM diagnosis itself
- Conservative by default, reversible, and auditable

Core Principles:
1. LOW confidence → NEVER increase difficulty
2. SUSPECTED patterns → Hold difficulty for remediation
3. CONFIRMED/STABLE patterns must be RESOLVED before increase
4. Decrease is always allowed (fail-safe)
5. Increase requires sustained eligibility (hysteresis)

Integration:
- Consumes calibrated confidence from Phase 2.1
- Consumes pattern state from Phase 2.2
- Outputs audit-friendly decision records
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY ACTIONS
# ═══════════════════════════════════════════════════════════════════════════════

class DifficultyAction(str, Enum):
    """Possible difficulty adjustment actions."""
    INCREASE = "increase"
    DECREASE = "decrease"
    MAINTAIN = "maintain"
    
    def __str__(self) -> str:
        return self.value


class GateResult(str, Enum):
    """Result of a policy gate check."""
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    FORCED = "forced"  # Gate forces a specific action


# ═══════════════════════════════════════════════════════════════════════════════
# POLICY GATES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class GateDecision:
    """Result of a single gate check."""
    gate_name: str
    result: GateResult
    proposed_action: Optional[DifficultyAction]
    reason: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "gate_name": self.gate_name,
            "result": str(self.result),
            "proposed_action": str(self.proposed_action) if self.proposed_action else None,
            "reason": self.reason,
            "metadata": self.metadata,
        }


@dataclass
class PolicyDecision:
    """Complete policy evaluation result."""
    final_action: DifficultyAction
    final_difficulty: str
    confidence: float
    reason: str
    
    # Gate audit trail
    gates_evaluated: List[GateDecision]
    blocking_gate: Optional[str]  # Which gate blocked/forced if any
    
    # Input context
    input_confidence_tier: str
    input_pattern_state: str
    input_current_difficulty: str
    
    # Hysteresis state
    consecutive_eligible_count: int
    cooldown_remaining: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "final_action": str(self.final_action),
            "final_difficulty": self.final_difficulty,
            "confidence": self.confidence,
            "reason": self.reason,
            "gates_evaluated": [g.to_dict() for g in self.gates_evaluated],
            "blocking_gate": self.blocking_gate,
            "input_confidence_tier": self.input_confidence_tier,
            "input_pattern_state": self.input_pattern_state,
            "input_current_difficulty": self.input_current_difficulty,
            "consecutive_eligible_count": self.consecutive_eligible_count,
            "cooldown_remaining": self.cooldown_remaining,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY POLICY ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class DifficultyPolicy:
    """
    Phase 2.3 Difficulty Policy Engine.
    
    Applies confidence and pattern gates BEFORE any difficulty change is allowed.
    
    Gate Order (evaluated in sequence):
    1. Confidence Gate - blocks increase on low confidence
    2. Pattern State Gate - blocks increase on unresolved patterns
    3. Cooldown Gate - blocks change during cooldown
    4. Hysteresis Gate - requires sustained eligibility for increase
    5. Directional Bias Gate - easier is always allowed
    """
    
    # ─────────────────────────────────────────────────────────────────────────
    # CONFIDENCE THRESHOLDS (aligned with Phase 2.1)
    # ─────────────────────────────────────────────────────────────────────────
    HIGH_CONFIDENCE_THRESHOLD = 0.80
    MEDIUM_CONFIDENCE_THRESHOLD = 0.65
    
    # ─────────────────────────────────────────────────────────────────────────
    # HYSTERESIS THRESHOLDS
    # ─────────────────────────────────────────────────────────────────────────
    CONSECUTIVE_ELIGIBLE_FOR_INCREASE = 3  # Need 3 consecutive eligible events
    COOLDOWN_AFTER_CHANGE = 5              # 5 submissions after any change
    COOLDOWN_AFTER_DECREASE = 3            # Shorter cooldown for decrease
    
    # ─────────────────────────────────────────────────────────────────────────
    # DIFFICULTY LEVELS
    # ─────────────────────────────────────────────────────────────────────────
    DIFFICULTY_ORDER = {"Easy": 0, "Medium": 1, "Hard": 2}
    DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard"]
    
    def __init__(self):
        self.logger = logging.getLogger("mim.difficulty_policy")
    
    def evaluate(
        self,
        proposed_action: DifficultyAction,
        proposed_difficulty: str,
        current_difficulty: str,
        confidence: float,
        confidence_tier: str,
        pattern_state: str,
        consecutive_eligible: int = 0,
        submissions_since_change: int = 999,
        last_action: Optional[str] = None,
    ) -> PolicyDecision:
        """
        Evaluate whether a proposed difficulty action is allowed.
        
        Parameters
        ----------
        proposed_action : DifficultyAction
            What the system wants to do (increase/decrease/maintain)
        proposed_difficulty : str
            Target difficulty level
        current_difficulty : str
            Current difficulty level
        confidence : float
            Calibrated confidence from MIM (Phase 2.1)
        confidence_tier : str
            "high", "medium", or "low"
        pattern_state : str
            Pattern state from Phase 2.2 ("none", "suspected", "confirmed", "stable")
        consecutive_eligible : int
            How many consecutive times increase was eligible
        submissions_since_change : int
            Submissions since last difficulty change
        last_action : str, optional
            What the last action was
            
        Returns
        -------
        PolicyDecision
            Final decision with full audit trail
        """
        
        gates_evaluated = []
        blocking_gate = None
        
        # ─────────────────────────────────────────────────────────────────────
        # GATE 1: Confidence Gate (CRITICAL)
        # ─────────────────────────────────────────────────────────────────────
        confidence_gate = self._check_confidence_gate(
            proposed_action, confidence, confidence_tier
        )
        gates_evaluated.append(confidence_gate)
        
        if confidence_gate.result == GateResult.BLOCKED:
            blocking_gate = confidence_gate.gate_name
            return self._build_blocked_decision(
                confidence_gate,
                current_difficulty,
                confidence_tier,
                pattern_state,
                gates_evaluated,
                consecutive_eligible,
                submissions_since_change,
            )
        
        if confidence_gate.result == GateResult.FORCED:
            blocking_gate = confidence_gate.gate_name
            return self._build_forced_decision(
                confidence_gate,
                current_difficulty,
                confidence_tier,
                pattern_state,
                gates_evaluated,
                consecutive_eligible,
                submissions_since_change,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # GATE 2: Pattern State Gate (CRITICAL)
        # ─────────────────────────────────────────────────────────────────────
        pattern_gate = self._check_pattern_gate(
            proposed_action, pattern_state
        )
        gates_evaluated.append(pattern_gate)
        
        if pattern_gate.result == GateResult.BLOCKED:
            blocking_gate = pattern_gate.gate_name
            return self._build_blocked_decision(
                pattern_gate,
                current_difficulty,
                confidence_tier,
                pattern_state,
                gates_evaluated,
                consecutive_eligible,
                submissions_since_change,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # GATE 3: Cooldown Gate
        # ─────────────────────────────────────────────────────────────────────
        cooldown_gate = self._check_cooldown_gate(
            proposed_action, submissions_since_change, last_action
        )
        gates_evaluated.append(cooldown_gate)
        
        if cooldown_gate.result == GateResult.BLOCKED:
            blocking_gate = cooldown_gate.gate_name
            return self._build_blocked_decision(
                cooldown_gate,
                current_difficulty,
                confidence_tier,
                pattern_state,
                gates_evaluated,
                consecutive_eligible,
                submissions_since_change,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # GATE 4: Hysteresis Gate (for increases only)
        # ─────────────────────────────────────────────────────────────────────
        hysteresis_gate = self._check_hysteresis_gate(
            proposed_action, consecutive_eligible
        )
        gates_evaluated.append(hysteresis_gate)
        
        if hysteresis_gate.result == GateResult.BLOCKED:
            blocking_gate = hysteresis_gate.gate_name
            return self._build_blocked_decision(
                hysteresis_gate,
                current_difficulty,
                confidence_tier,
                pattern_state,
                gates_evaluated,
                consecutive_eligible,
                submissions_since_change,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # GATE 5: Directional Bias Gate (decrease always allowed)
        # ─────────────────────────────────────────────────────────────────────
        directional_gate = self._check_directional_gate(proposed_action)
        gates_evaluated.append(directional_gate)
        
        # If we reach here, action is ALLOWED
        # Calculate cooldown remaining
        cooldown_needed = (
            self.COOLDOWN_AFTER_CHANGE if proposed_action == DifficultyAction.INCREASE
            else self.COOLDOWN_AFTER_DECREASE
        )
        cooldown_remaining = max(0, cooldown_needed - submissions_since_change)
        
        return PolicyDecision(
            final_action=proposed_action,
            final_difficulty=proposed_difficulty,
            confidence=confidence,
            reason=f"All gates passed. {proposed_action.value.title()} to {proposed_difficulty} allowed.",
            gates_evaluated=gates_evaluated,
            blocking_gate=None,
            input_confidence_tier=confidence_tier,
            input_pattern_state=pattern_state,
            input_current_difficulty=current_difficulty,
            consecutive_eligible_count=consecutive_eligible,
            cooldown_remaining=cooldown_remaining,
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GATE IMPLEMENTATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_confidence_gate(
        self,
        proposed_action: DifficultyAction,
        confidence: float,
        confidence_tier: str,
    ) -> GateDecision:
        """
        GATE 1: Confidence Gate
        
        Rules:
        - LOW confidence → BLOCK increase, FORCE maintain/decrease
        - MEDIUM confidence → BLOCK increase, allow decrease
        - HIGH confidence → Allow all
        """
        
        if proposed_action == DifficultyAction.INCREASE:
            if confidence_tier == "low":
                return GateDecision(
                    gate_name="confidence_gate",
                    result=GateResult.BLOCKED,
                    proposed_action=DifficultyAction.MAINTAIN,
                    reason=f"LOW confidence ({confidence:.2f}) blocks difficulty increase. Safety gate.",
                    metadata={"confidence": confidence, "tier": confidence_tier},
                )
            
            if confidence_tier == "medium":
                return GateDecision(
                    gate_name="confidence_gate",
                    result=GateResult.BLOCKED,
                    proposed_action=DifficultyAction.MAINTAIN,
                    reason=f"MEDIUM confidence ({confidence:.2f}) insufficient for increase. Need HIGH confidence.",
                    metadata={"confidence": confidence, "tier": confidence_tier},
                )
        
        if proposed_action == DifficultyAction.DECREASE:
            # Decrease is always allowed (fail-safe)
            return GateDecision(
                gate_name="confidence_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="Decrease allowed regardless of confidence (safety-first).",
                metadata={"confidence": confidence, "tier": confidence_tier},
            )
        
        # HIGH confidence allows increase
        return GateDecision(
            gate_name="confidence_gate",
            result=GateResult.ALLOWED,
            proposed_action=proposed_action,
            reason=f"Confidence tier '{confidence_tier}' allows proposed action.",
            metadata={"confidence": confidence, "tier": confidence_tier},
        )
    
    def _check_pattern_gate(
        self,
        proposed_action: DifficultyAction,
        pattern_state: str,
    ) -> GateDecision:
        """
        GATE 2: Pattern State Gate
        
        Rules:
        - NONE → Allow increase
        - SUSPECTED → Block increase (needs investigation)
        - CONFIRMED → Block increase (needs remediation)
        - STABLE → Allow increase only if HIGH confidence (checked in Gate 1)
        """
        
        if proposed_action != DifficultyAction.INCREASE:
            return GateDecision(
                gate_name="pattern_state_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="Non-increase actions are not pattern-gated.",
                metadata={"pattern_state": pattern_state},
            )
        
        if pattern_state == "none":
            return GateDecision(
                gate_name="pattern_state_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="No active pattern. Increase eligible.",
                metadata={"pattern_state": pattern_state},
            )
        
        if pattern_state == "suspected":
            return GateDecision(
                gate_name="pattern_state_gate",
                result=GateResult.BLOCKED,
                proposed_action=DifficultyAction.MAINTAIN,
                reason="SUSPECTED pattern detected. Hold difficulty for investigation.",
                metadata={"pattern_state": pattern_state},
            )
        
        if pattern_state == "confirmed":
            return GateDecision(
                gate_name="pattern_state_gate",
                result=GateResult.BLOCKED,
                proposed_action=DifficultyAction.MAINTAIN,
                reason="CONFIRMED pattern requires remediation before increase.",
                metadata={"pattern_state": pattern_state},
            )
        
        if pattern_state == "stable":
            # STABLE patterns are long-standing - user may have learned to cope
            # Allow increase but with caution (confidence gate already checked)
            return GateDecision(
                gate_name="pattern_state_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="STABLE pattern. User may have adapted. Increase cautiously allowed.",
                metadata={"pattern_state": pattern_state},
            )
        
        # Unknown state - be conservative
        return GateDecision(
            gate_name="pattern_state_gate",
            result=GateResult.BLOCKED,
            proposed_action=DifficultyAction.MAINTAIN,
            reason=f"Unknown pattern state '{pattern_state}'. Blocking increase.",
            metadata={"pattern_state": pattern_state},
        )
    
    def _check_cooldown_gate(
        self,
        proposed_action: DifficultyAction,
        submissions_since_change: int,
        last_action: Optional[str],
    ) -> GateDecision:
        """
        GATE 3: Cooldown Gate
        
        Prevents rapid changes by enforcing minimum submissions between changes.
        """
        
        if proposed_action == DifficultyAction.MAINTAIN:
            return GateDecision(
                gate_name="cooldown_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="Maintain is not subject to cooldown.",
                metadata={"submissions_since_change": submissions_since_change},
            )
        
        # Determine cooldown threshold based on action type
        if proposed_action == DifficultyAction.INCREASE:
            cooldown_threshold = self.COOLDOWN_AFTER_CHANGE
        else:
            cooldown_threshold = self.COOLDOWN_AFTER_DECREASE
        
        if submissions_since_change < cooldown_threshold:
            remaining = cooldown_threshold - submissions_since_change
            return GateDecision(
                gate_name="cooldown_gate",
                result=GateResult.BLOCKED,
                proposed_action=DifficultyAction.MAINTAIN,
                reason=f"Cooldown active. {remaining} more submissions needed.",
                metadata={
                    "submissions_since_change": submissions_since_change,
                    "cooldown_threshold": cooldown_threshold,
                    "remaining": remaining,
                },
            )
        
        return GateDecision(
            gate_name="cooldown_gate",
            result=GateResult.ALLOWED,
            proposed_action=proposed_action,
            reason="Cooldown satisfied.",
            metadata={"submissions_since_change": submissions_since_change},
        )
    
    def _check_hysteresis_gate(
        self,
        proposed_action: DifficultyAction,
        consecutive_eligible: int,
    ) -> GateDecision:
        """
        GATE 4: Hysteresis Gate
        
        Requires sustained eligibility before allowing increase.
        Prevents single-event increases.
        """
        
        if proposed_action != DifficultyAction.INCREASE:
            return GateDecision(
                gate_name="hysteresis_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="Hysteresis only applies to increases.",
                metadata={"consecutive_eligible": consecutive_eligible},
            )
        
        if consecutive_eligible < self.CONSECUTIVE_ELIGIBLE_FOR_INCREASE:
            needed = self.CONSECUTIVE_ELIGIBLE_FOR_INCREASE - consecutive_eligible
            return GateDecision(
                gate_name="hysteresis_gate",
                result=GateResult.BLOCKED,
                proposed_action=DifficultyAction.MAINTAIN,
                reason=f"Hysteresis: need {needed} more consecutive eligible events for increase.",
                metadata={
                    "consecutive_eligible": consecutive_eligible,
                    "threshold": self.CONSECUTIVE_ELIGIBLE_FOR_INCREASE,
                    "needed": needed,
                },
            )
        
        return GateDecision(
            gate_name="hysteresis_gate",
            result=GateResult.ALLOWED,
            proposed_action=proposed_action,
            reason=f"Hysteresis satisfied ({consecutive_eligible} consecutive eligible).",
            metadata={"consecutive_eligible": consecutive_eligible},
        )
    
    def _check_directional_gate(
        self,
        proposed_action: DifficultyAction,
    ) -> GateDecision:
        """
        GATE 5: Directional Bias Gate
        
        Simply records that decrease is always allowed.
        This gate never blocks - it's for audit purposes.
        """
        
        if proposed_action == DifficultyAction.DECREASE:
            return GateDecision(
                gate_name="directional_bias_gate",
                result=GateResult.ALLOWED,
                proposed_action=proposed_action,
                reason="Decrease is always allowed (safety-first bias).",
                metadata={},
            )
        
        return GateDecision(
            gate_name="directional_bias_gate",
            result=GateResult.ALLOWED,
            proposed_action=proposed_action,
            reason="Non-decrease action passed directional check.",
            metadata={},
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DECISION BUILDERS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _build_blocked_decision(
        self,
        blocking_gate: GateDecision,
        current_difficulty: str,
        confidence_tier: str,
        pattern_state: str,
        gates_evaluated: List[GateDecision],
        consecutive_eligible: int,
        submissions_since_change: int,
    ) -> PolicyDecision:
        """Build a decision when an action is blocked."""
        
        # Blocked actions default to MAINTAIN
        final_action = blocking_gate.proposed_action or DifficultyAction.MAINTAIN
        
        return PolicyDecision(
            final_action=final_action,
            final_difficulty=current_difficulty,
            confidence=0.8,  # High confidence in safety decision
            reason=blocking_gate.reason,
            gates_evaluated=gates_evaluated,
            blocking_gate=blocking_gate.gate_name,
            input_confidence_tier=confidence_tier,
            input_pattern_state=pattern_state,
            input_current_difficulty=current_difficulty,
            consecutive_eligible_count=consecutive_eligible,
            cooldown_remaining=max(0, self.COOLDOWN_AFTER_CHANGE - submissions_since_change),
        )
    
    def _build_forced_decision(
        self,
        forcing_gate: GateDecision,
        current_difficulty: str,
        confidence_tier: str,
        pattern_state: str,
        gates_evaluated: List[GateDecision],
        consecutive_eligible: int,
        submissions_since_change: int,
    ) -> PolicyDecision:
        """Build a decision when a gate forces a specific action."""
        
        final_action = forcing_gate.proposed_action or DifficultyAction.MAINTAIN
        
        # Compute new difficulty if forced decrease
        if final_action == DifficultyAction.DECREASE:
            current_idx = self.DIFFICULTY_ORDER.get(current_difficulty, 1)
            new_idx = max(0, current_idx - 1)
            final_difficulty = self.DIFFICULTY_LEVELS[new_idx]
        else:
            final_difficulty = current_difficulty
        
        return PolicyDecision(
            final_action=final_action,
            final_difficulty=final_difficulty,
            confidence=0.9,  # High confidence in forced safety action
            reason=forcing_gate.reason,
            gates_evaluated=gates_evaluated,
            blocking_gate=forcing_gate.gate_name,
            input_confidence_tier=confidence_tier,
            input_pattern_state=pattern_state,
            input_current_difficulty=current_difficulty,
            consecutive_eligible_count=consecutive_eligible,
            cooldown_remaining=0,  # Forced actions reset cooldown
        )


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_confidence_tier(confidence: float) -> str:
    """Get confidence tier from calibrated confidence."""
    if confidence >= 0.80:
        return "high"
    elif confidence >= 0.65:
        return "medium"
    else:
        return "low"


def can_increase_difficulty(confidence_tier: str, pattern_state: str) -> bool:
    """
    Quick check if difficulty increase is even possible.
    
    Both confidence and pattern state must allow it.
    """
    confidence_ok = confidence_tier == "high"
    pattern_ok = pattern_state in ("none", "stable")
    return confidence_ok and pattern_ok


# Singleton instance
_difficulty_policy = None


def get_difficulty_policy() -> DifficultyPolicy:
    """Get singleton difficulty policy instance."""
    global _difficulty_policy
    if _difficulty_policy is None:
        _difficulty_policy = DifficultyPolicy()
    return _difficulty_policy
