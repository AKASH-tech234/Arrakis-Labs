"""
MIM - Mentat Intelligence Model
================================

A persistent cognitive layer that predicts learning trajectories,
failure root causes, and user readiness for the Arrakis Labs platform.

V3.0 Architecture (State Estimator):
- 4-category ROOT_CAUSE taxonomy (correctness, efficiency, implementation, understanding_gap)
- 16 fine-grained SUBTYPES with validation
- Deterministic FAILURE_MECHANISM derivation (not ML)
- Delta-based features (what changed vs. absolute counts)
- Separated pipelines: Failed → CorrectnessFeedback, Accepted → ReinforcementFeedback
- User state snapshot injection for personalization

Components:
- taxonomy/: ROOT_CAUSE, SUBTYPES, failure_mechanism_rules
- features/: delta_features, state_snapshot, signal_extractor
- output_schemas/: Strict output schemas (no optional fields)
- inference/: mim_decision_node, feedback_generator
- training/: dataset_builder, train_root_cause, train_subtype

Legacy Components (V2.0):
- feature_extractor: MongoDB submissions → ML features (60 dims)
- model: Sklearn models for prediction (RandomForest, GradientBoosting)
- schemas: Old Pydantic models (15 root causes)
"""

import warnings

# ═══════════════════════════════════════════════════════════════════════════════
# V3.0 NEW MODULES (RECOMMENDED)
# ═══════════════════════════════════════════════════════════════════════════════

# New taxonomy
from app.mim.taxonomy.root_causes import ROOT_CAUSES, OLD_TO_NEW_ROOT_CAUSE
from app.mim.taxonomy.subtypes import SUBTYPES, SUBTYPE_TO_ROOT_CAUSE
from app.mim.taxonomy.failure_mechanism_rules import derive_failure_mechanism

# New features
from app.mim.features.delta_features import DeltaFeatures, compute_delta_features
from app.mim.features.state_snapshot import UserStateSnapshot, build_user_state_snapshot
from app.mim.features.signal_extractor import CodeSignals, extract_code_signals

# Output schemas
from app.mim.output_schemas.mim_input import MIMInput
from app.mim.output_schemas.mim_output import MIMOutput
from app.mim.output_schemas.correctness_feedback import CorrectnessFeedback
from app.mim.output_schemas.performance_feedback import PerformanceFeedback
from app.mim.output_schemas.reinforcement_feedback import ReinforcementFeedback

# New inference
from app.mim.inference.mim_decision_node import MIMDecisionNode
from app.mim.inference.feedback_generator import (
    generate_correctness_feedback,
    generate_performance_feedback,
    generate_reinforcement_feedback,
)

# ═══════════════════════════════════════════════════════════════════════════════
# V2.0 LEGACY MODULES (DEPRECATED - for backward compatibility)
# ═══════════════════════════════════════════════════════════════════════════════

# Core schemas (DEPRECATED)
from app.mim.schemas import (
    # Root cause categories (DEPRECATED - use ROOT_CAUSES)
    ROOT_CAUSE_CATEGORIES,
    # Prediction outputs (DEPRECATED - use MIMOutput)
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

# Inference service - V3 architecture
try:
    from app.mim.inference import MIMDecisionNode, run_mim_inference
except ImportError:
    MIMDecisionNode = None
    run_mim_inference = None

# Model (DEPRECATED - use MIMDecisionNode)
from app.mim.model import MIMModel, get_mim_model

# Feature extraction (DEPRECATED - use delta_features)
from app.mim.feature_extractor import MIMFeatureExtractor

# Recommender (V2.0)
from app.mim.recommender import MIMRecommender, get_recommender

# Evaluation (V2.0)
from app.mim.evaluation import MIMEvaluator, get_evaluator

__all__ = [
    # ═══════════════════════════════════════════════════════════════════════════
    # V3.0 NEW EXPORTS (RECOMMENDED)
    # ═══════════════════════════════════════════════════════════════════════════
    
    # Taxonomy
    "ROOT_CAUSES",
    "SUBTYPES",
    "SUBTYPE_TO_ROOT_CAUSE",
    "OLD_TO_NEW_ROOT_CAUSE",
    "derive_failure_mechanism",
    
    # Features
    "DeltaFeatures",
    "compute_delta_features",
    "UserStateSnapshot",
    "build_user_state_snapshot",
    "CodeSignals",
    "extract_code_signals",
    
    # Schemas V3.0
    "MIMInput",
    "MIMOutput",
    "CorrectnessFeedback",
    "PerformanceFeedback",
    "ReinforcementFeedback",
    
    # Inference V3.0
    "MIMDecisionNode",
    "generate_correctness_feedback",
    "generate_performance_feedback",
    "generate_reinforcement_feedback",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # V2.0 LEGACY EXPORTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    # Constants
    "ROOT_CAUSE_CATEGORIES",
    
    # Core prediction schemas
    "MIMPrediction",
    "MIMRootCause", 
    "MIMReadiness",
    "MIMPerformanceForecast",
    "MIMCognitiveProfile",
    
    # V2.0 schemas
    "MIMDifficultyAdjustment",
    "MIMProblemRecommendation",
    "MIMRecommendations",
    "MIMModelMetrics",
    "MIMStatus",
    
    # Training schemas
    "MIMTrainingExample",
    "MIMLabelingTask",
    
    # Services
    "MIMModel",
    "get_mim_model",
    "MIMFeatureExtractor",
    
    # V2.0 services
    "MIMRecommender",
    "get_recommender",
    "MIMEvaluator",
    "get_evaluator",
]
