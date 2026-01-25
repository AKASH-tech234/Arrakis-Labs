#!/usr/bin/env python3
"""
MIM v3.0 Production Validation Script
======================================

Replays historical submissions to validate MIM prediction accuracy against
ground truth labels.

Features:
- Load historical submissions from MongoDB
- Run MIM decision engine on each submission
- Compare predicted root_cause vs actual labeled root_cause
- Generate accuracy report by category
- Export results for analysis

Usage:
    python scripts/validate_production.py --limit 100
    python scripts/validate_production.py --category Array --limit 50
    python scripts/validate_production.py --dry-run  # Show what would be validated

Requirements:
    pip install pymongo pandas tabulate
"""

import argparse
import json
import sys
import time
import warnings
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Suppress sklearn/LightGBM feature name warnings
warnings.filterwarnings("ignore", message=".*feature names.*")
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Optional imports
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Root cause categories defined in MIM v3.0
ROOT_CAUSE_CATEGORIES = [
    "off_by_one_error",
    "boundary_condition_blindness",
    "null_pointer_neglect",
    "time_complexity_underestimation",
    "space_complexity_bloat",
    "recursion_confusion",
    "base_case_blindness",
    "floating_point_fiasco",
    "integer_overflow",
    "modular_arithmetic_mishap",
    "string_encoding_debacle",
    "graph_traversal_trap",
    "data_structure_misuse",
    "greedy_greed",
    "dp_state_confusion",
    "syntax_slip",
    "algorithm_misfit",
    "unknown",
]

# Mapping from verdict to likely root causes (for heuristic matching)
VERDICT_TO_CAUSES = {
    "wrong_answer": [
        "off_by_one_error",
        "boundary_condition_blindness",
        "algorithm_misfit",
        "greedy_greed",
        "dp_state_confusion",
    ],
    "runtime_error": [
        "null_pointer_neglect",
        "boundary_condition_blindness",
        "recursion_confusion",
        "integer_overflow",
    ],
    "time_limit_exceeded": [
        "time_complexity_underestimation",
        "recursion_confusion",
        "data_structure_misuse",
    ],
    "memory_limit_exceeded": [
        "space_complexity_bloat",
        "recursion_confusion",
        "data_structure_misuse",
    ],
    "compile_error": [
        "syntax_slip",
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ValidationResult:
    """Result of validating a single submission."""
    submission_id: str
    user_id: str
    problem_id: str
    problem_category: str
    verdict: str
    predicted_root_cause: str
    actual_root_cause: Optional[str]
    confidence: float
    is_correct: bool
    is_partial_match: bool
    inference_time_ms: float
    error: Optional[str] = None


@dataclass
class CategoryMetrics:
    """Metrics for a single problem category."""
    total: int = 0
    correct: int = 0
    partial_match: int = 0
    unknown: int = 0
    confidences: List[float] = field(default_factory=list)
    
    @property
    def accuracy(self) -> float:
        if self.total == 0:
            return 0.0
        return (self.correct / self.total) * 100
    
    @property
    def accuracy_with_partial(self) -> float:
        if self.total == 0:
            return 0.0
        return ((self.correct + self.partial_match) / self.total) * 100
    
    @property
    def avg_confidence(self) -> float:
        if not self.confidences:
            return 0.0
        return sum(self.confidences) / len(self.confidences)


@dataclass
class ValidationReport:
    """Aggregated validation report."""
    total_submissions: int = 0
    total_correct: int = 0
    total_partial: int = 0
    total_unknown: int = 0
    total_errors: int = 0
    by_category: Dict[str, CategoryMetrics] = field(default_factory=lambda: defaultdict(CategoryMetrics))
    by_root_cause: Dict[str, Dict[str, int]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))
    inference_times_ms: List[float] = field(default_factory=list)
    results: List[ValidationResult] = field(default_factory=list)
    
    @property
    def overall_accuracy(self) -> float:
        if self.total_submissions == 0:
            return 0.0
        return (self.total_correct / self.total_submissions) * 100
    
    @property
    def accuracy_with_partial(self) -> float:
        if self.total_submissions == 0:
            return 0.0
        return ((self.total_correct + self.total_partial) / self.total_submissions) * 100
    
    @property
    def avg_inference_time_ms(self) -> float:
        if not self.inference_times_ms:
            return 0.0
        return sum(self.inference_times_ms) / len(self.inference_times_ms)


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

class ProductionValidator:
    """Validates MIM predictions against historical submissions."""
    
    def __init__(
        self,
        mongodb_uri: str = "mongodb://localhost:27017",
        db_name: str = "arrakis",
        collection_name: str = "submissions",
    ):
        self.mongodb_uri = mongodb_uri
        self.db_name = db_name
        self.collection_name = collection_name
        self.report = ValidationReport()
        self._db = None
        self._mim_engine = None
    
    def _connect_db(self):
        """Connect to MongoDB."""
        try:
            from pymongo import MongoClient
            client = MongoClient(self.mongodb_uri, serverSelectionTimeoutMS=5000)
            client.admin.command('ping')  # Verify connection
            self._db = client[self.db_name]
            return True
        except Exception as e:
            print(f"⚠️  Could not connect to MongoDB: {e}")
            return False
    
    def _init_mim_engine(self):
        """Initialize MIM decision engine."""
        try:
            from app.mim.decision_engine import MIMDecisionEngine
            self._mim_engine = MIMDecisionEngine()
            return True
        except ImportError as e:
            print(f"⚠️  Could not import MIM engine: {e}")
            return False
    
    def _get_ground_truth(self, submission: Dict[str, Any]) -> Optional[str]:
        """Extract ground truth root cause from submission."""
        # Check for explicit label
        if "root_cause" in submission and submission["root_cause"]:
            return submission["root_cause"]
        
        # Check for labeled_root_cause field
        if "labeled_root_cause" in submission:
            return submission["labeled_root_cause"]
        
        # Check error_type mapping
        error_type = submission.get("error_type", "")
        if error_type:
            error_type_map = {
                "index_out_of_bounds": "boundary_condition_blindness",
                "off_by_one": "off_by_one_error",
                "null_pointer": "null_pointer_neglect",
                "timeout": "time_complexity_underestimation",
                "memory": "space_complexity_bloat",
                "recursion": "recursion_confusion",
                "syntax": "syntax_slip",
                "logical_error": None,  # Need more context
                "edge_case_handling": "boundary_condition_blindness",
                "infinite_loop": "recursion_confusion",
            }
            return error_type_map.get(error_type)
        
        return None
    
    def _is_partial_match(
        self,
        predicted: str,
        actual: str,
        verdict: str,
    ) -> bool:
        """Check if prediction is a partial/related match."""
        if predicted == actual:
            return True
        
        # Related causes
        related_groups = [
            {"off_by_one_error", "boundary_condition_blindness"},
            {"recursion_confusion", "base_case_blindness"},
            {"time_complexity_underestimation", "data_structure_misuse"},
            {"greedy_greed", "algorithm_misfit", "dp_state_confusion"},
        ]
        
        for group in related_groups:
            if predicted in group and actual in group:
                return True
        
        # Check if prediction matches verdict heuristics
        verdict_causes = VERDICT_TO_CAUSES.get(verdict, [])
        if predicted in verdict_causes and actual in verdict_causes:
            return True
        
        return False
    
    def validate_submission(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]] = None,
    ) -> ValidationResult:
        """Validate MIM prediction for a single submission."""
        from app.mim.decision_engine import make_decision
        
        submission_id = str(submission.get("_id", submission.get("id", "unknown")))
        user_id = submission.get("user_id", "unknown")
        problem_id = submission.get("problem_id", "unknown")
        problem_category = submission.get("problem_category", "Unknown")
        verdict = submission.get("verdict", "unknown")
        
        # Get ground truth
        actual_root_cause = self._get_ground_truth(submission)
        
        try:
            # Run MIM decision
            start = time.perf_counter()
            decision = make_decision(
                submission=submission,
                user_history=user_history or [],
                problem_context={
                    "title": submission.get("problem_title", problem_id),
                    "difficulty": submission.get("difficulty", "Unknown"),
                    "tags": submission.get("tags", []),
                },
                user_memory=None,
                user_profile=None,
            )
            inference_time_ms = (time.perf_counter() - start) * 1000
            
            predicted = decision.root_cause
            confidence = decision.root_cause_confidence
            
            # Determine if correct
            if actual_root_cause:
                is_correct = predicted == actual_root_cause
                is_partial = self._is_partial_match(predicted, actual_root_cause, verdict)
            else:
                # No ground truth available
                is_correct = False
                is_partial = False
            
            return ValidationResult(
                submission_id=submission_id,
                user_id=user_id,
                problem_id=problem_id,
                problem_category=problem_category,
                verdict=verdict,
                predicted_root_cause=predicted,
                actual_root_cause=actual_root_cause,
                confidence=confidence,
                is_correct=is_correct,
                is_partial_match=is_partial and not is_correct,
                inference_time_ms=inference_time_ms,
            )
        except Exception as e:
            return ValidationResult(
                submission_id=submission_id,
                user_id=user_id,
                problem_id=problem_id,
                problem_category=problem_category,
                verdict=verdict,
                predicted_root_cause="error",
                actual_root_cause=actual_root_cause,
                confidence=0.0,
                is_correct=False,
                is_partial_match=False,
                inference_time_ms=0.0,
                error=str(e),
            )
    
    def load_submissions(
        self,
        limit: int = 100,
        category: Optional[str] = None,
        verdict: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Load historical submissions from MongoDB."""
        if self._db is None:
            if not self._connect_db():
                # Return sample submissions for testing
                return self._get_sample_submissions(limit)
        
        try:
            collection = self._db[self.collection_name]
            
            # Build query
            query = {"verdict": {"$ne": "accepted"}}  # Only wrong submissions
            if category:
                query["problem_category"] = category
            if verdict:
                query["verdict"] = verdict
            
            # Fetch submissions
            submissions = list(
                collection.find(query).sort("created_at", -1).limit(limit)
            )
            
            print(f"📥 Loaded {len(submissions)} submissions from MongoDB")
            return submissions
            
        except Exception as e:
            print(f"⚠️  Error loading submissions: {e}")
            return self._get_sample_submissions(limit)
    
    def _get_sample_submissions(self, limit: int) -> List[Dict[str, Any]]:
        """Get sample submissions for testing when DB is unavailable."""
        print("📥 Using sample submissions for validation")
        
        samples = [
            {
                "id": "sample_1",
                "user_id": "user_1",
                "problem_id": "two_sum",
                "problem_category": "Array",
                "verdict": "wrong_answer",
                "error_type": "off_by_one",
                "code": "for i in range(n+1): arr[i]",
                "root_cause": "off_by_one_error",
            },
            {
                "id": "sample_2",
                "user_id": "user_2",
                "problem_id": "binary_search",
                "problem_category": "Array",
                "verdict": "runtime_error",
                "error_type": "index_out_of_bounds",
                "code": "arr[len(arr)]",
                "root_cause": "boundary_condition_blindness",
            },
            {
                "id": "sample_3",
                "user_id": "user_1",
                "problem_id": "merge_sort",
                "problem_category": "Sorting",
                "verdict": "time_limit_exceeded",
                "error_type": "timeout",
                "code": "def merge(a, b): return sorted(a+b)",
                "root_cause": "time_complexity_underestimation",
            },
            {
                "id": "sample_4",
                "user_id": "user_3",
                "problem_id": "dfs",
                "problem_category": "Graph",
                "verdict": "memory_limit_exceeded",
                "error_type": "memory",
                "code": "def dfs(node): dfs(node.left); dfs(node.right)",
                "root_cause": "recursion_confusion",
            },
            {
                "id": "sample_5",
                "user_id": "user_2",
                "problem_id": "coin_change",
                "problem_category": "DP",
                "verdict": "wrong_answer",
                "error_type": "logical_error",
                "code": "dp[i] = min(dp[i-coin])+1",
                "root_cause": "dp_state_confusion",
            },
        ]
        
        # Repeat samples to reach limit
        result = []
        for i in range(limit):
            sample = samples[i % len(samples)].copy()
            sample["id"] = f"{sample['id']}_{i}"
            result.append(sample)
        
        return result
    
    def run_validation(
        self,
        limit: int = 100,
        category: Optional[str] = None,
        verdict: Optional[str] = None,
        verbose: bool = False,
    ):
        """Run validation on historical submissions."""
        print(f"\n🔬 Starting MIM v3.0 Production Validation")
        print(f"   Limit: {limit}, Category: {category or 'All'}, Verdict: {verdict or 'All'}\n")
        
        # Initialize MIM engine
        if not self._init_mim_engine():
            print("❌ Failed to initialize MIM engine")
            return
        
        # Load submissions
        submissions = self.load_submissions(limit, category, verdict)
        if not submissions:
            print("❌ No submissions to validate")
            return
        
        # Validate each submission
        print(f"🔄 Validating {len(submissions)} submissions...")
        
        for i, submission in enumerate(submissions):
            result = self.validate_submission(submission)
            self._record_result(result)
            
            if verbose and (i + 1) % 10 == 0:
                print(f"   Processed {i + 1}/{len(submissions)}")
        
        print(f"✅ Validation complete")
    
    def _record_result(self, result: ValidationResult):
        """Record a validation result."""
        self.report.results.append(result)
        self.report.total_submissions += 1
        self.report.inference_times_ms.append(result.inference_time_ms)
        
        if result.error:
            self.report.total_errors += 1
            return
        
        # Update overall metrics
        if result.is_correct:
            self.report.total_correct += 1
        elif result.is_partial_match:
            self.report.total_partial += 1
        elif result.actual_root_cause is None:
            self.report.total_unknown += 1
        
        # Update category metrics
        cat_metrics = self.report.by_category[result.problem_category]
        cat_metrics.total += 1
        cat_metrics.confidences.append(result.confidence)
        
        if result.is_correct:
            cat_metrics.correct += 1
        elif result.is_partial_match:
            cat_metrics.partial_match += 1
        elif result.actual_root_cause is None:
            cat_metrics.unknown += 1
        
        # Update confusion matrix
        if result.actual_root_cause:
            self.report.by_root_cause[result.actual_root_cause][result.predicted_root_cause] += 1
    
    def print_report(self):
        """Print validation report."""
        r = self.report
        
        print("\n" + "=" * 70)
        print("📊 MIM v3.0 PRODUCTION VALIDATION REPORT")
        print("=" * 70)
        
        print(f"\n📈 Overall Metrics:")
        print(f"   Total Submissions:     {r.total_submissions:,}")
        print(f"   Exact Matches:         {r.total_correct:,} ({r.overall_accuracy:.1f}%)")
        print(f"   Partial Matches:       {r.total_partial:,}")
        print(f"   Combined Accuracy:     {r.accuracy_with_partial:.1f}%")
        print(f"   No Ground Truth:       {r.total_unknown:,}")
        print(f"   Errors:                {r.total_errors:,}")
        print(f"   Avg Inference Time:    {r.avg_inference_time_ms:.1f}ms")
        
        # Accuracy by category
        print(f"\n📊 Accuracy by Problem Category:")
        
        if HAS_TABULATE:
            table_data = []
            for cat, metrics in sorted(r.by_category.items()):
                table_data.append([
                    cat,
                    metrics.total,
                    f"{metrics.accuracy:.1f}%",
                    f"{metrics.accuracy_with_partial:.1f}%",
                    f"{metrics.avg_confidence:.2f}",
                ])
            
            print(tabulate(
                table_data,
                headers=["Category", "Count", "Exact Acc", "Partial Acc", "Avg Conf"],
                tablefmt="simple",
            ))
        else:
            for cat, metrics in sorted(r.by_category.items()):
                print(f"   {cat:20} | N={metrics.total:4} | "
                      f"Exact: {metrics.accuracy:5.1f}% | "
                      f"Partial: {metrics.accuracy_with_partial:5.1f}%")
        
        # Top confusion pairs
        print(f"\n🔀 Top Confusion Pairs (Actual → Predicted):")
        confusions = []
        for actual, predictions in r.by_root_cause.items():
            for predicted, count in predictions.items():
                if actual != predicted:
                    confusions.append((actual, predicted, count))
        
        confusions.sort(key=lambda x: x[2], reverse=True)
        for actual, predicted, count in confusions[:10]:
            print(f"   {actual:30} → {predicted:30} ({count})")
        
        # Performance targets
        print(f"\n🎯 Performance Targets:")
        
        if r.overall_accuracy >= 70:
            print(f"   ✅ Exact Accuracy ≥70%: PASSED ({r.overall_accuracy:.1f}%)")
        else:
            print(f"   ❌ Exact Accuracy ≥70%: FAILED ({r.overall_accuracy:.1f}%)")
        
        if r.accuracy_with_partial >= 85:
            print(f"   ✅ Combined Accuracy ≥85%: PASSED ({r.accuracy_with_partial:.1f}%)")
        else:
            print(f"   ❌ Combined Accuracy ≥85%: FAILED ({r.accuracy_with_partial:.1f}%)")
        
        if r.avg_inference_time_ms < 100:
            print(f"   ✅ Avg Inference <100ms: PASSED ({r.avg_inference_time_ms:.1f}ms)")
        else:
            print(f"   ❌ Avg Inference <100ms: FAILED ({r.avg_inference_time_ms:.1f}ms)")
        
        print("\n" + "=" * 70)
    
    def save_report(self, output_path: str):
        """Save report to JSON file."""
        r = self.report
        
        data = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_submissions": r.total_submissions,
                "exact_matches": r.total_correct,
                "partial_matches": r.total_partial,
                "no_ground_truth": r.total_unknown,
                "errors": r.total_errors,
                "exact_accuracy_pct": round(r.overall_accuracy, 2),
                "combined_accuracy_pct": round(r.accuracy_with_partial, 2),
                "avg_inference_time_ms": round(r.avg_inference_time_ms, 2),
            },
            "by_category": {
                cat: {
                    "total": m.total,
                    "correct": m.correct,
                    "partial": m.partial_match,
                    "accuracy_pct": round(m.accuracy, 2),
                    "combined_accuracy_pct": round(m.accuracy_with_partial, 2),
                    "avg_confidence": round(m.avg_confidence, 3),
                }
                for cat, m in r.by_category.items()
            },
            "confusion_matrix": {
                actual: dict(predictions)
                for actual, predictions in r.by_root_cause.items()
            },
            "passed": (
                r.overall_accuracy >= 70 and
                r.accuracy_with_partial >= 85 and
                r.avg_inference_time_ms < 100
            ),
        }
        
        # Add detailed results if pandas available
        if HAS_PANDAS:
            df = pd.DataFrame([
                {
                    "submission_id": res.submission_id,
                    "user_id": res.user_id,
                    "problem_id": res.problem_id,
                    "category": res.problem_category,
                    "verdict": res.verdict,
                    "predicted": res.predicted_root_cause,
                    "actual": res.actual_root_cause,
                    "confidence": res.confidence,
                    "is_correct": res.is_correct,
                    "is_partial": res.is_partial_match,
                    "inference_ms": res.inference_time_ms,
                }
                for res in r.results
            ])
            
            # Save CSV alongside JSON
            csv_path = output_path.replace(".json", ".csv")
            df.to_csv(csv_path, index=False)
            print(f"📁 Detailed results saved to: {csv_path}")
        
        Path(output_path).write_text(json.dumps(data, indent=2))
        print(f"📁 Report saved to: {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Validate MIM v3.0 predictions against historical submissions"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=100,
        help="Maximum number of submissions to validate (default: 100)",
    )
    parser.add_argument(
        "--category", "-c",
        help="Filter by problem category (e.g., Array, Graph, DP)",
    )
    parser.add_argument(
        "--verdict", "-v",
        help="Filter by verdict (e.g., wrong_answer, runtime_error)",
    )
    parser.add_argument(
        "--mongodb-uri",
        default="mongodb://localhost:27017",
        help="MongoDB connection URI",
    )
    parser.add_argument(
        "--db-name",
        default="arrakis",
        help="Database name (default: arrakis)",
    )
    parser.add_argument(
        "--output", "-o",
        default="validation_report.json",
        help="Output file for report (default: validation_report.json)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show progress during validation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be validated without running",
    )
    
    args = parser.parse_args()
    
    # Add ai-services to path
    import sys
    from pathlib import Path
    ai_services_path = Path(__file__).parent.parent
    if str(ai_services_path) not in sys.path:
        sys.path.insert(0, str(ai_services_path))
    
    validator = ProductionValidator(
        mongodb_uri=args.mongodb_uri,
        db_name=args.db_name,
    )
    
    if args.dry_run:
        print("\n🔍 DRY RUN - Showing validation plan:")
        print(f"   Limit:    {args.limit}")
        print(f"   Category: {args.category or 'All'}")
        print(f"   Verdict:  {args.verdict or 'All'}")
        print(f"   Output:   {args.output}")
        
        submissions = validator.load_submissions(5, args.category, args.verdict)
        print(f"\n   Sample submissions that would be validated:")
        for sub in submissions[:5]:
            print(f"   - {sub.get('problem_id', 'unknown')}: {sub.get('verdict', '?')}")
        return
    
    validator.run_validation(
        limit=args.limit,
        category=args.category,
        verdict=args.verdict,
        verbose=args.verbose,
    )
    
    validator.print_report()
    validator.save_report(args.output)
    
    # Exit with appropriate code
    r = validator.report
    passed = (
        r.overall_accuracy >= 70 and
        r.accuracy_with_partial >= 85 and
        r.avg_inference_time_ms < 100
    )
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
