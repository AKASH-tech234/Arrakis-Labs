from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import time
import logging
import traceback
from typing import cast
from app.graph.workflow import MentatState

from app.graph.workflow import build_workflow
from app.schemas.submission import SubmissionContext
from app.schemas.feedback import FeedbackResponse
from app.schemas.learning import LearningRecommendation
from app.schemas.difficulty import DifficultyAdjustment
from app.schemas.report import WeeklyProgressReport

# -------------------------
# Logging
# -------------------------
logger = logging.getLogger("routes")
logger.info("📦 Routes module loading...")

# -------------------------
# Configuration
# -------------------------
MAX_REQUEST_SECONDS = 300 # hard time budget for local LLMs
logger.info(f"⏱️  Max request timeout: {MAX_REQUEST_SECONDS}s")

# -------------------------
# Router & Workflow
# -------------------------
router = APIRouter()
logger.info("✅ APIRouter created")

# Build LangGraph workflow once at startup
logger.info("🔧 Building LangGraph workflow...")
workflow = build_workflow()
logger.info("✅ LangGraph workflow compiled successfully")

# -------------------------
# Health Check
# -------------------------
@router.get("/health")
def health_check():
    logger.debug("💓 Health check requested")
    return {
        "status": "ok",
        "service": "Mentat Trials AI Service"
    }

# -------------------------
# AI Feedback Endpoint
# -------------------------
@router.post("/ai/feedback")
def generate_ai_feedback(payload: SubmissionContext) -> Dict[str, Any]:
    """
    Entry point for all AI reasoning.

    - Accepts validated submission context
    - Runs full LangGraph agentic workflow
    - Enforces request-level timeout
    - Returns graceful partial results if needed
    """
    logger.info("="*60)
    logger.info("🎯 NEW AI FEEDBACK REQUEST")
    logger.info("="*60)
    
    start_time = time.time()

    try:
        # Log incoming payload
        logger.info(f"📥 User ID: {payload.user_id}")
        logger.info(f"📥 Problem ID: {payload.problem_id}")
        logger.info(f"📥 Category: {payload.problem_category}")
        logger.info(f"📥 Verdict: {payload.verdict}")
        logger.info(f"📥 Error Type: {payload.error_type}")
        logger.info(f"📥 Language: {payload.language}")
        logger.info(f"📥 Code length: {len(payload.code)} chars")
        
        # Convert Pydantic model to dict for LangGraph
        logger.debug("🔄 Converting payload to dict...")
        state: Dict[str, Any] = payload.model_dump()
        logger.debug("✅ Payload converted to dict")

        # Invoke agentic workflow
        logger.info("🚀 Invoking LangGraph workflow...")
        result = workflow.invoke(cast(MentatState, payload.model_dump()))
        logger.info("✅ Workflow completed successfully")


        # Enforce hard timeout
        elapsed = time.time() - start_time
        logger.info(f"⏱️  Workflow elapsed time: {elapsed:.2f}s")
        
        if elapsed > MAX_REQUEST_SECONDS:
            logger.error(f"❌ TIMEOUT: Workflow took {elapsed:.2f}s (max: {MAX_REQUEST_SECONDS}s)")
            raise TimeoutError("AI workflow exceeded time budget")

        # Extract agent outputs
        logger.debug("📤 Extracting agent outputs...")
        feedback: FeedbackResponse | None = result.get("feedback")
        learning: LearningRecommendation | None = result.get("learning_recommendation")
        difficulty: DifficultyAdjustment | None = result.get("difficulty_adjustment")
        report: WeeklyProgressReport | None = result.get("weekly_report")
        
        logger.info(f"📤 Feedback: {'✅ Present' if feedback else '❌ Missing'}")
        logger.info(f"📤 Learning: {'✅ Present' if learning else '⚠️ None'}")
        logger.info(f"📤 Difficulty: {'✅ Present' if difficulty else '⚠️ None'}")
        logger.info(f"📤 Report: {'✅ Present' if report else '⚠️ None'}")

        if feedback is None:
            logger.error("❌ CRITICAL: Feedback is None - workflow failed to generate feedback")
            raise ValueError("AI feedback was not generated")

        # Construct stable response
        logger.debug("📦 Constructing response object...")
        response = {
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

            # Weekly report is optional and best-effort
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
        
        total_time = time.time() - start_time
        logger.info(f"🎉 SUCCESS: Request completed in {total_time:.2f}s")
        logger.info("="*60)
        return response

    except TimeoutError:
        # Correct semantic for slow local inference
        logger.error("❌ TIMEOUT ERROR: AI processing timed out")
        logger.error(f"⏱️  Elapsed: {time.time() - start_time:.2f}s")
        raise HTTPException(
            status_code=504,
            detail="AI processing timed out. Please retry."
        )

    except Exception as e:
        # True internal failure
        logger.error("="*60)
        logger.error("❌ EXCEPTION IN AI FEEDBACK ENDPOINT")
        logger.error(f"❌ Error Type: {type(e).__name__}")
        logger.error(f"❌ Error Message: {str(e)}")
        logger.error(f"❌ Traceback:\n{traceback.format_exc()}")
        logger.error("="*60)
        raise HTTPException(
            status_code=500,
            detail=f"AI feedback generation failed: {str(e)}"
        )
