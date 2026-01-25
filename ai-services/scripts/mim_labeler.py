#!/usr/bin/env python3
"""
MIM Labeling Utility - Manual Label Creation Tool

This script helps create manual labels for MIM training (Option B chosen by user).
Target: Label 500 submissions for high-quality training data.

Usage:
    # Interactive labeling mode
    python scripts/mim_labeler.py --mode interactive
    
    # Export submissions for batch labeling
    python scripts/mim_labeler.py --mode export --output labels_batch.json
    
    # Import labels from JSON
    python scripts/mim_labeler.py --mode import --input labeled_batch.json
    
    # View labeling statistics
    python scripts/mim_labeler.py --mode stats

Author: Arrakis Labs
"""

import json
import sys
import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.mongodb import mongo_client

# ═══════════════════════════════════════════════════════════════════════════════
# LABEL CATEGORIES (from MIM schema)
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSE_LABELS = [
    "algorithm_choice",       # Wrong algorithm selected
    "edge_case_handling",     # Missing edge cases
    "complexity_issue",       # Time/space complexity too high
    "implementation_bug",     # Logic errors in correct approach
    "input_parsing",          # Failed to parse input correctly
    "off_by_one",            # Off-by-one errors
    "overflow_underflow",     # Integer overflow/underflow
    "wrong_data_structure",   # Inappropriate data structure
    "misread_problem",        # Misunderstood problem statement
    "partial_solution",       # Solution is incomplete
    "syntax_error",           # Language syntax issues
    "type_error",             # Type conversion/casting issues
    "initialization_error",   # Wrong initial values
    "boundary_condition",     # Boundary handling errors
    "unknown",               # Cannot determine from context
]

READINESS_LEVELS = ["beginner", "intermediate", "advanced"]

# ═══════════════════════════════════════════════════════════════════════════════
# LABELS FILE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

LABELS_DIR = Path(__file__).parent.parent / "data" / "mim_labels"


def ensure_labels_dir():
    """Create labels directory if it doesn't exist."""
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    return LABELS_DIR


def get_labels_file() -> Path:
    """Get path to main labels file."""
    return ensure_labels_dir() / "manual_labels.json"


def load_existing_labels() -> Dict[str, Any]:
    """Load existing labels from file."""
    labels_file = get_labels_file()
    if labels_file.exists():
        with open(labels_file, 'r') as f:
            return json.load(f)
    return {"labels": [], "metadata": {"created_at": datetime.now().isoformat()}}


def save_labels(data: Dict[str, Any]):
    """Save labels to file."""
    labels_file = get_labels_file()
    data["metadata"]["updated_at"] = datetime.now().isoformat()
    data["metadata"]["total_labels"] = len(data["labels"])
    
    with open(labels_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"💾 Saved {len(data['labels'])} labels to {labels_file}")


# ═══════════════════════════════════════════════════════════════════════════════
# SUBMISSION FETCHING
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_unlabeled_submissions(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch submissions that haven't been labeled yet.
    
    Prioritizes:
    1. Diverse error types
    2. Different users
    3. Recent submissions
    """
    existing_labels = load_existing_labels()
    labeled_ids = {label["submission_id"] for label in existing_labels["labels"]}
    
    # Fetch from MongoDB
    if mongo_client.db is None:
        print("⚠️ MongoDB not connected. Using mock data.")
        return _generate_mock_submissions(limit)
    
    try:
        collection = mongo_client.db["submissions"]
        
        # Fetch rejected submissions (more interesting for labeling)
        submissions = list(collection.find(
            {"status": {"$ne": "accepted"}},
            {"_id": 1, "user_id": 1, "problem_id": 1, "code": 1, 
             "language": 1, "status": 1, "error_type": 1, "created_at": 1}
        ).sort("created_at", -1).limit(limit * 2))
        
        # Filter out already labeled
        unlabeled = [
            s for s in submissions 
            if str(s.get("_id")) not in labeled_ids
        ][:limit]
        
        print(f"📊 Found {len(unlabeled)} unlabeled submissions")
        return unlabeled
        
    except Exception as e:
        print(f"❌ MongoDB error: {e}")
        return _generate_mock_submissions(limit)


def _generate_mock_submissions(limit: int) -> List[Dict[str, Any]]:
    """Generate mock submissions for testing."""
    import random
    
    verdicts = ["wrong_answer", "time_limit_exceeded", "runtime_error", "compilation_error"]
    languages = ["python", "cpp", "java"]
    
    mock_code = """
def solve():
    n = int(input())
    arr = list(map(int, input().split()))
    # BUG: Should use set for O(1) lookup
    for i in range(n):
        for j in range(i+1, n):
            if arr[i] + arr[j] == target:
                return [i, j]
    return [-1, -1]
"""
    
    submissions = []
    for i in range(limit):
        submissions.append({
            "_id": f"mock_{i}_{random.randint(1000, 9999)}",
            "user_id": f"user_{random.randint(1, 20)}",
            "problem_id": f"problem_{random.randint(1, 100)}",
            "code": mock_code,
            "language": random.choice(languages),
            "status": random.choice(verdicts),
            "error_type": "wrong_answer" if random.random() > 0.5 else None,
            "created_at": datetime.now().isoformat(),
        })
    
    return submissions


# ═══════════════════════════════════════════════════════════════════════════════
# INTERACTIVE LABELING
# ═══════════════════════════════════════════════════════════════════════════════

def display_submission(submission: Dict[str, Any], index: int, total: int):
    """Display a submission for labeling."""
    print("\n" + "═" * 80)
    print(f"📋 SUBMISSION {index + 1}/{total}")
    print("═" * 80)
    print(f"ID: {submission.get('_id')}")
    print(f"User: {submission.get('user_id')}")
    print(f"Problem: {submission.get('problem_id')}")
    print(f"Language: {submission.get('language')}")
    print(f"Verdict: {submission.get('status')}")
    print(f"Error Type: {submission.get('error_type', 'N/A')}")
    print("\n--- CODE ---")
    
    code = submission.get('code', '')[:2000]  # Limit for display
    for i, line in enumerate(code.split('\n')[:40], 1):
        print(f"{i:3d} | {line}")
    
    if len(submission.get('code', '')) > 2000:
        print("\n... [CODE TRUNCATED] ...")
    print("─" * 80)


def prompt_for_label() -> Optional[Dict[str, Any]]:
    """Prompt user for labels interactively."""
    print("\n🏷️  ROOT CAUSE CATEGORIES:")
    for i, cause in enumerate(ROOT_CAUSE_LABELS, 1):
        print(f"  {i:2d}. {cause}")
    
    print("\nCommands: [1-15] Select cause, [s] Skip, [q] Quit, [?] Help")
    
    try:
        choice = input("\n➤ Root cause (1-15 or name): ").strip().lower()
        
        if choice == 'q':
            return None
        if choice == 's':
            return {"skipped": True}
        if choice == '?':
            print_help()
            return {"retry": True}
        
        # Parse choice
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(ROOT_CAUSE_LABELS):
                root_cause = ROOT_CAUSE_LABELS[idx]
            else:
                print("❌ Invalid index")
                return {"retry": True}
        elif choice in ROOT_CAUSE_LABELS:
            root_cause = choice
        else:
            print(f"❌ Unknown cause: {choice}")
            return {"retry": True}
        
        # Confidence
        conf_input = input("➤ Confidence (0.0-1.0) [default: 0.8]: ").strip()
        confidence = float(conf_input) if conf_input else 0.8
        confidence = max(0.0, min(1.0, confidence))
        
        # Readiness level
        print("\n📊 USER READINESS:")
        for i, level in enumerate(READINESS_LEVELS, 1):
            print(f"  {i}. {level}")
        
        level_input = input("➤ Readiness level (1-3) [default: 2]: ").strip()
        level_idx = int(level_input) - 1 if level_input.isdigit() else 1
        readiness = READINESS_LEVELS[max(0, min(2, level_idx))]
        
        # Notes
        notes = input("➤ Notes (optional): ").strip()
        
        return {
            "root_cause": root_cause,
            "confidence": confidence,
            "readiness": readiness,
            "notes": notes or None,
            "labeled_at": datetime.now().isoformat(),
        }
        
    except KeyboardInterrupt:
        print("\n\n👋 Labeling interrupted.")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return {"retry": True}


def print_help():
    """Print labeling help."""
    print("\n" + "═" * 60)
    print("🎯 MIM LABELING GUIDE")
    print("═" * 60)
    print("""
ROOT CAUSE SELECTION:
- algorithm_choice: User picked fundamentally wrong algorithm
- edge_case_handling: Missing edge cases (empty input, single element)
- complexity_issue: Correct approach but O(n²) instead of O(n log n)
- implementation_bug: Right algorithm, buggy implementation
- input_parsing: Failed to read/parse input format
- off_by_one: Loop bounds, array indices off by one
- overflow_underflow: Integer overflow or underflow
- wrong_data_structure: Used list when should use set/dict
- misread_problem: Misunderstood what problem asks
- partial_solution: Solves part of the problem
- syntax_error: Language-specific syntax issues
- type_error: Type conversion problems
- initialization_error: Wrong initial values for variables
- boundary_condition: Array bounds, number ranges
- unknown: Cannot determine from context

CONFIDENCE LEVELS:
- 0.9-1.0: Very confident (obvious from code)
- 0.7-0.9: Confident (clear indicators)
- 0.5-0.7: Moderate (educated guess)
- <0.5: Low (uncertain, multiple possible causes)

TIPS:
- Focus on the PRIMARY cause, not secondary issues
- Consider the problem difficulty when assessing readiness
- Skip if you genuinely can't determine the cause
""")
    print("═" * 60)


def run_interactive_labeling(batch_size: int = 20):
    """Run interactive labeling session."""
    print("\n" + "═" * 60)
    print("🏷️  MIM INTERACTIVE LABELING SESSION")
    print("═" * 60)
    print(f"Target: Label {batch_size} submissions")
    print("Press Ctrl+C at any time to save and exit")
    print("═" * 60)
    
    data = load_existing_labels()
    submissions = fetch_unlabeled_submissions(batch_size)
    
    if not submissions:
        print("❌ No unlabeled submissions found!")
        return
    
    labeled_count = 0
    skipped_count = 0
    
    i = 0
    while i < len(submissions):
        submission = submissions[i]
        display_submission(submission, i, len(submissions))
        
        label = prompt_for_label()
        
        if label is None:
            # Quit
            break
        elif label.get("skipped"):
            skipped_count += 1
            i += 1
            continue
        elif label.get("retry"):
            continue
        
        # Save label
        label_entry = {
            "submission_id": str(submission.get("_id")),
            "user_id": submission.get("user_id"),
            "problem_id": submission.get("problem_id"),
            "verdict": submission.get("status"),
            "language": submission.get("language"),
            **label
        }
        data["labels"].append(label_entry)
        labeled_count += 1
        
        print(f"✅ Labeled as '{label['root_cause']}' (conf: {label['confidence']:.1%})")
        
        i += 1
        
        # Auto-save every 5 labels
        if labeled_count % 5 == 0:
            save_labels(data)
            print(f"\n🔄 Auto-saved ({labeled_count} new labels)")
    
    # Final save
    save_labels(data)
    
    print("\n" + "═" * 60)
    print("📊 SESSION SUMMARY")
    print("═" * 60)
    print(f"Labeled: {labeled_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Total labels in file: {len(data['labels'])}")
    print(f"Target progress: {len(data['labels'])}/500 ({len(data['labels'])/5:.0f}%)")
    print("═" * 60)


# ═══════════════════════════════════════════════════════════════════════════════
# EXPORT / IMPORT
# ═══════════════════════════════════════════════════════════════════════════════

def export_for_batch_labeling(output_file: str, count: int = 100):
    """Export submissions for batch labeling (e.g., in spreadsheet)."""
    submissions = fetch_unlabeled_submissions(count)
    
    export_data = {
        "instructions": "Fill in 'root_cause' and 'confidence' for each submission",
        "root_cause_options": ROOT_CAUSE_LABELS,
        "readiness_options": READINESS_LEVELS,
        "submissions": []
    }
    
    for sub in submissions:
        export_data["submissions"].append({
            "submission_id": str(sub.get("_id")),
            "user_id": sub.get("user_id"),
            "problem_id": sub.get("problem_id"),
            "verdict": sub.get("status"),
            "language": sub.get("language"),
            "code_preview": sub.get("code", "")[:500],
            # To be filled:
            "root_cause": "",
            "confidence": 0.8,
            "readiness": "intermediate",
            "notes": "",
        })
    
    with open(output_file, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"📤 Exported {len(submissions)} submissions to {output_file}")
    print("Fill in the labels and import with --mode import")


def import_batch_labels(input_file: str):
    """Import labels from a batch labeling file."""
    with open(input_file, 'r') as f:
        import_data = json.load(f)
    
    data = load_existing_labels()
    existing_ids = {l["submission_id"] for l in data["labels"]}
    
    imported = 0
    skipped = 0
    
    for entry in import_data.get("submissions", []):
        sub_id = entry.get("submission_id")
        root_cause = entry.get("root_cause", "").strip()
        
        if not root_cause:
            skipped += 1
            continue
        
        if sub_id in existing_ids:
            skipped += 1
            continue
        
        if root_cause not in ROOT_CAUSE_LABELS:
            print(f"⚠️ Invalid root_cause '{root_cause}' for {sub_id}, skipping")
            skipped += 1
            continue
        
        data["labels"].append({
            "submission_id": sub_id,
            "user_id": entry.get("user_id"),
            "problem_id": entry.get("problem_id"),
            "verdict": entry.get("verdict"),
            "language": entry.get("language"),
            "root_cause": root_cause,
            "confidence": float(entry.get("confidence", 0.8)),
            "readiness": entry.get("readiness", "intermediate"),
            "notes": entry.get("notes"),
            "labeled_at": datetime.now().isoformat(),
        })
        imported += 1
    
    save_labels(data)
    print(f"📥 Imported {imported} labels, skipped {skipped}")


# ═══════════════════════════════════════════════════════════════════════════════
# STATISTICS
# ═══════════════════════════════════════════════════════════════════════════════

def show_labeling_stats():
    """Show labeling statistics."""
    data = load_existing_labels()
    labels = data.get("labels", [])
    
    print("\n" + "═" * 60)
    print("📊 MIM LABELING STATISTICS")
    print("═" * 60)
    
    print(f"\nTotal labels: {len(labels)}")
    print(f"Target: 500")
    print(f"Progress: {len(labels)/500*100:.1f}%")
    
    if not labels:
        print("\nNo labels yet. Run with --mode interactive to start labeling.")
        return
    
    # Root cause distribution
    print("\n📈 ROOT CAUSE DISTRIBUTION:")
    cause_counts = {}
    for label in labels:
        cause = label.get("root_cause", "unknown")
        cause_counts[cause] = cause_counts.get(cause, 0) + 1
    
    for cause, count in sorted(cause_counts.items(), key=lambda x: -x[1]):
        bar = "█" * (count * 40 // len(labels))
        print(f"  {cause:22s} {count:4d} ({count/len(labels)*100:5.1f}%) {bar}")
    
    # Readiness distribution
    print("\n📊 READINESS DISTRIBUTION:")
    readiness_counts = {}
    for label in labels:
        level = label.get("readiness", "unknown")
        readiness_counts[level] = readiness_counts.get(level, 0) + 1
    
    for level, count in sorted(readiness_counts.items(), key=lambda x: -x[1]):
        print(f"  {level:15s} {count:4d} ({count/len(labels)*100:5.1f}%)")
    
    # Confidence distribution
    print("\n📊 CONFIDENCE DISTRIBUTION:")
    conf_buckets = {"low (<0.5)": 0, "medium (0.5-0.7)": 0, "high (0.7-0.9)": 0, "very high (>0.9)": 0}
    for label in labels:
        conf = label.get("confidence", 0.5)
        if conf < 0.5:
            conf_buckets["low (<0.5)"] += 1
        elif conf < 0.7:
            conf_buckets["medium (0.5-0.7)"] += 1
        elif conf < 0.9:
            conf_buckets["high (0.7-0.9)"] += 1
        else:
            conf_buckets["very high (>0.9)"] += 1
    
    for bucket, count in conf_buckets.items():
        print(f"  {bucket:20s} {count:4d} ({count/len(labels)*100:5.1f}%)")
    
    # Labeling timeline
    print("\n📅 LABELING TIMELINE:")
    dates = {}
    for label in labels:
        date_str = label.get("labeled_at", "")[:10]
        if date_str:
            dates[date_str] = dates.get(date_str, 0) + 1
    
    for date, count in sorted(dates.items())[-7:]:
        print(f"  {date}: {count} labels")
    
    print("\n" + "═" * 60)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="MIM Labeling Utility - Create training labels for MIM",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start interactive labeling
  python scripts/mim_labeler.py --mode interactive
  
  # Export for batch labeling
  python scripts/mim_labeler.py --mode export --output batch.json --count 50
  
  # Import completed labels
  python scripts/mim_labeler.py --mode import --input labeled_batch.json
  
  # View statistics
  python scripts/mim_labeler.py --mode stats
"""
    )
    
    parser.add_argument(
        "--mode", "-m",
        choices=["interactive", "export", "import", "stats"],
        default="interactive",
        help="Labeling mode"
    )
    parser.add_argument(
        "--output", "-o",
        default="mim_labels_batch.json",
        help="Output file for export mode"
    )
    parser.add_argument(
        "--input", "-i",
        default="mim_labels_batch.json",
        help="Input file for import mode"
    )
    parser.add_argument(
        "--count", "-c",
        type=int,
        default=50,
        help="Number of submissions to process"
    )
    
    args = parser.parse_args()
    
    print("🧠 MIM Labeling Utility v1.0")
    print(f"Mode: {args.mode}")
    
    if args.mode == "interactive":
        run_interactive_labeling(args.count)
    elif args.mode == "export":
        export_for_batch_labeling(args.output, args.count)
    elif args.mode == "import":
        import_batch_labels(args.input)
    elif args.mode == "stats":
        show_labeling_stats()


if __name__ == "__main__":
    main()
