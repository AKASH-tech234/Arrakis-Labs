import logging
from app.schemas.pattern import DetectedPattern
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("pattern_detection_agent")


# ============================================================================
# PROBLEM-AWARE & USER-AWARE SYSTEM PROMPT
# ============================================================================
PATTERN_SYSTEM_PROMPT = """You are a mistake pattern analyst with access to:
1. PROBLEM CONTEXT - including expected approach and common mistakes for this category
2. USER PROFILE - their historical recurring mistakes and weak topics

TASK:
Identify if this submission exhibits a RECURRING or ABSTRACT mistake pattern.

ANALYSIS APPROACH:
1. Check USER PROFILE for their known recurring mistakes
2. Compare current error with COMMON MISTAKES for this problem category
3. Look for abstract patterns like:
   - Time complexity issues (brute force when optimization needed)
   - Boundary handling (off-by-one, empty input, edge cases)
   - Incorrect assumptions about problem constraints
   - Wrong data structure choice for the approach

PATTERN DETECTION RULES:
- If user is repeating a mistake from their history, PRIORITIZE naming that pattern
- If it's a new pattern not in history, identify it abstractly
- Return null ONLY if no clear pattern exists
- Be specific but abstract (e.g., "off-by-one in binary search" not "line 15 has bug")

CONFIDENCE LEVELS:
- 0.9+: Matches user's known recurring mistake
- 0.7-0.9: Matches common mistakes for this problem category
- 0.5-0.7: New pattern identified
- <0.5: Uncertain, consider returning null"""


def pattern_detection_agent(context: str, payload: dict) -> DetectedPattern:
    logger.debug("📨 pattern_detection_agent called")

    # Extract structured data for cache key
    problem = payload.get("problem", {})
    user_profile = payload.get("user_profile", {})

    cache_key = build_cache_key(
        "pattern_detection_agent", 
        {
            **payload,
            # Include problem category for pattern relevance
            "problem_category": problem.get("tags", []),
            # Include user's known patterns
            "user_patterns_hash": hash(tuple(user_profile.get("recurring_patterns", []))),
        }
    )
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    logger.debug(f"   └─ User known patterns: {user_profile.get('recurring_patterns', [])}")

    return run_json_agent(
        agent_name="pattern_detection_agent",
        context=context,
        cache_key=cache_key,
        schema=DetectedPattern,
        system_prompt=PATTERN_SYSTEM_PROMPT,
        fallback=DetectedPattern(
            pattern=None,
            confidence=0.0
        )
    )
