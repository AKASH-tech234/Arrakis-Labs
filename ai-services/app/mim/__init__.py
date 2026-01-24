"""
MIM - Mentat Intelligence Model
================================

A persistent cognitive layer that predicts learning trajectories,
failure root causes, and user readiness for the Arrakis Labs platform.

V2.0 Enhancements (per ML requirements):
- Expanded root cause categories (9 → 15)
- Problem Recommendation Engine (LightGBM ranker)
- Evaluation Pipeline (user-aware splits, ROC-AUC, Precision@K)
- New schemas for difficulty adjustment, recommendations, metrics

Components:
- feature_extractor: MongoDB submissions → ML features (60 dims)
- model: Sklearn models for prediction (RandomForest, GradientBoosting)
- inference: Real-time prediction service
- training: Offline model training pipeline
- schemas: Pydantic models for MIM outputs
- recommender: Learning-to-rank problem recommendations (NEW)
- evaluation: Model evaluation with user-aware splits (NEW)

Integration:
- Sync workflow: mim_prediction_node runs after retrieve_problem
- Agents: Receive mim_insights in context for enhanced feedback
- API: /ai/mim/* endpoints for status, profile, recommendations, training
"""

# Core schemas
from app.mim.schemas import (
    # Root cause categories
    ROOT_CAUSE_CATEGORIES,
    # Prediction outputs
    MIMPrediction,
    MIMRootCause,
    MIMReadiness,
    MIMPerformanceForecast,
    MIMCognitiveProfile,
    # New schemas (V2.0)
    MIMDifficultyAdjustment,
    MIMProblemRecommendation,
    MIMRecommendations,
    MIMModelMetrics,
    MIMStatus,
    # Training schemas
    MIMTrainingExample,
    MIMLabelingTask,
)

# Inference service
from app.mim.inference import MIMInference, get_mim_inference

# Model
from app.mim.model import MIMModel, get_mim_model

# Feature extraction
from app.mim.feature_extractor import MIMFeatureExtractor

# Recommender (V2.0)
from app.mim.recommender import MIMRecommender, get_recommender

# Evaluation (V2.0)
from app.mim.evaluation import MIMEvaluator, get_evaluator

__all__ = [
    # Constants
    "ROOT_CAUSE_CATEGORIES",
    # Core prediction schemas
    "MIMPrediction",
    "MIMRootCause", 
    "MIMReadiness",
    "MIMPerformanceForecast",
    "MIMCognitiveProfile",
    # New schemas (V2.0)
    "MIMDifficultyAdjustment",
    "MIMProblemRecommendation",
    "MIMRecommendations",
    "MIMModelMetrics",
    "MIMStatus",
    # Training schemas
    "MIMTrainingExample",
    "MIMLabelingTask",
    # Services
    "MIMInference",
    "get_mim_inference",
    "MIMModel",
    "get_mim_model",
    "MIMFeatureExtractor",
    # V2.0 services
    "MIMRecommender",
    "get_recommender",
    "MIMEvaluator",
    "get_evaluator",
]
