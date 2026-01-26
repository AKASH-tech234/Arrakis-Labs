"""
MIM Model Training Script - 60 Feature Dimensions
==================================================

Trains MIM models with the full 60-dimensional feature extractor.

Usage:
    python scripts/train_mim_60.py

This script:
1. Generates synthetic training data with realistic patterns
2. Extracts 60-dimensional features using MIMFeatureExtractor
3. Trains all three MIM models (root_cause, readiness, performance)
4. Saves models to ai-services/app/mim/models/

Training Labels Required:
- y_root_cause: One of 16 ROOT_CAUSE_CATEGORIES
- y_success: Binary (0 = failed, 1 = accepted)
"""

import sys
import os
import numpy as np
from datetime import datetime, timedelta
from collections import Counter
import random
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.mim.feature_extractor import MIMFeatureExtractor, ROOT_CAUSE_CATEGORIES, FEATURE_VECTOR_SIZE
from app.mim.model import MIMModel, MODEL_DIR

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Number of synthetic samples to generate
NUM_SAMPLES = 2000

# Root cause distribution (realistic proportions)
ROOT_CAUSE_DISTRIBUTION = {
    "logic_error": 0.25,              # Most common
    "boundary_condition_blindness": 0.15,
    "off_by_one_error": 0.12,
    "time_complexity_issue": 0.10,
    "edge_case_handling": 0.08,
    "wrong_data_structure": 0.06,
    "comparison_error": 0.05,
    "integer_overflow": 0.04,
    "algorithm_choice": 0.04,
    "recursion_issue": 0.03,
    "type_error": 0.02,
    "input_parsing": 0.02,
    "partial_solution": 0.02,
    "misread_problem": 0.01,
    "unknown": 0.01,
}

# Verdict distribution
VERDICT_DISTRIBUTION = {
    "accepted": 0.30,
    "wrong_answer": 0.45,
    "time_limit_exceeded": 0.12,
    "runtime_error": 0.08,
    "compile_error": 0.03,
    "memory_limit_exceeded": 0.02,
}

# Problem categories
CATEGORIES = ["Array", "String", "Dynamic Programming", "Graph", "Tree", 
              "Binary Search", "Two Pointers", "Stack", "Queue", "Linked List",
              "Math", "Greedy", "Backtracking", "Hash Table", "Sorting"]

# Languages
LANGUAGES = ["python", "cpp", "java", "javascript"]

# Sample code templates for different error types
CODE_TEMPLATES = {
    "boundary_check": """
def solve(arr):
    if len(arr) == 0:  # {has_check}
        return 0
    for i in range(len(arr)):
        if arr[i] > arr[i+1]:  # potential IndexError
            return i
    return -1
""",
    "loop_bound": """
def solve(n, arr):
    result = 0
    for i in range({bound}):  # off-by-one potential
        result += arr[i]
    return result
""",
    "overflow": """
def solve(a, b):
    return a * b  # potential overflow for large inputs
""",
    "complexity": """
def solve(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n):  # O(n^2) when O(n) possible
            if arr[i] == arr[j]:
                return True
    return False
""",
}


# ═══════════════════════════════════════════════════════════════════════════════
# SYNTHETIC DATA GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_synthetic_submission(root_cause: str, is_success: bool) -> dict:
    """Generate a synthetic submission with realistic characteristics."""
    
    # Select verdict based on root cause and success
    if is_success:
        verdict = "accepted"
    else:
        if root_cause == "time_complexity_issue":
            verdict = random.choices(
                ["time_limit_exceeded", "wrong_answer"],
                weights=[0.8, 0.2]
            )[0]
        elif root_cause in ["recursion_issue", "boundary_condition_blindness"]:
            verdict = random.choices(
                ["runtime_error", "wrong_answer"],
                weights=[0.6, 0.4]
            )[0]
        elif root_cause == "integer_overflow":
            verdict = random.choices(
                ["wrong_answer", "runtime_error"],
                weights=[0.7, 0.3]
            )[0]
        else:
            verdict = "wrong_answer"
    
    # Generate code based on error type
    code_length = random.randint(50, 500)
    has_boundary_check = root_cause != "boundary_condition_blindness"
    has_correct_bound = root_cause != "off_by_one_error"
    
    # Generate realistic code snippet
    code_lines = random.randint(10, 100)
    code = f"// Synthetic code for {root_cause}\n" + "x = 1\n" * code_lines
    
    # Add characteristic patterns based on root cause
    if root_cause == "boundary_condition_blindness":
        code = code.replace("x = 1", "arr[i]")  # No boundary check
    elif root_cause == "off_by_one_error":
        code = code.replace("x = 1", "for i in range(n+1)")  # Wrong bound
    elif root_cause == "integer_overflow":
        code = code.replace("x = 1", "result = a * b * c")  # Potential overflow
    elif root_cause == "time_complexity_issue":
        code = code.replace("x = 1", "for i in range(n):\n    for j in range(n)")
    elif root_cause == "comparison_error":
        code = code.replace("x = 1", "if a < b")  # Should be <=
    
    # Generate submission metadata
    category = random.choice(CATEGORIES)
    language = random.choice(LANGUAGES)
    difficulty = random.choice(["Easy", "Medium", "Hard"])
    
    # Time-based features
    hour = random.randint(0, 23)
    is_weekend = random.random() < 0.3
    
    return {
        "user_id": f"user_{random.randint(1000, 9999)}",
        "problem_id": f"problem_{random.randint(1, 1000)}",
        "verdict": verdict,
        "code": code,
        "language": language,
        "problem_category": category,
        "difficulty": difficulty,
        "error_type": root_cause if not is_success else None,
        "attempts_count": random.randint(1, 10),
        "hour_of_day": hour,
        "is_weekend": is_weekend,
        "code_length": len(code),
        "code_lines": code_lines,
        "constraints": f"1 <= n <= {random.choice([100, 1000, 10000, 100000])}",
        # Feature hints for extractor
        "_has_boundary_check": has_boundary_check,
        "_has_correct_bound": has_correct_bound,
        "_has_nested_loop": root_cause == "time_complexity_issue",
        "_has_overflow_risk": root_cause == "integer_overflow",
    }


def generate_user_history(user_id: str, num_submissions: int = 10) -> list:
    """Generate synthetic user submission history."""
    history = []
    
    # User skill level affects success rate
    skill_level = random.uniform(0.2, 0.8)
    
    for i in range(num_submissions):
        is_success = random.random() < skill_level
        root_cause = "unknown" if is_success else random.choices(
            list(ROOT_CAUSE_DISTRIBUTION.keys()),
            weights=list(ROOT_CAUSE_DISTRIBUTION.values())
        )[0]
        
        sub = generate_synthetic_submission(root_cause, is_success)
        sub["user_id"] = user_id
        sub["createdAt"] = (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
        history.append(sub)
    
    return sorted(history, key=lambda x: x["createdAt"])


def generate_training_data(num_samples: int = NUM_SAMPLES) -> tuple:
    """
    Generate complete training dataset.
    
    Returns:
        (X, y_root_cause, y_success) - feature matrix and labels
    """
    print(f"\n{'='*70}")
    print(f"🎲 GENERATING SYNTHETIC TRAINING DATA")
    print(f"{'='*70}")
    print(f"Target samples: {num_samples}")
    
    extractor = MIMFeatureExtractor()
    
    all_features = []
    all_root_causes = []
    all_success = []
    
    # Generate samples according to distribution
    samples_per_cause = {}
    remaining = num_samples
    
    for cause, ratio in ROOT_CAUSE_DISTRIBUTION.items():
        count = int(num_samples * ratio)
        samples_per_cause[cause] = count
        remaining -= count
    
    # Distribute remaining samples
    samples_per_cause["logic_error"] += remaining
    
    print(f"\n📊 Root cause distribution:")
    for cause, count in samples_per_cause.items():
        print(f"   └─ {cause}: {count}")
    
    # Generate samples
    user_counter = 0
    for root_cause, count in samples_per_cause.items():
        print(f"\n🔄 Generating {count} samples for '{root_cause}'...")
        
        for i in range(count):
            # Determine if this is a success (only "unknown" can be success)
            is_success = (root_cause == "unknown") or (root_cause == "accepted")
            
            # For accepted submissions, use "unknown" as root cause
            actual_root_cause = "unknown" if is_success else root_cause
            
            # Generate user with history
            user_id = f"synthetic_user_{user_counter}"
            user_counter += 1
            
            # Generate submission
            submission = generate_synthetic_submission(actual_root_cause, is_success)
            submission["user_id"] = user_id
            
            # Generate user history
            user_history = generate_user_history(user_id, random.randint(5, 20))
            
            # Extract features
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
                all_root_causes.append(actual_root_cause)
                all_success.append(1 if is_success else 0)
                
            except Exception as e:
                print(f"   ⚠️ Feature extraction failed: {e}")
                continue
    
    # Convert to numpy arrays
    X = np.vstack(all_features)
    y_root_cause = np.array(all_root_causes)
    y_success = np.array(all_success)
    
    print(f"\n✅ Generated {len(X)} training samples")
    print(f"   └─ Feature shape: {X.shape}")
    print(f"   └─ Success rate: {y_success.mean():.1%}")
    print(f"   └─ Root cause distribution: {dict(Counter(y_root_cause))}")
    
    return X, y_root_cause, y_success


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ═══════════════════════════════════════════════════════════════════════════════

def train_mim_models(X: np.ndarray, y_root_cause: np.ndarray, y_success: np.ndarray) -> dict:
    """
    Train all MIM models with the generated data.
    
    Args:
        X: Feature matrix (n_samples, 60)
        y_root_cause: Root cause labels
        y_success: Binary success labels
        
    Returns:
        Training metrics
    """
    print(f"\n{'='*70}")
    print(f"🎓 TRAINING MIM MODELS")
    print(f"{'='*70}")
    
    # Initialize model
    model = MIMModel()
    
    # Train
    print("\n🔄 Training models...")
    metrics = model.fit(X, y_root_cause, y_success)
    
    print(f"\n📊 Training Results:")
    print(f"   └─ Root Cause Accuracy: {metrics.get('root_cause_accuracy', 0):.2%}")
    print(f"   └─ Root Cause F1: {metrics.get('root_cause_f1', 0):.2%}")
    print(f"   └─ Readiness Accuracy: {metrics.get('readiness_accuracy', 0):.2%}")
    print(f"   └─ Performance Accuracy: {metrics.get('performance_accuracy', 0):.2%}")
    
    # Save model
    print(f"\n💾 Saving models to {MODEL_DIR}...")
    model_path = model.save()
    
    # Also save individual model files for backward compatibility
    import joblib
    
    joblib.dump(model.scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    joblib.dump(model.root_cause_model, os.path.join(MODEL_DIR, "root_cause_classifier.joblib"))
    joblib.dump(model.readiness_model, os.path.join(MODEL_DIR, "readiness_model.joblib"))
    joblib.dump(model.performance_model, os.path.join(MODEL_DIR, "performance_forecaster.joblib"))
    joblib.dump(model.label_encoder, os.path.join(MODEL_DIR, "label_encoder.joblib"))
    
    # Save metadata
    metadata = {
        "model_version": model.model_version,
        "training_date": datetime.now().isoformat(),
        "training_samples": len(X),
        "feature_dimensions": X.shape[1],
        "metrics": metrics,
        "root_cause_categories": ROOT_CAUSE_CATEGORIES,
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
    
    # Test with random feature vector
    test_features = np.random.randn(60).astype(np.float32)
    
    print(f"\n🧪 Testing predictions with random features...")
    
    root_cause = model.predict_root_cause(test_features)
    print(f"   └─ Root Cause: {root_cause['failure_cause']} (confidence: {root_cause['confidence']:.2%})")
    
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
    print(f"\n{'#'*70}")
    print(f"# MIM MODEL TRAINING - 60 FEATURE DIMENSIONS")
    print(f"# Target: {FEATURE_VECTOR_SIZE} features")
    print(f"# Samples: {NUM_SAMPLES}")
    print(f"{'#'*70}")
    
    # Generate training data
    X, y_root_cause, y_success = generate_training_data(NUM_SAMPLES)
    
    # Train models
    metrics = train_mim_models(X, y_root_cause, y_success)
    
    # Validate
    validate_model()
    
    print(f"\n{'#'*70}")
    print(f"# TRAINING COMPLETE!")
    print(f"{'#'*70}\n")
