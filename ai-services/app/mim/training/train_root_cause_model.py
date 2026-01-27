"""
Root Cause Model Training
=========================

Trains Model A: ROOT_CAUSE classifier (4 classes).

Uses LightGBM for:
- Tabular data with deltas
- Small/medium data
- Fast iteration
- Interpretable feature importance
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import classification_report, f1_score, accuracy_score
import joblib

logger = logging.getLogger(__name__)

# Try to import LightGBM
try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    logger.warning("LightGBM not available, falling back to sklearn")

from app.mim.taxonomy.root_causes import ROOT_CAUSES


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_DIR = Path("app/mim/models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Feature columns for root cause model
ROOT_CAUSE_FEATURES = [
    "delta_attempts_same_category",
    "delta_root_cause_repeat_rate",
    "delta_complexity_mismatch",
    "delta_time_to_accept",
    "delta_optimization_transition",
    "is_cold_start",
]

# Additional encoded features
ENCODED_FEATURES = [
    "category_encoded",
    "difficulty_encoded",
]

# LightGBM hyperparameters (tuned for small datasets)
LGBM_PARAMS = {
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
    "n_estimators": 200,
    "early_stopping_rounds": 20,
}


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def train_root_cause_model(
    data_path: str,
    output_dir: Optional[str] = None,
    cross_validate: bool = True,
) -> Dict[str, Any]:
    """
    Train ROOT_CAUSE classifier (Model A).
    
    Parameters
    ----------
    data_path : str
        Path to mim_failure_transitions.parquet
    output_dir : str, optional
        Where to save model (default: app/mim/models)
    cross_validate : bool
        Whether to run cross-validation
        
    Returns
    -------
    Dict[str, Any]
        Training results including metrics
    """
    
    output_dir = Path(output_dir) if output_dir else MODEL_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Loading data from {data_path}")
    df = pd.read_parquet(data_path)
    
    # Validate taxonomy
    invalid_root_causes = df[~df["root_cause"].isin(ROOT_CAUSES)]
    if len(invalid_root_causes) > 0:
        logger.warning(f"Found {len(invalid_root_causes)} invalid root causes, filtering")
        df = df[df["root_cause"].isin(ROOT_CAUSES)]
    
    logger.info(f"Dataset: {len(df)} samples")
    logger.info(f"Root cause distribution:\n{df['root_cause'].value_counts()}")
    
    # Prepare features
    df = _encode_features(df)
    feature_cols = ROOT_CAUSE_FEATURES + ENCODED_FEATURES
    
    # Split by pre-computed split column (time-ordered)
    train_df = df[df["split"] == "train"]
    val_df = df[df["split"] == "val"]
    test_df = df[df["split"] == "test"]
    
    logger.info(f"Split: train={len(train_df)}, val={len(val_df)}, test={len(test_df)}")
    
    X_train = train_df[feature_cols].values
    y_train = _encode_labels(train_df["root_cause"])
    
    X_val = val_df[feature_cols].values
    y_val = _encode_labels(val_df["root_cause"])
    
    X_test = test_df[feature_cols].values
    y_test = _encode_labels(test_df["root_cause"])
    
    # Train model
    if LIGHTGBM_AVAILABLE:
        model, metrics = _train_lightgbm(
            X_train, y_train, X_val, y_val, X_test, y_test, feature_cols
        )
    else:
        model, metrics = _train_sklearn(
            X_train, y_train, X_val, y_val, X_test, y_test
        )
    
    # Cross-validation (on train set)
    if cross_validate and len(train_df) > 50:
        cv_scores = _cross_validate(X_train, y_train)
        metrics["cv_f1_mean"] = np.mean(cv_scores)
        metrics["cv_f1_std"] = np.std(cv_scores)
        logger.info(f"Cross-validation F1: {metrics['cv_f1_mean']:.3f} ± {metrics['cv_f1_std']:.3f}")
    
    # Save model
    model_path = output_dir / "root_cause_model.joblib"
    joblib.dump(model, model_path)
    logger.info(f"Model saved to {model_path}")
    
    # Save metadata
    metadata = {
        "model_type": "lightgbm" if LIGHTGBM_AVAILABLE else "sklearn",
        "feature_cols": feature_cols,
        "label_mapping": _get_label_mapping(),
        "metrics": metrics,
        "train_samples": len(train_df),
        "val_samples": len(val_df),
        "test_samples": len(test_df),
    }
    
    metadata_path = output_dir / "root_cause_model_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    return metadata


def _train_lightgbm(
    X_train, y_train, X_val, y_val, X_test, y_test, feature_names
) -> Tuple[Any, Dict]:
    """Train LightGBM classifier."""
    
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
    
    model = lgb.train(
        LGBM_PARAMS,
        train_data,
        valid_sets=[train_data, val_data],
        valid_names=["train", "val"],
        feature_name=feature_names,
    )
    
    # Evaluate
    y_pred = np.argmax(model.predict(X_test), axis=1)
    
    metrics = {
        "test_accuracy": accuracy_score(y_test, y_pred),
        "test_f1_macro": f1_score(y_test, y_pred, average="macro"),
        "test_f1_weighted": f1_score(y_test, y_pred, average="weighted"),
    }
    
    logger.info(f"Test accuracy: {metrics['test_accuracy']:.3f}")
    logger.info(f"Test F1 (macro): {metrics['test_f1_macro']:.3f}")
    
    # Feature importance
    importance = dict(zip(feature_names, model.feature_importance()))
    metrics["feature_importance"] = importance
    logger.info(f"Feature importance: {importance}")
    
    return model, metrics


def _train_sklearn(
    X_train, y_train, X_val, y_val, X_test, y_test
) -> Tuple[Any, Dict]:
    """Fallback: train sklearn GradientBoosting."""
    
    from sklearn.ensemble import GradientBoostingClassifier
    
    model = GradientBoostingClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        random_state=42,
    )
    
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    
    metrics = {
        "test_accuracy": accuracy_score(y_test, y_pred),
        "test_f1_macro": f1_score(y_test, y_pred, average="macro"),
        "test_f1_weighted": f1_score(y_test, y_pred, average="weighted"),
    }
    
    return model, metrics


def _cross_validate(X, y, n_splits=5) -> list:
    """Run stratified k-fold cross-validation."""
    
    from sklearn.ensemble import GradientBoostingClassifier
    
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    scores = []
    
    for train_idx, val_idx in skf.split(X, y):
        X_train_cv, X_val_cv = X[train_idx], X[val_idx]
        y_train_cv, y_val_cv = y[train_idx], y[val_idx]
        
        if LIGHTGBM_AVAILABLE:
            train_data = lgb.Dataset(X_train_cv, label=y_train_cv)
            val_data = lgb.Dataset(X_val_cv, label=y_val_cv)
            model = lgb.train(LGBM_PARAMS, train_data, valid_sets=[val_data])
            y_pred = np.argmax(model.predict(X_val_cv), axis=1)
        else:
            model = GradientBoostingClassifier(n_estimators=50, random_state=42)
            model.fit(X_train_cv, y_train_cv)
            y_pred = model.predict(X_val_cv)
        
        scores.append(f1_score(y_val_cv, y_pred, average="macro"))
    
    return scores


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _encode_features(df: pd.DataFrame) -> pd.DataFrame:
    """Encode categorical features."""
    
    # Category encoding
    category_map = {
        "arrays": 0, "array": 0,
        "strings": 1, "string": 1,
        "dp": 2, "dynamic programming": 2, "dynamic_programming": 2,
        "graph": 3, "graphs": 3,
        "tree": 4, "trees": 4,
        "binary_search": 5, "binary search": 5,
        "two_pointers": 6, "two pointers": 6,
        "hash_table": 7, "hash table": 7,
        "stack": 8, "queue": 9,
        "linked_list": 10, "linked list": 10,
        "math": 11, "greedy": 12,
        "sorting": 13, "backtracking": 14,
    }
    
    df["category_encoded"] = df["category"].str.lower().map(
        lambda x: category_map.get(x, 15)
    )
    
    # Difficulty encoding
    difficulty_map = {"easy": 0, "medium": 1, "hard": 2}
    df["difficulty_encoded"] = df["difficulty"].str.lower().map(
        lambda x: difficulty_map.get(x, 1)
    )
    
    return df


def _encode_labels(labels: pd.Series) -> np.ndarray:
    """Encode root cause labels to integers."""
    label_map = _get_label_mapping()
    return labels.map(label_map).values


def _get_label_mapping() -> Dict[str, int]:
    """Get label encoding mapping."""
    return {
        "correctness": 0,
        "efficiency": 1,
        "implementation": 2,
        "understanding_gap": 3,
    }


def load_root_cause_model(model_dir: Optional[str] = None) -> Tuple[Any, Dict]:
    """Load trained root cause model."""
    
    model_dir = Path(model_dir) if model_dir else MODEL_DIR
    
    model_path = model_dir / "root_cause_model.joblib"
    metadata_path = model_dir / "root_cause_model_metadata.json"
    
    model = joblib.load(model_path)
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    return model, metadata
