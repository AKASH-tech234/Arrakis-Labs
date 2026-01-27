"""
Pattern Engine - Deterministic Pattern Detection
================================================

v3.0: Replaces pattern_detection_agent with NO LLM CALL.

This module detects mistake patterns using:
1. MIM ML model prediction (root cause → pattern mapping)
2. User history lookup (exact match from past submissions)
3. Keyword matching (fallback for simple patterns)

PHILOSOPHY:
- Pattern detection is DETERMINISTIC, not generative
- Historical patterns are more reliable than LLM guesses
- ML model provides structured pattern categories

ELIMINATES:
- pattern_detection_agent LLM call (~15-25 seconds)
- Duplicate pattern reasoning with MIM root cause
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import Counter

from app.mim.mim_decision import PatternResult

logger = logging.getLogger("mim.pattern_engine")


# ═══════════════════════════════════════════════════════════════════════════════
# ROOT CAUSE TO PATTERN MAPPING (V3.1 TAXONOMY)
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSE_TO_PATTERNS = {
    # V3.1 ROOT CAUSES (primary categories)
    "correctness": [
        "incorrect algorithm logic",
        "wrong invariant maintained",
        "missing case handling",
        "incorrect boundary condition",
    ],
    "efficiency": [
        "O(n²) when O(n) expected",
        "brute force when pattern exists",
        "unnecessary nested loops",
        "suboptimal data structure choice",
    ],
    "implementation": [
        "off-by-one in loop termination",
        "array index boundary error",
        "state loss in iteration",
        "type conversion error",
    ],
    "understanding_gap": [
        "problem misunderstanding",
        "constraint ignored",
        "requirement missed",
        "misread constraint value",
    ],
    "problem_misinterpretation": [
        "wrong input format assumption",
        "solving different problem entirely",
        "misread constraints fundamentally",
        "wrong output format produced",
    ],
    # SUBTYPES (for more specific pattern matching)
    "wrong_invariant": [
        "incorrect loop invariant",
        "property not preserved",
        "algorithm correctness flaw",
    ],
    "incorrect_boundary": [
        "off-by-one error",
        "fence post error",
        "boundary condition missing",
    ],
    "partial_case_handling": [
        "edge case missing",
        "empty input not handled",
        "single element edge case",
    ],
    "state_loss": [
        "state overwritten incorrectly",
        "variable scope issue",
        "information lost in iteration",
    ],
    "brute_force_under_constraints": [
        "brute force instead of optimization",
        "unnecessary nested loops",
        "exponential when polynomial exists",
    ],
    "premature_optimization": [
        "optimized but incorrect",
        "edge case broken by optimization",
        "complexity reduced but wrong result",
    ],
    "misread_constraint": [
        "constraint value ignored",
        "limit misunderstood",
        "modulo forgotten for large numbers",
    ],
    "wrong_input_format": [
        "input parsing error",
        "format assumption wrong",
        "wrong data structure for input",
    ],
    "wrong_problem_entirely": [
        "solving unrelated problem",
        "output format completely wrong",
        "algorithm for different problem type",
    ],
    "misread_constraints": [
        "constraint values wrong",
        "integer overflow from constraint",
        "limits ignored in solution",
    ],
    # LEGACY MAPPINGS (for backward compatibility with old data)
    "boundary_condition_blindness": [
        "empty input not handled",
        "single element edge case",
        "boundary condition missing",
    ],
    "off_by_one_error": [
        "off-by-one in loop termination",
        "array index boundary error",
        "fence post error",
    ],
    "integer_overflow": [
        "integer overflow in computation",
        "large number handling missing",
        "modulo operation forgotten",
    ],
    "wrong_data_structure": [
        "suboptimal data structure choice",
        "using array when hashmap needed",
        "wrong container for range queries",
    ],
    "logic_error": [
        "incorrect algorithm logic",
        "inverted condition",
        "wrong comparison operator",
    ],
    "time_complexity_issue": [
        "O(n²) when O(n) expected",
        "unnecessary nested loops",
        "brute force instead of optimization",
    ],
    "algorithm_choice": [
        "wrong algorithm for problem type",
        "greedy when DP needed",
        "brute force when pattern exists",
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# VERDICT TO PATTERN HINTS
# ═══════════════════════════════════════════════════════════════════════════════

VERDICT_PATTERN_HINTS = {
    "time_limit_exceeded": [
        "O(n²) when O(n) expected",
        "brute force instead of optimization",
        "unnecessary nested loops",
    ],
    "runtime_error": [
        "array index boundary error",
        "null pointer access",
        "stack overflow from deep recursion",
    ],
    "wrong_answer": [
        "edge case missing",
        "off-by-one in loop termination",
        "incorrect algorithm logic",
    ],
    "memory_limit_exceeded": [
        "excessive memory allocation",
        "missing space optimization",
        "storing unnecessary data",
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN ENGINE CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class PatternEngine:
    """
    Deterministic pattern detection engine.
    
    NO LLM CALLS - uses rules, history lookup, and ML predictions.
    """
    
    def __init__(self):
        self.logger = logging.getLogger("mim.pattern_engine")
    
    def detect_pattern(
        self,
        root_cause: str,
        root_cause_confidence: float,
        verdict: str,
        user_history: List[Dict[str, Any]],
        user_memory: Optional[List[str]] = None,
        problem_tags: Optional[List[str]] = None,
    ) -> PatternResult:
        """
        Detect mistake pattern using multiple strategies.
        
        Strategy Order:
        1. Check if MIM root cause matches a past pattern (HIGH confidence)
        2. Map MIM root cause to pattern category (MEDIUM confidence)
        3. Use verdict-based hints (LOW confidence)
        
        Args:
            root_cause: MIM-predicted root cause
            root_cause_confidence: Confidence in root cause
            verdict: Submission verdict
            user_history: Past submissions from MongoDB
            user_memory: RAG-retrieved memory chunks
            problem_tags: Problem category tags
            
        Returns:
            PatternResult with pattern info
        """
        self.logger.info(f"🔍 Pattern detection starting | root_cause={root_cause}")
        
        # Strategy 1: Check user history for recurring pattern
        history_result = self._check_user_history(
            root_cause, user_history, user_memory
        )
        
        if history_result["is_recurring"]:
            self.logger.info(
                f"✅ Found recurring pattern: {history_result['pattern']} "
                f"(count: {history_result['count']})"
            )
            return PatternResult(
                pattern_name=history_result["pattern"],
                is_recurring=True,
                recurrence_count=history_result["count"],
                last_occurrence=history_result["last_occurrence"],
                confidence=min(0.95, root_cause_confidence + 0.1),  # Boost for recurrence
                detection_method="history_lookup",
            )
        
        # Strategy 2: Map root cause to pattern category
        if root_cause in ROOT_CAUSE_TO_PATTERNS:
            patterns = ROOT_CAUSE_TO_PATTERNS[root_cause]
            # Select most specific pattern based on context
            pattern = self._select_best_pattern(patterns, verdict, problem_tags)
            
            self.logger.info(f"✅ Mapped root cause to pattern: {pattern}")
            return PatternResult(
                pattern_name=pattern,
                is_recurring=False,
                recurrence_count=0,
                last_occurrence=None,
                confidence=root_cause_confidence * 0.9,  # Slightly lower than ML
                detection_method="ml_model",
            )
        
        # Strategy 3: Use verdict-based hints
        verdict_lower = verdict.lower().replace(" ", "_")
        if verdict_lower in VERDICT_PATTERN_HINTS:
            hints = VERDICT_PATTERN_HINTS[verdict_lower]
            pattern = hints[0]  # Most common for this verdict
            
            self.logger.info(f"⚠️ Using verdict-based pattern: {pattern}")
            return PatternResult(
                pattern_name=pattern,
                is_recurring=False,
                recurrence_count=0,
                last_occurrence=None,
                confidence=0.5,  # Lower confidence for verdict-only
                detection_method="keyword_match",
            )
        
        # No pattern detected
        self.logger.info("ℹ️ No clear pattern detected")
        return PatternResult(
            pattern_name=None,
            is_recurring=False,
            recurrence_count=0,
            last_occurrence=None,
            confidence=0.0,
            detection_method="none",
        )
    
    def _check_user_history(
        self,
        root_cause: str,
        user_history: List[Dict[str, Any]],
        user_memory: Optional[List[str]],
    ) -> Dict[str, Any]:
        """
        Check if user has made this mistake before.
        
        Looks for:
        1. Past submissions with same error type
        2. Past feedback mentioning similar patterns
        3. RAG memories with pattern keywords
        """
        result = {
            "is_recurring": False,
            "pattern": None,
            "count": 0,
            "last_occurrence": None,
        }
        
        if not user_history:
            return result
        
        # Map root cause to keywords for matching
        root_cause_keywords = self._get_root_cause_keywords(root_cause)
        
        # Count past occurrences
        occurrences = []
        
        for submission in user_history:
            # Check if submission has similar error
            error_type = submission.get("error_type", "")
            verdict = submission.get("verdict", submission.get("status", ""))
            feedback = submission.get("ai_feedback", {})
            
            # Direct match on root_cause field (from labeled data or previous MIM predictions)
            past_root_cause = submission.get("root_cause", "")
            if past_root_cause and past_root_cause == root_cause:
                occurrences.append(submission)
                continue
            
            # Match on error type
            if any(kw in error_type.lower() for kw in root_cause_keywords):
                occurrences.append(submission)
                continue
            
            # Match on feedback pattern
            detected_pattern = feedback.get("detected_pattern", "")
            if detected_pattern and any(kw in detected_pattern.lower() for kw in root_cause_keywords):
                occurrences.append(submission)
                continue
            
            # Match on feedback explanation
            explanation = feedback.get("explanation", "")
            if explanation and sum(1 for kw in root_cause_keywords if kw in explanation.lower()) >= 2:
                occurrences.append(submission)
        
        # Also check RAG memories
        if user_memory:
            memory_matches = sum(
                1 for mem in user_memory
                if any(kw in mem.lower() for kw in root_cause_keywords)
            )
            # If memory shows pattern, boost count
            if memory_matches >= 2:
                occurrences.extend([{"_source": "memory"}] * min(memory_matches, 3))
        
        if occurrences:
            # Get pattern name from root cause mapping
            if root_cause in ROOT_CAUSE_TO_PATTERNS:
                pattern = ROOT_CAUSE_TO_PATTERNS[root_cause][0]
            else:
                pattern = root_cause.replace("_", " ")
            
            # Get last occurrence time
            last_time = None
            for occ in occurrences:
                if occ.get("createdAt"):
                    try:
                        if isinstance(occ["createdAt"], str):
                            occ_time = datetime.fromisoformat(occ["createdAt"].replace("Z", "+00:00"))
                        else:
                            occ_time = occ["createdAt"]
                        if last_time is None or occ_time > last_time:
                            last_time = occ_time
                    except:
                        pass
            
            result = {
                "is_recurring": len(occurrences) >= 2,  # At least 2 past occurrences
                "pattern": pattern,
                "count": len(occurrences),
                "last_occurrence": last_time.isoformat() if last_time else None,
            }
        
        return result
    
    def _get_root_cause_keywords(self, root_cause: str) -> List[str]:
        """Get keywords for matching root cause in history."""
        keyword_map = {
            "boundary_condition_blindness": ["boundary", "edge", "empty", "null", "zero"],
            "off_by_one_error": ["off by one", "off-by-one", "index", "boundary", "< vs <="],
            "integer_overflow": ["overflow", "long", "large", "modulo", "mod"],
            "wrong_data_structure": ["data structure", "hashmap", "set", "array"],
            "logic_error": ["logic", "wrong", "incorrect", "bug"],
            "time_complexity_issue": ["tle", "timeout", "slow", "o(n²)", "o(n^2)", "complexity"],
            "recursion_issue": ["recursion", "stack", "base case", "infinite"],
            "comparison_error": ["comparison", "operator", "< vs <=", "> vs >="],
            "algorithm_choice": ["algorithm", "approach", "greedy", "dp", "wrong method"],
            "edge_case_handling": ["edge case", "corner", "special case"],
            "input_parsing": ["parse", "input", "format"],
            "misread_problem": ["misread", "misunderstand", "constraint"],
            "partial_solution": ["incomplete", "partial", "missing"],
            "type_error": ["type", "cast", "conversion"],
        }
        
        return keyword_map.get(root_cause, root_cause.replace("_", " ").split())
    
    def _select_best_pattern(
        self,
        patterns: List[str],
        verdict: str,
        problem_tags: Optional[List[str]],
    ) -> str:
        """
        Select the most appropriate pattern from candidates.
        
        Uses verdict and problem tags to narrow down.
        """
        verdict_lower = verdict.lower()
        
        # TLE → prefer complexity patterns
        if "time" in verdict_lower or "tle" in verdict_lower:
            for p in patterns:
                if "o(n" in p.lower() or "complexity" in p.lower() or "loop" in p.lower():
                    return p
        
        # Runtime error → prefer boundary/null patterns
        if "runtime" in verdict_lower or "error" in verdict_lower:
            for p in patterns:
                if "boundary" in p.lower() or "null" in p.lower() or "index" in p.lower():
                    return p
        
        # Default to first pattern
        return patterns[0]
    
    def get_pattern_advice(self, pattern: PatternResult) -> Dict[str, str]:
        """
        Get advice for addressing a pattern.
        
        Used to populate feedback and learning instructions.
        """
        if not pattern.pattern_name:
            return {"advice": "", "prevention": ""}
        
        pattern_advice = {
            "off-by-one in loop termination": {
                "advice": "Check loop bounds carefully. Use 'less than' vs 'less than or equal'.",
                "prevention": "Always trace through first and last iterations manually.",
            },
            "empty input not handled": {
                "advice": "Add explicit checks for empty/null inputs at the start.",
                "prevention": "Make 'check empty input' part of your coding checklist.",
            },
            "O(n²) when O(n) expected": {
                "advice": "Look for opportunities to use hashmap or two-pointer techniques.",
                "prevention": "Check constraints: if n > 10^4, O(n²) will likely TLE.",
            },
            # Add more pattern-specific advice...
        }
        
        return pattern_advice.get(
            pattern.pattern_name,
            {
                "advice": f"Review the {pattern.pattern_name} pattern.",
                "prevention": "Add this to your mental checklist for future problems.",
            }
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCE
# ═══════════════════════════════════════════════════════════════════════════════

_pattern_engine_instance = None


def get_pattern_engine() -> PatternEngine:
    """Get singleton PatternEngine instance."""
    global _pattern_engine_instance
    if _pattern_engine_instance is None:
        _pattern_engine_instance = PatternEngine()
    return _pattern_engine_instance
