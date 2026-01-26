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

# ═══════════════════════════════════════════════════════════════════════════════
# GUARDRAILS - Idempotency & Verdict Protection
# ═══════════════════════════════════════════════════════════════════════════════
from app.guardrails.idempotency import (
    is_duplicate_request,
    mark_request_complete,
)
from app.guardrails.verdict_guards import (
    VerdictGuard,
    is_success_verdict,
    get_success_path,
    create_reinforcement_signal,
)

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

class MIMInsightsDTO(BaseModel):
    """MIM (Mistake Inference Model) predictions - Pure ML, NO LLM calls"""
    root_cause: Optional[Dict[str, Any]] = None  # failure_cause, confidence, alternatives
    readiness: Optional[Dict[str, Any]] = None   # current_level, easy/medium/hard readiness
    performance_forecast: Optional[Dict[str, Any]] = None  # predicted_outcome, confidence
    is_cold_start: bool = False
    model_version: Optional[str] = None

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
    
    # ✨ NEW: MIM Insights (Machine Learning predictions - NO LLM)
    mim_insights: Optional[MIMInsightsDTO] = None
    
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
                "feedback_type": "error_feedback",
                "mim_insights": {
                    "root_cause": {"failure_cause": "off_by_one_error", "confidence": 0.85},
                    "readiness": {"current_level": "Medium+", "medium_readiness": 0.63},
                    "is_cold_start": False
                }
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


@router.get("/health/llm")
def llm_health_check():
    """Check LLM provider rate limit status."""
    from app.services.llm import get_rate_limit_status, get_current_provider
    
    status = get_rate_limit_status()
    return {
        "provider": get_current_provider(),
        "groq": {
            "rate_limited": status["groq_limited"],
            "wait_seconds": round(status["groq_wait_seconds"], 1),
        },
        "gemini": {
            "rate_limited": status["gemini_limited"],
            "wait_seconds": round(status["gemini_wait_seconds"], 1),
        },
        "all_limited": status["groq_limited"] and status["gemini_limited"],
        "both_limited_count": status["both_limited_count"],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
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
    
    GUARDRAILS:
    - Idempotency: Duplicate requests return cached response
    - Verdict Guards: Accepted submissions skip MIM diagnosis
    """
    start_time = time.time()
    submission_id = f"sub_{uuid.uuid4().hex[:12]}"
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # GUARDRAIL 1: IDEMPOTENCY - Prevent duplicate request processing
    # ═══════════════════════════════════════════════════════════════════════════════
    is_dup, cached_response = is_duplicate_request(
        user_id=payload.user_id,
        problem_id=payload.problem_id,
        verdict=payload.verdict,
        code=payload.code or "",
    )
    
    if is_dup:
        if cached_response:
            print(f"🔄 DUPLICATE REQUEST - returning cached response")
            log_event("duplicate_request_cached",
                user_id=payload.user_id,
                problem_id=payload.problem_id,
                verdict=payload.verdict
            )
            # Convert cached dict to DTO
            return AIFeedbackDTO(**cached_response)
        else:
            # In-flight - return a "processing" response
            print(f"⏳ DUPLICATE REQUEST - still processing")
            log_event("duplicate_request_in_flight",
                user_id=payload.user_id,
                problem_id=payload.problem_id,
                verdict=payload.verdict
            )
            return AIFeedbackDTO(
                success=True,
                verdict=payload.verdict,
                submission_id=submission_id,
                hints=[HintLevel(level=1, content="Your submission is being analyzed...", hint_type="conceptual")],
                explanation="Processing your submission. Results will appear shortly.",
                detected_pattern=None,
                mim_insights=None,
                feedback_type="processing"
            )
    
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
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # GUARDRAIL 2: VERDICT GUARD - Check if this needs full pipeline
    # ═══════════════════════════════════════════════════════════════════════════════
    verdict_check = VerdictGuard.check(
        verdict=payload.verdict,
        difficulty=payload.problem.get("difficulty", "Medium") if payload.problem else "Medium",
        has_user_history=False,  # Will be determined by workflow
    )
    
    print(f"🛡️ VERDICT GUARD:")
    print(f"   └─ Skip MIM: {verdict_check.skip_mim}")
    print(f"   └─ Skip RAG: {verdict_check.skip_rag}")
    print(f"   └─ Skip Hint: {verdict_check.skip_hint}")
    print(f"   └─ Use Success Path: {verdict_check.use_success_path}")
    print(f"   └─ Rationale: {verdict_check.rationale}")

    try:
        # -------------------------
        # Build initial state with guardrail flags
        # -------------------------
        state: Dict[str, Any] = payload.model_dump()
        state["submission_id"] = submission_id
        
        # Pass guardrail decisions to workflow
        state["_guardrails"] = {
            "skip_mim": verdict_check.skip_mim,
            "skip_rag": verdict_check.skip_rag,
            "skip_hint": verdict_check.skip_hint,
            "use_success_path": verdict_check.use_success_path,
            "create_reinforcement": verdict_check.create_reinforcement,
        }
        
        print(f"🔄 Starting SYNC workflow...")
        log_event("workflow_starting",
            submission_id=submission_id,
            workflow="sync",
            skip_mim=verdict_check.skip_mim,
            skip_rag=verdict_check.skip_rag
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
        hint: Optional[str] = sync_result.get("improvement_hint")  # Fixed: workflow stores as improvement_hint
        mim_insights_raw: Optional[Dict] = sync_result.get("mim_insights")  # ✨ Get MIM predictions
        
        print(f"\n✅ SYNC workflow completed in {elapsed:.2f}s")
        print(f"   └─ Feedback: {'✓' if feedback else '✗'}")
        print(f"   └─ Pattern: {'✓' if detected_pattern else '✗'}")
        print(f"   └─ Hint: {'✓' if hint else '✗'}")
        print(f"   └─ MIM: {'✓' if mim_insights_raw else '✗'}")  # ✨ Log MIM status
        
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
        
        # ✨ Build MIM insights DTO (Pure ML - NO LLM calls)
        mim_dto = None
        if mim_insights_raw:
            mim_dto = MIMInsightsDTO(
                root_cause=mim_insights_raw.get("root_cause"),
                readiness=mim_insights_raw.get("readiness"),
                performance_forecast=mim_insights_raw.get("performance_forecast"),
                is_cold_start=mim_insights_raw.get("is_cold_start", False),
                model_version=mim_insights_raw.get("model_version")
            )
        
        # Extract rich feedback fields from FeedbackResponse
        complexity_analysis = None
        edge_cases = None
        optimization_tips = None
        
        if feedback:
            # Get complexity analysis from feedback agent
            complexity_analysis = getattr(feedback, 'complexity_analysis', None)
            # Get edge cases from feedback agent
            edge_cases = getattr(feedback, 'edge_cases', None)
            # Get optimization tips from feedback agent
            optimization_tips = getattr(feedback, 'optimization_tips', None)
        
        # Build response DTO
        response = AIFeedbackDTO(
            success=True,
            verdict=payload.verdict,
            submission_id=submission_id,
            hints=hints,
            explanation=feedback.explanation if feedback else None,
            detected_pattern=detected_pattern,
            optimization_tips=optimization_tips,
            complexity_analysis=complexity_analysis,
            edge_cases=edge_cases,
            mim_insights=mim_dto,  # ✨ Include MIM predictions
            feedback_type=feedback_type
        )
        
        # For accepted submissions, add improvement hint as optimization tip if not already set
        if verdict_lower == "accepted" and feedback and not optimization_tips:
            response.optimization_tips = [feedback.improvement_hint] if feedback.improvement_hint else []
        
        print(f"\n📤 Sending response:")
        print(f"   └─ Success: {response.success}")
        print(f"   └─ Feedback Type: {feedback_type}")
        print(f"   └─ Hints Count: {len(response.hints)}")
        print(f"   └─ Explanation: {response.explanation[:50] if response.explanation else 'N/A'}...")
        print(f"   └─ Complexity: {complexity_analysis or 'N/A'}")
        print(f"   └─ Edge Cases: {len(edge_cases) if edge_cases else 0}")
        print(f"   └─ Optimization Tips: {len(optimization_tips) if optimization_tips else 0}")
        print(f"   └─ MIM Root Cause: {mim_dto.root_cause.get('failure_cause') if mim_dto and mim_dto.root_cause else 'N/A'}")
        print(f"   └─ Total Time: {elapsed:.2f}s")
        print(f"{'='*80}\n")
        
        log_event("response_sent",
            submission_id=submission_id,
            verdict=payload.verdict,
            hint_count=len(hints),
            total_time_seconds=round(time.time() - start_time, 2)
        )
        
        # ═══════════════════════════════════════════════════════════════════════════════
        # GUARDRAIL: Cache response for idempotency
        # ═══════════════════════════════════════════════════════════════════════════════
        mark_request_complete(
            user_id=payload.user_id,
            problem_id=payload.problem_id,
            verdict=payload.verdict,
            code=payload.code or "",
            response=response.model_dump()
        )
        
        return response

    except TimeoutError:
        log_event("request_timeout", submission_id=submission_id)
        # Return graceful fallback instead of HTTPException
        return AIFeedbackDTO(
            success=False,
            verdict=payload.verdict,
            submission_id=submission_id,
            hints=[
                HintLevel(level=1, content="AI processing timed out. Review your approach and try again.", hint_type="conceptual"),
                HintLevel(level=2, content="Check if your code handles edge cases correctly.", hint_type="specific")
            ],
            explanation="AI feedback generation timed out due to high demand. Please review your code manually or try again in a few moments.",
            detected_pattern=None,
            mim_insights=None,
            feedback_type="error_feedback"
        )

    except Exception as e:
        log_event("request_failed",
            submission_id=submission_id,
            error_type=type(e).__name__,
            error_message=str(e)
        )
        logger.error(traceback.format_exc())
        # Return graceful fallback instead of HTTPException
        verdict_lower = payload.verdict.lower() if payload.verdict else "unknown"
        fallback_hints = [
            HintLevel(level=1, content="Review your approach against the problem requirements.", hint_type="conceptual")
        ]
        fallback_explanation = "AI feedback temporarily unavailable. "
        
        if verdict_lower == "accepted":
            fallback_explanation += "Your solution passed all test cases. Consider reviewing for optimization opportunities."
            fallback_hints.append(HintLevel(level=2, content="Check if there are more efficient algorithms for this problem.", hint_type="optimization"))
        elif verdict_lower in ["time_limit_exceeded", "tle"]:
            fallback_explanation += "Your solution is too slow. Consider reducing time complexity."
            fallback_hints.append(HintLevel(level=2, content="Look for nested loops that could be optimized.", hint_type="specific"))
        elif verdict_lower == "wrong_answer":
            fallback_explanation += "Your solution produces incorrect output. Check your logic and edge cases."
            fallback_hints.append(HintLevel(level=2, content="Test with edge cases like empty inputs, single elements, or boundary values.", hint_type="specific"))
        elif verdict_lower in ["runtime_error", "runtime error"]:
            fallback_explanation += "Your code crashed during execution. Check for array bounds and null references."
            fallback_hints.append(HintLevel(level=2, content="Add defensive checks before accessing arrays or objects.", hint_type="specific"))
        else:
            fallback_explanation += "Please review your code and submission."
            
        return AIFeedbackDTO(
            success=False,
            verdict=payload.verdict,
            submission_id=submission_id,
            hints=fallback_hints,
            explanation=fallback_explanation,
            detected_pattern=None,
            mim_insights=None,
            feedback_type="error_feedback"
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


# ═══════════════════════════════════════════════════════════════════════════════
# MIM (Mentat Intelligence Model) ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class MIMTrainRequest(BaseModel):
    """Request body for MIM training endpoint."""
    min_samples: int = 100
    force_retrain: bool = False


class MIMProfileRequest(BaseModel):
    """Request body for MIM profile endpoint."""
    include_history: bool = False
    history_limit: int = 20


class MIMRecommendRequest(BaseModel):
    """Request body for MIM recommendation endpoint."""
    num_recommendations: int = 5
    difficulty_filter: Optional[str] = None
    topic_filter: Optional[List[str]] = None


@router.get("/ai/mim/status")
def get_mim_status() -> Dict[str, Any]:
    """
    Get MIM model status and health information.
    
    Returns:
    - Model training status
    - Version information
    - Performance metrics
    - Usage statistics
    """
    try:
        from app.mim.model import get_mim_model
        from app.mim.recommender import get_recommender
        from app.mim.schemas import MIMStatus
        
        mim_model = get_mim_model()
        recommender = get_recommender()
        
        # Build component status
        components = {
            "root_cause_classifier": mim_model.is_fitted,
            "readiness_predictor": mim_model.is_fitted,
            "recommender": recommender.is_trained,
            "feature_extractor": True,  # Always available
        }
        
        # Determine overall health
        if mim_model.is_fitted and recommender.is_trained:
            health = "healthy"
        elif mim_model.is_fitted or recommender.is_trained:
            health = "degraded"
        else:
            health = "untrained"
        
        return {
            "is_trained": mim_model.is_fitted,
            "model_version": mim_model.model_version,
            "model_health": health,
            "components": components,
            "metrics": mim_model.metrics if mim_model.metrics else None,
            "training_samples": mim_model.training_samples,
            "training_date": mim_model.training_date.isoformat() if mim_model.training_date else None,
        }
        
    except Exception as e:
        logger.error(f"MIM status check failed: {e}")
        return {
            "is_trained": False,
            "model_version": "unknown",
            "model_health": "error",
            "error": str(e)
        }


@router.get("/ai/mim/profile/{user_id}")
def get_mim_profile(
    user_id: str,
    include_history: bool = False,
    history_limit: int = 20
) -> Dict[str, Any]:
    """
    Get cognitive profile for a user from MIM.
    
    Returns data in format expected by frontend CognitiveProfile component:
    - strengths: list of strong topic areas
    - weaknesses: list of weak topic areas
    - readiness_scores: dict of difficulty -> readiness (0-1)
    - learning_trajectory: dict with trend info
    """
    try:
        from app.db.mongodb import mongo_client
        
        # Get recent submissions for profile building
        submissions = mongo_client.get_user_submissions(user_id=user_id, limit=50)
        
        if not submissions:
            # Return empty profile structure - frontend handles "no data" state
            return None
        
        # Analyze submissions to build profile
        total = len(submissions)
        accepted = sum(1 for s in submissions if s.get("status") == "accepted")
        success_rate = (accepted / total * 100) if total > 0 else 0
        
        # Identify strong/weak areas based on failures
        weak_topics = []
        strong_topics = []
        category_performance = {}
        difficulty_performance = {"Easy": {"total": 0, "passed": 0}, "Medium": {"total": 0, "passed": 0}, "Hard": {"total": 0, "passed": 0}}
        
        for sub in submissions:
            # Extract category from submission data
            tags = sub.get("tags", [])
            cat = sub.get("category") or (tags[0] if isinstance(tags, list) and tags else "General")
            diff = sub.get("difficulty") or "Medium"
            
            if cat not in category_performance:
                category_performance[cat] = {"total": 0, "passed": 0}
            category_performance[cat]["total"] += 1
            
            if diff in difficulty_performance:
                difficulty_performance[diff]["total"] += 1
            
            if sub.get("status") == "accepted":
                category_performance[cat]["passed"] += 1
                if diff in difficulty_performance:
                    difficulty_performance[diff]["passed"] += 1
        
        for cat, stats in category_performance.items():
            rate = (stats["passed"] / stats["total"]) if stats["total"] > 0 else 0
            if rate < 0.4 and stats["total"] >= 2:
                weak_topics.append(cat)
            elif rate > 0.7 and stats["total"] >= 2:
                strong_topics.append(cat)
        
        # Calculate readiness scores per difficulty
        readiness_scores = {}
        for diff, stats in difficulty_performance.items():
            if stats["total"] > 0:
                readiness_scores[diff] = stats["passed"] / stats["total"]
            else:
                # Default readiness based on level
                readiness_scores[diff] = 0.5 if diff == "Easy" else 0.3 if diff == "Medium" else 0.1
        
        # Determine learning trend
        if len(submissions) >= 10:
            recent_5 = submissions[:5]
            older_5 = submissions[5:10]
            recent_rate = sum(1 for s in recent_5 if s.get("status") == "accepted") / 5
            older_rate = sum(1 for s in older_5 if s.get("status") == "accepted") / 5
            if recent_rate > older_rate + 0.1:
                trend = "Improving"
            elif recent_rate < older_rate - 0.1:
                trend = "Needs attention"
            else:
                trend = "Stable"
        else:
            trend = "Building profile..."
        
        # Return flat structure expected by CognitiveProfile.jsx
        response = {
            "strengths": strong_topics[:5],
            "weaknesses": weak_topics[:5],
            "readiness_scores": readiness_scores,
            "learning_trajectory": {
                "trend": trend,
                "total_submissions": total,
                "success_rate": round(success_rate, 2)
            }
        }
        
        # Optionally include submission history
        if include_history:
            history = []
            for sub in submissions[:history_limit]:
                history.append({
                    "submission_id": str(sub.get("_id", "")),
                    "problem_id": sub.get("questionId"),
                    "verdict": sub.get("status"),
                    "created_at": sub.get("createdAt")
                })
            response["submission_history"] = history
        
        return response
        
    except Exception as e:
        logger.error(f"MIM profile retrieval failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve MIM profile: {str(e)}"
        )


@router.get("/ai/mim/recommend/{user_id}")
def get_mim_recommendations(
    user_id: str,
    num_recommendations: int = 5,
    difficulty_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get personalized problem recommendations for a user.
    
    Returns actual problems from the database based on user's weak areas.
    """
    try:
        from app.db.mongodb import mongo_client
        
        # Get user submissions to understand their profile
        submissions = mongo_client.get_user_submissions(user_id=user_id, limit=50)
        
        # Analyze user's performance
        total = len(submissions)
        accepted = sum(1 for s in submissions if s.get("status") == "accepted")
        success_rate = (accepted / total * 100) if total > 0 else 50
        
        # Determine user level and recommended difficulty
        if success_rate >= 70:
            level = "Advanced"
            recommended_difficulty = "Hard"
        elif success_rate >= 40:
            level = "Intermediate"
            recommended_difficulty = "Medium"
        else:
            level = "Beginner"
            recommended_difficulty = "Easy"
        
        # Override with filter if provided
        if difficulty_filter:
            recommended_difficulty = difficulty_filter
        
        # Identify weak topics and solved problem IDs
        weak_topics = []
        category_failures = {}
        solved_problem_ids = set()
        
        for sub in submissions:
            if sub.get("status") == "accepted":
                solved_problem_ids.add(sub.get("questionId"))
            else:
                tags = sub.get("tags", [])
                cat = sub.get("category") or (tags[0] if isinstance(tags, list) and tags else "General")
                category_failures[cat] = category_failures.get(cat, 0) + 1
        
        # Sort by failure count
        weak_topics = sorted(category_failures.keys(), key=lambda x: category_failures[x], reverse=True)[:5]
        
        # Query actual problems from database
        recommendations = []
        
        if mongo_client.db is not None:
            # Build query for unsolved problems
            query = {
                "_id": {"$nin": list(solved_problem_ids)},  # Exclude already solved
            }
            
            # Add difficulty filter
            if recommended_difficulty:
                query["difficulty"] = recommended_difficulty
            
            # Try to find problems matching weak topics
            if weak_topics:
                query["$or"] = [
                    {"tags": {"$in": weak_topics}},
                    {"category": {"$in": weak_topics}}
                ]
            
            try:
                # Fetch problems from database
                problems = list(
                    mongo_client.db.problems
                    .find(query)
                    .limit(num_recommendations * 2)  # Fetch extra to filter
                )
                
                # If not enough problems with weak topics, get any unsolved problems
                if len(problems) < num_recommendations:
                    fallback_query = {
                        "_id": {"$nin": list(solved_problem_ids)},
                    }
                    if recommended_difficulty:
                        fallback_query["difficulty"] = recommended_difficulty
                    
                    more_problems = list(
                        mongo_client.db.problems
                        .find(fallback_query)
                        .limit(num_recommendations - len(problems))
                    )
                    problems.extend(more_problems)
                
                # v3.2: FALLBACK - If still not enough, try other difficulties
                if len(problems) < num_recommendations:
                    difficulty_fallbacks = ["Medium", "Hard", "Easy"]
                    difficulty_fallbacks = [d for d in difficulty_fallbacks if d != recommended_difficulty]
                    
                    for fallback_diff in difficulty_fallbacks:
                        if len(problems) >= num_recommendations:
                            break
                        alt_query = {
                            "_id": {"$nin": list(solved_problem_ids)},
                            "difficulty": fallback_diff
                        }
                        alt_problems = list(
                            mongo_client.db.problems
                            .find(alt_query)
                            .limit(num_recommendations - len(problems))
                        )
                        problems.extend(alt_problems)
                
                # v3.2: FALLBACK - If user has solved most problems, suggest review
                if len(problems) < num_recommendations and len(solved_problem_ids) > 10:
                    # Recommend re-attempting problems they got wrong before
                    failed_problem_ids = set()
                    for sub in submissions:
                        if sub.get("status") != "accepted":
                            failed_problem_ids.add(sub.get("questionId"))
                    
                    # Remove problems they eventually solved
                    review_ids = failed_problem_ids - solved_problem_ids
                    
                    if review_ids:
                        review_query = {"_id": {"$in": list(review_ids)}}
                        review_problems = list(
                            mongo_client.db.problems
                            .find(review_query)
                            .limit(num_recommendations - len(problems))
                        )
                        # Mark these as review problems
                        for p in review_problems:
                            p["_is_review"] = True
                        problems.extend(review_problems)
                
                # Build recommendations from actual problems
                for i, prob in enumerate(problems[:num_recommendations]):
                    problem_id = str(prob.get("_id", ""))
                    tags = prob.get("tags", [])
                    category = tags[0] if tags else prob.get("category", "General")
                    
                    # Calculate confidence based on whether it matches weak area
                    is_weak_area = any(t in weak_topics for t in tags) if tags else False
                    is_review = prob.get("_is_review", False)
                    
                    if is_review:
                        confidence = 0.7
                        reason = f"Review: You struggled with this {category} problem before. Try again!"
                    elif is_weak_area:
                        confidence = 0.4
                        reason = f"Recommended to strengthen your {category} skills."
                    else:
                        confidence = 0.6
                        reason = "Recommended to diversify your practice."
                    
                    recommendations.append({
                        "problem_id": problem_id,
                        "title": prob.get("title", f"Problem {problem_id}"),
                        "difficulty": prob.get("difficulty", recommended_difficulty),
                        "category": category,
                        "confidence": confidence,
                        "reason": reason,
                        "is_review": is_review
                    })
                    
            except Exception as db_err:
                logger.warning(f"Database query failed: {db_err}")
        
        # If no problems found in DB, return message
        if not recommendations:
            return {
                "recommendations": [],
                "message": "Complete more problems to get personalized recommendations."
            }
        
        return {
            "recommendations": recommendations,
            "focus_topics": weak_topics[:3],
            "current_level": level
        }
        
    except Exception as e:
        logger.error(f"MIM recommendations failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {str(e)}"
        )


@router.post("/ai/mim/train")
def train_mim_model(
    request: MIMTrainRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Trigger MIM model training.
    
    Training runs in background to avoid blocking.
    
    Args:
    - min_samples: Minimum training examples required
    - force_retrain: Whether to retrain even if model exists
    """
    try:
        from app.mim.model import get_mim_model
        from app.db.mongodb import get_database
        
        mim_model = get_mim_model()
        db = get_database()
        
        # Check if already trained and not forcing retrain
        if mim_model.is_fitted and not request.force_retrain:
            return {
                "status": "already_trained",
                "message": "Model is already trained. Use force_retrain=true to retrain.",
                "current_metrics": mim_model.metrics
            }
        
        # Count available training examples
        training_count = db.mim_training_data.count_documents({})
        
        if training_count < request.min_samples:
            return {
                "status": "insufficient_data",
                "message": f"Need at least {request.min_samples} training examples. Currently have {training_count}.",
                "current_count": training_count,
                "required_count": request.min_samples
            }
        
        # Define training task
        def train_task():
            try:
                from app.mim.feature_extractor import FeatureExtractor
                
                # Load training data
                training_data = list(db.mim_training_data.find({}))
                
                # Extract features
                extractor = FeatureExtractor()
                X = []
                y = []
                
                for example in training_data:
                    features = example.get("features")
                    label = example.get("root_cause_label")
                    if features and label:
                        X.append(features)
                        y.append(label)
                
                # Train model
                import numpy as np
                mim_model.train(np.array(X), np.array(y))
                
                logger.info(f"MIM model trained successfully with {len(X)} examples")
                
            except Exception as e:
                logger.error(f"MIM training failed: {e}")
        
        # Schedule background training
        background_tasks.add_task(train_task)
        
        return {
            "status": "training_started",
            "message": "MIM model training has been scheduled",
            "training_examples": training_count
        }
        
    except Exception as e:
        logger.error(f"MIM training request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start training: {str(e)}"
        )


@router.get("/ai/mim/predict/{user_id}/{problem_id}")
def get_mim_prediction(
    user_id: str,
    problem_id: str
) -> Dict[str, Any]:
    """
    Get MIM prediction for a specific user-problem pair.
    
    Useful for pre-submission analysis or debugging.
    """
    try:
        from app.mim.inference import get_mim_inference
        from app.db.mongodb import get_database
        
        mim = get_mim_inference()
        db = get_database()
        
        # Get user submissions
        submissions = list(db.submissions.find(
            {"user_id": user_id},
            sort=[("created_at", -1)],
            limit=30
        ))
        
        # Get problem
        problem = db.problems.find_one({"problem_id": problem_id})
        
        if not problem:
            return {
                "status": "problem_not_found",
                "message": f"Problem {problem_id} not found"
            }
        
        # Build mock context for prediction
        context = {
            "user_id": user_id,
            "problem_id": problem_id,
            "problem_title": problem.get("title", ""),
            "problem_difficulty": problem.get("difficulty", "Medium"),
            "problem_category": problem.get("tags", ["general"])[0] if problem.get("tags") else "general",
            "code": "",  # No code for pre-submission
            "verdict": "unknown",
            "user_submissions": submissions
        }
        
        # Get prediction
        prediction = mim.predict(context)
        
        return {
            "status": "success",
            "user_id": user_id,
            "problem_id": problem_id,
            "prediction": {
                "root_cause": prediction.root_cause.model_dump() if prediction.root_cause else None,
                "readiness": prediction.readiness.model_dump() if prediction.readiness else None,
                "performance_forecast": prediction.performance_forecast.model_dump() if prediction.performance_forecast else None,
                "is_cold_start": prediction.is_cold_start,
                "model_version": prediction.model_version,
                "inference_time_ms": prediction.inference_time_ms
            },
            "recommended_difficulty": prediction.readiness.recommended_difficulty if prediction.readiness else "Medium"
        }
        
    except Exception as e:
        logger.error(f"MIM prediction failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get prediction: {str(e)}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# MIM ROADMAP ENDPOINTS (V2.1)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/ai/mim/roadmap/{user_id}")
def get_learning_roadmap(
    user_id: str,
    regenerate: bool = False
) -> Dict[str, Any]:
    """
    Get or generate a personalized learning roadmap for a user.
    
    The roadmap includes:
    - 5-step micro-roadmap with immediate goals
    - Topic dependency graph (derived from co-occurrence)
    - Milestones achieved
    - Estimated time to target level
    - Difficulty adjustment recommendations
    
    Args:
        user_id: User identifier
        regenerate: Force regeneration even if roadmap exists
    """
    try:
        from app.db.mongodb import mongo_client
        from app.mim.difficulty_engine import compute_difficulty_adjustment
        from app.mim.roadmap import generate_learning_roadmap
        
        # Get user submissions
        submissions = mongo_client.get_user_submissions(user_id=user_id, limit=100)
        
        if not submissions:
            # Cold start - generate default roadmap
            return {
                "status": "cold_start",
                "message": "Start solving problems to get a personalized roadmap!",
                "roadmap": {
                    "userId": user_id,
                    "currentPhase": "foundation",
                    "steps": [
                        {
                            "stepNumber": 1,
                            "goal": "Build problem-solving fundamentals",
                            "targetProblems": 3,
                            "completedProblems": 0,
                            "focusTopics": ["Arrays", "Strings"],
                            "targetDifficulty": "Easy",
                            "status": "in_progress"
                        },
                        {
                            "stepNumber": 2,
                            "goal": "Practice basic patterns",
                            "targetProblems": 2,
                            "focusTopics": ["Arrays", "Math"],
                            "targetDifficulty": "Easy",
                            "status": "pending"
                        }
                    ],
                    "milestones": [],
                    "targetLevel": "Medium",
                    "estimatedWeeksToTarget": 8
                }
            }
        
        # Convert MongoDB submissions to dict format
        formatted_submissions = []
        for sub in submissions:
            formatted_submissions.append({
                "problem_id": str(sub.get("questionId", "")),
                "verdict": sub.get("status", ""),
                "difficulty": sub.get("problemDifficulty") or sub.get("difficulty", "Medium"),
                "category": sub.get("problemCategory") or sub.get("category", "General"),
                "tags": sub.get("problemTags") or sub.get("tags", []),
                "created_at": sub.get("createdAt"),
            })
        
        # Build user profile from submissions
        total = len(formatted_submissions)
        accepted = sum(1 for s in formatted_submissions if s.get("verdict", "").lower() == "accepted")
        success_rate = accepted / total if total > 0 else 0.5
        
        # Identify weak and strong topics
        category_stats = {}
        for sub in formatted_submissions:
            cat = sub.get("category", "General")
            if cat not in category_stats:
                category_stats[cat] = {"total": 0, "accepted": 0}
            category_stats[cat]["total"] += 1
            if sub.get("verdict", "").lower() == "accepted":
                category_stats[cat]["accepted"] += 1
        
        weak_topics = [
            cat for cat, stats in category_stats.items()
            if stats["total"] >= 2 and (stats["accepted"] / stats["total"]) < 0.4
        ][:5]
        
        strong_topics = [
            cat for cat, stats in category_stats.items()
            if stats["total"] >= 3 and (stats["accepted"] / stats["total"]) > 0.7
        ][:5]
        
        user_profile = {
            "user_id": user_id,
            "weakTopics": weak_topics,
            "strongTopics": strong_topics,
            "successRate": success_rate,
            "totalSubmissions": total,
            "difficultyReadiness": {
                "easy": min(1.0, success_rate + 0.3),
                "medium": success_rate,
                "hard": max(0.1, success_rate - 0.3),
            }
        }
        
        # Compute difficulty adjustment
        readiness = user_profile["difficultyReadiness"]
        difficulty_adjustment = compute_difficulty_adjustment(
            formatted_submissions[:20],  # Recent submissions
            readiness,
            user_profile
        )
        
        # Generate roadmap
        roadmap = generate_learning_roadmap(
            user_id=user_id,
            submissions=formatted_submissions,
            user_profile=user_profile,
            difficulty_adjustment=difficulty_adjustment,
            existing_roadmap=None if regenerate else None  # TODO: Load from DB
        )
        
        return {
            "status": "success",
            "roadmap": roadmap,
            "profile_summary": {
                "totalSolved": accepted,
                "successRate": round(success_rate, 2),
                "weakTopics": weak_topics,
                "strongTopics": strong_topics,
            }
        }
        
    except Exception as e:
        logger.error(f"MIM roadmap generation failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate roadmap: {str(e)}"
        )


@router.get("/ai/mim/difficulty/{user_id}")
def get_difficulty_adjustment(
    user_id: str
) -> Dict[str, Any]:
    """
    Get personalized difficulty adjustment recommendation.
    
    Returns whether to increase, decrease, or maintain difficulty
    based on recent performance, frustration, and boredom indices.
    """
    try:
        from app.db.mongodb import mongo_client
        from app.mim.difficulty_engine import compute_difficulty_adjustment
        
        # Get recent submissions
        submissions = mongo_client.get_user_submissions(user_id=user_id, limit=20)
        
        if not submissions:
            return {
                "status": "cold_start",
                "adjustment": {
                    "next_difficulty": "Easy",
                    "adjustment": "maintain",
                    "confidence": 0.4,
                    "reason": "Start with Easy problems to build foundation.",
                    "frustration_index": 0.0,
                    "boredom_index": 0.0,
                }
            }
        
        # Format submissions
        formatted = []
        for sub in submissions:
            formatted.append({
                "problem_id": str(sub.get("questionId", "")),
                "verdict": sub.get("status", ""),
                "difficulty": sub.get("problemDifficulty") or sub.get("difficulty", "Medium"),
                "created_at": sub.get("createdAt"),
            })
        
        # Compute readiness from recent performance
        total = len(formatted)
        accepted = sum(1 for s in formatted if s.get("verdict", "").lower() == "accepted")
        success_rate = accepted / total if total > 0 else 0.5
        
        readiness = {
            "easy": min(1.0, success_rate + 0.3),
            "medium": success_rate,
            "hard": max(0.1, success_rate - 0.3),
        }
        
        # Get adjustment
        adjustment = compute_difficulty_adjustment(formatted, readiness)
        
        return {
            "status": "success",
            "user_id": user_id,
            "adjustment": adjustment
        }
        
    except Exception as e:
        logger.error(f"Difficulty adjustment failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute difficulty adjustment: {str(e)}"
        )
