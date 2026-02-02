# MIM Experiment Harness

A lightweight experimentation tool for observing MIM (Mentat Intelligence Model) behavior with custom inputs.

> ⚠️ **IMPORTANT**: This harness does NOT modify MIM behavior. It only provides observability into real MIM decision-making.

## Purpose

This harness allows engineers to:

1. **Provide custom inputs** to MIM and observe outputs
2. **Test edge cases** without affecting production data
3. **Debug MIM decisions** by inspecting intermediate outputs
4. **Validate behavior** across different learner profiles

## Files

```
app/mim/experiments/
├── run_mim_experiments.py    # Main experiment runner
├── mim_test_inputs.json      # Test case definitions
└── README.md                 # This file
```

## Quick Start

```bash
# Navigate to ai-services directory
cd ai-services

# Run all experiments
python -m app.mim.experiments.run_mim_experiments

# Run a specific case
python -m app.mim.experiments.run_mim_experiments --case beginner_struggling

# Show intermediate outputs (verbose mode)
python -m app.mim.experiments.run_mim_experiments --verbose

# Output as JSON
python -m app.mim.experiments.run_mim_experiments --json

# List available cases
python -m app.mim.experiments.run_mim_experiments --list
```

## Input Structure

Each test case in `mim_test_inputs.json` follows this structure:

```json
{
  "case_name": {
    "description": "Human-readable description of the scenario",

    "submission": {
      "user_id": "unique_user_identifier",
      "problem_id": "problem_identifier",
      "submission_id": "submission_identifier",
      "code": "// The actual code submitted",
      "verdict": "wrong_answer|time_limit_exceeded|runtime_error|accepted"
    },

    "problem_context": {
      "category": "arrays|dp|graph|trees|binary_search|...",
      "difficulty": "easy|medium|hard",
      "expected_complexity": "O(n)|O(n log n)|O(n^2)|...",
      "constraints": { "n": 10000, "...": "..." },
      "problem_tags": ["tag1", "tag2"]
    },

    "user_state": {
      "dominant_failure_modes": ["subtype1", "subtype2"],
      "dominant_root_causes": ["correctness", "efficiency", "..."],
      "improving_areas": ["category1"],
      "stagnant_areas": ["category2"],
      "regressing_areas": ["category3"],
      "strong_categories": ["category4"],
      "strong_techniques": ["technique1"],
      "recent_transitions": {
        "brute_force_to_optimized": false,
        "optimized_to_brute_force": false,
        "new_category_attempted": false
      },
      "total_failed": 10,
      "total_accepted": 20,
      "history_span_days": 30
    },

    "delta_features": {
      "delta_attempts_same_category": 1.0,
      "delta_root_cause_repeat_rate": 0.3,
      "delta_complexity_mismatch": 0.0,
      "delta_time_to_accept": 0.0,
      "delta_optimization_transition": 0.0,
      "is_cold_start": 0.0
    }
  }
}
```

## How Inputs Map to MIM Internals

### Submission → MIMInput

| JSON Field           | MIM Internal       | Purpose                           |
| -------------------- | ------------------ | --------------------------------- |
| `submission.code`    | `MIMInput.code`    | Source code for signal extraction |
| `submission.verdict` | `MIMInput.verdict` | Routes to accepted/failed path    |
| `problem_context.*`  | `MIMInput.*`       | Problem metadata for context      |

### User State → UserStateSnapshot

| JSON Field                          | MIM Internal                               | Purpose                      |
| ----------------------------------- | ------------------------------------------ | ---------------------------- |
| `user_state.dominant_failure_modes` | `UserStateSnapshot.dominant_failure_modes` | Pattern recurrence detection |
| `user_state.improving_areas`        | `UserStateSnapshot.improving_areas`        | Trajectory analysis          |
| `user_state.stagnant_areas`         | `UserStateSnapshot.stagnant_areas`         | Plateau detection            |
| `user_state.regressing_areas`       | `UserStateSnapshot.regressing_areas`       | Regression alerts            |

### Delta Features → Behavioral Signals

| JSON Field                     | MIM Internal                                 | Purpose              |
| ------------------------------ | -------------------------------------------- | -------------------- |
| `delta_attempts_same_category` | `DeltaFeatures.delta_attempts_same_category` | Category persistence |
| `delta_root_cause_repeat_rate` | `DeltaFeatures.delta_root_cause_repeat_rate` | Pattern detection    |
| `delta_complexity_mismatch`    | `DeltaFeatures.delta_complexity_mismatch`    | Efficiency issues    |
| `is_cold_start`                | `DeltaFeatures.is_cold_start`                | New user handling    |

## Output Structure

When running experiments, MIM produces:

### 1. Raw Input Echo

Confirms what inputs were received.

### 2. Feature Snapshot

Shows the delta features and user state snapshot used by the model.

### 3. Code Signals (verbose mode)

Extracted signals from the code:

- `loop_bounds`, `recursion_depth`, `binary_search`, etc.
- Used by the failure mechanism rule engine

### 4. Pattern Detection

Whether this is a recurring mistake:

- `is_recurring`: Boolean
- `recurrence_count`: How many times seen
- `related_past_problems`: Problem IDs with similar mistakes

### 5. Difficulty Decision (for accepted submissions)

- `ready_for_harder`: Whether user should advance
- `suggested_next_difficulty`: Recommended difficulty

### 6. Final MIM Verdict

The complete feedback object:

- `feedback_type`: correctness|efficiency|implementation|understanding_gap|reinforcement
- `root_cause`: Primary failure category (failed submissions only)
- `subtype`: Granular failure type
- `failure_mechanism`: Deterministic explanation
- `confidence_metadata`: Calibrated confidence scores

## Adding New Test Cases

### Step 1: Identify the Scenario

Define what learner profile you want to test:

- Skill level (beginner/intermediate/advanced)
- Problem type (arrays/dp/graph/etc.)
- Expected failure mode (boundary error/TLE/misread problem)

### Step 2: Create Realistic Inputs

```json
"your_new_case": {
  "description": "Clear description of what this tests",

  "submission": {
    // Use realistic code that demonstrates the failure mode
    // Include comments explaining the bug
  },

  "problem_context": {
    // Match real problem characteristics
    // Constraints should align with expected_complexity
  },

  "user_state": {
    // Build a coherent user history
    // dominant_failure_modes should relate to the submission bug
  },

  "delta_features": {
    // Set is_cold_start=1.0 for new users (<5 submissions)
    // Set repeat_rate > 0 if testing recurrence detection
  }
}
```

### Step 3: Validate the Case

```bash
# Run just your new case
python -m app.mim.experiments.run_mim_experiments --case your_new_case --verbose

# Check that:
# 1. No validation errors occur
# 2. Root cause matches your expected failure mode
# 3. Confidence levels are reasonable
# 4. Feedback is coherent with the bug
```

## Interpreting Outputs

### Confidence Levels

| Level    | Range  | Meaning                     |
| -------- | ------ | --------------------------- |
| `high`   | ≥80%   | Trust diagnosis fully       |
| `medium` | 65-79% | Trust with caution          |
| `low`    | <65%   | Conservative mode activated |

### Root Causes (V3.x Taxonomy)

| Root Cause                  | Description                              |
| --------------------------- | ---------------------------------------- |
| `correctness`               | Algorithm doesn't produce correct answer |
| `efficiency`                | Algorithm too slow for constraints       |
| `implementation`            | Code bugs (off-by-one, overflow, etc.)   |
| `understanding_gap`         | Misread problem/constraints              |
| `problem_misinterpretation` | Solved wrong problem entirely            |

### Subtypes

Each root cause has specific subtypes:

- `correctness`: wrong_invariant, incorrect_boundary, partial_case_handling, state_loss
- `efficiency`: brute_force_under_constraints, premature_optimization
- `implementation`: incorrect_boundary, state_loss, partial_case_handling
- `understanding_gap`: misread_constraint, wrong_invariant

### Conservative Mode

When `conservative_mode: true`:

- MIM is uncertain about the diagnosis
- Difficulty adjustments are dampened
- Consider this feedback less authoritative

## Troubleshooting

### "Validation failed" errors

Check that:

1. All required fields are present in your test case
2. `user_state` has `dominant_failure_modes`, `improving_areas`, `stagnant_areas`
3. `delta_features` has all 6 required fields for failed submissions

### "Could not load MIM models" warning

This is normal if trained models aren't available. MIM will use fallback rule-based predictions.

### Unexpected root cause

1. Check the `verdict` - TLE always routes to `efficiency`
2. Check the code signals with `--verbose`
3. Verify `delta_features` are realistic for the scenario

## Important Caveats

1. **No Production Data**: Test cases use synthetic user IDs/problem IDs
2. **Model State**: Results depend on trained models in `app/mim/models/`
3. **Deterministic Rules**: Failure mechanisms are rule-based, not ML
4. **Calibration**: Confidence scores are calibrated if calibrator is present

---

**This harness is for observation only. It does NOT modify MIM decision logic, thresholds, or policies.**
