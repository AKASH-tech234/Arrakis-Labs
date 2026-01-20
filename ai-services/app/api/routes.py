from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any
import time
import logging
import traceback

from app.schemas.submission import SubmissionContext
from app.schemas.feedback import FeedbackResponse

from app.graph.sync_workflow import sync_workflow
from app.graph.async_workflow import async_workflow

# -------------------------
# Logging
# -------------------------
logger = logging.getLogger("routes")
logger.info("📦 Routes module loading...")

# -------------------------
# Configuration
# -------------------------
MAX_REQUEST_SECONDS = 30  # sync workflow should be fast
logger.info(f"⏱️  Max request timeout: {MAX_REQUEST_SECONDS}s")

# -------------------------
# Router
# -------------------------
router = APIRouter()
logger.info("✅ APIRouter created")

# -------------------------
# Health Check
# -------------------------
@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Mentat Trials AI Service",
    }

# -------------------------
# AI Feedback Endpoint (SYNC + ASYNC)
# -------------------------
@router.post("/ai/feedback")
def generate_ai_feedback(
    payload: SubmissionContext,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    SYNC:
    - feedback
    - pattern detection
    - hint

    ASYNC (background):
    - learning
    - difficulty
    - weekly report (conditional)
    - memory storage
    """
    start_time = time.time()

    try:
        logger.info("🎯 NEW AI FEEDBACK REQUEST")
        logger.info(f"📥 User ID: {payload.user_id}")
        logger.info(f"📥 Problem ID: {payload.problem_id}")
        logger.info(f"📥 Verdict: {payload.verdict}")

        # -------------------------
        # Build initial state
        # -------------------------
        state: Dict[str, Any] = payload.model_dump()

        # -------------------------
        # SYNC WORKFLOW (user-facing)
        # -------------------------
        logger.info("🚀 Running SYNC workflow...")
        sync_result = sync_workflow.invoke(state)

        elapsed = time.time() - start_time
        if elapsed > MAX_REQUEST_SECONDS:
            raise TimeoutError("Sync AI workflow exceeded time budget")

        feedback: FeedbackResponse | None = sync_result.get("feedback")
        if feedback is None:
            raise ValueError("Feedback agent failed to produce output")

        # -------------------------
        # ASYNC WORKFLOW (background)
        # -------------------------
        logger.info("🧵 Scheduling ASYNC workflow...")
        background_tasks.add_task(
            async_workflow.invoke,
            sync_result,
        )

        # -------------------------
        # RESPONSE (FAST)
        # -------------------------
        response = {
            "explanation": feedback.explanation,
            "improvement_hint": feedback.improvement_hint,
            "detected_pattern": sync_result.get("detected_pattern"),
            "hint": sync_result.get("hint"),
        }

        logger.info(
            f"🎉 SUCCESS: Sync response in {time.time() - start_time:.2f}s"
        )
        return response

    except TimeoutError:
        logger.error("❌ TIMEOUT ERROR")
        raise HTTPException(
            status_code=504,
            detail="AI processing timed out. Please retry.",
        )

    except Exception as e:
        logger.error("❌ AI FEEDBACK ENDPOINT FAILURE")
        logger.error(f"Type: {type(e).__name__}")
        logger.error(f"Message: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"AI feedback generation failed: {str(e)}",
        )
# -------------------------
# Weekly Report Endpoint (ON-DEMAND)
# -------------------------
@router.post("/ai/weekly-report")
def generate_weekly_report(payload: SubmissionContext) -> Dict[str, Any]:
    """
    ON-DEMAND weekly report generation.

    Runs ONLY:
    - memory retrieval
    - context building
    - weekly report agent

    No sync workflow.
    No feedback.
    No learning.
    """
    start_time = time.time()

    try:
        logger.info("📊 NEW WEEKLY REPORT REQUEST")
        logger.info(f"📥 User ID: {payload.user_id}")

        # -------------------------
        # Build initial state
        # -------------------------
        state: Dict[str, Any] = payload.model_dump()

        # -------------------------
        # Retrieve memory
        # -------------------------
        from app.rag.retriever import retrieve_user_memory
        from app.rag.context_builder import build_context
        from app.agents.report_agent import report_agent

        user_memory = retrieve_user_memory(
            user_id=payload.user_id,
            query="weekly progress recurring mistakes",
            k=10,
        )

        # -------------------------
        # Build context
        # -------------------------
        context = build_context(
            submission=payload,
            user_memory=user_memory,
        )[:3500]

        # -------------------------
        # Run weekly report agent
        # -------------------------
        report = report_agent(
            context=context,
            payload=state,
        )

        if report is None:
            raise ValueError("Weekly report agent returned no output")

        logger.info(
            f"✅ Weekly report generated in {time.time() - start_time:.2f}s"
        )

        return {
            "summary": report.summary,
            "strengths": report.strengths,
            "improvement_areas": report.improvement_areas,
            "recurring_patterns": report.recurring_patterns,
        }

    except Exception as e:
        logger.error("❌ WEEKLY REPORT FAILURE")
        logger.error(f"Type: {type(e).__name__}")
        logger.error(f"Message: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Weekly report generation failed: {str(e)}",
        )
