from typing import Type
import time
import logging
import traceback

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.exceptions import OutputParserException
from app.cache.redis_cache import redis_cache

from app.services.llm import get_llm, AllProvidersRateLimitedError, are_all_rate_limited
from app.metrics.agent_metries import record_metric

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
    timeout_seconds: int = None,  # v3.1: Optional timeout for specific agents
    max_context_chars: int = None,  # v3.1: Allow per-agent context limits
):
    logger.info(f"🤖 [{agent_name}] STARTED")
    start = time.time()
    
    # v3.1: Per-agent context limit
    context_limit = max_context_chars if max_context_chars else MAX_CONTEXT_CHARS

    # -------------------------
    # CACHE CHECK (Redis-only)
    # -------------------------
    use_cache = agent_name not in NON_DETERMINISTIC_AGENTS

    if use_cache:
        # Redis caching (fast, distributed)
        logger.debug(f"   └─ Checking Redis cache...")
        cached = redis_cache.get(agent_name, cache_key)
        
        if cached:
            logger.info(f"⚡ [{agent_name}] REDIS CACHE HIT")
            record_metric(agent_name, time.time() - start)
            return schema(**cached)
        

    # -------------------------
    # EARLY RATE LIMIT CHECK
    # -------------------------
    if are_all_rate_limited():
        logger.warning(f"⚡ [{agent_name}] ALL LLMs RATE LIMITED - returning fallback immediately")
        record_metric(agent_name, time.time() - start)
        return fallback

    # -------------------------
    # PREPARE CONTEXT
    # -------------------------
    safe_context = context[:context_limit]
    logger.debug(f"   └─ Context length: {len(safe_context)} chars (limit: {context_limit})")

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
        
        format_instructions = parser.get_format_instructions()
        llm_start = time.time()

        try:
            result = chain.invoke({
                "context": safe_context,
                "format_instructions": format_instructions,
            })
            llm_elapsed = time.time() - llm_start
            logger.info(f"✅ [{agent_name}] LLM call successful in {llm_elapsed:.2f}s")

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
        # CACHE WRITE (Redis-only)
        # -------------------------
        if use_cache:
            logger.debug("   └─ Writing result to Redis cache...")
            redis_cache.set(agent_name, cache_key, result.model_dump())

        record_metric(agent_name, time.time() - start)
        logger.info(
            f"✅ [{agent_name}] COMPLETED in {time.time() - start:.2f}s"
        )
        return result

    except AllProvidersRateLimitedError as e:
        logger.warning(
            f"⚡ [{agent_name}] ALL LLMs RATE LIMITED: {e}"
        )
        record_metric(agent_name, time.time() - start)
        logger.warning(f"⚠️ [{agent_name}] Returning fallback (rate limited)")
        return fallback

    except Exception as e:
        logger.error(
            f"❌ [{agent_name}] UNEXPECTED ERROR: {type(e).__name__}: {e}"
        )
        logger.error(traceback.format_exc())
        record_metric(agent_name, time.time() - start)
        logger.warning(f"⚠️ [{agent_name}] Returning fallback")
        return fallback
