import logging
from app.schemas.pattern import DetectedPattern
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("pattern_detection_agent")


def pattern_detection_agent(context: str, payload: dict) -> DetectedPattern:
    logger.debug("📨 pattern_detection_agent called")

    cache_key = build_cache_key("pattern_detection_agent", payload)
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")

    return run_json_agent(
        agent_name="pattern_detection_agent",
        context=context,
        cache_key=cache_key,
        schema=DetectedPattern,
        system_prompt=(
            "Analyze the context and identify any recurring or abstract mistake pattern.\n"
            "Examples: time complexity issues, boundary handling, incorrect assumptions.\n"
            "Return null if no clear pattern exists."
        ),
        fallback=DetectedPattern(
            pattern=None,
            confidence=0.0
        )
    )
