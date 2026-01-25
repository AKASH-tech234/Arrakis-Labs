"""
MIM Difficulty Adjustment Engine
================================

Computes personalized difficulty recommendations based on:
- Recent performance patterns
- Frustration/boredom indices
- User readiness scores
- Learning velocity

This is NOT just "solved medium → give hard"
It's "solved medium with struggle → give medium-hard same concept"

Difficulty = Problem Complexity × User Readiness
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging

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
    
    def to_dict(self) -> Dict:
        return {
            "next_difficulty": self.next_difficulty,
            "adjustment": self.adjustment,
            "confidence": self.confidence,
            "reason": self.reason,
            "frustration_index": self.frustration_index,
            "boredom_index": self.boredom_index,
            "current_readiness": self.current_readiness,
        }


class DifficultyEngine:
    """
    Personalized difficulty adjustment engine.
    
    Key insight: Difficulty ≠ problem complexity
                 Difficulty = problem × user readiness
    """
    
    # Thresholds for adjustment decisions
    FRUSTRATION_THRESHOLD = 0.6  # Above this, consider decreasing difficulty
    BOREDOM_THRESHOLD = 0.7  # Above this, consider increasing difficulty
    SUCCESS_RATE_LOW = 0.3  # Below this, user is struggling
    SUCCESS_RATE_HIGH = 0.8  # Above this, user might be bored
    
    # Time windows for analysis
    RECENT_WINDOW_SUBMISSIONS = 10  # Last N submissions for recent analysis
    SHORT_WINDOW_MINUTES = 30  # For frustration detection
    
    def __init__(self):
        self.difficulty_levels = ["Easy", "Medium", "Hard"]
        self.difficulty_order = {"Easy": 0, "Medium": 1, "Hard": 2}
        
    def compute_adjustment(
        self,
        submissions: List[Dict],
        current_readiness: Dict[str, float],
        user_profile: Optional[Dict] = None,
    ) -> DifficultyAdjustment:
        """
        Compute difficulty adjustment based on user performance.
        
        Args:
            submissions: Recent submissions with verdict, difficulty, timestamp
            current_readiness: Dict with easy/medium/hard success probabilities
            user_profile: Optional user profile with learning style, goals
            
        Returns:
            DifficultyAdjustment with recommendation and supporting metrics
        """
        if not submissions:
            return self._cold_start_adjustment(current_readiness)
        
        # Compute indices
        frustration = self._compute_frustration_index(submissions)
        boredom = self._compute_boredom_index(submissions)
        recent_success_rate = self._compute_recent_success_rate(submissions)
        current_difficulty = self._estimate_current_difficulty(submissions)
        
        # Determine adjustment
        adjustment, next_difficulty, confidence, reason = self._decide_adjustment(
            current_difficulty=current_difficulty,
            frustration=frustration,
            boredom=boredom,
            success_rate=recent_success_rate,
            readiness=current_readiness,
            user_profile=user_profile,
        )
        
        return DifficultyAdjustment(
            next_difficulty=next_difficulty,
            adjustment=adjustment,
            confidence=confidence,
            reason=reason,
            frustration_index=frustration,
            boredom_index=boredom,
            current_readiness=current_readiness,
        )
    
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
        now = datetime.now()
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
        """Parse datetime from various formats."""
        if isinstance(dt_value, datetime):
            return dt_value
        if isinstance(dt_value, str):
            try:
                return datetime.fromisoformat(dt_value.replace("Z", "+00:00"))
            except:
                return datetime.now()
        return datetime.now()


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
