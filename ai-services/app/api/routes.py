from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.graph.workflow import build_workflow
from app.schemas.submission import SubmissionContext
from app.schemas.feedback import FeedbackResponse
from app.schemas.learning import LearningRecommendation
from app.schemas.difficulty import DifficultyAdjustment
from app.schemas.report import WeeklyProgressReport

# Initialize router
router = APIRouter()

# Build LangGraph workflow once at startup
workflow = build_workflow()


@router.post("/ai/feedback")
def generate_ai_feedback(payload: SubmissionContext) -> Dict[str, Any]:
    """
    Generates AI feedback, learning recommendations, difficulty adjustment,
    and a weekly progress report for a code submission.
    """

    try:
        # Convert Pydantic model to dict for LangGraph
        state: Dict[str, Any] = payload.model_dump()

        # Invoke agentic workflow
        result = workflow.invoke(state)

        feedback: FeedbackResponse | None = result.get("feedback")
        learning: LearningRecommendation | None = result.get("learning_recommendation")
        difficulty: DifficultyAdjustment | None = result.get("difficulty_adjustment")
        report: WeeklyProgressReport | None = result.get("weekly_report")

        if feedback is None:
            raise ValueError("AI feedback was not generated")

        return {
            "explanation": feedback.explanation,
            "improvement_hint": feedback.improvement_hint,
            "detected_pattern": feedback.detected_pattern,

            "learning_recommendation": (
                {
                    "focus_areas": learning.focus_areas,
                    "rationale": learning.rationale,
                }
                if learning is not None
                else None
            ),

            "difficulty_adjustment": (
                {
                    "action": difficulty.action,
                    "rationale": difficulty.rationale,
                }
                if difficulty is not None
                else None
            ),

            "weekly_report": (
                {
                    "summary": report.summary,
                    "strengths": report.strengths,
                    "improvement_areas": report.improvement_areas,
                    "recurring_patterns": report.recurring_patterns,
                }
                if report is not None
                else None
            ),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI feedback generation failed: {str(e)}"
        )
