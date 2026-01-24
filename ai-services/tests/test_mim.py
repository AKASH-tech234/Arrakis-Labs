"""
MIM Unit Tests
==============

Comprehensive test suite for the Mentat Intelligence Model (MIM).

Test Categories:
1. Feature Extraction - Vector generation from submissions
2. Model Training - Root cause classifier, readiness predictor
3. Inference - Real-time predictions
4. Recommender - Problem recommendation engine
5. Evaluation - Metrics and validation
6. Integration - End-to-end workflow

Run with: pytest tests/test_mim.py -v
"""

import pytest
import numpy as np
from datetime import datetime
from typing import Dict, List, Any
from unittest.mock import Mock, patch, MagicMock

# Import MIM components
from app.mim.schemas import (
    ROOT_CAUSE_CATEGORIES,
    MIMPrediction,
    MIMRootCause,
    MIMReadiness,
    MIMPerformanceForecast,
    MIMCognitiveProfile,
    MIMDifficultyAdjustment,
    MIMProblemRecommendation,
    MIMRecommendations,
    MIMModelMetrics,
    MIMStatus,
    MIMTrainingExample,
)

from app.mim.feature_extractor import MIMFeatureExtractor
from app.mim.model import MIMModel, ROOT_CAUSE_CATEGORIES as MODEL_ROOT_CAUSES


# ═══════════════════════════════════════════════════════════════════════════════
# TEST FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def sample_submission():
    """Create a sample submission context for testing."""
    return {
        "user_id": "test_user_001",
        "problem_id": "prob_123",
        "code": """
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(len(nums)):  # Bug: should be i+1
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
""",
        "verdict": "wrong_answer",
        "language": "python",
        "problem_title": "Two Sum",
        "problem_difficulty": "Easy",
        "problem_category": "arrays",
        "problem_description": "Given an array of integers, return indices of two numbers that add up to target.",
        "runtime_ms": 50,
        "memory_kb": 1024,
        "error_type": "WA",
        "error_message": "Output: [0, 0], Expected: [0, 1]",
        "created_at": datetime.now(),
    }


@pytest.fixture
def sample_user_history():
    """Create sample submission history for a user."""
    return [
        {
            "submission_id": f"sub_{i}",
            "problem_id": f"prob_{i}",
            "verdict": "accepted" if i % 3 == 0 else "wrong_answer",
            "problem_difficulty": ["Easy", "Medium", "Hard"][i % 3],
            "problem_category": ["arrays", "strings", "dp"][i % 3],
            "runtime_ms": 100 + i * 10,
            "created_at": datetime.now(),
        }
        for i in range(20)
    ]


@pytest.fixture
def sample_problems():
    """Create sample problems for recommendation testing."""
    return [
        {
            "problem_id": f"prob_{i}",
            "title": f"Problem {i}",
            "difficulty": ["Easy", "Medium", "Hard"][i % 3],
            "tags": [["arrays", "two-pointers"], ["dp", "recursion"], ["graphs", "bfs"]][i % 3],
            "success_rate": 0.3 + (i % 5) * 0.1,
        }
        for i in range(20)
    ]


@pytest.fixture
def feature_extractor():
    """Create a MIMFeatureExtractor instance."""
    return MIMFeatureExtractor()


@pytest.fixture
def mim_model():
    """Create a fresh MIMModel instance."""
    return MIMModel()


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMSchemas:
    """Test Pydantic schema definitions."""
    
    def test_root_cause_categories_count(self):
        """Verify we have 15 root cause categories (expanded)."""
        assert len(ROOT_CAUSE_CATEGORIES) == 16  # 15 + "unknown"
        assert "unknown" in ROOT_CAUSE_CATEGORIES
    
    def test_root_cause_categories_new_additions(self):
        """Verify new root cause categories are included."""
        new_categories = [
            "algorithm_choice",
            "edge_case_handling", 
            "input_parsing",
            "misread_problem",
            "partial_solution",
            "type_error",
        ]
        for cat in new_categories:
            assert cat in ROOT_CAUSE_CATEGORIES, f"Missing category: {cat}"
    
    def test_mim_root_cause_schema(self):
        """Test MIMRootCause schema validation."""
        root_cause = MIMRootCause(
            failure_cause="logic_error",
            confidence=0.85,
            alternatives=[
                {"cause": "boundary_condition_blindness", "confidence": 0.10},
                {"cause": "off_by_one_error", "confidence": 0.05},
            ]
        )
        assert root_cause.failure_cause == "logic_error"
        assert root_cause.confidence == 0.85
        assert len(root_cause.alternatives) == 2
    
    def test_mim_readiness_schema(self):
        """Test MIMReadiness schema validation."""
        readiness = MIMReadiness(
            current_level="Medium",
            easy_readiness=0.9,
            medium_readiness=0.6,
            hard_readiness=0.3,
            recommended_difficulty="Medium"
        )
        assert readiness.current_level == "Medium"
        assert readiness.recommended_difficulty == "Medium"
    
    def test_mim_difficulty_adjustment_schema(self):
        """Test MIMDifficultyAdjustment schema (new)."""
        adjustment = MIMDifficultyAdjustment(
            recommendation="increase",
            confidence=0.75,
            current_difficulty="Easy",
            suggested_difficulty="Medium",
            reasoning="User shows consistent success on Easy problems"
        )
        assert adjustment.recommendation == "increase"
        assert adjustment.current_difficulty == "Easy"
        assert adjustment.suggested_difficulty == "Medium"
    
    def test_mim_problem_recommendation_schema(self):
        """Test MIMProblemRecommendation schema (new)."""
        rec = MIMProblemRecommendation(
            problem_id="prob_123",
            title="Two Sum",
            difficulty="Easy",
            tags=["arrays", "hash-map"],
            success_probability=0.85,
            relevance_score=0.9,
            rank=1,
            reasoning="Matches user's current level and strengthens weak area"
        )
        assert rec.problem_id == "prob_123"
        assert rec.success_probability == 0.85
        assert rec.rank == 1
    
    def test_mim_recommendations_schema(self):
        """Test MIMRecommendations container schema (new)."""
        recs = MIMRecommendations(
            user_id="user_001",
            recommendations=[
                MIMProblemRecommendation(
                    problem_id="p1",
                    title="Problem 1",
                    difficulty="Easy",
                    success_probability=0.8,
                    relevance_score=0.9,
                    rank=1
                )
            ],
            focus_topics=["arrays"],
            avoid_topics=["graphs"],
            current_level="Easy+",
            target_difficulty="Medium"
        )
        assert recs.user_id == "user_001"
        assert len(recs.recommendations) == 1
        assert "arrays" in recs.focus_topics
    
    def test_mim_model_metrics_schema(self):
        """Test MIMModelMetrics schema (new)."""
        metrics = MIMModelMetrics(
            model_name="root_cause_v1",
            accuracy=0.85,
            f1_macro=0.78,
            f1_weighted=0.82,
            roc_auc=0.91,
            class_f1_scores={"logic_error": 0.9, "boundary_condition_blindness": 0.75},
            training_samples=1000,
            training_time_seconds=45.5
        )
        assert metrics.accuracy == 0.85
        assert metrics.roc_auc == 0.91
        assert metrics.training_samples == 1000
    
    def test_mim_status_schema(self):
        """Test MIMStatus schema (new)."""
        status = MIMStatus(
            is_trained=True,
            model_version="v1.0",
            model_health="healthy",
            total_predictions=5000,
            predictions_today=150
        )
        assert status.is_trained is True
        assert status.model_health == "healthy"
    
    def test_mim_prediction_to_agent_context(self):
        """Test MIMPrediction.to_agent_context() method."""
        prediction = MIMPrediction(
            root_cause=MIMRootCause(
                failure_cause="logic_error",
                confidence=0.85,
                alternatives=[]
            ),
            readiness=MIMReadiness(
                current_level="Medium",
                easy_readiness=0.9,
                medium_readiness=0.6,
                hard_readiness=0.3,
                recommended_difficulty="Medium"
            ),
            performance_forecast=MIMPerformanceForecast(
                expected_success_rate=0.65,
                plateau_risk=0.2,
                burnout_risk=0.1,
                learning_velocity="stable"
            ),
            similar_past_mistakes=["Array indexing issue", "Off-by-one in loop"],
            recommended_focus_areas=["Edge cases", "Loop boundaries"]
        )
        
        context = prediction.to_agent_context()
        
        assert "MIM INTELLIGENCE INSIGHTS" in context
        assert "logic_error" in context
        assert "Medium" in context
        assert "Array indexing issue" in context


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: FEATURE EXTRACTOR
# ═══════════════════════════════════════════════════════════════════════════════

class TestFeatureExtractor:
    """Test feature extraction from submissions."""
    
    def test_extract_features_returns_correct_dimensions(self, feature_extractor, sample_submission, sample_user_history):
        """Verify feature vector has expected dimensions (60)."""
        features = feature_extractor.extract(sample_submission, sample_user_history)
        
        assert features is not None
        assert len(features) == 60, f"Expected 60 features, got {len(features)}"
    
    def test_extract_features_values_are_normalized(self, feature_extractor, sample_submission, sample_user_history):
        """Verify feature values are within reasonable bounds."""
        features = feature_extractor.extract(sample_submission, sample_user_history)
        
        # Most features should be between 0 and 1 after normalization
        # Some like runtime_ratio may exceed 1
        assert all(-10 <= f <= 10 for f in features), "Features out of expected range"
    
    def test_extract_code_features(self, feature_extractor, sample_submission):
        """Test code-specific feature extraction."""
        code_features = feature_extractor._extract_code_features(sample_submission["code"])
        
        assert "loc" in code_features or len(code_features) > 0
    
    def test_extract_user_features(self, feature_extractor, sample_user_history):
        """Test user history feature extraction."""
        user_features = feature_extractor._extract_user_features(sample_user_history)
        
        # Should have metrics like success_rate, avg_attempts, etc.
        assert user_features is not None
    
    def test_extract_with_empty_history(self, feature_extractor, sample_submission):
        """Test extraction with no user history (cold start)."""
        features = feature_extractor.extract(sample_submission, [])
        
        assert features is not None
        assert len(features) == 60
        # Cold start features should use defaults
    
    def test_extract_with_missing_fields(self, feature_extractor):
        """Test extraction handles missing fields gracefully."""
        minimal_submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "print('hello')",
            "verdict": "wrong_answer",
        }
        
        features = feature_extractor.extract(minimal_submission, [])
        
        assert features is not None
        assert len(features) == 60


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: MIM MODEL
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMModel:
    """Test MIM ML model training and prediction."""
    
    def test_model_initialization(self, mim_model):
        """Test model initializes correctly."""
        assert mim_model is not None
        assert mim_model.is_fitted is False
        assert mim_model.model_version == "v1.0"
    
    def test_root_cause_categories_match_schemas(self):
        """Verify model ROOT_CAUSE_CATEGORIES matches schemas."""
        from app.mim.schemas import ROOT_CAUSE_CATEGORIES as SCHEMA_CATS
        
        assert MODEL_ROOT_CAUSES == SCHEMA_CATS
    
    def test_root_cause_categories_count(self):
        """Verify model has expanded to 15 categories."""
        assert len(MODEL_ROOT_CAUSES) == 16  # 15 + unknown
    
    def test_train_with_synthetic_data(self, mim_model):
        """Test model training with synthetic data."""
        # Generate synthetic training data
        np.random.seed(42)
        n_samples = 200
        n_features = 60
        
        X = np.random.randn(n_samples, n_features)
        # Use subset of root cause categories for labels
        labels = np.random.choice(MODEL_ROOT_CAUSES[:5], size=n_samples)
        
        # Train model
        mim_model.train(X, labels)
        
        assert mim_model.is_fitted is True
        assert mim_model.training_samples == n_samples
    
    def test_predict_root_cause(self, mim_model):
        """Test root cause prediction."""
        # First train the model
        np.random.seed(42)
        X_train = np.random.randn(200, 60)
        y_train = np.random.choice(MODEL_ROOT_CAUSES[:5], size=200)
        mim_model.train(X_train, y_train)
        
        # Now predict
        X_test = np.random.randn(1, 60)
        prediction = mim_model.predict_root_cause(X_test)
        
        assert prediction is not None
        assert "cause" in prediction
        assert "confidence" in prediction
        assert prediction["cause"] in MODEL_ROOT_CAUSES
        assert 0 <= prediction["confidence"] <= 1
    
    def test_predict_readiness(self, mim_model):
        """Test readiness prediction."""
        np.random.seed(42)
        X_train = np.random.randn(200, 60)
        y_train = np.random.choice(MODEL_ROOT_CAUSES[:5], size=200)
        mim_model.train(X_train, y_train)
        
        X_test = np.random.randn(1, 60)
        readiness = mim_model.predict_readiness(X_test)
        
        assert readiness is not None
        # Should have easy/medium/hard readiness scores
    
    def test_model_save_load(self, mim_model, tmp_path):
        """Test model serialization."""
        # Train model
        np.random.seed(42)
        X = np.random.randn(100, 60)
        y = np.random.choice(MODEL_ROOT_CAUSES[:3], size=100)
        mim_model.train(X, y)
        
        # Save
        save_path = tmp_path / "test_model"
        mim_model.save(str(save_path))
        
        # Load into new model
        new_model = MIMModel()
        new_model.load(str(save_path))
        
        assert new_model.is_fitted is True
        
        # Predictions should match
        X_test = np.random.randn(5, 60)
        pred1 = mim_model.predict_root_cause(X_test)
        pred2 = new_model.predict_root_cause(X_test)
        
        assert pred1["cause"] == pred2["cause"]


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: RECOMMENDER
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMRecommender:
    """Test problem recommendation engine."""
    
    def test_recommender_initialization(self):
        """Test recommender initializes correctly."""
        from app.mim.recommender import MIMRecommender
        
        recommender = MIMRecommender()
        assert recommender is not None
        assert recommender.is_trained is False
    
    def test_extract_recommendation_features(self):
        """Test feature extraction for user-problem pairs."""
        from app.mim.recommender import MIMRecommender
        
        recommender = MIMRecommender()
        
        user_profile = {
            "user_id": "user_001",
            "current_level": "Medium",
            "strengths": ["arrays"],
            "weak_topics": ["dp"],
            "success_rate": 0.6,
            "topic_success_rates": {"dp": 0.3, "arrays": 0.8},
            "current_streak": 3,
            "learning_velocity": "stable",
        }
        
        problem = {
            "problem_id": "prob_001",
            "difficulty": "Medium",
            "tags": ["dp", "recursion"],
            "acceptance_rate": 0.5,
            "attempt_count": 5000,
            "avg_attempts": 4,
        }
        
        user_history = [
            {"problem_id": "p1", "tags": ["arrays"], "created_at": datetime.now()}
        ]
        
        features = recommender.extract_features(user_profile, problem, user_history)
        
        assert features is not None
        assert len(features) == 13  # 13 recommendation features
    
    def test_fallback_recommendations(self, sample_problems):
        """Test rule-based fallback recommendations."""
        from app.mim.recommender import MIMRecommender
        
        recommender = MIMRecommender()
        
        user_profile = {
            "user_id": "user_001",
            "current_level": "Easy+",
            "weak_topics": ["arrays"],
            "strengths": ["strings"],
            "success_rate": 0.7,
        }
        
        recommendations = recommender._fallback_recommendations(
            user_profile=user_profile,
            problems=sample_problems,
            top_k=5
        )
        
        # Should return MIMRecommendations object
        assert recommendations is not None
    
    def test_train_recommender(self, sample_problems):
        """Test recommender training."""
        from app.mim.recommender import MIMRecommender
        
        recommender = MIMRecommender()
        
        # Generate synthetic training data matching expected format
        training_data = []
        for i in range(100):
            training_data.append({
                "user_profile": {
                    "user_id": f"user_{i % 10}",
                    "current_level": "Medium",
                    "success_rate": 0.5,
                },
                "problem": {
                    "problem_id": f"prob_{i % 20}",
                    "difficulty": "Medium",
                    "tags": ["arrays"],
                },
                "user_history": [],
                "label": 1 if i % 3 == 0 else 0,
            })
        
        # Train
        metrics = recommender.train(training_data)
        
        assert recommender.is_trained is True
        assert "accuracy" in metrics
    
    def test_recommend_with_trained_model(self, sample_problems):
        """Test recommendations from trained model."""
        from app.mim.recommender import MIMRecommender
        
        recommender = MIMRecommender()
        
        # Train with synthetic data
        training_data = []
        for i in range(100):
            training_data.append({
                "user_profile": {
                    "user_id": f"user_{i % 10}",
                    "current_level": "Medium",
                    "success_rate": 0.5,
                },
                "problem": {
                    "problem_id": f"prob_{i % 20}",
                    "difficulty": "Medium",
                    "tags": ["arrays"],
                },
                "user_history": [],
                "label": 1 if i % 3 == 0 else 0,
            })
        recommender.train(training_data)
        
        user_profile = {
            "user_id": "user_001",
            "current_level": "Medium",
            "weak_topics": ["dp"],
            "success_rate": 0.5,
        }
        
        recommendations = recommender.recommend(
            user_profile=user_profile,
            candidate_problems=sample_problems,
            user_history=[],
            top_k=5
        )
        
        # recommendations is MIMRecommendations object
        assert recommendations is not None
        assert len(recommendations.recommendations) <= 5


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: EVALUATOR
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMEvaluator:
    """Test model evaluation pipeline."""
    
    def test_evaluator_initialization(self):
        """Test evaluator initializes correctly."""
        from app.mim.evaluation import MIMEvaluator
        
        evaluator = MIMEvaluator()
        assert evaluator is not None
    
    def test_user_aware_split(self):
        """Test user-aware train/test split (no user leakage)."""
        from app.mim.evaluation import MIMEvaluator
        
        evaluator = MIMEvaluator()
        
        # Create data with multiple users
        data = []
        for user_id in range(10):
            for _ in range(20):
                data.append({
                    "user_id": f"user_{user_id}",
                    "features": np.random.randn(60).tolist(),
                    "label": "logic_error",
                })
        
        train, val, test = evaluator.user_aware_split(
            data,
            train_ratio=0.7,
            val_ratio=0.15,
            test_ratio=0.15
        )
        
        # Get user sets
        train_users = set(d["user_id"] for d in train)
        val_users = set(d["user_id"] for d in val)
        test_users = set(d["user_id"] for d in test)
        
        # Verify no user overlap (user-aware split)
        assert len(train_users & val_users) == 0, "User leakage: train/val overlap"
        assert len(train_users & test_users) == 0, "User leakage: train/test overlap"
        assert len(val_users & test_users) == 0, "User leakage: val/test overlap"
    
    def test_evaluate_root_cause(self):
        """Test root cause classifier evaluation."""
        from app.mim.evaluation import MIMEvaluator
        
        evaluator = MIMEvaluator()
        
        # Synthetic predictions (as numpy arrays)
        y_true = np.array(["logic_error", "logic_error", "boundary_condition_blindness", "off_by_one_error"])
        y_pred = np.array(["logic_error", "boundary_condition_blindness", "boundary_condition_blindness", "off_by_one_error"])
        y_proba = np.array([
            [0.8, 0.1, 0.1],
            [0.4, 0.5, 0.1],
            [0.1, 0.8, 0.1],
            [0.1, 0.1, 0.8],
        ])
        
        metrics = evaluator.evaluate_root_cause(y_true, y_pred, y_proba)
        
        assert "accuracy" in metrics
        assert "f1_macro" in metrics
        assert "f1_weighted" in metrics
        assert 0 <= metrics["accuracy"] <= 1
    
    def test_evaluate_recommendations(self):
        """Test recommendation metrics (Precision@K, NDCG@K, MRR)."""
        from app.mim.evaluation import MIMEvaluator
        
        evaluator = MIMEvaluator()
        
        # Synthetic recommendation results
        # Each user has a list of recommended items and ground truth relevant items
        recommendations = [
            {"user_id": "u1", "recommended": ["p1", "p2", "p3", "p4", "p5"], "relevant": ["p1", "p3"]},
            {"user_id": "u2", "recommended": ["p2", "p4", "p1", "p5", "p6"], "relevant": ["p1", "p6"]},
            {"user_id": "u3", "recommended": ["p3", "p1", "p2", "p4", "p5"], "relevant": ["p3"]},
        ]
        
        metrics = evaluator.evaluate_recommendations(recommendations, k_values=[1, 3, 5])
        
        assert "precision_at_1" in metrics
        assert "precision_at_3" in metrics
        assert "precision_at_5" in metrics
        assert "ndcg_at_5" in metrics
        assert "mrr" in metrics
        
        # Precision@1 for this data
        # u1: p1 in relevant -> 1, u2: p2 not in relevant -> 0, u3: p3 in relevant -> 1
        # avg = 2/3 ≈ 0.667
        assert metrics["precision_at_1"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: INFERENCE
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMInference:
    """Test MIM inference service."""
    
    def test_inference_initialization(self):
        """Test inference service initializes."""
        from app.mim.inference import MIMInference
        
        inference = MIMInference()
        assert inference is not None
    
    def test_predict_returns_mim_prediction(self, sample_submission, sample_user_history):
        """Test predict() returns MIMPrediction object."""
        from app.mim.inference import MIMInference
        
        inference = MIMInference()
        
        prediction = inference.predict(
            submission=sample_submission,
            user_history=sample_user_history
        )
        
        assert isinstance(prediction, MIMPrediction)
        assert prediction.root_cause is not None
        assert prediction.readiness is not None
        assert prediction.performance_forecast is not None
    
    def test_predict_cold_start(self, sample_submission):
        """Test prediction for user with no history (cold start)."""
        from app.mim.inference import MIMInference
        
        inference = MIMInference()
        
        prediction = inference.predict(
            submission=sample_submission,
            user_history=[]  # No history
        )
        
        assert isinstance(prediction, MIMPrediction)
        assert prediction.is_cold_start is True


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMIntegration:
    """End-to-end integration tests."""
    
    def test_full_pipeline(self, sample_submission, sample_user_history, sample_problems):
        """Test complete MIM pipeline: extract → predict → recommend."""
        from app.mim.feature_extractor import MIMFeatureExtractor
        from app.mim.inference import MIMInference
        from app.mim.recommender import MIMRecommender
        
        # 1. Feature extraction
        extractor = MIMFeatureExtractor()
        features = extractor.extract(sample_submission, sample_user_history)
        assert len(features) == 60
        
        # 2. Prediction
        inference = MIMInference()
        prediction = inference.predict(
            submission=sample_submission,
            user_history=sample_user_history
        )
        assert isinstance(prediction, MIMPrediction)
        
        # 3. Get recommendations
        recommender = MIMRecommender()
        user_profile = {
            "user_id": sample_submission["user_id"],
            "current_level": "Medium",
            "weak_topics": ["arrays"],
            "success_rate": 0.5,
        }
        recommendations = recommender._fallback_recommendations(
            user_profile=user_profile,
            problems=sample_problems,
            top_k=5
        )
        assert recommendations is not None
    
    def test_mim_imports_work(self):
        """Test all MIM module imports work correctly."""
        from app.mim import (
            ROOT_CAUSE_CATEGORIES,
            MIMPrediction,
            MIMRootCause,
            MIMReadiness,
            MIMDifficultyAdjustment,
            MIMProblemRecommendation,
            MIMRecommendations,
            MIMModelMetrics,
            MIMStatus,
            MIMInference,
            MIMModel,
            MIMFeatureExtractor,
            MIMRecommender,
            MIMEvaluator,
        )
        
        # All imports should succeed
        assert len(ROOT_CAUSE_CATEGORIES) == 16
        assert MIMPrediction is not None
        assert MIMInference is not None
        assert MIMRecommender is not None
        assert MIMEvaluator is not None
    
    @patch('app.db.mongodb.get_database')
    def test_api_endpoint_mim_status(self, mock_db):
        """Test /ai/mim/status endpoint structure."""
        from app.api.routes import get_mim_status
        
        # Mock the model
        with patch('app.mim.model.get_mim_model') as mock_model:
            mock_instance = MagicMock()
            mock_instance.is_fitted = True
            mock_instance.model_version = "v1.0"
            mock_instance.metrics = {"accuracy": 0.85}
            mock_instance.training_samples = 1000
            mock_instance.training_date = datetime.now()
            mock_model.return_value = mock_instance
            
            with patch('app.mim.recommender.get_recommender') as mock_rec:
                mock_rec_instance = MagicMock()
                mock_rec_instance.is_fitted = True
                mock_rec.return_value = mock_rec_instance
                
                result = get_mim_status()
                
                assert result["is_trained"] is True
                assert result["model_health"] == "healthy"


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMEdgeCases:
    """Test edge cases and error handling."""
    
    def test_empty_code_extraction(self, feature_extractor):
        """Test feature extraction with empty code."""
        submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "",
            "verdict": "compile_error",
        }
        
        features = feature_extractor.extract(submission, [])
        assert features is not None
        assert len(features) == 60
    
    def test_very_long_code_extraction(self, feature_extractor):
        """Test feature extraction with very long code."""
        submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "x = 1\n" * 10000,  # Very long code
            "verdict": "wrong_answer",
        }
        
        features = feature_extractor.extract(submission, [])
        assert features is not None
        assert len(features) == 60
    
    def test_unicode_code_extraction(self, feature_extractor):
        """Test feature extraction with unicode in code."""
        submission = {
            "user_id": "test",
            "problem_id": "p1",
            "code": "# Comment: こんにちは\nprint('Hello')",
            "verdict": "accepted",
        }
        
        features = feature_extractor.extract(submission, [])
        assert features is not None
        assert len(features) == 60
    
    def test_model_predict_before_train(self, mim_model):
        """Test prediction on untrained model returns graceful default."""
        X = np.random.randn(1, 60)
        
        # Should not raise, should return default prediction
        prediction = mim_model.predict_root_cause(X)
        
        # Untrained model should return "unknown" or similar
        assert prediction is not None
    
    def test_recommender_no_candidates(self):
        """Test recommender with no candidate problems."""
        from app.mim.recommender import MIMRecommender
        
        recommender = MIMRecommender()
        
        user_profile = {
            "user_id": "user_001",
            "current_level": "Medium",
        }
        
        recommendations = recommender._fallback_recommendations(
            user_profile=user_profile,
            problems=[],  # No candidates
            top_k=5
        )
        
        # Should return MIMRecommendations with empty list
        assert recommendations is not None
        assert len(recommendations.recommendations) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
