from typing import TypedDict, Optional, List, Dict, Any, cast
import logging

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.submission import SubmissionContext
from app.schemas.user_profile import UserProfile

from app.rag.retriever import retrieve_user_memory
from app.rag.context_builder import build_context

from app.agents.feedback_agent import feedback_agent
from app.agents.pattern_detection_agent import pattern_detection_agent
from app.agents.hint_agent import hint_agent

from app.graph.orchestrator import orchestrator_node

from app.problem.problem_repository import get_problem_by_id, ProblemContext
from app.user_profile.profile_builder import build_user_profile

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

    # NEW: Structured problem context (fetched once, cached)
    problem: Optional[Dict[str, Any]]  # ProblemContext as dict
    
    # NEW: Structured user profile (derived from RAG, no extra LLM call)
    user_profile: Optional[Dict[str, Any]]  # UserProfile as dict

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


def retrieve_problem_node(state: MentatSyncState) -> MentatSyncState:
    """
    NEW NODE: Fetch problem context from repository (cached).
    Agents get structured problem data, not raw frontend payload.
    """
    try:
        problem_context = get_problem_by_id(
            problem_id=state["problem_id"],
            fallback_category=state.get("problem_category", ""),
            fallback_constraints=state.get("constraints", "")
        )
        state["problem"] = problem_context.model_dump()
        logger.info(f"Retrieved problem context: {problem_context.title or problem_context.problem_id}")
    except Exception as e:
        logger.error(f"Failed to retrieve problem context: {e}")
        # Fallback: use frontend data
        state["problem"] = {
            "problem_id": state["problem_id"],
            "title": None,
            "statement": None,
            "constraints": state.get("constraints", ""),
            "tags": [state.get("problem_category", "")],
            "difficulty": "Medium",
            "expected_approach": None,
            "common_mistakes": []
        }
    return state


def build_user_profile_node(state: MentatSyncState) -> MentatSyncState:
    """
    NEW NODE: Build structured user profile from RAG memory.
    NO EXTRA LLM CALL - uses pattern matching heuristics.
    """
    try:
        memory_text = "\n".join(state.get("user_memory", []))
        profile = build_user_profile(
            user_id=state["user_id"],
            memory_text=memory_text,
            last_verdict=state.get("verdict")
        )
        state["user_profile"] = profile.model_dump()
        logger.info(f"Built user profile: {len(profile.common_mistakes)} mistakes, {len(profile.weak_topics)} weak topics")
    except Exception as e:
        logger.error(f"Failed to build user profile: {e}")
        state["user_profile"] = {
            "user_id": state["user_id"],
            "common_mistakes": [],
            "weak_topics": [],
            "recurring_patterns": [],
            "recent_categories": [],
            "last_verdict": state.get("verdict")
        }
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

    # Pass structured problem and user_profile to context builder
    state["context"] = build_context(
        submission, 
        state["user_memory"],
        problem_context=state.get("problem"),
        user_profile=state.get("user_profile")
    )[:4000]  # Increased limit to accommodate structured context
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

    # Core nodes
    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("retrieve_problem", retrieve_problem_node)  # NEW
    graph.add_node("build_user_profile", build_user_profile_node)  # NEW
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("pattern_detection", pattern_detection_node)
    graph.add_node("hint", hint_node)

    graph.set_entry_point("retrieve_memory")

    # UPDATED FLOW:
    # retrieve_memory -> retrieve_problem -> build_user_profile -> orchestrator -> ...
    graph.add_edge("retrieve_memory", "retrieve_problem")
    graph.add_edge("retrieve_problem", "build_user_profile")
    graph.add_edge("build_user_profile", "orchestrator")
    graph.add_edge("orchestrator", "build_context")
    graph.add_edge("build_context", "feedback")
    graph.add_edge("feedback", "pattern_detection")
    graph.add_edge("pattern_detection", "hint")
    graph.add_edge("hint", END)

    return graph.compile()


sync_workflow = build_sync_workflow()
