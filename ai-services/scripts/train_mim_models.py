#!/usr/bin/env python3
"""
Train MIM models from preprocessed data.
Trains all 4 MIM model components:
1. Root Cause Classifier (RandomForest)
2. Readiness Model (GradientBoosting)
3. Performance Forecaster (LogisticRegression)
4. Problem Recommender (LightGBM or GradientBoosting fallback)

Usage:
    python scripts/train_mim_models.py
    
Input:
    data/mim_training_data.csv
    
Output:
    app/mim/models/root_cause_classifier.joblib
    app/mim/models/readiness_model.joblib
    app/mim/models/performance_forecaster.joblib
    app/mim/models/problem_recommender.joblib
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# ROOT CAUSE CATEGORIES
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSE_CATEGORIES = [
    "boundary_condition_blindness",
    "off_by_one_error",
    "integer_overflow",
    "wrong_data_structure",
    "logic_error",
    "time_complexity_issue",
    "recursion_issue",
    "comparison_error",
    "algorithm_choice",
    "edge_case_handling",
    "input_parsing",
    "misread_problem",
    "partial_solution",
    "type_error",
    "unknown",
    "none",
]


def load_training_data(csv_path: Path) -> Tuple:
    """Load and prepare training data."""
    import pandas as pd
    import numpy as np
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    
    logger.info(f"Loading training data from {csv_path}...")
    df = pd.read_csv(csv_path)
    logger.info(f"Loaded {len(df):,} samples")
    
    # Feature columns
    feature_cols = [
        "code_length", "code_lines", "has_recursion", "nested_loop_depth",
        "has_array_access", "has_sorting", "has_binary_search", "has_dp",
        "has_graph", "has_math", "time_consumed_ms", "memory_consumed_bytes",
        "is_python", "is_cpp", "is_java"
    ]
    
    # Ensure all feature columns exist
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0
    
    # Prepare features
    X = df[feature_cols].fillna(0).values
    
    # ✨ FIT SCALER ON FULL TRAINING DATA (before train/test split)
    # This ensures consistent scaling during training and inference
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    logger.info(f"Fitted StandardScaler on {len(X):,} samples")
    
    # Prepare labels
    label_encoder = LabelEncoder()
    label_encoder.fit(ROOT_CAUSE_CATEGORIES)
    y_root_cause = label_encoder.transform(df["root_cause"].fillna("unknown"))
    
    # Binary label for accepted/rejected
    y_accepted = (df["verdict"] == "OK").astype(int).values
    
    # Train/test split (use scaled data)
    X_train, X_test, y_rc_train, y_rc_test, y_acc_train, y_acc_test = train_test_split(
        X_scaled, y_root_cause, y_accepted,
        test_size=0.2,
        random_state=42,
        stratify=y_root_cause
    )
    
    logger.info(f"Training set: {len(X_train):,} samples")
    logger.info(f"Test set: {len(X_test):,} samples")
    
    return (X_train, X_test, y_rc_train, y_rc_test, y_acc_train, y_acc_test, 
            feature_cols, label_encoder, scaler)


def train_root_cause_classifier(X_train, X_test, y_train, y_test, label_encoder):
    """Train the root cause classifier."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report, accuracy_score
    import joblib
    
    logger.info("\n" + "=" * 60)
    logger.info("Training Root Cause Classifier")
    logger.info("=" * 60)
    
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    
    logger.info("Fitting model...")
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    logger.info(f"\nTest Accuracy: {accuracy:.4f}")
    logger.info("\nClassification Report:")
    report = classification_report(
        y_test, y_pred,
        target_names=label_encoder.classes_,
        zero_division=0
    )
    logger.info(report)
    
    return model, {"accuracy": accuracy}


def train_readiness_model(X_train, X_test, y_train, y_test):
    """Train the readiness/success probability model."""
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.metrics import roc_auc_score, accuracy_score
    import joblib
    
    logger.info("\n" + "=" * 60)
    logger.info("Training Readiness Model")
    logger.info("=" * 60)
    
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42
    )
    
    logger.info("Fitting model...")
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    
    logger.info(f"\nTest Accuracy: {accuracy:.4f}")
    logger.info(f"Test ROC-AUC: {auc:.4f}")
    
    return model, {"accuracy": accuracy, "roc_auc": auc}


def train_performance_forecaster(X_train, X_test, y_train, y_test):
    """Train the performance forecaster (simpler model)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score, accuracy_score
    import joblib
    
    logger.info("\n" + "=" * 60)
    logger.info("Training Performance Forecaster")
    logger.info("=" * 60)
    
    model = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        random_state=42
    )
    
    logger.info("Fitting model...")
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    
    logger.info(f"\nTest Accuracy: {accuracy:.4f}")
    logger.info(f"Test ROC-AUC: {auc:.4f}")
    
    return model, {"accuracy": accuracy, "roc_auc": auc}


def train_problem_recommender(X_train, X_test, y_train, y_test):
    """Train the problem recommender (ranking model)."""
    logger.info("\n" + "=" * 60)
    logger.info("Training Problem Recommender")
    logger.info("=" * 60)
    
    # Try LightGBM first, fallback to GradientBoosting
    try:
        import lightgbm as lgb
        
        logger.info("Using LightGBM ranker...")
        
        # For ranking, we need groups - simulate with problem_id batches
        # In practice, this would use actual user-problem interaction data
        group_size = 10
        n_groups = len(X_train) // group_size
        train_group = [group_size] * n_groups
        if len(X_train) % group_size > 0:
            train_group.append(len(X_train) % group_size)
        
        # Create dataset
        train_data = lgb.Dataset(
            X_train, 
            label=y_train,
            group=train_group
        )
        
        params = {
            "objective": "lambdarank",
            "metric": "ndcg",
            "ndcg_eval_at": [5, 10],
            "learning_rate": 0.1,
            "num_leaves": 31,
            "min_data_in_leaf": 20,
            "feature_fraction": 0.8,
            "verbose": -1
        }
        
        model = lgb.train(
            params,
            train_data,
            num_boost_round=100
        )
        
        # Evaluate with NDCG approximation
        y_pred = model.predict(X_test)
        # Simple ranking correlation
        from scipy.stats import spearmanr
        corr, _ = spearmanr(y_test, y_pred)
        
        logger.info(f"\nRanking Correlation: {corr:.4f}")
        
        return model, {"ranking_correlation": corr}
        
    except ImportError:
        logger.warning("LightGBM not available, using GradientBoosting fallback")
        
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.metrics import accuracy_score
        
        model = GradientBoostingClassifier(
            n_estimators=50,
            max_depth=4,
            learning_rate=0.1,
            random_state=42
        )
        
        logger.info("Fitting fallback model...")
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        logger.info(f"\nFallback Accuracy: {accuracy:.4f}")
        
        return model, {"accuracy": accuracy, "is_fallback": True}


def save_models(models: Dict, output_dir: Path, metrics: Dict):
    """Save trained models and metadata."""
    import joblib
    
    logger.info("\n" + "=" * 60)
    logger.info("Saving Models")
    logger.info("=" * 60)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save each model
    for name, model in models.items():
        model_path = output_dir / f"{name}.joblib"
        
        # Handle LightGBM models differently
        if hasattr(model, "save_model"):
            # LightGBM model
            lgb_path = output_dir / f"{name}.lgb"
            model.save_model(str(lgb_path))
            logger.info(f"  Saved {name} to {lgb_path}")
        else:
            # sklearn model
            joblib.dump(model, model_path)
            logger.info(f"  Saved {name} to {model_path}")
    
    # Save metadata
    metadata = {
        "version": os.getenv("MIM_MODEL_VERSION", "v1"),
        "trained_at": datetime.now().isoformat(),
        "metrics": metrics,
        "root_cause_categories": ROOT_CAUSE_CATEGORIES
    }
    
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"  Saved metadata to {metadata_path}")


def main():
    """Main entry point."""
    data_dir = Path(__file__).parent.parent / "data"
    models_dir = Path(__file__).parent.parent / "app" / "mim" / "models"
    csv_path = data_dir / "mim_training_data.csv"
    
    logger.info("\n" + "=" * 60)
    logger.info("MIM Model Training")
    logger.info(f"Started at: {datetime.now().isoformat()}")
    logger.info("=" * 60)
    
    # Check input exists
    if not csv_path.exists():
        logger.error(f"Training data not found: {csv_path}")
        logger.error("Run preprocess_training_data.py first.")
        sys.exit(1)
    
    # Load data (now returns scaler too)
    (X_train, X_test, y_rc_train, y_rc_test, y_acc_train, y_acc_test,
     feature_cols, label_encoder, scaler) = load_training_data(csv_path)
    
    # Train models
    models = {}
    metrics = {}
    
    # 1. Root Cause Classifier
    model, m = train_root_cause_classifier(
        X_train, X_test, y_rc_train, y_rc_test, label_encoder
    )
    models["root_cause_classifier"] = model
    metrics["root_cause_classifier"] = m
    
    # Save label encoder and scaler separately
    import joblib
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(label_encoder, models_dir / "label_encoder.joblib")
    logger.info(f"  Saved label_encoder to {models_dir / 'label_encoder.joblib'}")
    
    # ✨ SAVE SCALER - Critical for inference!
    joblib.dump(scaler, models_dir / "scaler.joblib")
    logger.info(f"  Saved scaler to {models_dir / 'scaler.joblib'}")
    
    # 2. Readiness Model
    model, m = train_readiness_model(X_train, X_test, y_acc_train, y_acc_test)
    models["readiness_model"] = model
    metrics["readiness_model"] = m
    
    # 3. Performance Forecaster
    model, m = train_performance_forecaster(X_train, X_test, y_acc_train, y_acc_test)
    models["performance_forecaster"] = model
    metrics["performance_forecaster"] = m
    
    # 4. Problem Recommender
    model, m = train_problem_recommender(X_train, X_test, y_acc_train, y_acc_test)
    models["problem_recommender"] = model
    metrics["problem_recommender"] = m
    
    # Save all models
    save_models(models, models_dir, metrics)
    
    logger.info("\n" + "=" * 60)
    logger.info("Training Complete!")
    logger.info(f"Models saved to: {models_dir}")
    logger.info("=" * 60)
    
    # Summary
    logger.info("\nModel Performance Summary:")
    for name, m in metrics.items():
        logger.info(f"  {name}:")
        for metric_name, value in m.items():
            if isinstance(value, float):
                logger.info(f"    {metric_name}: {value:.4f}")
            else:
                logger.info(f"    {metric_name}: {value}")


if __name__ == "__main__":
    main()
