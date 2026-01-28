"""
Calibration Wrapper (Phase 2.1)
===============================

Provides post-hoc calibration methods for MIM model confidence scores.

Methods:
- Isotonic Regression: Non-parametric, preserves ranking
- Platt Scaling: Parametric (logistic), works well with small data

All calibration is OFFLINE and applied after model training.
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# ISOTONIC REGRESSION CALIBRATION
# ═══════════════════════════════════════════════════════════════════════════════

def apply_isotonic_calibration(
    y_true: np.ndarray,
    y_confidence: np.ndarray,
) -> Tuple[Any, np.ndarray]:
    """
    Fit isotonic regression calibrator.
    
    Parameters
    ----------
    y_true : np.ndarray
        Binary correctness indicators (1 = correct, 0 = incorrect)
    y_confidence : np.ndarray
        Raw confidence scores
        
    Returns
    -------
    Tuple[IsotonicRegression, np.ndarray]
        (fitted calibrator, calibrated confidence scores)
    """
    from sklearn.isotonic import IsotonicRegression
    
    ir = IsotonicRegression(out_of_bounds="clip")
    ir.fit(y_confidence, y_true)
    
    calibrated = ir.predict(y_confidence)
    
    return ir, calibrated


def apply_platt_calibration(
    y_true: np.ndarray,
    y_confidence: np.ndarray,
) -> Tuple[Any, np.ndarray]:
    """
    Fit Platt scaling (logistic regression) calibrator.
    
    Parameters
    ----------
    y_true : np.ndarray
        Binary correctness indicators (1 = correct, 0 = incorrect)
    y_confidence : np.ndarray
        Raw confidence scores
        
    Returns
    -------
    Tuple[LogisticRegression, np.ndarray]
        (fitted calibrator, calibrated confidence scores)
    """
    from sklearn.linear_model import LogisticRegression
    
    # Reshape for sklearn
    X = y_confidence.reshape(-1, 1)
    
    lr = LogisticRegression(solver="lbfgs", max_iter=1000)
    lr.fit(X, y_true)
    
    calibrated = lr.predict_proba(X)[:, 1]
    
    return lr, calibrated


# ═══════════════════════════════════════════════════════════════════════════════
# CALIBRATION WRAPPER CLASS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CalibrationStats:
    """Statistics about calibration transformation."""
    method: str
    ece_before: float
    ece_after: float
    improvement: float
    n_samples: int


class CalibrationWrapper:
    """
    Wraps a trained model with post-hoc confidence calibration.
    
    Usage:
        # Train calibrator on validation set
        wrapper = CalibrationWrapper(method="isotonic")
        wrapper.fit(y_correct_val, confidence_val)
        
        # Apply to new predictions
        calibrated_conf = wrapper.transform(raw_confidence)
    """
    
    METHODS = {"isotonic", "platt"}
    
    def __init__(self, method: str = "isotonic"):
        if method not in self.METHODS:
            raise ValueError(f"method must be one of {self.METHODS}")
        
        self.method = method
        self.calibrator = None
        self.is_fitted = False
        self.stats: Optional[CalibrationStats] = None
    
    def fit(
        self,
        y_correct: np.ndarray,
        y_confidence: np.ndarray,
    ) -> "CalibrationWrapper":
        """
        Fit the calibrator on validation data.
        
        Parameters
        ----------
        y_correct : np.ndarray
            Binary correctness indicators (1 = correct, 0 = incorrect)
        y_confidence : np.ndarray
            Raw confidence scores from model
            
        Returns
        -------
        self
        """
        from .evaluator import compute_ece
        
        # Compute pre-calibration ECE
        ece_before = compute_ece(y_correct, y_confidence)
        
        # Fit calibrator
        if self.method == "isotonic":
            self.calibrator, calibrated = apply_isotonic_calibration(y_correct, y_confidence)
        else:
            self.calibrator, calibrated = apply_platt_calibration(y_correct, y_confidence)
        
        # Compute post-calibration ECE
        ece_after = compute_ece(y_correct, calibrated)
        
        self.is_fitted = True
        self.stats = CalibrationStats(
            method=self.method,
            ece_before=ece_before,
            ece_after=ece_after,
            improvement=ece_before - ece_after,
            n_samples=len(y_correct),
        )
        
        logger.info(
            f"CalibrationWrapper fitted: method={self.method}, "
            f"ECE {ece_before:.4f} → {ece_after:.4f} "
            f"(improvement: {self.stats.improvement:.4f})"
        )
        
        return self
    
    def transform(self, y_confidence: np.ndarray) -> np.ndarray:
        """
        Apply calibration to raw confidence scores.
        
        Parameters
        ----------
        y_confidence : np.ndarray
            Raw confidence scores
            
        Returns
        -------
        np.ndarray
            Calibrated confidence scores
        """
        if not self.is_fitted:
            logger.warning("CalibrationWrapper not fitted, returning raw confidence")
            return y_confidence
        
        if self.method == "isotonic":
            return self.calibrator.predict(y_confidence)
        else:
            return self.calibrator.predict_proba(y_confidence.reshape(-1, 1))[:, 1]
    
    def fit_transform(
        self,
        y_correct: np.ndarray,
        y_confidence: np.ndarray,
    ) -> np.ndarray:
        """Fit and transform in one step."""
        self.fit(y_correct, y_confidence)
        return self.transform(y_confidence)
    
    def save(self, path: str) -> None:
        """Save calibrator to disk."""
        import joblib
        
        data = {
            "method": self.method,
            "calibrator": self.calibrator,
            "is_fitted": self.is_fitted,
            "stats": self.stats,
        }
        joblib.dump(data, path)
        logger.info(f"CalibrationWrapper saved to {path}")
    
    @classmethod
    def load(cls, path: str) -> "CalibrationWrapper":
        """Load calibrator from disk."""
        import joblib
        
        data = joblib.load(path)
        wrapper = cls(method=data["method"])
        wrapper.calibrator = data["calibrator"]
        wrapper.is_fitted = data["is_fitted"]
        wrapper.stats = data["stats"]
        
        logger.info(f"CalibrationWrapper loaded from {path}")
        return wrapper
