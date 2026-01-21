import logging
from typing import Dict
from app.graph.async_workflow import async_workflow

logger = logging.getLogger("async_runner")


def run_async_workflow(state: Dict) -> None:
    """
    Fire-and-forget execution of async LangGraph workflow.
    """
    try:
        logger.info("🧵 Async workflow started")
        async_workflow.invoke(state)
        logger.info("✅ Async workflow completed")
    except Exception as e:
        logger.error(f"❌ Async workflow failed: {e}")
