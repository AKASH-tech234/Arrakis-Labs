"""
User Profile Builder
====================

Builds structured UserProfile from raw RAG memory chunks.
NO EXTRA LLM CALLS - uses pattern matching and heuristics.

Key responsibilities:
1. Parse memory chunks into structured patterns
2. Identify recurring mistakes via keyword matching
3. Extract weak topics from memory text
4. Generate profile summary for agents
"""

import re
from typing import List, Dict, Any, Optional
from functools import lru_cache
import logging

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
    last_verdict: Optional[str] = None
) -> UserProfile:
    """
    Build structured UserProfile from raw memory and submission data.
    
    This function:
    1. Parses memory text for patterns (NO LLM call)
    2. Derives mistakes via keyword matching
    3. Identifies weak topics
    4. Incorporates submission statistics if available
    
    Args:
        user_id: User identifier
        memory_text: Raw concatenated memory chunks from RAG
        submission_stats: Optional dict with total_submissions, success_rate
        last_verdict: Last submission verdict (e.g., "Wrong Answer")
        
    Returns:
        Structured UserProfile for agent consumption
    """
    logger.info(f"Building user profile for user_id={user_id}")
    
    # Derive components from memory
    common_mistakes = derive_mistakes_from_memory(memory_text)
    weak_topics = derive_weak_topics_from_memory(memory_text)
    recurring_patterns = extract_recurring_patterns(memory_text)
    recent_categories = extract_recent_categories(memory_text)
    
    # Extract stats if provided
    total_submissions = None
    success_rate = None
    
    if submission_stats:
        total_submissions = submission_stats.get("total_submissions")
        success_rate = submission_stats.get("success_rate")
    
    profile = UserProfile(
        user_id=user_id,
        common_mistakes=common_mistakes,
        weak_topics=weak_topics,
        recurring_patterns=recurring_patterns,
        total_submissions=total_submissions,
        success_rate=success_rate,
        recent_categories=recent_categories,
        last_verdict=last_verdict
    )
    
    logger.info(
        f"Built profile: mistakes={len(common_mistakes)}, "
        f"weak_topics={len(weak_topics)}, patterns={len(recurring_patterns)}"
    )
    
    return profile


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
