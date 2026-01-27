"""
Generate Mock Training Data
===========================

Generates synthetic training data for MIM model development.

IMPORTANT: This data is for testing the pipeline only.
Real training requires actual user submission history from MongoDB.

Usage:
    python -m scripts.generate_mock_data --output data/mim_mock_data.parquet --samples 5000
"""

import argparse
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any

import pandas as pd

# Import taxonomy for valid values
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.mim.taxonomy.root_causes import ROOT_CAUSES
from app.mim.taxonomy.subtype_masks import ROOT_CAUSE_TO_SUBTYPES, SUBTYPES


# ═══════════════════════════════════════════════════════════════════════════════
# DATA GENERATION PARAMETERS
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORIES = [
    "arrays", "strings", "dynamic_programming", "graphs", "trees",
    "binary_search", "sorting", "greedy", "backtracking", "math",
    "two_pointers", "sliding_window", "linked_lists", "stacks", "heaps",
]

DIFFICULTIES = ["easy", "medium", "hard"]

TECHNIQUES = [
    "brute_force", "two_pointers", "sliding_window", "binary_search",
    "dfs", "bfs", "dynamic_programming", "greedy", "sorting",
    "hashing", "prefix_sum", "monotonic_stack", "union_find", "recursion",
]


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK USER GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_mock_users(n_users: int = 100) -> List[Dict[str, Any]]:
    """Generate mock user profiles with different skill levels."""
    
    users = []
    
    for i in range(n_users):
        skill_level = random.choice(["beginner", "intermediate", "advanced"])
        
        user = {
            "user_id": f"mock_user_{i:04d}",
            "skill_level": skill_level,
            "strong_categories": random.sample(CATEGORIES, k=random.randint(1, 4)),
            "weak_categories": random.sample(CATEGORIES, k=random.randint(1, 3)),
            "submission_count": random.randint(10, 200),
        }
        
        # Beginners have more failures
        if skill_level == "beginner":
            user["failure_rate"] = random.uniform(0.5, 0.8)
            user["dominant_root_cause"] = random.choice(["correctness", "understanding_gap"])
        elif skill_level == "intermediate":
            user["failure_rate"] = random.uniform(0.3, 0.5)
            user["dominant_root_cause"] = random.choice(["correctness", "efficiency"])
        else:
            user["failure_rate"] = random.uniform(0.15, 0.3)
            user["dominant_root_cause"] = random.choice(["efficiency", "implementation"])
        
        users.append(user)
    
    return users


# ═══════════════════════════════════════════════════════════════════════════════
# FAILED SUBMISSION GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_failed_submission(user: Dict, submission_idx: int) -> Dict[str, Any]:
    """Generate a failed submission with ground truth labels."""
    
    # Pick root cause based on user profile
    if random.random() < 0.6:
        root_cause = user["dominant_root_cause"]
    else:
        root_cause = random.choice(list(ROOT_CAUSE_TO_SUBTYPES.keys()))
    
    # Pick valid subtype for this root cause (using canonical map)
    valid_subtypes = list(ROOT_CAUSE_TO_SUBTYPES.get(root_cause, []))
    subtype = random.choice(valid_subtypes) if valid_subtypes else random.choice(list(SUBTYPES))
    
    # Pick category (weighted toward weak categories)
    if random.random() < 0.7:
        category = random.choice(user.get("weak_categories", CATEGORIES))
    else:
        category = random.choice(CATEGORIES)
    
    # Pick difficulty
    difficulty = random.choice(DIFFICULTIES)
    
    # Generate timestamp (within last 90 days)
    days_ago = random.randint(0, 90)
    hours_ago = random.randint(0, 24)
    timestamp = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)
    
    # Generate code signals based on subtype
    signals = _generate_signals_for_subtype(subtype)
    
    # Generate delta features
    delta_features = _generate_delta_features(user, submission_idx)
    
    submission = {
        "user_id": user["user_id"],
        "problem_id": f"problem_{random.randint(1, 1000):04d}",
        "submission_id": f"sub_{user['user_id']}_{submission_idx:04d}",
        "verdict": "wrong_answer",  # Always failed for this generator
        "category": category,
        "difficulty": difficulty,
        "timestamp": timestamp.isoformat(),
        
        # Ground truth labels
        "root_cause": root_cause,
        "subtype": subtype,
        
        # Features
        "delta_attempts_same_category": delta_features["delta_attempts_same_category"],
        "delta_root_cause_repeat_rate": delta_features["delta_root_cause_repeat_rate"],
        "delta_complexity_mismatch": delta_features["delta_complexity_mismatch"],
        "delta_time_to_accept": delta_features["delta_time_to_accept"],
        "delta_optimization_transition": delta_features["delta_optimization_transition"],
        "is_cold_start": delta_features["is_cold_start"],
        
        # Code signals
        "has_loop_bound_error": signals.get("has_loop_bound_error", False),
        "has_off_by_one": signals.get("has_off_by_one", False),
        "uses_brute_force": signals.get("uses_brute_force", False),
        "uses_optimal_algorithm": signals.get("uses_optimal_algorithm", False),
        "used_complexity": signals.get("used_complexity", "O(n^2)"),
        "expected_complexity": signals.get("expected_complexity", "O(n)"),
    }
    
    return submission


def _generate_signals_for_subtype(subtype: str) -> Dict[str, Any]:
    """Generate code signals consistent with subtype."""
    
    signals = {
        "has_loop_bound_error": False,
        "has_off_by_one": False,
        "uses_brute_force": False,
        "uses_optimal_algorithm": False,
        "used_complexity": "O(n)",
        "expected_complexity": "O(n)",
    }
    
    if subtype == "off_by_one":
        signals["has_off_by_one"] = True
        signals["has_loop_bound_error"] = random.random() < 0.7
        
    elif subtype == "loop_bound_error":
        signals["has_loop_bound_error"] = True
        
    elif subtype == "brute_force_when_optimal_exists":
        signals["uses_brute_force"] = True
        signals["used_complexity"] = random.choice(["O(n^2)", "O(n^3)", "O(2^n)"])
        signals["expected_complexity"] = random.choice(["O(n)", "O(n log n)", "O(n)"])
        
    elif subtype == "suboptimal_data_structure":
        signals["used_complexity"] = random.choice(["O(n)", "O(n^2)"])
        signals["expected_complexity"] = random.choice(["O(log n)", "O(1)"])
        
    elif subtype == "missed_technique":
        signals["uses_brute_force"] = random.random() < 0.5
        
    return signals


def _generate_delta_features(user: Dict, submission_idx: int) -> Dict[str, float]:
    """Generate delta features based on user profile."""
    
    is_cold_start = submission_idx < 5
    
    if is_cold_start:
        return {
            "delta_attempts_same_category": 0.0,
            "delta_root_cause_repeat_rate": 0.0,
            "delta_complexity_mismatch": 0.0,
            "delta_time_to_accept": 0.0,
            "delta_optimization_transition": 0.0,
            "is_cold_start": 1,
        }
    
    # Generate realistic deltas
    skill = user.get("skill_level", "intermediate")
    
    if skill == "beginner":
        deltas = {
            "delta_attempts_same_category": random.uniform(-0.5, 0.3),
            "delta_root_cause_repeat_rate": random.uniform(-0.1, 0.4),
            "delta_complexity_mismatch": random.uniform(-0.2, 0.3),
            "delta_time_to_accept": random.uniform(-100, 200),
            "delta_optimization_transition": random.uniform(-0.2, 0.1),
        }
    elif skill == "intermediate":
        deltas = {
            "delta_attempts_same_category": random.uniform(-0.3, 0.2),
            "delta_root_cause_repeat_rate": random.uniform(-0.2, 0.2),
            "delta_complexity_mismatch": random.uniform(-0.1, 0.1),
            "delta_time_to_accept": random.uniform(-50, 100),
            "delta_optimization_transition": random.uniform(-0.1, 0.2),
        }
    else:
        deltas = {
            "delta_attempts_same_category": random.uniform(-0.2, 0.1),
            "delta_root_cause_repeat_rate": random.uniform(-0.3, 0.1),
            "delta_complexity_mismatch": random.uniform(-0.05, 0.05),
            "delta_time_to_accept": random.uniform(-30, 50),
            "delta_optimization_transition": random.uniform(0, 0.3),
        }
    
    deltas["is_cold_start"] = 0
    
    return deltas


# ═══════════════════════════════════════════════════════════════════════════════
# ACCEPTED SUBMISSION GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_accepted_submission(user: Dict, submission_idx: int) -> Dict[str, Any]:
    """Generate an accepted submission for reinforcement."""
    
    # Strong users accept in strong categories more often
    if random.random() < 0.6:
        category = random.choice(user.get("strong_categories", CATEGORIES))
    else:
        category = random.choice(CATEGORIES)
    
    difficulty = random.choice(DIFFICULTIES)
    technique = random.choice(TECHNIQUES)
    
    # Generate timestamp
    days_ago = random.randint(0, 90)
    timestamp = datetime.utcnow() - timedelta(days=days_ago)
    
    submission = {
        "user_id": user["user_id"],
        "problem_id": f"problem_{random.randint(1, 1000):04d}",
        "submission_id": f"sub_{user['user_id']}_{submission_idx:04d}",
        "verdict": "accepted",
        "category": category,
        "difficulty": difficulty,
        "technique": technique,
        "timestamp": timestamp.isoformat(),
        "time_to_solve": random.uniform(60, 3600),  # seconds
    }
    
    return submission


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_mock_dataset(
    n_users: int = 100,
    samples_per_user: int = 50,
    output_dir: str = "data",
) -> None:
    """
    Generate complete mock dataset.
    
    Creates two files:
    - mim_mock_failures.parquet: Failed submissions
    - mim_mock_accepted.parquet: Accepted submissions
    """
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"Generating mock data for {n_users} users...")
    
    users = generate_mock_users(n_users)
    
    failures = []
    accepted = []
    
    for user in users:
        n_submissions = user["submission_count"]
        failure_rate = user["failure_rate"]
        
        for i in range(n_submissions):
            if random.random() < failure_rate:
                sub = generate_failed_submission(user, i)
                failures.append(sub)
            else:
                sub = generate_accepted_submission(user, i)
                accepted.append(sub)
    
    # Create DataFrames
    df_failures = pd.DataFrame(failures)
    df_accepted = pd.DataFrame(accepted)
    
    # Save to parquet
    failures_path = output_path / "mim_mock_failures.parquet"
    accepted_path = output_path / "mim_mock_accepted.parquet"
    
    df_failures.to_parquet(failures_path, index=False)
    df_accepted.to_parquet(accepted_path, index=False)
    
    print(f"Generated {len(failures)} failed submissions -> {failures_path}")
    print(f"Generated {len(accepted)} accepted submissions -> {accepted_path}")
    
    # Print distribution stats
    print("\nRoot cause distribution:")
    print(df_failures["root_cause"].value_counts())
    
    print("\nSubtype distribution (top 10):")
    print(df_failures["subtype"].value_counts().head(10))
    
    # Save users for reference
    users_path = output_path / "mim_mock_users.json"
    with open(users_path, "w") as f:
        json.dump(users, f, indent=2, default=str)
    print(f"Saved user profiles -> {users_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate mock MIM training data")
    parser.add_argument("--users", type=int, default=100, help="Number of mock users")
    parser.add_argument("--output", type=str, default="data", help="Output directory")
    
    args = parser.parse_args()
    
    generate_mock_dataset(
        n_users=args.users,
        output_dir=args.output,
    )
