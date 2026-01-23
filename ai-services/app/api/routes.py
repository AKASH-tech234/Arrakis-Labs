from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import time
import logging
import traceback
import uuid

from app.schemas.submission import SubmissionContext
from app.schemas.feedback import FeedbackResponse

from app.graph.sync_workflow import sync_workflow
from app.graph.async_workflow import async_workflow

# -------------------------
# Logging - Structured
# -------------------------
logger = logging.getLogger("routes")

def log_event(event: str, **kwargs):
    """Structured log helper"""
    log_data = {"event": event, "service": "ai-routes", **kwargs}
    logger.info(str(log_data))

log_event("module_loaded", module="routes")

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════
# IMPORTANT: This timeout MUST match SYNC_TOTAL_BUDGET_SECONDS in sync_workflow.py
# The workflow needs 60s for quality-first agent completions (no skipping)
MAX_REQUEST_SECONDS = 65  # 60s workflow + 5s buffer for I/O
log_event("config_loaded", max_request_seconds=MAX_REQUEST_SECONDS)

# -------------------------
# Response DTOs - Clean Frontend-Ready Responses
# -------------------------
class HintLevel(BaseModel):
    """Single hint with level indicator"""
    level: int
    content: str
    hint_type: str  # "conceptual", "specific", "approach", "solution"

class AIFeedbackDTO(BaseModel):
    """Clean, structured response for frontend consumption"""
    success: bool
    verdict: str
    submission_id: str
    
    # Progressive hints (ordered from vague to specific)
    hints: List[HintLevel]
    
    # Full explanation (hidden by default)
    explanation: Optional[str] = None
    
    # Pattern detection
    detected_pattern: Optional[str] = None
    
    # For accepted submissions
    optimization_tips: Optional[List[str]] = None
    complexity_analysis: Optional[str] = None
    edge_cases: Optional[List[str]] = None
    
    # Metadata
    feedback_type: str  # "error_feedback", "success_feedback", "optimization"
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "verdict": "wrong_answer",
                "submission_id": "sub_abc123",
                "hints": [
                    {"level": 1, "content": "Think about edge cases...", "hint_type": "conceptual"},
                    {"level": 2, "content": "Consider when the array is empty", "hint_type": "specific"}
                ],
                "explanation": "Your solution fails when...",
                "feedback_type": "error_feedback"
            }
        }

# -------------------------
# Router
# -------------------------
router = APIRouter()
log_event("router_created")

# -------------------------
# Health Check
# -------------------------
@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Mentat Trials AI Service",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": "1.0.0"
    }
#rag status
@router.get("/ai/rag-stats/{user_id}")
def get_rag_stats(user_id: str):
    """Get RAG usage statistics for debugging"""
    
    from app.rag.monitoring import rag_monitor
    from app.rag.retriever import retrieve_user_memory
    
    # Get stored statistics
    stats = rag_monitor.get_user_stats(user_id)
    
    # Test retrieval
    test_results = retrieve_user_memory(
        user_id=user_id,
        query="array problem mistake",
        k=5
    )
    
    return {
        "user_id": user_id,
        "stats": stats,
        "test_retrieval": {
            "query": "array problem mistake",
            "results_count": len(test_results),
            "sample_content": test_results[0][:200] if test_results else None
        }
    }
# -------------------------
# Helper: Build Progressive Hints
# -------------------------
def build_progressive_hints(
    verdict: str,
    feedback: Optional[FeedbackResponse],
    hint: Optional[str],
    detected_pattern: Optional[str]
) -> List[HintLevel]:
    """
    Build progressive hint structure based on verdict and feedback.
    
    For WRONG answers: conceptual → specific → approach → solution
    For ACCEPTED: optimization → complexity → edge cases
    For TLE: complexity → optimization → specific fix
    """
    hints = []
    
    if verdict == "accepted":
        # Accepted: Show optimization hints progressively
        if feedback and feedback.explanation:
            hints.append(HintLevel(
                level=1,
                content="Great job! Your solution is correct. Want to see how to optimize?",
                hint_type="conceptual"
            ))
        if feedback and feedback.improvement_hint:
            hints.append(HintLevel(
                level=2,
                content=feedback.improvement_hint,
                hint_type="optimization"
            ))
        if detected_pattern:
            hints.append(HintLevel(
                level=3,
                content=f"This problem uses the {detected_pattern} pattern. Understanding this will help you solve similar problems faster.",
                hint_type="pattern"
            ))
    
    elif verdict in ["time_limit_exceeded", "tle"]:
        # TLE: Focus on complexity and optimization
        hints.append(HintLevel(
            level=1,
            content="Your solution is too slow. Think about the time complexity of your approach.",
            hint_type="conceptual"
        ))
        if feedback and feedback.improvement_hint:
            hints.append(HintLevel(
                level=2,
                content=feedback.improvement_hint,
                hint_type="specific"
            ))
        if hint:
            hints.append(HintLevel(
                level=3,
                content=hint,
                hint_type="approach"
            ))
        if detected_pattern:
            hints.append(HintLevel(
                level=4,
                content=f"Consider using the {detected_pattern} pattern for better performance.",
                hint_type="pattern"
            ))
    
    else:
        # Wrong answer / runtime error: Progressive hints
        if feedback and feedback.explanation:
            # Extract first conceptual hint
            explanation_lines = feedback.explanation.split(". ")
            if explanation_lines:
                hints.append(HintLevel(
                    level=1,
                    content=explanation_lines[0] + ".",
                    hint_type="conceptual"
                ))
        
        if feedback and feedback.improvement_hint:
            hints.append(HintLevel(
                level=2,
                content=feedback.improvement_hint,
                hint_type="specific"
            ))
        
        if hint:
            hints.append(HintLevel(
                level=3,
                content=hint,
                hint_type="approach"
            ))
        
        if detected_pattern:
            hints.append(HintLevel(
                level=4,
                content=f"Pattern hint: This problem typically uses {detected_pattern}.",
                hint_type="pattern"
            ))
        
        # Final full explanation as last hint
        if feedback and feedback.explanation and len(hints) > 0:
            hints.append(HintLevel(
                level=len(hints) + 1,
                content=feedback.explanation,
                hint_type="solution"
            ))
    
    # Ensure at least one hint
    if not hints:
        hints.append(HintLevel(
            level=1,
            content="Review your approach and consider edge cases.",
            hint_type="conceptual"
        ))
    
    return hints

# -------------------------
# AI Feedback Endpoint (UNIFIED - ALL VERDICTS)
# -------------------------
@router.post("/ai/feedback", response_model=AIFeedbackDTO)
def generate_ai_feedback(
    payload: SubmissionContext,
    background_tasks: BackgroundTasks,
) -> AIFeedbackDTO:
    """
    UNIFIED AI Feedback endpoint - called for ALL submission verdicts.
    
    Verdicts handled:
    - accepted: optimization hints, complexity analysis, edge cases
    - wrong_answer: progressive hints → approach → fix
    - time_limit_exceeded: complexity analysis → optimization hints
    - runtime_error: error analysis → fix suggestions
    - compile_error: syntax fix suggestions
    
    SYNC agents (user-facing):
    - feedback
    - pattern detection  
    - hint
    
    ASYNC agents (background):
    - learning
    - difficulty
    - memory storage
    """
    start_time = time.time()
    submission_id = f"sub_{uuid.uuid4().hex[:12]}"
    
    print(f"\n{'='*80}")
    print(f"🎯 NEW FEEDBACK REQUEST")
    print(f"{'='*80}")
    print(f"📋 Submission ID: {submission_id}")
    print(f"👤 User ID: {payload.user_id}")
    print(f"🎲 Problem ID: {payload.problem_id}")
    print(f"📊 Verdict: {payload.verdict}")
    print(f"💻 Language: {payload.language}")
    print(f"🏷️  Category: {payload.problem_category}")
    print(f"{'='*80}\n")
    
    log_event("feedback_request_received",
        submission_id=submission_id,
        user_id=payload.user_id,
        problem_id=payload.problem_id,
        verdict=payload.verdict,
        language=payload.language
    )

    try:
        # -------------------------
        # Build initial state
        # -------------------------
        state: Dict[str, Any] = payload.model_dump()
        state["submission_id"] = submission_id
        
        print(f"🔄 Starting SYNC workflow...")
        log_event("workflow_starting",
            submission_id=submission_id,
            workflow="sync"
        )

        # -------------------------
        # SYNC WORKFLOW (user-facing)
        # -------------------------
        sync_result = sync_workflow.invoke(state)

        elapsed = time.time() - start_time
        if elapsed > MAX_REQUEST_SECONDS:
            log_event("workflow_timeout",
                submission_id=submission_id,
                elapsed_seconds=elapsed
            )
            raise TimeoutError("Sync AI workflow exceeded time budget")

        feedback: Optional[FeedbackResponse] = sync_result.get("feedback")
        detected_pattern: Optional[str] = sync_result.get("detected_pattern")
        hint: Optional[str] = sync_result.get("hint")
        
        print(f"\n✅ SYNC workflow completed in {elapsed:.2f}s")
        print(f"   └─ Feedback: {'✓' if feedback else '✗'}")
        print(f"   └─ Pattern: {'✓' if detected_pattern else '✗'}")
        print(f"   └─ Hint: {'✓' if hint else '✗'}")
        
        log_event("sync_workflow_completed",
            submission_id=submission_id,
            has_feedback=feedback is not None,
            has_pattern=detected_pattern is not None,
            has_hint=hint is not None,
            elapsed_seconds=round(elapsed, 2)
        )

        # -------------------------
        # ASYNC WORKFLOW (background)
        # -------------------------
        print(f"\n🚀 Scheduling ASYNC workflow (background)...")
        log_event("async_workflow_scheduling", submission_id=submission_id)
        background_tasks.add_task(async_workflow.invoke, sync_result)

        # -------------------------
        # Build Progressive Response
        # -------------------------
        hints = build_progressive_hints(
            verdict=payload.verdict,
            feedback=feedback,
            hint=hint,
            detected_pattern=detected_pattern
        )
        
        # Determine feedback type (case-insensitive verdict check)
        verdict_lower = payload.verdict.lower() if payload.verdict else ""
        if verdict_lower == "accepted":
            feedback_type = "success_feedback"
        elif verdict_lower in ["time_limit_exceeded", "tle"]:
            feedback_type = "optimization"
        else:
            feedback_type = "error_feedback"
        
        # Build response DTO
        response = AIFeedbackDTO(
            success=True,
            verdict=payload.verdict,
            submission_id=submission_id,
            hints=hints,
            explanation=feedback.explanation if feedback else None,
            detected_pattern=detected_pattern,
            optimization_tips=None,  # Populated for accepted
            complexity_analysis=None,
            edge_cases=None,
            feedback_type=feedback_type
        )
        
        # Add optimization tips for accepted submissions
        if verdict_lower == "accepted" and feedback:
            response.optimization_tips = [feedback.improvement_hint] if feedback.improvement_hint else []
        
        print(f"\n📤 Sending response:")
        print(f"   └─ Success: {response.success}")
        print(f"   └─ Feedback Type: {feedback_type}")
        print(f"   └─ Hints Count: {len(response.hints)}")
        print(f"   └─ Total Time: {elapsed:.2f}s")
        print(f"{'='*80}\n")
        
        log_event("response_sent",
            submission_id=submission_id,
            verdict=payload.verdict,
            hint_count=len(hints),
            total_time_seconds=round(time.time() - start_time, 2)
        )
        
        return response

    except TimeoutError:
        log_event("request_timeout", submission_id=submission_id)
        raise HTTPException(
            status_code=504,
            detail={
                "error": "AI processing timed out",
                "submission_id": submission_id,
                "retry": True
            }
        )

    except Exception as e:
        log_event("request_failed",
            submission_id=submission_id,
            error_type=type(e).__name__,
            error_message=str(e)
        )
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={
                "error": "AI feedback generation failed",
                "message": str(e),
                "submission_id": submission_id
            }
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
