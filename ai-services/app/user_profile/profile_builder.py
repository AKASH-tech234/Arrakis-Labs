"""
User Profile Builder
====================

Builds structured UserProfile from raw RAG memory chunks.
NO EXTRA LLM CALLS - uses pattern matching and heuristics.

v3.2 ENHANCEMENTS:
- Integrates current MIM decision into profile
- Enforces single immutable MIM decision per submission
- Logs assertion if profile history disagrees with MIM
- Tracks profile_updated_after_submission metric

Key responsibilities:
1. Parse memory chunks into structured patterns
2. Identify recurring mistakes via keyword matching
3. Extract weak topics from memory text
4. Generate profile summary for agents
5. Validate MIM decision against profile history (NEW)
"""

import re
import uuid
import logging
from typing import List, Dict, Any, Optional
from functools import lru_cache
from datetime import datetime

from app.schemas.user_profile import UserProfile

logger = logging.getLogger(__name__)


# ============================================================================
# MISTAKE PATTERN KEYWORDS
# ============================================================================

MISTAKE_KEYWORDS = {
    "off-by-one": [
        "off by one", "off-by-one", "off by 1", "boundary", "index out",
        "array index", "fence post", "fencepost", "loop boundary"
    ],
    "empty input handling": [
        "empty array", "empty input", "null check", "empty string",
        "empty list", "zero length", "length == 0", "handle empty"
    ],
    "edge case missing": [
        "edge case", "corner case", "special case", "didn't consider",
        "forgot to handle", "missing case", "boundary condition"
    ],
    "integer overflow": [
        "overflow", "integer overflow", "long overflow", "large numbers",
        "int overflow", "exceeds int", "use long"
    ],
    "time complexity": [
        "TLE", "time limit", "too slow", "O(n^2)", "timeout",
        "inefficient", "optimize", "brute force"
    ],
    "wrong data structure": [
        "wrong data structure", "use hashmap", "use set", "should use",
        "better to use", "instead of array"
    ],
    "recursion issues": [
        "stack overflow", "infinite recursion", "base case missing",
        "memoization", "should memoize", "recursive call"
    ],
    "sorting issues": [
        "sort first", "unsorted", "wrong order", "ascending", "descending",
        "should sort", "sorting required"
    ],
    "logic error": [
        "logic error", "wrong logic", "incorrect logic", "logical mistake",
        "thinking error", "misunderstood"
    ],
    "comparison operator": [
        "wrong operator", "< vs <=", "> vs >=", "== vs ===",
        "comparison", "should be <=", "should be >="
    ]
}


# ============================================================================
# TOPIC WEAKNESS KEYWORDS
# ============================================================================

TOPIC_WEAKNESS_KEYWORDS = {
    "Dynamic Programming": [
        "DP", "dynamic programming", "memoization", "tabulation",
        "subproblem", "optimal substructure", "overlapping"
    ],
    "Graph Algorithms": [
        "graph", "BFS", "DFS", "traversal", "shortest path",
        "dijkstra", "bellman", "topological"
    ],
    "Binary Search": [
        "binary search", "bisect", "lower bound", "upper bound",
        "search space", "monotonic"
    ],
    "Tree Operations": [
        "tree", "BST", "binary tree", "traversal", "inorder",
        "preorder", "postorder", "height", "depth"
    ],
    "Recursion": [
        "recursion", "recursive", "backtracking", "base case",
        "call stack", "return statement"
    ],
    "Array Manipulation": [
        "array", "two pointer", "sliding window", "prefix sum",
        "subarray", "subsequence"
    ],
    "String Processing": [
        "string", "substring", "pattern matching", "palindrome",
        "anagram", "character"
    ],
    "Linked List": [
        "linked list", "pointer", "next node", "head", "tail",
        "cycle detection", "reversal"
    ],
    "Sorting & Searching": [
        "sort", "search", "merge sort", "quick sort", "heap sort",
        "counting sort"
    ],
    "Math & Number Theory": [
        "math", "prime", "GCD", "LCM", "modulo", "factorial",
        "combinatorics", "probability"
    ]
}


# ============================================================================
# MEMORY NORMALIZATION (CRITICAL: Handles mixed formats)
# ============================================================================

def normalize_memory_chunks(memory_input: Any) -> str:
    """
    Normalize memory chunks into a single string, handling all formats.
    
    CRITICAL: RAG retriever returns List[str], but this function handles:
    - List[str] - normal case
    - List[Dict] - if chunks have metadata
    - str - already normalized
    - None - empty
    
    Args:
        memory_input: Memory in any format
        
    Returns:
        Concatenated string safe for text analysis
    """
    if not memory_input:
        return ""
    
    # Already a string
    if isinstance(memory_input, str):
        return memory_input
    
    # List of items
    if isinstance(memory_input, list):
        normalized_parts = []
        for item in memory_input:
            if isinstance(item, str):
                normalized_parts.append(item)
            elif isinstance(item, dict):
                # Extract text from dict - handle multiple possible keys
                text = (
                    item.get("content") or 
                    item.get("text") or 
                    item.get("page_content") or
                    item.get("summary") or
                    str(item)
                )
                normalized_parts.append(str(text))
            else:
                # Convert anything else to string
                normalized_parts.append(str(item))
        return "\n".join(normalized_parts)
    
    # Fallback: convert to string
    logger.warning(f"Unexpected memory format: {type(memory_input)}")
    return str(memory_input)


# ============================================================================
# PROFILE BUILDING FUNCTIONS
# ============================================================================

def derive_mistakes_from_memory(memory_text: str) -> List[str]:
    """
    Extract recurring mistake patterns from raw memory text.
    Uses keyword matching - NO LLM calls.
    
    Args:
        memory_text: Raw concatenated memory chunks
        
    Returns:
        List of identified mistake patterns
    """
    # Normalize input defensively
    if not isinstance(memory_text, str):
        memory_text = normalize_memory_chunks(memory_text)
    
    if not memory_text or not memory_text.strip():
        return []
    
    memory_lower = memory_text.lower()
    found_mistakes = []
    
    for mistake_type, keywords in MISTAKE_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in memory_lower:
                if mistake_type not in found_mistakes:
                    found_mistakes.append(mistake_type)
                break
    
    return found_mistakes


def derive_weak_topics_from_memory(memory_text: str) -> List[str]:
    """
    Extract weak topics from memory text where user struggled.
    Uses keyword matching - NO LLM calls.
    
    Args:
        memory_text: Raw concatenated memory chunks
        
    Returns:
        List of identified weak topics
    """
    # Normalize input defensively
    if not isinstance(memory_text, str):
        memory_text = normalize_memory_chunks(memory_text)
    
    if not memory_text or not memory_text.strip():
        return []
    
    memory_lower = memory_text.lower()
    found_topics = []
    
    # Look for negative indicators alongside topic keywords
    negative_indicators = [
        "struggled", "difficulty", "wrong", "error", "failed",
        "incorrect", "trouble", "problem with", "issue with",
        "need to improve", "weak", "mistake"
    ]
    
    has_negative = any(neg in memory_lower for neg in negative_indicators)
    
    for topic, keywords in TOPIC_WEAKNESS_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in memory_lower:
                # Only mark as weak if there are negative indicators
                if has_negative and topic not in found_topics:
                    found_topics.append(topic)
                    break
    
    return found_topics


def extract_recurring_patterns(memory_text: str) -> List[str]:
    """
    Extract abstract recurring patterns from memory.
    These are behavioral patterns, not specific mistakes.
    
    Args:
        memory_text: Raw memory text
        
    Returns:
        List of recurring patterns
    """
    # Normalize input defensively
    if not isinstance(memory_text, str):
        memory_text = normalize_memory_chunks(memory_text)
    
    if not memory_text or not memory_text.strip():
        return []
    
    patterns = []
    memory_lower = memory_text.lower()
    
    # Pattern detection heuristics
    pattern_indicators = [
        ("boundary condition handling", ["boundary", "edge", "corner", "limit"]),
        ("input validation", ["validate", "check input", "null", "empty"]),
        ("iterative vs recursive thinking", ["recursive", "iterative", "loop"]),
        ("space-time tradeoff awareness", ["space", "time", "tradeoff", "memory usage"]),
        ("test case consideration", ["test case", "example", "sample"]),
        ("problem decomposition", ["break down", "subproblem", "divide"]),
    ]
    
    for pattern_name, indicators in pattern_indicators:
        if any(ind in memory_lower for ind in indicators):
            patterns.append(pattern_name)
    
    return patterns


def extract_recent_categories(memory_text: str) -> List[str]:
    """
    Extract recent problem categories from memory.
    
    Args:
        memory_text: Raw memory text
        
    Returns:
        List of recent categories (max 5)
    """
    # Normalize input defensively
    if not isinstance(memory_text, str):
        memory_text = normalize_memory_chunks(memory_text)
    
    if not memory_text or not memory_text.strip():
        return []
    
    # Look for category mentions
    categories = []
    memory_lower = memory_text.lower()
    
    category_map = {
        "Array": ["array", "arrays"],
        "String": ["string", "strings"],
        "Dynamic Programming": ["dp", "dynamic programming"],
        "Graph": ["graph", "graphs", "bfs", "dfs"],
        "Tree": ["tree", "binary tree", "bst"],
        "Linked List": ["linked list"],
        "Binary Search": ["binary search"],
        "Math": ["math", "mathematics"],
        "Greedy": ["greedy"],
        "Backtracking": ["backtracking"],
        "Stack": ["stack"],
        "Queue": ["queue"],
        "Heap": ["heap", "priority queue"],
        "Hash Table": ["hash", "hashmap", "hashset"],
        "Sorting": ["sort", "sorting"],
        "Recursion": ["recursion", "recursive"],
    }
    
    for category, keywords in category_map.items():
        for keyword in keywords:
            if keyword in memory_lower and category not in categories:
                categories.append(category)
                break
    
    return categories[:5]  # Return max 5 recent categories


def build_user_profile(
    user_id: str,
    memory_text: str,
    submission_stats: Optional[Dict[str, Any]] = None,
    last_verdict: Optional[str] = None,
    mim_decision: Any = None,  # v3.2: Accept MIM decision for integration
) -> UserProfile:
    """
    Build structured UserProfile from raw memory and submission data.
    
    v3.2 ENHANCEMENTS:
    - Integrates MIM decision into profile
    - Enforces single immutable MIM decision (generates unique ID)
    - Logs ASSERTION if profile history disagrees with MIM diagnosis
    - Tracks profile update timestamp
    
    This function:
    1. Parses memory text for patterns (NO LLM call)
    2. Derives mistakes via keyword matching
    3. Identifies weak topics
    4. Incorporates submission statistics if available
    5. Validates MIM decision against profile history (NEW)
    
    Args:
        user_id: User identifier
        memory_text: Raw concatenated memory chunks from RAG
        submission_stats: Optional dict with total_submissions, success_rate
        last_verdict: Last submission verdict (e.g., "Wrong Answer")
        mim_decision: Optional MIMDecision object for integration
        
    Returns:
        Structured UserProfile for agent consumption
    """
    logger.info(f"Building user profile for user_id={user_id}")
    
    # DEFENSIVE: Normalize memory_text if it's not a string
    if not isinstance(memory_text, str):
        memory_text = normalize_memory_chunks(memory_text)
    
    # Derive components from memory
    common_mistakes = derive_mistakes_from_memory(memory_text)
    weak_topics = derive_weak_topics_from_memory(memory_text)
    recurring_patterns = extract_recurring_patterns(memory_text)
    recent_categories = extract_recent_categories(memory_text)
    
    # Extract stats if provided - DEFENSIVE: handle non-dict input
    total_submissions = None
    success_rate = None
    
    if submission_stats and isinstance(submission_stats, dict):
        total_submissions = submission_stats.get("total_submissions")
        success_rate = submission_stats.get("success_rate")
    elif submission_stats:
        # submission_stats is not a dict - log warning and skip
        logger.warning(f"submission_stats has unexpected type: {type(submission_stats)}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # v3.2: MIM DECISION INTEGRATION
    # ═══════════════════════════════════════════════════════════════════════════════
    current_mim_root_cause = None
    current_mim_confidence = None
    mim_decision_id = None
    profile_mim_agreement = None
    profile_mim_disagreement_reason = None
    
    if mim_decision is not None:
        try:
            # Generate unique immutable decision ID
            mim_decision_id = f"mim_{uuid.uuid4().hex[:12]}"
            
            # Extract MIM root cause - NULL-SAFE
            current_mim_root_cause = getattr(mim_decision, 'root_cause', None)
            current_mim_confidence = getattr(mim_decision, 'root_cause_confidence', None)
            
            # ═══════════════════════════════════════════════════════════════════════════════
            # v3.2: PROFILE-MIM AGREEMENT CHECK (ASSERTION/LOG)
            # ═══════════════════════════════════════════════════════════════════════════════
            if current_mim_root_cause and common_mistakes:
                profile_mim_agreement, profile_mim_disagreement_reason = _check_profile_mim_agreement(
                    mim_root_cause=current_mim_root_cause,
                    profile_mistakes=common_mistakes,
                    weak_topics=weak_topics,
                    user_id=user_id,
                )
            else:
                # No profile history to compare - agreement is neutral
                profile_mim_agreement = None
            
            # Fixed f-string formatting for optional confidence
            confidence_str = f"{current_mim_confidence:.2f}" if current_mim_confidence is not None else "N/A"
            logger.info(
                f"MIM integrated into profile | "
                f"decision_id={mim_decision_id} | "
                f"root_cause={current_mim_root_cause} | "
                f"confidence={confidence_str} | "
                f"agreement={profile_mim_agreement}"
            )
            
        except Exception as e:
            logger.error(f"Failed to integrate MIM decision into profile: {e}")
    
    profile = UserProfile(
        user_id=user_id,
        common_mistakes=common_mistakes,
        weak_topics=weak_topics,
        recurring_patterns=recurring_patterns,
        total_submissions=total_submissions,
        success_rate=success_rate,
        recent_categories=recent_categories,
        last_verdict=last_verdict,
        # v3.2: MIM Integration Fields
        current_mim_root_cause=current_mim_root_cause,
        current_mim_confidence=current_mim_confidence,
        mim_decision_id=mim_decision_id,
        profile_mim_agreement=profile_mim_agreement,
        profile_mim_disagreement_reason=profile_mim_disagreement_reason,
        # v3.2: Update Tracking
        profile_updated_after_submission=True,  # This profile IS the update
        last_profile_update=datetime.now(),
    )
    
    logger.info(
        f"Built profile: mistakes={len(common_mistakes)}, "
        f"weak_topics={len(weak_topics)}, patterns={len(recurring_patterns)}, "
        f"mim_integrated={mim_decision_id is not None}"
    )
    
    return profile


# ═══════════════════════════════════════════════════════════════════════════════
# v3.2: PROFILE-MIM AGREEMENT CHECKER
# ═══════════════════════════════════════════════════════════════════════════════

# MIM root cause to profile mistake keyword mapping
_MIM_TO_PROFILE_MAPPING = {
    "boundary_condition_blindness": ["edge case", "boundary", "empty input"],
    "off_by_one_error": ["off-by-one", "loop boundary", "index"],
    "integer_overflow": ["overflow", "large numbers"],
    "time_complexity_issue": ["time complexity", "TLE", "too slow"],
    "wrong_data_structure": ["data structure", "hashmap", "set"],
    "recursion_issue": ["recursion", "stack overflow", "base case"],
    "logic_error": ["logic error", "wrong logic"],
    "comparison_error": ["comparison", "operator", "< vs <="],
    "algorithm_choice": ["algorithm", "approach", "wrong approach"],
    "edge_case_handling": ["edge case", "corner case", "special case"],
    "input_parsing": ["parsing", "input format", "read"],
    "misread_problem": ["misunderstood", "misread", "wrong interpretation"],
    "partial_solution": ["incomplete", "partial", "missing case"],
    "type_error": ["type error", "type mismatch", "conversion"],
}


def _check_profile_mim_agreement(
    mim_root_cause: str,
    profile_mistakes: List[str],
    weak_topics: List[str],
    user_id: str,
) -> tuple:
    """
    Check if MIM's diagnosis agrees with user's historical profile.
    
    IMPORTANT: This is an ASSERTION check - disagreements are LOGGED, not errors.
    
    Agreement scenarios:
    1. MIM says "off_by_one_error" and profile has "off-by-one" in mistakes → AGREE
    2. MIM says "time_complexity_issue" and profile has "TLE" weakness → AGREE
    3. MIM says "recursion_issue" but profile has no recursion-related mistakes → DISAGREE
    
    Returns:
        (agreement: bool, reason: str or None)
    """
    if not mim_root_cause:
        return None, None
    
    mim_root_cause_lower = mim_root_cause.lower()
    
    # Get expected keywords for this MIM root cause
    expected_keywords = _MIM_TO_PROFILE_MAPPING.get(
        mim_root_cause_lower,
        [mim_root_cause_lower.replace("_", " ")]  # Fallback: use root cause as keyword
    )
    
    # Check if any expected keyword appears in profile mistakes or weak topics
    all_profile_text = " ".join(profile_mistakes + weak_topics).lower()
    
    has_matching_history = any(
        keyword.lower() in all_profile_text
        for keyword in expected_keywords
    )
    
    if has_matching_history:
        logger.info(
            f"✅ PROFILE-MIM AGREEMENT | user={user_id} | "
            f"MIM: {mim_root_cause} matches profile history"
        )
        return True, None
    else:
        # DISAGREEMENT - LOG ASSERTION
        disagreement_reason = (
            f"MIM diagnosed '{mim_root_cause}' but user profile shows no history of "
            f"similar mistakes. Profile mistakes: {profile_mistakes[:3]}"
        )
        
        # ═══════════════════════════════════════════════════════════════════════════════
        # ASSERTION LOG - This is important for MIM calibration
        # ═══════════════════════════════════════════════════════════════════════════════
        logger.warning(
            f"⚠️ PROFILE-MIM DISAGREEMENT ASSERTION | user={user_id} | "
            f"MIM diagnosed: {mim_root_cause} | "
            f"Profile mistakes: {profile_mistakes[:3]} | "
            f"This could indicate: (1) First occurrence of this mistake type, "
            f"(2) MIM miscategorization, or (3) Profile data is stale"
        )
        
        return False, disagreement_reason


def format_profile_for_prompt(profile: UserProfile) -> str:
    """
    Format UserProfile as a string section for prompts.
    
    Args:
        profile: Structured UserProfile
        
    Returns:
        Formatted string for prompt injection
    """
    sections = []
    
    if profile.common_mistakes:
        mistakes_str = "\n".join(f"  - {m}" for m in profile.common_mistakes)
        sections.append(f"COMMON MISTAKES:\n{mistakes_str}")
    
    if profile.weak_topics:
        topics_str = ", ".join(profile.weak_topics)
        sections.append(f"WEAK TOPICS: {topics_str}")
    
    if profile.recurring_patterns:
        patterns_str = "\n".join(f"  - {p}" for p in profile.recurring_patterns)
        sections.append(f"RECURRING PATTERNS:\n{patterns_str}")
    
    if profile.total_submissions is not None:
        stats = f"Total Submissions: {profile.total_submissions}"
        if profile.success_rate is not None:
            stats += f", Success Rate: {profile.success_rate:.1%}"
        sections.append(f"STATISTICS: {stats}")
    
    if profile.recent_categories:
        cats_str = ", ".join(profile.recent_categories)
        sections.append(f"RECENT CATEGORIES: {cats_str}")
    
    if profile.last_verdict:
        sections.append(f"LAST VERDICT: {profile.last_verdict}")
    
    if not sections:
        return "No historical data available for this user."
    
    return "\n\n".join(sections)
