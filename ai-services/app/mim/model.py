"""
MIM Model - Machine Learning Models for Predictions
====================================================

V2.0: LightGBM-based models for better accuracy
- Root Cause Classifier: Predicts failure type (LightGBM multiclass)
- Readiness Classifier: Predicts success probability per difficulty (LightGBM binary)
- Performance Regressor: Forecasts future success rate (LightGBM regressor)

Model versioning and persistence handled via joblib.
Training: Batch only (online learning deferred to v3)
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import logging
import os
from datetime import datetime

# LightGBM for better accuracy with feature interactions
try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    
# Sklearn imports (fallback and utilities)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.calibration import CalibratedClassifierCV
import joblib

logger = logging.getLogger("mim.model")

# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
CURRENT_MODEL_VERSION = "v2.0"  # V2.0: LightGBM upgrade

# Ensure models directory exists
os.makedirs(MODEL_DIR, exist_ok=True)

# Root cause categories (must match feature_extractor and schemas)
# V2.0: Expanded to 15 categories per ML requirements
ROOT_CAUSE_CATEGORIES = [
    # Original 9
    "boundary_condition_blindness",   # Edge cases, empty inputs, n=1
    "off_by_one_error",               # Loop bounds, array indexing
    "integer_overflow",               # Large inputs causing overflow
    "wrong_data_structure",           # Suboptimal DS choice
    "logic_error",                    # Incorrect algorithm logic
    "time_complexity_issue",          # Inefficient approach causing TLE
    "recursion_issue",                # Stack overflow, missing base case
    "comparison_error",               # Wrong operators, floating point issues
    # New 6 (per requirements)
    "algorithm_choice",               # Wrong algorithm selected entirely
    "edge_case_handling",             # Specific edge case handling issues
    "input_parsing",                  # Failed to parse input correctly
    "misread_problem",                # Misunderstood problem statement
    "partial_solution",               # Solution is incomplete
    "type_error",                     # Type conversion/casting issues
    # Default
    "unknown",                        # Could not classify with confidence
]

# Readiness levels
READINESS_LEVELS = ["Beginner", "Easy", "Easy+", "Medium", "Medium+", "Hard", "Hard+", "Expert"]


class MIMModel:
    """
    MIM Machine Learning Model.
    
    Combines multiple specialized models:
    1. Root Cause Classifier - Predicts failure category
    2. Readiness Model - Predicts success probability per difficulty
    3. Performance Forecaster - Predicts future success rate
    
    Usage:
        model = MIMModel()
        model.load()  # Load trained model
        
        root_cause = model.predict_root_cause(features)
        readiness = model.predict_readiness(features)
        forecast = model.predict_performance(features)
    """
    
    def __init__(self):
        """Initialize model components."""
        # Models
        self.root_cause_model: Optional[CalibratedClassifierCV] = None
        self.readiness_model: Optional[GradientBoostingClassifier] = None
        self.performance_model: Optional[LogisticRegression] = None
        
        # Preprocessing
        self.scaler: Optional[StandardScaler] = None
        self.label_encoder: Optional[LabelEncoder] = None
        
        # Metadata
        self.model_version = CURRENT_MODEL_VERSION
        self.is_fitted = False
        self.training_date: Optional[datetime] = None
        self.training_samples: int = 0
        
        # Performance metrics
        self.metrics: Dict[str, float] = {}
        
        logger.info(f"MIM Model initialized | version={self.model_version}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MODEL INITIALIZATION (Default untrained models)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _initialize_models(self):
        """Initialize fresh model instances with LightGBM (or sklearn fallback)."""
        
        if LIGHTGBM_AVAILABLE:
            logger.info("Using LightGBM models for better accuracy")
            
            # Root cause classifier (LightGBM multiclass)
            # LightGBM handles feature interactions better than RandomForest
            self.root_cause_model = lgb.LGBMClassifier(
                objective='multiclass',
                num_class=len(ROOT_CAUSE_CATEGORIES),
                n_estimators=300,          # More trees for better accuracy
                max_depth=10,              # Prevent overfitting
                num_leaves=31,             # Default, good balance
                learning_rate=0.05,        # Lower rate, more stable
                min_child_samples=20,      # Minimum samples per leaf
                subsample=0.8,             # Stochastic gradient boosting
                colsample_bytree=0.8,      # Feature subsampling
                reg_alpha=0.1,             # L1 regularization
                reg_lambda=0.1,            # L2 regularization
                class_weight='balanced',   # Handle imbalanced classes
                random_state=42,
                n_jobs=-1,
                verbose=-1,                # Suppress warnings
            )
            
            # Readiness model (LightGBM binary classifier)
            self.readiness_model = lgb.LGBMClassifier(
                objective='binary',
                n_estimators=200,
                max_depth=8,
                num_leaves=31,
                learning_rate=0.05,
                min_child_samples=20,
                subsample=0.8,
                colsample_bytree=0.8,
                reg_alpha=0.1,
                reg_lambda=0.1,
                class_weight='balanced',
                random_state=42,
                n_jobs=-1,
                verbose=-1,
            )
            
            # Performance forecaster (LightGBM binary for probability)
            self.performance_model = lgb.LGBMClassifier(
                objective='binary',
                n_estimators=150,
                max_depth=6,
                num_leaves=31,
                learning_rate=0.05,
                min_child_samples=20,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                n_jobs=-1,
                verbose=-1,
            )
        else:
            logger.warning("LightGBM not available, falling back to sklearn models")
            
            # Fallback: Root cause classifier (calibrated for better probabilities)
            base_rf = RandomForestClassifier(
                n_estimators=200,
                max_depth=15,
                min_samples_split=3,
                min_samples_leaf=1,
                max_features='sqrt',
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            )
            self.root_cause_model = CalibratedClassifierCV(
                base_rf,
                method="sigmoid",
                cv=5,
            )
            
            # Readiness model (gradient boosting)
            self.readiness_model = GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.05,
                max_depth=6,
                min_samples_split=5,
                min_samples_leaf=2,
                subsample=0.8,
                random_state=42,
            )
            
            # Performance forecaster
            self.performance_model = LogisticRegression(
                max_iter=2000,
                C=0.5,
                class_weight="balanced",
                solver='lbfgs',
                random_state=42,
            )
        
        # Scaler (StandardScaler for numerical stability)
        self.scaler = StandardScaler()
        
        # Label encoder for root causes
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(ROOT_CAUSE_CATEGORIES)
        
        logger.debug(f"Models initialized | LightGBM={LIGHTGBM_AVAILABLE}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TRAINING
    # ═══════════════════════════════════════════════════════════════════════════
    
    def fit(
        self,
        X: np.ndarray,
        y_root_cause: np.ndarray,
        y_success: np.ndarray,
        y_readiness: Optional[np.ndarray] = None,
    ) -> Dict[str, float]:
        """
        Train all MIM models.
        
        Args:
            X: Feature matrix of shape (n_samples, 60)
            y_root_cause: Root cause labels (strings)
            y_success: Binary success labels (0/1)
            y_readiness: Optional readiness labels ("Easy"/"Medium"/"Hard")
            
        Returns:
            Dictionary of training metrics
        """
        import warnings
        
        logger.info(f"Starting MIM training | samples={len(X)}")
        
        self._initialize_models()
        
        # Ensure X is numpy array without feature names
        if hasattr(X, 'values'):
            X = X.values
        X = np.asarray(X)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Encode root cause labels
        y_root_encoded = self.label_encoder.transform(y_root_cause)
        
        # Suppress sklearn feature name warnings during training
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*feature names.*")
            
            # Train root cause model
            logger.debug("Training root cause classifier...")
            self.root_cause_model.fit(X_scaled, y_root_encoded)
            
            # Train readiness model (predict success on different difficulties)
            logger.debug("Training readiness model...")
            self.readiness_model.fit(X_scaled, y_success)
            
            # Train performance model
            logger.debug("Training performance forecaster...")
            self.performance_model.fit(X_scaled, y_success)
        
        self.is_fitted = True
        self.training_date = datetime.now()
        self.training_samples = len(X)
        
        # Calculate training metrics
        self.metrics = self._evaluate(X_scaled, y_root_encoded, y_success)
        
        logger.info(f"Training complete | accuracy={self.metrics.get('root_cause_accuracy', 0):.2%}")
        
        return self.metrics
    
    def _evaluate(
        self,
        X: np.ndarray,
        y_root: np.ndarray,
        y_success: np.ndarray,
    ) -> Dict[str, float]:
        """Evaluate model performance on training data."""
        from sklearn.metrics import accuracy_score, f1_score
        
        metrics = {}
        
        # Root cause accuracy
        y_root_pred = self.root_cause_model.predict(X)
        metrics["root_cause_accuracy"] = accuracy_score(y_root, y_root_pred)
        metrics["root_cause_f1"] = f1_score(y_root, y_root_pred, average="weighted")
        
        # Readiness accuracy
        y_readiness_pred = self.readiness_model.predict(X)
        metrics["readiness_accuracy"] = accuracy_score(y_success, y_readiness_pred)
        
        # Performance accuracy
        y_perf_pred = self.performance_model.predict(X)
        metrics["performance_accuracy"] = accuracy_score(y_success, y_perf_pred)
        
        return metrics
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PREDICTION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def predict_root_cause(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Predict the most likely failure root cause.
        
        Args:
            features: Feature vector of shape (60,) or (1, 60)
            
        Returns:
            {
                "failure_cause": "boundary_condition_blindness",
                "confidence": 0.81,
                "alternatives": [{"cause": "...", "confidence": 0.15}, ...]
            }
        """
        import warnings
        
        if not self.is_fitted:
            return self._fallback_root_cause(features)
        
        # Reshape if needed
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Ensure numpy array
        features = np.asarray(features)
        
        # Scale
        features_scaled = self.scaler.transform(features)
        
        # Suppress sklearn feature name warnings during prediction
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*feature names.*")
            
            # Get probabilities
            probas = self.root_cause_model.predict_proba(features_scaled)[0]
        
        classes = self.label_encoder.classes_
        
        # Get top prediction
        top_idx = np.argmax(probas)
        top_cause = classes[top_idx]
        top_confidence = float(probas[top_idx])
        
        # Get alternatives (top 3 excluding the main prediction)
        sorted_indices = np.argsort(probas)[::-1]
        alternatives = []
        for idx in sorted_indices[1:4]:  # Skip top, get next 3
            alternatives.append({
                "cause": classes[idx],
                "confidence": float(probas[idx])
            })
        
        return {
            "failure_cause": top_cause,
            "confidence": top_confidence,
            "alternatives": alternatives,
        }
    
    def predict_readiness(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Predict user's readiness for different difficulty levels.
        
        Args:
            features: Feature vector of shape (60,) or (1, 60)
            
        Returns:
            {
                "current_level": "Medium+",
                "easy_readiness": 0.85,
                "medium_readiness": 0.63,
                "hard_readiness": 0.35,
                "recommended_difficulty": "Medium"
            }
        """
        import warnings
        
        if not self.is_fitted:
            return self._fallback_readiness(features)
        
        # Reshape if needed
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Ensure numpy array
        features = np.asarray(features)
        
        # Scale
        features_scaled = self.scaler.transform(features)
        
        # Suppress sklearn feature name warnings during prediction
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*feature names.*")
            
            # Get base success probability
            base_prob = self.readiness_model.predict_proba(features_scaled)[0][1]
        
        # Adjust for different difficulties (heuristic multipliers)
        easy_readiness = min(base_prob * 1.3, 0.95)
        medium_readiness = base_prob
        hard_readiness = max(base_prob * 0.6, 0.1)
        
        # Determine current level
        if easy_readiness >= 0.9 and medium_readiness >= 0.7:
            current_level = "Hard" if hard_readiness >= 0.5 else "Medium+"
        elif medium_readiness >= 0.6:
            current_level = "Medium" if medium_readiness >= 0.7 else "Easy+"
        elif easy_readiness >= 0.7:
            current_level = "Easy"
        else:
            current_level = "Beginner"
        
        # Recommend difficulty (zone of proximal development)
        # Target ~60-70% success probability
        if hard_readiness >= 0.55:
            recommended = "Hard"
        elif medium_readiness >= 0.55:
            recommended = "Medium"
        else:
            recommended = "Easy"
        
        return {
            "current_level": current_level,
            "easy_readiness": float(easy_readiness),
            "medium_readiness": float(medium_readiness),
            "hard_readiness": float(hard_readiness),
            "recommended_difficulty": recommended,
        }
    
    def predict_performance(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Forecast performance over next submissions.
        
        Args:
            features: Feature vector of shape (60,) or (1, 60)
            
        Returns:
            {
                "expected_success_rate": 0.72,
                "plateau_risk": 0.19,
                "burnout_risk": 0.12,
                "learning_velocity": "stable"
            }
        """
        import warnings
        
        if not self.is_fitted:
            return self._fallback_performance(features)
        
        # Reshape if needed
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Scale
        features_scaled = self.scaler.transform(features)
        
        # Suppress sklearn feature name warnings during prediction
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*feature names.*")
            
            # Get success probability
            success_prob = self.performance_model.predict_proba(features_scaled)[0][1]
        
        # Calculate risk metrics from features
        # Feature indices: 55=success_rate_7d, 56=success_rate_30d, 52=submission_velocity_24h
        recent_success = features[0, 55] if features.shape[1] > 55 else 0.5
        monthly_success = features[0, 56] if features.shape[1] > 56 else 0.5
        velocity = features[0, 50] if features.shape[1] > 50 else 0.3
        
        # Plateau risk: high when recent == monthly (no improvement)
        plateau_risk = 1.0 - abs(recent_success - monthly_success)
        plateau_risk = max(0.0, min(plateau_risk - 0.3, 0.8))  # Normalize
        
        # Burnout risk: high velocity + low success
        burnout_risk = velocity * (1.0 - recent_success)
        burnout_risk = max(0.0, min(burnout_risk, 0.8))
        
        # Learning velocity
        improvement = recent_success - monthly_success
        if improvement > 0.1:
            velocity_label = "accelerating"
        elif improvement > -0.05:
            velocity_label = "stable"
        elif improvement > -0.15:
            velocity_label = "decelerating"
        else:
            velocity_label = "stalled"
        
        return {
            "expected_success_rate": float(success_prob),
            "plateau_risk": float(plateau_risk),
            "burnout_risk": float(burnout_risk),
            "learning_velocity": velocity_label,
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FALLBACK PREDICTIONS (When model not trained)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _fallback_root_cause(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Rule-based fallback when model isn't trained.
        
        Uses feature heuristics to guess root cause.
        """
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Extract key features
        verdict = features[0, 0]  # verdict_encoded
        has_boundary = features[0, 3] if features.shape[1] > 3 else 0  # has_boundary_pattern
        has_overflow = features[0, 17] if features.shape[1] > 17 else 0  # has_overflow_pattern
        nested_loops = features[0, 27] if features.shape[1] > 27 else 0  # nested_loop_depth
        
        # Simple heuristics
        if verdict == -0.3:  # TLE
            cause = "time_complexity_issue"
            confidence = 0.6
        elif has_overflow > 0.5:
            cause = "integer_overflow"
            confidence = 0.5
        elif has_boundary < 0.3:  # No boundary checks
            cause = "boundary_condition_blindness"
            confidence = 0.5
        elif nested_loops > 0.5:
            cause = "time_complexity_issue"
            confidence = 0.4
        else:
            cause = "logic_error"
            confidence = 0.3
        
        return {
            "failure_cause": cause,
            "confidence": confidence,
            "alternatives": [{"cause": "unknown", "confidence": 0.2}],
        }
    
    def _fallback_readiness(self, features: np.ndarray) -> Dict[str, Any]:
        """Rule-based fallback for readiness prediction."""
        # Use historical success rate if available
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        success_rate = features[0, 55] if features.shape[1] > 55 else 0.5
        
        return {
            "current_level": "Medium" if success_rate >= 0.5 else "Easy",
            "easy_readiness": min(success_rate + 0.2, 0.9),
            "medium_readiness": success_rate,
            "hard_readiness": max(success_rate - 0.2, 0.1),
            "recommended_difficulty": "Medium" if success_rate >= 0.6 else "Easy",
        }
    
    def _fallback_performance(self, features: np.ndarray) -> Dict[str, Any]:
        """Rule-based fallback for performance prediction."""
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        success_rate = features[0, 55] if features.shape[1] > 55 else 0.5
        
        return {
            "expected_success_rate": success_rate,
            "plateau_risk": 0.3,
            "burnout_risk": 0.2,
            "learning_velocity": "stable",
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PERSISTENCE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def save(self, path: Optional[str] = None) -> str:
        """
        Save trained model to disk.
        
        Args:
            path: Optional custom path. Default uses MODEL_DIR with timestamp.
            
        Returns:
            Path where model was saved.
        """
        if path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = os.path.join(MODEL_DIR, f"mim_model_{timestamp}.pkl")
        
        model_data = {
            "root_cause_model": self.root_cause_model,
            "readiness_model": self.readiness_model,
            "performance_model": self.performance_model,
            "scaler": self.scaler,
            "label_encoder": self.label_encoder,
            "model_version": self.model_version,
            "is_fitted": self.is_fitted,
            "training_date": self.training_date,
            "training_samples": self.training_samples,
            "metrics": self.metrics,
        }
        
        joblib.dump(model_data, path)
        logger.info(f"Model saved to {path}")
        
        # Also save as "latest"
        latest_path = os.path.join(MODEL_DIR, "mim_model_latest.pkl")
        joblib.dump(model_data, latest_path)
        
        return path
    
    def load(self, path: Optional[str] = None) -> bool:
        """
        Load trained model from disk.
        
        Args:
            path: Optional custom path. Default loads "latest" model.
            
        Returns:
            True if loaded successfully, False otherwise.
        """
        # First try the legacy single-file format
        if path is None:
            path = os.path.join(MODEL_DIR, "mim_model_latest.pkl")
        
        if os.path.exists(path):
            try:
                model_data = joblib.load(path)
                
                self.root_cause_model = model_data["root_cause_model"]
                self.readiness_model = model_data["readiness_model"]
                self.performance_model = model_data["performance_model"]
                self.scaler = model_data["scaler"]
                self.label_encoder = model_data["label_encoder"]
                self.model_version = model_data.get("model_version", "unknown")
                self.is_fitted = model_data.get("is_fitted", True)
                self.training_date = model_data.get("training_date")
                self.training_samples = model_data.get("training_samples", 0)
                self.metrics = model_data.get("metrics", {})
                
                logger.info(f"Model loaded from {path} | version={self.model_version} | samples={self.training_samples}")
                return True
            except Exception as e:
                logger.warning(f"Failed to load legacy format: {e}")
        
        # Try loading individual model files (new format from train_mim_models.py)
        try:
            root_cause_path = os.path.join(MODEL_DIR, "root_cause_classifier.joblib")
            readiness_path = os.path.join(MODEL_DIR, "readiness_model.joblib")
            performance_path = os.path.join(MODEL_DIR, "performance_forecaster.joblib")
            label_encoder_path = os.path.join(MODEL_DIR, "label_encoder.joblib")
            scaler_path = os.path.join(MODEL_DIR, "scaler.joblib")  # ✨ NEW: Load scaler
            metadata_path = os.path.join(MODEL_DIR, "metadata.json")
            
            if os.path.exists(root_cause_path):
                self.root_cause_model = joblib.load(root_cause_path)
                logger.info(f"Loaded root_cause_classifier from {root_cause_path}")
            
            if os.path.exists(readiness_path):
                self.readiness_model = joblib.load(readiness_path)
                logger.info(f"Loaded readiness_model from {readiness_path}")
            
            if os.path.exists(performance_path):
                self.performance_model = joblib.load(performance_path)
                logger.info(f"Loaded performance_forecaster from {performance_path}")
            
            if os.path.exists(label_encoder_path):
                self.label_encoder = joblib.load(label_encoder_path)
                logger.info(f"Loaded label_encoder from {label_encoder_path}")
            
            # ✨ NEW: Load scaler (CRITICAL for inference!)
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                logger.info(f"Loaded scaler from {scaler_path}")
            else:
                # Fallback: Initialize a default scaler (will be less accurate)
                from sklearn.preprocessing import StandardScaler
                self.scaler = StandardScaler()
                self.scaler.mean_ = np.zeros(60)  # Default mean
                self.scaler.scale_ = np.ones(60)  # Default scale (no scaling)
                logger.warning(f"⚠️ scaler.joblib not found, using identity scaler (retrain models!)")
            
            # Load metadata
            if os.path.exists(metadata_path):
                import json
                with open(metadata_path) as f:
                    metadata = json.load(f)
                self.model_version = metadata.get("version", "v1.0")
                self.training_date = datetime.fromisoformat(metadata["trained_at"]) if "trained_at" in metadata else None
                self.training_samples = metadata.get("training_samples", 0)
                self.metrics = metadata.get("metrics", {})
            
            # Check if at least root cause model is loaded
            if self.root_cause_model is not None:
                self.is_fitted = True
                logger.info(f"MIM Model loaded successfully from individual files")
                return True
            else:
                logger.warning("No model files found - using untrained model")
                self._initialize_models()
                return False
                
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self._initialize_models()
            return False
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model metadata for logging/debugging."""
        return {
            "version": self.model_version,
            "is_fitted": self.is_fitted,
            "training_date": self.training_date.isoformat() if self.training_date else None,
            "training_samples": self.training_samples,
            "metrics": self.metrics,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON ACCESSOR
# ═══════════════════════════════════════════════════════════════════════════════

_mim_model_instance: Optional[MIMModel] = None


def get_mim_model() -> MIMModel:
    """
    Get the singleton MIMModel instance.
    
    Lazily initializes and loads the trained model on first call.
    
    Returns:
        MIMModel: The singleton model instance
    """
    global _mim_model_instance
    
    if _mim_model_instance is None:
        _mim_model_instance = MIMModel()
        _mim_model_instance.load()
    
    return _mim_model_instance
