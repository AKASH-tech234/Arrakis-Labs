import logging
from app.schemas.learning import LearningRecommendation
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("learning_agent")


def learning_agent(context: str, payload: dict) -> LearningRecommendation:
    logger.debug(f"📨 learning_agent called")
    cache_key = build_cache_key("learning_agent", payload)
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    
    return run_json_agent(
        agent_name="learning_agent",
        context=context,
        cache_key=build_cache_key("learning_agent", payload),
        schema=LearningRecommendation,
        system_prompt="Suggest learning focus areas based on the mistake.",
        fallback=LearningRecommendation(
            focus_areas=["Fundamentals"],
            rationale="Fallback recommendation."
        )
    )
