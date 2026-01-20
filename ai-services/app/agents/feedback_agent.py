import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("feedback_agent")


def feedback_agent(context: str, payload: dict) -> FeedbackResponse:
    logger.debug(f"📨 feedback_agent called with payload keys: {list(payload.keys())}")
    cache_key = build_cache_key("feedback_agent", payload)
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")

    return run_json_agent(
        agent_name="feedback_agent",
        context=context,
        cache_key=cache_key,
        schema=FeedbackResponse,
        system_prompt="Explain why the solution failed and suggest one improvement.",
        fallback=FeedbackResponse(
            explanation="Unable to generate structured feedback.",
            improvement_hint="Simplify logic and retry.",
            detected_pattern="Model output formatting issue"
        )
    )
