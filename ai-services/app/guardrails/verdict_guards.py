"""
Verdict Guards Module - Orchestration Protection
=================================================

Implements verdict-based guardrails to prevent:
1. MIM diagnosis on Accepted submissions
2. RAG retrieval when unnecessary
3. Hint agent on successful solutions
4. Negative root causes on correct code

AUTHORITATIVE DECISION TABLE:
╔═════════════╦═══════════╦══════════╦═════════╦═══════════╦════════════════════════╗
║ Verdict     ║ Difficulty║ Run MIM  ║ Run RAG ║ Run Hint  ║ Notes                  ║
╠═════════════╬═══════════╬══════════╬═════════╬═══════════╬════════════════════════╣
║ Accepted    ║ Easy      ║ ❌ NO    ║ ❌ NO   ║ ❌ NO     ║ Reinforcement only     ║
║ Accepted    ║ Medium    ║ ❌ NO    ║ ⚠️ Light ║ ❌ NO     ║ Pattern confirmation   ║
║ Accepted    ║ Hard      ║ ⚠️ Light ║ ⚠️ Light ║ ❌ NO     ║ Skill validation       ║
║ Wrong Answer║ Any       ║ ✅ YES   ║ ✅ YES  ║ ✅ YES    ║ Full pipeline          ║
║ TLE         ║ Any       ║ ✅ YES   ║ ✅ YES  ║ ✅ YES    ║ Algorithm focus        ║
║ Runtime Err ║ Any       ║ ✅ YES   ║ ✅ YES  ║ ✅ YES    ║ Safety & correctness   ║
╚═════════════╩═══════════╩══════════╩═════════╩═══════════╩════════════════════════╝

REINFORCEMENT SIGNAL (for Accepted):
- No root cause diagnosis
- No error labels
- No confidence penalties
- Only positive pattern confirmation
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger("guardrails.verdict")


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class Verdict(Enum):
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    TLE = "time_limit_exceeded"
    RUNTIME_ERROR = "runtime_error"
    COMPILE_ERROR = "compile_error"
    
    @classmethod
    def from_string(cls, s: str) -> "Verdict":
        """Parse verdict from string (case-insensitive)."""
        normalized = s.lower().strip().replace(" ", "_")
        
        # Handle aliases
        aliases = {
            "ac": "accepted",
            "wa": "wrong_answer",
            "wrong": "wrong_answer",
            "tle": "time_limit_exceeded",
            "timeout": "time_limit_exceeded",
            "re": "runtime_error",
            "rte": "runtime_error",
            "ce": "compile_error",
        }
        normalized = aliases.get(normalized, normalized)
        
        try:
            return cls(normalized)
        except ValueError:
            # Default to wrong_answer for unknown verdicts
            logger.warning(f"Unknown verdict '{s}', treating as wrong_answer")
            return cls.WRONG_ANSWER
    
    def is_success(self) -> bool:
        return self == Verdict.ACCEPTED
    
    def is_failure(self) -> bool:
        return self != Verdict.ACCEPTED


class Difficulty(Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"
    
    @classmethod
    def from_string(cls, s: str) -> "Difficulty":
        normalized = s.strip().title()
        try:
            return cls(normalized)
        except ValueError:
            return cls.MEDIUM


# ═══════════════════════════════════════════════════════════════════════════════
# DECISION RESULT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VerdictGuardResult:
    """Result of verdict guard check."""
    # What to skip
    skip_mim: bool
    skip_rag: bool
    skip_hint: bool
    skip_learning_diagnosis: bool
    
    # What to do instead
    use_success_path: bool
    create_reinforcement: bool
    
    # Metadata
    verdict: Verdict
    difficulty: Difficulty
    rationale: str


# ═══════════════════════════════════════════════════════════════════════════════
# VERDICT GUARD CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class VerdictGuard:
    """
    Central verdict-based guardrail.
    
    Ensures:
    - Accepted submissions get reinforcement, not diagnosis
    - MIM only runs for failures
    - No hints for successful solutions
    """
    
    @staticmethod
    def check(
        verdict: str,
        difficulty: str = "Medium",
        has_user_history: bool = False,
    ) -> VerdictGuardResult:
        """
        Check what operations should be skipped based on verdict.
        
        Args:
            verdict: Submission verdict (accepted, wrong_answer, etc.)
            difficulty: Problem difficulty
            has_user_history: Whether user has submission history
            
        Returns:
            VerdictGuardResult with skip flags and recommendations
        """
        v = Verdict.from_string(verdict)
        d = Difficulty.from_string(difficulty)
        
        if v.is_success():
            return VerdictGuard._handle_accepted(v, d, has_user_history)
        else:
            return VerdictGuard._handle_failure(v, d, has_user_history)
    
    @staticmethod
    def _handle_accepted(
        verdict: Verdict,
        difficulty: Difficulty,
        has_user_history: bool,
    ) -> VerdictGuardResult:
        """Handle Accepted verdict - REINFORCEMENT ONLY path."""
        
        # Easy: Skip everything, just celebrate
        if difficulty == Difficulty.EASY:
            return VerdictGuardResult(
                skip_mim=True,
                skip_rag=True,
                skip_hint=True,
                skip_learning_diagnosis=True,
                use_success_path=True,
                create_reinforcement=True,
                verdict=verdict,
                difficulty=difficulty,
                rationale="Easy problem accepted - reinforcement only, no diagnosis"
            )
        
        # Medium: Light RAG for pattern confirmation, no MIM
        if difficulty == Difficulty.MEDIUM:
            return VerdictGuardResult(
                skip_mim=True,
                skip_rag=not has_user_history,  # Only RAG if history exists
                skip_hint=True,
                skip_learning_diagnosis=True,
                use_success_path=True,
                create_reinforcement=True,
                verdict=verdict,
                difficulty=difficulty,
                rationale="Medium problem accepted - pattern confirmation, no diagnosis"
            )
        
        # Hard: Light MIM for skill validation, light RAG
        return VerdictGuardResult(
            skip_mim=False,  # But MIM should use reinforcement mode
            skip_rag=not has_user_history,
            skip_hint=True,
            skip_learning_diagnosis=True,
            use_success_path=True,
            create_reinforcement=True,
            verdict=verdict,
            difficulty=difficulty,
            rationale="Hard problem accepted - skill validation, reinforcement mode"
        )
    
    @staticmethod
    def _handle_failure(
        verdict: Verdict,
        difficulty: Difficulty,
        has_user_history: bool,
    ) -> VerdictGuardResult:
        """Handle failure verdict - FULL PIPELINE."""
        return VerdictGuardResult(
            skip_mim=False,
            skip_rag=False,
            skip_hint=False,
            skip_learning_diagnosis=False,
            use_success_path=False,
            create_reinforcement=False,
            verdict=verdict,
            difficulty=difficulty,
            rationale=f"{verdict.value} - full diagnostic pipeline"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SUCCESS PATH - REINFORCEMENT SIGNAL GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ReinforcementSignal:
    """
    Positive learning signal for MIM (replaces diagnosis for Accepted).
    
    This is what MIM learns from SUCCESS, not failure.
    """
    type: str = "reinforcement"
    problem_id: str = ""
    difficulty: str = "Medium"
    
    # Confirmed patterns (what user did RIGHT)
    confirmed_patterns: Optional[List[str]] = None
    
    # Execution quality
    execution_quality: Optional[Dict[str, str]] = None
    
    # Confidence boost for MIM calibration
    confidence_boost: float = 0.05
    
    # Skill tags to reinforce
    skill_tags: Optional[List[str]] = None
    
    def __post_init__(self):
        self.confirmed_patterns = self.confirmed_patterns or []
        self.execution_quality = self.execution_quality or {}
        self.skill_tags = self.skill_tags or []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "problem_id": self.problem_id,
            "difficulty": self.difficulty,
            "confirmed_patterns": self.confirmed_patterns,
            "execution_quality": self.execution_quality,
            "confidence_boost": self.confidence_boost,
            "skill_tags": self.skill_tags,
        }


def create_reinforcement_signal(
    problem_id: str,
    difficulty: str,
    problem_tags: Optional[List[str]] = None,
    canonical_algorithms: Optional[List[str]] = None,
    code_length: int = 0,
    execution_time: Optional[float] = None,
) -> ReinforcementSignal:
    """
    Create a reinforcement signal for an Accepted submission.
    
    This signal is used by MIM to calibrate confidence and
    by learning_agent to store positive patterns.
    """
    # Infer confirmed patterns from problem metadata
    confirmed_patterns = []
    
    if canonical_algorithms:
        confirmed_patterns.append("correct algorithm selection")
        confirmed_patterns.extend([f"proper use of {algo}" for algo in canonical_algorithms[:2]])
    
    # Always assume good boundary handling for Accepted
    confirmed_patterns.append("boundary handling")
    confirmed_patterns.append("time complexity awareness")
    
    # Execution quality
    execution_quality = {
        "time": "within limits",
        "space": "acceptable",
        "style": "clear" if code_length < 2000 else "complex"
    }
    
    # Skill tags from problem tags
    skill_tags = (problem_tags or [])[:5]
    
    return ReinforcementSignal(
        problem_id=problem_id,
        difficulty=difficulty,
        confirmed_patterns=confirmed_patterns,
        execution_quality=execution_quality,
        confidence_boost=_calculate_confidence_boost(difficulty),
        skill_tags=skill_tags,
    )


def _calculate_confidence_boost(difficulty: str) -> float:
    """Calculate confidence boost based on difficulty."""
    boosts = {
        "Easy": 0.02,
        "Medium": 0.05,
        "Hard": 0.08,
    }
    return boosts.get(difficulty, 0.05)


# ═══════════════════════════════════════════════════════════════════════════════
# SUCCESS PATH - FEEDBACK GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def get_success_path(
    difficulty: str,
    problem_category: str = "",
    canonical_algorithms: Optional[List[str]] = None,
    user_streak: int = 0,
) -> Dict[str, Any]:
    """
    Generate success feedback path (NO LLM call needed).
    
    Returns a pre-computed success response that can be sent
    directly to the frontend without any agent processing.
    """
    d = Difficulty.from_string(difficulty)
    
    # Base celebration message
    if d == Difficulty.EASY:
        celebration = "Well done! You've solved this problem correctly."
        next_action = "Ready to try something a bit more challenging?"
    elif d == Difficulty.MEDIUM:
        celebration = "Excellent work! Your solution demonstrates solid problem-solving skills."
        next_action = "Consider exploring variations or optimizations."
    else:
        celebration = "Outstanding! Solving this hard problem shows advanced understanding."
        next_action = "You're ready for the most challenging problems in this category."
    
    # Pattern confirmation
    pattern_note = None
    if canonical_algorithms:
        algo_names = [a.replace("_", " ") for a in canonical_algorithms[:2]]
        pattern_note = f"Your solution correctly applies {' and '.join(algo_names)}."
    
    # Streak bonus
    streak_note = None
    if user_streak >= 3:
        streak_note = f"🔥 {user_streak} problems solved in a row!"
    
    return {
        "is_success": True,
        "celebration": celebration,
        "pattern_confirmation": pattern_note,
        "streak_note": streak_note,
        "next_action": next_action,
        "optimization_available": d != Difficulty.EASY,
        "show_complexity_analysis": d == Difficulty.HARD,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def should_skip_mim(verdict: str, difficulty: str = "Medium") -> bool:
    """Check if MIM should be skipped for this verdict/difficulty."""
    result = VerdictGuard.check(verdict, difficulty)
    return result.skip_mim


def should_skip_rag(verdict: str, difficulty: str = "Medium", has_history: bool = False) -> bool:
    """Check if RAG retrieval should be skipped."""
    result = VerdictGuard.check(verdict, difficulty, has_history)
    return result.skip_rag


def should_skip_hint(verdict: str) -> bool:
    """Check if hint agent should be skipped."""
    v = Verdict.from_string(verdict)
    return v.is_success()


def is_success_verdict(verdict: str) -> bool:
    """Check if verdict indicates success."""
    return Verdict.from_string(verdict).is_success()


def is_failure_verdict(verdict: str) -> bool:
    """Check if verdict indicates failure."""
    return Verdict.from_string(verdict).is_failure()
