"""
Calibration Evaluator (Phase 2.1)
=================================

Computes calibration metrics for MIM model confidence scores.

Key metrics:
- Expected Calibration Error (ECE)
- Maximum Calibration Error (MCE)
- Reliability curves (confidence bins vs accuracy)
- Brier score decomposition

All evaluation is OFFLINE and deterministic.
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# Optional matplotlib import for visualization
try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend for server use
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    logger.warning("matplotlib not available; reliability diagrams will be data-only")


# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Default confidence bins for reliability curve
DEFAULT_BINS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

# ECE threshold for "well-calibrated" model
ECE_GOOD_THRESHOLD = 0.10
ECE_ACCEPTABLE_THRESHOLD = 0.15


# ═══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ReliabilityBin:
    """A single bin in the reliability diagram."""
    bin_start: float
    bin_end: float
    bin_center: float
    count: int
    accuracy: float
    mean_confidence: float
    gap: float  # |accuracy - mean_confidence|

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CalibrationResult:
    """Complete calibration evaluation result."""
    # Core metrics
    ece: float  # Expected Calibration Error
    mce: float  # Maximum Calibration Error
    brier_score: float
    
    # Reliability curve
    reliability_bins: List[ReliabilityBin]
    
    # Metadata
    total_samples: int
    correct_samples: int
    overall_accuracy: float
    
    # Assessment
    is_well_calibrated: bool
    calibration_quality: str  # "good", "acceptable", "poor"
    recommendations: List[str]
    
    # Provenance
    timestamp: str = ""
    model_version: Optional[str] = None
    dataset_info: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "metrics": {
                "ece": self.ece,
                "mce": self.mce,
                "brier_score": self.brier_score,
            },
            "reliability_curve": [b.to_dict() for b in self.reliability_bins],
            "summary": {
                "total_samples": self.total_samples,
                "correct_samples": self.correct_samples,
                "overall_accuracy": self.overall_accuracy,
                "is_well_calibrated": self.is_well_calibrated,
                "calibration_quality": self.calibration_quality,
            },
            "recommendations": self.recommendations,
            "provenance": {
                "timestamp": self.timestamp,
                "model_version": self.model_version,
                "dataset_info": self.dataset_info,
            },
        }
    
    def save(self, path: Path) -> None:
        """Save calibration result to JSON."""
        path.write_text(json.dumps(self.to_dict(), indent=2))
        logger.info(f"Calibration result saved to {path}")
    
    def print_summary(self) -> None:
        """Print human-readable summary."""
        print("\n" + "=" * 60)
        print("CALIBRATION EVALUATION RESULT")
        print("=" * 60)
        print(f"ECE (Expected Calibration Error): {self.ece:.4f}")
        print(f"MCE (Maximum Calibration Error):  {self.mce:.4f}")
        print(f"Brier Score:                      {self.brier_score:.4f}")
        print(f"Overall Accuracy:                 {self.overall_accuracy:.4f}")
        print(f"Calibration Quality:              {self.calibration_quality.upper()}")
        print()
        print("Reliability Curve:")
        print("-" * 50)
        print(f"{'Bin':>12} {'Count':>8} {'Accuracy':>10} {'Confidence':>12} {'Gap':>8}")
        print("-" * 50)
        for b in self.reliability_bins:
            if b.count > 0:
                print(f"[{b.bin_start:.1f}-{b.bin_end:.1f}] {b.count:>8} {b.accuracy:>10.3f} {b.mean_confidence:>12.3f} {b.gap:>8.3f}")
        print("-" * 50)
        print()
        if self.recommendations:
            print("Recommendations:")
            for r in self.recommendations:
                print(f"  • {r}")
        print("=" * 60)
    
    def plot_reliability_diagram(
        self,
        output_path: Optional[Path] = None,
        title: Optional[str] = None,
        show_gap: bool = True,
        show_histogram: bool = True,
    ) -> Optional[Path]:
        """
        Generate reliability diagram visualization.
        
        The reliability diagram is the canonical way to visualize calibration:
        - X-axis: Mean predicted confidence per bin
        - Y-axis: Actual accuracy per bin
        - Perfect calibration = diagonal line
        - Gap between bars and diagonal = miscalibration
        
        Parameters
        ----------
        output_path : Path, optional
            Where to save the plot. If None, saves to current directory.
        title : str, optional
            Plot title. Defaults to "Reliability Diagram".
        show_gap : bool
            Whether to shade the gap between accuracy and confidence.
        show_histogram : bool
            Whether to show sample count histogram below.
            
        Returns
        -------
        Path or None
            Path to saved figure, or None if matplotlib unavailable.
        """
        if not HAS_MATPLOTLIB:
            logger.warning("Cannot plot reliability diagram: matplotlib not available")
            return None
        
        # Filter to non-empty bins
        bins_with_data = [b for b in self.reliability_bins if b.count > 0]
        
        if not bins_with_data:
            logger.warning("No bins with data to plot")
            return None
        
        # Extract data
        confidences = [b.mean_confidence for b in bins_with_data]
        accuracies = [b.accuracy for b in bins_with_data]
        counts = [b.count for b in bins_with_data]
        bin_centers = [b.bin_center for b in bins_with_data]
        
        # Create figure
        if show_histogram:
            fig, (ax1, ax2) = plt.subplots(
                2, 1, figsize=(8, 8), 
                gridspec_kw={'height_ratios': [3, 1]},
                sharex=True
            )
        else:
            fig, ax1 = plt.subplots(1, 1, figsize=(8, 6))
            ax2 = None
        
        # Main reliability diagram
        ax1.set_xlim(0, 1)
        ax1.set_ylim(0, 1)
        
        # Perfect calibration line (diagonal)
        ax1.plot([0, 1], [0, 1], 'k--', linewidth=2, label='Perfect calibration')
        
        # Bar width based on bin size
        bar_width = 0.08
        
        # Plot accuracy bars
        bars = ax1.bar(
            confidences, accuracies, 
            width=bar_width, 
            alpha=0.7, 
            color='steelblue',
            edgecolor='black',
            linewidth=1,
            label='Actual accuracy'
        )
        
        # Show gap (miscalibration) as shaded region
        if show_gap:
            for conf, acc in zip(confidences, accuracies):
                if acc < conf:
                    # Overconfident: shade red
                    ax1.fill_between(
                        [conf - bar_width/2, conf + bar_width/2],
                        [acc, acc], [conf, conf],
                        alpha=0.3, color='red'
                    )
                elif acc > conf:
                    # Underconfident: shade green
                    ax1.fill_between(
                        [conf - bar_width/2, conf + bar_width/2],
                        [conf, conf], [acc, acc],
                        alpha=0.3, color='green'
                    )
        
        # Annotations
        ax1.set_ylabel('Accuracy', fontsize=12)
        ax1.set_title(
            title or f'Reliability Diagram (ECE={self.ece:.3f}, MCE={self.mce:.3f})',
            fontsize=14, fontweight='bold'
        )
        ax1.legend(loc='upper left')
        ax1.grid(True, alpha=0.3)
        
        # Add text annotation for calibration quality
        quality_colors = {'good': 'green', 'acceptable': 'orange', 'poor': 'red'}
        ax1.text(
            0.95, 0.05,
            f'Quality: {self.calibration_quality.upper()}',
            transform=ax1.transAxes,
            fontsize=11,
            verticalalignment='bottom',
            horizontalalignment='right',
            color=quality_colors.get(self.calibration_quality, 'black'),
            fontweight='bold',
            bbox=dict(boxstyle='round', facecolor='white', alpha=0.8)
        )
        
        # Histogram of sample counts per bin
        if show_histogram and ax2 is not None:
            ax2.bar(
                confidences, counts,
                width=bar_width,
                alpha=0.7,
                color='gray',
                edgecolor='black',
                linewidth=1
            )
            ax2.set_xlabel('Mean Predicted Confidence', fontsize=12)
            ax2.set_ylabel('Count', fontsize=12)
            ax2.set_title('Sample Distribution', fontsize=11)
            ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # Save figure
        if output_path is None:
            output_path = Path(f'reliability_diagram_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png')
        
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        
        logger.info(f"Reliability diagram saved to {output_path}")
        return output_path
    
    def plot_confidence_histogram(
        self,
        y_confidence: np.ndarray,
        y_correct: np.ndarray,
        output_path: Optional[Path] = None,
    ) -> Optional[Path]:
        """
        Plot confidence distribution split by correct/incorrect predictions.
        
        Useful for identifying overconfidence patterns.
        """
        if not HAS_MATPLOTLIB:
            logger.warning("Cannot plot: matplotlib not available")
            return None
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Split by correctness
        conf_correct = y_confidence[y_correct == 1]
        conf_incorrect = y_confidence[y_correct == 0]
        
        bins = np.linspace(0, 1, 21)
        
        ax.hist(
            conf_correct, bins=bins, alpha=0.7, 
            label=f'Correct (n={len(conf_correct)})', 
            color='green', edgecolor='black'
        )
        ax.hist(
            conf_incorrect, bins=bins, alpha=0.7,
            label=f'Incorrect (n={len(conf_incorrect)})',
            color='red', edgecolor='black'
        )
        
        ax.set_xlabel('Confidence', fontsize=12)
        ax.set_ylabel('Count', fontsize=12)
        ax.set_title('Confidence Distribution by Correctness', fontsize=14, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        # Add vertical line at mean confidence
        mean_conf = np.mean(y_confidence)
        ax.axvline(mean_conf, color='blue', linestyle='--', linewidth=2, 
                   label=f'Mean: {mean_conf:.2f}')
        ax.legend()
        
        if output_path is None:
            output_path = Path(f'confidence_histogram_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png')
        
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        
        logger.info(f"Confidence histogram saved to {output_path}")
        return output_path


# ═══════════════════════════════════════════════════════════════════════════════
# CORE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_reliability_curve(
    y_true: np.ndarray,
    y_confidence: np.ndarray,
    bins: List[float] = DEFAULT_BINS,
) -> List[ReliabilityBin]:
    """
    Compute reliability curve (calibration curve).
    
    Parameters
    ----------
    y_true : np.ndarray
        Binary array: 1 if prediction was correct, 0 otherwise
    y_confidence : np.ndarray
        Confidence scores (probabilities) for each prediction
    bins : List[float]
        Bin edges for grouping confidence scores
        
    Returns
    -------
    List[ReliabilityBin]
        Reliability data for each bin
    """
    reliability_bins = []
    
    for i in range(len(bins) - 1):
        bin_start = bins[i]
        bin_end = bins[i + 1]
        bin_center = (bin_start + bin_end) / 2
        
        # Find samples in this bin
        if i == len(bins) - 2:  # Last bin is inclusive on both ends
            mask = (y_confidence >= bin_start) & (y_confidence <= bin_end)
        else:
            mask = (y_confidence >= bin_start) & (y_confidence < bin_end)
        
        count = int(mask.sum())
        
        if count > 0:
            accuracy = float(y_true[mask].mean())
            mean_confidence = float(y_confidence[mask].mean())
            gap = abs(accuracy - mean_confidence)
        else:
            accuracy = 0.0
            mean_confidence = bin_center
            gap = 0.0
        
        reliability_bins.append(ReliabilityBin(
            bin_start=bin_start,
            bin_end=bin_end,
            bin_center=bin_center,
            count=count,
            accuracy=accuracy,
            mean_confidence=mean_confidence,
            gap=gap,
        ))
    
    return reliability_bins


def compute_ece(
    y_true: np.ndarray,
    y_confidence: np.ndarray,
    bins: List[float] = DEFAULT_BINS,
) -> float:
    """
    Compute Expected Calibration Error (ECE).
    
    ECE = sum over bins of (bin_weight * |accuracy - confidence|)
    
    A well-calibrated model has ECE close to 0.
    """
    reliability = compute_reliability_curve(y_true, y_confidence, bins)
    
    n = len(y_true)
    if n == 0:
        return 0.0
    
    ece = 0.0
    for b in reliability:
        if b.count > 0:
            weight = b.count / n
            ece += weight * b.gap
    
    return float(ece)


def compute_mce(
    y_true: np.ndarray,
    y_confidence: np.ndarray,
    bins: List[float] = DEFAULT_BINS,
) -> float:
    """
    Compute Maximum Calibration Error (MCE).
    
    MCE = max over bins of |accuracy - confidence|
    
    Identifies the worst-calibrated confidence region.
    """
    reliability = compute_reliability_curve(y_true, y_confidence, bins)
    
    mce = 0.0
    for b in reliability:
        if b.count > 0:
            mce = max(mce, b.gap)
    
    return float(mce)


def compute_brier_score(
    y_true: np.ndarray,
    y_confidence: np.ndarray,
) -> float:
    """
    Compute Brier score (mean squared error of probability estimates).
    
    Lower is better. Perfect calibration + perfect discrimination = 0.
    """
    if len(y_true) == 0:
        return 0.0
    
    return float(np.mean((y_confidence - y_true) ** 2))


# ═══════════════════════════════════════════════════════════════════════════════
# CALIBRATION EVALUATOR CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class CalibrationEvaluator:
    """
    Evaluates calibration quality of MIM model predictions.
    
    Usage:
        evaluator = CalibrationEvaluator()
        result = evaluator.evaluate(y_true, y_pred, y_confidence)
        result.print_summary()
    """
    
    def __init__(
        self,
        bins: List[float] = DEFAULT_BINS,
        ece_good_threshold: float = ECE_GOOD_THRESHOLD,
        ece_acceptable_threshold: float = ECE_ACCEPTABLE_THRESHOLD,
    ):
        self.bins = bins
        self.ece_good_threshold = ece_good_threshold
        self.ece_acceptable_threshold = ece_acceptable_threshold
    
    def evaluate(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_confidence: np.ndarray,
        model_version: Optional[str] = None,
        dataset_info: Optional[str] = None,
    ) -> CalibrationResult:
        """
        Evaluate calibration quality.
        
        Parameters
        ----------
        y_true : np.ndarray
            True labels
        y_pred : np.ndarray
            Predicted labels
        y_confidence : np.ndarray
            Confidence scores for predictions
        model_version : str, optional
            Model version for provenance
        dataset_info : str, optional
            Dataset description for provenance
            
        Returns
        -------
        CalibrationResult
            Complete calibration evaluation
        """
        # Convert to correctness indicator
        y_correct = (y_pred == y_true).astype(int)
        
        # Compute metrics
        ece = compute_ece(y_correct, y_confidence, self.bins)
        mce = compute_mce(y_correct, y_confidence, self.bins)
        brier = compute_brier_score(y_correct, y_confidence)
        
        # Reliability curve
        reliability = compute_reliability_curve(y_correct, y_confidence, self.bins)
        
        # Summary stats
        total = len(y_true)
        correct = int(y_correct.sum())
        accuracy = correct / total if total > 0 else 0.0
        
        # Assessment
        if ece <= self.ece_good_threshold:
            quality = "good"
            is_well_calibrated = True
        elif ece <= self.ece_acceptable_threshold:
            quality = "acceptable"
            is_well_calibrated = True
        else:
            quality = "poor"
            is_well_calibrated = False
        
        # Recommendations
        recommendations = self._generate_recommendations(
            ece, mce, reliability, accuracy
        )
        
        return CalibrationResult(
            ece=ece,
            mce=mce,
            brier_score=brier,
            reliability_bins=reliability,
            total_samples=total,
            correct_samples=correct,
            overall_accuracy=accuracy,
            is_well_calibrated=is_well_calibrated,
            calibration_quality=quality,
            recommendations=recommendations,
            timestamp=datetime.utcnow().isoformat(),
            model_version=model_version,
            dataset_info=dataset_info,
        )
    
    def _generate_recommendations(
        self,
        ece: float,
        mce: float,
        reliability: List[ReliabilityBin],
        accuracy: float,
    ) -> List[str]:
        """Generate actionable recommendations based on calibration analysis."""
        recommendations = []
        
        # ECE-based recommendations
        if ece > self.ece_acceptable_threshold:
            recommendations.append(
                f"ECE ({ece:.3f}) exceeds acceptable threshold ({self.ece_acceptable_threshold}). "
                "Apply isotonic regression or Platt scaling to improve calibration."
            )
        
        # MCE-based recommendations
        if mce > 0.25:
            # Find worst bin
            worst_bin = max(reliability, key=lambda b: b.gap if b.count > 0 else 0)
            if worst_bin.count > 0:
                recommendations.append(
                    f"High MCE ({mce:.3f}) in bin [{worst_bin.bin_start:.1f}-{worst_bin.bin_end:.1f}]. "
                    f"This region is {'overconfident' if worst_bin.mean_confidence > worst_bin.accuracy else 'underconfident'}."
                )
        
        # Overconfidence check
        high_conf_bins = [b for b in reliability if b.bin_start >= 0.8 and b.count > 0]
        for b in high_conf_bins:
            if b.accuracy < b.mean_confidence - 0.15:
                recommendations.append(
                    f"Overconfidence detected: bin [{b.bin_start:.1f}-{b.bin_end:.1f}] has "
                    f"confidence {b.mean_confidence:.3f} but accuracy only {b.accuracy:.3f}."
                )
        
        # Underconfidence check
        low_conf_bins = [b for b in reliability if b.bin_end <= 0.5 and b.count > 0]
        for b in low_conf_bins:
            if b.accuracy > b.mean_confidence + 0.15:
                recommendations.append(
                    f"Underconfidence detected: bin [{b.bin_start:.1f}-{b.bin_end:.1f}] has "
                    f"confidence {b.mean_confidence:.3f} but accuracy {b.accuracy:.3f}."
                )
        
        # Overall accuracy vs confidence
        avg_confidence = np.mean([b.mean_confidence for b in reliability if b.count > 0])
        if abs(accuracy - avg_confidence) > 0.1:
            if accuracy > avg_confidence:
                recommendations.append(
                    f"Model is systematically underconfident: accuracy={accuracy:.3f}, avg_confidence={avg_confidence:.3f}."
                )
            else:
                recommendations.append(
                    f"Model is systematically overconfident: accuracy={accuracy:.3f}, avg_confidence={avg_confidence:.3f}."
                )
        
        if not recommendations:
            recommendations.append("Model calibration is acceptable. No immediate action required.")
        
        return recommendations
    
    def evaluate_from_model_predictions(
        self,
        df,
        model,
        label_col: str = "root_cause",
        model_version: Optional[str] = None,
    ) -> CalibrationResult:
        """
        Convenience method to evaluate calibration directly from a DataFrame and model.
        
        Parameters
        ----------
        df : pd.DataFrame
            DataFrame with features and labels
        model : trained model with predict_proba
        label_col : str
            Name of label column
        model_version : str, optional
            Model version for provenance
            
        Returns
        -------
        CalibrationResult
        """
        from app.mim.training.train_models import ROOT_CAUSE_FEATURES, CODE_SIGNAL_FEATURES, CATEGORICAL_FEATURES
        from sklearn.preprocessing import LabelEncoder
        import pandas as pd
        
        # Prepare features (same as training)
        X_delta = df[ROOT_CAUSE_FEATURES].values
        
        cat_encoder = LabelEncoder()
        diff_encoder = LabelEncoder()
        cat_encoder.fit(df["category"].fillna("unknown"))
        diff_encoder.fit(df["difficulty"].fillna("unknown"))
        cat_encoded = cat_encoder.transform(df["category"].fillna("unknown")).reshape(-1, 1)
        diff_encoded = diff_encoder.transform(df["difficulty"].fillna("unknown")).reshape(-1, 1)
        
        if all(c in df.columns for c in CODE_SIGNAL_FEATURES):
            X_code = df[CODE_SIGNAL_FEATURES].values
        else:
            X_code = np.zeros((len(df), len(CODE_SIGNAL_FEATURES)))
        
        X = np.hstack([X_delta, cat_encoded, diff_encoded, X_code])
        
        # Get labels
        label_encoder = LabelEncoder()
        label_encoder.fit(["correctness", "efficiency", "implementation", "understanding_gap"])
        y_true = label_encoder.transform(df[label_col])
        
        # Get predictions
        y_prob = model.predict(X)
        y_pred = np.argmax(y_prob, axis=1)
        y_confidence = np.max(y_prob, axis=1)
        
        return self.evaluate(
            y_true=y_true,
            y_pred=y_pred,
            y_confidence=y_confidence,
            model_version=model_version,
            dataset_info=f"n={len(df)}",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# STANDALONE PLOTTING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def plot_reliability_diagram(
    y_correct: np.ndarray,
    y_confidence: np.ndarray,
    output_path: Optional[Path] = None,
    title: Optional[str] = None,
    bins: List[float] = DEFAULT_BINS,
) -> Optional[Path]:
    """
    Standalone function to plot reliability diagram.
    
    Parameters
    ----------
    y_correct : np.ndarray
        Binary array (1 = correct prediction, 0 = incorrect)
    y_confidence : np.ndarray
        Predicted confidence scores
    output_path : Path, optional
        Where to save the plot
    title : str, optional
        Plot title
    bins : List[float]
        Bin edges for grouping
        
    Returns
    -------
    Path or None
        Path to saved figure
    """
    evaluator = CalibrationEvaluator(bins=bins)
    # Create dummy y_true/y_pred from y_correct
    y_true = np.zeros(len(y_correct))
    y_pred = y_correct.copy()  # When correct=1, pred==true
    
    result = evaluator.evaluate(y_true, y_pred, y_confidence)
    return result.plot_reliability_diagram(output_path=output_path, title=title)


def plot_calibration_comparison(
    results: List[Tuple[str, CalibrationResult]],
    output_path: Optional[Path] = None,
) -> Optional[Path]:
    """
    Plot multiple calibration results for comparison (e.g., before/after).
    
    Parameters
    ----------
    results : List[Tuple[str, CalibrationResult]]
        List of (label, result) pairs to compare
    output_path : Path, optional
        Where to save the plot
        
    Returns
    -------
    Path or None
        Path to saved figure
    """
    if not HAS_MATPLOTLIB:
        logger.warning("Cannot plot: matplotlib not available")
        return None
    
    if len(results) < 2:
        logger.warning("Need at least 2 results to compare")
        return None
    
    n_results = len(results)
    fig, axes = plt.subplots(1, n_results, figsize=(6 * n_results, 5))
    
    if n_results == 2:
        axes = [axes[0], axes[1]]
    
    colors = ['steelblue', 'darkorange', 'green', 'red']
    
    for idx, (label, result) in enumerate(results):
        ax = axes[idx]
        bins_with_data = [b for b in result.reliability_bins if b.count > 0]
        
        if not bins_with_data:
            continue
        
        confidences = [b.mean_confidence for b in bins_with_data]
        accuracies = [b.accuracy for b in bins_with_data]
        
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        
        # Perfect calibration line
        ax.plot([0, 1], [0, 1], 'k--', linewidth=2, label='Perfect')
        
        # Accuracy bars
        ax.bar(
            confidences, accuracies,
            width=0.08, alpha=0.7,
            color=colors[idx % len(colors)],
            edgecolor='black', linewidth=1
        )
        
        ax.set_xlabel('Confidence', fontsize=11)
        ax.set_ylabel('Accuracy', fontsize=11)
        ax.set_title(f'{label}\nECE={result.ece:.3f}', fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3)
    
    plt.suptitle('Calibration Comparison', fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    if output_path is None:
        output_path = Path(f'calibration_comparison_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png')
    
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    logger.info(f"Calibration comparison saved to {output_path}")
    return output_path
