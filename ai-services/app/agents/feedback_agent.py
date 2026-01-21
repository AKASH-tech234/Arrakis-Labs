import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key
from app.prompts.feedback import FEEDBACK_PROMPT  # ✅ use prompts folder

logger = logging.getLogger("feedback_agent")


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
    # Cache key (code-aware)
    # -------------------------
    cache_key = build_cache_key(
        "feedback_agent",
        {
            **payload,
            # 🔑 Make cache code-sensitive without changing cache_key util
            "code_hash": hash(payload.get("code", "")),
        },
    )

    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")

    # -------------------------
    # System prompt (strong + precise)
    # -------------------------
    system_prompt = (
        "You are an expert competitive programming reviewer.\n\n"
        "TASK:\n"
        "- Analyze the submitted code and execution result\n"
        "- Explain *why* the solution failed for hidden test cases\n"
        "- Base reasoning strictly on the given code and context\n\n"
        "RULES:\n"
        "- Do NOT restate the problem\n"
        "- Do NOT provide full solutions or corrected code\n"
        "- Do NOT speculate without evidence from the code\n"
        "- Focus on logical flaws, missing cases, or incorrect assumptions\n"
        "- Mention edge cases ONLY if they directly relate to the code\n\n"
        "OUTPUT:\n"
        "- explanation: concise, technical, code-aware\n"
        "- improvement_hint: exactly ONE actionable fix direction\n"
        "- detected_pattern: recurring mistake pattern if applicable"
    )

    return run_json_agent(
        agent_name="feedback_agent",
        context=context,
        cache_key=cache_key,
        schema=FeedbackResponse,
        system_prompt=system_prompt,
        fallback=FeedbackResponse(
            explanation=(
                "The submission failed due to a logical issue that causes "
                "incorrect results on certain test cases."
            ),
            improvement_hint=(
                "Re-check the algorithm’s assumptions against edge cases "
                "revealed by the code."
            ),
            detected_pattern="Logical edge case handling",
        ),
    )
