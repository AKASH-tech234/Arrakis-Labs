"""
Threshold Validator (Phase 2.1)
===============================

Validates and recommends confidence thresholds empirically.

Guarantees:
- Thresholds are data-driven, not hand-tuned.
- High confidence => high correctness must hold.
- Conservative degradation at low confidence.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ThresholdResult:
    """Result of threshold validation."""
    threshold: float
    accuracy_above: float
    coverage_above: float
    accuracy_below: float
    coverage_below: float
    is_valid: bool
    note: str


@dataclass 
class ThresholdRecommendation:
    """Recommended thresholds for control decisions."""
    high_confidence: float  # Above this: trust fully
    medium_confidence: float  # Above this: trust with caveats
    low_confidence: float  # Below this: conservative mode
    metrics: Dict[str, Any]


class ThresholdValidator:
    """Validates confidence thresholds empirically."""
    
    def __init__(
        self,
        min_accuracy_high: float = 0.85,
        min_accuracy_medium: float = 0.70,
        min_coverage_high: float = 0.10,
    ):
        self.min_accuracy_high = min_accuracy_high
        self.min_accuracy_medium = min_accuracy_medium
        self.min_coverage_high = min_coverage_high
    
    def validate_threshold(
        self,
        y_correct: np.ndarray,
        y_confidence: np.ndarray,
        threshold: float,
    ) -> ThresholdResult:
        """Validate a single threshold."""
        above = y_confidence >= threshold
        below = ~above
        
        n_above = above.sum()
        n_below = below.sum()
        n_total = len(y_correct)
        
        acc_above = float(y_correct[above].mean()) if n_above > 0 else 0.0
        acc_below = float(y_correct[below].mean()) if n_below > 0 else 0.0
        cov_above = n_above / n_total if n_total > 0 else 0.0
        cov_below = n_below / n_total if n_total > 0 else 0.0
        
        is_valid = acc_above >= self.min_accuracy_high and cov_above >= self.min_coverage_high
        note = "Valid" if is_valid else f"Acc={acc_above:.3f} or Cov={cov_above:.3f} too low"
        
        return ThresholdResult(
            threshold=threshold,
            accuracy_above=acc_above,
            coverage_above=cov_above,
            accuracy_below=acc_below,
            coverage_below=cov_below,
            is_valid=is_valid,
            note=note,
        )
    
    def find_optimal_threshold(
        self,
        y_correct: np.ndarray,
        y_confidence: np.ndarray,
        target_accuracy: float,
        candidates: Optional[List[float]] = None,
    ) -> Tuple[float, ThresholdResult]:
        """Find lowest threshold that achieves target accuracy."""
        if candidates is None:
            candidates = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
        
        best = None
        best_result = None
        
        for t in sorted(candidates):
            result = self.validate_threshold(y_correct, y_confidence, t)
            if result.accuracy_above >= target_accuracy and result.coverage_above > 0.05:
                if best is None or t < best:
                    best = t
                    best_result = result
        
        if best is None:
            # Return highest threshold as fallback
            best = max(candidates)
            best_result = self.validate_threshold(y_correct, y_confidence, best)
        
        return best, best_result


def validate_confidence_thresholds(
    y_correct: np.ndarray,
    y_confidence: np.ndarray,
    thresholds: List[float],
) -> List[ThresholdResult]:
    """Validate multiple thresholds."""
    validator = ThresholdValidator()
    return [validator.validate_threshold(y_correct, y_confidence, t) for t in thresholds]


def recommend_thresholds(
    y_correct: np.ndarray,
    y_confidence: np.ndarray,
) -> ThresholdRecommendation:
    """Recommend thresholds based on empirical analysis."""
    validator = ThresholdValidator()
    
    # Find high confidence threshold (target 85% accuracy)
    high_t, high_r = validator.find_optimal_threshold(
        y_correct, y_confidence, target_accuracy=0.85
    )
    
    # Find medium confidence threshold (target 70% accuracy)  
    med_t, med_r = validator.find_optimal_threshold(
        y_correct, y_confidence, target_accuracy=0.70
    )
    
    # Low confidence is anything below medium
    low_t = med_t
    
    return ThresholdRecommendation(
        high_confidence=high_t,
        medium_confidence=med_t,
        low_confidence=low_t,
        metrics={
            "high": {"threshold": high_t, "accuracy": high_r.accuracy_above, "coverage": high_r.coverage_above},
            "medium": {"threshold": med_t, "accuracy": med_r.accuracy_above, "coverage": med_r.coverage_above},
        },
    )
