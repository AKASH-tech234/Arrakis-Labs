"""
Pattern Engine - Deterministic Pattern Detection
================================================

v3.0: Replaces pattern_detection_agent with NO LLM CALL.
v3.1: Phase 2.2 - Confidence-aware, stateful, decay-safe patterns.

This module detects mistake patterns using:
1. MIM ML model prediction (root cause → pattern mapping)
2. User history lookup (exact match from past submissions)
3. Keyword matching (fallback for simple patterns)

PHILOSOPHY:
- Pattern detection is DETERMINISTIC, not generative
- Historical patterns are more reliable than LLM guesses
- ML model provides structured pattern categories

Phase 2.2 Additions:
- Confidence gating: Low confidence → NO pattern claims
- Pattern states: NONE → SUSPECTED → CONFIRMED → STABLE
- Temporal decay: Old patterns lose weight
- Evidence scoring: Weighted by confidence and recency

ELIMINATES:
- pattern_detection_agent LLM call (~15-25 seconds)
- Duplicate pattern reasoning with MIM root cause
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta, timezone
from collections import Counter
import math

from app.mim.mim_decision import PatternResult
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
    
    Phase 2.2 Upgrades:
    - CONFIDENCE GATING: Low confidence → NO pattern claims (CRITICAL)
    - Pattern states: NONE → SUSPECTED → CONFIRMED → STABLE
    - Temporal decay: Recent occurrences weighted higher
    - Evidence scoring: Weighted by confidence and recency
    - Partial mastery detection: Track improvement trajectories
    """
    
    # Temporal decay constants (Phase 2.2)
    DECAY_HALF_LIFE_DAYS = 14  # Occurrences half-weight after 14 days
    RECENCY_BOOST_DAYS = 3    # Strong boost for very recent occurrences
    
    # Mastery detection constants
    MASTERY_THRESHOLD = 3     # Consecutive successes to consider "mastering"
    REGRESSION_THRESHOLD = 2  # Consecutive failures after mastery = regression
    
    # Confidence thresholds (aligned with Phase 2.1)
    HIGH_CONFIDENCE_THRESHOLD = 0.80
    MEDIUM_CONFIDENCE_THRESHOLD = 0.65
    
    def __init__(self):
        self.logger = logging.getLogger("mim.pattern_engine")
        self.state_engine = PatternStateTransitionEngine()
    
    def detect_pattern(
        self,
        root_cause: str,
        root_cause_confidence: float,
        verdict: str,
        user_history: List[Dict[str, Any]],
        user_memory: Optional[List[str]] = None,
        problem_tags: Optional[List[str]] = None,
        confidence_metadata: Optional[Dict[str, Any]] = None,
    ) -> PatternResult:
        """
        Detect mistake pattern using multiple strategies.
        
        Phase 2.2: Now confidence-aware with explicit gating.
        
        Strategy Order:
        1. CONFIDENCE GATE: Low confidence → No pattern claims
        2. Check if MIM root cause matches a past pattern (HIGH confidence)
        3. Map MIM root cause to pattern category (MEDIUM confidence)
        4. Use verdict-based hints (LOW confidence - gated)
        
        Args:
            root_cause: MIM-predicted root cause
            root_cause_confidence: CALIBRATED confidence from MIM (Phase 2.1)
            verdict: Submission verdict
            user_history: Past submissions from MongoDB
            user_memory: RAG-retrieved memory chunks
            problem_tags: Problem category tags
            confidence_metadata: Full confidence metadata from MIM (Phase 2.1)
            
        Returns:
            PatternResult with pattern info and Phase 2.2 state
        """
        self.logger.info(
            f"🔍 Pattern detection starting | root_cause={root_cause}, "
            f"confidence={root_cause_confidence:.3f}"
        )
        
        # ─────────────────────────────────────────────────────────────────────
        # PHASE 2.2: CONFIDENCE GATE (CRITICAL - FIRST CHECK)
        # ─────────────────────────────────────────────────────────────────────
        confidence_tier = get_confidence_tier(root_cause_confidence)
        
        if not should_form_pattern(root_cause_confidence):
            self.logger.info(
                f"🚫 CONFIDENCE GATE: Low confidence ({root_cause_confidence:.3f}) - "
                f"NO pattern claims allowed"
            )
            return PatternResult(
                pattern_name=None,
                is_recurring=False,
                recurrence_count=0,
                last_occurrence=None,
                confidence=root_cause_confidence,
                detection_method="none",
                # Phase 2.2 fields
                pattern_state="none",
                evidence_strength=None,
                confidence_support="low_confidence_blocked",
                confidence_gated=True,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Strategy 1: Check user history for recurring pattern
        # ─────────────────────────────────────────────────────────────────────
        history_result = self._check_user_history_v2(
            root_cause=root_cause,
            root_cause_confidence=root_cause_confidence,
            user_history=user_history,
            user_memory=user_memory,
        )
        
        if history_result["has_evidence"]:
            pattern_record = history_result["pattern_record"]
            strength = self.state_engine.get_pattern_strength(pattern_record)
            
            self.logger.info(
                f"✅ Pattern detected: {pattern_record.pattern_name} | "
                f"state={pattern_record.state}, weighted={pattern_record.weighted_evidence:.2f}, "
                f"confidence_tier={confidence_tier}"
            )
            
            # Determine if pattern is "recurring" based on state
            is_recurring = pattern_record.state in (
                PatternState.CONFIRMED, PatternState.STABLE
            )
            
            # For SUSPECTED state with medium confidence, mark as suspected only
            is_suspected_only = (
                pattern_record.state == PatternState.SUSPECTED and
                confidence_tier == "medium"
            )
            
            return PatternResult(
                pattern_name=pattern_record.pattern_name,
                is_recurring=is_recurring,
                recurrence_count=pattern_record.evidence_count,
                last_occurrence=pattern_record.last_occurrence.isoformat() if pattern_record.last_occurrence else None,
                confidence=pattern_record.mean_confidence,
                detection_method="history_lookup",
                # Phase 2.2 fields
                pattern_state=str(pattern_record.state),
                evidence_strength=strength,
                confidence_support=strength.get("confidence_support", "unknown"),
                confidence_gated=False,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Strategy 2: Map root cause to pattern category (first occurrence)
        # ─────────────────────────────────────────────────────────────────────
        if root_cause in ROOT_CAUSE_TO_PATTERNS:
            patterns = ROOT_CAUSE_TO_PATTERNS[root_cause]
            pattern = self._select_best_pattern(patterns, verdict, problem_tags)
            
            # First occurrence - state is NONE or SUSPECTED based on confidence
            if can_confirm_pattern(root_cause_confidence):
                # High confidence first occurrence → SUSPECTED (needs more evidence)
                pattern_state = "suspected"
            else:
                # Medium confidence first occurrence → NONE (just noting it)
                pattern_state = "none"
            
            self.logger.info(
                f"✅ Mapped root cause to pattern: {pattern} | "
                f"first_occurrence, state={pattern_state}, tier={confidence_tier}"
            )
            
            return PatternResult(
                pattern_name=pattern,
                is_recurring=False,
                recurrence_count=0,
                last_occurrence=None,
                confidence=root_cause_confidence * 0.9,
                detection_method="ml_model",
                # Phase 2.2 fields
                pattern_state=pattern_state,
                evidence_strength={
                    "evidence_count": 1,
                    "weighted_evidence": 1.0,
                    "mean_confidence": root_cause_confidence,
                    "recency_score": 1.0,
                },
                confidence_support=f"{confidence_tier}_confidence",
                confidence_gated=False,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Strategy 3: Verdict-based hints (only for medium+ confidence)
        # ─────────────────────────────────────────────────────────────────────
        verdict_lower = verdict.lower().replace(" ", "_")
        if verdict_lower in VERDICT_PATTERN_HINTS:
            hints = VERDICT_PATTERN_HINTS[verdict_lower]
            pattern = hints[0]
            
            self.logger.info(
                f"⚠️ Using verdict-based pattern: {pattern} | tier={confidence_tier}"
            )
            
            return PatternResult(
                pattern_name=pattern,
                is_recurring=False,
                recurrence_count=0,
                last_occurrence=None,
                confidence=0.5,
                detection_method="keyword_match",
                # Phase 2.2 fields
                pattern_state="none",  # Verdict-only is never confirmed
                evidence_strength=None,
                confidence_support="verdict_hint_only",
                confidence_gated=False,
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
            # Phase 2.2 fields
            pattern_state="none",
            evidence_strength=None,
            confidence_support=None,
            confidence_gated=False,
        )
    
    def _check_user_history_v2(
        self,
        root_cause: str,
        root_cause_confidence: float,
        user_history: List[Dict[str, Any]],
        user_memory: Optional[List[str]],
    ) -> Dict[str, Any]:
        """
        Check user history with Phase 2.2 state machine integration.
        
        Key differences from v1:
        - Builds PatternStateRecord with proper evidence
        - Applies confidence gating to each historical occurrence
        - Uses temporal decay for evidence weighting
        - Returns state machine record instead of simple counts
        """
        result = {
            "has_evidence": False,
            "pattern_record": None,
        }
        
        if not user_history:
            return result
        
        # Get pattern name
        if root_cause in ROOT_CAUSE_TO_PATTERNS:
            pattern_name = ROOT_CAUSE_TO_PATTERNS[root_cause][0]
        else:
            pattern_name = root_cause.replace("_", " ")
        
        # Initialize pattern record
        pattern_record = PatternStateRecord(pattern_name=pattern_name)
        
        # Get keywords for matching
        root_cause_keywords = self._get_root_cause_keywords(root_cause)
        
        # Build evidence from history
        now = datetime.now(timezone.utc)
        self.state_engine.update_now(now)
        
        for submission in user_history:
            # Check if submission matches this pattern
            if not self._submission_matches_pattern(submission, root_cause, root_cause_keywords):
                continue
            
            # Extract timestamp
            occ_time = self._parse_submission_time(submission, now)
            
            # Get confidence from past submission (default to medium if unknown)
            past_confidence = submission.get("root_cause_confidence", 0.70)
            
            # Add evidence through state machine (applies confidence gating)
            pattern_record = self.state_engine.add_evidence(
                record=pattern_record,
                confidence=past_confidence,
                root_cause=root_cause,
                subtype=submission.get("subtype"),
                problem_id=submission.get("problem_id"),
                timestamp=occ_time,
            )
        
        # Also check RAG memories for additional evidence
        if user_memory:
            memory_matches = sum(
                1 for mem in user_memory
                if any(kw in mem.lower() for kw in root_cause_keywords)
            )
            # Add memory-based evidence (medium confidence)
            for _ in range(min(memory_matches, 2)):
                pattern_record = self.state_engine.add_evidence(
                    record=pattern_record,
                    confidence=0.70,  # Medium confidence for memory
                    root_cause=root_cause,
                    timestamp=now - timedelta(days=7),  # Assume recent
                )
        
        # Add current occurrence as evidence
        pattern_record = self.state_engine.add_evidence(
            record=pattern_record,
            confidence=root_cause_confidence,
            root_cause=root_cause,
            timestamp=now,
        )
        
        # Apply decay to get current state
        pattern_record = self.state_engine.apply_decay(pattern_record)
        
        if pattern_record.evidence_count > 0:
            result["has_evidence"] = True
            result["pattern_record"] = pattern_record
        
        return result
    
    def _submission_matches_pattern(
        self,
        submission: Dict[str, Any],
        root_cause: str,
        keywords: List[str],
    ) -> bool:
        """Check if a submission matches the pattern."""
        # Direct match on root_cause field
        past_root = submission.get("root_cause", "")
        if past_root and past_root == root_cause:
            return True
        
        # Match on error type
        error_type = submission.get("error_type", "")
        if any(kw in error_type.lower() for kw in keywords):
            return True
        
        # Match on feedback pattern
        feedback = submission.get("ai_feedback", {})
        detected_pattern = feedback.get("detected_pattern", "")
        if detected_pattern and any(kw in detected_pattern.lower() for kw in keywords):
            return True
        
        # Match on feedback explanation
        explanation = feedback.get("explanation", "")
        if explanation and sum(1 for kw in keywords if kw in explanation.lower()) >= 2:
            return True
        
        return False
    
    def _parse_submission_time(
        self,
        submission: Dict[str, Any],
        default: datetime,
    ) -> datetime:
        """Parse submission timestamp."""
        if submission.get("createdAt"):
            try:
                if isinstance(submission["createdAt"], str):
                    ts = datetime.fromisoformat(submission["createdAt"].replace("Z", "+00:00"))
                else:
                    ts = submission["createdAt"]
                
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                return ts
            except Exception:
                pass
        return default - timedelta(days=30)  # Assume old if unknown
    
    def _check_user_history(
        self,
        root_cause: str,
        user_history: List[Dict[str, Any]],
        user_memory: Optional[List[str]],
    ) -> Dict[str, Any]:
        """
        LEGACY: Check if user has made this mistake before.
        
        Kept for backward compatibility. Use _check_user_history_v2 for Phase 2.2.
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
            
            # Phase 2.2: Compute time-weighted count with temporal decay
            now = datetime.now(timezone.utc)
            weighted_count = 0.0
            last_time = None
            occurrence_times = []
            
            for occ in occurrences:
                occ_time = None
                if occ.get("createdAt"):
                    try:
                        if isinstance(occ["createdAt"], str):
                            occ_time = datetime.fromisoformat(occ["createdAt"].replace("Z", "+00:00"))
                        else:
                            occ_time = occ["createdAt"]
                        
                        if occ_time.tzinfo is None:
                            occ_time = occ_time.replace(tzinfo=timezone.utc)
                        
                        occurrence_times.append(occ_time)
                        
                        if last_time is None or occ_time > last_time:
                            last_time = occ_time
                    except Exception:
                        pass
                
                # Compute decay weight
                weight = self._compute_temporal_weight(occ_time, now)
                weighted_count += weight
            
            # Phase 2.2: Compute severity score
            severity = self._compute_severity_score(
                weighted_count=weighted_count,
                raw_count=len(occurrences),
                occurrence_times=occurrence_times,
                now=now,
            )
            
            # Phase 2.2: Check for partial mastery / regression
            mastery_status = self._check_mastery_status(
                root_cause=root_cause,
                user_history=user_history,
            )
            
            result = {
                "is_recurring": weighted_count >= 1.5,  # Time-weighted threshold
                "pattern": pattern,
                "count": len(occurrences),
                "weighted_count": round(weighted_count, 2),
                "severity": severity,
                "last_occurrence": last_time.isoformat() if last_time else None,
                "mastery_status": mastery_status,
            }
        
        return result
    
    def _compute_temporal_weight(
        self,
        occurrence_time: Optional[datetime],
        now: datetime,
    ) -> float:
        """
        Compute temporal decay weight for an occurrence.
        
        Phase 2.2: Recent occurrences matter more than old ones.
        Uses exponential decay with configurable half-life.
        """
        if occurrence_time is None:
            return 0.5  # Default weight for unknown time
        
        try:
            days_ago = (now - occurrence_time).total_seconds() / 86400.0
            
            if days_ago < 0:
                days_ago = 0
            
            # Exponential decay: weight = 2^(-days_ago / half_life)
            decay = math.pow(2, -days_ago / self.DECAY_HALF_LIFE_DAYS)
            
            # Recency boost for very recent occurrences
            if days_ago <= self.RECENCY_BOOST_DAYS:
                decay = min(1.0, decay * 1.3)
            
            return decay
        except Exception:
            return 0.5
    
    def _compute_severity_score(
        self,
        weighted_count: float,
        raw_count: int,
        occurrence_times: List[datetime],
        now: datetime,
    ) -> str:
        """
        Compute severity score for a recurring pattern.
        
        Phase 2.2: Combines recurrence + recency + trajectory.
        
        Returns: "low", "medium", "high", "critical"
        """
        # Base severity from weighted count
        if weighted_count >= 3.0:
            base = "critical"
        elif weighted_count >= 2.0:
            base = "high"
        elif weighted_count >= 1.0:
            base = "medium"
        else:
            base = "low"
        
        # Check for consecutive recent failures (acceleration)
        if len(occurrence_times) >= 2:
            sorted_times = sorted(occurrence_times, reverse=True)
            recent_count = sum(
                1 for t in sorted_times[:5]
                if (now - t).total_seconds() < 7 * 86400  # Last 7 days
            )
            
            # Escalate if clustering in recent window
            if recent_count >= 3 and base in ("medium", "high"):
                return "critical" if base == "high" else "high"
        
        return base
    
    def _check_mastery_status(
        self,
        root_cause: str,
        user_history: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Check if user is mastering or regressing on this pattern.
        
        Phase 2.2: Partial mastery detection.
        
        Returns dict with:
        - status: "learning", "mastering", "mastered", "regressing"
        - consecutive_successes: int
        - consecutive_failures: int
        """
        status = {
            "status": "learning",
            "consecutive_successes": 0,
            "consecutive_failures": 0,
        }
        
        if not user_history:
            return status
        
        # Get keywords for this root cause
        keywords = self._get_root_cause_keywords(root_cause)
        
        # Sort history by time (most recent first)
        sorted_history = sorted(
            user_history,
            key=lambda x: x.get("createdAt", ""),
            reverse=True,
        )
        
        # Track consecutive outcomes for problems related to this pattern
        consecutive_success = 0
        consecutive_failure = 0
        saw_related = False
        
        for sub in sorted_history[:20]:  # Check last 20 submissions
            verdict = (sub.get("verdict") or sub.get("status") or "").lower()
            past_root = sub.get("root_cause", "")
            category = sub.get("category", "")
            
            # Check if submission is related to this pattern
            is_related = (
                past_root == root_cause or
                any(kw in (sub.get("error_type", "") or "").lower() for kw in keywords)
            )
            
            if not is_related:
                continue
            
            saw_related = True
            
            if verdict in ("accepted", "ac"):
                if consecutive_failure == 0:
                    consecutive_success += 1
                else:
                    break  # Streak broken
            else:
                if consecutive_success == 0:
                    consecutive_failure += 1
                else:
                    break  # Streak broken
        
        status["consecutive_successes"] = consecutive_success
        status["consecutive_failures"] = consecutive_failure
        
        # Determine mastery status
        if consecutive_success >= self.MASTERY_THRESHOLD:
            status["status"] = "mastered"
        elif consecutive_success >= 2:
            status["status"] = "mastering"
        elif consecutive_failure >= self.REGRESSION_THRESHOLD and saw_related:
            status["status"] = "regressing"
        else:
            status["status"] = "learning"
        
        return status
    
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
