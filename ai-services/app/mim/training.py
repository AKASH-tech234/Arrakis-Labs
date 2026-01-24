"""
MIM Training Pipeline
======================

Offline model training system for MIM.

Training Modes:
1. From MongoDB: Uses existing submissions with auto-generated labels
2. From Manual Labels: Uses human-verified labels (Option B - 500 submissions)

Training Schedule:
- Nightly: Incremental training on new data
- Weekly: Full retraining with all data

Usage:
    # From command line
    python -m app.mim.training --mode mongodb --days 30
    python -m app.mim.training --mode manual --labels-file labels.json
    
    # From code
    from app.mim.training import MIMTrainer
    trainer = MIMTrainer()
    await trainer.train_from_mongodb(days_back=30)
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import asyncio
import logging
import json
import os
from datetime import datetime, timedelta
from collections import Counter

from app.mim.feature_extractor import MIMFeatureExtractor, ROOT_CAUSE_CATEGORIES
from app.mim.model import MIMModel, MODEL_DIR

logger = logging.getLogger("mim.training")


class MIMTrainer:
    """
    MIM Model Training Pipeline.
    
    Handles data extraction, feature engineering, and model training.
    """
    
    def __init__(self):
        self.feature_extractor = MIMFeatureExtractor()
        self.model = MIMModel()
        
        logger.info("MIM Trainer initialized")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TRAINING FROM MONGODB (Auto-labeled)
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def train_from_mongodb(
        self,
        days_back: int = 30,
        min_samples: int = 100,
    ) -> Dict[str, Any]:
        """
        Train MIM models using recent MongoDB submissions.
        
        Labels are derived from:
        1. detected_pattern field (if available from pattern_detection_agent)
        2. Verdict-based heuristics (fallback)
        
        Args:
            days_back: Number of days of data to use
            min_samples: Minimum samples required for training
            
        Returns:
            Training results with metrics
        """
        logger.info(f"🔄 Starting MIM training from MongoDB | days_back={days_back}")
        
        try:
            from app.db.mongodb import mongo_client
        except ImportError:
            logger.error("MongoDB client not available")
            return {"success": False, "error": "MongoDB client not available"}
        
        # 1. Fetch all users with submissions
        print("📊 Fetching training data from MongoDB...")
        
        all_features = []
        all_root_cause_labels = []
        all_success_labels = []
        
        # Get list of users (this is a simplification - in production, iterate through users)
        # For now, we'll need to fetch submissions differently
        try:
            # Fetch submissions from the last N days
            submissions = await self._fetch_recent_submissions(mongo_client, days_back)
            
            if len(submissions) < min_samples:
                logger.warning(f"Insufficient data: {len(submissions)} < {min_samples}")
                return {
                    "success": False, 
                    "error": f"Insufficient data: {len(submissions)} samples"
                }
            
            print(f"   └─ Fetched {len(submissions)} submissions")
            
            # 2. Extract features for each submission
            print("🔧 Extracting features...")
            
            # Group submissions by user
            user_submissions = {}
            for sub in submissions:
                user_id = sub.get("userId") or sub.get("user_id", "unknown")
                if user_id not in user_submissions:
                    user_submissions[user_id] = []
                user_submissions[user_id].append(sub)
            
            # Process each user's submissions
            for user_id, user_subs in user_submissions.items():
                # Sort by time (oldest first for history building)
                user_subs.sort(key=lambda x: x.get("createdAt", ""), reverse=False)
                
                for i, sub in enumerate(user_subs):
                    # User history is submissions before this one
                    user_history = user_subs[:i]
                    
                    # Convert to submission format expected by feature extractor
                    submission_data = self._convert_mongodb_submission(sub)
                    
                    # Extract features
                    features = self.feature_extractor.extract(
                        submission=submission_data,
                        user_history=user_history,
                        problem_context=None,  # Would need to fetch
                        user_memory=None,  # Would need RAG
                    )
                    
                    # Get labels
                    root_cause = self._derive_root_cause_label(sub)
                    is_success = sub.get("status") == "accepted"
                    
                    all_features.append(features)
                    all_root_cause_labels.append(root_cause)
                    all_success_labels.append(1 if is_success else 0)
            
            # Convert to numpy arrays
            X = np.vstack(all_features)
            y_root_cause = np.array(all_root_cause_labels)
            y_success = np.array(all_success_labels)
            
            print(f"   └─ Extracted {len(X)} feature vectors")
            print(f"   └─ Label distribution: {Counter(y_root_cause)}")
            
            # 3. Train model
            print("🎓 Training models...")
            
            metrics = self.model.fit(X, y_root_cause, y_success)
            
            # 4. Save model
            model_path = self.model.save()
            
            print(f"✅ Training complete!")
            print(f"   └─ Root Cause Accuracy: {metrics.get('root_cause_accuracy', 0):.2%}")
            print(f"   └─ Readiness Accuracy: {metrics.get('readiness_accuracy', 0):.2%}")
            print(f"   └─ Model saved to: {model_path}")
            
            return {
                "success": True,
                "samples": len(X),
                "metrics": metrics,
                "model_path": model_path,
                "label_distribution": dict(Counter(y_root_cause)),
            }
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    async def _fetch_recent_submissions(
        self, 
        mongo_client,
        days_back: int
    ) -> List[Dict]:
        """Fetch submissions from the last N days."""
        # This is a placeholder - actual implementation depends on MongoDB schema
        # In production, use aggregation pipeline with date filter
        
        all_submissions = []
        
        # Try to get submissions collection directly
        if mongo_client.db is not None:
            try:
                cutoff = datetime.now() - timedelta(days=days_back)
                cursor = mongo_client.db.submissions.find(
                    {"createdAt": {"$gte": cutoff}},
                    limit=10000
                )
                all_submissions = list(cursor)
            except Exception as e:
                logger.warning(f"Direct fetch failed: {e}")
        
        return all_submissions
    
    def _convert_mongodb_submission(self, sub: Dict) -> Dict:
        """Convert MongoDB submission to feature extractor format."""
        return {
            "user_id": sub.get("userId") or sub.get("user_id", ""),
            "problem_id": sub.get("questionId") or sub.get("problem_id", ""),
            "verdict": self._status_to_verdict(sub.get("status", "")),
            "code": sub.get("code", ""),
            "language": sub.get("language", ""),
            "problem_category": sub.get("category", ""),
            "error_type": sub.get("error_type"),
            "attempts_count": sub.get("attempts", 0),
        }
    
    def _status_to_verdict(self, status: str) -> str:
        """Convert MongoDB status to verdict format."""
        status_map = {
            "accepted": "accepted",
            "wrong_answer": "wrong_answer",
            "wa": "wrong_answer",
            "tle": "time_limit_exceeded",
            "time_limit_exceeded": "time_limit_exceeded",
            "runtime_error": "runtime_error",
            "re": "runtime_error",
            "compile_error": "compile_error",
            "ce": "compile_error",
            "mle": "memory_limit_exceeded",
            "memory_limit_exceeded": "memory_limit_exceeded",
        }
        return status_map.get(status.lower(), status)
    
    def _derive_root_cause_label(self, submission: Dict) -> str:
        """
        Derive root cause label from submission data.
        
        Priority:
        1. Manual label (if exists from labeling tool)
        2. detected_pattern from pattern_detection_agent
        3. Verdict-based heuristic
        """
        # Check for manual label
        if submission.get("mim_label"):
            return submission["mim_label"]
        
        # Check for agent-detected pattern
        pattern = submission.get("detected_pattern") or submission.get("pattern")
        if pattern and pattern in ROOT_CAUSE_CATEGORIES:
            return pattern
        
        # Fallback: verdict-based heuristic
        status = submission.get("status", "").lower()
        
        if status == "accepted":
            return "unknown"  # No error to classify
        elif status in ["tle", "time_limit_exceeded"]:
            return "time_complexity_issue"
        elif status in ["runtime_error", "re"]:
            return "boundary_condition_blindness"  # Most common cause
        elif status in ["compile_error", "ce"]:
            return "unknown"  # Syntax error, not algorithmic
        else:
            return "logic_error"  # Default for wrong_answer
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TRAINING FROM MANUAL LABELS (Option B)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def train_from_manual_labels(
        self,
        labels_file: str,
    ) -> Dict[str, Any]:
        """
        Train MIM using manually labeled submissions.
        
        Option B: Create manual labels for 500 submissions for higher quality.
        
        Args:
            labels_file: Path to JSON file with labeled submissions
            
        Returns:
            Training results
        """
        logger.info(f"🔄 Training from manual labels: {labels_file}")
        
        if not os.path.exists(labels_file):
            return {"success": False, "error": f"Labels file not found: {labels_file}"}
        
        with open(labels_file, "r") as f:
            labeled_data = json.load(f)
        
        print(f"📊 Loaded {len(labeled_data)} labeled examples")
        
        # Extract features and labels
        all_features = []
        all_root_cause_labels = []
        all_success_labels = []
        
        for item in labeled_data:
            # Each item should have: submission data + manual_label
            submission = item.get("submission", item)
            manual_label = item.get("manual_label") or item.get("root_cause_label")
            
            if not manual_label:
                continue
            
            features = self.feature_extractor.extract(
                submission=submission,
                user_history=item.get("user_history", []),
                problem_context=item.get("problem_context"),
                user_memory=item.get("user_memory"),
            )
            
            is_success = submission.get("verdict", "").lower() == "accepted"
            
            all_features.append(features)
            all_root_cause_labels.append(manual_label)
            all_success_labels.append(1 if is_success else 0)
        
        if len(all_features) < 50:
            return {"success": False, "error": f"Insufficient labeled data: {len(all_features)}"}
        
        # Convert to arrays
        X = np.vstack(all_features)
        y_root_cause = np.array(all_root_cause_labels)
        y_success = np.array(all_success_labels)
        
        print(f"   └─ Training on {len(X)} labeled examples")
        print(f"   └─ Label distribution: {Counter(y_root_cause)}")
        
        # Train
        metrics = self.model.fit(X, y_root_cause, y_success)
        
        # Save with special suffix
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_path = os.path.join(MODEL_DIR, f"mim_model_manual_{timestamp}.pkl")
        self.model.save(model_path)
        
        print(f"✅ Training complete!")
        print(f"   └─ Root Cause Accuracy: {metrics.get('root_cause_accuracy', 0):.2%}")
        
        return {
            "success": True,
            "samples": len(X),
            "metrics": metrics,
            "model_path": model_path,
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TRAINING WITH SYNTHETIC DATA (For initial bootstrap)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def train_with_synthetic_data(self, n_samples: int = 1000) -> Dict[str, Any]:
        """
        Train MIM with synthetic data for initial bootstrap.
        
        Useful when no real data is available yet.
        Creates realistic-looking feature distributions.
        """
        logger.info(f"🔄 Training with {n_samples} synthetic samples")
        
        np.random.seed(42)
        
        # Generate synthetic features
        X = np.random.rand(n_samples, 60).astype(np.float32)
        
        # Generate synthetic labels with realistic distribution
        # Root cause distribution (based on typical competitive programming)
        root_cause_probs = {
            "logic_error": 0.30,
            "boundary_condition_blindness": 0.20,
            "time_complexity_issue": 0.15,
            "off_by_one_error": 0.12,
            "wrong_data_structure": 0.08,
            "integer_overflow": 0.05,
            "recursion_issue": 0.05,
            "comparison_error": 0.03,
            "unknown": 0.02,
        }
        
        y_root_cause = np.random.choice(
            list(root_cause_probs.keys()),
            size=n_samples,
            p=list(root_cause_probs.values())
        )
        
        # Success is ~40% overall (typical competitive programming)
        y_success = np.random.binomial(1, 0.4, n_samples)
        
        # Add some feature-label correlations
        for i in range(n_samples):
            # TLE should have high nested loop features
            if y_root_cause[i] == "time_complexity_issue":
                X[i, 27] = np.random.uniform(0.6, 1.0)  # nested_loop_depth
                X[i, 0] = -0.3  # verdict = TLE
            
            # Boundary issues should lack boundary checks
            if y_root_cause[i] == "boundary_condition_blindness":
                X[i, 18] = np.random.uniform(0.0, 0.3)  # has_boundary_pattern
        
        print(f"   └─ Generated {n_samples} synthetic samples")
        
        # Train
        metrics = self.model.fit(X, y_root_cause, y_success)
        
        # Save
        model_path = self.model.save()
        
        print(f"✅ Synthetic training complete!")
        print(f"   └─ Root Cause Accuracy: {metrics.get('root_cause_accuracy', 0):.2%}")
        
        return {
            "success": True,
            "samples": n_samples,
            "metrics": metrics,
            "model_path": model_path,
            "note": "Trained on synthetic data - retrain with real data when available",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# CLI INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    """CLI entry point for training."""
    import argparse
    
    parser = argparse.ArgumentParser(description="MIM Model Training")
    parser.add_argument(
        "--mode", 
        choices=["mongodb", "manual", "synthetic"],
        default="synthetic",
        help="Training data source"
    )
    parser.add_argument(
        "--days", 
        type=int, 
        default=30,
        help="Days of data for MongoDB mode"
    )
    parser.add_argument(
        "--labels-file",
        type=str,
        help="Path to labels JSON for manual mode"
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=1000,
        help="Number of synthetic samples"
    )
    
    args = parser.parse_args()
    
    trainer = MIMTrainer()
    
    if args.mode == "mongodb":
        result = await trainer.train_from_mongodb(days_back=args.days)
    elif args.mode == "manual":
        if not args.labels_file:
            print("Error: --labels-file required for manual mode")
            return
        result = trainer.train_from_manual_labels(args.labels_file)
    else:
        result = trainer.train_with_synthetic_data(n_samples=args.samples)
    
    print(f"\nTraining Result: {json.dumps(result, indent=2, default=str)}")


if __name__ == "__main__":
    asyncio.run(main())
