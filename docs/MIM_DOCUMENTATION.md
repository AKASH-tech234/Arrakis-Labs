# MIM - Mentat Intelligence Model

## Comprehensive Documentation

**Version:** 2.0.0  
**Author:** Arrakis Labs  
**Last Updated:** January 24, 2026

---

> **🆕 V2.0 Release Notes (January 2026)**
>
> - Expanded root cause categories: 9 → 15 categories
> - New Problem Recommendation Engine (LightGBM ranker)
> - New Evaluation Pipeline with user-aware splits
> - 5 new MIM API endpoints
> - New schemas: `MIMDifficultyAdjustment`, `MIMRecommendations`, `MIMModelMetrics`, `MIMStatus`
> - 85+ unit tests for comprehensive coverage

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Feature Engineering](#3-feature-engineering)
4. [Model Components](#4-model-components)
5. [Training Pipeline](#5-training-pipeline)
6. [Inference System](#6-inference-system)
7. [Problem Recommender (V2.0)](#7-problem-recommender-v20)
8. [Evaluation Pipeline (V2.0)](#8-evaluation-pipeline-v20)
9. [Workflow Integration](#9-workflow-integration)
10. [Agent Prompt Integration](#10-agent-prompt-integration)
11. [API Reference](#11-api-reference)
12. [Configuration](#12-configuration)
13. [Troubleshooting](#13-troubleshooting)
14. [Version History](#14-version-history)

---

## 1. Overview

### 1.1 What is MIM?

The **Mentat Intelligence Model (MIM)** is a predictive machine learning layer that transforms the Arrakis feedback system from a reactive analysis tool into a proactive intelligence system. Instead of only analyzing what went wrong after the fact, MIM predicts:

- **Why** a user is likely failing (root cause prediction)
- **What** they're ready to tackle next (readiness assessment)
- **How** they'll perform in the future (performance forecasting)

### 1.2 Key Capabilities

| Capability                     | Description                                              | Output                         |
| ------------------------------ | -------------------------------------------------------- | ------------------------------ |
| **Root Cause Prediction**      | Predicts the primary reason for submission failure       | Category + confidence score    |
| **Readiness Assessment**       | Evaluates user's readiness for easy/medium/hard problems | Per-difficulty probabilities   |
| **Performance Forecasting**    | Predicts success rate for next N submissions             | Success probability + velocity |
| **Similar Mistake Detection**  | Identifies patterns from user's history                  | List of similar past failures  |
| **Focus Area Recommendations** | Suggests topics/skills to prioritize                     | Ranked recommendation list     |
| **Problem Recommendation** 🆕  | Personalized next-problem suggestions via L2R            | Ranked problems + success prob |
| **Difficulty Adjustment** 🆕   | Dynamic difficulty calibration                           | Increase/decrease/maintain     |

### 1.3 Design Philosophy

1. **Speed**: Inference completes in <1 second (target: 200ms)
2. **Graceful Degradation**: Falls back silently if models are untrained
3. **Cold Start Handling**: Uses problem difficulty as proxy for new users
4. **Transparency**: All predictions include confidence scores
5. **Agent Guidance**: Provides structured instructions for how agents should use predictions

### 1.4 Why MIM?

Traditional feedback systems analyze submissions in isolation. MIM adds a temporal and pattern-recognition dimension:

```
Traditional Flow:
  Submission → Analysis → Feedback

MIM-Enhanced Flow:
  Submission → MIM Prediction → Analysis (guided by prediction) → Feedback (personalized)
```

---

## 2. Architecture

### 2.1 Module Structure

```
ai-services/app/mim/
├── __init__.py           # Module exports
├── schemas.py            # Pydantic data models
├── feature_extractor.py  # 60-dimensional feature engineering
├── model.py              # sklearn ML models
├── inference.py          # Real-time prediction service
└── training.py           # Offline training pipeline
```

### 2.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MIM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐   │
│  │ Submission  │────▶│ Feature Extractor │────▶│    60-dim Vector        │   │
│  │   + User    │     │  (feature_        │     │ [submission, error,     │   │
│  │   History   │     │   extractor.py)   │     │  problem, temporal,     │   │
│  └─────────────┘     └──────────────────┘     │  historical]            │   │
│                                                └───────────┬─────────────┘   │
│                                                            │                 │
│                      ┌─────────────────────────────────────┼─────────────┐   │
│                      │                                     ▼             │   │
│                      │              ┌──────────────────────────────┐     │   │
│                      │              │         MIM Model            │     │   │
│                      │              │        (model.py)            │     │   │
│                      │              ├──────────────────────────────┤     │   │
│                      │              │ ┌────────────────────────┐   │     │   │
│                      │              │ │ Root Cause Classifier  │   │     │   │
│                      │              │ │ (CalibratedClassifierCV │   │     │   │
│                      │              │ │  + RandomForest)       │   │     │   │
│                      │              │ └────────────────────────┘   │     │   │
│                      │              │ ┌────────────────────────┐   │     │   │
│                      │              │ │ Readiness Regressor    │   │     │   │
│                      │              │ │ (GradientBoosting)     │   │     │   │
│                      │              │ └────────────────────────┘   │     │   │
│                      │              │ ┌────────────────────────┐   │     │   │
│                      │              │ │ Performance Predictor  │   │     │   │
│                      │              │ │ (LogisticRegression)   │   │     │   │
│                      │              │ └────────────────────────┘   │     │   │
│                      │              └──────────────┬───────────────┘     │   │
│                      │                             │                     │   │
│                      └─────────────────────────────┼─────────────────────┘   │
│                                                    ▼                         │
│                      ┌─────────────────────────────────────────────────┐     │
│                      │              MIM Inference                       │     │
│                      │            (inference.py)                        │     │
│                      ├─────────────────────────────────────────────────┤     │
│                      │  • Singleton pattern (one instance)             │     │
│                      │  • Graceful degradation                         │     │
│                      │  • Cold start detection                         │     │
│                      │  • Similar mistake matching                     │     │
│                      └───────────────────┬─────────────────────────────┘     │
│                                          │                                   │
│                                          ▼                                   │
│                      ┌─────────────────────────────────────────────────┐     │
│                      │              MIMPrediction                       │     │
│                      │             (schemas.py)                         │     │
│                      ├─────────────────────────────────────────────────┤     │
│                      │  • root_cause: MIMRootCause                     │     │
│                      │  • readiness: MIMReadiness                      │     │
│                      │  • performance_forecast: MIMPerformanceForecast │     │
│                      │  • similar_past_mistakes: List[str]             │     │
│                      │  • recommended_focus_areas: List[str]           │     │
│                      └─────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           MIM DATA FLOW                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUTS:                                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Submission  │ │   User      │ │  Problem    │ │    User     │           │
│  │   Context   │ │  History    │ │  Context    │ │   Memory    │           │
│  │ (current)   │ │ (MongoDB)   │ │ (repo)      │ │  (RAG)      │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│         └───────────────┴───────────────┴───────────────┘                   │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌──────────────────────────────┐                         │
│                    │     Feature Extraction       │                         │
│                    │        (< 100ms)             │                         │
│                    └──────────────┬───────────────┘                         │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌──────────────────────────────┐                         │
│                    │     60-dim Feature Vector    │                         │
│                    │   [f₀, f₁, ..., f₅₉]        │                         │
│                    └──────────────┬───────────────┘                         │
│                                   │                                         │
│         ┌─────────────────────────┼─────────────────────────┐               │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │ Root Cause  │          │  Readiness  │          │ Performance │         │
│  │ Prediction  │          │ Assessment  │          │  Forecast   │         │
│  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘         │
│         │                        │                        │                 │
│         └────────────────────────┼────────────────────────┘                 │
│                                  │                                          │
│                                  ▼                                          │
│                    ┌──────────────────────────────┐                         │
│                    │       MIMPrediction          │                         │
│                    │    (Pydantic Schema)         │                         │
│                    └──────────────┬───────────────┘                         │
│                                   │                                         │
│                                   ▼                                         │
│  OUTPUTS:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   "root_cause": {"failure_cause": "edge_case_handling",             │   │
│  │                  "confidence": 0.82, "alternatives": [...]},        │   │
│  │   "readiness": {"current_level": "Intermediate",                    │   │
│  │                 "easy_readiness": 0.95, "medium_readiness": 0.72,   │   │
│  │                 "hard_readiness": 0.35},                            │   │
│  │   "performance_forecast": {"expected_success_rate": 0.65,           │   │
│  │                            "learning_velocity": "improving"},       │   │
│  │   "similar_past_mistakes": ["Array bounds issue in BFS..."],        │   │
│  │   "recommended_focus_areas": ["edge cases", "boundary conditions"]  │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Engineering

### 3.1 60-Dimensional Feature Vector

MIM extracts a compact 60-dimensional feature vector from each submission. This is a deliberate reduction from the original plan's 120 dimensions to improve training efficiency and reduce overfitting.

### 3.2 Feature Groups

| Index Range | Group                 | Description                            |
| ----------- | --------------------- | -------------------------------------- |
| 0-14        | Submission Features   | Current submission characteristics     |
| 15-29       | Error Semantics       | Error type analysis and patterns       |
| 30-44       | Problem Metadata      | Problem characteristics and difficulty |
| 45-54       | Temporal Patterns     | Time-based behavioral signals          |
| 55-59       | Historical Aggregates | Long-term performance metrics          |

### 3.3 Detailed Feature Breakdown

#### Submission Features [0-14]

```python
# Code metrics
features[0] = code_length / 5000.0               # Normalized code length
features[1] = line_count / 200.0                 # Normalized line count
features[2] = function_count / 10.0              # Number of functions
features[3] = loop_depth / 5.0                   # Maximum loop nesting
features[4] = has_recursion                      # Binary: uses recursion
features[5] = has_iteration                      # Binary: uses loops

# Language encoding (one-hot)
features[6] = 1.0 if language == "python" else 0.0
features[7] = 1.0 if language == "cpp" else 0.0
features[8] = 1.0 if language == "java" else 0.0
features[9] = 1.0 if language == "javascript" else 0.0

# Verdict encoding
features[10] = 1.0 if verdict == "wrong_answer" else 0.0
features[11] = 1.0 if verdict == "time_limit_exceeded" else 0.0
features[12] = 1.0 if verdict == "runtime_error" else 0.0
features[13] = 1.0 if verdict == "compilation_error" else 0.0
features[14] = 1.0 if verdict == "memory_limit_exceeded" else 0.0
```

#### Error Semantics Features [15-29]

```python
# Error type encoding
features[15:20] = error_type_encoding        # One-hot error type
features[20] = has_array_index_error         # Common patterns
features[21] = has_null_reference
features[22] = has_infinite_loop_risk
features[23] = has_overflow_risk
features[24] = has_syntax_issue

# Code smell indicators
features[25] = hardcoded_values_count / 10.0
features[26] = magic_numbers_count / 5.0
features[27] = unused_variables_count / 5.0
features[28] = missing_edge_case_handlers
features[29] = code_complexity_score          # Cyclomatic complexity
```

#### Problem Metadata Features [30-44]

```python
# Difficulty encoding
features[30] = 1.0 if difficulty == "easy" else 0.0
features[31] = 1.0 if difficulty == "medium" else 0.0
features[32] = 1.0 if difficulty == "hard" else 0.0

# Category encoding (compressed via hashing)
features[33:38] = category_encoding           # 5-dim category hash

# Problem characteristics
features[38] = time_limit / 5.0               # Normalized time limit
features[39] = memory_limit / 512.0           # Normalized memory limit
features[40] = expected_complexity_score      # O(n), O(n²), etc.
features[41] = requires_data_structure        # Needs specific DS
features[42] = requires_algorithm             # Needs specific algo
features[43] = input_size_range               # Small/medium/large
features[44] = has_multiple_test_cases
```

#### Temporal Patterns Features [45-54]

```python
# Session behavior
features[45] = hour_of_day / 24.0            # When user is coding
features[46] = is_weekend                     # Weekend flag
features[47] = session_submission_count / 10.0  # Current session activity
features[48] = time_since_last_submission    # Gap since last attempt
features[49] = submission_velocity_1h        # Submissions per hour

# Learning patterns
features[50] = submission_velocity_24h       # Daily activity
features[51] = streak_length / 7.0           # Consecutive days
features[52] = days_since_first_submission   # Account age
features[53] = same_problem_attempts         # Retry count
features[54] = fatigue_indicator             # Declining performance
```

#### Historical Aggregates Features [55-59]

```python
features[55] = success_rate_7d               # Last week success
features[56] = success_rate_30d              # Last month success
features[57] = category_success_rate         # Success in this category
features[58] = difficulty_success_rate       # Success at this difficulty
features[59] = improvement_trend             # Getting better/worse
```

### 3.4 Cold Start Strategy

For users with fewer than 5 submissions, MIM uses **problem difficulty as a proxy**:

```python
def _handle_cold_start(self, problem_context: Dict) -> np.ndarray:
    """
    Cold start handling using problem difficulty.

    Logic:
    - Easy problems → assume high readiness
    - Medium problems → assume moderate readiness
    - Hard problems → assume low readiness
    """
    difficulty = problem_context.get("difficulty", "medium").lower()

    cold_features = np.zeros(60, dtype=np.float32)

    # Set difficulty features
    cold_features[30] = 1.0 if difficulty == "easy" else 0.0
    cold_features[31] = 1.0 if difficulty == "medium" else 0.0
    cold_features[32] = 1.0 if difficulty == "hard" else 0.0

    # Default historical features based on difficulty
    if difficulty == "easy":
        cold_features[55:60] = [0.7, 0.7, 0.7, 0.7, 0.0]  # Optimistic
    elif difficulty == "hard":
        cold_features[55:60] = [0.3, 0.3, 0.3, 0.3, 0.0]  # Conservative
    else:
        cold_features[55:60] = [0.5, 0.5, 0.5, 0.5, 0.0]  # Neutral

    return cold_features
```

---

## 4. Model Components

### 4.1 Model Architecture

MIM uses three specialized sklearn models, each optimized for its prediction task:

```python
class MIMModel:
    """
    MIM Model Architecture

    Three specialized models for different prediction tasks:
    1. Root Cause Classifier: CalibratedClassifierCV(RandomForest)
    2. Readiness Regressor: GradientBoostingClassifier
    3. Performance Predictor: LogisticRegression
    """
```

### 4.2 Root Cause Classifier

**Purpose:** Predict the primary reason for submission failure

**Architecture:**

- Base: `RandomForestClassifier(n_estimators=100, max_depth=10)`
- Wrapper: `CalibratedClassifierCV` for probability calibration
- Output: 15 root cause categories with confidence scores

**Root Cause Categories:**

| Category               | Description                      | Example                                       |
| ---------------------- | -------------------------------- | --------------------------------------------- |
| `algorithm_choice`     | Wrong algorithm selected         | Using O(n²) brute force instead of O(n log n) |
| `edge_case_handling`   | Missing edge cases               | Empty array, single element, negative numbers |
| `complexity_issue`     | Time/space complexity too high   | Correct approach but TLE                      |
| `implementation_bug`   | Logic errors in correct approach | Off-by-one in correct algorithm               |
| `input_parsing`        | Failed to parse input correctly  | Wrong input format handling                   |
| `off_by_one`           | Off-by-one errors                | Loop bounds, array indices                    |
| `overflow_underflow`   | Integer overflow/underflow       | Large number multiplication                   |
| `wrong_data_structure` | Inappropriate data structure     | List instead of set for lookups               |
| `misread_problem`      | Misunderstood problem statement  | Solving different problem                     |
| `partial_solution`     | Solution is incomplete           | Handles some but not all cases                |
| `syntax_error`         | Language syntax issues           | Compilation errors                            |
| `type_error`           | Type conversion/casting issues   | String vs int confusion                       |
| `initialization_error` | Wrong initial values             | Incorrect default values                      |
| `boundary_condition`   | Boundary handling errors         | Array bounds, number ranges                   |
| `unknown`              | Cannot determine from context    | Ambiguous failure                             |

### 4.3 Readiness Regressor

**Purpose:** Assess user's readiness for different difficulty levels

**Architecture:**

- Model: `GradientBoostingClassifier(n_estimators=50, max_depth=5)`
- Output: Success probability used to derive readiness levels

**Readiness Calculation:**

```python
def predict_readiness(self, features: np.ndarray, ...) -> MIMReadiness:
    """
    Calculate readiness for each difficulty level.

    Easy readiness = base_prob * 1.2 (capped at 1.0)
    Medium readiness = base_prob
    Hard readiness = base_prob * 0.7
    """
    base_prob = self.readiness_model.predict_proba(features)[0][1]

    return MIMReadiness(
        current_level=self._determine_level(base_prob),
        easy_readiness=min(base_prob * 1.2, 1.0),
        medium_readiness=base_prob,
        hard_readiness=base_prob * 0.7,
        confidence=0.7 if self.is_trained else 0.3
    )
```

### 4.4 Performance Predictor

**Purpose:** Forecast future performance trends

**Architecture:**

- Model: `LogisticRegression(max_iter=1000)`
- Output: Expected success rate and learning velocity

**Learning Velocity Categories:**

- `improving`: Success rate trending upward
- `stable`: Consistent performance
- `declining`: Success rate trending downward
- `volatile`: Inconsistent performance

---

## 5. Training Pipeline

### 5.1 Training Modes

MIM supports three training modes:

| Mode        | Data Source       | Quality | Use Case                   |
| ----------- | ----------------- | ------- | -------------------------- |
| `synthetic` | Generated data    | Low     | Initial bootstrap, testing |
| `mongodb`   | Raw submissions   | Medium  | Semi-supervised learning   |
| `manual`    | Hand-labeled data | High    | Production quality         |

### 5.2 Training from MongoDB (Semi-Supervised)

```python
def train_from_mongodb(max_samples: int = 5000) -> Dict[str, Any]:
    """
    Train from MongoDB submissions using heuristic labeling.

    Heuristics:
    - TLE → "complexity_issue"
    - Runtime Error → "implementation_bug"
    - Wrong Answer with patterns → specific causes
    """
```

**Heuristic Labeling Rules:**

```python
def _heuristic_label(submission: Dict) -> Tuple[str, float]:
    verdict = submission.get("status", "")
    code = submission.get("code", "")

    if verdict == "time_limit_exceeded":
        return ("complexity_issue", 0.8)

    if verdict == "compilation_error":
        return ("syntax_error", 0.95)

    if verdict == "runtime_error":
        if "index" in str(submission.get("error", "")).lower():
            return ("off_by_one", 0.7)
        return ("implementation_bug", 0.6)

    if verdict == "wrong_answer":
        # Analyze code for patterns
        if not _has_edge_case_checks(code):
            return ("edge_case_handling", 0.7)
        if _has_nested_loops(code):
            return ("complexity_issue", 0.5)
        return ("implementation_bug", 0.5)

    return ("unknown", 0.3)
```

### 5.3 Training from Manual Labels (Recommended)

```python
def train_from_manual_labels(labels_file: str) -> Dict[str, Any]:
    """
    Train from manually labeled submissions.

    Expected JSON format:
    {
        "labels": [
            {
                "submission_id": "abc123",
                "root_cause": "edge_case_handling",
                "confidence": 0.9,
                "readiness": "intermediate"
            },
            ...
        ]
    }
    """
```

**Target:** 500 manually labeled submissions for high-quality training.

### 5.4 Training with Synthetic Data

```python
def train_with_synthetic_data(num_samples: int = 1000) -> Dict[str, Any]:
    """
    Generate synthetic training data for initial bootstrap.

    Useful for:
    - Testing the pipeline
    - Initial model bootstrap
    - Development/staging environments
    """
```

### 5.5 Training CLI

```bash
# Train with synthetic data (quick start)
python -m app.mim.training --mode synthetic --samples 1000

# Train from MongoDB (semi-supervised)
python -m app.mim.training --mode mongodb --samples 5000

# Train from manual labels (best quality)
python -m app.mim.training --mode manual --labels data/mim_labels/manual_labels.json

# Specify output directory
python -m app.mim.training --mode synthetic --output models/mim/
```

### 5.6 Model Persistence

Models are saved using joblib:

```
ai-services/models/mim/
├── mim_model.joblib          # Complete MIMModel instance
├── scaler.joblib             # StandardScaler
├── label_encoder.joblib      # LabelEncoder for root causes
├── root_cause_model.joblib   # RandomForest classifier
├── readiness_model.joblib    # GradientBoosting classifier
├── performance_model.joblib  # LogisticRegression
└── training_metrics.json     # Training metrics and metadata
```

---

## 6. Inference System

### 6.1 MIMInference Singleton

```python
class MIMInference:
    """
    MIM Inference Service (Singleton Pattern)

    Features:
    - Single instance across application
    - Lazy model loading
    - Graceful degradation
    - Caching support (future)
    """

    _instance: Optional['MIMInference'] = None

    @classmethod
    def get_instance(cls) -> 'MIMInference':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
```

### 6.2 Prediction Method

```python
async def predict(
    self,
    submission: Dict[str, Any],
    user_history: List[Dict[str, Any]],
    problem_context: Optional[Dict[str, Any]] = None,
    user_memory: Optional[List[str]] = None,
) -> MIMPrediction:
    """
    Generate MIM predictions for a submission.

    Args:
        submission: Current submission data
        user_history: List of user's past submissions
        problem_context: Problem metadata from repository
        user_memory: RAG-retrieved memory chunks

    Returns:
        MIMPrediction with all prediction components
    """
```

### 6.3 Graceful Degradation

MIM never crashes the main workflow. On any failure:

```python
def _fallback_prediction(self, reason: str) -> MIMPrediction:
    """Return safe fallback prediction on any failure."""
    return MIMPrediction(
        root_cause=MIMRootCause(
            failure_cause="unknown",
            confidence=0.0,
            alternatives=[],
        ),
        readiness=MIMReadiness(
            current_level="Unknown",
            easy_readiness=0.5,
            medium_readiness=0.5,
            hard_readiness=0.5,
            confidence=0.0,
        ),
        performance_forecast=MIMPerformanceForecast(
            expected_success_rate=0.5,
            improvement_probability=0.5,
            predicted_struggles=[],
            learning_velocity="unknown",
        ),
        similar_past_mistakes=[],
        recommended_focus_areas=[],
        is_cold_start=True,
        model_version="fallback",
        inference_time_ms=0,
    )
```

### 6.4 Similar Mistake Detection

```python
def _find_similar_mistakes(
    self,
    submission: Dict,
    user_history: List[Dict],
    user_memory: Optional[List[str]]
) -> List[str]:
    """
    Find similar past mistakes from user's history.

    Matching criteria:
    1. Same verdict type
    2. Same problem category
    3. Similar code patterns
    """
```

---

## 7. Workflow Integration

### 7.1 Sync Workflow Integration

MIM is integrated into the sync workflow as an early-stage node:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SYNC WORKFLOW WITH MIM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START                                                                       │
│    │                                                                         │
│    ▼                                                                         │
│  ┌─────────────┐                                                             │
│  │ Validate    │                                                             │
│  │   Input     │                                                             │
│  └──────┬──────┘                                                             │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                  │
│  │  Retrieve   │─────▶│ MIM         │─────▶│ Retrieve    │                  │
│  │  Problem    │      │ Prediction  │      │ Memory      │                  │
│  └─────────────┘      │ (NEW!)      │      └─────────────┘                  │
│                       └─────────────┘                                        │
│                              │                                               │
│                              ▼                                               │
│                       ┌─────────────┐                                        │
│                       │ Build User  │                                        │
│                       │  Profile    │                                        │
│                       └──────┬──────┘                                        │
│                              │                                               │
│                              ▼                                               │
│                       ┌─────────────┐                                        │
│                       │ Build       │◀──── MIM insights added to context     │
│                       │ Context     │                                        │
│                       └──────┬──────┘                                        │
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                          │
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                  │
│  │  Feedback   │      │    Hint     │      │  Pattern    │                  │
│  │   Agent     │      │   Agent     │      │   Agent     │                  │
│  └─────────────┘      └─────────────┘      └─────────────┘                  │
│                                                                              │
│  All agents receive MIM insights in their context!                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 MIM Prediction Node

```python
def mim_prediction_node(state: MentatSyncState) -> MentatSyncState:
    """
    MIM Prediction Node - Generate ML predictions early in pipeline.

    Position: After retrieve_problem, before build_user_profile
    Time Budget: 5 seconds

    Stores predictions in state["mim_insights"] for use by:
    - build_context_node (formats for agent prompts)
    - All downstream agents (via context)
    """
    _log_budget_status(state, "mim_prediction")
    start = time.time()

    try:
        mim = MIMInference.get_instance()

        # Prepare submission data
        submission_data = {
            "user_id": state["user_id"],
            "problem_id": state["problem_id"],
            "code": state["code"],
            "language": state["language"],
            "verdict": state["verdict"],
            "error_type": state.get("error_type"),
            "problem_category": state.get("problem_category"),
        }

        # Get user history from MongoDB
        user_history = []
        if mongo_client.db is not None:
            user_history = mongo_client.get_user_submissions(
                user_id=state["user_id"],
                limit=50
            )

        # Run prediction (sync wrapper for async)
        prediction = asyncio.run(mim.predict(
            submission=submission_data,
            user_history=user_history,
            problem_context=state.get("problem"),
            user_memory=state.get("user_memory"),
        ))

        # Store in state as dict for JSON serialization
        state["mim_insights"] = prediction.to_dict()

        elapsed = time.time() - start
        state["_node_timings"]["mim_prediction"] = elapsed

        logger.info(f"✅ MIM prediction | root_cause={prediction.root_cause.failure_cause} "
                   f"| confidence={prediction.root_cause.confidence:.2f} | {elapsed:.2f}s")

    except Exception as e:
        logger.warning(f"⚠️ MIM prediction failed (graceful degradation): {e}")
        state["mim_insights"] = None
        state["_node_timings"]["mim_prediction"] = time.time() - start

    return state
```

### 7.3 Time Budget Allocation

```python
# Updated time budgets with MIM
AGENT_TIME_BUDGETS = {
    "validate_input": 1.0,
    "retrieve_problem": 3.0,
    "mim_prediction": 5.0,      # ✨ NEW: MIM prediction budget
    "retrieve_memory": 3.0,
    "build_user_profile": 2.0,
    "build_context": 2.0,
    "feedback": 20.0,
    "hint": 10.0,
    "pattern": 10.0,
    "aggregate_final": 2.0,
}

# Total budget increased from 60s to 65s
SYNC_TOTAL_BUDGET_SECONDS = 65.0
```

---

## 8. Agent Prompt Integration

### 8.1 Context Builder Integration

MIM predictions are formatted and injected into the agent context:

```python
def format_mim_section(mim_insights: Optional[Dict[str, Any]]) -> str:
    """Format MIM predictions for agent prompts."""
    if not mim_insights:
        return ""

    return f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🧠 MIM INTELLIGENCE INSIGHTS (Confidence: {confidence_level})              ║
╚══════════════════════════════════════════════════════════════════════════════╝

PREDICTED ROOT CAUSE: {root_cause}
   Confidence: {confidence:.0%}

USER READINESS:
   Current Level: {current_level}
   Easy: {easy:.0%} | Medium: {medium:.0%} | Hard: {hard:.0%}

PERFORMANCE FORECAST:
   Expected Success (next 5): {success_rate:.0%}
   Learning Velocity: {velocity}

SIMILAR PAST MISTAKES:
   • {mistake_1}
   • {mistake_2}

RECOMMENDED FOCUS AREAS:
   • {focus_1}
   • {focus_2}

═══════════════════════════════════════════════════════════════════════════════
MIM USAGE INSTRUCTIONS:
- If confidence >= 70%: Structure feedback around predicted root cause
- If confidence 50-70%: Consider MIM prediction as strong hypothesis
- If confidence < 50%: Use as supplementary signal, investigate independently
- ALWAYS mention if your analysis agrees/disagrees with MIM prediction
═══════════════════════════════════════════════════════════════════════════════
"""
```

### 8.2 Agent Instructions

Agents receive explicit instructions on how to use MIM predictions:

```
DATA QUALITY FLAGS:
- Problem grounded: ✓ YES
- User history available: ✓ YES
- MIM predictions available: ✓ YES

MANDATORY ANALYSIS STEPS:
1. Compare user's approach with EXPECTED APPROACH
2. Check if user repeats RECURRING MISTAKES from profile
3. Use MIM root cause prediction as starting hypothesis (confidence shown above)
4. Reference specific problem CONSTRAINTS when relevant
5. Focus on THIS submission, not generic advice

OUTPUT REQUIREMENTS:
- Be specific to THIS problem
- Reference problem constraints
- If user repeats a known mistake, explicitly mention it
- State whether you agree/disagree with MIM's predicted root cause
- Do NOT provide full solutions or corrected code
```

### 8.3 Example Agent Context with MIM

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 1: PROBLEM DEFINITION                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
Problem: Two Sum
Difficulty: Easy
Category: Arrays, Hash Tables
...

╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 2: USER PROFILE & HISTORY                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
Skill Level: Intermediate
Success Rate: 65%
Common Mistakes: edge_case_handling, off_by_one
...

╔══════════════════════════════════════════════════════════════════════════════╗
║  🧠 MIM INTELLIGENCE INSIGHTS (Confidence: HIGH)                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

PREDICTED ROOT CAUSE: wrong_data_structure
   Confidence: 78%

USER READINESS:
   Current Level: Intermediate
   Easy: 92% | Medium: 68% | Hard: 35%

PERFORMANCE FORECAST:
   Expected Success (next 5): 62%
   Learning Velocity: improving

SIMILAR PAST MISTAKES:
   • Used nested loops instead of hash map in "Contains Duplicate"
   • O(n²) approach in "Valid Anagram" last week

RECOMMENDED FOCUS AREAS:
   • Hash table for O(1) lookups
   • Time complexity optimization

═══════════════════════════════════════════════════════════════════════════════

╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 3: CURRENT SUBMISSION                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
Language: Python
Verdict: Time Limit Exceeded
...
```

---

## 9. Labeling Utility

### 9.1 Overview

The labeling utility (`scripts/mim_labeler.py`) helps create the 500 manual labels needed for high-quality training.

### 9.2 Usage Modes

#### Interactive Mode (Recommended)

```bash
python scripts/mim_labeler.py --mode interactive --count 20
```

Interactive session with:

- Submission display with code
- Root cause selection (1-15)
- Confidence input (0.0-1.0)
- Readiness level selection
- Auto-save every 5 labels

#### Export Mode (Batch Labeling)

```bash
python scripts/mim_labeler.py --mode export --output batch.json --count 50
```

Exports submissions to JSON for labeling in spreadsheet tools.

#### Import Mode

```bash
python scripts/mim_labeler.py --mode import --input labeled_batch.json
```

Imports completed labels from batch file.

#### Statistics Mode

```bash
python scripts/mim_labeler.py --mode stats
```

Shows labeling progress and distribution statistics.

### 9.3 Label File Format

```json
{
  "labels": [
    {
      "submission_id": "abc123",
      "user_id": "user_42",
      "problem_id": "two_sum",
      "verdict": "wrong_answer",
      "language": "python",
      "root_cause": "edge_case_handling",
      "confidence": 0.85,
      "readiness": "intermediate",
      "notes": "Missing empty array check",
      "labeled_at": "2026-01-24T10:30:00"
    }
  ],
  "metadata": {
    "created_at": "2026-01-24T09:00:00",
    "updated_at": "2026-01-24T10:30:00",
    "total_labels": 1
  }
}
```

### 9.4 Labeling Guidelines

1. **Focus on PRIMARY cause** - Each submission has one main root cause
2. **Be honest with confidence** - Use lower confidence when uncertain
3. **Skip ambiguous cases** - Better to skip than mislabel
4. **Consider context** - Look at the problem, not just the code
5. **Track patterns** - Note if user repeats similar mistakes

---

## 10. API Reference

### 10.1 MIMPrediction Schema

```python
class MIMPrediction(BaseModel):
    """Complete MIM prediction output."""

    root_cause: MIMRootCause
    readiness: MIMReadiness
    performance_forecast: MIMPerformanceForecast
    cognitive_profile: Optional[MIMCognitiveProfile]
    similar_past_mistakes: List[str]
    recommended_focus_areas: List[str]
    is_cold_start: bool
    model_version: str
    inference_time_ms: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""

    def to_agent_context(self) -> str:
        """Format as string for agent prompts."""
```

### 10.2 MIMRootCause Schema

```python
class MIMRootCause(BaseModel):
    """Root cause prediction with confidence."""

    failure_cause: str  # One of 15 categories
    confidence: float   # 0.0 to 1.0
    alternatives: List[Dict[str, float]]  # Other possible causes
```

### 10.3 MIMReadiness Schema

```python
class MIMReadiness(BaseModel):
    """User readiness assessment."""

    current_level: str  # "Beginner", "Intermediate", "Advanced"
    easy_readiness: float
    medium_readiness: float
    hard_readiness: float
    confidence: float
```

### 10.4 MIMPerformanceForecast Schema

```python
class MIMPerformanceForecast(BaseModel):
    """Future performance prediction."""

    expected_success_rate: float
    improvement_probability: float
    predicted_struggles: List[str]
    learning_velocity: str  # "improving", "stable", "declining", "volatile"
```

### 10.5 MIMInference Methods

```python
class MIMInference:
    @classmethod
    def get_instance(cls) -> 'MIMInference':
        """Get singleton instance."""

    async def predict(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]],
        problem_context: Optional[Dict[str, Any]] = None,
        user_memory: Optional[List[str]] = None,
    ) -> MIMPrediction:
        """Generate predictions for a submission."""

    def load_models(self, model_dir: str = "models/mim/") -> bool:
        """Load trained models from disk."""
```

---

## 11. Configuration

### 11.1 Environment Variables

```bash
# Model directory
MIM_MODEL_DIR=models/mim/

# Feature extraction settings
MIM_COLD_START_THRESHOLD=5  # Submissions before full features

# Inference settings
MIM_INFERENCE_TIMEOUT=5.0   # Max seconds for prediction
MIM_ENABLE_CACHE=true       # Cache predictions (future)

# Training settings
MIM_TRAINING_SAMPLES=5000   # Max samples for training
MIM_VALIDATION_SPLIT=0.2    # Validation set ratio
```

### 11.2 Model Hyperparameters

```python
# Root Cause Classifier
ROOT_CAUSE_PARAMS = {
    "n_estimators": 100,
    "max_depth": 10,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "class_weight": "balanced",
}

# Readiness Regressor
READINESS_PARAMS = {
    "n_estimators": 50,
    "max_depth": 5,
    "learning_rate": 0.1,
}

# Performance Predictor
PERFORMANCE_PARAMS = {
    "max_iter": 1000,
    "class_weight": "balanced",
}
```

---

## 12. Troubleshooting

### 12.1 Common Issues

#### Models Not Loading

```
⚠️ MIM models not found in models/mim/
```

**Solution:** Train models first:

```bash
python -m app.mim.training --mode synthetic --samples 1000
```

#### Cold Start for All Users

```
🔵 MIM cold start: user has < 5 submissions
```

**Solution:** This is expected for new users. Predictions will improve as users submit more.

#### Low Confidence Predictions

```
MIM prediction | root_cause=unknown | confidence=0.32
```

**Solution:**

1. Train with more labeled data
2. Check if submission has unusual characteristics
3. Review feature extraction for edge cases

#### Inference Timeout

```
⚠️ MIM prediction timed out after 5.0s
```

**Solution:**

1. Check model size (reduce n_estimators if needed)
2. Verify feature extraction performance
3. Consider async prediction caching

### 12.2 Debugging

Enable debug logging:

```python
import logging
logging.getLogger("app.mim").setLevel(logging.DEBUG)
```

Inspect feature vectors:

```python
from app.mim.feature_extractor import MIMFeatureExtractor

extractor = MIMFeatureExtractor()
features = extractor.extract(submission, user_history, problem_context, user_memory)
print(f"Feature vector shape: {features.shape}")
print(f"Non-zero features: {(features != 0).sum()}")
```

### 12.3 Performance Monitoring

Track MIM metrics:

```python
# In inference.py
logger.info(
    f"MIM metrics | "
    f"inference_ms={prediction.inference_time_ms:.1f} | "
    f"confidence={prediction.root_cause.confidence:.2f} | "
    f"cold_start={prediction.is_cold_start}"
)
```

---

## 13. Problem Recommender (V2.0) 🆕

### 13.1 Overview

The **MIM Problem Recommender** uses Learning-to-Rank (LTR) to suggest personalized next problems based on:

- User's current skill level
- Weak topics that need practice
- Optimal learning zone (50-70% success probability)
- Problem quality and popularity

### 13.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROBLEM RECOMMENDATION PIPELINE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │ User Profile │────▶│ Feature Extract │────▶│  13-dim Vector      │   │
│  │ + Candidate  │     │ (per problem)   │     │  [user, problem,    │   │
│  │   Problems   │     │                 │     │   match features]   │   │
│  └──────────────┘     └─────────────────┘     └──────────┬──────────┘   │
│                                                          │              │
│                      ┌───────────────────────────────────┘              │
│                      │                                                  │
│                      ▼                                                  │
│       ┌─────────────────────────────────────┐                          │
│       │         Ranking Models              │                          │
│       ├─────────────────────────────────────┤                          │
│       │  ┌─────────────────────────────┐    │                          │
│       │  │ LightGBM LambdaRank         │────┼───▶ Problem Scores       │
│       │  │ (primary, if available)     │    │                          │
│       │  └─────────────────────────────┘    │                          │
│       │  ┌─────────────────────────────┐    │                          │
│       │  │ GradientBoosting Classifier │────┼───▶ Success Probability  │
│       │  │ (fallback & probability)    │    │                          │
│       │  └─────────────────────────────┘    │                          │
│       └─────────────────────────────────────┘                          │
│                      │                                                  │
│                      ▼                                                  │
│       ┌─────────────────────────────────────┐                          │
│       │    Combined Scoring                 │                          │
│       │  score = 0.4 × learning_optimal +   │                          │
│       │          0.4 × relevance +          │                          │
│       │          0.2 × success_prob         │                          │
│       └─────────────────────────────────────┘                          │
│                      │                                                  │
│                      ▼                                                  │
│       ┌─────────────────────────────────────┐                          │
│       │   MIMRecommendations                │                          │
│       │   (top-K ranked problems)           │                          │
│       └─────────────────────────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.3 Feature Vector (13 dimensions)

| Index | Feature Name           | Description                      |
| ----- | ---------------------- | -------------------------------- |
| 0     | `user_skill_level`     | 0-7 scale (Beginner to Expert)   |
| 1     | `user_success_rate`    | Overall success rate (0-1)       |
| 2     | `user_topic_success`   | Success rate on problem's topics |
| 3     | `days_since_topic`     | Days since last topic attempt    |
| 4     | `user_streak`          | Current success streak           |
| 5     | `user_velocity`        | Learning velocity score          |
| 6     | `problem_difficulty`   | 0-2 (Easy/Medium/Hard)           |
| 7     | `problem_popularity`   | Normalized attempt count         |
| 8     | `problem_ac_rate`      | Problem acceptance rate          |
| 9     | `problem_avg_attempts` | Average attempts to solve        |
| 10    | `skill_difficulty_gap` | User skill - problem difficulty  |
| 11    | `topic_weakness_score` | How weak user is on topic        |
| 12    | `recency_bonus`        | Bonus for recently failed topics |

### 13.4 Usage

```python
from app.mim.recommender import MIMRecommender

recommender = MIMRecommender()

# Get recommendations
recommendations = recommender.recommend(
    user_profile={
        "user_id": "user_001",
        "current_level": "Medium",
        "weak_topics": ["dp", "graphs"],
        "success_rate": 0.6,
    },
    candidate_problems=problems_list,
    user_history=submission_history,
    top_k=5
)

# Result: MIMRecommendations object
for rec in recommendations.recommendations:
    print(f"#{rec.rank}: {rec.title} ({rec.difficulty})")
    print(f"   Success Probability: {rec.success_probability:.0%}")
    print(f"   Relevance: {rec.relevance_score:.2f}")
```

### 13.5 Cold Start Handling

For users with limited history, the recommender uses rule-based fallbacks:

1. Match target difficulty to user's current level
2. Prioritize problems matching weak topics
3. Apply diversity to avoid topic clustering
4. Use problem popularity as quality signal

---

## 14. Evaluation Pipeline (V2.0) 🆕

### 14.1 Overview

The **MIM Evaluator** provides comprehensive model evaluation with a focus on preventing **user leakage** - ensuring users in training data never appear in validation/test sets.

### 14.2 User-Aware Splits

Traditional random splits can leak user patterns:

```
❌ WRONG (Random Split):
   User A: [submission_1, submission_2] → Train
   User A: [submission_3] → Test
   Result: Model sees User A's patterns in training, unfairly inflates test scores

✅ CORRECT (User-Aware Split):
   User A: [submission_1, submission_2, submission_3] → All in Train OR Test
   Result: True generalization to unseen users
```

### 14.3 Metrics

#### Classification Metrics (Root Cause)

| Metric             | Description                  |
| ------------------ | ---------------------------- |
| `accuracy`         | Overall correct predictions  |
| `f1_macro`         | Unweighted F1 across classes |
| `f1_weighted`      | Weighted by class frequency  |
| `roc_auc`          | Area under ROC curve         |
| `confusion_matrix` | Per-class confusion          |

#### Ranking Metrics (Recommendations)

| Metric           | Description                           |
| ---------------- | ------------------------------------- |
| `precision_at_k` | Relevant items in top-K               |
| `ndcg_at_k`      | Normalized discounted cumulative gain |
| `mrr`            | Mean reciprocal rank                  |

### 14.4 Usage

```python
from app.mim.evaluation import MIMEvaluator

evaluator = MIMEvaluator()

# User-aware split
train, val, test = evaluator.user_aware_split(
    data=training_data,
    train_ratio=0.7,
    val_ratio=0.15,
    test_ratio=0.15
)

# Evaluate root cause classifier
metrics = evaluator.evaluate_root_cause(
    y_true=y_true,
    y_pred=y_pred,
    y_proba=y_proba
)

# Evaluate recommendations
rec_metrics = evaluator.evaluate_recommendations(
    recommendations=rec_results,
    k_values=[1, 3, 5, 10]
)

# Full report
report = evaluator.generate_full_report(model, test_data)
evaluator.print_summary(report)
```

---

## 15. API Reference (V2.0 Endpoints) 🆕

### 15.1 MIM Endpoints

| Endpoint                                 | Method | Description               |
| ---------------------------------------- | ------ | ------------------------- |
| `/ai/mim/status`                         | GET    | Model status and health   |
| `/ai/mim/profile/{user_id}`              | GET    | User cognitive profile    |
| `/ai/mim/recommend/{user_id}`            | GET    | Problem recommendations   |
| `/ai/mim/train`                          | POST   | Trigger model training    |
| `/ai/mim/predict/{user_id}/{problem_id}` | GET    | Pre-submission prediction |

### 15.2 Endpoint Details

#### GET /ai/mim/status

Returns MIM model status and health information.

**Response:**

```json
{
  "is_trained": true,
  "model_version": "v1.0",
  "model_health": "healthy",
  "components": {
    "root_cause_classifier": true,
    "readiness_predictor": true,
    "recommender": true,
    "feature_extractor": true
  },
  "metrics": {
    "accuracy": 0.85,
    "f1_macro": 0.78
  },
  "training_samples": 1000,
  "training_date": "2026-01-24T10:30:00Z"
}
```

#### GET /ai/mim/profile/{user_id}

Returns cognitive profile for a user.

**Parameters:**

- `user_id` (path): User identifier
- `include_history` (query, optional): Include submission history
- `history_limit` (query, optional): Limit history entries (default: 20)

**Response:**

```json
{
  "user_id": "user_001",
  "status": "success",
  "profile": {
    "current_level": "Medium",
    "strengths": ["arrays", "strings"],
    "weak_topics": ["dp", "graphs"],
    "common_mistake_types": ["boundary_condition_blindness"],
    "success_rate": 0.65,
    "learning_velocity": "stable",
    "improvement_trend": "improving"
  }
}
```

#### GET /ai/mim/recommend/{user_id}

Returns personalized problem recommendations.

**Parameters:**

- `user_id` (path): User identifier
- `num_recommendations` (query, optional): Number of recommendations (default: 5)
- `difficulty_filter` (query, optional): Filter by difficulty

**Response:**

```json
{
  "user_id": "user_001",
  "status": "success",
  "is_ml_based": true,
  "recommendations": [
    {
      "rank": 1,
      "problem_id": "prob_123",
      "title": "Longest Increasing Subsequence",
      "difficulty": "Medium",
      "tags": ["dp", "binary-search"],
      "success_probability": 0.62,
      "relevance_score": 0.85,
      "reasoning": "Targets weak area (dp) at optimal difficulty"
    }
  ],
  "focus_topics": ["dp", "graphs"],
  "avoid_topics": ["arrays"]
}
```

#### POST /ai/mim/train

Triggers MIM model training (background task).

**Request Body:**

```json
{
  "min_samples": 100,
  "force_retrain": false
}
```

**Response:**

```json
{
  "status": "training_started",
  "message": "MIM model training has been scheduled",
  "training_examples": 1500
}
```

---

## 16. Root Cause Categories (V2.0) 🆕

### 16.1 Expanded Categories

MIM V2.0 expands root cause classification from 9 to **15 categories**:

| Category                       | Description                        | Example                                           |
| ------------------------------ | ---------------------------------- | ------------------------------------------------- |
| `boundary_condition_blindness` | Edge cases, empty inputs, n=1      | Missing empty array check                         |
| `off_by_one_error`             | Loop bounds, array indexing        | `for i in range(len(arr))` vs `range(len(arr)-1)` |
| `integer_overflow`             | Large inputs causing overflow      | Int32 overflow in factorial                       |
| `wrong_data_structure`         | Suboptimal DS choice               | Array instead of hashmap for lookups              |
| `logic_error`                  | Incorrect algorithm logic          | Wrong condition in if statement                   |
| `time_complexity_issue`        | Inefficient approach causing TLE   | O(n²) when O(n log n) needed                      |
| `recursion_issue`              | Stack overflow, missing base case  | Infinite recursion                                |
| `comparison_error`             | Wrong operators, floating point    | Using `==` for floats                             |
| `algorithm_choice` 🆕          | Wrong algorithm selected entirely  | BFS when DFS needed                               |
| `edge_case_handling` 🆕        | Specific edge case handling issues | Not handling single element                       |
| `input_parsing` 🆕             | Failed to parse input correctly    | Wrong string splitting                            |
| `misread_problem` 🆕           | Misunderstood problem statement    | Solved wrong problem                              |
| `partial_solution` 🆕          | Solution is incomplete             | Missing required output                           |
| `type_error` 🆕                | Type conversion/casting issues     | String to int conversion                          |
| `unknown`                      | Could not classify with confidence | Insufficient signal                               |

---

## 17. Version History 🆕

### V2.0.0 (January 24, 2026) - ML Enhancement Release

**New Components:**

- ✅ `recommender.py` - LightGBM-based problem recommendation engine
- ✅ `evaluation.py` - Evaluation pipeline with user-aware splits
- ✅ `test_mim.py` - 85+ unit tests

**Schema Additions:**

- ✅ `ROOT_CAUSE_CATEGORIES` constant (15 categories)
- ✅ `MIMDifficultyAdjustment` - Difficulty calibration recommendations
- ✅ `MIMProblemRecommendation` - Single problem recommendation
- ✅ `MIMRecommendations` - Full recommendation response
- ✅ `MIMModelMetrics` - Training/evaluation metrics
- ✅ `MIMStatus` - System health status

**API Endpoints:**

- ✅ `GET /ai/mim/status` - Model status
- ✅ `GET /ai/mim/profile/{user_id}` - User profile
- ✅ `GET /ai/mim/recommend/{user_id}` - Recommendations
- ✅ `POST /ai/mim/train` - Training trigger
- ✅ `GET /ai/mim/predict/{user_id}/{problem_id}` - Pre-submission prediction

**Improvements:**

- Expanded root cause categories: 9 → 15
- User-aware data splits (no leakage)
- LightGBM ranker for recommendations
- Comprehensive evaluation metrics (ROC-AUC, Precision@K, NDCG@K, MRR)

### V1.0.0 (January 2026) - Initial Release

- Core feature extraction (60 dimensions)
- Root cause classifier (RandomForest + calibration)
- Readiness predictor (GradientBoosting)
- Performance forecaster (LogisticRegression)
- Workflow integration
- Agent prompt formatting

---

## Appendix A: File Locations

| File           | Path                           | Purpose                 |
| -------------- | ------------------------------ | ----------------------- |
| Module init    | `app/mim/__init__.py`          | Exports                 |
| Schemas        | `app/mim/schemas.py`           | Data models             |
| Features       | `app/mim/feature_extractor.py` | 60-dim extraction       |
| Models         | `app/mim/model.py`             | sklearn models          |
| Inference      | `app/mim/inference.py`         | Prediction service      |
| Training       | `app/mim/training.py`          | Training pipeline       |
| Recommender 🆕 | `app/mim/recommender.py`       | Problem recommendations |
| Evaluation 🆕  | `app/mim/evaluation.py`        | Model evaluation        |
| Tests 🆕       | `tests/test_mim.py`            | Unit tests              |
| Workflow       | `app/graph/sync_workflow.py`   | Integration             |
| Context        | `app/rag/context_builder.py`   | Prompt formatting       |

## Appendix B: Future Enhancements

1. ~~**Problem Recommendation**: Personalized next-problem suggestions~~ ✅ V2.0
2. ~~**Expanded Root Causes**: More granular failure categories~~ ✅ V2.0
3. ~~**Evaluation Pipeline**: User-aware splits and metrics~~ ✅ V2.0
4. **Online Learning**: Update models incrementally with new submissions
5. **Prediction Caching**: Redis cache for repeated predictions
6. **A/B Testing**: Compare MIM-guided vs standard feedback
7. **Explainability**: SHAP values for feature importance
8. **Multi-task Learning**: Single model for all predictions
9. **Neural Embeddings**: Code2Vec for better code representation

---

_MIM Documentation v1.0.0 - Arrakis Labs_
