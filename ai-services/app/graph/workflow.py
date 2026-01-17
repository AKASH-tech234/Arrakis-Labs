from typing import TypedDict, List, Optional
from fastapi import FastAPI
from app.schemas.learning import LearningRecommendation
from asyncio import graph
from app.schemas.difficulty import DifficultyAdjustment
from app.schemas.report import WeeklyProgressReport

app=FastAPI()
from app.schemas.feedback import FeedbackResponse

class MentatState(TypedDict):
    # Input
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: Optional[str]

    # RAG
    user_memory: List[str]

    # Reasoning outputs
    feedback: Optional[FeedbackResponse]
    mistake_summary: Optional[str]
    #learnig
    learning_recommendation: LearningRecommendation | None
    difficulty_adjustment: DifficultyAdjustment | None
    weekly_report: WeeklyProgressReport | None

    # Control flags
    should_store_memory: bool

from app.rag.retriever import retrieve_user_memory


def retrieve_memory_node(state: MentatState) -> MentatState:
    query = f"{state['problem_category']} {state.get('error_type', '')}"

    memory = retrieve_user_memory(
        user_id=state["user_id"],
        query=query,
        k=3
    )

    state["user_memory"] = memory
    return state


from app.rag.context_builder import build_context
from app.schemas.submission import SubmissionContext


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

    context = build_context(
        submission=submission,
        user_memory=state["user_memory"]
    )

    state["context"] = context
    return state

from app.agents.feedback_agent import feedback_agent


def feedback_node(state: MentatState) -> MentatState:
    feedback = feedback_agent(state["context"])
    state["feedback"] = feedback
    state["mistake_summary"] = feedback.improvement_hint

    return state
from app.agents.learning_agent import learning_agent


def learning_node(state: MentatState) -> MentatState:
    recommendation = learning_agent(state["context"])
    state["learning_recommendation"] = recommendation
    return state

from app.agents.difficulty_agent import difficulty_agent


def difficulty_node(state: MentatState) -> MentatState:
    adjustment = difficulty_agent(state["context"])
    state["difficulty_adjustment"] = adjustment
    return state

def memory_decision_node(state: MentatState) -> MentatState:
    if state["verdict"] != "Accepted":
        state["should_store_memory"] = True
        state["mistake_summary"] = state["feedback"].explanation[:200]
    else:
        state["should_store_memory"] = False

    return state

from app.agents.report_agent import report_agent


def weekly_report_node(state: MentatState) -> MentatState:
    report = report_agent(state["context"])
    state["weekly_report"] = report
    return state


from app.rag.retriever import store_user_feedback



def store_memory_node(state: MentatState) -> MentatState:
    if state["should_store_memory"]:
        store_user_feedback(
            user_id=state["user_id"],
            problem_id=state["problem_id"],
            category=state["problem_category"],
            mistake_summary=state["mistake_summary"]
        )
    return state


from langraph.graph import StateGraph, END


def build_workflow():
    graph = StateGraph(MentatState)

    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("decide_memory", memory_decision_node)
    graph.add_node("store_memory", store_memory_node)
    graph.add_node("learning", learning_node)
    graph.add_node("difficulty", difficulty_node)
    graph.add_node("weekly_report", weekly_report_node)


    graph.set_entry_point("retrieve_memory")

    graph.add_edge("retrieve_memory", "build_context")
    graph.add_edge("build_context", "feedback")
    graph.add_edge("feedback", "decide_memory")
    graph.add_edge("feedback", "learning")
    graph.add_edge("learning", "difficulty")    
    graph.add_edge("difficulty", "weekly_report")
    graph.add_edge("weekly_report", "decide_memory")
    graph.add_edge("decide_memory", "store_memory")
    graph.add_edge("store_memory", END)

    return graph.compile()

workflow = build_workflow()






@app.post("/ai/feedback")
def ai_feedback(payload: dict):
    result = workflow.invoke(payload)
    return {
        "feedback": result["feedback"]
    }
