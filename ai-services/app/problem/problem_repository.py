"""
Problem Repository
==================

Repository abstraction for fetching problem context.
Agents NEVER query DB directly - they use this module.

This module:
- Fetches problem details from DB/CMS
- Caches results to avoid repeated queries
- Returns structured ProblemContext for agents

IMPORTANT: This is the ONLY place where problem DB queries happen.
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel
from functools import lru_cache
import logging
import os

logger = logging.getLogger("problem_repository")

# ═══════════════════════════════════════════════════════════════════════════════
# PROBLEM CONTEXT SCHEMA
# ═══════════════════════════════════════════════════════════════════════════════

class ProblemContext(BaseModel):
    """
    Structured problem context for agent consumption.
    This is the canonical representation of a problem for AI reasoning.
    """
    problem_id: str
    title: str
    statement: str  # Problem description (truncated for context window)
    constraints: str
    tags: List[str]
    difficulty: str  # Easy, Medium, Hard
    expected_approach: str  # High-level approach hint (NO solution code)
    time_complexity_hint: Optional[str] = None
    space_complexity_hint: Optional[str] = None
    common_mistakes: List[str] = []  # Known common mistakes for this problem
    
    class Config:
        json_schema_extra = {
            "example": {
                "problem_id": "prob_123",
                "title": "Two Sum",
                "statement": "Given an array of integers...",
                "constraints": "2 <= nums.length <= 10^4",
                "tags": ["Array", "Hash Table"],
                "difficulty": "Easy",
                "expected_approach": "Use a hash map to store complements",
                "time_complexity_hint": "O(n)",
                "space_complexity_hint": "O(n)",
                "common_mistakes": ["Not handling duplicate values", "Off-by-one errors"]
            }
        }

# ═══════════════════════════════════════════════════════════════════════════════
# PROBLEM CACHE (In-Memory LRU)
# ═══════════════════════════════════════════════════════════════════════════════

# Cache up to 100 problems in memory
@lru_cache(maxsize=100)
def _cached_get_problem(problem_id: str) -> Optional[Dict[str, Any]]:
    """
    Internal cached fetch. Returns raw dict from DB.
    """
    return _fetch_problem_from_db(problem_id)


def _clear_problem_cache():
    """Clear the problem cache (for testing)"""
    _cached_get_problem.cache_clear()


# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE FETCH (MOCK - Replace with actual DB call)
# ═══════════════════════════════════════════════════════════════════════════════

def _fetch_problem_from_db(problem_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch problem from database.
    
    TODO: Replace this with actual MongoDB/PostgreSQL query.
    For now, returns mock data or queries backend API.
    """
    logger.debug(f"📥 Fetching problem from DB: {problem_id}")
    
    # Try to fetch from backend API if configured
    backend_url = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")
    
    try:
        import httpx
        
        # Fetch from backend's public question endpoint
        response = httpx.get(
            f"{backend_url}/questions/{problem_id}",
            timeout=5.0
        )
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Problem fetched from backend: {problem_id}")
            return data
        else:
            logger.warning(f"⚠️ Backend returned {response.status_code} for problem {problem_id}")
            
    except Exception as e:
        logger.warning(f"⚠️ Could not fetch from backend: {e}")
    
    # Fallback: Return minimal context from what we know
    logger.info(f"📋 Using minimal problem context for: {problem_id}")
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# APPROACH INFERENCE
# ═══════════════════════════════════════════════════════════════════════════════

# Known approach patterns by tag
TAG_TO_APPROACH = {
    "Array": "Consider using two pointers or hash maps for efficient lookups",
    "Hash Table": "Use a dictionary/hash map to store and lookup values in O(1)",
    "String": "Consider character frequency counting or sliding window",
    "Two Pointers": "Use two pointers from opposite ends or same direction",
    "Binary Search": "Apply binary search on sorted data or search space",
    "Dynamic Programming": "Break down into subproblems with overlapping structure",
    "Tree": "Consider recursive DFS or iterative BFS traversal",
    "Graph": "Use BFS for shortest path, DFS for connectivity/cycles",
    "Stack": "Use stack for matching pairs or maintaining monotonic sequence",
    "Queue": "Use queue for level-order traversal or BFS",
    "Linked List": "Use slow/fast pointers or dummy head technique",
    "Recursion": "Define base case and recursive relation carefully",
    "Greedy": "Make locally optimal choices that lead to global optimum",
    "Backtracking": "Explore all possibilities with pruning",
    "Sorting": "Sort first, then apply appropriate algorithm",
    "Math": "Look for mathematical patterns or formulas",
    "Bit Manipulation": "Use XOR, AND, OR operations for efficiency",
    "Sliding Window": "Maintain a window and slide it across the data",
    "Heap": "Use min/max heap for efficient priority operations",
    "Trie": "Build a prefix tree for string prefix operations",
}

# Common mistakes by tag
TAG_TO_COMMON_MISTAKES = {
    "Array": ["Off-by-one errors in indexing", "Not handling empty arrays"],
    "Binary Search": ["Wrong mid calculation", "Incorrect termination condition"],
    "Dynamic Programming": ["Wrong state transition", "Missing base cases"],
    "Tree": ["Not handling null nodes", "Incorrect recursion base case"],
    "Graph": ["Not marking visited nodes", "Cycle detection issues"],
    "String": ["Unicode handling issues", "Not trimming whitespace"],
    "Linked List": ["Losing reference to head", "Not handling single node"],
    "Stack": ["Not checking if empty before pop", "Wrong order of operations"],
    "Recursion": ["Stack overflow from missing base case", "Wrong recursion direction"],
}


def _infer_approach(tags: List[str], difficulty: str) -> str:
    """
    Infer expected approach from problem tags.
    Returns high-level hint, NEVER a full solution.
    """
    approaches = []
    for tag in tags:
        if tag in TAG_TO_APPROACH:
            approaches.append(TAG_TO_APPROACH[tag])
    
    if approaches:
        return approaches[0]  # Return primary approach
    
    # Fallback based on difficulty
    if difficulty == "Easy":
        return "Start with a brute force approach, then optimize"
    elif difficulty == "Medium":
        return "Consider using appropriate data structures for efficiency"
    else:
        return "This problem likely requires advanced algorithmic techniques"


def _get_common_mistakes(tags: List[str]) -> List[str]:
    """
    Get common mistakes for the problem based on tags.
    """
    mistakes = []
    for tag in tags:
        if tag in TAG_TO_COMMON_MISTAKES:
            mistakes.extend(TAG_TO_COMMON_MISTAKES[tag])
    return list(set(mistakes))[:5]  # Dedupe and limit


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

def get_problem_by_id(
    problem_id: str,
    category: Optional[str] = None,
    constraints: Optional[str] = None
) -> ProblemContext:
    """
    Get structured problem context by ID.
    
    This is the ONLY function agents should use to get problem information.
    
    Args:
        problem_id: The problem identifier
        category: Fallback category if DB fetch fails
        constraints: Fallback constraints if DB fetch fails
    
    Returns:
        ProblemContext with all fields populated
    """
    logger.info(f"🔍 get_problem_by_id called: {problem_id}")
    
    # Try to fetch from cache/DB
    raw_data = _cached_get_problem(problem_id)
    
    if raw_data:
        # Parse from DB response
        tags = raw_data.get("tags", [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",")]
        
        difficulty = raw_data.get("difficulty", "Medium")
        
        return ProblemContext(
            problem_id=problem_id,
            title=raw_data.get("title", f"Problem {problem_id}"),
            statement=_truncate_statement(raw_data.get("description", "")),
            constraints=raw_data.get("constraints", constraints or "No constraints provided"),
            tags=tags,
            difficulty=difficulty,
            expected_approach=_infer_approach(tags, difficulty),
            time_complexity_hint=raw_data.get("time_complexity_hint"),
            space_complexity_hint=raw_data.get("space_complexity_hint"),
            common_mistakes=_get_common_mistakes(tags),
        )
    
    # Fallback: Build minimal context from provided data
    logger.warning(f"⚠️ Using fallback context for problem: {problem_id}")
    
    tags = [category] if category else ["General"]
    
    return ProblemContext(
        problem_id=problem_id,
        title=f"Problem {problem_id}",
        statement="Problem statement not available",
        constraints=constraints or "No constraints provided",
        tags=tags,
        difficulty="Medium",
        expected_approach=_infer_approach(tags, "Medium"),
        common_mistakes=_get_common_mistakes(tags),
    )


def _truncate_statement(statement: str, max_length: int = 500) -> str:
    """
    Truncate problem statement to fit in context window.
    Preserves key information at the start.
    """
    if not statement:
        return "Problem statement not available"
    
    if len(statement) <= max_length:
        return statement
    
    return statement[:max_length].rsplit(" ", 1)[0] + "..."
