"""
MIM Model Training Script V2 - LightGBM with Improved Synthetic Data
=====================================================================

Trains MIM models with:
1. LightGBM for better accuracy on feature interactions
2. Improved synthetic data with strong feature-label correlation
3. Cross-validation for robust evaluation
4. Stratified train/validation split

Usage:
    python scripts/train_mim_v2.py

Training Labels:
- y_root_cause: One of 15 ROOT_CAUSE_CATEGORIES
- y_success: Binary (0 = failed, 1 = accepted)

V2 Changes:
- LightGBM instead of RandomForest/GradientBoosting
- Synthetic data correlates features with labels (not random)
- 5-fold stratified cross-validation
- Increased to 5000 samples
- Realistic user behavior patterns (steady learner, plateau, frustrated, etc.)
"""

import sys
import os
import numpy as np
from datetime import datetime, timedelta
from collections import Counter
import random
import json
from typing import Dict, List, Tuple, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.mim.feature_extractor import MIMFeatureExtractor, ROOT_CAUSE_CATEGORIES, FEATURE_VECTOR_SIZE
from app.mim.model import MIMModel, MODEL_DIR, LIGHTGBM_AVAILABLE

# Sklearn for evaluation
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.metrics import classification_report, f1_score, accuracy_score

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

NUM_SAMPLES = 5000  # Increased for better generalization
VALIDATION_SPLIT = 0.2
CROSS_VALIDATION_FOLDS = 5
RANDOM_SEED = 42

# Root cause distribution (realistic proportions based on coding platforms)
ROOT_CAUSE_DISTRIBUTION = {
    "logic_error": 0.22,              # Most common - wrong algorithm logic
    "boundary_condition_blindness": 0.14,  # Edge cases, empty inputs
    "off_by_one_error": 0.12,         # Loop bounds, array indexing
    "time_complexity_issue": 0.11,    # O(n²) when O(n) needed
    "edge_case_handling": 0.09,       # Specific edge cases
    "wrong_data_structure": 0.07,     # Suboptimal DS choice
    "comparison_error": 0.06,         # Wrong operators
    "integer_overflow": 0.05,         # Large inputs causing overflow
    "algorithm_choice": 0.04,         # Wrong algorithm entirely
    "recursion_issue": 0.03,          # Stack overflow, missing base case
    "type_error": 0.02,               # Type conversion issues
    "input_parsing": 0.02,            # Failed to parse input
    "partial_solution": 0.02,         # Incomplete solution
    "misread_problem": 0.01,          # Misunderstood requirements
}

# Problem categories with topic-error correlation
CATEGORIES = {
    "Array": ["boundary_condition_blindness", "off_by_one_error", "logic_error"],
    "String": ["off_by_one_error", "edge_case_handling", "comparison_error"],
    "Dynamic Programming": ["logic_error", "time_complexity_issue", "recursion_issue"],
    "Graph": ["time_complexity_issue", "algorithm_choice", "recursion_issue"],
    "Tree": ["recursion_issue", "edge_case_handling", "boundary_condition_blindness"],
    "Binary Search": ["off_by_one_error", "boundary_condition_blindness", "comparison_error"],
    "Two Pointers": ["off_by_one_error", "logic_error", "comparison_error"],
    "Stack": ["edge_case_handling", "boundary_condition_blindness", "logic_error"],
    "Queue": ["edge_case_handling", "boundary_condition_blindness", "logic_error"],
    "Linked List": ["boundary_condition_blindness", "edge_case_handling", "logic_error"],
    "Math": ["integer_overflow", "type_error", "logic_error"],
    "Greedy": ["logic_error", "algorithm_choice", "edge_case_handling"],
    "Backtracking": ["time_complexity_issue", "recursion_issue", "logic_error"],
    "Hash Table": ["edge_case_handling", "comparison_error", "logic_error"],
    "Sorting": ["time_complexity_issue", "comparison_error", "algorithm_choice"],
}

# Verdict mapping by root cause
VERDICT_BY_ROOT_CAUSE = {
    "time_complexity_issue": ("time_limit_exceeded", 0.85),
    "recursion_issue": ("runtime_error", 0.70),
    "boundary_condition_blindness": ("runtime_error", 0.60),
    "integer_overflow": ("wrong_answer", 0.75),
    "off_by_one_error": ("wrong_answer", 0.90),
    "logic_error": ("wrong_answer", 0.95),
    "comparison_error": ("wrong_answer", 0.90),
    "edge_case_handling": ("wrong_answer", 0.85),
    "wrong_data_structure": ("time_limit_exceeded", 0.40),
    "algorithm_choice": ("time_limit_exceeded", 0.50),
    "type_error": ("runtime_error", 0.65),
    "input_parsing": ("wrong_answer", 0.70),
    "partial_solution": ("wrong_answer", 0.95),
    "misread_problem": ("wrong_answer", 0.90),
}

# Languages
LANGUAGES = ["python", "cpp", "java", "javascript"]

# ═══════════════════════════════════════════════════════════════════════════════
# REALISTIC CODE TEMPLATES (Feature-Label Correlation)
# ═══════════════════════════════════════════════════════════════════════════════

CODE_TEMPLATES = {
    "boundary_condition_blindness": '''
def solve(arr):
    # MISSING: if not arr check
    result = arr[0]  # Will crash on empty array
    for i in range(1, len(arr)):
        result = max(result, arr[i])
    return result
''',
    "off_by_one_error": '''
def solve(arr, n):
    total = 0
    for i in range(n + 1):  # BUG: should be range(n)
        total += arr[i]  # Index out of bounds
    return total
''',
    "time_complexity_issue": '''
def solve(arr):
    n = len(arr)
    result = 0
    for i in range(n):
        for j in range(n):
            for k in range(n):  # O(n³) - TLE for n > 1000
                if arr[i] + arr[j] == arr[k]:
                    result += 1
    return result
''',
    "recursion_issue": '''
def solve(n):
    # MISSING: base case for n <= 1
    return solve(n-1) + solve(n-2)  # Exponential + no memoization
''',
    "integer_overflow": '''
def solve(a, b, c):
    # Large multiplication without mod
    result = a * b * c * 1000000007  # Overflow for large inputs
    return result
''',
    "logic_error": '''
def solve(arr):
    # Wrong algorithm - finds min instead of max
    result = arr[0]
    for x in arr:
        if x < result:  # BUG: should be x > result
            result = x
    return result
''',
    "comparison_error": '''
def solve(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:  # BUG: should be left <= right
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
''',
    "edge_case_handling": '''
def solve(arr):
    if len(arr) == 0:
        return 0
    # MISSING: single element case
    # MISSING: all same elements case
    return sum(arr) // len(arr)
''',
    "wrong_data_structure": '''
def solve(arr, queries):
    # Using list instead of set - O(n) lookups
    for q in queries:
        if q in arr:  # O(n) instead of O(1)
            print("found")
''',
    "algorithm_choice": '''
def solve(arr):
    # Bubble sort instead of quicksort - O(n²)
    n = len(arr)
    for i in range(n):
        for j in range(n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr
''',
}

# Accepted code template (correct solutions)
ACCEPTED_TEMPLATE = '''
def solve(arr):
    if not arr:
        return 0
    if len(arr) == 1:
        return arr[0]
    
    result = arr[0]
    for x in arr[1:]:
        if x > result:
            result = x
    return result
'''

# ═══════════════════════════════════════════════════════════════════════════════
# USER BEHAVIOR PATTERNS (Synthetic User Generator)
# ═══════════════════════════════════════════════════════════════════════════════

class UserBehaviorPattern:
    """Generates realistic user submission patterns."""
    
    @staticmethod
    def steady_learner(n_submissions: int = 20) -> List[Dict]:
        """
        Steady improvement over time.
        - Success rate increases gradually
        - Fewer errors as experience grows
        - Consistent practice schedule
        """
        submissions = []
        skill = 0.35  # Starting skill level
        
        for i in range(n_submissions):
            # Skill improves with practice (diminishing returns)
            skill = min(0.85, skill + 0.025 * (1 - skill))
            
            is_success = random.random() < skill
            
            if is_success:
                root_cause = "unknown"
            else:
                # Errors shift from basic to complex as skill grows
                if skill < 0.5:
                    root_cause = random.choices(
                        ["boundary_condition_blindness", "off_by_one_error", "logic_error"],
                        weights=[0.3, 0.4, 0.3]
                    )[0]
                else:
                    root_cause = random.choices(
                        ["time_complexity_issue", "edge_case_handling", "algorithm_choice"],
                        weights=[0.4, 0.35, 0.25]
                    )[0]
            
            submissions.append({
                "skill_level": skill,
                "is_success": is_success,
                "root_cause": root_cause,
                "pattern_type": "steady_learner",
                "submission_index": i,
            })
        
        return submissions
    
    @staticmethod
    def plateau_user(n_submissions: int = 20) -> List[Dict]:
        """
        Stuck at a certain level, not improving.
        - Consistent success rate around 55-65%
        - Same types of errors repeatedly
        - May need difficulty adjustment
        """
        submissions = []
        skill = 0.55  # Stuck at this level
        recurring_error = random.choice(["logic_error", "boundary_condition_blindness", "off_by_one_error"])
        
        for i in range(n_submissions):
            # Small random fluctuation, no real improvement
            current_skill = skill + random.uniform(-0.05, 0.05)
            is_success = random.random() < current_skill
            
            if is_success:
                root_cause = "unknown"
            else:
                # Same error type 70% of the time
                if random.random() < 0.7:
                    root_cause = recurring_error
                else:
                    root_cause = random.choices(
                        list(ROOT_CAUSE_DISTRIBUTION.keys()),
                        weights=list(ROOT_CAUSE_DISTRIBUTION.values())
                    )[0]
            
            submissions.append({
                "skill_level": current_skill,
                "is_success": is_success,
                "root_cause": root_cause,
                "pattern_type": "plateau_user",
                "recurring_error": recurring_error,
                "submission_index": i,
            })
        
        return submissions
    
    @staticmethod
    def frustrated_learner(n_submissions: int = 20) -> List[Dict]:
        """
        Struggling user, high failure rate.
        - Low success rate (30-40%)
        - Increasing attempts per problem
        - May need difficulty decrease
        """
        submissions = []
        skill = 0.35
        frustration = 0.0
        
        for i in range(n_submissions):
            # Frustration increases with failures
            is_success = random.random() < (skill - frustration * 0.1)
            
            if not is_success:
                frustration = min(0.5, frustration + 0.05)
            else:
                frustration = max(0.0, frustration - 0.1)
            
            if is_success:
                root_cause = "unknown"
            else:
                # More varied errors when frustrated
                root_cause = random.choices(
                    list(ROOT_CAUSE_DISTRIBUTION.keys()),
                    weights=list(ROOT_CAUSE_DISTRIBUTION.values())
                )[0]
            
            submissions.append({
                "skill_level": skill,
                "is_success": is_success,
                "root_cause": root_cause,
                "pattern_type": "frustrated_learner",
                "frustration_level": frustration,
                "submission_index": i,
            })
        
        return submissions
    
    @staticmethod
    def topic_hopper(n_submissions: int = 20) -> List[Dict]:
        """
        Switches topics frequently, shallow mastery.
        - Variable success rate by topic
        - Different error types
        - Needs focused practice
        """
        submissions = []
        topic_skills = {cat: random.uniform(0.3, 0.6) for cat in CATEGORIES.keys()}
        
        for i in range(n_submissions):
            # Random topic each time
            topic = random.choice(list(CATEGORIES.keys()))
            skill = topic_skills[topic]
            
            is_success = random.random() < skill
            
            if is_success:
                root_cause = "unknown"
            else:
                # Error type correlated with topic
                topic_errors = CATEGORIES.get(topic, ["logic_error"])
                root_cause = random.choice(topic_errors)
            
            submissions.append({
                "skill_level": skill,
                "is_success": is_success,
                "root_cause": root_cause,
                "pattern_type": "topic_hopper",
                "topic": topic,
                "submission_index": i,
            })
        
        return submissions
    
    @staticmethod
    def over_achiever(n_submissions: int = 20) -> List[Dict]:
        """
        Attempts hard problems prematurely.
        - Low success rate on hard problems
        - Time complexity and algorithm choice errors
        - Needs difficulty decrease
        """
        submissions = []
        skill = 0.45  # Medium skill but attempts hard problems
        
        for i in range(n_submissions):
            # Attempts problems above skill level
            difficulty_gap = random.uniform(0.1, 0.3)
            effective_success = max(0.2, skill - difficulty_gap)
            
            is_success = random.random() < effective_success
            
            if is_success:
                root_cause = "unknown"
            else:
                # Hard problem errors
                root_cause = random.choices(
                    ["time_complexity_issue", "algorithm_choice", "logic_error", "recursion_issue"],
                    weights=[0.35, 0.25, 0.25, 0.15]
                )[0]
            
            submissions.append({
                "skill_level": skill,
                "is_success": is_success,
                "root_cause": root_cause,
                "pattern_type": "over_achiever",
                "difficulty_gap": difficulty_gap,
                "submission_index": i,
            })
        
        return submissions


# ═══════════════════════════════════════════════════════════════════════════════
# SYNTHETIC DATA GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_code_for_root_cause(root_cause: str, is_success: bool) -> str:
    """Generate code that correlates with the root cause."""
    if is_success:
        # Correct solution with variations
        base = ACCEPTED_TEMPLATE
        # Add random comments to vary length
        comments = "\n".join([f"# Step {i}: processing" for i in range(random.randint(3, 10))])
        return base + "\n" + comments
    
    # Get template for this error type
    template = CODE_TEMPLATES.get(root_cause, CODE_TEMPLATES["logic_error"])
    
    # Add random padding to vary code length
    padding = "\n    pass  # processing" * random.randint(5, 20)
    return template + padding


def generate_synthetic_submission(
    root_cause: str, 
    is_success: bool,
    pattern_info: Optional[Dict] = None
) -> Dict:
    """
    Generate a synthetic submission with STRONG feature-label correlation.
    
    Key correlations:
    - root_cause → code patterns (boundary checks, loop bounds, complexity)
    - root_cause → verdict type
    - root_cause → problem category
    - is_success → code structure
    """
    
    # 1. Verdict based on root cause (not random)
    if is_success:
        verdict = "accepted"
    else:
        verdict_info = VERDICT_BY_ROOT_CAUSE.get(root_cause, ("wrong_answer", 0.9))
        verdict = verdict_info[0] if random.random() < verdict_info[1] else "wrong_answer"
    
    # 2. Code generated to match root cause
    code = generate_code_for_root_cause(root_cause, is_success)
    
    # 3. Category correlated with error type
    # Find categories where this error is common
    matching_categories = [
        cat for cat, errors in CATEGORIES.items() 
        if root_cause in errors
    ]
    if matching_categories:
        category = random.choice(matching_categories)
    else:
        category = random.choice(list(CATEGORIES.keys()))
    
    # 4. Difficulty correlated with error type
    if root_cause in ["time_complexity_issue", "algorithm_choice", "recursion_issue"]:
        difficulty = random.choices(["Easy", "Medium", "Hard"], weights=[0.1, 0.3, 0.6])[0]
    elif root_cause in ["boundary_condition_blindness", "off_by_one_error"]:
        difficulty = random.choices(["Easy", "Medium", "Hard"], weights=[0.4, 0.4, 0.2])[0]
    else:
        difficulty = random.choices(["Easy", "Medium", "Hard"], weights=[0.25, 0.5, 0.25])[0]
    
    # 5. Constraints based on error type
    if root_cause == "time_complexity_issue":
        constraints = "1 <= n <= 10^5"  # Large n suggests O(n log n) needed
    elif root_cause == "integer_overflow":
        constraints = "1 <= a, b <= 10^9"  # Large values suggest overflow risk
    else:
        constraints = f"1 <= n <= {random.choice([100, 1000, 10000])}"
    
    # 6. Attempts based on pattern
    if pattern_info:
        if pattern_info.get("pattern_type") == "frustrated_learner":
            attempts = random.randint(3, 10)
        elif pattern_info.get("pattern_type") == "steady_learner":
            attempts = random.randint(1, 4)
        else:
            attempts = random.randint(1, 6)
    else:
        attempts = random.randint(1, 8) if not is_success else random.randint(1, 3)
    
    # Time-based features
    hour = random.randint(0, 23)
    is_weekend = random.random() < 0.3
    
    return {
        "user_id": f"user_{random.randint(1000, 9999)}",
        "problem_id": f"problem_{random.randint(1, 1000)}",
        "verdict": verdict,
        "code": code,
        "language": random.choice(LANGUAGES),
        "problem_category": category,
        "difficulty": difficulty,
        "error_type": root_cause if not is_success else None,
        "attempts_count": attempts,
        "hour_of_day": hour,
        "is_weekend": is_weekend,
        "code_length": len(code),
        "code_lines": code.count("\n"),
        "constraints": constraints,
        "status": "accepted" if is_success else verdict,
    }


def generate_user_history_from_pattern(
    user_id: str, 
    pattern_func,
    n_submissions: int = 15
) -> Tuple[List[Dict], Dict]:
    """
    Generate user history based on a behavior pattern.
    
    Returns:
        (history_list, current_submission_info)
    """
    pattern_data = pattern_func(n_submissions)
    
    history = []
    for i, p in enumerate(pattern_data[:-1]):  # All except last
        sub = generate_synthetic_submission(
            p["root_cause"],
            p["is_success"],
            p
        )
        sub["user_id"] = user_id
        sub["createdAt"] = (datetime.now() - timedelta(days=n_submissions-i)).isoformat()
        history.append(sub)
    
    # Current submission is the last pattern entry
    current_pattern = pattern_data[-1]
    
    return sorted(history, key=lambda x: x["createdAt"]), current_pattern


def generate_training_data(num_samples: int = NUM_SAMPLES) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate complete training dataset with diverse user patterns.
    
    Returns:
        (X, y_root_cause, y_success)
    """
    print(f"\n{'='*70}")
    print(f"🎲 GENERATING SYNTHETIC TRAINING DATA V2")
    print(f"{'='*70}")
    print(f"Target samples: {num_samples}")
    print(f"Using LightGBM: {LIGHTGBM_AVAILABLE}")
    
    extractor = MIMFeatureExtractor()
    
    all_features = []
    all_root_causes = []
    all_success = []
    
    # User pattern distribution
    pattern_functions = [
        (UserBehaviorPattern.steady_learner, 0.30),
        (UserBehaviorPattern.plateau_user, 0.25),
        (UserBehaviorPattern.frustrated_learner, 0.20),
        (UserBehaviorPattern.topic_hopper, 0.15),
        (UserBehaviorPattern.over_achiever, 0.10),
    ]
    
    print(f"\n📊 User pattern distribution:")
    for func, ratio in pattern_functions:
        print(f"   └─ {func.__name__}: {ratio:.0%}")
    
    # Calculate samples per root cause
    samples_per_cause = {}
    remaining = num_samples
    for cause, ratio in ROOT_CAUSE_DISTRIBUTION.items():
        count = int(num_samples * ratio)
        samples_per_cause[cause] = count
        remaining -= count
    samples_per_cause["logic_error"] += remaining
    
    # Add accepted samples (20% of total)
    accepted_count = int(num_samples * 0.20)
    
    print(f"\n📊 Root cause distribution:")
    print(f"   └─ accepted: {accepted_count}")
    for cause, count in samples_per_cause.items():
        print(f"   └─ {cause}: {count}")
    
    user_counter = 0
    success_counter = 0
    failure_counter = 0
    
    # Generate accepted submissions
    print(f"\n🔄 Generating {accepted_count} accepted submissions...")
    for i in range(accepted_count):
        # Choose a random pattern
        pattern_func = random.choices(
            [p[0] for p in pattern_functions],
            weights=[p[1] for p in pattern_functions]
        )[0]
        
        user_id = f"synthetic_user_{user_counter}"
        user_counter += 1
        
        # Generate history with pattern
        user_history, _ = generate_user_history_from_pattern(
            user_id, pattern_func, random.randint(8, 20)
        )
        
        # Current submission is accepted
        submission = generate_synthetic_submission("unknown", True)
        submission["user_id"] = user_id
        
        try:
            features = extractor.extract(
                submission=submission,
                user_history=user_history,
                problem_context={
                    "difficulty": submission["difficulty"],
                    "tags": [submission["problem_category"]],
                    "constraints": submission["constraints"],
                },
                user_memory=None,  # Will add RAG context validation later
            )
            
            all_features.append(features)
            all_root_causes.append("unknown")  # Accepted = unknown root cause
            all_success.append(1)
            success_counter += 1
            
        except Exception as e:
            print(f"   ⚠️ Feature extraction failed: {e}")
    
    # Generate failed submissions by root cause
    for root_cause, count in samples_per_cause.items():
        print(f"\n🔄 Generating {count} samples for '{root_cause}'...")
        
        for i in range(count):
            # Choose pattern based on root cause
            if root_cause in ["time_complexity_issue", "algorithm_choice"]:
                pattern_func = random.choices(
                    [UserBehaviorPattern.over_achiever, UserBehaviorPattern.plateau_user],
                    weights=[0.6, 0.4]
                )[0]
            elif root_cause in ["boundary_condition_blindness", "off_by_one_error"]:
                pattern_func = random.choices(
                    [UserBehaviorPattern.steady_learner, UserBehaviorPattern.frustrated_learner],
                    weights=[0.5, 0.5]
                )[0]
            else:
                pattern_func = random.choices(
                    [p[0] for p in pattern_functions],
                    weights=[p[1] for p in pattern_functions]
                )[0]
            
            user_id = f"synthetic_user_{user_counter}"
            user_counter += 1
            
            # Generate history with pattern
            user_history, current_pattern = generate_user_history_from_pattern(
                user_id, pattern_func, random.randint(8, 20)
            )
            
            # Override with our target root cause
            submission = generate_synthetic_submission(root_cause, False, current_pattern)
            submission["user_id"] = user_id
            
            try:
                features = extractor.extract(
                    submission=submission,
                    user_history=user_history,
                    problem_context={
                        "difficulty": submission["difficulty"],
                        "tags": [submission["problem_category"]],
                        "constraints": submission["constraints"],
                    },
                    user_memory=None,
                )
                
                all_features.append(features)
                all_root_causes.append(root_cause)
                all_success.append(0)
                failure_counter += 1
                
            except Exception as e:
                print(f"   ⚠️ Feature extraction failed: {e}")
    
    # Convert to numpy arrays
    X = np.vstack(all_features)
    y_root_cause = np.array(all_root_causes)
    y_success = np.array(all_success)
    
    print(f"\n✅ Generated {len(X)} training samples")
    print(f"   └─ Feature shape: {X.shape}")
    print(f"   └─ Success rate: {y_success.mean():.1%}")
    print(f"   └─ Accepted: {success_counter}, Failed: {failure_counter}")
    print(f"   └─ Root cause distribution:")
    for cause, count in Counter(y_root_cause).most_common():
        print(f"      └─ {cause}: {count} ({count/len(X):.1%})")
    
    return X, y_root_cause, y_success


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING WITH CROSS-VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def train_with_cross_validation(
    X: np.ndarray, 
    y_root_cause: np.ndarray, 
    y_success: np.ndarray
) -> Dict:
    """
    Train MIM models with stratified cross-validation.
    
    Returns:
        Training metrics including CV scores
    """
    print(f"\n{'='*70}")
    print(f"🎓 TRAINING MIM MODELS WITH CROSS-VALIDATION")
    print(f"{'='*70}")
    print(f"   └─ Samples: {len(X)}")
    print(f"   └─ Features: {X.shape[1]}")
    print(f"   └─ CV Folds: {CROSS_VALIDATION_FOLDS}")
    print(f"   └─ Using LightGBM: {LIGHTGBM_AVAILABLE}")
    
    # Split into train/validation
    X_train, X_val, y_root_train, y_root_val, y_success_train, y_success_val = train_test_split(
        X, y_root_cause, y_success,
        test_size=VALIDATION_SPLIT,
        stratify=y_root_cause,
        random_state=RANDOM_SEED
    )
    
    print(f"\n📊 Data split:")
    print(f"   └─ Training: {len(X_train)} samples")
    print(f"   └─ Validation: {len(X_val)} samples")
    
    # Initialize model
    model = MIMModel()
    
    # Train on training set
    print(f"\n🔄 Training models...")
    metrics = model.fit(X_train, y_root_train, y_success_train)
    
    # Evaluate on validation set
    print(f"\n📊 Validation Metrics:")
    
    # Scale validation features
    X_val_scaled = model.scaler.transform(X_val)
    y_root_val_encoded = model.label_encoder.transform(y_root_val)
    
    # Root cause predictions
    y_root_pred = model.root_cause_model.predict(X_val_scaled)
    val_accuracy = accuracy_score(y_root_val_encoded, y_root_pred)
    val_f1 = f1_score(y_root_val_encoded, y_root_pred, average="weighted")
    
    print(f"   └─ Root Cause Accuracy: {val_accuracy:.2%}")
    print(f"   └─ Root Cause F1: {val_f1:.2%}")
    
    # Readiness predictions
    y_readiness_pred = model.readiness_model.predict(X_val_scaled)
    readiness_accuracy = accuracy_score(y_success_val, y_readiness_pred)
    print(f"   └─ Readiness Accuracy: {readiness_accuracy:.2%}")
    
    # Performance predictions
    y_perf_pred = model.performance_model.predict(X_val_scaled)
    perf_accuracy = accuracy_score(y_success_val, y_perf_pred)
    print(f"   └─ Performance Accuracy: {perf_accuracy:.2%}")
    
    # Cross-validation on full data
    print(f"\n🔄 Running {CROSS_VALIDATION_FOLDS}-fold cross-validation...")
    
    cv = StratifiedKFold(n_splits=CROSS_VALIDATION_FOLDS, shuffle=True, random_state=RANDOM_SEED)
    
    # Retrain model for full metrics
    model_full = MIMModel()
    model_full._initialize_models()
    X_scaled = model_full.scaler.fit_transform(X)
    y_root_encoded = model_full.label_encoder.transform(y_root_cause)
    
    # CV scores for root cause model
    if LIGHTGBM_AVAILABLE:
        # LightGBM CV
        import lightgbm as lgb
        cv_model = lgb.LGBMClassifier(
            objective='multiclass',
            n_estimators=300,
            max_depth=10,
            learning_rate=0.05,
            class_weight='balanced',
            random_state=42,
            verbose=-1,
        )
    else:
        cv_model = RandomForestClassifier(
            n_estimators=200, max_depth=15, class_weight="balanced", random_state=42, n_jobs=-1
        )
    
    cv_scores = cross_val_score(cv_model, X_scaled, y_root_encoded, cv=cv, scoring='f1_weighted')
    print(f"\n📊 Cross-Validation Results:")
    print(f"   └─ Root Cause F1 (CV): {cv_scores.mean():.2%} ± {cv_scores.std():.2%}")
    print(f"   └─ Individual folds: {[f'{s:.2%}' for s in cv_scores]}")
    
    # Update metrics
    metrics["val_root_cause_accuracy"] = val_accuracy
    metrics["val_root_cause_f1"] = val_f1
    metrics["val_readiness_accuracy"] = readiness_accuracy
    metrics["val_performance_accuracy"] = perf_accuracy
    metrics["cv_f1_mean"] = cv_scores.mean()
    metrics["cv_f1_std"] = cv_scores.std()
    
    # Train final model on ALL data
    print(f"\n🔄 Training final model on all data...")
    final_model = MIMModel()
    final_metrics = final_model.fit(X, y_root_cause, y_success)
    
    # Save final model
    print(f"\n💾 Saving models to {MODEL_DIR}...")
    final_model.save()
    
    # Also save individual model files
    import joblib
    
    joblib.dump(final_model.scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    joblib.dump(final_model.root_cause_model, os.path.join(MODEL_DIR, "root_cause_classifier.joblib"))
    joblib.dump(final_model.readiness_model, os.path.join(MODEL_DIR, "readiness_model.joblib"))
    joblib.dump(final_model.performance_model, os.path.join(MODEL_DIR, "performance_forecaster.joblib"))
    joblib.dump(final_model.label_encoder, os.path.join(MODEL_DIR, "label_encoder.joblib"))
    
    # Save metadata
    metadata = {
        "model_version": final_model.model_version,
        "training_date": datetime.now().isoformat(),
        "training_samples": len(X),
        "feature_dimensions": X.shape[1],
        "validation_samples": len(X_val),
        "cv_folds": CROSS_VALIDATION_FOLDS,
        "metrics": {
            "train": final_metrics,
            "validation": {
                "root_cause_accuracy": val_accuracy,
                "root_cause_f1": val_f1,
                "readiness_accuracy": readiness_accuracy,
                "performance_accuracy": perf_accuracy,
            },
            "cross_validation": {
                "f1_mean": float(cv_scores.mean()),
                "f1_std": float(cv_scores.std()),
                "fold_scores": cv_scores.tolist(),
            }
        },
        "root_cause_categories": ROOT_CAUSE_CATEGORIES,
        "lightgbm_used": LIGHTGBM_AVAILABLE,
    }
    
    with open(os.path.join(MODEL_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n✅ Models saved successfully!")
    print(f"   └─ scaler.joblib")
    print(f"   └─ root_cause_classifier.joblib")
    print(f"   └─ readiness_model.joblib")
    print(f"   └─ performance_forecaster.joblib")
    print(f"   └─ label_encoder.joblib")
    print(f"   └─ metadata.json")
    
    return metrics


def validate_model():
    """Validate the trained model by loading and testing."""
    print(f"\n{'='*70}")
    print(f"✅ VALIDATING TRAINED MODEL")
    print(f"{'='*70}")
    
    # Load fresh model
    model = MIMModel()
    loaded = model.load()
    
    if not loaded:
        print("❌ Failed to load model!")
        return False
    
    print(f"✅ Model loaded successfully")
    print(f"   └─ Version: {model.model_version}")
    print(f"   └─ Training samples: {model.training_samples}")
    print(f"   └─ Is fitted: {model.is_fitted}")
    print(f"   └─ LightGBM available: {LIGHTGBM_AVAILABLE}")
    
    # Test with realistic feature vector
    print(f"\n🧪 Testing predictions with sample features...")
    
    # Generate a test submission
    test_submission = generate_synthetic_submission("logic_error", False)
    extractor = MIMFeatureExtractor()
    test_features = extractor.extract(
        submission=test_submission,
        user_history=[],
        problem_context={"difficulty": "Medium", "tags": ["Array"]},
        user_memory=None,
    )
    
    root_cause = model.predict_root_cause(test_features)
    print(f"   └─ Root Cause: {root_cause['failure_cause']} (confidence: {root_cause['confidence']:.2%})")
    alternatives_str = ", ".join([f"{a['cause']}({a['confidence']:.0%})" for a in root_cause['alternatives'][:3]])
    print(f"   └─ Alternatives: {alternatives_str}")
    
    readiness = model.predict_readiness(test_features)
    print(f"   └─ Readiness Level: {readiness['current_level']}")
    print(f"   └─ Easy: {readiness['easy_readiness']:.2%}, Medium: {readiness['medium_readiness']:.2%}, Hard: {readiness['hard_readiness']:.2%}")
    
    performance = model.predict_performance(test_features)
    print(f"   └─ Expected Success Rate: {performance['expected_success_rate']:.2%}")
    
    print(f"\n✅ Model validation passed!")
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)
    
    print(f"\n{'#'*70}")
    print(f"# MIM MODEL TRAINING V2 - LightGBM + IMPROVED SYNTHETIC DATA")
    print(f"# Target: {FEATURE_VECTOR_SIZE} features")
    print(f"# Samples: {NUM_SAMPLES}")
    print(f"# LightGBM: {LIGHTGBM_AVAILABLE}")
    print(f"{'#'*70}")
    
    # Generate training data
    X, y_root_cause, y_success = generate_training_data(NUM_SAMPLES)
    
    # Train with cross-validation
    metrics = train_with_cross_validation(X, y_root_cause, y_success)
    
    # Validate
    validate_model()
    
    print(f"\n{'#'*70}")
    print(f"# TRAINING COMPLETE!")
    print(f"# Summary:")
    print(f"#   - Validation F1: {metrics.get('val_root_cause_f1', 0):.2%}")
    print(f"#   - CV F1: {metrics.get('cv_f1_mean', 0):.2%} ± {metrics.get('cv_f1_std', 0):.2%}")
    print(f"{'#'*70}\n")
