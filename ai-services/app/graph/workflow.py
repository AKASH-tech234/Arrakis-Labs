from typing import TypedDict, Optional, List
from concurrent.futures import ThreadPoolExecutor
import logging
import traceback
import time

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.learning import LearningRecommendation
from app.schemas.difficulty import DifficultyAdjustment
from app.schemas.report import WeeklyProgressReport
from app.schemas.submission import SubmissionContext

from app.rag.retriever import retrieve_user_memory, store_user_feedback
from app.rag.context_builder import build_context

from app.agents.feedback_agent import feedback_agent
from app.agents.learning_agent import learning_agent
from app.agents.difficulty_agent import difficulty_agent
from app.agents.report_agent import report_agent
from app.agents.context_compressor import compress_context

# -------------------------
# LOGGING
# -------------------------
logger = logging.getLogger("workflow")
logger.info("🔧 Workflow module loading...")


# -------------------------
# STATE
# -------------------------
class MentatState(TypedDict):
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: Optional[str]

    user_memory: List[str]
    context: str

    feedback: Optional[FeedbackResponse]
    learning_recommendation: Optional[LearningRecommendation]
    difficulty_adjustment: Optional[DifficultyAdjustment]
    weekly_report: Optional[WeeklyProgressReport]

    should_store_memory: bool


# -------------------------
# NODES
# -------------------------
def retrieve_memory_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] retrieve_memory_node STARTED")
    start = time.time()
    try:
        query = f"{state['problem_category']} {state.get('error_type', '')}"
        logger.debug(f"   └─ User ID: {state['user_id']}")
        logger.debug(f"   └─ Query: {query}")
        
        state["user_memory"] = retrieve_user_memory(
            user_id=state["user_id"],
            query=query,
            k=3,
        )
        
        logger.info(f"   └─ Retrieved {len(state['user_memory'])} memory chunks")
        logger.info(f"✅ [NODE] retrieve_memory_node COMPLETED in {time.time()-start:.2f}s")
    except Exception as e:
        logger.error(f"❌ [NODE] retrieve_memory_node FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
        state["user_memory"] = []
    return state


def build_context_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] build_context_node STARTED")
    start = time.time()
    try:
        submission = SubmissionContext(
            user_id=state["user_id"],
            problem_id=state["problem_id"],
            problem_category=state["problem_category"],
            constraints=state["constraints"],
            code=state["code"],
            language=state["language"],
            verdict=state["verdict"],
            error_type=state.get("error_type"),
            user_history_summary=None,
        )
        logger.debug("   └─ SubmissionContext created")

        raw_context = build_context(submission, state["user_memory"])
        logger.debug(f"   └─ Raw context length: {len(raw_context)} chars")

        # 🔥 COMPRESS CONTEXT BEFORE AGENTS
        state["context"] = raw_context[:3500]
        logger.info(f"   └─ Compressed context length: {len(state['context'])} chars")
        logger.info(f"✅ [NODE] build_context_node COMPLETED in {time.time()-start:.2f}s")
    except Exception as e:
        logger.error(f"❌ [NODE] build_context_node FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
        raise
    return state


def feedback_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] feedback_node STARTED")
    start = time.time()
    try:
        logger.debug(f"   └─ Context length: {len(state.get('context', ''))} chars")
        
        feedback = feedback_agent(
            context=state["context"],
            payload=state
        )
        
        state["feedback"] = feedback
        state["mistake_summary"] = feedback.improvement_hint
        
        logger.info(f"   └─ Feedback generated: {feedback.explanation[:50]}...")
        logger.info(f"✅ [NODE] feedback_node COMPLETED in {time.time()-start:.2f}s")
    except Exception as e:
        logger.error(f"❌ [NODE] feedback_node FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
        raise
    return state

def parallel_learning_difficulty_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] parallel_learning_difficulty_node STARTED")
    start = time.time()
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            logger.debug("   └─ Submitting learning_agent task...")
            learning_future = executor.submit(learning_agent, state["context"], state)
            
            logger.debug("   └─ Submitting difficulty_agent task...")
            # NOTE: difficulty_agent only takes 'context' as argument
            difficulty_future = executor.submit(difficulty_agent, state["context"],state)

            logger.debug("   └─ Waiting for learning_agent result...")
            state["learning_recommendation"] = learning_future.result()
            logger.info(f"   └─ Learning agent completed: {state['learning_recommendation']}")
            
            logger.debug("   └─ Waiting for difficulty_agent result...")
            state["difficulty_adjustment"] = difficulty_future.result()
            logger.info(f"   └─ Difficulty agent completed: {state['difficulty_adjustment']}")

        logger.info(f"✅ [NODE] parallel_learning_difficulty_node COMPLETED in {time.time()-start:.2f}s")
    except Exception as e:
        logger.error(f"❌ [NODE] parallel_learning_difficulty_node FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
        raise
    return state


def weekly_report_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] weekly_report_node STARTED")
    start = time.time()
    try:
        state["weekly_report"] = report_agent(
            context=state["context"],
            payload=state
        )
        logger.info(f"   └─ Weekly report generated")
        logger.info(f"✅ [NODE] weekly_report_node COMPLETED in {time.time()-start:.2f}s")
    except Exception as e:
        logger.warning(f"⚠️ [NODE] weekly_report_node FAILED (non-critical): {type(e).__name__}: {e}")
        state["weekly_report"] = None
    return state


def memory_decision_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] memory_decision_node STARTED")
    state["should_store_memory"] = state["verdict"] != "Accepted"
    logger.info(f"   └─ Verdict: {state['verdict']} -> should_store_memory: {state['should_store_memory']}")
    logger.info("✅ [NODE] memory_decision_node COMPLETED")
    return state

from typing import cast
from app.schemas.feedback import FeedbackResponse


def store_memory_node(state: MentatState) -> MentatState:
    logger.info("🟡 [NODE] store_memory_node STARTED")
    start = time.time()
    try:
        if state.get("should_store_memory") and state.get("feedback") is not None:
            feedback = cast(FeedbackResponse, state["feedback"])
            logger.debug(f"   └─ Storing memory for user: {state['user_id']}")

            store_user_feedback(
                user_id=state["user_id"],
                problem_id=state["problem_id"],
                category=state["problem_category"],
                mistake_summary=feedback.improvement_hint,
            )
            logger.info("   └─ Memory stored successfully")
        else:
            logger.info("   └─ Skipping memory storage (accepted or no feedback)")
        logger.info(f"✅ [NODE] store_memory_node COMPLETED in {time.time()-start:.2f}s")
    except Exception as e:
        logger.error(f"❌ [NODE] store_memory_node FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
    return state


# -------------------------
# WORKFLOW
# -------------------------
def build_workflow():
    logger.info("🔧 Building workflow graph...")
    
    graph = StateGraph(MentatState)
    logger.debug("   └─ StateGraph created")

    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("parallel_learning_difficulty", parallel_learning_difficulty_node)
    graph.add_node("weekly_report", weekly_report_node)
    graph.add_node("decide_memory", memory_decision_node)
    graph.add_node("store_memory", store_memory_node)
    
    logger.debug("   └─ All nodes added")

    graph.set_entry_point("retrieve_memory")
    logger.debug("   └─ Entry point set")

    graph.add_edge("retrieve_memory", "build_context")
    graph.add_edge("build_context", "feedback")
    graph.add_edge("feedback", "parallel_learning_difficulty")
    graph.add_edge("feedback", "parallel_learning_difficulty")
    graph.add_edge("parallel_learning_difficulty", "weekly_report")
    graph.add_edge("weekly_report", "decide_memory")


    graph.add_edge("decide_memory", "store_memory")
    graph.add_edge("store_memory", END)
    logger.debug("   └─ All edges added")

    compiled = graph.compile()
    logger.info("✅ Workflow graph compiled successfully")
    return compiled

logger.info("🔧 Compiling workflow at module load...")
workflow = build_workflow()
logger.info("✅ Workflow module loaded")