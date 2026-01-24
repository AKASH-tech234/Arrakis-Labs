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
            mim_insights=mim_dto,  # ✨ Include MIM predictions
            feedback_type=feedback_type
        )
        
        # Add optimization tips for accepted submissions
        if verdict_lower == "accepted" and feedback:
            response.optimization_tips = [feedback.improvement_hint] if feedback.improvement_hint else []
        
        print(f"\n📤 Sending response:")
        print(f"   └─ Success: {response.success}")
        print(f"   └─ Feedback Type: {feedback_type}")
        print(f"   └─ Hints Count: {len(response.hints)}")
        print(f"   └─ MIM Root Cause: {mim_dto.root_cause.get('failure_cause') if mim_dto and mim_dto.root_cause else 'N/A'}")
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
    
    Returns:
    - Current skill level
    - Strengths and weaknesses
    - Common mistake patterns
    - Learning trajectory
    """
    try:
        from app.mim.inference import get_mim_inference
        from app.db.mongodb import get_database
        
        mim = get_mim_inference()
        db = get_database()
        
        # Get recent submissions for profile building
        submissions = list(db.submissions.find(
            {"user_id": user_id},
            sort=[("created_at", -1)],
            limit=50
        ))
        
        if not submissions:
            return {
                "user_id": user_id,
                "status": "no_data",
                "message": "No submissions found for this user",
                "profile": None
            }
        
        # Build cognitive profile
        profile = mim.build_user_profile(user_id, submissions)
        
        response = {
            "user_id": user_id,
            "status": "success",
            "profile": {
                "current_level": profile.current_level,
                "strengths": profile.strengths,
                "weak_topics": profile.weak_topics,
                "common_mistake_types": profile.common_mistake_types,
                "recurring_patterns": profile.recurring_patterns,
                "total_submissions": profile.total_submissions,
                "success_rate": profile.success_rate,
                "avg_attempts_to_solve": profile.avg_attempts_to_solve,
                "learning_velocity": profile.learning_velocity,
                "improvement_trend": profile.improvement_trend,
                "last_updated": profile.last_updated.isoformat() if profile.last_updated else None
            }
        }
        
        # Optionally include submission history
        if include_history:
            history = []
            for sub in submissions[:history_limit]:
                history.append({
                    "submission_id": str(sub.get("_id", "")),
                    "problem_id": sub.get("problem_id"),
                    "verdict": sub.get("verdict"),
                    "created_at": sub.get("created_at").isoformat() if sub.get("created_at") else None
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
    
    Returns:
    - Ranked list of recommended problems
    - Success probability for each
    - Relevance scores
    - Focus topics
    """
    try:
        from app.mim.recommender import get_recommender
        from app.mim.inference import get_mim_inference
        from app.db.mongodb import get_database
        
        recommender = get_recommender()
        mim = get_mim_inference()
        db = get_database()
        
        # Get user data
        submissions = list(db.submissions.find(
            {"user_id": user_id},
            sort=[("created_at", -1)],
            limit=50
        ))
        
        # Get cognitive profile
        profile = mim.build_user_profile(user_id, submissions) if submissions else None
        
        # Get candidate problems
        query = {}
        if difficulty_filter:
            query["difficulty"] = difficulty_filter
        
        candidate_problems = list(db.problems.find(query, limit=100))
        
        if not candidate_problems:
            return {
                "user_id": user_id,
                "status": "no_candidates",
                "message": "No candidate problems found",
                "recommendations": []
            }
        
        # Get recommendations
        if recommender.is_fitted and profile:
            recommendations = recommender.recommend(
                user_id=user_id,
                candidate_problems=candidate_problems,
                user_profile=profile,
                n_recommendations=num_recommendations
            )
        else:
            # Fallback to rule-based recommendations
            recommendations = recommender._fallback_recommendations(
                user_id=user_id,
                candidate_problems=candidate_problems,
                user_profile=profile,
                n_recommendations=num_recommendations
            )
        
        return {
            "user_id": user_id,
            "status": "success",
            "is_ml_based": recommender.is_fitted,
            "current_level": profile.current_level if profile else "Unknown",
            "recommendations": [
                {
                    "rank": i + 1,
                    "problem_id": rec.get("problem_id"),
                    "title": rec.get("title", "Unknown"),
                    "difficulty": rec.get("difficulty", "Medium"),
                    "tags": rec.get("tags", []),
                    "success_probability": rec.get("success_probability", 0.5),
                    "relevance_score": rec.get("relevance_score", 0.5),
                    "reasoning": rec.get("reasoning", "")
                }
                for i, rec in enumerate(recommendations)
            ],
            "focus_topics": profile.weak_topics[:3] if profile else [],
            "avoid_topics": profile.strengths[:2] if profile else []
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
