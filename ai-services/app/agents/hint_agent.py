import logging
from app.schemas.hint import CompressedHint
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("hint_compression_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# REWRITTEN: PROBLEM-AWARE HINT GENERATION PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

HINT_SYSTEM_PROMPT = """You are a hint generator for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════
Generate ONE short, actionable hint that guides the user toward the solution
WITHOUT revealing it.

═══════════════════════════════════════════════════════════════════════════════
HINT GENERATION RULES
═══════════════════════════════════════════════════════════════════════════════
LENGTH: Maximum 20 words
TONE: Encouraging but direct
STYLE: Use action verbs ("Consider...", "Check...", "Think about...")

═══════════════════════════════════════════════════════════════════════════════
HINT QUALITY SPECTRUM
═══════════════════════════════════════════════════════════════════════════════
🎯 PERFECT HINT (what we want):
   "Consider what happens when your input array has duplicate elements"
   → Specific to the problem
   → Points to the issue without solving it
   → Actionable

⚠️ TOO VAGUE (avoid):
   "Check your logic"
   "Debug your code"
   "Review edge cases"
   → Not actionable
   → Doesn't help

❌ TOO REVEALING (never do):
   "Use a HashMap with O(1) lookup"
   "Sort the array first, then use binary search"
   → Gives away the solution

═══════════════════════════════════════════════════════════════════════════════
CONTEXT TO USE
═══════════════════════════════════════════════════════════════════════════════
1. EXPECTED APPROACH: Point TOWARD it without naming it
2. USER'S WEAK TOPICS: If this problem touches a weak area, be encouraging
3. KNOWN PITFALLS: Reference if user likely hit one

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "hint": "Your 20-word-max hint here"
}}

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES BY VERDICT
═══════════════════════════════════════════════════════════════════════════════
WRONG ANSWER:
- "Consider what your algorithm returns when all elements are equal"
- "Check if your solution handles the case when n=1"

TIME LIMIT EXCEEDED:
- "Think about whether you can avoid checking every pair"
- "Consider if there's a way to remember previous computations"

RUNTIME ERROR:
- "Check what happens when the input array is empty"
- "Verify your index doesn't exceed array bounds in the loop"

═══════════════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════════════
✗ NEVER give the solution algorithm name
✗ NEVER mention specific data structures to use
✗ NEVER be generic ("fix your code")
✓ ALWAYS be specific to THIS problem
✓ ALWAYS use action verbs
✓ ALWAYS under 20 words"""


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
