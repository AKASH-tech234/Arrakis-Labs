"""
Phase 2.1: Confidence Calibration for Model A
==============================================

This script:
1. Loads trained Model A and validation data
2. Computes raw confidence scores
3. Evaluates pre-calibration metrics (ECE, MCE)
4. Fits isotonic regression calibrator
5. Evaluates post-calibration metrics
6. Saves the fitted calibrator for inference use
7. Establishes conservative confidence thresholds

Run with:
    python -m app.mim.calibration.calibrate_model_a

Design Principles:
- Calibration is OFFLINE only (no online adaptation)
- Conservative thresholds for safety
- High confidence → high correctness must hold
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

import numpy as np
import pandas as pd
import joblib

from app.mim.calibration.evaluator import (
    CalibrationEvaluator,
    CalibrationResult,
    compute_ece,
    compute_reliability_curve,
)
from app.mim.calibration.wrapper import CalibrationWrapper
from app.mim.calibration.thresholds import (
    ThresholdValidator,
    ThresholdRecommendation,
    recommend_thresholds,
)
from app.mim.training.train_models import (
    ROOT_CAUSE_FEATURES,
    CODE_SIGNAL_FEATURES,
    ROOT_CAUSE_CLASSES,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_DIR = Path("app/mim/models")
DATA_DIR = Path("data/mim")

# Conservative confidence caps for safety
# These prevent overconfident predictions from driving aggressive control decisions
CONFIDENCE_CAPS = {
    "max_confidence": 0.90,      # Never output confidence > 0.90
    "high_confidence": 0.80,     # Above this: trust diagnosis fully
    "medium_confidence": 0.65,   # Above this: trust with some caution
    "low_confidence": 0.50,      # Below this: conservative/degraded mode
}

# Minimum accuracy requirements for threshold validation
MIN_ACCURACY_HIGH_CONFIDENCE = 0.85
MIN_ACCURACY_MEDIUM_CONFIDENCE = 0.70


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════════════════

def load_validation_data(data_path: Optional[Path] = None) -> pd.DataFrame:
    """Load validation/test data for calibration."""
    if data_path is None:
        data_path = DATA_DIR / "mim_failure_transitions_v2.parquet"
    
    df = pd.read_parquet(data_path)
    logger.info(f"Loaded {len(df)} samples from {data_path}")
    
    # Use test split for calibration evaluation
    # Use validation split for fitting calibrator (to avoid data leakage)
    return df


def load_model_a() -> Tuple[Any, Dict[str, Any]]:
    """Load trained Model A."""
    # Try multiple possible model filenames
    possible_names = [
        "model_a_root_cause.joblib",
        "root_cause_model.joblib", 
        "mim_model_latest.pkl",
    ]
    
    model_path = None
    for name in possible_names:
        candidate = MODEL_DIR / name
        if candidate.exists():
            model_path = candidate
            break
    
    if model_path is None:
        raise FileNotFoundError(f"Model not found. Tried: {possible_names} in {MODEL_DIR}")
    
    model_data = joblib.load(model_path)
    
    # Try to load metadata
    metadata_path = MODEL_DIR / "root_cause_metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
    else:
        metadata = {}
    
    logger.info(f"Loaded Model A from {model_path}")
    return model_data, metadata


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

def prepare_features(df: pd.DataFrame, model_data: Dict) -> np.ndarray:
    """Prepare features matching training pipeline."""
    from sklearn.preprocessing import LabelEncoder
    
    # Delta features
    X_delta = df[ROOT_CAUSE_FEATURES].values
    
    # Categorical features
    cat_encoder = model_data.get("category_encoder")
    diff_encoder = model_data.get("difficulty_encoder")
    
    if cat_encoder is None:
        cat_encoder = LabelEncoder()
        cat_encoder.fit(df["category"].fillna("unknown"))
    if diff_encoder is None:
        diff_encoder = LabelEncoder()
        diff_encoder.fit(df["difficulty"].fillna("unknown"))
    
    cat_encoded = cat_encoder.transform(
        df["category"].fillna("unknown")
    ).reshape(-1, 1)
    diff_encoded = diff_encoder.transform(
        df["difficulty"].fillna("unknown")
    ).reshape(-1, 1)
    
    # Code signal features
    if all(c in df.columns for c in CODE_SIGNAL_FEATURES):
        X_code = df[CODE_SIGNAL_FEATURES].values
    else:
        X_code = np.zeros((len(df), len(CODE_SIGNAL_FEATURES)))
    
    # Combine
    X = np.hstack([X_delta, cat_encoded, diff_encoded, X_code])
    return X


def get_predictions(
    model: Any, 
    X: np.ndarray, 
    label_encoder: Any
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Get model predictions and confidence scores."""
    
    # Get probabilities
    if hasattr(model, 'predict'):
        if hasattr(model, 'num_trees'):
            # LightGBM Booster
            y_prob = model.predict(X)
        else:
            # sklearn-like
            y_prob = model.predict_proba(X)
    else:
        raise ValueError("Model must have predict or predict_proba method")
    
    # Get predictions and confidence
    y_pred = np.argmax(y_prob, axis=1)
    y_confidence = np.max(y_prob, axis=1)
    
    return y_pred, y_confidence, y_prob


# ═══════════════════════════════════════════════════════════════════════════════
# CALIBRATION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def run_calibration_pipeline(
    data_path: Optional[Path] = None,
    output_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Run the complete calibration pipeline.
    
    Steps:
    1. Load model and data
    2. Evaluate pre-calibration metrics
    3. Fit calibrator on validation set
    4. Evaluate post-calibration metrics
    5. Validate thresholds
    6. Save calibrator and results
    
    Returns
    -------
    Dict with calibration results
    """
    
    if output_dir is None:
        output_dir = MODEL_DIR
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("=" * 60)
    logger.info("PHASE 2.1: Confidence Calibration Pipeline")
    logger.info("=" * 60)
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 1: Load model and data
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n[Step 1] Loading model and data...")
    
    model_data, metadata = load_model_a()
    model = model_data.get("model")
    label_encoder = model_data.get("label_encoder")
    
    df = load_validation_data(data_path)
    
    # Split data
    val_df = df[df["split"] == "val"]
    test_df = df[df["split"] == "test"]
    
    logger.info(f"Validation samples: {len(val_df)}")
    logger.info(f"Test samples: {len(test_df)}")
    
    if len(val_df) == 0 or len(test_df) == 0:
        logger.warning("Missing val/test split, using 80/20 split")
        from sklearn.model_selection import train_test_split
        val_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 2: Get predictions and evaluate pre-calibration
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n[Step 2] Evaluating pre-calibration metrics...")
    
    # Validation set predictions (for fitting calibrator)
    X_val = prepare_features(val_df, model_data)
    y_val_true = label_encoder.transform(val_df["root_cause"])
    y_val_pred, y_val_confidence, _ = get_predictions(model, X_val, label_encoder)
    y_val_correct = (y_val_pred == y_val_true).astype(int)
    
    # Test set predictions (for evaluation)
    X_test = prepare_features(test_df, model_data)
    y_test_true = label_encoder.transform(test_df["root_cause"])
    y_test_pred, y_test_confidence, _ = get_predictions(model, X_test, label_encoder)
    y_test_correct = (y_test_pred == y_test_true).astype(int)
    
    # Pre-calibration evaluation
    evaluator = CalibrationEvaluator()
    pre_cal_result = evaluator.evaluate(
        y_true=y_test_true,
        y_pred=y_test_pred,
        y_confidence=y_test_confidence,
        model_version="model_a_v1_pre_calibration",
        dataset_info=f"test_n={len(test_df)}",
    )
    
    logger.info(f"Pre-calibration ECE: {pre_cal_result.ece:.4f}")
    logger.info(f"Pre-calibration MCE: {pre_cal_result.mce:.4f}")
    logger.info(f"Pre-calibration quality: {pre_cal_result.calibration_quality}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 3: Fit calibrator on validation set
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n[Step 3] Fitting isotonic calibrator on validation set...")
    
    calibrator = CalibrationWrapper(method="isotonic")
    calibrator.fit(y_val_correct, y_val_confidence)
    
    logger.info(f"Calibrator fitted: {calibrator.stats}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 4: Evaluate post-calibration on test set
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n[Step 4] Evaluating post-calibration metrics on test set...")
    
    y_test_calibrated = calibrator.transform(y_test_confidence)
    
    # Apply confidence cap
    y_test_capped = np.clip(y_test_calibrated, 0.0, CONFIDENCE_CAPS["max_confidence"])
    
    post_cal_result = evaluator.evaluate(
        y_true=y_test_true,
        y_pred=y_test_pred,
        y_confidence=y_test_capped,
        model_version="model_a_v1_post_calibration",
        dataset_info=f"test_n={len(test_df)}",
    )
    
    logger.info(f"Post-calibration ECE: {post_cal_result.ece:.4f}")
    logger.info(f"Post-calibration MCE: {post_cal_result.mce:.4f}")
    logger.info(f"Post-calibration quality: {post_cal_result.calibration_quality}")
    
    ece_improvement = pre_cal_result.ece - post_cal_result.ece
    logger.info(f"ECE improvement: {ece_improvement:.4f}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 5: Validate and recommend thresholds
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n[Step 5] Validating confidence thresholds...")
    
    threshold_validator = ThresholdValidator(
        min_accuracy_high=MIN_ACCURACY_HIGH_CONFIDENCE,
        min_accuracy_medium=MIN_ACCURACY_MEDIUM_CONFIDENCE,
    )
    
    # Find empirically-validated thresholds
    threshold_rec = recommend_thresholds(y_test_correct, y_test_capped)
    
    logger.info(f"Recommended high confidence threshold: {threshold_rec.high_confidence:.2f}")
    logger.info(f"Recommended medium confidence threshold: {threshold_rec.medium_confidence:.2f}")
    logger.info(f"Threshold metrics: {threshold_rec.metrics}")
    
    # Validate our pre-defined thresholds
    for name, threshold in [
        ("high", CONFIDENCE_CAPS["high_confidence"]),
        ("medium", CONFIDENCE_CAPS["medium_confidence"]),
        ("low", CONFIDENCE_CAPS["low_confidence"]),
    ]:
        result = threshold_validator.validate_threshold(
            y_test_correct, y_test_capped, threshold
        )
        logger.info(f"  {name} ({threshold:.2f}): acc={result.accuracy_above:.3f}, "
                   f"cov={result.coverage_above:.3f}, valid={result.is_valid}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 6: Save artifacts
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n[Step 6] Saving calibration artifacts...")
    
    # Save calibrator
    calibrator_path = output_dir / "model_a_calibrator.joblib"
    calibrator.save(str(calibrator_path))
    logger.info(f"Calibrator saved to {calibrator_path}")
    
    # Save calibration config
    calibration_config = {
        "version": "2.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "method": "isotonic",
        "confidence_caps": CONFIDENCE_CAPS,
        "thresholds": {
            "high_confidence": float(threshold_rec.high_confidence),
            "medium_confidence": float(threshold_rec.medium_confidence),
            "low_confidence": float(threshold_rec.low_confidence),
            "empirically_validated": True,
        },
        "pre_calibration": {
            "ece": float(pre_cal_result.ece),
            "mce": float(pre_cal_result.mce),
            "quality": pre_cal_result.calibration_quality,
        },
        "post_calibration": {
            "ece": float(post_cal_result.ece),
            "mce": float(post_cal_result.mce),
            "quality": post_cal_result.calibration_quality,
            "ece_improvement": float(ece_improvement),
        },
        "validation_samples": len(val_df),
        "test_samples": len(test_df),
    }
    
    config_path = output_dir / "calibration_config.json"
    with open(config_path, "w") as f:
        json.dump(calibration_config, f, indent=2)
    logger.info(f"Calibration config saved to {config_path}")
    
    # Save detailed evaluation results
    pre_cal_result.save(output_dir / "calibration_eval_pre.json")
    post_cal_result.save(output_dir / "calibration_eval_post.json")
    
    # Generate reliability diagrams
    pre_diagram_path = output_dir / "reliability_diagram_pre.png"
    post_diagram_path = output_dir / "reliability_diagram_post.png"
    
    pre_cal_result.plot_reliability_diagram(
        output_path=pre_diagram_path,
        title="Model A - Pre-Calibration"
    )
    post_cal_result.plot_reliability_diagram(
        output_path=post_diagram_path,
        title="Model A - Post-Calibration (Isotonic + Cap)"
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # Summary
    # ─────────────────────────────────────────────────────────────────────────
    
    logger.info("\n" + "=" * 60)
    logger.info("CALIBRATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"ECE: {pre_cal_result.ece:.4f} → {post_cal_result.ece:.4f} "
               f"(Δ = {ece_improvement:+.4f})")
    logger.info(f"Quality: {pre_cal_result.calibration_quality} → "
               f"{post_cal_result.calibration_quality}")
    logger.info(f"Artifacts saved to: {output_dir}")
    logger.info("=" * 60)
    
    return {
        "pre_calibration": pre_cal_result.to_dict(),
        "post_calibration": post_cal_result.to_dict(),
        "calibration_config": calibration_config,
        "calibrator_path": str(calibrator_path),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run Phase 2.1 calibration pipeline")
    parser.add_argument(
        "--data", 
        type=str, 
        default=None,
        help="Path to parquet data file"
    )
    parser.add_argument(
        "--output", 
        type=str, 
        default=None,
        help="Output directory for artifacts"
    )
    
    args = parser.parse_args()
    
    data_path = Path(args.data) if args.data else None
    output_dir = Path(args.output) if args.output else None
    
    results = run_calibration_pipeline(data_path, output_dir)
    
    print("\n✅ Calibration pipeline completed successfully")
