from typing import Type
import time
import logging
import traceback

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.exceptions import OutputParserException

from app.services.llm import get_llm
from app.metrics.agent_metries import record_metric
from app.cache.agent_cache import get_cached, set_cached

logger = logging.getLogger("base_json_agent")

MAX_CONTEXT_CHARS = 3500

# Agents that SHOULD NOT reuse cache blindly
NON_DETERMINISTIC_AGENTS = {
    "feedback_agent",
    "hint_compression_agent",
}

def run_json_agent(
    *,
    context: str,
    cache_key: str,
    schema: Type,
    system_prompt: str,
    fallback,
    agent_name: str,
):
    logger.info(f"🤖 [{agent_name}] STARTED")
    start = time.time()

    # -------------------------
    # CACHE CHECK (SAFE)
    # -------------------------
    use_cache = agent_name not in NON_DETERMINISTIC_AGENTS

    if use_cache:
        logger.debug(f"   └─ Checking cache for key: {cache_key[:16]}...")
        cached = get_cached(cache_key)
        if cached is not None:
            logger.info(f"⚡ [{agent_name}] CACHE HIT - returning cached result")
            record_metric(agent_name, time.time() - start)
            return schema(**cached)
        logger.debug("   └─ Cache miss - proceeding with LLM call")
    else:
        logger.debug(f"   └─ Cache bypassed for {agent_name}")

    # -------------------------
    # PREPARE CONTEXT
    # -------------------------
    safe_context = context[:MAX_CONTEXT_CHARS]
    logger.debug(f"   └─ Context length: {len(safe_context)} chars")

    try:
        logger.debug("   └─ Getting LLM instance...")
        llm = get_llm(temperature=0.2)
        logger.debug("   └─ LLM ready")

        parser = PydanticOutputParser(pydantic_object=schema)
        logger.debug(f"   └─ Parser created for schema: {schema.__name__}")

        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a strict JSON API. "
                "Return ONLY valid JSON. "
                "No markdown. No prose.\n\n"
                + system_prompt
            ),
            (
                "human",
                "{format_instructions}\n\nContext:\n{context}"
            ),
        ])

        chain = prompt | llm | parser
        logger.debug("   └─ Chain constructed, invoking LLM...")

        try:
            result = chain.invoke({
                "context": safe_context,
                "format_instructions": parser.get_format_instructions(),
            })
            logger.info(f"✅ [{agent_name}] LLM call successful")

        except OutputParserException as ope:
            logger.warning(
                f"⚠️ [{agent_name}] Output parsing failed: {str(ope)[:100]}"
            )
            logger.debug("   └─ Attempting correction prompt...")

            correction_prompt = ChatPromptTemplate.from_messages([
                ("system", "Fix the previous response. Return ONLY valid JSON."),
                ("human", "{format_instructions}\n\nContext:\n{context}"),
            ])

            try:
                result = (correction_prompt | llm | parser).invoke({
                    "context": safe_context,
                    "format_instructions": parser.get_format_instructions(),
                })
                logger.info(f"✅ [{agent_name}] Correction prompt successful")
            except Exception as e2:
                logger.error(
                    f"❌ [{agent_name}] Correction failed: {type(e2).__name__}: {e2}"
                )
                record_metric(agent_name, time.time() - start)
                logger.warning(f"⚠️ [{agent_name}] Returning fallback")
                return fallback

        # -------------------------
        # CACHE WRITE (SAFE)
        # -------------------------
        if use_cache:
            logger.debug("   └─ Writing result to cache...")
            set_cached(cache_key, result.model_dump())

        record_metric(agent_name, time.time() - start)
        logger.info(
            f"✅ [{agent_name}] COMPLETED in {time.time() - start:.2f}s"
        )
        return result

    except Exception as e:
        logger.error(
            f"❌ [{agent_name}] UNEXPECTED ERROR: {type(e).__name__}: {e}"
        )
        logger.error(traceback.format_exc())
        record_metric(agent_name, time.time() - start)
        logger.warning(f"⚠️ [{agent_name}] Returning fallback")
        return fallback
