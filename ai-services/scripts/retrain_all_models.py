"""
Retrain All MIM Models
======================

End-to-end retraining pipeline for MIM models.

Steps:
1. Export data from MongoDB to Parquet (or use existing Parquet)
2. Validate taxonomy coverage
3. Train ROOT_CAUSE model (Model A)
4. Train SUBTYPE model (Model B)
5. Validate models on holdout set
6. Deploy models

Usage:
    python -m scripts.retrain_all_models --data-dir data --model-dir models/mim
    
    # With mock data generation:
    python -m scripts.retrain_all_models --generate-mock --n-users 200
    
    # Export from MongoDB:
    python -m scripts.retrain_all_models --mongodb-uri mongodb://localhost:27017 --export-first
"""

import argparse
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.mim.training.dataset_builder import DatasetBuilder
from app.mim.training.train_root_cause_model import RootCauseTrainer
from app.mim.training.train_subtype_model import SubtypeTrainer
from app.mim.training.validate_taxonomy import validate_taxonomy_coverage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = {
    "data_dir": "data",
    "model_dir": "models/mim",
    "failures_file": "mim_failure_transitions.parquet",
    "reinforcement_file": "mim_reinforcement_events.parquet",
    "mock_failures_file": "mim_mock_failures.parquet",
    
    # Model parameters
    "root_cause_params": {
        "objective": "multiclass",
        "num_class": 4,
        "metric": "multi_logloss",
        "boosting_type": "gbdt",
        "num_leaves": 31,
        "learning_rate": 0.05,
        "feature_fraction": 0.9,
        "verbose": -1,
        "n_estimators": 100,
    },
    "subtype_params": {
        "objective": "multiclass",
        "metric": "multi_logloss",
        "boosting_type": "gbdt",
        "num_leaves": 31,
        "learning_rate": 0.05,
        "feature_fraction": 0.9,
        "verbose": -1,
        "n_estimators": 100,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE STEPS
# ═══════════════════════════════════════════════════════════════════════════════

def step_generate_mock_data(n_users: int, data_dir: str) -> None:
    """Step 1a: Generate mock data if requested."""
    
    logger.info("=" * 60)
    logger.info("STEP 1a: Generating mock data")
    logger.info("=" * 60)
    
    from scripts.generate_mock_data import generate_mock_dataset
    
    generate_mock_dataset(
        n_users=n_users,
        output_dir=data_dir,
    )
    
    logger.info("Mock data generation complete")


def step_export_from_mongodb(mongodb_uri: str, data_dir: str) -> None:
    """Step 1b: Export data from MongoDB."""
    
    logger.info("=" * 60)
    logger.info("STEP 1b: Exporting data from MongoDB")
    logger.info("=" * 60)
    
    builder = DatasetBuilder(mongodb_uri)
    
    # Build and export datasets
    df_failures = builder.build_failure_dataset()
    df_reinforcement = builder.build_reinforcement_dataset()
    
    output_path = Path(data_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    failures_path = output_path / "mim_failure_transitions.parquet"
    reinforcement_path = output_path / "mim_reinforcement_events.parquet"
    
    df_failures.to_parquet(failures_path, index=False)
    df_reinforcement.to_parquet(reinforcement_path, index=False)
    
    logger.info(f"Exported {len(df_failures)} failures to {failures_path}")
    logger.info(f"Exported {len(df_reinforcement)} reinforcements to {reinforcement_path}")


def step_validate_taxonomy(data_dir: str, use_mock: bool = False) -> Dict[str, Any]:
    """Step 2: Validate taxonomy coverage."""
    
    logger.info("=" * 60)
    logger.info("STEP 2: Validating taxonomy coverage")
    logger.info("=" * 60)
    
    import pandas as pd
    
    data_path = Path(data_dir)
    
    if use_mock:
        file_name = "mim_mock_failures.parquet"
    else:
        file_name = "mim_failure_transitions.parquet"
    
    df_path = data_path / file_name
    
    if not df_path.exists():
        logger.error(f"Data file not found: {df_path}")
        return {"valid": False, "error": "Data file not found"}
    
    df = pd.read_parquet(df_path)
    
    results = validate_taxonomy_coverage(df)
    
    if results["valid"]:
        logger.info("✓ Taxonomy validation PASSED")
    else:
        logger.warning("✗ Taxonomy validation FAILED")
        for issue in results.get("issues", []):
            logger.warning(f"  - {issue}")
    
    return results


def step_train_root_cause_model(
    data_dir: str,
    model_dir: str,
    use_mock: bool = False,
    params: Dict = None,
) -> str:
    """Step 3: Train ROOT_CAUSE model."""
    
    logger.info("=" * 60)
    logger.info("STEP 3: Training ROOT_CAUSE model (Model A)")
    logger.info("=" * 60)
    
    import pandas as pd
    
    data_path = Path(data_dir)
    model_path = Path(model_dir)
    model_path.mkdir(parents=True, exist_ok=True)
    
    if use_mock:
        file_name = "mim_mock_failures.parquet"
    else:
        file_name = "mim_failure_transitions.parquet"
    
    df = pd.read_parquet(data_path / file_name)
    
    trainer = RootCauseTrainer(params=params or DEFAULT_CONFIG["root_cause_params"])
    
    # Define feature columns
    feature_cols = [
        "delta_attempts_same_category",
        "delta_root_cause_repeat_rate",
        "delta_complexity_mismatch",
        "delta_time_to_accept",
        "delta_optimization_transition",
        "is_cold_start",
    ]
    
    # Filter to available columns
    available_cols = [c for c in feature_cols if c in df.columns]
    
    if not available_cols:
        logger.error("No feature columns available in dataset")
        raise ValueError("No feature columns available")
    
    logger.info(f"Using features: {available_cols}")
    
    # Train
    X = df[available_cols]
    y = df["root_cause"]
    
    metrics = trainer.train(X, y)
    
    # Save model
    output_path = model_path / "root_cause_model.joblib"
    trainer.save(str(output_path))
    
    logger.info(f"Model saved to {output_path}")
    logger.info(f"Validation accuracy: {metrics.get('val_accuracy', 'N/A'):.4f}")
    
    return str(output_path)


def step_train_subtype_model(
    data_dir: str,
    model_dir: str,
    use_mock: bool = False,
    params: Dict = None,
) -> str:
    """Step 4: Train SUBTYPE model."""
    
    logger.info("=" * 60)
    logger.info("STEP 4: Training SUBTYPE model (Model B)")
    logger.info("=" * 60)
    
    import pandas as pd
    
    data_path = Path(data_dir)
    model_path = Path(model_dir)
    
    if use_mock:
        file_name = "mim_mock_failures.parquet"
    else:
        file_name = "mim_failure_transitions.parquet"
    
    df = pd.read_parquet(data_path / file_name)
    
    trainer = SubtypeTrainer(
        params=params or DEFAULT_CONFIG["subtype_params"],
        strategy="unified",
    )
    
    # Define feature columns
    feature_cols = [
        "delta_attempts_same_category",
        "delta_root_cause_repeat_rate",
        "delta_complexity_mismatch",
        "delta_time_to_accept",
        "delta_optimization_transition",
        "is_cold_start",
        "root_cause",  # Include root cause as feature
    ]
    
    available_cols = [c for c in feature_cols if c in df.columns]
    
    logger.info(f"Using features: {available_cols}")
    
    X = df[available_cols]
    y = df["subtype"]
    
    metrics = trainer.train(X, y)
    
    output_path = model_path / "subtype_model.joblib"
    trainer.save(str(output_path))
    
    logger.info(f"Model saved to {output_path}")
    logger.info(f"Validation accuracy: {metrics.get('val_accuracy', 'N/A'):.4f}")
    
    return str(output_path)


def step_validate_models(model_dir: str, data_dir: str, use_mock: bool = False) -> Dict:
    """Step 5: Validate models on holdout set."""
    
    logger.info("=" * 60)
    logger.info("STEP 5: Validating models on holdout set")
    logger.info("=" * 60)
    
    import joblib
    import pandas as pd
    import numpy as np
    from sklearn.metrics import classification_report
    
    model_path = Path(model_dir)
    data_path = Path(data_dir)
    
    if use_mock:
        file_name = "mim_mock_failures.parquet"
    else:
        file_name = "mim_failure_transitions.parquet"
    
    df = pd.read_parquet(data_path / file_name)
    
    # Load models
    rc_model_path = model_path / "root_cause_model.joblib"
    st_model_path = model_path / "subtype_model.joblib"
    
    if not rc_model_path.exists() or not st_model_path.exists():
        logger.error("Models not found")
        return {"valid": False, "error": "Models not found"}
    
    rc_data = joblib.load(rc_model_path)
    st_data = joblib.load(st_model_path)
    
    rc_model = rc_data["model"]
    st_model = st_data["model"]
    
    # Use last 20% as holdout
    n = len(df)
    holdout_start = int(n * 0.8)
    df_holdout = df.iloc[holdout_start:]
    
    feature_cols = [
        "delta_attempts_same_category",
        "delta_root_cause_repeat_rate",
        "delta_complexity_mismatch",
        "delta_time_to_accept",
        "delta_optimization_transition",
        "is_cold_start",
    ]
    
    available_cols = [c for c in feature_cols if c in df_holdout.columns]
    
    X_holdout = df_holdout[available_cols]
    y_rc_true = df_holdout["root_cause"]
    y_st_true = df_holdout["subtype"]
    
    # Predict root cause
    rc_encoder = rc_data.get("label_encoder")
    y_rc_pred_idx = rc_model.predict(X_holdout)
    y_rc_pred = rc_encoder.inverse_transform(y_rc_pred_idx.astype(int))
    
    logger.info("ROOT_CAUSE Classification Report:")
    print(classification_report(y_rc_true, y_rc_pred))
    
    # Predict subtype (add root_cause as feature)
    X_with_rc = X_holdout.copy()
    X_with_rc["root_cause"] = y_rc_pred
    
    # Encode root_cause for subtype model
    st_rc_encoder = st_data.get("root_cause_encoder")
    if st_rc_encoder:
        X_with_rc["root_cause"] = st_rc_encoder.transform(X_with_rc["root_cause"])
    
    st_encoder = st_data.get("label_encoder")
    y_st_pred_idx = st_model.predict(X_with_rc)
    y_st_pred = st_encoder.inverse_transform(y_st_pred_idx.astype(int))
    
    logger.info("SUBTYPE Classification Report:")
    print(classification_report(y_st_true, y_st_pred, zero_division=0))
    
    rc_accuracy = np.mean(y_rc_true == y_rc_pred)
    st_accuracy = np.mean(y_st_true == y_st_pred)
    
    logger.info(f"ROOT_CAUSE holdout accuracy: {rc_accuracy:.4f}")
    logger.info(f"SUBTYPE holdout accuracy: {st_accuracy:.4f}")
    
    return {
        "valid": True,
        "root_cause_accuracy": rc_accuracy,
        "subtype_accuracy": st_accuracy,
    }


def step_deploy_models(model_dir: str) -> None:
    """Step 6: Deploy models (mark as active)."""
    
    logger.info("=" * 60)
    logger.info("STEP 6: Deploying models")
    logger.info("=" * 60)
    
    import json
    
    model_path = Path(model_dir)
    
    # Create deployment marker
    deployment_info = {
        "deployed_at": datetime.utcnow().isoformat(),
        "models": {
            "root_cause": str(model_path / "root_cause_model.joblib"),
            "subtype": str(model_path / "subtype_model.joblib"),
        },
        "version": "v2.0",
    }
    
    marker_path = model_path / "deployment.json"
    with open(marker_path, "w") as f:
        json.dump(deployment_info, f, indent=2)
    
    logger.info(f"Deployment marker created: {marker_path}")
    logger.info("Models are now active for inference")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def run_pipeline(args) -> None:
    """Run the complete training pipeline."""
    
    logger.info("=" * 60)
    logger.info("MIM MODEL RETRAINING PIPELINE")
    logger.info(f"Started at: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)
    
    data_dir = args.data_dir
    model_dir = args.model_dir
    use_mock = args.generate_mock or args.use_mock
    
    try:
        # Step 1: Data preparation
        if args.generate_mock:
            step_generate_mock_data(args.n_users, data_dir)
        
        if args.export_first and args.mongodb_uri:
            step_export_from_mongodb(args.mongodb_uri, data_dir)
        
        # Step 2: Validate taxonomy
        taxonomy_results = step_validate_taxonomy(data_dir, use_mock)
        
        if not taxonomy_results.get("valid", False) and not args.force:
            logger.error("Taxonomy validation failed. Use --force to continue anyway.")
            return
        
        # Step 3: Train ROOT_CAUSE model
        rc_model_path = step_train_root_cause_model(data_dir, model_dir, use_mock)
        
        # Step 4: Train SUBTYPE model
        st_model_path = step_train_subtype_model(data_dir, model_dir, use_mock)
        
        # Step 5: Validate models
        validation_results = step_validate_models(model_dir, data_dir, use_mock)
        
        if not validation_results.get("valid", False):
            logger.error("Model validation failed")
            return
        
        # Step 6: Deploy
        if args.deploy:
            step_deploy_models(model_dir)
        else:
            logger.info("Skipping deployment (use --deploy to deploy)")
        
        logger.info("=" * 60)
        logger.info("PIPELINE COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Retrain all MIM models")
    
    parser.add_argument(
        "--data-dir", 
        type=str, 
        default="data",
        help="Directory containing training data",
    )
    parser.add_argument(
        "--model-dir",
        type=str,
        default="models/mim",
        help="Directory to save trained models",
    )
    parser.add_argument(
        "--generate-mock",
        action="store_true",
        help="Generate mock training data first",
    )
    parser.add_argument(
        "--use-mock",
        action="store_true",
        help="Use existing mock data (mim_mock_failures.parquet)",
    )
    parser.add_argument(
        "--n-users",
        type=int,
        default=200,
        help="Number of mock users to generate",
    )
    parser.add_argument(
        "--mongodb-uri",
        type=str,
        default=None,
        help="MongoDB connection URI",
    )
    parser.add_argument(
        "--export-first",
        action="store_true",
        help="Export from MongoDB before training",
    )
    parser.add_argument(
        "--deploy",
        action="store_true",
        help="Deploy models after training",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Continue even if validation fails",
    )
    
    args = parser.parse_args()
    
    run_pipeline(args)
