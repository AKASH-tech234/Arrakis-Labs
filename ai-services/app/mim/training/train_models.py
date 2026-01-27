"""
MIM V3.0 Model Training Pipeline
================================

PHASE 3: Model Retraining with Structural Guarantees

Model A — ROOT_CAUSE:
- 4 classes
- Inputs: delta features, is_cold_start, user state snapshot
- Loss: multiclass log loss
- Metric: macro F1 (NOT accuracy)

Model B — SUBTYPE (Masked):
- Critical: Apply root_cause mask at inference
- Invalid subtypes MUST have probability = 0
- Two implementations:
  1. One global model + mask logits
  2. One model per root_cause (cleaner, preferred)

Acceptance criteria:
- No illegal (root_cause, subtype) pair can be produced
- Subtype entropy decreases vs old model

Run with:
    python -m app.mim.training.train_v3_models --data ./data/mim_v3/mim_failure_transitions.parquet
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import (
    classification_report, 
    f1_score, 
    accuracy_score,
    log_loss,
)
from sklearn.preprocessing import LabelEncoder
import joblib

from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    SUBTYPES,
    is_valid_pair,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_DIR = Path("app/mim/models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Canonical ROOT_CAUSE classes (4 total)
ROOT_CAUSE_CLASSES = ["correctness", "efficiency", "implementation", "understanding_gap"]

# Feature columns for Model A (ROOT_CAUSE)
ROOT_CAUSE_FEATURES = [
    "delta_attempts_same_category",
    "delta_root_cause_repeat_rate",
    "delta_complexity_mismatch",
    "delta_time_to_accept",
    "delta_optimization_transition",
    "is_cold_start",
]

# Additional categorical features (will be encoded)
CATEGORICAL_FEATURES = ["category", "difficulty"]

# LightGBM hyperparameters for Model A
LGBM_PARAMS_MODEL_A = {
    "objective": "multiclass",
    "num_class": 4,  # 4 root causes
    "metric": "multi_logloss",
    "boosting_type": "gbdt",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.9,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "verbose": -1,
    "n_estimators": 300,
    "early_stopping_rounds": 30,
}


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL A: ROOT_CAUSE CLASSIFIER
# ═══════════════════════════════════════════════════════════════════════════════

class RootCauseModel:
    """
    Model A: ROOT_CAUSE classifier (4 classes).
    
    Inputs:
    - delta_* features
    - is_cold_start
    - category (encoded)
    - difficulty (encoded)
    
    Output:
    - One of 4 root_causes with confidence
    """
    
    def __init__(self):
        self.model = None
        self.label_encoder = LabelEncoder()
        self.category_encoder = LabelEncoder()
        self.difficulty_encoder = LabelEncoder()
        self.feature_names = []
        self.trained = False
    
    def train(
        self,
        df: pd.DataFrame,
        cv_folds: int = 5,
    ) -> Dict[str, Any]:
        """
        Train the root cause classifier.
        
        Parameters
        ----------
        df : pd.DataFrame
            Training data from mim_failure_transitions.parquet
        cv_folds : int
            Number of cross-validation folds
            
        Returns
        -------
        Dict with training metrics
        """
        try:
            import lightgbm as lgb
        except ImportError:
            logger.error("LightGBM required for training")
            raise
        
        logger.info("Training Model A: ROOT_CAUSE classifier")
        logger.info(f"Dataset size: {len(df)} samples")
        
        # Prepare features
        X, y = self._prepare_data(df)
        
        # Cross-validation
        cv_metrics = self._cross_validate(X, y, cv_folds)
        
        # Train final model on all data
        train_df = df[df["split"] == "train"]
        val_df = df[df["split"] == "val"]
        
        X_train, y_train = self._prepare_data(train_df)
        X_val, y_val = self._prepare_data(val_df)
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        self.model = lgb.train(
            LGBM_PARAMS_MODEL_A,
            train_data,
            valid_sets=[train_data, val_data],
            valid_names=["train", "val"],
        )
        
        self.trained = True
        
        # Final evaluation on test set
        test_df = df[df["split"] == "test"]
        if len(test_df) > 0:
            X_test, y_test = self._prepare_data(test_df)
            test_metrics = self._evaluate(X_test, y_test)
        else:
            test_metrics = {}
        
        return {
            "cv_metrics": cv_metrics,
            "test_metrics": test_metrics,
            "feature_importance": self._get_feature_importance(),
        }
    
    def _prepare_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features and labels."""
        # Delta features
        X_delta = df[ROOT_CAUSE_FEATURES].values
        
        # Encode categorical features (fit if not fitted yet)
        if not hasattr(self.category_encoder, 'classes_') or self.category_encoder.classes_ is None:
            self.category_encoder.fit(df["category"].fillna("unknown"))
            self.difficulty_encoder.fit(df["difficulty"].fillna("unknown"))
            self.label_encoder.fit(ROOT_CAUSE_CLASSES)
        
        cat_encoded = self.category_encoder.transform(
            df["category"].fillna("unknown")
        ).reshape(-1, 1)
        diff_encoded = self.difficulty_encoder.transform(
            df["difficulty"].fillna("unknown")
        ).reshape(-1, 1)
        
        # Combine features
        X = np.hstack([X_delta, cat_encoded, diff_encoded])
        self.feature_names = ROOT_CAUSE_FEATURES + ["category_encoded", "difficulty_encoded"]
        
        # Labels
        y = self.label_encoder.transform(df["root_cause"])
        
        return X, y
    
    def _cross_validate(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_folds: int,
    ) -> Dict[str, Any]:
        """Run stratified K-fold cross-validation."""
        import lightgbm as lgb
        
        skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
        
        macro_f1_scores = []
        log_losses = []
        
        for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            
            train_data = lgb.Dataset(X_train, label=y_train)
            val_data = lgb.Dataset(X_val, label=y_val)
            
            model = lgb.train(
                LGBM_PARAMS_MODEL_A,
                train_data,
                valid_sets=[val_data],
                valid_names=["val"],
            )
            
            y_pred = model.predict(X_val)
            y_pred_class = np.argmax(y_pred, axis=1)
            
            macro_f1 = f1_score(y_val, y_pred_class, average="macro")
            ll = log_loss(y_val, y_pred)
            
            macro_f1_scores.append(macro_f1)
            log_losses.append(ll)
            
            logger.info(f"Fold {fold+1}: macro_f1={macro_f1:.4f}, log_loss={ll:.4f}")
        
        return {
            "macro_f1_mean": np.mean(macro_f1_scores),
            "macro_f1_std": np.std(macro_f1_scores),
            "log_loss_mean": np.mean(log_losses),
            "log_loss_std": np.std(log_losses),
        }
    
    def _evaluate(
        self,
        X: np.ndarray,
        y: np.ndarray,
    ) -> Dict[str, Any]:
        """Evaluate on test set."""
        y_pred = self.model.predict(X)
        y_pred_class = np.argmax(y_pred, axis=1)
        
        return {
            "macro_f1": f1_score(y, y_pred_class, average="macro"),
            "accuracy": accuracy_score(y, y_pred_class),
            "log_loss": log_loss(y, y_pred),
            "classification_report": classification_report(
                y, y_pred_class,
                target_names=ROOT_CAUSE_CLASSES,
                output_dict=True,
            ),
        }
    
    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance."""
        if self.model is None:
            return {}
        
        importance = self.model.feature_importance(importance_type="gain")
        return dict(zip(self.feature_names, importance.tolist()))
    
    def predict(self, X: np.ndarray) -> Tuple[str, float]:
        """
        Predict root_cause.
        
        Returns (root_cause, confidence)
        """
        if not self.trained:
            raise RuntimeError("Model not trained")
        
        proba = self.model.predict(X.reshape(1, -1))[0]
        predicted_idx = np.argmax(proba)
        confidence = proba[predicted_idx]
        
        root_cause = self.label_encoder.inverse_transform([predicted_idx])[0]
        return root_cause, float(confidence)
    
    def save(self, path: Path):
        """Save model to disk."""
        joblib.dump({
            "model": self.model,
            "label_encoder": self.label_encoder,
            "category_encoder": self.category_encoder,
            "difficulty_encoder": self.difficulty_encoder,
            "feature_names": self.feature_names,
        }, path)
        logger.info(f"Model A saved to {path}")
    
    @classmethod
    def load(cls, path: Path) -> "RootCauseModel":
        """Load model from disk."""
        data = joblib.load(path)
        model = cls()
        model.model = data["model"]
        model.label_encoder = data["label_encoder"]
        model.category_encoder = data["category_encoder"]
        model.difficulty_encoder = data["difficulty_encoder"]
        model.feature_names = data["feature_names"]
        model.trained = True
        return model


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL B: MASKED SUBTYPE CLASSIFIER (Per Root-Cause)
# ═══════════════════════════════════════════════════════════════════════════════

class MaskedSubtypeModel:
    """
    Model B: SUBTYPE classifier with taxonomy masking.
    
    Implementation: One model per root_cause (cleaner approach).
    
    Critical requirement:
    - Apply root_cause mask at inference
    - Invalid subtypes MUST have probability = 0
    
    This ensures NO illegal (root_cause, subtype) pair can be produced.
    """
    
    def __init__(self):
        # One model per root_cause
        self.models: Dict[str, Any] = {}
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.trained = False
    
    def train(
        self,
        df: pd.DataFrame,
    ) -> Dict[str, Any]:
        """
        Train one subtype model per root_cause.
        
        Parameters
        ----------
        df : pd.DataFrame
            Training data from mim_failure_transitions.parquet
            
        Returns
        -------
        Dict with training metrics per root_cause
        """
        try:
            import lightgbm as lgb
        except ImportError:
            logger.error("LightGBM required for training")
            raise
        
        logger.info("Training Model B: Per-root-cause SUBTYPE classifiers")
        
        metrics = {}
        
        for root_cause, valid_subtypes in ROOT_CAUSE_TO_SUBTYPES.items():
            logger.info(f"\nTraining subtype model for root_cause='{root_cause}'")
            logger.info(f"Valid subtypes: {sorted(valid_subtypes)}")
            
            # Filter data for this root_cause
            root_df = df[df["root_cause"] == root_cause]
            
            if len(root_df) < 10:
                logger.warning(f"Insufficient data for {root_cause}: {len(root_df)} samples")
                continue
            
            # Train model
            model_metrics = self._train_single_model(
                root_cause=root_cause,
                df=root_df,
                valid_subtypes=list(valid_subtypes),
            )
            
            metrics[root_cause] = model_metrics
        
        self.trained = True
        return metrics
    
    def _train_single_model(
        self,
        root_cause: str,
        df: pd.DataFrame,
        valid_subtypes: List[str],
    ) -> Dict[str, Any]:
        """Train a single subtype model for one root_cause."""
        import lightgbm as lgb
        
        num_classes = len(valid_subtypes)
        logger.info(f"Training with {num_classes} classes: {valid_subtypes}")
        
        # Prepare features (same as root cause model)
        X = df[ROOT_CAUSE_FEATURES].values
        
        # Encode labels for THIS root_cause only
        label_encoder = LabelEncoder()
        label_encoder.fit(valid_subtypes)
        self.label_encoders[root_cause] = label_encoder
        
        # Filter to only valid subtypes
        valid_mask = df["subtype"].isin(valid_subtypes)
        df = df[valid_mask]
        X = df[ROOT_CAUSE_FEATURES].values
        y = label_encoder.transform(df["subtype"])
        
        logger.info(f"Training samples: {len(df)}")
        
        # Split
        train_mask = df["split"] == "train"
        val_mask = df["split"] == "val"
        
        X_train, y_train = X[train_mask.values], y[train_mask.values]
        X_val, y_val = X[val_mask.values], y[val_mask.values]
        
        # LightGBM params for this root_cause
        params = {
            "objective": "multiclass",
            "num_class": num_classes,
            "metric": "multi_logloss",
            "boosting_type": "gbdt",
            "num_leaves": 15,  # Smaller for fewer classes
            "learning_rate": 0.05,
            "feature_fraction": 0.9,
            "verbose": -1,
            "n_estimators": 200,
            "early_stopping_rounds": 20,
        }
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val)
        
        model = lgb.train(
            params,
            train_data,
            valid_sets=[val_data],
            valid_names=["val"],
        )
        
        self.models[root_cause] = model
        
        # Evaluate
        y_pred = model.predict(X_val)
        y_pred_class = np.argmax(y_pred, axis=1)
        
        return {
            "samples": len(df),
            "classes": valid_subtypes,
            "macro_f1": f1_score(y_val, y_pred_class, average="macro"),
            "accuracy": accuracy_score(y_val, y_pred_class),
        }
    
    def predict(
        self,
        root_cause: str,
        X: np.ndarray,
    ) -> Tuple[str, float]:
        """
        Predict subtype given root_cause.
        
        CRITICAL: Only valid subtypes for this root_cause are considered.
        Invalid subtypes have probability = 0 by design.
        
        Parameters
        ----------
        root_cause : str
            The predicted root_cause from Model A
        X : np.ndarray
            Feature vector
            
        Returns
        -------
        Tuple[str, float]
            (subtype, confidence)
        """
        if not self.trained:
            raise RuntimeError("Model not trained")
        
        if root_cause not in self.models:
            raise ValueError(f"No model for root_cause '{root_cause}'")
        
        model = self.models[root_cause]
        label_encoder = self.label_encoders[root_cause]
        
        proba = model.predict(X.reshape(1, -1))[0]
        predicted_idx = np.argmax(proba)
        confidence = proba[predicted_idx]
        
        subtype = label_encoder.inverse_transform([predicted_idx])[0]
        
        # SAFETY CHECK: Verify prediction is valid (should always be true)
        assert is_valid_pair(root_cause, subtype), (
            f"IMPOSSIBLE: Model B predicted invalid pair ({root_cause}, {subtype})"
        )
        
        return subtype, float(confidence)
    
    def save(self, path: Path):
        """Save all models to disk."""
        joblib.dump({
            "models": self.models,
            "label_encoders": self.label_encoders,
        }, path)
        logger.info(f"Model B saved to {path}")
    
    @classmethod
    def load(cls, path: Path) -> "MaskedSubtypeModel":
        """Load models from disk."""
        data = joblib.load(path)
        model = cls()
        model.models = data["models"]
        model.label_encoders = data["label_encoders"]
        model.trained = True
        return model


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def train_v3_models(
    data_path: str,
    output_dir: str = None,
) -> Dict[str, Any]:
    """
    Train both Model A and Model B.
    
    Parameters
    ----------
    data_path : str
        Path to mim_failure_transitions.parquet
    output_dir : str, optional
        Where to save models
        
    Returns
    -------
    Dict with training report
    """
    output_path = Path(output_dir) if output_dir else MODEL_DIR
    output_path.mkdir(parents=True, exist_ok=True)
    
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "data_path": data_path,
    }
    
    # Load data
    logger.info(f"Loading data from {data_path}")
    df = pd.read_parquet(data_path)
    report["total_samples"] = len(df)
    
    # Validate taxonomy before training
    invalid_taxonomy = []
    for idx, row in df.iterrows():
        if not is_valid_pair(row["root_cause"], row["subtype"]):
            invalid_taxonomy.append({
                "idx": idx,
                "root_cause": row["root_cause"],
                "subtype": row["subtype"],
            })
    
    if invalid_taxonomy:
        logger.error(f"Found {len(invalid_taxonomy)} invalid taxonomy pairs in training data!")
        report["invalid_taxonomy_samples"] = invalid_taxonomy[:20]
        return report
    
    # Train Model A: ROOT_CAUSE
    logger.info("\n" + "="*60)
    logger.info("TRAINING MODEL A: ROOT_CAUSE CLASSIFIER")
    logger.info("="*60)
    
    model_a = RootCauseModel()
    model_a_metrics = model_a.train(df)
    model_a.save(output_path / "model_a_root_cause.joblib")
    report["model_a"] = model_a_metrics
    
    # Train Model B: MASKED SUBTYPE
    logger.info("\n" + "="*60)
    logger.info("TRAINING MODEL B: MASKED SUBTYPE CLASSIFIERS")
    logger.info("="*60)
    
    model_b = MaskedSubtypeModel()
    model_b_metrics = model_b.train(df)
    model_b.save(output_path / "model_b_subtype.joblib")
    report["model_b"] = model_b_metrics
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("TRAINING COMPLETE")
    logger.info("="*60)
    
    logger.info(f"Model A (ROOT_CAUSE):")
    logger.info(f"  - CV Macro F1: {model_a_metrics['cv_metrics']['macro_f1_mean']:.4f} ± {model_a_metrics['cv_metrics']['macro_f1_std']:.4f}")
    if model_a_metrics.get('test_metrics'):
        logger.info(f"  - Test Macro F1: {model_a_metrics['test_metrics']['macro_f1']:.4f}")
    
    logger.info(f"\nModel B (SUBTYPE per root_cause):")
    for rc, metrics in model_b_metrics.items():
        logger.info(f"  - {rc}: Macro F1 = {metrics['macro_f1']:.4f}, Samples = {metrics['samples']}")
    
    # Save report
    report_path = output_path / f"training_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    logger.info(f"\nReport saved: {report_path}")
    
    return report


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="MIM V3.0 Model Training"
    )
    parser.add_argument(
        "--data", "-d",
        required=True,
        help="Path to mim_failure_transitions.parquet"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output directory for models"
    )
    
    args = parser.parse_args()
    
    report = train_v3_models(
        data_path=args.data,
        output_dir=args.output,
    )
    
    if report.get("model_a") and report.get("model_b"):
        print("\n✅ Model training successful!")
    else:
        print("\n❌ Model training failed!")


if __name__ == "__main__":
    main()
