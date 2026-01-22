from typing import TypedDict, Optional, Dict, List, Any
from concurrent.futures import ThreadPoolExecutor
import logging
import traceback

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.learning import LearningRecommendation
from app.schemas.difficulty import DifficultyAdjustment
from app.schemas.report import WeeklyProgressReport

from app.agents.learning_agent import learning_agent
from app.agents.difficulty_agent import difficulty_agent
from app.agents.report_agent import report_agent
from app.rag.retriever import store_user_feedback

logger = logging.getLogger("async_workflow")

# -------------------------
# STATE
# -------------------------
class AsyncState(TypedDict, total=False):
    user_id: str
    problem_id: str
    problem_category: str
    verdict: str

    context: str
    feedback: Optional[FeedbackResponse]

    # NEW: Structured problem and user profile (passed from sync workflow)
    problem: Optional[Dict[str, Any]]  # ProblemContext as dict
    user_profile: Optional[Dict[str, Any]]  # UserProfile as dict

    learning_recommendation: Optional[LearningRecommendation]
    difficulty_adjustment: Optional[DifficultyAdjustment]
    weekly_report: Optional[WeeklyProgressReport]

# -------------------------
# ASYNC NODES (GUARDED)
# -------------------------

def learning_node(state: AsyncState) -> AsyncState:
    try:
        logger.info("🧠 [ASYNC] learning_agent started")
        state["learning_recommendation"] = learning_agent(
            state["context"], state
        )
        logger.info("✅ [ASYNC] learning_agent completed")
    except Exception as e:
        logger.error("❌ [ASYNC] learning_agent failed")
        logger.error(traceback.format_exc())
        state["learning_recommendation"] = None
    return state


def difficulty_node(state: AsyncState) -> AsyncState:
    try:
        logger.info("📈 [ASYNC] difficulty_agent started")
        state["difficulty_adjustment"] = difficulty_agent(
            state["context"], state
        )
        logger.info("✅ [ASYNC] difficulty_agent completed")
    except Exception:
        logger.error("❌ [ASYNC] difficulty_agent failed")
        logger.error(traceback.format_exc())
        state["difficulty_adjustment"] = None
    return state


def weekly_report_node(state: AsyncState) -> AsyncState:
    # Weekly report only if explicitly requested
    if not state.get("request_weekly_report"):
        return state

    try:
        logger.info("📊 [ASYNC] weekly_report_agent started")
        state["weekly_report"] = report_agent(
            context=state["context"],
            payload=state,
        )
        logger.info("✅ [ASYNC] weekly_report_agent completed")
    except Exception:
        logger.error("❌ [ASYNC] weekly_report_agent failed")
        logger.error(traceback.format_exc())
        state["weekly_report"] = None
    return state


def store_memory_node(state: AsyncState) -> AsyncState:
    try:
        feedback = state.get("feedback")
        if feedback:
            logger.info("💾 [ASYNC] storing user memory")
            store_user_feedback(
                user_id=state["user_id"],
                problem_id=state["problem_id"],
                category=state["problem_category"],
                mistake_summary=feedback.improvement_hint,
            )
            logger.info("✅ [ASYNC] memory stored")
    except Exception:
        logger.error("❌ [ASYNC] memory storage failed")
        logger.error(traceback.format_exc())
    return state

# -------------------------
# GRAPH
# -------------------------
def build_async_workflow():
    graph = StateGraph(AsyncState)

    graph.add_node("learning", learning_node)
    graph.add_node("difficulty", difficulty_node)
    graph.add_node("weekly_report", weekly_report_node)
    graph.add_node("store_memory", store_memory_node)

    graph.set_entry_point("learning")

    graph.add_edge("learning", "difficulty")
    graph.add_edge("difficulty", "weekly_report")
    graph.add_edge("weekly_report", "store_memory")
    graph.add_edge("store_memory", END)

    return graph.compile()


async_workflow = build_async_workflow()
