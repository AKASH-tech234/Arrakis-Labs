from typing import TypedDict, Optional, List, Dict, cast
from concurrent.futures import ThreadPoolExecutor
import logging

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.learning import LearningRecommendation
from app.schemas.difficulty import DifficultyAdjustment
from app.schemas.report import WeeklyProgressReport
from app.schemas.submission import SubmissionContext
from app.schemas.pattern import PatternDetection
from app.schemas.hint import HintResponse

from app.rag.retriever import retrieve_user_memory, store_user_feedback
from app.rag.context_builder import build_context

from app.agents.feedback_agent import feedback_agent
from app.agents.learning_agent import learning_agent
from app.agents.difficulty_agent import difficulty_agent
from app.agents.report_agent import report_agent
from app.agents.pattern_detection_agent import pattern_detection_agent
from app.agents.hint_agent import hint_agent

logger = logging.getLogger("workflow")

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

    plan: Dict[str, bool]

    user_memory: List[str]
    context: str

    feedback: Optional[FeedbackResponse]
    detected_pattern: Optional[PatternDetection]
    hint: Optional[HintResponse]
    learning_recommendation: Optional[LearningRecommendation]
    difficulty_adjustment: Optional[DifficultyAdjustment]
    weekly_report: Optional[WeeklyProgressReport]

# -------------------------
# ORCHESTRATOR
# -------------------------
def orchestrator_node(state: Dict) -> Dict:
    verdict = state.get("verdict")
    user_requested_report = state.get("request_weekly_report", False)

    is_wrong = verdict != "Accepted"

    state["plan"] = {
        "run_feedback": True,
        "run_pattern": is_wrong,
        "run_hint": True,                 # hint even for accepted
        "run_learning": is_wrong,
        "run_difficulty": is_wrong,
        "run_weekly_report": user_requested_report,
        "store_memory": True,             # ALWAYS store
    }

    logger.info(f"🧠 Execution plan: {state['plan']}")
    return state

# -------------------------
# NODES
# -------------------------
def retrieve_memory_node(state: MentatState) -> MentatState:
    try:
        state["user_memory"] = retrieve_user_memory(
            user_id=state["user_id"],
            query=f"{state['problem_category']} {state.get('error_type', '')}",
            k=3,
        )
    except Exception:
        state["user_memory"] = []
    return state


def build_context_node(state: MentatState) -> MentatState:
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

    state["context"] = build_context(submission, state["user_memory"])[:3500]
    return state


def feedback_node(state: MentatState) -> MentatState:
    if not state["plan"]["run_feedback"]:
        return state

    state["feedback"] = feedback_agent(
        context=state["context"],
        payload=state,
    )
    return state


def pattern_node(state: MentatState) -> MentatState:
    if not state["plan"]["run_pattern"]:
        return state

    state["detected_pattern"] = pattern_detection_agent(
        context=state["context"],
        payload=state,
    )
    return state


def hint_node(state: MentatState) -> MentatState:
    if not state["plan"]["run_hint"]:
        return state

    state["hint"] = hint_agent(
        context=state["context"],
        payload=state,
    )
    return state


def parallel_learning_difficulty_node(state: MentatState) -> MentatState:
    if not (state["plan"]["run_learning"] or state["plan"]["run_difficulty"]):
        return state

    with ThreadPoolExecutor(max_workers=2) as executor:
        if state["plan"]["run_learning"]:
            lf = executor.submit(learning_agent, state["context"], state)
            state["learning_recommendation"] = lf.result()

        if state["plan"]["run_difficulty"]:
            df = executor.submit(difficulty_agent, state["context"], state)
            state["difficulty_adjustment"] = df.result()

    return state


def weekly_report_node(state: MentatState) -> MentatState:
    if not state["plan"]["run_weekly_report"]:
        return state

    try:
        state["weekly_report"] = report_agent(
            context=state["context"],
            payload=state,
        )
    except Exception:
        state["weekly_report"] = None
    return state


def store_memory_node(state: MentatState) -> MentatState:
    if state.get("feedback"):
        feedback = cast(FeedbackResponse, state["feedback"])
        try:
            store_user_feedback(
                user_id=state["user_id"],
                problem_id=state["problem_id"],
                category=state["problem_category"],
                mistake_summary=feedback.improvement_hint,
            )
        except Exception:
            pass
    return state

# -------------------------
# WORKFLOW
# -------------------------
def build_workflow():
    graph = StateGraph(MentatState)

    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("pattern", pattern_node)
    graph.add_node("hint", hint_node)
    graph.add_node("parallel_learning_difficulty", parallel_learning_difficulty_node)
    graph.add_node("weekly_report", weekly_report_node)
    graph.add_node("store_memory", store_memory_node)

    graph.set_entry_point("retrieve_memory")

    graph.add_edge("retrieve_memory", "orchestrator")
    graph.add_edge("orchestrator", "build_context")
    graph.add_edge("build_context", "feedback")
    graph.add_edge("feedback", "pattern")
    graph.add_edge("pattern", "hint")
    graph.add_edge("hint", "parallel_learning_difficulty")
    graph.add_edge("parallel_learning_difficulty", "weekly_report")
    graph.add_edge("weekly_report", "store_memory")
    graph.add_edge("store_memory", END)

    return graph.compile()


workflow = build_workflow()
