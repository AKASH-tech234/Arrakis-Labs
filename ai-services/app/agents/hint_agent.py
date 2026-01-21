import logging
from app.schemas.hint import CompressedHint
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("hint_compression_agent")


def hint_agent(raw_hint: str, payload: dict) -> CompressedHint:
    logger.debug("✂️ hint_compression_agent called")

    augmented_context = f"""
RAW IMPROVEMENT HINT:
{raw_hint}

INSTRUCTIONS:
- Rewrite into ONE short actionable sentence
- Less than 20 words
- No explanations
"""

    cache_key = build_cache_key("hint_compression_agent", payload)

    return run_json_agent(
        agent_name="hint_compression_agent",
        context=augmented_context,
        cache_key=cache_key,
        schema=CompressedHint,
        system_prompt="Compress the hint into a single concise actionable sentence.",
        fallback=CompressedHint(
            hint=raw_hint.split(".")[0][:120]
        )
    )
