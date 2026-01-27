"""
MIM Inference Service
======================

Real-time prediction service for MIM integration.

This module provides the main interface for the workflow to call MIM.
Handles feature extraction, model inference, and result formatting.

Usage:
    from app.mim.inference import MIMInference
    
    mim = MIMInference()
    prediction = mim.predict(submission, user_history, problem_context, user_memory)
"""

from typing import Dict, List, Optional, Any
import numpy as np
import time
import logging

from app.mim.feature_extractor import MIMFeatureExtractor, MIN_SUBMISSIONS_FOR_FULL_FEATURES
from app.mim.model import MIMModel
from app.mim.schemas import (
    MIMPrediction,
    MIMRootCause,
    MIMReadiness,
    MIMPerformanceForecast,
)

logger = logging.getLogger("mim.inference")


class MIMInference:
    """
    MIM Inference Service.
    
    Singleton-like class that maintains feature extractor and model instances.
    Thread-safe for concurrent requests.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern for efficient model reuse."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize inference service (only once)."""
        if MIMInference._initialized:
            return
        
        self.feature_extractor = MIMFeatureExtractor()
        self.model = MIMModel()
        
        # Try to load trained model
        loaded = self.model.load()
        if not loaded:
            logger.warning("MIM running with untrained model - predictions will use fallback heuristics")
        
        MIMInference._initialized = True
        logger.info("MIM Inference Service initialized")
    
    def predict(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]],
        problem_context: Optional[Dict[str, Any]] = None,
        user_memory: Optional[List[str]] = None,
    ) -> MIMPrediction:
        """
        Generate complete MIM prediction for a submission.
        
        Args:
            submission: Current submission data (user_id, problem_id, code, verdict, etc.)
            user_history: List of past submissions from MongoDB
            problem_context: Problem details (title, difficulty, tags)
            user_memory: RAG-retrieved memory chunks
            
        Returns:
            MIMPrediction with root_cause, readiness, and performance forecast
        """
        start_time = time.time()
        
        try:
            # 1. Extract features
            features = self.feature_extractor.extract(
                submission=submission,
                user_history=user_history,
                problem_context=problem_context,
                user_memory=user_memory,
            )
            
            # 2. Run predictions
            root_cause_result = self.model.predict_root_cause(features)
            readiness_result = self.model.predict_readiness(features)
            performance_result = self.model.predict_performance(features)
            
            # 3. Extract similar past mistakes from memory
            similar_mistakes = self._extract_similar_mistakes(
                user_memory, 
                root_cause_result["failure_cause"]
            )
            
            # 4. Generate recommended focus areas
            focus_areas = self._generate_focus_areas(
                root_cause_result,
                readiness_result,
                problem_context,
            )
            
            # 5. Check cold start status
            is_cold_start = len(user_history) < MIN_SUBMISSIONS_FOR_FULL_FEATURES
            
            # 6. Build prediction object
            inference_time = (time.time() - start_time) * 1000  # ms
            
            prediction = MIMPrediction(
                root_cause=MIMRootCause(
                    failure_cause=root_cause_result["failure_cause"],
                    confidence=root_cause_result["confidence"],
                    alternatives=root_cause_result.get("alternatives", []),
                ),
                readiness=MIMReadiness(
                    current_level=readiness_result["current_level"],
                    easy_readiness=readiness_result["easy_readiness"],
                    medium_readiness=readiness_result["medium_readiness"],
                    hard_readiness=readiness_result["hard_readiness"],
                    recommended_difficulty=readiness_result["recommended_difficulty"],
                ),
                performance_forecast=MIMPerformanceForecast(
                    expected_success_rate=performance_result["expected_success_rate"],
                    plateau_risk=performance_result["plateau_risk"],
                    burnout_risk=performance_result["burnout_risk"],
                    learning_velocity=performance_result["learning_velocity"],
                ),
                similar_past_mistakes=similar_mistakes,
                recommended_focus_areas=focus_areas,
                is_cold_start=is_cold_start,
                model_version=self.model.model_version,
                inference_time_ms=inference_time,
            )
            
            logger.info(
                f"MIM prediction complete | "
                f"root_cause={root_cause_result['failure_cause']} "
                f"confidence={root_cause_result['confidence']:.2f} "
                f"time={inference_time:.1f}ms"
            )
            
            return prediction
            
        except Exception as e:
            logger.error(f"MIM inference failed: {e}")
            return self._fallback_prediction(submission, user_history)
    
    def _extract_similar_mistakes(
        self,
        user_memory: Optional[List[str]],
        predicted_cause: str,
    ) -> List[str]:
        """
        Extract past mistakes from memory that match predicted cause.
        
        Returns up to 3 relevant past mistakes.
        """
        if not user_memory:
            return []
        
        similar = []
        cause_keywords = predicted_cause.replace("_", " ").split()
        
        for memory in user_memory[:10]:  # Check first 10 memories
            memory_lower = memory.lower()
            
            # Check if any cause keyword appears
            matches = sum(1 for kw in cause_keywords if kw in memory_lower)
            
            if matches >= 1 or predicted_cause.replace("_", " ") in memory_lower:
                # Extract a meaningful excerpt
                excerpt = memory[:150] + "..." if len(memory) > 150 else memory
                similar.append(excerpt)
                
                if len(similar) >= 3:
                    break
        
        return similar
    
    def _generate_focus_areas(
        self,
        root_cause: Dict[str, Any],
        readiness: Dict[str, Any],
        problem_context: Optional[Dict[str, Any]],
    ) -> List[str]:
        """
        Generate recommended focus areas based on predictions.
        """
        focus_areas = []
        
        # Map root causes to learning recommendations
        cause_to_focus = {
            "boundary_condition_blindness": "Edge case handling (empty inputs, n=0, n=1)",
            "off_by_one_error": "Loop bounds and array indexing practice",
            "integer_overflow": "Large number handling and modular arithmetic",
            "wrong_data_structure": "Data structure selection exercises",
            "logic_error": "Algorithm correctness and dry-running",
            "time_complexity_issue": "Time complexity analysis and optimization",
            "recursion_issue": "Recursion fundamentals and base cases",
            "comparison_error": "Comparison operators and floating point",
        }
        
        predicted_cause = root_cause["failure_cause"]
        if predicted_cause in cause_to_focus:
            focus_areas.append(cause_to_focus[predicted_cause])
        
        # Add difficulty-based recommendation
        current_level = readiness["current_level"]
        if current_level in ["Beginner", "Easy"]:
            focus_areas.append("Fundamental problem-solving patterns")
        elif current_level in ["Medium", "Medium+"]:
            focus_areas.append("Intermediate algorithm techniques")
        
        # Add topic-based recommendation if available
        if problem_context:
            tags = problem_context.get("tags", [])
            if tags:
                focus_areas.append(f"Practice more {tags[0]} problems")
        
        return focus_areas[:3]  # Limit to 3
    
    def _fallback_prediction(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]],
    ) -> MIMPrediction:
        """
        Generate fallback prediction when inference fails.
        """
        verdict = submission.get("verdict", "").lower()
        is_cold_start = len(user_history) < MIN_SUBMISSIONS_FOR_FULL_FEATURES
        
        # Default cause based on verdict
        if verdict == "time_limit_exceeded":
            cause = "time_complexity_issue"
        elif verdict == "runtime_error":
            cause = "boundary_condition_blindness"
        else:
            cause = "logic_error"
        
        return MIMPrediction(
            root_cause=MIMRootCause(
                failure_cause=cause,
                confidence=0.3,
                alternatives=[],
            ),
            readiness=MIMReadiness(
                current_level="Medium",
                easy_readiness=0.7,
                medium_readiness=0.5,
                hard_readiness=0.3,
                recommended_difficulty="Medium",
            ),
            performance_forecast=MIMPerformanceForecast(
                expected_success_rate=0.5,
                plateau_risk=0.3,
                burnout_risk=0.2,
                learning_velocity="stable",
            ),
            similar_past_mistakes=[],
            recommended_focus_areas=["General problem-solving practice"],
            is_cold_start=is_cold_start,
            model_version="fallback",
            inference_time_ms=0.0,
        )
    
    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Get full cognitive profile for a user.
        
        This requires fetching user history and running aggregate analysis.
        Used by /ai/mim/profile endpoint.
        """
        # This would be called from routes with pre-fetched data
        # For now, return structure
        return {
            "user_id": user_id,
            "cognitive_profile": {
                "thinking_style": "analytical",
                "risk_behavior": "moderate",
                "debug_preference": "print-based",
                "generalization_strength": 0.5,
            },
            "performance_forecast": {
                "expected_success_rate": 0.6,
                "plateau_risk": 0.2,
                "burnout_risk": 0.1,
            },
            "recommended_problems": [],
        }
    
    def reload_model(self) -> bool:
        """
        Reload model from disk (after retraining).
        
        Returns True if successful.
        """
        logger.info("Reloading MIM model...")
        return self.model.load()
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model metadata for debugging."""
        return self.model.get_model_info()


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_mim_inference() -> MIMInference:
    """
    Get the singleton MIMInference instance.
    
    Returns:
        MIMInference: The singleton instance
    """
    return MIMInference()


def predict_for_submission(
    submission: Dict[str, Any],
    user_history: List[Dict[str, Any]],
    problem_context: Optional[Dict[str, Any]] = None,
    user_memory: Optional[List[str]] = None,
) -> MIMPrediction:
    """
    Convenience function for workflow integration.
    
    Usage:
        from app.mim.inference import predict_for_submission
        mim_prediction = predict_for_submission(state, user_history, problem, memory)
    """
    mim = MIMInference()
    return mim.predict(submission, user_history, problem_context, user_memory)
