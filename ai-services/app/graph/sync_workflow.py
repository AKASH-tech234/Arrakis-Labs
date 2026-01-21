from typing import TypedDict, Optional, List, Dict, cast
import logging

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.submission import SubmissionContext

from app.rag.retriever import retrieve_user_memory
from app.rag.context_builder import build_context

from app.agents.feedback_agent import feedback_agent
from app.agents.pattern_detection_agent import pattern_detection_agent
from app.agents.hint_agent import hint_agent

from app.graph.orchestrator import orchestrator_node

logger = logging.getLogger("sync_workflow")


class MentatSyncState(TypedDict):
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: Optional[str]

    plan: Dict

    user_memory: List[str]
    context: str

    feedback: Optional[FeedbackResponse]
    detected_pattern: Optional[str]
    improvement_hint: Optional[str]


# -------------------------
# NODES
# -------------------------
def retrieve_memory_node(state: MentatSyncState) -> MentatSyncState:
    state["user_memory"] = retrieve_user_memory(
        user_id=state["user_id"],
        query=f"{state['problem_category']} {state.get('error_type', '')}",
        k=2,
    )
    return state


def build_context_node(state: MentatSyncState) -> MentatSyncState:
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

    state["context"] = build_context(submission, state["user_memory"])[:3000]
    return state


def feedback_node(state: MentatSyncState) -> MentatSyncState:
    if not state["plan"]["run_feedback"]:
        return state

    state["feedback"] = feedback_agent(
        context=state["context"],
        payload=state,
    )
    return state


def pattern_detection_node(state: MentatSyncState) -> MentatSyncState:
    if not state["plan"]["run_pattern_detection"]:
        return state

    state["detected_pattern"] = pattern_detection_agent(
        context=state["context"],
        payload=state,
    ).pattern
    return state


def hint_node(state: MentatSyncState) -> MentatSyncState:
    if not state["plan"]["run_hint"]:
        return state

    state["improvement_hint"] = hint_agent(
        raw_hint=state["context"],
        payload=state,
    ).hint
    return state


# -------------------------
# WORKFLOW
# -------------------------
def build_sync_workflow():
    graph = StateGraph(MentatSyncState)

    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("pattern_detection", pattern_detection_node)
    graph.add_node("hint", hint_node)

    graph.set_entry_point("retrieve_memory")

    graph.add_edge("retrieve_memory", "orchestrator")
    graph.add_edge("orchestrator", "build_context")
    graph.add_edge("build_context", "feedback")
    graph.add_edge("feedback", "pattern_detection")
    graph.add_edge("pattern_detection", "hint")
    graph.add_edge("hint", END)

    return graph.compile()


sync_workflow = build_sync_workflow()
