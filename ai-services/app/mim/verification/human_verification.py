"""
MIM V3.0 Human Verification Script
==================================

PHASE 6: Final Check Before Rollout

This script:
1. Samples 50 FAILED submissions and checks:
   - root_cause correctness
   - subtype specificity
   - failure_mechanism precision

2. Samples 50 ACCEPTED submissions and verifies:
   - No mistake language
   - Strength signals make sense

Run with:
    python -m app.mim.verification.human_verification --data ./data/mim_v3 --output ./verification_results
"""

import argparse
import json
import logging
import random
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict

import pandas as pd

from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    is_valid_pair,
)
from app.mim.taxonomy.failure_mechanism_rules import (
    derive_failure_mechanism,
    FAILURE_MECHANISMS,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICATION CHECKLISTS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class FailedSubmissionCheck:
    """
    Checklist for verifying a FAILED submission.
    
    Human reviewer fills in:
    - root_cause_correct: Is the root_cause label correct?
    - subtype_specific: Is the subtype specific enough (not generic)?
    - failure_mechanism_precise: Does the mechanism match the actual bug?
    - comments: Any additional notes
    """
    submission_id: str
    user_id: str
    problem_category: str
    problem_difficulty: str
    
    # Predicted labels
    predicted_root_cause: str
    predicted_subtype: str
    predicted_failure_mechanism: str
    
    # Human verification (to be filled)
    root_cause_correct: Optional[bool] = None
    subtype_specific: Optional[bool] = None
    failure_mechanism_precise: Optional[bool] = None
    comments: str = ""
    
    # Metadata
    reviewed: bool = False
    reviewer: str = ""
    reviewed_at: str = ""


@dataclass
class AcceptedSubmissionCheck:
    """
    Checklist for verifying an ACCEPTED submission.
    
    Human reviewer fills in:
    - no_mistake_language: Feedback has no mistake/error references?
    - strength_signal_valid: Does the strength signal make sense?
    - comments: Any additional notes
    """
    submission_id: str
    user_id: str
    problem_category: str
    problem_difficulty: str
    
    # Reinforcement feedback
    technique: str
    confidence_boost: float
    strength_signal: str
    
    # Human verification (to be filled)
    no_mistake_language: Optional[bool] = None
    strength_signal_valid: Optional[bool] = None
    comments: str = ""
    
    # Metadata
    reviewed: bool = False
    reviewer: str = ""
    reviewed_at: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# SAMPLING
# ═══════════════════════════════════════════════════════════════════════════════

def sample_failed_submissions(
    df: pd.DataFrame,
    n: int = 50,
    stratify_by: str = "root_cause",
) -> List[FailedSubmissionCheck]:
    """
    Sample FAILED submissions for verification.
    
    Stratifies by root_cause to ensure coverage.
    """
    samples = []
    
    # Stratified sampling
    root_causes = df["root_cause"].unique()
    per_root = max(1, n // len(root_causes))
    
    for root_cause in root_causes:
        root_df = df[df["root_cause"] == root_cause]
        sample_n = min(per_root, len(root_df))
        
        if sample_n > 0:
            sampled = root_df.sample(n=sample_n, random_state=42)
            
            for _, row in sampled.iterrows():
                # Derive failure mechanism
                mechanism = derive_failure_mechanism(
                    root_cause=row["root_cause"],
                    subtype=row["subtype"],
                    category=row.get("category", "unknown"),
                    signals={},
                )
                
                check = FailedSubmissionCheck(
                    submission_id=str(row.get("submission_id", "")),
                    user_id=str(row.get("user_id", "")),
                    problem_category=str(row.get("category", "unknown")),
                    problem_difficulty=str(row.get("difficulty", "unknown")),
                    predicted_root_cause=row["root_cause"],
                    predicted_subtype=row["subtype"],
                    predicted_failure_mechanism=mechanism,
                )
                samples.append(check)
    
    # If we need more, sample randomly
    if len(samples) < n:
        remaining = n - len(samples)
        existing_ids = {s.submission_id for s in samples}
        available = df[~df["submission_id"].isin(existing_ids)]
        
        if len(available) > 0:
            extra = available.sample(n=min(remaining, len(available)), random_state=42)
            
            for _, row in extra.iterrows():
                mechanism = derive_failure_mechanism(
                    root_cause=row["root_cause"],
                    subtype=row["subtype"],
                    category=row.get("category", "unknown"),
                    signals={},
                )
                
                check = FailedSubmissionCheck(
                    submission_id=str(row.get("submission_id", "")),
                    user_id=str(row.get("user_id", "")),
                    problem_category=str(row.get("category", "unknown")),
                    problem_difficulty=str(row.get("difficulty", "unknown")),
                    predicted_root_cause=row["root_cause"],
                    predicted_subtype=row["subtype"],
                    predicted_failure_mechanism=mechanism,
                )
                samples.append(check)
    
    return samples[:n]


def sample_accepted_submissions(
    df: pd.DataFrame,
    n: int = 50,
) -> List[AcceptedSubmissionCheck]:
    """
    Sample ACCEPTED submissions for verification.
    """
    samples = []
    
    sample_n = min(n, len(df))
    sampled = df.sample(n=sample_n, random_state=42)
    
    for _, row in sampled.iterrows():
        check = AcceptedSubmissionCheck(
            submission_id=str(row.get("submission_id", "")),
            user_id=str(row.get("user_id", "")),
            problem_category=str(row.get("category", "unknown")),
            problem_difficulty=str(row.get("difficulty", "unknown")),
            technique=str(row.get("technique", "general")),
            confidence_boost=float(row.get("confidence_boost", 0.0)),
            strength_signal=str(row.get("strength_signal", "")),
        )
        samples.append(check)
    
    return samples[:n]


# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICATION REPORT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VerificationReport:
    """Verification report summary."""
    
    # Timestamps
    created_at: str
    completed_at: Optional[str] = None
    
    # Sample counts
    failed_samples: int = 50
    accepted_samples: int = 50
    
    # Failed submission results
    failed_reviewed: int = 0
    root_cause_correct_count: int = 0
    subtype_specific_count: int = 0
    failure_mechanism_precise_count: int = 0
    
    # Accepted submission results
    accepted_reviewed: int = 0
    no_mistake_language_count: int = 0
    strength_signal_valid_count: int = 0
    
    # Pass/fail
    passed: Optional[bool] = None
    
    def compute_metrics(
        self,
        failed_checks: List[FailedSubmissionCheck],
        accepted_checks: List[AcceptedSubmissionCheck],
    ) -> None:
        """Compute metrics from completed checks."""
        # Failed submissions
        reviewed_failed = [c for c in failed_checks if c.reviewed]
        self.failed_reviewed = len(reviewed_failed)
        
        self.root_cause_correct_count = sum(
            1 for c in reviewed_failed if c.root_cause_correct
        )
        self.subtype_specific_count = sum(
            1 for c in reviewed_failed if c.subtype_specific
        )
        self.failure_mechanism_precise_count = sum(
            1 for c in reviewed_failed if c.failure_mechanism_precise
        )
        
        # Accepted submissions
        reviewed_accepted = [c for c in accepted_checks if c.reviewed]
        self.accepted_reviewed = len(reviewed_accepted)
        
        self.no_mistake_language_count = sum(
            1 for c in reviewed_accepted if c.no_mistake_language
        )
        self.strength_signal_valid_count = sum(
            1 for c in reviewed_accepted if c.strength_signal_valid
        )
        
        # Pass criteria (>80% on all metrics)
        if self.failed_reviewed > 0 and self.accepted_reviewed > 0:
            failed_pass = (
                self.root_cause_correct_count / self.failed_reviewed >= 0.8 and
                self.subtype_specific_count / self.failed_reviewed >= 0.8 and
                self.failure_mechanism_precise_count / self.failed_reviewed >= 0.8
            )
            accepted_pass = (
                self.no_mistake_language_count / self.accepted_reviewed >= 0.95 and
                self.strength_signal_valid_count / self.accepted_reviewed >= 0.8
            )
            self.passed = failed_pass and accepted_pass
        
        self.completed_at = datetime.utcnow().isoformat()


# ═══════════════════════════════════════════════════════════════════════════════
# FILE I/O
# ═══════════════════════════════════════════════════════════════════════════════

def save_verification_package(
    output_dir: Path,
    failed_checks: List[FailedSubmissionCheck],
    accepted_checks: List[AcceptedSubmissionCheck],
    report: VerificationReport,
) -> None:
    """Save verification package to disk."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save failed checks
    failed_path = output_dir / "failed_submissions_to_verify.json"
    with open(failed_path, 'w') as f:
        json.dump([asdict(c) for c in failed_checks], f, indent=2)
    logger.info(f"Saved {len(failed_checks)} failed submissions to {failed_path}")
    
    # Save accepted checks
    accepted_path = output_dir / "accepted_submissions_to_verify.json"
    with open(accepted_path, 'w') as f:
        json.dump([asdict(c) for c in accepted_checks], f, indent=2)
    logger.info(f"Saved {len(accepted_checks)} accepted submissions to {accepted_path}")
    
    # Save report
    report_path = output_dir / "verification_report.json"
    with open(report_path, 'w') as f:
        json.dump(asdict(report), f, indent=2)
    logger.info(f"Saved report to {report_path}")
    
    # Save human-readable checklist
    checklist_path = output_dir / "VERIFICATION_CHECKLIST.md"
    with open(checklist_path, 'w') as f:
        f.write(_generate_checklist_md(failed_checks, accepted_checks))
    logger.info(f"Saved checklist to {checklist_path}")


def _generate_checklist_md(
    failed_checks: List[FailedSubmissionCheck],
    accepted_checks: List[AcceptedSubmissionCheck],
) -> str:
    """Generate human-readable verification checklist."""
    lines = [
        "# MIM V3.0 Human Verification Checklist",
        "",
        f"**Generated:** {datetime.utcnow().isoformat()}",
        "",
        "## Instructions",
        "",
        "1. Review each submission below",
        "2. Mark checkboxes as you verify each item",
        "3. Add comments for any issues found",
        "4. Update the JSON files with your findings",
        "",
        "## Pass Criteria",
        "",
        "- **Failed submissions:** >80% correct on all metrics",
        "- **Accepted submissions:** >95% no mistake language, >80% valid strength signals",
        "",
        "---",
        "",
        "## FAILED Submissions (50 samples)",
        "",
        "For each submission, verify:",
        "- [ ] **root_cause** is correct",
        "- [ ] **subtype** is specific (not generic)",
        "- [ ] **failure_mechanism** matches actual bug",
        "",
    ]
    
    for i, check in enumerate(failed_checks, 1):
        lines.extend([
            f"### Failed #{i}: `{check.submission_id}`",
            "",
            f"- **User:** {check.user_id}",
            f"- **Category:** {check.problem_category}",
            f"- **Difficulty:** {check.problem_difficulty}",
            "",
            "**Predictions:**",
            f"- root_cause: `{check.predicted_root_cause}`",
            f"- subtype: `{check.predicted_subtype}`",
            f"- failure_mechanism: `{check.predicted_failure_mechanism}`",
            "",
            "**Verification:**",
            "- [ ] root_cause correct?",
            "- [ ] subtype specific?",
            "- [ ] failure_mechanism precise?",
            "",
            "**Comments:** _________________",
            "",
            "---",
            "",
        ])
    
    lines.extend([
        "## ACCEPTED Submissions (50 samples)",
        "",
        "For each submission, verify:",
        "- [ ] No mistake/error language in feedback",
        "- [ ] Strength signal makes sense",
        "",
    ])
    
    for i, check in enumerate(accepted_checks, 1):
        lines.extend([
            f"### Accepted #{i}: `{check.submission_id}`",
            "",
            f"- **User:** {check.user_id}",
            f"- **Category:** {check.problem_category}",
            f"- **Difficulty:** {check.problem_difficulty}",
            "",
            "**Reinforcement:**",
            f"- technique: `{check.technique}`",
            f"- confidence_boost: `{check.confidence_boost:.2f}`",
            f"- strength_signal: `{check.strength_signal}`",
            "",
            "**Verification:**",
            "- [ ] No mistake language?",
            "- [ ] Strength signal valid?",
            "",
            "**Comments:** _________________",
            "",
            "---",
            "",
        ])
    
    return "\n".join(lines)


def load_completed_verification(
    output_dir: Path,
) -> Tuple[List[FailedSubmissionCheck], List[AcceptedSubmissionCheck], VerificationReport]:
    """Load completed verification from disk."""
    
    failed_path = output_dir / "failed_submissions_to_verify.json"
    with open(failed_path, 'r') as f:
        failed_data = json.load(f)
    failed_checks = [FailedSubmissionCheck(**d) for d in failed_data]
    
    accepted_path = output_dir / "accepted_submissions_to_verify.json"
    with open(accepted_path, 'r') as f:
        accepted_data = json.load(f)
    accepted_checks = [AcceptedSubmissionCheck(**d) for d in accepted_data]
    
    report_path = output_dir / "verification_report.json"
    with open(report_path, 'r') as f:
        report_data = json.load(f)
    report = VerificationReport(**report_data)
    
    return failed_checks, accepted_checks, report


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def prepare_verification(
    failure_data_path: str,
    reinforcement_data_path: str,
    output_dir: str,
    n_failed: int = 50,
    n_accepted: int = 50,
) -> Dict[str, Any]:
    """
    Prepare verification package.
    
    Samples submissions and creates verification checklists.
    """
    output_path = Path(output_dir)
    
    # Load datasets
    logger.info(f"Loading failure transitions from {failure_data_path}")
    failure_df = pd.read_parquet(failure_data_path)
    
    logger.info(f"Loading reinforcement events from {reinforcement_data_path}")
    reinforcement_df = pd.read_parquet(reinforcement_data_path)
    
    # Sample submissions
    logger.info(f"Sampling {n_failed} failed submissions...")
    failed_checks = sample_failed_submissions(failure_df, n=n_failed)
    
    logger.info(f"Sampling {n_accepted} accepted submissions...")
    accepted_checks = sample_accepted_submissions(reinforcement_df, n=n_accepted)
    
    # Create initial report
    report = VerificationReport(
        created_at=datetime.utcnow().isoformat(),
        failed_samples=len(failed_checks),
        accepted_samples=len(accepted_checks),
    )
    
    # Save package
    save_verification_package(output_path, failed_checks, accepted_checks, report)
    
    return {
        "success": True,
        "output_dir": str(output_path),
        "failed_samples": len(failed_checks),
        "accepted_samples": len(accepted_checks),
    }


def finalize_verification(
    output_dir: str,
) -> Dict[str, Any]:
    """
    Finalize verification after human review.
    
    Computes metrics and determines pass/fail.
    """
    output_path = Path(output_dir)
    
    # Load completed verification
    failed_checks, accepted_checks, report = load_completed_verification(output_path)
    
    # Compute metrics
    report.compute_metrics(failed_checks, accepted_checks)
    
    # Save updated report
    report_path = output_path / "verification_report.json"
    with open(report_path, 'w') as f:
        json.dump(asdict(report), f, indent=2)
    
    # Print summary
    print("\n" + "="*60)
    print("MIM V3.0 VERIFICATION RESULTS")
    print("="*60)
    
    print(f"\nFailed Submissions ({report.failed_reviewed}/{report.failed_samples} reviewed):")
    if report.failed_reviewed > 0:
        print(f"  - root_cause correct: {report.root_cause_correct_count}/{report.failed_reviewed} ({report.root_cause_correct_count/report.failed_reviewed*100:.1f}%)")
        print(f"  - subtype specific: {report.subtype_specific_count}/{report.failed_reviewed} ({report.subtype_specific_count/report.failed_reviewed*100:.1f}%)")
        print(f"  - failure_mechanism precise: {report.failure_mechanism_precise_count}/{report.failed_reviewed} ({report.failure_mechanism_precise_count/report.failed_reviewed*100:.1f}%)")
    
    print(f"\nAccepted Submissions ({report.accepted_reviewed}/{report.accepted_samples} reviewed):")
    if report.accepted_reviewed > 0:
        print(f"  - no mistake language: {report.no_mistake_language_count}/{report.accepted_reviewed} ({report.no_mistake_language_count/report.accepted_reviewed*100:.1f}%)")
        print(f"  - strength signal valid: {report.strength_signal_valid_count}/{report.accepted_reviewed} ({report.strength_signal_valid_count/report.accepted_reviewed*100:.1f}%)")
    
    print(f"\n{'='*60}")
    if report.passed:
        print("✅ VERIFICATION PASSED - System is production-grade")
    elif report.passed is False:
        print("❌ VERIFICATION FAILED - Review issues before rollout")
    else:
        print("⏳ VERIFICATION INCOMPLETE - More reviews needed")
    print("="*60 + "\n")
    
    return {
        "passed": report.passed,
        "report": asdict(report),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="MIM V3.0 Human Verification"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Prepare command
    prepare_parser = subparsers.add_parser(
        "prepare", help="Prepare verification package"
    )
    prepare_parser.add_argument(
        "--failures", "-f",
        required=True,
        help="Path to mim_failure_transitions.parquet"
    )
    prepare_parser.add_argument(
        "--reinforcements", "-r",
        required=True,
        help="Path to mim_reinforcement_events.parquet"
    )
    prepare_parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory for verification package"
    )
    prepare_parser.add_argument(
        "--n-failed",
        type=int,
        default=50,
        help="Number of failed submissions to sample"
    )
    prepare_parser.add_argument(
        "--n-accepted",
        type=int,
        default=50,
        help="Number of accepted submissions to sample"
    )
    
    # Finalize command
    finalize_parser = subparsers.add_parser(
        "finalize", help="Finalize verification after human review"
    )
    finalize_parser.add_argument(
        "--output", "-o",
        required=True,
        help="Directory with completed verification"
    )
    
    args = parser.parse_args()
    
    if args.command == "prepare":
        result = prepare_verification(
            failure_data_path=args.failures,
            reinforcement_data_path=args.reinforcements,
            output_dir=args.output,
            n_failed=args.n_failed,
            n_accepted=args.n_accepted,
        )
        print(f"\n✅ Verification package prepared in {result['output_dir']}")
        print("   Edit the JSON files with your verification results, then run 'finalize'")
    
    elif args.command == "finalize":
        result = finalize_verification(output_dir=args.output)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
