import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key
from app.prompts.feedback import FEEDBACK_PROMPT  # ✅ use prompts folder

logger = logging.getLogger("feedback_agent")


# ============================================================================
# PROBLEM-AWARE & USER-AWARE SYSTEM PROMPT
# ============================================================================
FEEDBACK_SYSTEM_PROMPT = """You are an expert competitive programming reviewer with access to:
1. PROBLEM CONTEXT - including expected approach and common mistakes
2. USER PROFILE - their recurring mistakes and weak topics

TASK:
- Analyze the submitted code against the EXPECTED APPROACH
- Explain *why* the solution failed for hidden test cases
- Check if the user is repeating their RECURRING MISTAKES

CRITICAL ANALYSIS STEPS:
1. Compare user's approach with the EXPECTED APPROACH (from problem context)
2. Check if any of their RECURRING MISTAKES are present in this submission
3. Consider COMMON MISTAKES for this problem category
4. Identify the root cause, not just symptoms

RULES:
- Do NOT restate the problem
- Do NOT provide full solutions or corrected code
- Do NOT speculate without evidence from the code
- Reference the expected approach when relevant
- Mention if user is repeating a pattern from their history
- Focus on logical flaws, missing cases, or incorrect assumptions

OUTPUT:
- explanation: concise, technical, code-aware, references expected approach
- improvement_hint: exactly ONE actionable fix direction
- detected_pattern: recurring mistake pattern if applicable (check user profile)"""


def feedback_agent(context: str, payload: dict) -> FeedbackResponse:
    logger.debug(
        f"📨 feedback_agent called | verdict={payload.get('verdict')} "
        f"| language={payload.get('language')}"
    )

    # -------------------------
    # ACCEPTED → minimal feedback
    # -------------------------
    if payload.get("verdict") == "Accepted":
        return FeedbackResponse(
            explanation="Your solution passed all test cases successfully.",
            improvement_hint="No changes required.",
            detected_pattern=None,
        )

    # -------------------------
    # Cache key (code-aware + problem-aware)
    # -------------------------
    problem = payload.get("problem", {})
    user_profile = payload.get("user_profile", {})
    
    cache_key = build_cache_key(
        "feedback_agent",
        {
            **payload,
            # 🔑 Make cache code-sensitive
            "code_hash": hash(payload.get("code", "")),
            # 🔑 Include problem expected approach in cache key
            "expected_approach": problem.get("expected_approach", ""),
            # 🔑 Include user mistakes pattern for personalization
            "user_mistakes_hash": hash(tuple(user_profile.get("common_mistakes", []))),
        },
    )

    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    logger.debug(f"   └─ Problem: {problem.get('title', 'unknown')}, Expected: {problem.get('expected_approach', 'N/A')}")
    logger.debug(f"   └─ User recurring mistakes: {user_profile.get('common_mistakes', [])}")

    return run_json_agent(
        agent_name="feedback_agent",
        context=context,
        cache_key=cache_key,
        schema=FeedbackResponse,
        system_prompt=FEEDBACK_SYSTEM_PROMPT,
        fallback=FeedbackResponse(
            explanation=(
                "The submission failed due to a logical issue that causes "
                "incorrect results on certain test cases."
            ),
            improvement_hint=(
                "Re-check the algorithm's assumptions against edge cases "
                "revealed by the code."
            ),
            detected_pattern="Logical edge case handling",
        ),
    )
