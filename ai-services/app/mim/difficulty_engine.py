"""
MIM Difficulty Adjustment Engine
================================

v2.0: Phase 2.3 - Confidence-aware, pattern-aware difficulty control.

Computes personalized difficulty recommendations based on:
- Recent performance patterns
- Frustration/boredom indices
- User readiness scores
- Learning velocity
- CALIBRATED CONFIDENCE (Phase 2.1)
- PATTERN STATE (Phase 2.2)

Safety-First Design:
- LOW confidence → NEVER increase difficulty
- SUSPECTED/CONFIRMED patterns → Hold for remediation
- Decrease is always allowed (fail-safe)
- Hysteresis prevents single-event changes

This is NOT just "solved medium → give hard"
It's "solved medium with struggle → give medium-hard same concept"

Difficulty = Problem Complexity × User Readiness × Safety Gates
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
import logging

from app.mim.difficulty_policy import (
    DifficultyPolicy,
    DifficultyAction,
    PolicyDecision,
    GateDecision,
    get_difficulty_policy,
    get_confidence_tier,
    can_increase_difficulty,
)

logger = logging.getLogger(__name__)


@dataclass
class DifficultyAdjustment:
    """Output of difficulty adjustment computation."""
    next_difficulty: str  # "Easy", "Medium", "Hard"
    adjustment: str  # "increase", "decrease", "maintain"
    confidence: float  # 0-1
    reason: str
    
    # Supporting metrics
    frustration_index: float  # 0-1 (high = user struggling)
    boredom_index: float  # 0-1 (high = user bored)
    current_readiness: Dict[str, float]  # per-difficulty success probability
    
    # Phase 2.3: Outcome validation fields
    outcome_validated: bool = False  # True if previous adjustment was validated
    cooldown_active: bool = False  # True if in cooldown period
    adjustment_score: float = 0.0  # Historical effectiveness score
    
    # Phase 2.3: Policy gate fields (NEW)
    confidence_tier: str = "medium"  # "high", "medium", "low"
    pattern_state: str = "none"  # "none", "suspected", "confirmed", "stable"
    policy_decision: Optional[Dict[str, Any]] = None  # Full policy audit trail
    blocking_gate: Optional[str] = None  # Which gate blocked if any
    consecutive_eligible: int = 0  # Consecutive times increase was eligible
    
    def to_dict(self) -> Dict:
        return {
            "next_difficulty": self.next_difficulty,
            "adjustment": self.adjustment,
            "confidence": self.confidence,
            "reason": self.reason,
            "frustration_index": self.frustration_index,
            "boredom_index": self.boredom_index,
            "current_readiness": self.current_readiness,
            # Phase 2.3: Outcome validation fields
            "outcome_validated": self.outcome_validated,
            "cooldown_active": self.cooldown_active,
            "adjustment_score": self.adjustment_score,
            # Phase 2.3: Policy gate fields
            "confidence_tier": self.confidence_tier,
            "pattern_state": self.pattern_state,
            "policy_decision": self.policy_decision,
            "blocking_gate": self.blocking_gate,
            "consecutive_eligible": self.consecutive_eligible,
        }
    
    def was_gated(self) -> bool:
        """Check if the adjustment was blocked by a policy gate."""
        return self.blocking_gate is not None
    
    def get_gate_reason(self) -> Optional[str]:
        """Get reason from blocking gate if any."""
        if self.policy_decision and self.blocking_gate:
            return self.policy_decision.get("reason")
        return None


class DifficultyEngine:
    """
    Personalized difficulty adjustment engine.
    
    v2.0 (Phase 2.3): Now with confidence and pattern safety gates.
    
    Key insight: Difficulty ≠ problem complexity
                 Difficulty = problem × user readiness × safety gates
    
    Safety Gates (Phase 2.3):
    1. Confidence Gate - LOW confidence blocks increase
    2. Pattern State Gate - SUSPECTED/CONFIRMED patterns block increase
    3. Cooldown Gate - Minimum submissions between changes
    4. Hysteresis Gate - Sustained eligibility required for increase
    """
    
    # Thresholds for adjustment decisions
    FRUSTRATION_THRESHOLD = 0.6  # Above this, consider decreasing difficulty
    BOREDOM_THRESHOLD = 0.7  # Above this, consider increasing difficulty
    SUCCESS_RATE_LOW = 0.3  # Below this, user is struggling
    SUCCESS_RATE_HIGH = 0.8  # Above this, user might be bored
    
    # Time windows for analysis
    RECENT_WINDOW_SUBMISSIONS = 10  # Last N submissions for recent analysis
    SHORT_WINDOW_MINUTES = 30  # For frustration detection
    
    # Phase 2.3: Anti-oscillation and outcome validation
    COOLDOWN_SUBMISSIONS = 5  # Min submissions before next difficulty change
    OUTCOME_VALIDATION_WINDOW = 3  # Submissions to validate adjustment effectiveness
    OSCILLATION_LOOKBACK = 15  # Submissions to check for oscillation
    MIN_ADJUSTMENT_EFFECTIVENESS = 0.4  # Below this, rollback adjustment
    
    def __init__(self):
        self.difficulty_levels = ["Easy", "Medium", "Hard"]
        self.difficulty_order = {"Easy": 0, "Medium": 1, "Hard": 2}
        # Phase 2.3: Policy engine for safety gates
        self.policy = get_difficulty_policy()
        
    def compute_adjustment(
        self,
        submissions: List[Dict],
        current_readiness: Dict[str, float],
        user_profile: Optional[Dict] = None,
        last_adjustment: Optional[Dict] = None,
        # Phase 2.3: New parameters for safety gates
        mim_confidence: float = 0.70,
        pattern_state: str = "none",
        consecutive_eligible: int = 0,
    ) -> DifficultyAdjustment:
        """
        Compute difficulty adjustment based on user performance.
        
        Phase 2.3: Now applies confidence and pattern safety gates.
        
        Args:
            submissions: Recent submissions with verdict, difficulty, timestamp
            current_readiness: Dict with easy/medium/hard success probabilities
            user_profile: Optional user profile with learning style, goals
            last_adjustment: Previous adjustment decision
            mim_confidence: CALIBRATED confidence from MIM (Phase 2.1)
            pattern_state: Pattern state from Phase 2.2 (none/suspected/confirmed/stable)
            consecutive_eligible: Count of consecutive increase-eligible events
            
        Returns:
            DifficultyAdjustment with recommendation and policy audit trail
        """
        if not submissions:
            return self._cold_start_adjustment(current_readiness)
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 2.3: Compute confidence tier
        # ─────────────────────────────────────────────────────────────────────
        confidence_tier = get_confidence_tier(mim_confidence)
        
        # Phase 2.3: Check cooldown and oscillation
        cooldown_active = self._check_cooldown(submissions, last_adjustment)
        oscillation_detected = self._detect_oscillation(submissions)
        
        # Count submissions since last change
        submissions_since_change = self._count_submissions_since_change(
            submissions, last_adjustment
        )
        
        # Phase 2.3: Validate previous adjustment outcome
        outcome_validated = False
        adjustment_score = 0.0
        if last_adjustment:
            outcome_validated, adjustment_score = self._validate_outcome(
                submissions, last_adjustment
            )
        
        # Compute indices
        frustration = self._compute_frustration_index(submissions)
        boredom = self._compute_boredom_index(submissions)
        recent_success_rate = self._compute_recent_success_rate(submissions)
        current_difficulty = self._estimate_current_difficulty(submissions)
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 2.3: Determine proposed adjustment (before gates)
        # ─────────────────────────────────────────────────────────────────────
        proposed_action_str, proposed_difficulty, raw_confidence, raw_reason = self._decide_adjustment(
            current_difficulty=current_difficulty,
            frustration=frustration,
            boredom=boredom,
            success_rate=recent_success_rate,
            readiness=current_readiness,
            user_profile=user_profile,
        )
        
        # Map to DifficultyAction enum
        proposed_action = DifficultyAction(proposed_action_str)
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 2.3: Apply policy gates (CRITICAL SAFETY CHECK)
        # ─────────────────────────────────────────────────────────────────────
        policy_decision = self.policy.evaluate(
            proposed_action=proposed_action,
            proposed_difficulty=proposed_difficulty,
            current_difficulty=current_difficulty,
            confidence=mim_confidence,
            confidence_tier=confidence_tier,
            pattern_state=pattern_state,
            consecutive_eligible=consecutive_eligible,
            submissions_since_change=submissions_since_change,
            last_action=last_adjustment.get("adjustment") if last_adjustment else None,
        )
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 2.3: Log gate decisions
        # ─────────────────────────────────────────────────────────────────────
        if policy_decision.blocking_gate:
            logger.info(
                f"🚫 DIFFICULTY GATE: {policy_decision.blocking_gate} blocked "
                f"'{proposed_action}' → '{policy_decision.final_action}'. "
                f"Reason: {policy_decision.reason}"
            )
        else:
            logger.info(
                f"✅ DIFFICULTY: All gates passed. {policy_decision.final_action} "
                f"to {policy_decision.final_difficulty}"
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 2.3: Handle oscillation (additional safety)
        # ─────────────────────────────────────────────────────────────────────
        if oscillation_detected and policy_decision.final_action != DifficultyAction.MAINTAIN:
            logger.warning("Difficulty oscillation detected - overriding to maintain")
            return DifficultyAdjustment(
                next_difficulty=current_difficulty,
                adjustment="maintain",
                confidence=0.8,
                reason="Difficulty oscillation detected. Stabilizing at current level.",
                frustration_index=frustration,
                boredom_index=boredom,
                current_readiness=current_readiness,
                outcome_validated=outcome_validated,
                cooldown_active=cooldown_active,
                adjustment_score=adjustment_score,
                confidence_tier=confidence_tier,
                pattern_state=pattern_state,
                policy_decision=policy_decision.to_dict(),
                blocking_gate="oscillation_override",
                consecutive_eligible=0,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 2.3: Update consecutive eligible count
        # ─────────────────────────────────────────────────────────────────────
        new_consecutive_eligible = consecutive_eligible
        if proposed_action == DifficultyAction.INCREASE:
            if policy_decision.final_action == DifficultyAction.INCREASE:
                # Increase was allowed, reset counter
                new_consecutive_eligible = 0
            elif policy_decision.blocking_gate == "hysteresis_gate":
                # Blocked by hysteresis, increment counter
                new_consecutive_eligible = consecutive_eligible + 1
            else:
                # Blocked by other gate, reset counter
                new_consecutive_eligible = 0
        else:
            new_consecutive_eligible = 0
        
        return DifficultyAdjustment(
            next_difficulty=policy_decision.final_difficulty,
            adjustment=str(policy_decision.final_action),
            confidence=policy_decision.confidence,
            reason=policy_decision.reason,
            frustration_index=frustration,
            boredom_index=boredom,
            current_readiness=current_readiness,
            outcome_validated=outcome_validated,
            cooldown_active=cooldown_active,
            adjustment_score=adjustment_score,
            confidence_tier=confidence_tier,
            pattern_state=pattern_state,
            policy_decision=policy_decision.to_dict(),
            blocking_gate=policy_decision.blocking_gate,
            consecutive_eligible=new_consecutive_eligible,
        )
    
    def _count_submissions_since_change(
        self,
        submissions: List[Dict],
        last_adjustment: Optional[Dict],
    ) -> int:
        """Count submissions since last difficulty change."""
        if not last_adjustment:
            return 999  # No previous change
        
        last_timestamp = last_adjustment.get("timestamp")
        if not last_timestamp:
            return 999
        
        try:
            last_dt = self._parse_datetime(last_timestamp)
            count = 0
            for sub in submissions:
                sub_time = sub.get("created_at") or sub.get("timestamp")
                if sub_time:
                    sub_dt = self._parse_datetime(sub_time)
                    if sub_dt > last_dt:
                        count += 1
            return count
        except Exception:
            return 999
    
    def _compute_frustration_index(self, submissions: List[Dict]) -> float:
        """
        Compute frustration index based on:
        - Consecutive failures
        - Rapid retry frequency
        - Time between submissions
        
        High frustration = too many failures in short time
        """
        if not submissions:
            return 0.0
        
        recent = submissions[:self.RECENT_WINDOW_SUBMISSIONS]
        
        # Factor 1: Consecutive failures at end
        consecutive_failures = 0
        for sub in recent:
            if sub.get("verdict", "").lower() != "accepted":
                consecutive_failures += 1
            else:
                break
        
        consecutive_factor = min(consecutive_failures / 5, 1.0)  # Max at 5 consecutive
        
        # Factor 2: Failure rate in short window
        now = datetime.now(timezone.utc)
        short_window = [
            s for s in recent
            if s.get("created_at") and 
            (now - self._parse_datetime(s["created_at"])).total_seconds() < self.SHORT_WINDOW_MINUTES * 60
        ]
        
        if short_window:
            failures_in_window = sum(
                1 for s in short_window 
                if s.get("verdict", "").lower() != "accepted"
            )
            window_failure_rate = failures_in_window / len(short_window)
        else:
            window_failure_rate = 0.0
        
        # Factor 3: Rapid retries on same problem (same problem_id)
        problem_attempts = {}
        for sub in recent:
            pid = sub.get("problem_id", "")
            if pid:
                problem_attempts[pid] = problem_attempts.get(pid, 0) + 1
        
        max_retries = max(problem_attempts.values()) if problem_attempts else 1
        retry_factor = min((max_retries - 1) / 4, 1.0)  # Max at 5 retries
        
        # Weighted combination
        frustration = (
            consecutive_factor * 0.4 +
            window_failure_rate * 0.35 +
            retry_factor * 0.25
        )
        
        return round(min(frustration, 1.0), 3)
    
    def _compute_boredom_index(self, submissions: List[Dict]) -> float:
        """
        Compute boredom index based on:
        - High success rate
        - Many easy problems solved consecutively
        - Fast solve times (if available)
        
        High boredom = too many easy wins, user not challenged
        """
        if not submissions:
            return 0.0
        
        recent = submissions[:self.RECENT_WINDOW_SUBMISSIONS]
        
        # Factor 1: High success rate
        accepted_count = sum(
            1 for s in recent 
            if s.get("verdict", "").lower() == "accepted"
        )
        success_rate = accepted_count / len(recent)
        
        # Only consider boredom if success rate is high
        if success_rate < self.SUCCESS_RATE_HIGH:
            return 0.0
        
        success_factor = (success_rate - self.SUCCESS_RATE_HIGH) / (1 - self.SUCCESS_RATE_HIGH)
        
        # Factor 2: Easy problems ratio
        easy_count = sum(
            1 for s in recent 
            if s.get("difficulty", "").lower() == "easy"
        )
        easy_ratio = easy_count / len(recent)
        
        # Factor 3: Consecutive accepts at same difficulty
        consecutive_same_diff_accepts = 0
        last_diff = None
        for sub in recent:
            if sub.get("verdict", "").lower() == "accepted":
                curr_diff = sub.get("difficulty", "")
                if curr_diff == last_diff or last_diff is None:
                    consecutive_same_diff_accepts += 1
                    last_diff = curr_diff
                else:
                    break
            else:
                break
        
        consecutive_factor = min(consecutive_same_diff_accepts / 5, 1.0)
        
        # Weighted combination
        boredom = (
            success_factor * 0.4 +
            easy_ratio * 0.3 +
            consecutive_factor * 0.3
        )
        
        return round(min(boredom, 1.0), 3)
    
    def _compute_recent_success_rate(self, submissions: List[Dict]) -> float:
        """Compute success rate over recent submissions."""
        if not submissions:
            return 0.5
        
        recent = submissions[:self.RECENT_WINDOW_SUBMISSIONS]
        accepted = sum(1 for s in recent if s.get("verdict", "").lower() == "accepted")
        return round(accepted / len(recent), 3)
    
    def _estimate_current_difficulty(self, submissions: List[Dict]) -> str:
        """Estimate user's current working difficulty level."""
        if not submissions:
            return "Easy"
        
        recent = submissions[:self.RECENT_WINDOW_SUBMISSIONS]
        
        # Find most common difficulty in recent accepted submissions
        accepted_difficulties = [
            s.get("difficulty", "Easy")
            for s in recent
            if s.get("verdict", "").lower() == "accepted"
        ]
        
        if not accepted_difficulties:
            # No recent accepts, use most attempted difficulty
            all_difficulties = [s.get("difficulty", "Easy") for s in recent]
            accepted_difficulties = all_difficulties
        
        # Return mode (most common)
        difficulty_counts = {}
        for d in accepted_difficulties:
            difficulty_counts[d] = difficulty_counts.get(d, 0) + 1
        
        return max(difficulty_counts, key=difficulty_counts.get, default="Easy")
    
    def _decide_adjustment(
        self,
        current_difficulty: str,
        frustration: float,
        boredom: float,
        success_rate: float,
        readiness: Dict[str, float],
        user_profile: Optional[Dict],
    ) -> Tuple[str, str, float, str]:
        """
        Make adjustment decision based on all signals.
        
        Returns: (adjustment, next_difficulty, confidence, reason)
        """
        current_idx = self.difficulty_order.get(current_difficulty, 1)
        
        # High frustration → decrease difficulty
        if frustration >= self.FRUSTRATION_THRESHOLD:
            if current_idx > 0:
                next_diff = self.difficulty_levels[current_idx - 1]
                confidence = min(0.5 + frustration * 0.4, 0.95)
                return (
                    "decrease",
                    next_diff,
                    confidence,
                    f"High frustration detected ({frustration:.0%}). Reducing difficulty to build confidence."
                )
            else:
                return (
                    "maintain",
                    "Easy",
                    0.8,
                    "Already at Easy. Focus on building fundamentals before advancing."
                )
        
        # High boredom → increase difficulty
        if boredom >= self.BOREDOM_THRESHOLD:
            if current_idx < len(self.difficulty_levels) - 1:
                next_diff = self.difficulty_levels[current_idx + 1]
                # Check readiness for next level
                next_readiness = readiness.get(next_diff.lower(), 0.5)
                if next_readiness >= 0.4:  # Ready enough to try
                    confidence = min(0.5 + boredom * 0.4, 0.95)
                    return (
                        "increase",
                        next_diff,
                        confidence,
                        f"High success rate with signs of boredom. Ready for {next_diff} challenges."
                    )
                else:
                    return (
                        "maintain",
                        current_difficulty,
                        0.7,
                        f"Success at {current_difficulty} but readiness for {next_diff} is low ({next_readiness:.0%}). Continue consolidating."
                    )
            else:
                return (
                    "maintain",
                    "Hard",
                    0.9,
                    "Already at Hard difficulty. Excellent progress! Focus on mastery."
                )
        
        # Check success rate for edge cases
        if success_rate < self.SUCCESS_RATE_LOW and frustration < self.FRUSTRATION_THRESHOLD:
            # Struggling but not frustrated yet
            return (
                "maintain",
                current_difficulty,
                0.6,
                f"Success rate is low ({success_rate:.0%}) but you're persisting well. Keep practicing at {current_difficulty}."
            )
        
        if success_rate > self.SUCCESS_RATE_HIGH and boredom < self.BOREDOM_THRESHOLD:
            # Doing well but not bored
            next_readiness = readiness.get(
                self.difficulty_levels[min(current_idx + 1, 2)].lower(), 0.5
            )
            if next_readiness >= 0.5:
                next_diff = self.difficulty_levels[min(current_idx + 1, 2)]
                return (
                    "increase",
                    next_diff,
                    0.7,
                    f"Strong performance ({success_rate:.0%} success). Ready to tackle {next_diff} problems."
                )
        
        # Default: maintain current difficulty
        return (
            "maintain",
            current_difficulty,
            0.5,
            f"Steady progress at {current_difficulty}. Continue current trajectory."
        )
    
    def _cold_start_adjustment(self, readiness: Dict[str, float]) -> DifficultyAdjustment:
        """Handle users with no submission history."""
        # Start based on readiness (which might be from profile or defaults)
        if readiness.get("medium", 0.5) >= 0.6:
            start_difficulty = "Medium"
            reason = "Based on initial assessment, starting at Medium difficulty."
        else:
            start_difficulty = "Easy"
            reason = "Starting with Easy problems to build foundation."
        
        return DifficultyAdjustment(
            next_difficulty=start_difficulty,
            adjustment="maintain",
            confidence=0.4,  # Low confidence due to cold start
            reason=reason,
            frustration_index=0.0,
            boredom_index=0.0,
            current_readiness=readiness,
        )
    
    def _parse_datetime(self, dt_value) -> datetime:
        """Parse datetime from various formats. Always returns timezone-aware datetime."""
        if isinstance(dt_value, datetime):
            if dt_value.tzinfo is None:
                return dt_value.replace(tzinfo=timezone.utc)
            return dt_value
        if isinstance(dt_value, str):
            try:
                dt = datetime.fromisoformat(dt_value.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except:
                return datetime.now(timezone.utc)
        return datetime.now(timezone.utc)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 2.3: OUTCOME VALIDATION & ANTI-OSCILLATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_cooldown(
        self,
        submissions: List[Dict],
        last_adjustment: Optional[Dict],
    ) -> bool:
        """
        Phase 2.3: Check if we're in cooldown period after a difficulty change.
        
        Prevents rapid oscillation by requiring N submissions before next change.
        """
        if not last_adjustment:
            return False
        
        last_change = last_adjustment.get("adjustment", "maintain")
        if last_change == "maintain":
            return False
        
        # Count submissions since last adjustment
        last_timestamp = last_adjustment.get("timestamp")
        if not last_timestamp:
            return False
        
        try:
            last_dt = self._parse_datetime(last_timestamp)
            submissions_since = 0
            
            for sub in submissions:
                sub_time = sub.get("created_at") or sub.get("timestamp")
                if sub_time:
                    sub_dt = self._parse_datetime(sub_time)
                    if sub_dt > last_dt:
                        submissions_since += 1
            
            return submissions_since < self.COOLDOWN_SUBMISSIONS
        except Exception:
            return False
    
    def _detect_oscillation(self, submissions: List[Dict]) -> bool:
        """
        Phase 2.3: Detect difficulty oscillation pattern.
        
        Oscillation = alternating difficulty changes (up/down/up or down/up/down).
        """
        if len(submissions) < self.OSCILLATION_LOOKBACK:
            return False
        
        recent = submissions[:self.OSCILLATION_LOOKBACK]
        
        # Extract difficulty sequence
        difficulties = []
        for sub in recent:
            diff = sub.get("difficulty", "")
            if diff:
                difficulties.append(diff)
        
        if len(difficulties) < 6:
            return False
        
        # Check for oscillation pattern
        changes = []
        for i in range(1, min(len(difficulties), 10)):
            prev_idx = self.difficulty_order.get(difficulties[i-1], 1)
            curr_idx = self.difficulty_order.get(difficulties[i], 1)
            if curr_idx > prev_idx:
                changes.append("up")
            elif curr_idx < prev_idx:
                changes.append("down")
        
        # Oscillation = alternating up/down at least 3 times
        if len(changes) < 4:
            return False
        
        oscillations = 0
        for i in range(1, len(changes)):
            if changes[i] != changes[i-1] and changes[i] in ("up", "down"):
                oscillations += 1
        
        return oscillations >= 3
    
    def _validate_outcome(
        self,
        submissions: List[Dict],
        last_adjustment: Dict,
    ) -> Tuple[bool, float]:
        """
        Phase 2.3: Validate whether previous adjustment was effective.
        
        Returns: (is_validated, effectiveness_score)
        
        Effectiveness = success rate improvement after adjustment.
        """
        if not last_adjustment:
            return False, 0.0
        
        last_change = last_adjustment.get("adjustment", "maintain")
        if last_change == "maintain":
            return True, 0.5  # Maintain is neutral
        
        last_timestamp = last_adjustment.get("timestamp")
        if not last_timestamp:
            return False, 0.0
        
        try:
            last_dt = self._parse_datetime(last_timestamp)
            
            # Split submissions into before and after adjustment
            before = []
            after = []
            
            for sub in submissions:
                sub_time = sub.get("created_at") or sub.get("timestamp")
                if sub_time:
                    sub_dt = self._parse_datetime(sub_time)
                    if sub_dt > last_dt:
                        after.append(sub)
                    else:
                        before.append(sub)
            
            if len(after) < self.OUTCOME_VALIDATION_WINDOW:
                return False, 0.0  # Not enough data to validate
            
            # Compute success rates
            after_success = sum(
                1 for s in after[:self.OUTCOME_VALIDATION_WINDOW]
                if s.get("verdict", "").lower() == "accepted"
            ) / self.OUTCOME_VALIDATION_WINDOW
            
            before_window = before[:self.OUTCOME_VALIDATION_WINDOW] if before else []
            before_success = (
                sum(1 for s in before_window if s.get("verdict", "").lower() == "accepted")
                / len(before_window)
            ) if before_window else 0.5
            
            # Effectiveness depends on adjustment direction
            if last_change == "increase":
                # Increase is good if success rate didn't drop too much
                effectiveness = 0.5 + (after_success - before_success + 0.2) / 0.4
            else:  # decrease
                # Decrease is good if success rate improved
                effectiveness = 0.5 + (after_success - before_success) / 0.4
            
            effectiveness = max(0.0, min(1.0, effectiveness))
            is_validated = effectiveness >= self.MIN_ADJUSTMENT_EFFECTIVENESS
            
            return is_validated, round(effectiveness, 3)
            
        except Exception:
            return False, 0.0
    
    def _consider_rollback(
        self,
        last_adjustment: Dict,
        current_difficulty: str,
    ) -> Optional[Dict]:
        """
        Phase 2.3: Consider rolling back a harmful adjustment.
        
        Returns rollback recommendation or None.
        """
        last_change = last_adjustment.get("adjustment", "maintain")
        
        if last_change == "maintain":
            return None
        
        current_idx = self.difficulty_order.get(current_difficulty, 1)
        
        if last_change == "increase":
            # Roll back: decrease difficulty
            if current_idx > 0:
                return {
                    "next_difficulty": self.difficulty_levels[current_idx - 1],
                    "adjustment": "decrease",
                    "reason": "Previous difficulty increase was ineffective. Rolling back to consolidate.",
                }
        elif last_change == "decrease":
            # Roll back: increase difficulty (user was better than expected)
            if current_idx < len(self.difficulty_levels) - 1:
                return {
                    "next_difficulty": self.difficulty_levels[current_idx + 1],
                    "adjustment": "increase",
                    "reason": "Previous difficulty decrease was unnecessary. User performance was better.",
                }
        
        return None


# Singleton instance
_difficulty_engine = None


def get_difficulty_engine() -> DifficultyEngine:
    """Get singleton difficulty engine instance."""
    global _difficulty_engine
    if _difficulty_engine is None:
        _difficulty_engine = DifficultyEngine()
    return _difficulty_engine


def compute_difficulty_adjustment(
    submissions: List[Dict],
    readiness: Dict[str, float],
    user_profile: Optional[Dict] = None,
) -> Dict:
    """
    Convenience function to compute difficulty adjustment.
    
    Args:
        submissions: Recent submissions with verdict, difficulty, timestamp
        readiness: Dict with easy/medium/hard success probabilities
        user_profile: Optional user profile
        
    Returns:
        Dict with adjustment recommendation
    """
    engine = get_difficulty_engine()
    result = engine.compute_adjustment(submissions, readiness, user_profile)
    return result.to_dict()
