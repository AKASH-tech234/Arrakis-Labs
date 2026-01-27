"""
Subtype Model Training
======================

Trains Model B: SUBTYPE classifier (conditioned on ROOT_CAUSE).

Separate model from root cause to:
- Prevent subtype confusion across categories
- Easier debugging
- Better calibration
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import classification_report, f1_score, accuracy_score
import joblib

logger = logging.getLogger(__name__)

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False

from app.mim.taxonomy.subtype_masks import SUBTYPES, ROOT_CAUSE_TO_SUBTYPES
from app.mim.taxonomy.root_causes import ROOT_CAUSES


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_DIR = Path("app/mim/models")

# Feature columns (same as root cause + root cause prediction)
SUBTYPE_FEATURES = [
    "delta_attempts_same_category",
    "delta_root_cause_repeat_rate",
    "delta_complexity_mismatch",
    "delta_time_to_accept",
    "delta_optimization_transition",
    "is_cold_start",
    "category_encoded",
    "difficulty_encoded",
    "root_cause_encoded",  # Conditioned on root cause
]

# LightGBM params (adjusted for more classes)
LGBM_PARAMS = {
    "objective": "multiclass",
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

def train_subtype_model(
    data_path: str,
    output_dir: Optional[str] = None,
    strategy: str = "unified",
) -> Dict[str, Any]:
    """
    Train SUBTYPE classifier (Model B).
    
    Parameters
    ----------
    data_path : str
        Path to mim_failure_transitions.parquet
    output_dir : str, optional
        Where to save model
    strategy : str
        "unified" - single model for all subtypes
        "per_root_cause" - separate model per root cause
        
    Returns
    -------
    Dict[str, Any]
        Training results including metrics
    """
    
    output_dir = Path(output_dir) if output_dir else MODEL_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Loading data from {data_path}")
    df = pd.read_parquet(data_path)
    
    # Validate subtypes
    invalid_subtypes = df[~df["subtype"].isin(SUBTYPES)]
    if len(invalid_subtypes) > 0:
        logger.warning(f"Found {len(invalid_subtypes)} invalid subtypes, filtering")
        df = df[df["subtype"].isin(SUBTYPES)]
    
    logger.info(f"Dataset: {len(df)} samples")
    logger.info(f"Subtype distribution:\n{df['subtype'].value_counts()}")
    
    # Encode features
    df = _encode_features(df)
    
    if strategy == "per_root_cause":
        return _train_per_root_cause(df, output_dir)
    else:
        return _train_unified(df, output_dir)


def _train_unified(df: pd.DataFrame, output_dir: Path) -> Dict[str, Any]:
    """Train single unified model for all subtypes."""
    
    feature_cols = SUBTYPE_FEATURES
    
    # Create label mapping
    subtype_list = sorted(SUBTYPES)
    label_map = {s: i for i, s in enumerate(subtype_list)}
    
    LGBM_PARAMS["num_class"] = len(subtype_list)
    
    # Split
    train_df = df[df["split"] == "train"]
    val_df = df[df["split"] == "val"]
    test_df = df[df["split"] == "test"]
    
    X_train = train_df[feature_cols].values
    y_train = train_df["subtype"].map(label_map).values
    
    X_val = val_df[feature_cols].values
    y_val = val_df["subtype"].map(label_map).values
    
    X_test = test_df[feature_cols].values
    y_test = test_df["subtype"].map(label_map).values
    
    # Train
    if LIGHTGBM_AVAILABLE:
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        model = lgb.train(
            LGBM_PARAMS,
            train_data,
            valid_sets=[train_data, val_data],
            valid_names=["train", "val"],
            feature_name=feature_cols,
        )
        
        y_pred = np.argmax(model.predict(X_test), axis=1)
    else:
        from sklearn.ensemble import GradientBoostingClassifier
        model = GradientBoostingClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
    
    # Metrics
    metrics = {
        "test_accuracy": accuracy_score(y_test, y_pred),
        "test_f1_macro": f1_score(y_test, y_pred, average="macro"),
        "test_f1_weighted": f1_score(y_test, y_pred, average="weighted"),
    }
    
    logger.info(f"Test accuracy: {metrics['test_accuracy']:.3f}")
    logger.info(f"Test F1 (macro): {metrics['test_f1_macro']:.3f}")
    
    # Per-class metrics
    inv_label_map = {v: k for k, v in label_map.items()}
    for i, subtype in inv_label_map.items():
        mask = y_test == i
        if mask.sum() > 0:
            subtype_acc = accuracy_score(y_test[mask], y_pred[mask])
            metrics[f"accuracy_{subtype}"] = subtype_acc
    
    # Save
    model_path = output_dir / "subtype_model.joblib"
    joblib.dump(model, model_path)
    
    metadata = {
        "model_type": "lightgbm" if LIGHTGBM_AVAILABLE else "sklearn",
        "strategy": "unified",
        "feature_cols": feature_cols,
        "label_mapping": label_map,
        "metrics": metrics,
    }
    
    metadata_path = output_dir / "subtype_model_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Model saved to {model_path}")
    
    return metadata


def _train_per_root_cause(df: pd.DataFrame, output_dir: Path) -> Dict[str, Any]:
    """Train separate model for each root cause."""
    
    all_metadata = {}
    
    for root_cause in ROOT_CAUSES:
        valid_subtypes = ROOT_CAUSE_TO_SUBTYPES[root_cause]
        rc_df = df[df["root_cause"] == root_cause]
        
        if len(rc_df) < 10:
            logger.warning(f"Skipping {root_cause}: only {len(rc_df)} samples")
            continue
        
        logger.info(f"\nTraining subtype model for root_cause={root_cause}")
        logger.info(f"Valid subtypes: {valid_subtypes}")
        
        # Filter to valid subtypes
        rc_df = rc_df[rc_df["subtype"].isin(valid_subtypes)]
        
        if len(rc_df) < 10:
            logger.warning(f"Skipping {root_cause}: only {len(rc_df)} samples after subtype filter")
            continue
        
        # Create label mapping for this root cause
        subtype_list = sorted(valid_subtypes)
        label_map = {s: i for i, s in enumerate(subtype_list)}
        
        # Don't include root_cause_encoded (it's constant for this model)
        feature_cols = [f for f in SUBTYPE_FEATURES if f != "root_cause_encoded"]
        
        LGBM_PARAMS["num_class"] = len(subtype_list)
        
        # Split
        train_df = rc_df[rc_df["split"] == "train"]
        val_df = rc_df[rc_df["split"] == "val"]
        test_df = rc_df[rc_df["split"] == "test"]
        
        if len(train_df) < 5 or len(test_df) < 2:
            logger.warning(f"Skipping {root_cause}: insufficient split sizes")
            continue
        
        X_train = train_df[feature_cols].values
        y_train = train_df["subtype"].map(label_map).values
        
        X_val = val_df[feature_cols].values if len(val_df) > 0 else X_train[:1]
        y_val = val_df["subtype"].map(label_map).values if len(val_df) > 0 else y_train[:1]
        
        X_test = test_df[feature_cols].values
        y_test = test_df["subtype"].map(label_map).values
        
        # Train
        if LIGHTGBM_AVAILABLE and len(train_df) > 20:
            train_data = lgb.Dataset(X_train, label=y_train)
            val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
            
            model = lgb.train(
                LGBM_PARAMS,
                train_data,
                valid_sets=[train_data, val_data],
                valid_names=["train", "val"],
                feature_name=feature_cols,
            )
            
            y_pred = np.argmax(model.predict(X_test), axis=1)
        else:
            from sklearn.ensemble import GradientBoostingClassifier
            model = GradientBoostingClassifier(n_estimators=50, random_state=42)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
        
        metrics = {
            "test_accuracy": accuracy_score(y_test, y_pred),
            "test_f1_macro": f1_score(y_test, y_pred, average="macro", zero_division=0),
        }
        
        logger.info(f"{root_cause} - Test accuracy: {metrics['test_accuracy']:.3f}")
        
        # Save
        model_path = output_dir / f"subtype_model_{root_cause}.joblib"
        joblib.dump(model, model_path)
        
        metadata = {
            "root_cause": root_cause,
            "feature_cols": feature_cols,
            "label_mapping": label_map,
            "metrics": metrics,
        }
        
        metadata_path = output_dir / f"subtype_model_{root_cause}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        all_metadata[root_cause] = metadata
    
    return {"strategy": "per_root_cause", "models": all_metadata}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _encode_features(df: pd.DataFrame) -> pd.DataFrame:
    """Encode categorical features."""
    
    # Category encoding (same as root cause model)
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
    
    # Root cause encoding (for conditioning)
    root_cause_map = {
        "correctness": 0,
        "efficiency": 1,
        "implementation": 2,
        "understanding_gap": 3,
    }
    df["root_cause_encoded"] = df["root_cause"].map(
        lambda x: root_cause_map.get(x, 0)
    )
    
    return df


def load_subtype_model(
    root_cause: Optional[str] = None,
    model_dir: Optional[str] = None,
) -> Tuple[Any, Dict]:
    """
    Load trained subtype model.
    
    If root_cause is provided and per_root_cause models exist, load that.
    Otherwise load unified model.
    """
    
    model_dir = Path(model_dir) if model_dir else MODEL_DIR
    
    if root_cause:
        model_path = model_dir / f"subtype_model_{root_cause}.joblib"
        metadata_path = model_dir / f"subtype_model_{root_cause}_metadata.json"
        
        if model_path.exists():
            model = joblib.load(model_path)
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            return model, metadata
    
    # Fallback to unified
    model_path = model_dir / "subtype_model.joblib"
    metadata_path = model_dir / "subtype_model_metadata.json"
    
    model = joblib.load(model_path)
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    return model, metadata
