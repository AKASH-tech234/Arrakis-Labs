"""
MIM Evaluation Pipeline - Training Metrics & Validation
========================================================

Implements:
- Cross-validation with user-aware splits (no user leakage)
- Confusion matrix generation
- ROC-AUC curves
- Precision@K for recommendations
"""

import numpy as np
import logging
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime
from collections import defaultdict
import json
import os

from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    roc_auc_score, confusion_matrix, classification_report,
    mean_absolute_error, mean_squared_error
)

logger = logging.getLogger("mim.evaluation")


class MIMEvaluator:
    """
    Comprehensive evaluation for MIM models.
    
    Features:
    - User-aware train/val/test splits (no leakage)
    - Multi-class metrics for root cause
    - Binary metrics for readiness
    - Ranking metrics for recommendations
    """
    
    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or os.path.join(
            os.path.dirname(__file__), "evaluation_results"
        )
        os.makedirs(self.output_dir, exist_ok=True)
        logger.info(f"MIMEvaluator initialized | output_dir={self.output_dir}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # USER-AWARE SPLITTING (NO LEAKAGE)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def user_aware_split(
        self,
        data: List[Dict[str, Any]],
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        user_key: str = "user_id",
        random_seed: int = 42
    ) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Split data ensuring no user appears in multiple splits.
        
        This prevents data leakage where model learns user-specific patterns
        during training that it then "cheats" with during validation.
        
        Args:
            data: List of data samples with user_key field
            train_ratio: Proportion of users for training
            val_ratio: Proportion of users for validation
            test_ratio: Proportion of users for testing
            user_key: Field name for user identifier
            random_seed: Random seed for reproducibility
        
        Returns:
            (train_data, val_data, test_data) - disjoint by user
        """
        np.random.seed(random_seed)
        
        # Group by user
        user_data = defaultdict(list)
        for item in data:
            user_id = item.get(user_key, "unknown")
            user_data[user_id].append(item)
        
        # Shuffle users
        users = list(user_data.keys())
        np.random.shuffle(users)
        
        # Split users
        n_users = len(users)
        train_end = int(n_users * train_ratio)
        val_end = int(n_users * (train_ratio + val_ratio))
        
        train_users = set(users[:train_end])
        val_users = set(users[train_end:val_end])
        test_users = set(users[val_end:])
        
        # Collect data
        train_data = [item for user in train_users for item in user_data[user]]
        val_data = [item for user in val_users for item in user_data[user]]
        test_data = [item for user in test_users for item in user_data[user]]
        
        logger.info(f"User-aware split: {len(train_users)} train users, "
                   f"{len(val_users)} val users, {len(test_users)} test users")
        logger.info(f"Samples: {len(train_data)} train, {len(val_data)} val, {len(test_data)} test")
        
        return train_data, val_data, test_data
    
    def user_aware_cross_validation(
        self,
        data: List[Dict[str, Any]],
        n_folds: int = 5,
        user_key: str = "user_id",
        random_seed: int = 42
    ) -> List[Tuple[List[int], List[int]]]:
        """
        Generate cross-validation folds with user-aware splitting.
        
        Returns:
            List of (train_indices, val_indices) tuples
        """
        np.random.seed(random_seed)
        
        # Group by user
        user_data = defaultdict(list)
        for idx, item in enumerate(data):
            user_id = item.get(user_key, "unknown")
            user_data[user_id].append(idx)
        
        users = list(user_data.keys())
        np.random.shuffle(users)
        
        # Create folds
        folds = []
        fold_size = len(users) // n_folds
        
        for i in range(n_folds):
            start = i * fold_size
            end = start + fold_size if i < n_folds - 1 else len(users)
            
            val_users = set(users[start:end])
            train_users = set(users) - val_users
            
            train_indices = [idx for user in train_users for idx in user_data[user]]
            val_indices = [idx for user in val_users for idx in user_data[user]]
            
            folds.append((train_indices, val_indices))
            logger.debug(f"Fold {i+1}: {len(train_indices)} train, {len(val_indices)} val samples")
        
        return folds
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ROOT CAUSE EVALUATION (MULTI-CLASS)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def evaluate_root_cause(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_proba: Optional[np.ndarray] = None,
        class_names: List[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate root cause classifier.
        
        Returns:
        - Accuracy, F1, Precision, Recall
        - Confusion matrix
        - Per-class metrics
        - ROC-AUC (if probabilities provided)
        """
        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
            "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
            "precision_weighted": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
            "recall_weighted": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
            "samples": len(y_true),
            "unique_classes": int(len(np.unique(y_true))),
        }
        
        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        metrics["confusion_matrix"] = cm.tolist()
        
        # Per-class report
        if class_names:
            try:
                report = classification_report(
                    y_true, y_pred, 
                    target_names=class_names, 
                    output_dict=True, 
                    zero_division=0
                )
                metrics["per_class"] = {k: v for k, v in report.items() if k in class_names}
            except Exception as e:
                logger.warning(f"Per-class report failed: {e}")
        
        # ROC-AUC (multi-class)
        if y_proba is not None and len(np.unique(y_true)) > 1:
            try:
                # One-vs-rest ROC-AUC
                metrics["roc_auc_ovr"] = float(roc_auc_score(
                    y_true, y_proba, multi_class="ovr", average="weighted"
                ))
            except Exception as e:
                logger.warning(f"ROC-AUC calculation failed: {e}")
                metrics["roc_auc_ovr"] = None
        
        return metrics
    
    # ═══════════════════════════════════════════════════════════════════════════
    # READINESS EVALUATION (BINARY/REGRESSION)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def evaluate_readiness(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_proba: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Evaluate readiness/success predictor (binary classification).
        """
        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "f1": float(f1_score(y_true, y_pred, zero_division=0)),
            "precision": float(precision_score(y_true, y_pred, zero_division=0)),
            "recall": float(recall_score(y_true, y_pred, zero_division=0)),
            "samples": len(y_true),
        }
        
        if y_proba is not None and len(np.unique(y_true)) > 1:
            try:
                metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba))
            except:
                metrics["roc_auc"] = None
        
        # Confusion matrix (2x2)
        cm = confusion_matrix(y_true, y_pred)
        metrics["confusion_matrix"] = cm.tolist()
        
        if cm.shape == (2, 2):
            metrics["true_negatives"] = int(cm[0, 0])
            metrics["false_positives"] = int(cm[0, 1])
            metrics["false_negatives"] = int(cm[1, 0])
            metrics["true_positives"] = int(cm[1, 1])
            
            # Additional derived metrics
            total = cm.sum()
            if total > 0:
                metrics["specificity"] = float(cm[0, 0] / (cm[0, 0] + cm[0, 1])) if (cm[0, 0] + cm[0, 1]) > 0 else 0.0
        
        return metrics
    
    def evaluate_regression(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray
    ) -> Dict[str, float]:
        """
        Evaluate regression predictions (e.g., learning readiness score).
        """
        return {
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
            "mse": float(mean_squared_error(y_true, y_pred)),
            "correlation": float(np.corrcoef(y_true, y_pred)[0, 1]) if len(y_true) > 1 else 0.0,
            "samples": len(y_true),
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # RECOMMENDATION EVALUATION (RANKING)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def evaluate_recommendations(
        self,
        test_cases: List[Dict[str, Any]],
        k_values: List[int] = [1, 3, 5, 10]
    ) -> Dict[str, float]:
        """
        Evaluate recommendation quality.
        
        test_cases format:
        [
            {
                "recommended": ["prob1", "prob2", ...],  # Ranked list
                "ground_truth": ["prob3", "prob1"],      # Actually solved
            }
        ]
        
        Metrics:
        - Precision@K: How many of top-K were actually solved
        - Recall@K: How many solved problems appear in top-K
        - NDCG@K: Normalized discounted cumulative gain
        - MRR: Mean reciprocal rank
        """
        metrics = {"test_cases": len(test_cases)}
        
        for k in k_values:
            precisions = []
            recalls = []
            ndcgs = []
            
            for case in test_cases:
                recommended = case.get("recommended", [])[:k]
                ground_truth = set(case.get("ground_truth", []))
                
                if not ground_truth:
                    continue
                
                hits = len(set(recommended) & ground_truth)
                precisions.append(hits / k if k > 0 else 0)
                recalls.append(hits / len(ground_truth) if ground_truth else 0)
                
                # NDCG
                dcg = 0.0
                for i, rec in enumerate(recommended):
                    if rec in ground_truth:
                        dcg += 1.0 / np.log2(i + 2)  # +2 because position is 0-indexed
                
                # Ideal DCG
                ideal_dcg = sum(1.0 / np.log2(i + 2) for i in range(min(k, len(ground_truth))))
                ndcg = dcg / ideal_dcg if ideal_dcg > 0 else 0.0
                ndcgs.append(ndcg)
            
            metrics[f"precision@{k}"] = float(np.mean(precisions)) if precisions else 0.0
            metrics[f"recall@{k}"] = float(np.mean(recalls)) if recalls else 0.0
            metrics[f"ndcg@{k}"] = float(np.mean(ndcgs)) if ndcgs else 0.0
        
        # MRR (Mean Reciprocal Rank)
        reciprocal_ranks = []
        for case in test_cases:
            recommended = case.get("recommended", [])
            ground_truth = set(case.get("ground_truth", []))
            
            for rank, prob in enumerate(recommended, 1):
                if prob in ground_truth:
                    reciprocal_ranks.append(1.0 / rank)
                    break
            else:
                reciprocal_ranks.append(0.0)
        
        metrics["mrr"] = float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0
        
        return metrics
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DIFFICULTY ADJUSTMENT EVALUATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def evaluate_difficulty_adjustment(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        class_names: List[str] = ["decrease", "maintain", "increase"]
    ) -> Dict[str, Any]:
        """
        Evaluate difficulty adjustment predictions (3-class).
        """
        metrics = self.evaluate_root_cause(y_true, y_pred, class_names=class_names)
        
        # Add ordinal error (how far off predictions are)
        ordinal_map = {"decrease": 0, "maintain": 1, "increase": 2}
        if all(isinstance(y, str) for y in y_true):
            y_true_ord = np.array([ordinal_map.get(y, 1) for y in y_true])
            y_pred_ord = np.array([ordinal_map.get(y, 1) for y in y_pred])
        else:
            y_true_ord = y_true
            y_pred_ord = y_pred
        
        metrics["mean_ordinal_error"] = float(np.mean(np.abs(y_true_ord - y_pred_ord)))
        
        return metrics
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FULL EVALUATION REPORT
    # ═══════════════════════════════════════════════════════════════════════════
    
    def generate_full_report(
        self,
        root_cause_results: Dict[str, Any] = None,
        readiness_results: Dict[str, Any] = None,
        recommendation_results: Dict[str, Any] = None,
        difficulty_results: Dict[str, Any] = None,
        save: bool = True
    ) -> Dict[str, Any]:
        """Generate and optionally save full evaluation report."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "model_version": "v2.0",
            "root_cause_classifier": root_cause_results or {},
            "readiness_predictor": readiness_results or {},
            "recommender": recommendation_results or {},
            "difficulty_adjustment": difficulty_results or {},
            "summary": {
                "root_cause_accuracy": (root_cause_results or {}).get("accuracy", 0),
                "root_cause_f1": (root_cause_results or {}).get("f1_macro", 0),
                "readiness_roc_auc": (readiness_results or {}).get("roc_auc", 0),
                "recommendation_precision@5": (recommendation_results or {}).get("precision@5", 0),
                "recommendation_mrr": (recommendation_results or {}).get("mrr", 0),
            }
        }
        
        if save:
            filepath = os.path.join(
                self.output_dir,
                f"evaluation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            )
            with open(filepath, "w") as f:
                json.dump(report, f, indent=2)
            logger.info(f"📊 Evaluation report saved to {filepath}")
        
        return report
    
    def print_summary(self, report: Dict[str, Any]):
        """Print human-readable summary."""
        print("\n" + "=" * 70)
        print("MIM EVALUATION SUMMARY")
        print("=" * 70)
        
        rc = report.get("root_cause_classifier", {})
        if rc:
            print(f"\n📊 ROOT CAUSE CLASSIFIER (15 classes):")
            print(f"   Accuracy:     {rc.get('accuracy', 0):.1%}")
            print(f"   F1 (macro):   {rc.get('f1_macro', 0):.1%}")
            print(f"   F1 (weighted):{rc.get('f1_weighted', 0):.1%}")
            if rc.get('roc_auc_ovr'):
                print(f"   ROC-AUC:      {rc.get('roc_auc_ovr'):.3f}")
            print(f"   Samples:      {rc.get('samples', 0)}")
        
        rd = report.get("readiness_predictor", {})
        if rd:
            print(f"\n📊 READINESS PREDICTOR (binary):")
            print(f"   Accuracy:     {rd.get('accuracy', 0):.1%}")
            print(f"   F1:           {rd.get('f1', 0):.1%}")
            print(f"   Precision:    {rd.get('precision', 0):.1%}")
            print(f"   Recall:       {rd.get('recall', 0):.1%}")
            if rd.get('roc_auc'):
                print(f"   ROC-AUC:      {rd.get('roc_auc'):.3f}")
        
        rec = report.get("recommender", {})
        if rec:
            print(f"\n📊 PROBLEM RECOMMENDER:")
            print(f"   Precision@5:  {rec.get('precision@5', 0):.1%}")
            print(f"   Recall@5:     {rec.get('recall@5', 0):.1%}")
            print(f"   NDCG@5:       {rec.get('ndcg@5', 0):.3f}")
            print(f"   MRR:          {rec.get('mrr', 0):.3f}")
        
        da = report.get("difficulty_adjustment", {})
        if da:
            print(f"\n📊 DIFFICULTY ADJUSTMENT (3 classes):")
            print(f"   Accuracy:     {da.get('accuracy', 0):.1%}")
            print(f"   F1 (macro):   {da.get('f1_macro', 0):.1%}")
            print(f"   Ordinal Err:  {da.get('mean_ordinal_error', 0):.2f}")
        
        print("\n" + "=" * 70)


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════════════════════

_evaluator_instance: Optional[MIMEvaluator] = None


def get_evaluator() -> MIMEvaluator:
    """Get singleton evaluator instance."""
    global _evaluator_instance
    if _evaluator_instance is None:
        _evaluator_instance = MIMEvaluator()
    return _evaluator_instance
