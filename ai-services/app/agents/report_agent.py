import logging
from app.schemas.report import WeeklyProgressReport
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("report_agent")


def report_agent(context: str, payload: dict) -> WeeklyProgressReport:
    logger.debug(f"📨 report_agent called")
    cache_key = build_cache_key("weekly_report_agent", payload)
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    
    return run_json_agent(
        agent_name="weekly_report_agent",
        context=context,
        cache_key=cache_key,
        schema=WeeklyProgressReport,
        system_prompt="Summarize weekly performance and patterns.",
        fallback=WeeklyProgressReport(
            summary="Not enough data.",
            strengths=[],
            improvement_areas=[],
            recurring_patterns=[]
        )
    )
