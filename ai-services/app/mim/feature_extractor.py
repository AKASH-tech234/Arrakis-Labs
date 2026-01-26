"""
MIM Feature Extractor
======================

Transforms MongoDB submissions + RAG memory into ML-ready feature vectors.

Feature Vector Structure (60 dimensions):
├── [0-14]  Submission-level features (15)
├── [15-29] Error semantics features (15)  
├── [30-44] Problem metadata features (15)
├── [45-54] Temporal features (10)
└── [55-59] Historical aggregates (5)

Cold Start Strategy (Option B):
- For users with <5 submissions, use problem difficulty as proxy
- Easy → high success prediction, Hard → lower success prediction
"""

from typing import Dict, List, Optional, Any
import numpy as np
from datetime import datetime, timedelta
import logging
import hashlib

logger = logging.getLogger("mim.feature_extractor")

# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

FEATURE_VECTOR_SIZE = 60
MIN_SUBMISSIONS_FOR_FULL_FEATURES = 5  # Below this, use cold start strategy

# Verdict encoding
VERDICT_ENCODING = {
    "accepted": 1.0,
    "wrong_answer": 0.0,
    "time_limit_exceeded": -0.3,
    "runtime_error": -0.5,
    "compile_error": -0.8,
    "memory_limit_exceeded": -0.4,
}

# Difficulty encoding
DIFFICULTY_ENCODING = {
    "easy": 0.2,
    "medium": 0.5,
    "hard": 0.8,
}

# Error type encoding
ERROR_TYPE_ENCODING = {
    "logic_error": 0,
    "boundary_error": 1,
    "overflow_error": 2,
    "type_error": 3,
    "syntax_error": 4,
    "runtime_error": 5,
    "time_limit": 6,
    "memory_limit": 7,
    "unknown": 8,
}

# Topic encoding (one-hot indices)
TOPIC_INDICES = {
    "array": 0, "arrays": 0,
    "string": 1, "strings": 1,
    "hash_table": 2, "hash table": 2, "hashmap": 2,
    "dynamic_programming": 3, "dp": 3, "dynamic programming": 3,
    "math": 4, "mathematics": 4,
    "sorting": 5, "sort": 5,
    "greedy": 6,
    "binary_search": 7, "binary search": 7,
    "tree": 8, "trees": 8,
    "graph": 9, "graphs": 9,
    "two_pointers": 10, "two pointers": 10,
    "recursion": 11,
    "linked_list": 12, "linked list": 12,
    "stack": 13,
    "queue": 14,
}

# Root cause categories (target labels)
ROOT_CAUSE_CATEGORIES = [
    "boundary_condition_blindness",
    "off_by_one_error", 
    "integer_overflow",
    "wrong_data_structure",
    "logic_error",
    "time_complexity_issue",
    "recursion_issue",
    "comparison_error",
    "unknown",
]


class MIMFeatureExtractor:
    """
    Extracts ML features from submission data.
    
    Usage:
        extractor = MIMFeatureExtractor()
        features = extractor.extract(submission, user_history)
    """
    
    def __init__(self):
        self.feature_names = self._build_feature_names()
        logger.info(f"MIM Feature Extractor initialized | {FEATURE_VECTOR_SIZE} dimensions")
    
    def _build_feature_names(self) -> List[str]:
        """Build human-readable feature names for debugging."""
        names = []
        
        # Submission features [0-14]
        names.extend([
            "verdict_encoded", "attempts_count", "code_length", "code_lines",
            "has_loops", "has_recursion", "has_conditionals", "function_count",
            "variable_count", "comment_ratio", "indentation_depth",
            "uses_builtin_sort", "uses_hashmap", "uses_set", "uses_heap"
        ])
        
        # Error semantics [15-29]
        names.extend([
            "error_type_encoded", "has_index_error_pattern", "has_overflow_pattern",
            "has_boundary_pattern", "has_null_check", "has_empty_check",
            "loop_bound_complexity", "array_access_count", "division_count",
            "modulo_count", "comparison_count", "equality_vs_assignment",
            "nested_loop_depth", "conditional_complexity", "return_count"
        ])
        
        # Problem metadata [30-44]
        names.extend([
            "difficulty_encoded", "topic_array", "topic_string", "topic_dp",
            "topic_math", "topic_sorting", "topic_greedy", "topic_binary_search",
            "topic_tree", "topic_graph", "topic_two_pointers",
            "constraint_n_log", "constraint_n_squared", "constraint_large_n",
            "expected_complexity_match"
        ])
        
        # Temporal features [45-54]
        names.extend([
            "hour_of_day", "is_weekend", "session_submission_count",
            "time_since_last_submission", "submission_velocity_1h",
            "submission_velocity_24h", "streak_length", "days_since_first",
            "is_retry", "retry_count_this_problem"
        ])
        
        # Historical aggregates [55-59]
        names.extend([
            "success_rate_7d", "success_rate_30d", "category_success_rate",
            "difficulty_success_rate", "failure_entropy"
        ])
        
        return names
    
    def extract(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]],
        problem_context: Optional[Dict[str, Any]] = None,
        user_memory: Optional[List[str]] = None,
    ) -> np.ndarray:
        """
        Extract feature vector from submission.
        
        Args:
            submission: Current submission data (SubmissionContext-like dict)
            user_history: List of past submissions from MongoDB
            problem_context: Problem details (title, difficulty, tags, etc.)
            user_memory: RAG-retrieved memory chunks
            
        Returns:
            numpy array of shape (60,)
        """
        features = np.zeros(FEATURE_VECTOR_SIZE, dtype=np.float32)
        
        # Check for cold start
        is_cold_start = len(user_history) < MIN_SUBMISSIONS_FOR_FULL_FEATURES
        
        try:
            # [0-14] Submission features
            features[0:15] = self._extract_submission_features(submission)
            
            # [15-29] Error semantics
            features[15:30] = self._extract_error_features(submission)
            
            # [30-44] Problem metadata
            features[30:45] = self._extract_problem_features(
                submission, problem_context, is_cold_start
            )
            
            # [45-54] Temporal features
            features[45:55] = self._extract_temporal_features(
                submission, user_history
            )
            
            # [55-59] Historical aggregates
            if is_cold_start:
                # Cold start strategy: Use problem difficulty as proxy
                features[55:60] = self._cold_start_features(submission, problem_context)
            else:
                features[55:60] = self._extract_historical_features(
                    submission, user_history, user_memory
                )
            
        except Exception as e:
            logger.error(f"Feature extraction failed: {e}")
            # Return zero vector on failure (graceful degradation)
        
        return features
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SUBMISSION FEATURES [0-14]
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _extract_submission_features(self, submission: Dict) -> np.ndarray:
        """Extract features from the current submission."""
        features = np.zeros(15, dtype=np.float32)
        
        verdict = submission.get("verdict", "").lower()
        code = submission.get("code", "") or submission.get("user_code", "") or ""
        
        # Basic encoding
        features[0] = VERDICT_ENCODING.get(verdict, 0.0)
        features[1] = min(submission.get("attempts_count", 0) / 10.0, 1.0)  # Normalize
        features[2] = min(len(code) / 5000.0, 1.0)  # Code length normalized
        features[3] = min(code.count("\n") / 200.0, 1.0)  # Line count normalized
        
        # Code structure analysis
        code_lower = code.lower()
        features[4] = 1.0 if ("for " in code_lower or "while " in code_lower) else 0.0
        features[5] = 1.0 if self._has_recursion(code) else 0.0
        features[6] = 1.0 if "if " in code_lower else 0.0
        features[7] = min(code_lower.count("def ") + code_lower.count("function ") + 
                         code_lower.count("void ") / 10.0, 1.0)
        
        # Variable/identifier count (rough estimate)
        features[8] = min(len(set(code.split())) / 100.0, 1.0)
        
        # Comment ratio
        comment_lines = sum(1 for line in code.split("\n") 
                          if line.strip().startswith(("//", "#", "/*", "*")))
        total_lines = max(code.count("\n"), 1)
        features[9] = comment_lines / total_lines
        
        # Indentation depth (max)
        features[10] = min(self._max_indentation(code) / 10.0, 1.0)
        
        # Common patterns
        features[11] = 1.0 if "sort(" in code_lower or ".sort(" in code_lower else 0.0
        features[12] = 1.0 if ("map<" in code or "dict(" in code_lower or 
                              "HashMap" in code or "{}" in code) else 0.0
        features[13] = 1.0 if ("set<" in code or "set(" in code_lower or 
                              "HashSet" in code) else 0.0
        features[14] = 1.0 if ("heap" in code_lower or "priority" in code_lower or
                              "heapq" in code_lower) else 0.0
        
        return features
    
    def _has_recursion(self, code: str) -> bool:
        """Detect if code likely uses recursion."""
        # Simple heuristic: function calls itself
        lines = code.split("\n")
        for line in lines:
            if "def " in line or "function " in line:
                # Extract function name
                parts = line.split("(")[0].split()
                if len(parts) >= 2:
                    func_name = parts[-1]
                    # Check if function name appears later in call context
                    rest_of_code = code[code.index(line) + len(line):]
                    if f"{func_name}(" in rest_of_code:
                        return True
        return False
    
    def _max_indentation(self, code: str) -> int:
        """Get maximum indentation depth."""
        max_indent = 0
        for line in code.split("\n"):
            if line.strip():
                spaces = len(line) - len(line.lstrip())
                indent = spaces // 4  # Assume 4-space indent
                max_indent = max(max_indent, indent)
        return max_indent
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ERROR SEMANTICS FEATURES [15-29]
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _extract_error_features(self, submission: Dict) -> np.ndarray:
        """Extract features related to error patterns."""
        features = np.zeros(15, dtype=np.float32)
        
        error_type = submission.get("error_type", "unknown") or "unknown"
        code = submission.get("code", "") or submission.get("user_code", "") or ""
        code_lower = code.lower()
        
        # Error type encoding
        features[0] = ERROR_TYPE_ENCODING.get(error_type.lower(), 8) / 8.0
        
        # Pattern detection in code
        features[1] = 1.0 if self._has_index_error_pattern(code) else 0.0
        features[2] = 1.0 if self._has_overflow_pattern(code) else 0.0
        features[3] = 1.0 if self._has_boundary_pattern(code) else 0.0
        
        # Defensive coding patterns
        features[4] = 1.0 if ("!= null" in code or "!= None" in code_lower or
                            "!= nullptr" in code) else 0.0
        features[5] = 1.0 if (".empty()" in code or "len(" in code_lower or
                            ".length" in code or ".size()" in code) else 0.0
        
        # Loop complexity
        features[6] = min(self._loop_bound_complexity(code) / 5.0, 1.0)
        
        # Dangerous operations count
        features[7] = min(code.count("[") / 20.0, 1.0)  # Array accesses
        features[8] = min((code.count("/") - code.count("//")) / 10.0, 1.0)  # Divisions
        features[9] = min(code.count("%") / 10.0, 1.0)  # Modulo
        
        # Comparison operations
        features[10] = min((code.count("<") + code.count(">") + 
                          code.count("==") + code.count("!=")) / 20.0, 1.0)
        
        # Potential = vs == confusion (very rough)
        single_equals = code.count("=") - code.count("==") - code.count("!=") - \
                       code.count("<=") - code.count(">=")
        features[11] = min(single_equals / 20.0, 1.0)
        
        # Nested loop depth
        features[12] = min(self._nested_loop_depth(code) / 4.0, 1.0)
        
        # Conditional complexity (if/else count)
        features[13] = min((code_lower.count("if ") + code_lower.count("else")) / 15.0, 1.0)
        
        # Return count
        features[14] = min(code_lower.count("return") / 10.0, 1.0)
        
        return features
    
    def _has_index_error_pattern(self, code: str) -> bool:
        """Detect patterns that commonly cause index errors."""
        # Check for array access without bounds checking nearby
        patterns = [
            r"\[i\+1\]",  # i+1 access
            r"\[i-1\]",   # i-1 access
            r"\[j\+1\]",
            r"\[j-1\]",
        ]
        import re
        for pattern in patterns:
            if re.search(pattern, code):
                return True
        return False
    
    def _has_overflow_pattern(self, code: str) -> bool:
        """Detect patterns that might cause overflow."""
        overflow_indicators = [
            "10**9", "1e9", "1000000007", "MOD", 
            "INT_MAX", "LLONG_MAX", "int(1e18)"
        ]
        return any(ind in code for ind in overflow_indicators)
    
    def _has_boundary_pattern(self, code: str) -> bool:
        """Detect boundary/edge case handling patterns."""
        boundary_checks = [
            "if not ", "if len(", "if n == 0", "if n == 1",
            "if (n == 0)", "if (n == 1)", ".empty()", "== 0:",
            "is None", "== null", "== nullptr"
        ]
        return any(check in code for check in boundary_checks)
    
    def _loop_bound_complexity(self, code: str) -> int:
        """Estimate loop bound complexity."""
        complexity = 0
        if "for " in code.lower():
            complexity += 1
            if "range(n" in code.lower() or "i < n" in code:
                complexity += 1
            if "range(n*n" in code.lower() or "n * n" in code:
                complexity += 2
        if "while " in code.lower():
            complexity += 1
        return complexity
    
    def _nested_loop_depth(self, code: str) -> int:
        """Estimate nested loop depth."""
        lines = code.split("\n")
        max_depth = 0
        current_depth = 0
        
        for line in lines:
            stripped = line.strip().lower()
            if stripped.startswith(("for ", "while ")):
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif stripped.startswith("}") or (stripped == "" and current_depth > 0):
                current_depth = max(0, current_depth - 1)
        
        return max_depth
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PROBLEM METADATA FEATURES [30-44]
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _extract_problem_features(
        self, 
        submission: Dict,
        problem_context: Optional[Dict],
        is_cold_start: bool
    ) -> np.ndarray:
        """Extract features from problem metadata."""
        features = np.zeros(15, dtype=np.float32)
        
        # Get difficulty
        difficulty = "medium"  # default
        if problem_context:
            difficulty = problem_context.get("difficulty", "medium").lower()
        elif submission.get("problem_category"):
            # Try to infer from category
            cat = submission.get("problem_category", "").lower()
            if "easy" in cat:
                difficulty = "easy"
            elif "hard" in cat:
                difficulty = "hard"
        
        features[0] = DIFFICULTY_ENCODING.get(difficulty, 0.5)
        
        # Topic one-hot encoding (partial) - MAX 11 topics to fit in features[1-11]
        # Features layout: [0]=difficulty, [1-11]=topics (11 slots), [12-14]=constraints
        tags = []
        if problem_context:
            tags = problem_context.get("tags", [])
        category = submission.get("problem_category", "").lower()
        
        # Combine tags and category
        all_topics = [t.lower() for t in tags] + [category]
        
        for topic in all_topics:
            for topic_key, idx in TOPIC_INDICES.items():
                # FIX: Cap at index 10 to prevent overflow (features[1+10]=features[11] is max)
                # This leaves features[12-14] for constraint features
                if topic_key in topic and idx <= 10:
                    features[1 + idx] = 1.0  # features[1-11] are topics
                    break
        
        # Constraint-based features
        constraints = ""
        if problem_context:
            constraints = str(problem_context.get("constraints", ""))
        elif submission.get("constraints"):
            constraints = str(submission.get("constraints", ""))
        
        # Parse constraints for complexity hints
        features[12] = 1.0 if "10^5" in constraints or "100000" in constraints else 0.0  # O(n log n)
        features[13] = 1.0 if "10^3" in constraints or "1000" in constraints else 0.0   # O(n²) ok
        features[14] = 1.0 if "10^9" in constraints or "10^6" in constraints else 0.0   # Large n
        
        return features
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEMPORAL FEATURES [45-54]
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _extract_temporal_features(
        self,
        submission: Dict,
        user_history: List[Dict]
    ) -> np.ndarray:
        """Extract time-based features."""
        features = np.zeros(10, dtype=np.float32)
        
        now = datetime.now()
        
        # Hour of day (normalized)
        features[0] = now.hour / 24.0
        
        # Is weekend
        features[1] = 1.0 if now.weekday() >= 5 else 0.0
        
        if not user_history:
            return features
        
        # Helper to safely compare timestamps
        def _is_after(ts_str: str, threshold: datetime) -> bool:
            parsed = self._parse_timestamp(ts_str)
            return parsed is not None and parsed > threshold
        
        # Session submission count (last 2 hours)
        two_hours_ago = now - timedelta(hours=2)
        session_count = sum(1 for s in user_history 
                          if _is_after(s.get("createdAt", ""), two_hours_ago))
        features[2] = min(session_count / 10.0, 1.0)
        
        # Time since last submission
        if user_history:
            last_sub = user_history[0]  # Assume sorted by time desc
            last_time = self._parse_timestamp(last_sub.get("createdAt", ""))
            if last_time:
                hours_since = (now - last_time).total_seconds() / 3600
                features[3] = min(hours_since / 24.0, 1.0)
        
        # Submission velocity (1 hour)
        one_hour_ago = now - timedelta(hours=1)
        velocity_1h = sum(1 for s in user_history
                        if _is_after(s.get("createdAt", ""), one_hour_ago))
        features[4] = min(velocity_1h / 5.0, 1.0)
        
        # Submission velocity (24 hours)
        one_day_ago = now - timedelta(days=1)
        velocity_24h = sum(1 for s in user_history
                         if _is_after(s.get("createdAt", ""), one_day_ago))
        features[5] = min(velocity_24h / 20.0, 1.0)
        
        # Streak length (consecutive days with submissions)
        features[6] = min(self._calculate_streak(user_history) / 7.0, 1.0)
        
        # Days since first submission
        if user_history:
            first_sub = user_history[-1]
            first_time = self._parse_timestamp(first_sub.get("createdAt", ""))
            if first_time:
                days_since = (now - first_time).days
                features[7] = min(days_since / 30.0, 1.0)
        
        # Is retry (same problem attempted before)
        problem_id = submission.get("problem_id", "")
        retry_count = sum(1 for s in user_history 
                        if s.get("questionId") == problem_id or s.get("problem_id") == problem_id)
        features[8] = 1.0 if retry_count > 0 else 0.0
        features[9] = min(retry_count / 5.0, 1.0)
        
        return features
    
    def _parse_timestamp(self, timestamp) -> Optional[datetime]:
        """Parse various timestamp formats."""
        if isinstance(timestamp, datetime):
            return timestamp
        if not timestamp:
            return None
        try:
            if isinstance(timestamp, str):
                # Try ISO format
                return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except:
            pass
        return None
    
    def _calculate_streak(self, user_history: List[Dict]) -> int:
        """Calculate consecutive days with submissions."""
        if not user_history:
            return 0
        
        dates = set()
        for sub in user_history:
            ts = self._parse_timestamp(sub.get("createdAt", ""))
            if ts:
                dates.add(ts.date())
        
        if not dates:
            return 0
        
        sorted_dates = sorted(dates, reverse=True)
        streak = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i-1] - sorted_dates[i]).days == 1:
                streak += 1
            else:
                break
        
        return streak
    
    # ═══════════════════════════════════════════════════════════════════════════
    # HISTORICAL AGGREGATE FEATURES [55-59]
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _extract_historical_features(
        self,
        submission: Dict,
        user_history: List[Dict],
        user_memory: Optional[List[str]]
    ) -> np.ndarray:
        """Extract aggregated historical features."""
        features = np.zeros(5, dtype=np.float32)
        
        if not user_history:
            return features
        
        now = datetime.now()
        
        # Helper for safe timestamp comparison
        def _is_after(ts_str: str, threshold: datetime) -> bool:
            parsed = self._parse_timestamp(ts_str)
            return parsed is not None and parsed > threshold
        
        # Success rate (7 days)
        week_ago = now - timedelta(days=7)
        recent_subs = [s for s in user_history 
                      if _is_after(s.get("createdAt", ""), week_ago)]
        if recent_subs:
            accepted = sum(1 for s in recent_subs if s.get("status") == "accepted")
            features[0] = accepted / len(recent_subs)
        
        # Success rate (30 days)
        month_ago = now - timedelta(days=30)
        monthly_subs = [s for s in user_history
                       if _is_after(s.get("createdAt", ""), month_ago)]
        if monthly_subs:
            accepted = sum(1 for s in monthly_subs if s.get("status") == "accepted")
            features[1] = accepted / len(monthly_subs)
        
        # Category success rate
        category = submission.get("problem_category", "").lower()
        category_subs = [s for s in user_history 
                        if category in str(s.get("category", "")).lower()]
        if category_subs:
            accepted = sum(1 for s in category_subs if s.get("status") == "accepted")
            features[2] = accepted / len(category_subs)
        
        # Difficulty success rate (estimate from problem_category if available)
        difficulty = "medium"
        if "easy" in category:
            difficulty = "easy"
        elif "hard" in category:
            difficulty = "hard"
        
        # Just use overall success for now
        features[3] = features[1]  # Same as 30-day rate
        
        # Failure entropy (diversity of failure types)
        # Higher entropy = many different mistake types
        if user_memory:
            mistake_types = set()
            for memory in user_memory:
                memory_lower = memory.lower()
                for cause in ROOT_CAUSE_CATEGORIES:
                    if cause.replace("_", " ") in memory_lower:
                        mistake_types.add(cause)
            features[4] = len(mistake_types) / len(ROOT_CAUSE_CATEGORIES)
        
        return features
    
    # ═══════════════════════════════════════════════════════════════════════════
    # COLD START FEATURES (Option B: Problem Difficulty Proxy)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _cold_start_features(
        self,
        submission: Dict,
        problem_context: Optional[Dict]
    ) -> np.ndarray:
        """
        Generate features for new users using problem difficulty as proxy.
        
        Cold Start Strategy (Option B):
        - Easy problem → predict higher success, lower complexity issues
        - Hard problem → predict lower success, more complex issues
        """
        features = np.zeros(5, dtype=np.float32)
        
        # Get difficulty
        difficulty = "medium"
        if problem_context:
            difficulty = problem_context.get("difficulty", "medium").lower()
        elif submission.get("problem_category"):
            cat = submission.get("problem_category", "").lower()
            if "easy" in cat:
                difficulty = "easy"
            elif "hard" in cat:
                difficulty = "hard"
        
        # Use difficulty as proxy for success rates
        difficulty_proxy = {
            "easy": (0.8, 0.85, 0.75, 0.85, 0.2),    # High success, low variety
            "medium": (0.6, 0.65, 0.55, 0.60, 0.4),  # Medium success
            "hard": (0.35, 0.40, 0.30, 0.35, 0.6),   # Lower success, more variety
        }
        
        proxy_values = difficulty_proxy.get(difficulty, difficulty_proxy["medium"])
        features[:] = proxy_values
        
        return features
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UTILITY
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_feature_names(self) -> List[str]:
        """Get human-readable feature names."""
        return self.feature_names
    
    def get_feature_importance_context(self, features: np.ndarray) -> Dict[str, float]:
        """Get top features for explainability."""
        feature_dict = {}
        for i, (name, value) in enumerate(zip(self.feature_names, features)):
            if value > 0.0:  # Only non-zero features
                feature_dict[name] = float(value)
        
        # Sort by value descending
        return dict(sorted(feature_dict.items(), key=lambda x: x[1], reverse=True)[:10])
