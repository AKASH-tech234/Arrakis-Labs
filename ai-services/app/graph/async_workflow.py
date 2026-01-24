"""
ASYNC Workflow - Background Processing for Non-Blocking Operations
==================================================================

This workflow runs AFTER the sync response is sent to the user.
It handles expensive operations that don't need to block the response:

1. learning_agent - Generates personalized learning recommendations
2. difficulty_agent - Adjusts difficulty for adaptive learning
3. weekly_report - On-demand weekly progress reports
4. store_memory - Persists submission data to RAG vector store

CRITICAL: This workflow NEVER affects user-facing latency.
"""

from typing import TypedDict, Optional, Dict, List, Any
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import logging
import traceback
import time

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


# ═══════════════════════════════════════════════════════════════════════════════
# ASYNC TIME BUDGETS (generous - background processing)
# PHILOSOPHY: ALL agents MUST complete. No skipping.
# ═══════════════════════════════════════════════════════════════════════════════

ASYNC_AGENT_BUDGETS = {
    "learning_agent": 45.0,    # LLM call - MUST COMPLETE
    "difficulty_agent": 30.0,  # LLM call - MUST COMPLETE  
    "weekly_report": 45.0,     # LLM call - on demand
    "store_memory": 15.0,      # Vector store write - ALWAYS STORE
}

# Thread pool for parallel execution
_async_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="async_agent_")


# ═══════════════════════════════════════════════════════════════════════════════
# STATE
# ═══════════════════════════════════════════════════════════════════════════════

class AsyncState(TypedDict, total=False):
    """
    ASYNC Workflow State
    
    Inherits relevant data from SYNC workflow for continuity.
    """
    # === FROM SYNC WORKFLOW ===
    user_id: str
    problem_id: str
    problem_category: str
    verdict: str
    context: str
    feedback: Optional[FeedbackResponse]
    
    # === STRUCTURED DATA (passed from sync) ===
    problem: Optional[Dict[str, Any]]  # ProblemContext as dict
    user_profile: Optional[Dict[str, Any]]  # UserProfile as dict

    # === FLAGS ===
    request_weekly_report: bool
    
    # === ASYNC OUTPUTS ===
    learning_recommendation: Optional[LearningRecommendation]
    difficulty_adjustment: Optional[DifficultyAdjustment]
    weekly_report: Optional[WeeklyProgressReport]
    
    # === METADATA ===
    _async_start: Optional[float]
    _async_timings: Optional[Dict[str, float]]


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: TIMED ASYNC EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def _run_async_with_timeout(func, args, timeout_seconds: float, agent_name: str):
    """
    Execute async agent with timeout. Returns None on failure.
    """
    start = time.time()
    
    try:
        future = _async_executor.submit(func, *args)
        result = future.result(timeout=timeout_seconds)
        elapsed = time.time() - start
        logger.info(f"✅ [ASYNC] {agent_name} completed in {elapsed:.2f}s")
        return result
        
    except FuturesTimeoutError:
        elapsed = time.time() - start
        logger.warning(f"⏰ [ASYNC] {agent_name} TIMEOUT after {elapsed:.2f}s")
        return None
        
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"❌ [ASYNC] {agent_name} FAILED in {elapsed:.2f}s: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# ASYNC NODES (GUARDED WITH TIMEOUTS)
# ═══════════════════════════════════════════════════════════════════════════════

def _init_async_timing(state: AsyncState) -> AsyncState:
    """Initialize async timing metadata"""
    state["_async_start"] = time.time()
    state["_async_timings"] = {}
    return state


def learning_node(state: AsyncState) -> AsyncState:
    """
    ASYNC: Generate personalized learning recommendations.
    
    RESPECTS orchestrator plan - skips if run_learning is False.
    """
    _init_async_timing(state)
    
    # CHECK orchestrator plan - respect the decision
    plan = state.get("plan", {})
    if not plan.get("run_learning", True):
        logger.info("⏭️ [ASYNC] learning_agent SKIPPED by orchestrator plan")
        state["learning_recommendation"] = None
        state["_async_timings"]["learning_agent"] = 0.0
        return state
    
    verdict = state.get("verdict", "").lower()
    logger.info(f"🧠 [ASYNC] learning_agent starting | verdict={verdict}")
    
    # Build enriched context for learning recommendations
    context = state.get("context", "")
    
    # Add sync agent results for coordination
    feedback = state.get("feedback")
    if feedback:
        context += f"\n\n═══ SYNC WORKFLOW RESULTS (for learning coherence) ═══\n"
        context += f"FEEDBACK: {feedback.explanation}\n" if hasattr(feedback, 'explanation') else ""
        context += f"DETECTED PATTERN: {feedback.detected_pattern}\n" if hasattr(feedback, 'detected_pattern') and feedback.detected_pattern else ""
    
    # Even for accepted submissions, recommend optimization or next challenges
    if verdict == "accepted":
        context += "\nNOTE: Submission was ACCEPTED. Recommend advanced topics or optimization techniques.\n"
    
    start = time.time()
    
    try:
        result = _run_async_with_timeout(
            learning_agent,
            (context, state),
            timeout_seconds=ASYNC_AGENT_BUDGETS["learning_agent"],
            agent_name="learning_agent"
        )
        state["learning_recommendation"] = result
        
        if result:
            logger.info(f"✅ [ASYNC] learning_agent completed | focus_areas={result.focus_areas}")
        
    except Exception as e:
        logger.error(f"❌ [ASYNC] learning_agent failed: {e}")
        logger.error(traceback.format_exc())
        state["learning_recommendation"] = None
    
    elapsed = time.time() - start
    state["_async_timings"]["learning_agent"] = elapsed
    
    return state


def difficulty_node(state: AsyncState) -> AsyncState:
    """
    ASYNC: Adjust difficulty based on performance.
    
    RESPECTS orchestrator plan - skips if run_difficulty is False.
    """
    # CHECK orchestrator plan - respect the decision
    plan = state.get("plan", {})
    if not plan.get("run_difficulty", True):
        logger.info("⏭️ [ASYNC] difficulty_agent SKIPPED by orchestrator plan")
        state["difficulty_adjustment"] = None
        if "_async_timings" not in state:
            state["_async_timings"] = {}
        state["_async_timings"]["difficulty_agent"] = 0.0
        return state
    
    start = time.time()
    logger.info("📈 [ASYNC] difficulty_agent starting")
    
    # Build context enriched with learning recommendations for coherent decisions
    context = state.get("context", "")
    
    # Add learning agent results for coordination
    learning_rec = state.get("learning_recommendation")
    if learning_rec:
        context += f"\n\n═══ LEARNING AGENT RESULTS (for difficulty coherence) ═══\n"
        context += f"RECOMMENDED FOCUS AREAS: {learning_rec.focus_areas}\n"
        context += f"RATIONALE: {learning_rec.rationale}\n"
    
    try:
        result = _run_async_with_timeout(
            difficulty_agent,
            (context, state),
            timeout_seconds=ASYNC_AGENT_BUDGETS["difficulty_agent"],
            agent_name="difficulty_agent"
        )
        state["difficulty_adjustment"] = result
        
        if result:
            logger.info(f"✅ [ASYNC] difficulty_agent completed | action={result.action} | rationale={result.rationale[:50]}...")
        
    except Exception as e:
        logger.error(f"❌ [ASYNC] difficulty_agent failed: {e}")
        logger.error(traceback.format_exc())
        state["difficulty_adjustment"] = None
    
    elapsed = time.time() - start
    state["_async_timings"]["difficulty_agent"] = elapsed
    
    return state


def weekly_report_node(state: AsyncState) -> AsyncState:
    """
    ASYNC: Generate weekly progress report (ON-DEMAND ONLY).
    
    SKIP CONDITIONS:
    - request_weekly_report flag is False
    """
    if not state.get("request_weekly_report", False):
        logger.debug("⏭️ [ASYNC] weekly_report skipped - not requested")
        state["weekly_report"] = None
        return state
    
    start = time.time()
    logger.info("📊 [ASYNC] weekly_report_agent starting")
    
    try:
        context = state.get("context", "")
        
        result = _run_async_with_timeout(
            report_agent,
            (context, state),
            timeout_seconds=ASYNC_AGENT_BUDGETS["weekly_report"],
            agent_name="weekly_report"
        )
        state["weekly_report"] = result
        
    except Exception as e:
        logger.error(f"❌ [ASYNC] weekly_report_agent failed: {e}")
        logger.error(traceback.format_exc())
        state["weekly_report"] = None
    
    elapsed = time.time() - start
    state["_async_timings"]["weekly_report"] = elapsed
    
    return state


def store_memory_node(state: AsyncState) -> AsyncState:
    """
    ASYNC: Store submission feedback to RAG vector store.
    
    ALWAYS STORES - Every submission is valuable for learning history.
    Even accepted submissions are stored for tracking progress.
    """
    start = time.time()
    logger.info("💾 [ASYNC] storing submission to RAG memory (ALWAYS STORE)")
    
    # Build comprehensive memory entry
    verdict = state.get("verdict", "unknown")
    problem_id = state.get("problem_id", "unknown")
    category = state.get("problem_category", "General")
    
    # Get problem details if available (DEFENSIVE: handle None)
    problem = state.get("problem") or {}
    problem_title = problem.get("title", f"Problem {problem_id}") if isinstance(problem, dict) else f"Problem {problem_id}"
    problem_difficulty = problem.get("difficulty", "Medium") if isinstance(problem, dict) else "Medium"
    
    # Build memory summary from all available data
    memory_parts = []
    
    # Add verdict and problem info
    memory_parts.append(f"Verdict: {verdict} on {category} problem '{problem_title}' (Difficulty: {problem_difficulty})")
    
    # Add feedback if available
    feedback = state.get("feedback")
    if feedback:
        if hasattr(feedback, 'explanation') and feedback.explanation:
            memory_parts.append(f"Analysis: {feedback.explanation}")
        if hasattr(feedback, 'detected_pattern') and feedback.detected_pattern:
            memory_parts.append(f"Pattern: {feedback.detected_pattern}")
        if hasattr(feedback, 'improvement_hint') and feedback.improvement_hint:
            memory_parts.append(f"Hint: {feedback.improvement_hint}")
    
    # Add learning recommendation if available
    learning_rec = state.get("learning_recommendation")
    if learning_rec and hasattr(learning_rec, 'focus_areas'):
        memory_parts.append(f"Learning focus: {', '.join(learning_rec.focus_areas)}")
    
    # Add difficulty adjustment if available
    diff_adj = state.get("difficulty_adjustment")
    if diff_adj and hasattr(diff_adj, 'action'):
        memory_parts.append(f"Difficulty adjustment: {diff_adj.action}")
    
    mistake_summary = " | ".join(memory_parts)
    
    try:
        if mistake_summary:
            result = _run_async_with_timeout(
                store_user_feedback,
                (
                    state["user_id"],
                    state["problem_id"],
                    category,
                    mistake_summary
                ),
                timeout_seconds=ASYNC_AGENT_BUDGETS["store_memory"],
                agent_name="store_memory"
            )
            
            if result:
                logger.info(f"✅ [ASYNC] memory stored successfully | summary_length={len(mistake_summary)}")
            else:
                logger.warning("⚠️ [ASYNC] memory storage returned False")
        else:
            logger.warning("⚠️ [ASYNC] memory storage skipped - empty summary")
            
    except Exception as e:
        logger.error(f"❌ [ASYNC] memory storage failed: {e}")
        logger.error(traceback.format_exc())
    
    elapsed = time.time() - start
    state["_async_timings"]["store_memory"] = elapsed
    
    return state


def _async_timing_summary(state: AsyncState) -> AsyncState:
    """Final node: Log async workflow timing summary"""
    if state.get("_async_start"):
        total_elapsed = time.time() - state["_async_start"]
        timings = state.get("_async_timings", {})
        
        logger.info(f"📊 [ASYNC] Workflow completed | total={total_elapsed:.2f}s | timings={timings}")
        
        # Log individual results
        if state.get("learning_recommendation"):
            logger.info(f"   └─ learning: {state['learning_recommendation'].focus_areas}")
        if state.get("difficulty_adjustment"):
            logger.info(f"   └─ difficulty: {state['difficulty_adjustment'].action}")
    
    return state


# ═══════════════════════════════════════════════════════════════════════════════
# GRAPH
# ═══════════════════════════════════════════════════════════════════════════════

def build_async_workflow():
    """
    Build ASYNC workflow graph.
    
    FLOW (all nodes are guarded and can skip):
    learning → difficulty → weekly_report → store_memory → timing_summary → END
    
    This workflow runs in background and NEVER blocks user response.
    """
    graph = StateGraph(AsyncState)

    graph.add_node("learning", learning_node)
    graph.add_node("difficulty", difficulty_node)
    graph.add_node("weekly_report", weekly_report_node)
    graph.add_node("store_memory", store_memory_node)
    graph.add_node("timing_summary", _async_timing_summary)

    graph.set_entry_point("learning")

    # Sequential flow with skip guards
    graph.add_edge("learning", "difficulty")
    graph.add_edge("difficulty", "weekly_report")
    graph.add_edge("weekly_report", "store_memory")
    graph.add_edge("store_memory", "timing_summary")
    graph.add_edge("timing_summary", END)

    return graph.compile()


async_workflow = build_async_workflow()
