import logging
from app.schemas.hint import CompressedHint
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("hint_compression_agent")


# ============================================================================
# PROBLEM-AWARE HINT SYSTEM PROMPT
# ============================================================================
HINT_SYSTEM_PROMPT = """You are a hint generator for competitive programming.

CONTEXT AVAILABLE:
1. PROBLEM DEFINITION - including expected approach and difficulty
2. USER PROFILE - their weak topics and recurring mistakes
3. Current submission analysis

TASK:
Generate ONE short, actionable hint that:
- Points toward the EXPECTED APPROACH without revealing it
- Addresses user's specific mistake in this submission
- Is encouraging but doesn't give away the solution

RULES:
- Maximum 20 words
- No full solutions or corrected code
- Be specific to THIS problem, not generic advice
- If user's mistake matches their weak topic, acknowledge gently
- Use action verbs: "Consider...", "Check...", "Think about..."

HINT QUALITY:
- Good: "Consider what happens when the array is already sorted"
- Bad: "Fix your code" (too vague)
- Bad: "Use a HashMap to track seen elements" (too revealing)"""


def hint_agent(raw_hint: str, payload: dict) -> CompressedHint:
    logger.debug("✂️ hint_compression_agent called")

    # Extract problem and user context
    problem = payload.get("problem", {})
    user_profile = payload.get("user_profile", {})
    
    # Build context with problem awareness
    augmented_context = f"""
RAW IMPROVEMENT HINT:
{raw_hint}

PROBLEM CONTEXT:
- Difficulty: {problem.get('difficulty', 'Unknown')}
- Expected Approach: {problem.get('expected_approach', 'Not specified')}
- Common Mistakes: {', '.join(problem.get('common_mistakes', [])[:2]) or 'None listed'}

USER CONTEXT:
- Weak Topics: {', '.join(user_profile.get('weak_topics', [])[:2]) or 'None identified'}
- Recurring Mistakes: {', '.join(user_profile.get('common_mistakes', [])[:2]) or 'None identified'}

INSTRUCTIONS:
- Rewrite into ONE short actionable sentence (max 20 words)
- Point toward expected approach WITHOUT revealing it
- If user mistake matches their weak area, be encouraging
- No explanations, just the hint
"""

    cache_key = build_cache_key(
        "hint_compression_agent", 
        {
            **payload,
            "expected_approach": problem.get("expected_approach", ""),
        }
    )

    return run_json_agent(
        agent_name="hint_compression_agent",
        context=augmented_context,
        cache_key=cache_key,
        schema=CompressedHint,
        system_prompt=HINT_SYSTEM_PROMPT,
        fallback=CompressedHint(
            hint=raw_hint.split(".")[0][:120] if raw_hint else "Review your approach carefully."
        )
    )
