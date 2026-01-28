"""
Shadow Mode Evaluator (Phase 4.4)
=================================

Safe experimentation for new models.

Shadow mode:
- Run candidate model alongside production
- Log predictions without serving
- Compare offline
- Promote only if metrics pass

No user impact during evaluation.
"""

import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ShadowComparison:
    """Comparison between production and candidate models."""
    production_version: str
    candidate_version: str
    
    # Agreement metrics
    agreement_rate: float  # How often they agree
    
    # Performance (if labels available)
    production_accuracy: Optional[float]
    candidate_accuracy: Optional[float]
    accuracy_delta: Optional[float]
    
    # Confidence comparison
    production_avg_confidence: float
    candidate_avg_confidence: float
    
    # Recommendation
    should_promote: bool
    promotion_reason: str
    
    sample_count: int
    timestamp: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ShadowModeEvaluator:
    """
    Phase 4.4: Evaluates candidate models in shadow mode.
    
    Safe promotion criteria:
    - Accuracy >= production (if labels available)
    - Agreement rate reasonable
    - No significant confidence drop
    """
    
    # Promotion thresholds
    MIN_AGREEMENT_RATE = 0.85
    MAX_ACCURACY_REGRESSION = 0.02  # Allow 2% regression
    MIN_SAMPLE_COUNT = 100
    
    def __init__(self):
        self.shadow_log: List[Dict[str, Any]] = []
    
    def log_shadow_prediction(
        self,
        production_pred: str,
        production_conf: float,
        candidate_pred: str,
        candidate_conf: float,
        true_label: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> None:
        """Log a shadow prediction for later comparison."""
        self.shadow_log.append({
            "production_pred": production_pred,
            "production_conf": production_conf,
            "candidate_pred": candidate_pred,
            "candidate_conf": candidate_conf,
            "true_label": true_label,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    
    def compare(
        self,
        production_version: str,
        candidate_version: str,
    ) -> ShadowComparison:
        """Compare production and candidate based on shadow logs."""
        if len(self.shadow_log) < self.MIN_SAMPLE_COUNT:
            return ShadowComparison(
                production_version=production_version,
                candidate_version=candidate_version,
                agreement_rate=0.0,
                production_accuracy=None,
                candidate_accuracy=None,
                accuracy_delta=None,
                production_avg_confidence=0.0,
                candidate_avg_confidence=0.0,
                should_promote=False,
                promotion_reason=f"Insufficient samples ({len(self.shadow_log)} < {self.MIN_SAMPLE_COUNT})",
                sample_count=len(self.shadow_log),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        
        # Compute metrics
        agreements = 0
        prod_correct = 0
        cand_correct = 0
        has_labels = 0
        prod_confs = []
        cand_confs = []
        
        for entry in self.shadow_log:
            prod_confs.append(entry["production_conf"])
            cand_confs.append(entry["candidate_conf"])
            
            if entry["production_pred"] == entry["candidate_pred"]:
                agreements += 1
            
            if entry["true_label"]:
                has_labels += 1
                if entry["production_pred"] == entry["true_label"]:
                    prod_correct += 1
                if entry["candidate_pred"] == entry["true_label"]:
                    cand_correct += 1
        
        n = len(self.shadow_log)
        agreement_rate = agreements / n
        
        prod_accuracy = prod_correct / has_labels if has_labels > 0 else None
        cand_accuracy = cand_correct / has_labels if has_labels > 0 else None
        accuracy_delta = (cand_accuracy - prod_accuracy) if prod_accuracy and cand_accuracy else None
        
        prod_avg_conf = np.mean(prod_confs)
        cand_avg_conf = np.mean(cand_confs)
        
        # Determine promotion
        should_promote = True
        reasons = []
        
        if agreement_rate < self.MIN_AGREEMENT_RATE:
            should_promote = False
            reasons.append(f"Low agreement ({agreement_rate:.1%} < {self.MIN_AGREEMENT_RATE:.1%})")
        
        if accuracy_delta is not None and accuracy_delta < -self.MAX_ACCURACY_REGRESSION:
            should_promote = False
            reasons.append(f"Accuracy regression ({accuracy_delta:+.1%})")
        
        if cand_avg_conf < prod_avg_conf * 0.9:
            reasons.append(f"Confidence drop ({cand_avg_conf:.2f} vs {prod_avg_conf:.2f})")
        
        if should_promote:
            if accuracy_delta and accuracy_delta > 0.02:
                promotion_reason = f"Candidate improves accuracy by {accuracy_delta:+.1%}"
            else:
                promotion_reason = "Candidate matches production performance"
        else:
            promotion_reason = "; ".join(reasons)
        
        return ShadowComparison(
            production_version=production_version,
            candidate_version=candidate_version,
            agreement_rate=round(agreement_rate, 3),
            production_accuracy=round(prod_accuracy, 3) if prod_accuracy else None,
            candidate_accuracy=round(cand_accuracy, 3) if cand_accuracy else None,
            accuracy_delta=round(accuracy_delta, 3) if accuracy_delta else None,
            production_avg_confidence=round(prod_avg_conf, 3),
            candidate_avg_confidence=round(cand_avg_conf, 3),
            should_promote=should_promote,
            promotion_reason=promotion_reason,
            sample_count=n,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    
    def clear_log(self) -> int:
        """Clear shadow log, return count cleared."""
        count = len(self.shadow_log)
        self.shadow_log = []
        return count


# Global evaluator
_evaluator: Optional[ShadowModeEvaluator] = None


def get_evaluator() -> ShadowModeEvaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = ShadowModeEvaluator()
    return _evaluator


def run_shadow_comparison(
    production_version: str,
    candidate_version: str,
) -> ShadowComparison:
    return get_evaluator().compare(production_version, candidate_version)
