# MIM (Machine Intelligence Model) Specification

> **Authoritative documentation for the MIM diagnostic engine.**
> 
> MIM is the deterministic brain of the AI feedback system. It performs root cause classification, pattern detection, and difficulty decisions using ML models. LLM agents receive MIM decisions and cannot override them.

---

## 1. What is MIM?

MIM (Machine Intelligence Model) is a **deterministic diagnostic engine** that analyzes failed submissions to identify root causes of errors.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Type** | Machine Learning classifier (LightGBM) |
| **NOT** | An LLM, heuristic system, or rule engine |
| **Role** | The "brain" that makes diagnostic decisions |
| **Output** | Structured, deterministic classifications |

### Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIM is the BRAIN, Agents are the VOICE                    │
│                                                                              │
│   MIM decides WHAT is wrong (deterministic, ML-based)                       │
│   Agents explain HOW to fix it (linguistic, LLM-based)                      │
│                                                                              │
│   CRITICAL: Agents CANNOT override MIM decisions.                           │
│   They only add natural language explanations.                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inputs

MIM receives the following inputs for each submission analysis:

### 2.1 Submission Context

| Input | Description | Example |
|-------|-------------|---------|
| `verdict` | Judge result | `wrong_answer`, `time_limit_exceeded` |
| `code` | Submitted source code | Python/JS/Java/C++ code |
| `language` | Programming language | `python`, `javascript` |
| `problem_id` | Problem identifier | `prob_abc123` |
| `user_id` | User identifier | `user_xyz789` |

### 2.2 Delta Features

Changes between current and previous attempts:

| Feature | Description |
|---------|-------------|
| `attempt_number` | Which attempt this is (1, 2, 3...) |
| `time_since_last_attempt` | Seconds since previous submission |
| `code_change_ratio` | How much code changed (0.0 - 1.0) |
| `lines_added` | Number of lines added |
| `lines_removed` | Number of lines removed |

### 2.3 Code Signals (AST Analysis)

Extracted from static analysis of the submitted code:

| Signal | Description |
|--------|-------------|
| `loop_count` | Number of loops |
| `nested_loop_depth` | Maximum nesting depth |
| `conditional_count` | Number of if/else statements |
| `function_count` | Number of function definitions |
| `estimated_complexity` | Big-O estimate |
| `uses_recursion` | Boolean |
| `uses_memoization` | Boolean |

### 2.4 User History (Aggregated)

Historical performance data (no PII):

| Feature | Description |
|---------|-------------|
| `total_submissions` | Lifetime submission count |
| `acceptance_rate` | Overall success rate |
| `category_accuracy` | Accuracy per problem category |
| `dominant_root_causes` | Most common failure types |
| `current_streak` | Consecutive accepted/failed |

---

## 3. Outputs (Contract)

MIM produces a structured output with the following components:

### 3.1 Root Cause Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ROOT CAUSE TAXONOMY                                 │
├─────────────────┬───────────────────────────────────────────────────────────┤
│ Root Cause      │ Description                                               │
├─────────────────┼───────────────────────────────────────────────────────────┤
│ correctness     │ Logic produces wrong outputs for some inputs              │
│ efficiency      │ Solution too slow (TLE) or uses too much memory (MLE)     │
│ implementation  │ Correct approach but buggy code (null refs, type errors)  │
│ understanding_gap│ Problem requirements were misunderstood                  │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

### 3.2 Subtype Classification

Each root cause has granular subtypes:

**Correctness Subtypes:**
- `off_by_one` - Loop boundary errors
- `boundary_condition` - Edge case handling
- `comparison_error` - Wrong comparison operators
- `wrong_invariant` - Incorrect loop invariants
- `partial_case_handling` - Missing cases

**Efficiency Subtypes:**
- `wrong_complexity` - Algorithm too slow for constraints
- `suboptimal_data_structure` - Better DS available
- `redundant_operations` - Unnecessary repeated work
- `missing_memoization` - Recomputing same values

**Implementation Subtypes:**
- `null_reference` - Null/undefined access
- `type_mismatch` - Type conversion errors
- `state_mutation` - Unintended state changes
- `resource_leak` - Unclosed resources

**Understanding Gap Subtypes:**
- `misread_constraints` - Wrong constraint interpretation
- `wrong_problem_entirely` - Solving different problem
- `missing_requirements` - Incomplete solution

### 3.3 Calibrated Confidence (Phase 2.1)

```javascript
{
  "combined_confidence": 0.82,      // 0.0 - 1.0, calibrated via isotonic regression
  "confidence_level": "high",       // "high" (≥0.80), "medium" (≥0.65), "low" (<0.65)
  "conservative_mode": false,       // True if confidence too low for aggressive actions
  "calibration_applied": true       // Whether isotonic calibration was applied
}
```

**Confidence Tiers:**

| Tier | Threshold | Behavior |
|------|-----------|----------|
| HIGH | ≥ 0.80 | Trust fully, allow pattern confirmation |
| MEDIUM | ≥ 0.65 | Trust with caution, suspected patterns only |
| LOW | < 0.65 | Conservative mode, no pattern claims |

### 3.4 Pattern State (Phase 2.2)

```javascript
{
  "state": "confirmed",             // "none", "suspected", "confirmed", "stable"
  "evidence_count": 3,              // Number of supporting instances
  "confidence_support": "high"      // Confidence level of pattern detection
}
```

**Pattern State Machine:**

```
    NONE → SUSPECTED → CONFIRMED → STABLE
              ↓           ↓
          (decay)     (decay)
              ↓           ↓
            NONE       SUSPECTED
```

| State | Meaning | UI Treatment |
|-------|---------|--------------|
| `none` | No pattern detected | Don't show pattern UI |
| `suspected` | Pattern emerging | "This may be a recurring pattern" |
| `confirmed` | Pattern verified | "This is a confirmed recurring issue" |
| `stable` | Long-standing, improved | "You've improved on this pattern" |

### 3.5 Difficulty Decision (Phase 2.3)

```javascript
{
  "action": "maintain",             // "increase", "maintain", "decrease"
  "reason": "pattern_unresolved",   // Reason code
  "confidence_tier": "high"         // Confidence that influenced decision
}
```

**Difficulty Policy Rules:**

| Condition | Action | Reason |
|-----------|--------|--------|
| LOW confidence | MAINTAIN | Cannot trust diagnosis for changes |
| SUSPECTED/CONFIRMED pattern | MAINTAIN | Hold for remediation |
| Consistent success + HIGH conf | INCREASE | User ready for harder problems |
| Struggling + HIGH conf | DECREASE | Support fundamentals |

---

## 4. Guarantees

### 4.1 Determinism

MIM is **fully deterministic**:

```
Same inputs → Same outputs (always)
```

- No randomness in predictions
- No external API calls that could vary
- Reproducible for testing and debugging

### 4.2 Confidence Calibration

Confidence scores are **calibrated** using isotonic regression:

- Raw model probabilities are transformed
- Calibrated scores reflect true accuracy
- A prediction with 80% confidence is correct ~80% of the time

### 4.3 No Online Learning

MIM does **not learn in real-time**:

- Model weights are fixed after training
- Updates require offline retraining
- Prevents feedback loops and instability
- Version bumps for model changes

### 4.4 Stable Taxonomy

The root cause taxonomy is **stable**:

- Changes require explicit version bump
- Frontend can rely on known values
- No surprise categories at runtime

---

## 5. What MIM Does NOT Do

### ❌ No Natural Language Explanations

MIM outputs structured data only. Human-readable explanations come from LLM agents:

```
MIM outputs:  { "root_cause": "correctness", "subtype": "off_by_one" }
Agent adds:   "Your loop iterates one element too few. Check the boundary condition."
```

### ❌ No Memory Retrieval

MIM does not access user memory or past feedback. RAG (Retrieval-Augmented Generation) handles this separately:

```
MIM:  Classifies current submission
RAG:  Retrieves relevant past mistakes for context
```

### ❌ No Suggestions or Recommendations

MIM identifies problems, not solutions. Agents and the difficulty policy handle recommendations:

```
MIM:     "Root cause is off_by_one error"
Agent:   "Consider using <= instead of < in your loop"
Policy:  "Maintain difficulty until pattern resolved"
```

### ❌ No Problem Recommendations

MIM focuses on diagnosis. The Recommender module handles problem suggestions:

```
MIM:          Diagnoses submission failures
Recommender:  Suggests next problems based on gaps
```

---

## 6. Integration Points

### 6.1 Workflow Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYNC WORKFLOW                                      │
│                                                                              │
│   1. MIM Decision Node ──→ Root cause, confidence, pattern, difficulty      │
│          ↓                                                                   │
│   2. RAG Retrieval ──────→ User memory context                              │
│          ↓                                                                   │
│   3. Feedback Agent ─────→ Natural language explanation                     │
│          ↓                                                                   │
│   4. Hint Agent ─────────→ Progressive hints                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Frontend Integration

Frontend receives MIM output via these fields:

```javascript
// API Response structure
{
  // MIM FACTS (treat as authoritative)
  "diagnosis": { "rootCause": "correctness", "subtype": "off_by_one", ... },
  "confidence": { "confidenceLevel": "high", "combinedConfidence": 0.85, ... },
  "pattern": { "state": "confirmed", "evidenceCount": 3, ... },
  "difficulty": { "action": "maintain", "reason": "pattern_unresolved", ... },
  
  // LLM-generated content (explanations)
  "feedback": { "explanation": "...", "correctCode": "...", ... },
  "hint": { "text": "..." },
  
  // RAG metadata
  "rag": { "used": true, "relevance": 0.67 }
}
```

### 6.3 Agent Instructions

Agents receive MIM decisions as instructions they **cannot override**:

```python
# Feedback Agent receives:
{
  "root_cause": "correctness",           # MUST use this, cannot guess different
  "subtype": "off_by_one",               # MUST reference this
  "confidence": 0.85,                    # Use to adjust tone
  "pattern_state": "confirmed",          # Must mention if confirmed
  "difficulty_action": "maintain"        # Must not contradict
}
```

---

## 7. Model Training

### 7.1 Training Data

MIM is trained on labeled submission data:

| Feature | Source |
|---------|--------|
| Code features | Static analysis |
| User features | Aggregated history |
| Problem features | Problem metadata |
| Labels | Human-verified root causes |

### 7.2 Model Architecture

```
Features → LightGBM Root Cause Classifier → CalibratedClassifierCV
                        ↓
         LightGBM Subtype Classifiers (per root cause)
```

### 7.3 Evaluation Metrics

| Metric | Target |
|--------|--------|
| Root Cause Accuracy | > 75% |
| Subtype Accuracy | > 65% |
| Calibration Error | < 0.05 |

---

## 8. Versioning

MIM follows semantic versioning:

| Version | Description |
|---------|-------------|
| `mim-v3.0` | Base V3 with polymorphic outputs |
| `mim-v3.1` | Added pattern state machine |
| `mim-v3.2` | Added calibrated confidence |
| `mim-v3.3` | Added difficulty policy |

Current production version: **mim-v3.3**

---

## 9. References

- `ai-services/app/mim/` - MIM implementation
- `ai-services/app/mim/taxonomy/` - Root cause taxonomy
- `ai-services/app/mim/pattern_state.py` - Pattern state machine
- `ai-services/app/mim/difficulty_policy.py` - Difficulty policy
- `ai-services/app/mim/calibration/` - Confidence calibration
- `docs/AI_SERVICES.md` - Full AI services documentation
