import logging
from app.schemas.pattern import DetectedPattern
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("pattern_detection_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# REWRITTEN: ABSTRACT PATTERN DETECTION PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

PATTERN_SYSTEM_PROMPT = """You are a mistake pattern analyst for competitive programming submissions.

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════
Identify the ABSTRACT mistake pattern in this submission.
The pattern should be REUSABLE knowledge that helps the user avoid similar mistakes.

═══════════════════════════════════════════════════════════════════════════════
CONTEXT YOU HAVE
═══════════════════════════════════════════════════════════════════════════════
1. USER'S RECURRING MISTAKES (from profile)
   → Check if this submission matches a known pattern

2. KNOWN PITFALLS for this problem category
   → Check if user fell into a category-specific trap

3. CURRENT SUBMISSION VERDICT
   → Use verdict type to narrow down pattern category

═══════════════════════════════════════════════════════════════════════════════
PATTERN DETECTION ALGORITHM
═══════════════════════════════════════════════════════════════════════════════
PRIORITY 1: Does this match user's RECURRING MISTAKES?
           → If yes, return that pattern with high confidence (0.9+)

PRIORITY 2: Does this match KNOWN PITFALLS for the problem category?
           → If yes, return category-specific pattern (0.7-0.9)

PRIORITY 3: Is there a new identifiable pattern?
           → If yes, create an abstract name (0.5-0.7)

PRIORITY 4: No clear pattern?
           → Return null

═══════════════════════════════════════════════════════════════════════════════
ABSTRACT PATTERN EXAMPLES (use these as templates)
═══════════════════════════════════════════════════════════════════════════════
ITERATION PATTERNS:
- "off-by-one in loop termination"
- "premature loop exit"
- "missing reverse iteration"

BOUNDARY PATTERNS:
- "empty input not handled"
- "single element edge case"
- "maximum constraint overflow"

COMPLEXITY PATTERNS:
- "O(n²) when O(n) expected"
- "unnecessary nested loops"
- "brute force instead of optimization"

LOGIC PATTERNS:
- "wrong comparison operator"
- "inverted condition"
- "missing state reset between iterations"

DATA STRUCTURE PATTERNS:
- "using array when hashmap needed"
- "wrong container for range queries"
- "missing visited set in traversal"

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "pattern": "abstract pattern name" or null,
  "confidence": 0.0-1.0
}}

═══════════════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════════════
✗ Do NOT return line-specific bugs (e.g., "line 15 has bug")
✗ Do NOT return problem-specific patterns (e.g., "two sum hash issue")
✓ DO return ABSTRACT patterns that apply to multiple problems
✓ DO check user's recurring mistakes FIRST"""


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
