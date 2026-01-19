from app.schemas.difficulty import DifficultyAdjustment
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key


def difficulty_agent(context: str, payload: dict) -> DifficultyAdjustment:
    cache_key = build_cache_key(
        agent_name="difficulty_agent",
        payload=payload
    )

    return run_json_agent(
        agent_name="difficulty_agent",
        context=context,
        cache_key=cache_key,
        schema=DifficultyAdjustment,
        system_prompt=(
            "Based on the user's performance, decide whether to "
            "increase, decrease, or maintain problem difficulty."
        ),
        fallback=DifficultyAdjustment(
            action="maintain",
            rationale="Insufficient signal to adjust difficulty."
        ),
    )
