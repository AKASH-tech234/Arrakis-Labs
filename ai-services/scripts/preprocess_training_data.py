#!/usr/bin/env python3
"""
Preprocess CodeForces dataset for MIM training.
Maps verdicts to root cause categories and extracts features.

Usage:
    python scripts/preprocess_training_data.py
    
Input:
    data/codeforces_500k.parquet
    
Output:
    data/mim_training_data.csv
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# VERDICT TO ROOT CAUSE MAPPING
# ═══════════════════════════════════════════════════════════════════════════════

# Map CodeForces verdicts to MIM root cause categories
VERDICT_TO_ROOT_CAUSES = {
    "WRONG_ANSWER": [
        ("logic_error", 0.35),
        ("off_by_one_error", 0.20),
        ("boundary_condition_blindness", 0.15),
        ("edge_case_handling", 0.10),
        ("comparison_error", 0.08),
        ("misread_problem", 0.07),
        ("partial_solution", 0.05),
    ],
    "TIME_LIMIT_EXCEEDED": [
        ("time_complexity_issue", 0.60),
        ("algorithm_choice", 0.25),
        ("wrong_data_structure", 0.10),
        ("recursion_issue", 0.05),
    ],
    "RUNTIME_ERROR": [
        ("integer_overflow", 0.25),
        ("recursion_issue", 0.20),
        ("boundary_condition_blindness", 0.20),
        ("wrong_data_structure", 0.15),
        ("type_error", 0.10),
        ("input_parsing", 0.10),
    ],
    "MEMORY_LIMIT_EXCEEDED": [
        ("wrong_data_structure", 0.40),
        ("recursion_issue", 0.30),
        ("algorithm_choice", 0.20),
        ("integer_overflow", 0.10),
    ],
    "COMPILATION_ERROR": [
        ("type_error", 0.50),
        ("input_parsing", 0.30),
        ("logic_error", 0.20),
    ],
    "OK": [
        ("none", 1.0),  # No failure cause for accepted submissions
    ],
    "OTHER": [
        ("unknown", 1.0),
    ],
}


def assign_root_cause(verdict: str, code: str = "") -> str:
    """
    Assign a root cause based on verdict and code heuristics.
    
    Uses probabilistic assignment based on typical distribution,
    with code-based heuristics to refine the assignment.
    """
    import random
    
    # Get possible root causes for this verdict
    root_causes = VERDICT_TO_ROOT_CAUSES.get(verdict, [("unknown", 1.0)])
    
    # Code-based heuristics to adjust probabilities
    code_lower = code.lower() if code else ""
    
    # Detect patterns in code
    has_overflow_risk = any(kw in code_lower for kw in ["int", "long", "1000000007", "mod", "1e9"])
    has_recursion = "def " in code_lower and code_lower.count("def ") < code_lower.count("(")
    has_nested_loops = code_lower.count("for ") >= 2 or code_lower.count("while ") >= 2
    has_array_access = "[" in code_lower and "]" in code_lower
    has_comparison = any(op in code_lower for op in ["<=", ">=", "==", "!="])
    
    # Adjust weights based on code patterns
    adjusted_causes = []
    for cause, weight in root_causes:
        adjusted_weight = weight
        
        if cause == "integer_overflow" and has_overflow_risk:
            adjusted_weight *= 1.5
        if cause == "recursion_issue" and has_recursion:
            adjusted_weight *= 1.5
        if cause == "time_complexity_issue" and has_nested_loops:
            adjusted_weight *= 1.3
        if cause == "boundary_condition_blindness" and has_array_access:
            adjusted_weight *= 1.2
        if cause == "off_by_one_error" and has_comparison:
            adjusted_weight *= 1.3
            
        adjusted_causes.append((cause, adjusted_weight))
    
    # Normalize weights
    total_weight = sum(w for _, w in adjusted_causes)
    normalized = [(c, w / total_weight) for c, w in adjusted_causes]
    
    # Weighted random selection
    r = random.random()
    cumulative = 0
    for cause, weight in normalized:
        cumulative += weight
        if r <= cumulative:
            return cause
    
    return normalized[-1][0]


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

def extract_basic_features(row: Dict) -> Dict:
    """
    Extract basic features from a submission row.
    These are lightweight features that don't require full code analysis.
    """
    code = row.get("code", "") or ""
    
    features = {
        # Code metrics
        "code_length": len(code),
        "code_lines": code.count("\n") + 1,
        "has_recursion": int("def " in code.lower() or "function" in code.lower()),
        "nested_loop_depth": min(code.lower().count("for ") + code.lower().count("while "), 5),
        "has_array_access": int("[" in code and "]" in code),
        "has_sorting": int(any(kw in code.lower() for kw in ["sort", "sorted", "qsort"])),
        "has_binary_search": int("binary" in code.lower() or "bisect" in code.lower()),
        "has_dp": int(any(kw in code.lower() for kw in ["dp[", "memo", "cache"])),
        "has_graph": int(any(kw in code.lower() for kw in ["graph", "adj", "edge", "bfs", "dfs"])),
        "has_math": int(any(kw in code.lower() for kw in ["mod", "gcd", "prime", "pow"])),
        
        # Performance metrics (from submission)
        "time_consumed_ms": row.get("time_consumed_ms") or 0,
        "memory_consumed_bytes": row.get("memory_consumed_bytes") or 0,
        
        # Language encoding
        "is_python": int("python" in (row.get("language", "") or "").lower()),
        "is_cpp": int("c++" in (row.get("language", "") or "").lower() or "cpp" in (row.get("language", "") or "").lower()),
        "is_java": int("java" in (row.get("language", "") or "").lower()),
        
        # Verdict encoding
        "is_accepted": int(row.get("verdict") == "OK"),
        "is_wa": int(row.get("verdict") == "WRONG_ANSWER"),
        "is_tle": int(row.get("verdict") == "TIME_LIMIT_EXCEEDED"),
        "is_re": int(row.get("verdict") == "RUNTIME_ERROR"),
        "is_mle": int(row.get("verdict") == "MEMORY_LIMIT_EXCEEDED"),
    }
    
    return features


def preprocess_dataset(
    input_path: Path,
    output_path: Path,
    chunk_size: int = 50000
):
    """
    Preprocess the raw dataset and save as training-ready CSV.
    
    Args:
        input_path: Path to raw parquet file
        output_path: Path to save processed CSV
        chunk_size: Number of rows to process at a time
    """
    try:
        import pandas as pd
        import numpy as np
    except ImportError:
        logger.error("Required packages not installed. Run: pip install pandas numpy")
        sys.exit(1)
    
    logger.info("=" * 60)
    logger.info("Preprocessing MIM Training Data")
    logger.info("=" * 60)
    logger.info(f"Input: {input_path}")
    logger.info(f"Output: {output_path}")
    
    # Load dataset
    logger.info("\nLoading dataset...")
    df = pd.read_parquet(input_path)
    logger.info(f"Loaded {len(df):,} submissions")
    
    # Process in chunks
    processed_rows = []
    
    logger.info("\nProcessing submissions...")
    for i in range(0, len(df), chunk_size):
        chunk = df.iloc[i:i + chunk_size]
        
        for _, row in chunk.iterrows():
            # Extract features
            features = extract_basic_features(row.to_dict())
            
            # Assign root cause label
            root_cause = assign_root_cause(
                row.get("verdict", "OTHER"),
                row.get("code", "")
            )
            
            # Combine into training row
            training_row = {
                "submission_id": row.get("submission_id"),
                "problem_id": row.get("problem_id"),
                "verdict": row.get("verdict"),
                "root_cause": root_cause,
                **features
            }
            
            processed_rows.append(training_row)
        
        # Progress update
        progress = min(i + chunk_size, len(df))
        pct = (progress / len(df)) * 100
        logger.info(f"  Processed {progress:,} / {len(df):,} ({pct:.1f}%)")
    
    # Create output DataFrame
    logger.info("\nCreating output DataFrame...")
    output_df = pd.DataFrame(processed_rows)
    
    # Log root cause distribution
    logger.info("\nRoot cause distribution:")
    for cause, count in output_df["root_cause"].value_counts().items():
        pct = (count / len(output_df)) * 100
        logger.info(f"  {cause}: {count:,} ({pct:.1f}%)")
    
    # Save to CSV
    logger.info(f"\nSaving to {output_path}...")
    output_df.to_csv(output_path, index=False)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"Saved! File size: {file_size_mb:.1f} MB")
    
    return output_path


def main():
    """Main entry point."""
    data_dir = Path(__file__).parent.parent / "data"
    input_path = data_dir / "codeforces_500k.parquet"
    output_path = data_dir / "mim_training_data.csv"
    
    logger.info("\n" + "=" * 60)
    logger.info("MIM Training Data Preprocessing")
    logger.info(f"Started at: {datetime.now().isoformat()}")
    logger.info("=" * 60)
    
    # Check input exists
    if not input_path.exists():
        logger.error(f"Input file not found: {input_path}")
        logger.error("Run download_datasets.py first.")
        sys.exit(1)
    
    # Preprocess
    preprocess_dataset(input_path, output_path)
    
    logger.info("\n" + "=" * 60)
    logger.info("Preprocessing complete!")
    logger.info(f"Output: {output_path}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
