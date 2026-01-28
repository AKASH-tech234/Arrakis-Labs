"""
Drift Detector (Phase 4.3)
==========================

Monitors for feature and prediction drift.

Types of drift:
- Feature drift: Input distribution changes
- Prediction drift: Output distribution changes
- Concept drift: Relationship between inputs/outputs changes

Uses KL divergence and statistical tests.
"""

import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
import numpy as np
from collections import Counter

logger = logging.getLogger(__name__)


@dataclass
class DriftReport:
    """Report of drift detection results."""
    check_type: str  # "feature" or "prediction"
    is_drifted: bool
    drift_score: float  # 0-1 (higher = more drift)
    threshold: float
    details: Dict[str, Any]
    timestamp: str
    recommendation: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DriftDetector:
    """
    Phase 4.3: Detects drift in MIM inputs and outputs.
    
    Safe defaults:
    - Alert at moderate drift
    - Block at severe drift
    """
    
    # Thresholds
    FEATURE_DRIFT_WARN = 0.15
    FEATURE_DRIFT_ALERT = 0.25
    PREDICTION_DRIFT_WARN = 0.10
    PREDICTION_DRIFT_ALERT = 0.20
    
    def __init__(self):
        self.baseline_feature_stats: Optional[Dict[str, Dict]] = None
        self.baseline_prediction_dist: Optional[Dict[str, float]] = None
    
    def set_baseline(
        self,
        feature_stats: Dict[str, Dict],
        prediction_dist: Dict[str, float],
    ) -> None:
        """Set baseline distributions from training data."""
        self.baseline_feature_stats = feature_stats
        self.baseline_prediction_dist = prediction_dist
        logger.info("Drift baseline set")
    
    def check_feature_drift(
        self,
        current_stats: Dict[str, Dict],
        features_to_check: Optional[List[str]] = None,
    ) -> DriftReport:
        """
        Check for feature drift against baseline.
        
        Uses normalized mean/std difference.
        """
        if not self.baseline_feature_stats:
            return DriftReport(
                check_type="feature",
                is_drifted=False,
                drift_score=0.0,
                threshold=self.FEATURE_DRIFT_ALERT,
                details={"error": "No baseline set"},
                timestamp=datetime.now(timezone.utc).isoformat(),
                recommendation="Set baseline first",
            )
        
        if features_to_check is None:
            features_to_check = list(self.baseline_feature_stats.keys())
        
        drift_scores = {}
        
        for feat in features_to_check:
            baseline = self.baseline_feature_stats.get(feat, {})
            current = current_stats.get(feat, {})
            
            if not baseline or not current:
                continue
            
            # Compare mean and std
            b_mean = baseline.get("mean", 0)
            b_std = baseline.get("std", 1)
            c_mean = current.get("mean", 0)
            c_std = current.get("std", 1)
            
            # Normalized difference
            if b_std > 0:
                mean_drift = abs(c_mean - b_mean) / b_std
            else:
                mean_drift = abs(c_mean - b_mean)
            
            if b_std > 0:
                std_drift = abs(c_std - b_std) / b_std
            else:
                std_drift = 0
            
            drift_scores[feat] = (mean_drift + std_drift) / 2
        
        if not drift_scores:
            overall_drift = 0.0
        else:
            overall_drift = np.mean(list(drift_scores.values()))
        
        # Top drifted features
        sorted_drift = sorted(drift_scores.items(), key=lambda x: x[1], reverse=True)
        top_drifted = sorted_drift[:5]
        
        is_drifted = overall_drift > self.FEATURE_DRIFT_ALERT
        
        if overall_drift > self.FEATURE_DRIFT_ALERT:
            recommendation = "ALERT: Significant feature drift detected. Consider retraining."
        elif overall_drift > self.FEATURE_DRIFT_WARN:
            recommendation = "WARNING: Moderate feature drift. Monitor closely."
        else:
            recommendation = "Feature distribution stable."
        
        return DriftReport(
            check_type="feature",
            is_drifted=is_drifted,
            drift_score=round(overall_drift, 4),
            threshold=self.FEATURE_DRIFT_ALERT,
            details={
                "features_checked": len(drift_scores),
                "top_drifted": top_drifted,
                "per_feature": drift_scores,
            },
            timestamp=datetime.now(timezone.utc).isoformat(),
            recommendation=recommendation,
        )
    
    def check_prediction_drift(
        self,
        current_predictions: List[str],
    ) -> DriftReport:
        """
        Check for prediction distribution drift.
        
        Uses KL divergence approximation.
        """
        if not self.baseline_prediction_dist:
            return DriftReport(
                check_type="prediction",
                is_drifted=False,
                drift_score=0.0,
                threshold=self.PREDICTION_DRIFT_ALERT,
                details={"error": "No baseline set"},
                timestamp=datetime.now(timezone.utc).isoformat(),
                recommendation="Set baseline first",
            )
        
        # Compute current distribution
        counter = Counter(current_predictions)
        total = len(current_predictions)
        current_dist = {k: v / total for k, v in counter.items()}
        
        # Compute KL divergence approximation
        # KL(P||Q) ≈ sum(P * log(P/Q))
        epsilon = 1e-10
        kl_div = 0.0
        
        all_classes = set(self.baseline_prediction_dist.keys()) | set(current_dist.keys())
        
        for cls in all_classes:
            p = current_dist.get(cls, epsilon)
            q = self.baseline_prediction_dist.get(cls, epsilon)
            kl_div += p * np.log(p / q)
        
        # Normalize to 0-1 range (rough approximation)
        drift_score = min(1.0, kl_div / 2.0)
        
        is_drifted = drift_score > self.PREDICTION_DRIFT_ALERT
        
        if drift_score > self.PREDICTION_DRIFT_ALERT:
            recommendation = "ALERT: Prediction distribution shifted significantly."
        elif drift_score > self.PREDICTION_DRIFT_WARN:
            recommendation = "WARNING: Prediction distribution showing drift."
        else:
            recommendation = "Prediction distribution stable."
        
        return DriftReport(
            check_type="prediction",
            is_drifted=is_drifted,
            drift_score=round(drift_score, 4),
            threshold=self.PREDICTION_DRIFT_ALERT,
            details={
                "baseline_dist": self.baseline_prediction_dist,
                "current_dist": current_dist,
                "kl_divergence": round(kl_div, 4),
                "sample_count": total,
            },
            timestamp=datetime.now(timezone.utc).isoformat(),
            recommendation=recommendation,
        )


# Global detector
_detector: Optional[DriftDetector] = None


def get_detector() -> DriftDetector:
    global _detector
    if _detector is None:
        _detector = DriftDetector()
    return _detector


def check_feature_drift(current_stats: Dict[str, Dict]) -> DriftReport:
    return get_detector().check_feature_drift(current_stats)


def check_prediction_drift(predictions: List[str]) -> DriftReport:
    return get_detector().check_prediction_drift(predictions)
