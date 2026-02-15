# Comprehensive Audit Report: AI Services Codebase

**Project:** Mentat Trials AI Service  
**Version:** v3.4 (agents) / v3.1 (taxonomy) / v2.1 (calibration)  
**Date:** January 2025  
**Scope:** Full codebase audit of `ai-services/`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Module-by-Module Audit](#3-module-by-module-audit)
   - [3.1 Entry Point & API Layer](#31-entry-point--api-layer)
   - [3.2 Agent System](#32-agent-system)
   - [3.3 MIM Engine (Machine Intelligence Model)](#33-mim-engine)
   - [3.4 RAG Pipeline](#34-rag-pipeline)
   - [3.5 Graph Orchestration (Sync/Async Workflows)](#35-graph-orchestration)
   - [3.6 Guardrails System](#36-guardrails-system)
   - [3.7 Cache Layer](#37-cache-layer)
   - [3.8 Database Integration](#38-database-integration)
   - [3.9 Vector Store](#39-vector-store)
   - [3.10 LLM Providers](#310-llm-providers)
   - [3.11 User Profile & User Model](#311-user-profile--user-model)
   - [3.12 Problem Repository](#312-problem-repository)
   - [3.13 Schemas](#313-schemas)
   - [3.14 Prompts](#314-prompts)
   - [3.15 Utilities & Support Modules](#315-utilities--support-modules)
4. [Data Flow & Request Lifecycle](#4-data-flow--request-lifecycle)
5. [ML Models & Algorithms](#5-ml-models--algorithms)
6. [Phase System & Evolution](#6-phase-system--evolution)
7. [Testing Infrastructure](#7-testing-infrastructure)
8. [Scripts & Tooling](#8-scripts--tooling)
9. [Key Architectural Patterns](#9-key-architectural-patterns)
10. [Findings & Observations](#10-findings--observations)

---

## 1. Executive Summary

The AI Services codebase implements a sophisticated adaptive learning platform for competitive programming practice. Its core philosophy is **"MIM is the BRAIN, agents are the VOICE"** — a strict separation where the Machine Intelligence Model (MIM) makes all analytical decisions deterministically, while LLM-powered agents add linguistic polish.

### Key Statistics

| Metric                    | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| Total Python source files | ~100+                                                  |
| Top-level modules         | 18 directories under `app/`                            |
| MIM sub-modules           | 14 directories                                         |
| API endpoints             | 12                                                     |
| ML models                 | 3 (root cause, readiness, performance) + 1 recommender |
| LLM providers             | 2 (Groq + Gemini with automatic fallback)              |
| Feature vector dimensions | 60 (MIM) + 33 (code signals)                           |
| Taxonomy                  | 5 root causes, 10 subtypes, 30+ failure mechanisms     |
| Test files                | 19                                                     |

### Technology Stack

- **Framework:** FastAPI + Uvicorn
- **Orchestration:** LangChain + LangGraph (StateGraph)
- **ML:** LightGBM (primary) + scikit-learn (fallback)
- **LLM:** Groq (llama-3.3-70b-versatile) + Google Gemini (2.5-flash)
- **Database:** MongoDB (pymongo + motor)
- **Cache:** Redis (agent responses)
- **Vector Store:** Pinecone Serverless (user memory) + FAISS (local mistake episodes)
- **Embeddings:** sentence-transformers/all-MiniLM-L6-v2 (384 dims)
- **Calibration:** Isotonic Regression (sklearn)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FastAPI Server                              │
│  POST /ai/feedback  │  POST /ai/weekly-report  │  MIM endpoints    │
└──────────┬──────────┴────────────┬──────────────┴──────────┬────────┘
           │                       │                          │
     ┌─────▼──────┐         ┌─────▼──────┐            ┌─────▼──────┐
     │ Guardrails │         │ Orchestrator│            │ MIM Direct │
     │ Idempotency│         │  (Planner)  │            │  Endpoints │
     │ VerdictGuard│        └─────┬───────┘            └────────────┘
     └─────┬──────┘               │
           │              ┌───────┴───────┐
           │              │               │
     ┌─────▼──────┐  ┌───▼────┐   ┌──────▼──────┐
     │ Sync       │  │ Async  │   │ Background  │
     │ Workflow   │  │ Runner │   │ Tasks       │
     │ (45s max)  │  │        │   │             │
     └─────┬──────┘  └───┬────┘   └─────────────┘
           │              │
     ┌─────┴──────────────┴──────────────────────┐
     │              Shared Infrastructure          │
     ├─────────┬──────────┬──────────┬────────────┤
     │   MIM   │   RAG    │  Cache   │    DB      │
     │ Engine  │ Pipeline │  (Redis) │ (MongoDB)  │
     │ (ML+    │(Pinecone)│          │            │
     │  Rules) │          │          │            │
     └─────────┴──────────┴──────────┴────────────┘
```

### Request Flow (POST /ai/feedback)

1. **Idempotency check** → deduplicate within 30s window
2. **Verdict guard** → decide which pipeline stages to run
3. **Sync workflow** (LangGraph StateGraph, 45s budget):
   - Retrieve user memory (Pinecone, 8s)
   - Retrieve problem context (Backend API, 8s)
   - MIM prediction (ML models, 3s)
   - Feedback agent (LLM, 20s)
   - Hint agent (LLM, 8s)
4. **Schedule async workflow** (fire-and-forget):
   - Learning agent → difficulty adjustment → store memory → persist profile
5. **Build progressive hints** → return `AIFeedbackDTO`

---

## 3. Module-by-Module Audit

### 3.1 Entry Point & API Layer

#### `main.py` (257 lines)

- **Purpose:** FastAPI application factory and server startup
- **Key Components:**
  - `StructuredLogger` class → JSON-formatted logging with trace IDs
  - `trace_id_var` ContextVar → per-request UUID tracing
  - CORS middleware → localhost:5173 + env-configured origins
  - Request tracing middleware → attaches UUID to every request
  - Startup event → pre-loads embedding model (all-MiniLM-L6-v2)
- **Configuration:** PORT 8000 (env override), Render deployment uses 10000

#### `app/api/routes.py` (2023 lines)

- **Purpose:** All API endpoint definitions and DTOs
- **Endpoints:**
  | Method | Path | Purpose |
  |--------|------|---------|
  | POST | `/ai/feedback` | Unified feedback (sync+async) |
  | POST | `/ai/weekly-report` | On-demand weekly progress report |
  | POST | `/predict` | Direct MIM prediction |
  | GET | `/health` | Health check |
  | GET | `/health/llm` | LLM provider health |
  | GET | `/ai/rag-stats/{user_id}` | RAG retrieval statistics |
  | GET | `/ai/mim/status` | MIM system status |
  | GET | `/ai/mim/profile/{user_id}` | User cognitive profile |
  | GET | `/ai/mim/recommend/{user_id}` | Problem recommendations |
  | POST | `/ai/mim/train` | Trigger MIM retraining |
  | GET | `/ai/mim/predict/{user_id}/{problem_id}` | MIM prediction query |
  | GET | `/ai/mim/roadmap/{user_id}` | Learning roadmap |
  | GET | `/ai/mim/difficulty/{user_id}` | Difficulty assessment |

- **Key DTOs:**
  - `AIFeedbackDTO` — polymorphic response (correctness/performance/reinforcement MIM insights)
  - `MIMInsightsDTO` — union type: `MIMCorrectnessDTO | MIMPerformanceDTO | MIMReinforcementDTO`
  - `HintLevel` enum — conceptual / specific / approach / solution
  - `build_progressive_hints()` — tiered hint generation by verdict

---

### 3.2 Agent System

**Design Philosophy:** Agents are "the VOICE" — they receive MIM decisions as structured instructions and apply linguistic polish. They do NOT make analytical decisions.

#### `app/agents/base_json_agent.py`

- **Purpose:** Shared agent execution framework
- **Key Function:** `run_json_agent()` — unified pipeline:
  1. Cache check (Redis, SHA256 key)
  2. Rate limit check (all providers)
  3. Context truncation (3500 chars max)
  4. LLM chain invocation (`ChatPromptTemplate` → `PydanticOutputParser`)
  5. Retry on parse failure
  6. Cache write
- **Non-deterministic agents:** `{"feedback_agent", "hint_compression_agent"}` skip cache
- **Integration:** Uses `LLMWithFallback` for automatic Groq → Gemini failover

#### `app/agents/feedback_agent.py` (448 lines)

- **Version:** v3.4 "Confidence & Pattern Aware"
- **Purpose:** Generates natural-language feedback from MIM's `FeedbackInstruction`
- **Key Behaviors:**
  - Confidence tiers (HIGH/MEDIUM/LOW) → language assertiveness guidance
  - Pattern states (NONE/SUSPECTED/CONFIRMED/STABLE) → recurrence language
  - 4-category taxonomy with 7 subtypes mapped to feedback templates
  - Accepted → celebration + reinforcement (no diagnosis)
- **Output:** `FeedbackResponse` with explanation, improvement_hint, detected_pattern, correct_code, concept_reinforcement, root_cause, subtype, failure_mechanism

#### `app/agents/learning_agent.py`

- **Purpose:** Concept-level learning recommendations
- **Output:** `LearningRecommendation` with focus_areas, rationale, skill_gap, exercises

#### `app/agents/hint_agent.py`

- **Purpose:** 20-word hint compression with subtype-aware rules
- **Output:** `CompressedHint` — single concise hint string

#### `app/agents/report_agent.py`

- **Purpose:** Data-driven weekly progress reports
- **Output:** `WeeklyProgressReport` with summary, strengths, improvement_areas, recurring_patterns

#### `app/agents/agent_input.py` (450 lines)

- **Purpose:** Constructs `AgentInput` dataclass from MIM outputs
- **Key Function:** `build_agent_input()` → marshals MIM decision, user state, problem context into agent-ready format

#### `app/agents/context_compressor.py`

- **Purpose:** Ollama/Mistral-based context compression
- **Threshold:** 2000 chars triggers compression
- **Status:** Optional dependency (graceful fallback if Ollama unavailable)

---

### 3.3 MIM Engine (Machine Intelligence Model)

The MIM engine is the analytical core — ~30+ files across 14 subdirectories. It makes ALL diagnostic decisions without LLM calls.

#### 3.3.1 Core Decision Pipeline

##### `app/mim/decision_engine.py` (1120 lines)

- **Purpose:** Central MIM orchestrator (legacy singleton)
- **Class:** `MIMDecisionEngine`
- **Pipeline:** Extract features → ML predictions → Taxonomy migration → Problem misinterpretation heuristic → Pattern engine → Difficulty action → Agent instructions → Build `MIMDecision`
- **Key Tables:** `SUBTYPE_DESCRIPTIONS`, `FAILURE_MECHANISM_TEMPLATES`, `EDGE_CASE_RULES`, `HINT_DIRECTIONS`, `FOCUS_AREA_MAP` (all keyed by root_cause + subtype)
- **Graceful Degradation:** Preserves partial results on failure; pattern data survives in degraded decisions

##### `app/mim/inference/mim_decision_node.py` (1029 lines)

- **Purpose:** Refactored inference node (Phase 2.1+)
- **Class:** `MIMDecisionNode`
- **Version:** v2.1.0
- **Key Design:**
  - User state snapshot is MANDATORY (not optional)
  - Accepted → reinforcement path (NO root cause, NO subtype)
  - Failed → root cause → subtype → failure mechanism pipeline
  - Confidence calibration via isotonic regression
  - Conservative confidence caps (max 0.90)
  - Confidence-aware degradation modes (LOW → conservative)
- **Integration Points:**
  - Imports `MIMInput` / `MIMOutput` / `ConfidenceMetadata` schemas
  - Uses taxonomy validators from `subtype_masks.py`
  - Calls `derive_failure_mechanism()` from rule engine
  - Extracts code signals via `extract_code_signals()`

##### `app/mim/mim_decision.py` (310 lines)

- **Purpose:** Core MIM decision data structures
- **Key Types:**
  - `FeedbackInstruction` — root_cause, subtype, failure_mechanism, tone, edge_cases, recurrence
  - `HintInstruction` — direction, avoid_revealing
  - `LearningInstruction` — focus_areas, skill_gap
  - `PatternResult` — state machine output (none/suspected/confirmed/stable), evidence_strength, confidence gating
  - `DifficultyAction` — action (decrease/maintain/increase/stretch), target_difficulty, success_probability, plateau/burnout risk
  - `MIMDecision` — v3.2 with `decision_id` + `is_frozen` for immutability enforcement
- **Rich Formatting:** `to_agent_context()`, `get_feedback_context()`, `get_hint_context()`, `get_learning_context()` — structured prompt sections for agents

#### 3.3.2 Taxonomy System

##### `app/mim/taxonomy/subtype_masks.py` (227 lines)

- **Purpose:** AUTHORITATIVE constraint map — ROOT_CAUSE → valid SUBTYPES
- **Design:** Runtime constraint, NOT documentation. Any prediction outside masks is a BUG.
- **Root Causes (5):** `correctness`, `efficiency`, `implementation`, `understanding_gap`, `problem_misinterpretation` (v3.1)
- **Subtype Mapping:**
  | Root Cause | Valid Subtypes |
  |------------|---------------|
  | correctness | wrong_invariant, incorrect_boundary, partial_case_handling, state_loss |
  | efficiency | brute_force_under_constraints, premature_optimization |
  | implementation | incorrect_boundary, state_loss, partial_case_handling |
  | understanding_gap | misread_constraint, wrong_invariant |
  | problem_misinterpretation | wrong_input_format, wrong_problem_entirely, misread_constraints |
- **Intentional Overlap:** Some subtypes appear under multiple roots (e.g., `incorrect_boundary` under both correctness and implementation)
- **Reverse Mask:** `SUBTYPE_TO_ROOT_CAUSES` for validation
- **Hard Guard:** `validate_subtype()` raises `SubtypeValidationError` on invalid pairs

##### `app/mim/taxonomy/root_causes.py` (124 lines)

- **Purpose:** Root cause definitions and descriptions
- **4-Category System:** correctness, efficiency, implementation, understanding_gap (strict — no "unknown" escape hatch)
- **Descriptions:** Each root cause has name, description, manifestation, learning_focus
- **Legacy Migration:** `OLD_TO_NEW_ROOT_CAUSE` maps 15 old categories → 4 new ones

##### `app/mim/taxonomy/subtypes.py` (203 lines)

- **Purpose:** Fine-grained subtype definitions
- **Design:** Subtypes are predicted by Model B (LightGBM), conditioned on ROOT_CAUSE
- **Primary Assignments:** For subtypes with multiple valid roots, defines canonical primary root
- **Descriptions:** Each subtype has name, description, example, fix_direction

##### `app/mim/taxonomy/failure_mechanism_rules.py` (323 lines)

- **Purpose:** DETERMINISTIC failure mechanism derivation (pure function, no ML/LLM)
- **30+ Mechanisms:** e.g., off_by_one, invariant_drift, exponential_path_explosion, missing_state_dimension, constraint_blindness, edge_case_omission
- **Rule Precedence:** 1) Subtype + specific signal → most specific, 2) Subtype + category → category-aware, 3) Subtype → default fallback
- **Guarantee:** NEVER returns "unknown" or "generic"

#### 3.3.3 Feature Extraction

##### `app/mim/feature_extractor.py` (700 lines)

- **Purpose:** 60-dimension feature vector builder
- **Feature Layout:**
  | Range | Group | Examples |
  |-------|-------|----------|
  | [0-14] | Submission | Verdict encoding, code structure (loops, recursion, conditionals, data structures) |
  | [15-29] | Error Semantics | Error type, index patterns, loop complexity |
  | [30-44] | Problem Metadata | Difficulty, topic one-hot, constraints |
  | [45-54] | Temporal | Time-of-day, session velocity, retries |
  | [55-59] | Historical | Success rates, entropy |
- **Cold Start:** <5 submissions → use problem difficulty as proxy

##### `app/mim/features/delta_features.py` (326 lines)

- **Purpose:** State transition features (deltas, not absolutes)
- **6 Features:** delta_attempts_same_category, delta_root_cause_repeat_rate, delta_complexity_mismatch, delta_time_to_accept, delta_optimization_transition, is_cold_start
- **Cold Start Rules:** <2 history → zero-fill (cold_start=1), 2-4 → compute deltas (cold_start=1), ≥5 → full personalization (cold_start=0)
- **Design:** ONLY failed submissions feed into this module

##### `app/mim/features/state_snapshot.py` (419 lines)

- **Purpose:** Pre-inference user state snapshot builder
- **Class:** `UserStateSnapshot` — all fields required, no optionals
- **Fields:** dominant_failure_modes (top 3), dominant_root_causes (top 2), improving/stagnant/regressing areas, strong_categories, strong_techniques, recent_transitions, metadata
- **Function:** `build_user_state_snapshot()` — trajectory analysis, strength computation, transition detection

##### `app/mim/features/signal_extractor.py` (390 lines)

- **Purpose:** Extract code + execution signals for failure mechanism rules
- **Class:** `CodeSignals` — boolean flags (loop_bounds, binary_search, recursion_depth, etc.) + verdict + constraint signals + extensible `extras` dict
- **Phase 1.1 Bridge:** Integrates with `code_signals` module for AST-based structural signals
- **Backward Compatible:** Maps new AST signals to existing boolean flags

#### 3.3.4 Code Signal Analysis

##### `app/mim/code_signals/` (Phase 1.1)

- **Purpose:** Deterministic code structure analysis (no ML, no LLM)
- **3 Components:**

  **`ast_analyzer.py` (626 lines)**
  - `ASTAnalyzer` class with `ASTFeatures` dataclass (19 features)
  - Supports Python (via `ast` module) + C++/Java/JS (regex fallback)
  - Features: loop depth/count/type, recursion indicators, array access patterns, boundary checks, off-by-one risk score, mutable state analysis, cyclomatic complexity estimate
  - Produces ML-ready feature vector

  **`pattern_detector.py` (447 lines)**
  - `PatternDetector` class with `DetectedPatterns` dataclass (10 features)
  - Detects: off-by-one indicators, boundary risks, overflow risks, uninitialized state, state mutation risks, inefficiency patterns, recursion risks
  - Each detection → `PatternMatch` with type, description, line hint, confidence, risk level

  **`extractor.py` (358 lines)**
  - `CodeSignalExtractor` — combines AST + pattern detection
  - `CodeStructureSignals` output: ~33 features total (19 AST + 10 pattern + 4 derived risk scores)
  - Verdict-aware risk adjustment
  - Derives `likely_root_cause` with confidence score

#### 3.3.5 Pattern Engine

##### `app/mim/pattern_engine.py` (942 lines)

- **Purpose:** Deterministic pattern detection (NO LLM calls)
- **Phase 2.2:** Confidence gating + pattern state machine + temporal decay
- **Strategy Order:**
  1. Confidence gate (LOW → no patterns)
  2. History lookup with weighted evidence
  3. Root cause → pattern mapping (`ROOT_CAUSE_TO_PATTERNS`)
  4. Verdict-based hints (`VERDICT_PATTERN_HINTS`: TLE→efficiency, RE→boundary, etc.)
- **Constants:** DECAY_HALF_LIFE = 14 days, HIGH_CONFIDENCE ≥ 0.80, MEDIUM ≥ 0.65

##### `app/mim/pattern_state.py` (480 lines)

- **Purpose:** Pattern state machine with temporal decay
- **State Transitions:** NONE → SUSPECTED → CONFIRMED → STABLE (with decay demotions)
- **Key Classes:**
  - `ConfidenceTier` enum (HIGH ≥ 0.80, MEDIUM ≥ 0.65, LOW < 0.65)
  - `PatternEvidence` — timestamped evidence with tier
  - `PatternStateRecord` — tracks state, evidence list, weighted metrics, transitions
  - `PatternStateTransitionEngine` — thresholds (SUSPECTED=1.0, CONFIRMED=2.5, STABLE=4.0 weighted evidence), temporal decay (half-life=14 days), confidence gate (LOW → never add evidence), inactivity demotion at 30 days

#### 3.3.6 Difficulty Engine

##### `app/mim/difficulty_engine.py` (835 lines)

- **Purpose:** Adaptive difficulty adjustment
- **Class:** `DifficultyEngine` v2.0 (Phase 2.3)
- **Pipeline:** Confidence tier → Cooldown/oscillation check → Outcome validation → Compute frustration/boredom indices → Proposed adjustment → Policy gates → Oscillation override
- **Frustration Index:** Weighted: consecutive_failures(0.4) + window_failure_rate(0.35) + retry_factor(0.25)
- **Constants:** FRUSTRATION_THRESHOLD=0.6, BOREDOM_THRESHOLD=0.7, COOLDOWN=5 submissions, OSCILLATION_LOOKBACK=15

##### `app/mim/difficulty_policy.py` (673 lines)

- **Purpose:** 5 sequential policy gates for difficulty decisions
- **Gates:**
  | # | Gate | Rule |
  |---|------|------|
  | 1 | Confidence Gate | LOW confidence blocks increase |
  | 2 | Pattern State Gate | SUSPECTED/CONFIRMED patterns block increase |
  | 3 | Cooldown Gate | 5 submissions after last difficulty change |
  | 4 | Hysteresis Gate | 3 consecutive eligible required for increase |
  | 5 | Directional Bias Gate | Decrease always allowed |
- **Output:** `PolicyDecision` with full audit trail (gates_evaluated, blocking_gate, input context)

#### 3.3.7 ML Models

##### `app/mim/model.py` (757 lines)

- **Purpose:** ML model management
- **Class:** `MIMModel` v2.0
- **3 Models:**
  | Model | Type | Trees | Depth | LR | Purpose |
  |-------|------|-------|-------|----|---------|
  | Root Cause (A) | LGBMClassifier multiclass | 300 | 10 | 0.05 | Predict root cause |
  | Readiness | LGBMClassifier binary | 200 | - | - | Predict learning readiness |
  | Performance | LGBMClassifier binary | 150 | - | - | Predict performance |
- **All:** Balanced class weights, subsample 0.8, regularization
- **Fallback:** sklearn RandomForest/GradientBoosting/LogisticRegression if LightGBM unavailable
- **15 ROOT_CAUSE_CATEGORIES** (legacy), **8 READINESS_LEVELS**
- **Persistence:** joblib serialization

##### `app/mim/models/` (directory)

- Contains serialized model files:
  - `model_a_root_cause.joblib` — trained root cause classifier
  - `model_b_subtype.joblib` — trained subtype classifier
  - `model_a_calibrator.joblib` — isotonic regression calibrator
  - `recommender.joblib` — trained recommender model
  - `calibration_config.json` — calibration thresholds
  - Multiple `training_report_*.json` — training run logs (Jan 2026 dates)
  - `calibration_eval_pre.json` / `calibration_eval_post.json` — calibration metrics

#### 3.3.8 Calibration (Phase 2.1)

##### `app/mim/calibration/calibrate_model_a.py` (459 lines)

- **Purpose:** Offline confidence calibration pipeline
- **Pipeline:** Load model + validation data → compute raw confidence → evaluate pre-calibration (ECE, MCE) → fit isotonic regression → evaluate post-calibration → save calibrator
- **Confidence Caps:** max=0.90, high=0.80, medium=0.65, low=0.50
- **Minimum Accuracy:** HIGH confidence requires ≥85% accuracy, MEDIUM requires ≥70%

##### `app/mim/calibration/wrapper.py` (233 lines)

- **Purpose:** Post-hoc calibration methods
- **Methods:** Isotonic Regression (non-parametric, preserves ranking) + Platt Scaling (parametric)
- **All calibration is offline — no online adaptation**

##### `app/mim/calibration/evaluator.py` (825 lines)

- **Purpose:** Calibration metric computation
- **Metrics:** Expected Calibration Error (ECE), Maximum Calibration Error (MCE), Brier score, reliability curves
- **Assessment:** ECE < 0.10 = "good", < 0.15 = "acceptable", else "poor"

##### `app/mim/calibration/thresholds.py` (155 lines)

- **Purpose:** Data-driven threshold discovery
- **Class:** `ThresholdValidator` — empirically validates and recommends confidence thresholds
- **Guarantee:** "High confidence ⇒ high correctness" must hold empirically

#### 3.3.9 Contextual Intelligence Signals (v3.x)

##### `app/mim/signals/regression_signal.py` (448 lines)

- **Purpose:** Detects when experienced user performance contradicts historical competence
- **Design:** Pure deterministic rules, no ML
- **Output:** `RegressionSignal` — severity (NONE/LOW/MEDIUM/HIGH), violation score, historical success rate
- **Use Case:** User with 50+ successful graph problems fails basic graph → regression detected → feedback shifts from "teaching" to "refreshing"

##### `app/mim/signals/confidence_adjuster.py` (421 lines)

- **Purpose:** Contextual confidence adjustment layer
- **Design:** base_confidence (ML output) ≠ adjusted_confidence (actionability)
- **Adjustments:**
  - Cold start → damping (-0.10)
  - Recurrence ≥1 → boost (+0.05 to +0.10)
  - Regression → boost based on severity (+0.05 to +0.15)
  - Problem understanding flag → +0.05
- **Safety Invariants:** adjusted ≤ 0.90 (cap), adjusted ≥ base - 0.15 (floor)

##### `app/mim/signals/context_enricher.py` (520 lines)

- **Purpose:** Enriches MIM output with contextual intelligence
- **Design:** ADDITIVE only, never modifies existing outputs
- **Key Components:**
  - `ExecutionMode` enum — ML_FULL / ML_PARTIAL / RULES_FALLBACK / HYBRID
  - `CognitiveVersion` enum — V2 (legacy rules) / V3 (ML + rules)
  - `ProblemUnderstandingDimension` — separates misread constraints from generic correctness

##### `app/mim/signals/integration.py` (401 lines)

- **Purpose:** Single entry point for all contextual signal augmentation
- **Class:** `EnrichedMIMOutput` — wraps original `MIMOutput` + enriched context
- **Function:** `enrich_mim_output()` — called AFTER inference, computes regression + confidence adjustment + context enrichment

#### 3.3.10 Training Pipeline

##### `app/mim/training/train_models.py` (828 lines)

- **Purpose:** MIM V3.0 model training with structural guarantees
- **Model A (Root Cause):** 4 classes, delta features + is_cold_start + code signal features, macro F1 metric
- **Model B (Subtype):** Masked inference — invalid subtypes get probability=0, per-root_cause models (preferred) or global+mask
- **Feature Columns:** `ROOT_CAUSE_FEATURES` = [delta_attempts_same_category, is_cold_start], `CODE_SIGNAL_FEATURES` = 17 AST/pattern/risk features
- **Acceptance Criteria:** No illegal (root_cause, subtype) pair producible, subtype entropy decreases vs old model

##### `app/mim/training/dataset_builder.py` (716 lines)

- **Purpose:** Build training datasets from MongoDB exports
- **Two Canonical Datasets:**
  1. `mim_failure_transitions.parquet` — FAILED submissions only
  2. `mim_reinforcement_events.parquet` — ACCEPTED submissions only
- **NO cross-contamination:** Strict accepted/failed separation
- **Splits:** Per-user time-ordered train/val/test (70/15/15)
- **Minimum:** 3 submissions per user for val/test inclusion

##### `app/mim/training/canonical_dataset_schemas.py` (428 lines)

- **Purpose:** Pydantic fail-fast validation schemas for training data
- **`FailureTransitionRow`:** Strict required fields, `extra="forbid"`
- **`ReinforcementEventRow`:** Separate schema for accepted submissions

#### 3.3.11 Production Infrastructure

##### `app/mim/production/model_registry.py` (272 lines)

- **Purpose:** Versioned model management (Phase 4.2)
- **Features:** Version tracking with metadata, one-command rollback, model comparison, audit trail
- **`ModelVersion`:** version, model_type, metrics (macro_f1, ece), paths, promotion audit

##### `app/mim/production/shadow_mode.py` (207 lines)

- **Purpose:** Safe model experimentation (Phase 4.4)
- **Design:** Run candidate alongside production, log predictions without serving, promote only if metrics pass
- **Promotion Criteria:** Agreement rate ≥ 85%, accuracy regression ≤ 2%, min 100 samples

##### `app/mim/production/drift_detector.py` (235 lines)

- **Purpose:** Feature and prediction drift monitoring (Phase 4.3)
- **Methods:** KL divergence, normalized mean/std difference
- **Thresholds:** Feature drift warn=0.15/alert=0.25, Prediction drift warn=0.10/alert=0.20

#### 3.3.12 Evaluation & Verification

##### `app/mim/evaluation.py` (474 lines)

- **Purpose:** Model evaluation with user-aware splits
- **Class:** `MIMEvaluator`
- **Metrics:** Accuracy, F1, Precision, Recall, confusion matrix, per-class report, ROC-AUC
- **No data leakage:** User-aware train/val/test splits, user-aware cross-validation

##### `app/mim/verification/human_verification.py` (624 lines)

- **Purpose:** Phase 6 final check before rollout
- **Process:** Sample 50 failed + 50 accepted submissions → human review checklist
- **Failed Check:** root_cause correct? subtype specific? failure_mechanism precise?
- **Accepted Check:** no mistake language? strength signal valid?

##### `app/mim/observability.py` (555 lines)

- **Purpose:** Thread-safe metrics collection
- **Class:** `MIMMetricsStore`
- **Critical Invariants:** `accepted_mistake_logic_count == 0`, `invalid_taxonomy_count == 0`
- **Tracks:** total inferences, verdict type counts, subtype distributions, cold-start metrics, latencies

#### 3.3.13 Recommender & Roadmap

##### `app/mim/recommender.py` (684 lines)

- **Purpose:** Learning-to-Rank for next problem selection
- **13 Features:** user_skill_level, success_rate, topic_success, days_since_topic, streak, velocity, problem_difficulty, popularity, ac_rate, avg_attempts, skill_difficulty_gap, topic_weakness_score, recency_bonus
- **Training:** Min 50 samples, LightGBM

##### `app/mim/roadmap.py` (600 lines)

- **Purpose:** Personalized learning roadmap generation
- **5 Phases:** foundation → skill_building → consolidation → advancement → mastery
- **`TopicDependencyGraph`:** Hardcoded core dependencies (e.g., DP → [Arrays, Recursion, Math]) + learned co-occurrence dependencies from history

#### 3.3.14 Output Schemas

##### `app/mim/output_schemas/`

- **`MIMInput`** (149 lines) — Pydantic schema, ALL fields required, `extra="forbid"`. Fields: user_id, problem_id, code, verdict, category, difficulty, constraints, problem_tags, user_state_snapshot, delta_features
- **`MIMOutput`** (219 lines) — Polymorphic output with `ConfidenceMetadata` (Phase 2.1). Includes v3.x intelligence fields: adjusted_confidence, regression_detected, pattern_unblocked, escalation_eligible, execution_mode, cognitive_version
- **`CorrectnessFeedback`** (159 lines) — For correctness/implementation/understanding_gap root causes. Strictly required fields, taxonomy-validated
- **`PerformanceFeedback`** (107 lines) — For efficiency root cause only. Adds expected/observed complexity and optimization_direction
- **`ReinforcementFeedback`** (96 lines) — For accepted submissions ONLY. No root_cause/subtype fields. Tracks category, technique, confidence_boost, strength_signal

---

### 3.4 RAG Pipeline

#### `app/rag/retriever.py`

- **Purpose:** Phase 3.1 enhanced memory retrieval and storage
- **`retrieve_user_memory()`:** Context-aware query building (root_cause, subtype, pattern_state params) → `QueryBuilder` → relevance gate filtering → returns `List[str]`
- **`store_user_feedback()`:** Storage gate (blocks low-quality memories) → LangChain `Document` with enhanced metadata → confidence-gated Pinecone storage

#### `app/rag/vector_store.py` (512 lines)

- **Purpose:** Pinecone Serverless vector store abstraction
- **Class:** `PineconeVectorStore` — lazy initialization, AWS us-east-1
- **Index:** "arrakis-labs", cosine metric, namespace "user_memory"
- **`MemoryQualityScorer`:** Deterministic scoring (no LLM). Weights: mim_confidence(0.35), pattern_recurrence(0.25), content_completeness(0.25), user_feedback(0.15). Storage threshold: 0.6

#### `app/rag/context_builder.py` (641 lines)

- **Purpose:** Focused context assembly for agents
- **Builders:**
  - `build_feedback_context_focused()` — ~2500 chars target (problem essentials, MIM instructions, numbered user code, verdict, weak topics)
  - `build_hint_context_minimal()` — <500 chars
  - `build_learning_context_minimal()` — <400 chars
- **v3.2:** Hardened null-safety for all optional fields

#### `app/rag/embeddings.py`

- **Purpose:** Embedding model wrapper
- **Class:** `HuggingFaceLocalEmbeddings(Embeddings)` — wraps sentence-transformers/all-MiniLM-L6-v2
- **384 dimensions**, L2 normalized, lazy loading, singleton via `get_embeddings()`

#### `app/rag/monitoring.py`

- **Purpose:** RAG retrieval statistics
- **Class:** `RAGMonitor` — per-user tracking (total, empty, avg_relevance)
- **Singleton:** `rag_monitor`

#### `app/rag/quality_gates.py` (578 lines)

- **Purpose:** Phase 3.1 quality enforcement
- **`StorageGate`:** LOW confidence blocks storage, quality scoring with 4 weighted components
- **`RelevanceGate`:** Filters low-quality retrieval results
- **`QueryBuilder`:** Context-aware query construction for vector search

---

### 3.5 Graph Orchestration

#### `app/graph/orchestrator.py` (307 lines)

- **Purpose:** Central execution planner
- **Decision Table by Verdict:**
  | Path | Sync Agents | Async Agents |
  |------|-------------|-------------|
  | Accepted Easy | skip all | light RAG only |
  | Accepted Medium | feedback | learning, store_memory |
  | Accepted Hard | feedback | learning, MIM, store_memory |
  | Failures | feedback, pattern_detection, hint | learning, difficulty, store_memory |
  | Weekly Report | — | weekly_report |
- **RAG Validation:** Phase 3.1 QueryBuilder integration

#### `app/graph/sync_workflow.py` (1086 lines)

- **Purpose:** LangGraph StateGraph for synchronous pipeline
- **State:** `MentatSyncState` TypedDict
- **Execution:** ThreadPoolExecutor (3 workers)
- **Time Budgets:**
  | Node | Budget |
  |------|--------|
  | retrieve_memory | 8s |
  | retrieve_problem | 8s |
  | mim_prediction | 3s |
  | feedback_agent | 20s |
  | hint_agent | 8s |
  | **Total** | **45s max** |

#### `app/graph/async_workflow.py` (580 lines)

- **Purpose:** Background processing pipeline
- **State:** `AsyncState` TypedDict
- **Nodes:** learning → difficulty (MIM-based, 1s) → weekly_report → store_memory → persist_profile
- **Deduplication:** `_processed_submissions` set with LRU eviction at 1000 entries

#### `app/graph/async_runner.py`

- **Purpose:** Fire-and-forget wrapper for `async_workflow.invoke()`

---

### 3.6 Guardrails System

#### `app/guardrails/idempotency.py` (293 lines)

- **Purpose:** Request deduplication
- **Class:** `RequestDeduplicator` — thread-safe singleton
- **Key:** MD5(user_id + problem_id + verdict + code_hash)
- **TTL:** 30 seconds, LRU eviction at 1000 entries
- **States:** (True, cached_response) | (True, None=in-flight) | (False, None=new)

#### `app/guardrails/verdict_guards.py` (406 lines)

- **Purpose:** Pipeline skip decisions based on verdict + difficulty
- **Class:** `VerdictGuard` with static `check()` method
- **Result:** `VerdictGuardResult` (skip_mim, skip_rag, skip_hint, skip_learning_diagnosis, use_success_path, create_reinforcement)
- **Decision Table:**
  | Verdict | Difficulty | Action |
  |---------|-----------|--------|
  | Accepted | Easy | Skip all |
  | Accepted | Medium | Light RAG only |
  | Accepted | Hard | Light MIM + RAG |
  | Failed | Any | Full pipeline |

---

### 3.7 Cache Layer

#### `app/cache/redis_cache.py`

- **Purpose:** Agent response caching
- **Class:** `RedisCache` singleton
- **Key Format:** `ai:agent:{agent_name}:{sha256_hash[:16]}`
- **TTL:** 3600 seconds (1 hour)
- **Non-deterministic agents skip cache:** feedback_agent, hint_compression_agent

#### `app/cache/cache_key.py`

- **Purpose:** Deterministic SHA256 cache key builder
- **Input:** Agent name + serialized context

#### `app/cache/agent_cache.py`

- **Purpose:** DEPRECATED file-based cache (legacy)

---

### 3.8 Database Integration

#### `app/db/mongodb.py`

- **Purpose:** MongoDB client singleton
- **Library:** pymongo (sync) + motor (async)
- **Connection:** `MONGODB_URI` environment variable
- **Collections:**
  | Collection | Purpose |
  |-----------|---------|
  | `submissions` | User code submissions (filtered: isRun=False) |
  | `users` | User accounts |
  | `questions` | Problem definitions |
  | `user_cognitive_profiles` | MIM cognitive profiles |
  | `mim_training_data` | Training data for MIM |
- **Key Function:** `sync_submission_to_rag()` — bridges DB → RAG pipeline

#### `app/db/cognitive_profile_store.py` (657 lines)

- **Purpose:** Persistent cognitive profile management
- **Functions:** `load_cognitive_profile()`, `save_cognitive_profile()`, `apply_mim_decision_to_profile()` (different paths for accepted vs failed), `apply_learning_to_profile()`, `apply_difficulty_to_profile()`, `persist_cognitive_profile()`, `get_profile_summary()`
- **v3.2:** Delta updates

---

### 3.9 Vector Store

#### `app/vector_store/mistake_memory_store.py` (390 lines)

- **Purpose:** Local vector store for mistake episodes with delta-based similarity
- **Class:** `MistakeMemoryStore`
- **Storage:** File-based (JSON) + in-memory cache per user
- **Features:**
  - `record_mistake_episode()` — stores with delta feature embeddings (32-dim)
  - `find_similar_mistakes()` — cosine similarity retrieval (top-k)
  - `get_recurrence_count()` — subtype recurrence tracking within lookback window

#### `app/vector_store/user_state_store.py` (211 lines)

- **Purpose:** Persistent user state snapshot storage
- **Class:** `UserStateStore`
- **Storage:** File-based JSON with optional FAISS (64-dim, IndexFlatL2)
- **Features:** get/update user state, get/update strengths (separate files), find similar users (cohort analysis via FAISS)

---

### 3.10 LLM Providers

#### `app/services/llm.py` (280 lines)

- **Purpose:** LLM abstraction with automatic fallback
- **Class:** `LLMWithFallback(BaseChatModel)` — inherits LangChain base
- **Providers:**
  | Provider | Model | Cooldown |
  |----------|-------|----------|
  | Groq (primary) | llama-3.3-70b-versatile (fallback: mixtral-8x7b-32768) | 60s |
  | Gemini (fallback) | gemini-2.5-flash | 120s |
- **Rate Limit Detection:** 429 HTTP errors trigger provider cooldown
- **Error:** `AllProvidersRateLimitedError` when both providers rate-limited
- **Utilities:** `get_current_provider()`, `is_rate_limited()`, `get_rate_limit_status()`, `reset_rate_limit()`

---

### 3.11 User Profile & User Model

#### `app/user_profile/profile_builder.py` (605 lines)

- **Purpose:** Build user profiles WITHOUT LLM calls
- **v3.2:** MIM decision integration
- **Function:** `build_user_profile()` — keyword-based analysis:
  - `MISTAKE_KEYWORDS` (10 patterns) → `derive_mistakes_from_memory()`
  - `TOPIC_WEAKNESS_KEYWORDS` (10 topics) → `derive_weak_topics_from_memory()`
  - `extract_recurring_patterns()`, `extract_recent_categories()`
- **`normalize_memory_chunks()`:** Handles List[str], List[Dict], str, None

#### `app/user_model/state_tracker.py` (352 lines)

- **Purpose:** Failure-only processing (raises ValueError on accepted)
- **Class:** `UserStateTracker`
- **Tracks:** dominant_failure_modes, dominant_root_causes, improving/stagnant/regressing areas, recent_transitions
- **Analysis:** Splits history into early/recent halves, computes per-category failure rate changes

#### `app/user_model/strength_updater.py` (343 lines)

- **Purpose:** Accepted-only processing (raises ValueError on failed)
- **Class:** `StrengthUpdater`
- **Tracks:** strong_categories, strong_techniques, category_strengths, overall_readiness (easy/medium/hard success probabilities)

---

### 3.12 Problem Repository

#### `app/problem/problem_repository.py`

- **Purpose:** Problem context retrieval with caching
- **Class:** `ProblemContext` (Pydantic) with `canonical_algorithms` (v3.2)
- **LRU Cache:** 100 problems
- **Source:** Backend API (`BACKEND_API_URL/questions/{id}`), fallback to minimal context
- **Knowledge Maps:**
  - `TAG_TO_APPROACH` — 20+ tags → recommended approaches
  - `TAG_TO_COMMON_MISTAKES` — 20+ tags → common mistakes

---

### 3.13 Schemas

All 8 schema files under `app/schemas/`:

| Schema                   | Key Fields                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SubmissionContext`      | user_id, problem_id, code, language, verdict, error_type, problem, user_profile                                                                                                |
| `FeedbackResponse`       | v3.3: explanation, improvement_hint, detected_pattern, complexity_analysis, edge_cases, root_cause, root_cause_subtype, failure_mechanism, correct_code, concept_reinforcement |
| `CompressedHint`         | Single hint string                                                                                                                                                             |
| `LearningRecommendation` | focus_areas, rationale, skill_gap, exercises, summary                                                                                                                          |
| `DifficultyAdjustment`   | action (increase/maintain/decrease), rationale                                                                                                                                 |
| `DetectedPattern`        | pattern, confidence                                                                                                                                                            |
| `WeeklyProgressReport`   | summary, strengths, improvement_areas, recurring_patterns                                                                                                                      |
| `UserProfile`            | v3.2: common_mistakes, weak_topics, recurring_patterns, MIM integration (current_mim_root_cause, mim_decision_id, profile_mim_agreement)                                       |

---

### 3.14 Prompts

All 4 prompt files under `app/prompts/`:

| Prompt              | Agent      | Key Rules                                                                  |
| ------------------- | ---------- | -------------------------------------------------------------------------- |
| `FEEDBACK_PROMPT`   | Feedback   | "You are a Mentat." Use only context, no full solutions, structured output |
| `LEARNING_PROMPT`   | Learning   | Learning progression, max 3 focus areas                                    |
| `DIFFICULTY_PROMPT` | Difficulty | Conservative (default maintain), no aggressive jumps                       |
| `REPORT_PROMPT`     | Report     | Weekly analysis, focus on trends                                           |

---

### 3.15 Utilities & Support Modules

#### `app/utils/algorithm_detector.py` (474 lines)

- **Purpose:** Regex-based algorithm classification
- **13 Algorithm Patterns:** max_flow, bipartite_matching, dijkstra, bfs_dfs, union_find, dp_2d, dp_1d, knapsack, binary_search, two_pointers, sorting, greedy, brute_force
- **Each Pattern:** regex list, required_count, category, keywords

#### `app/sync/submission_sync.py`

- **Purpose:** Batch sync failed submissions from MongoDB → RAG within time window

#### `app/metrics/agent_metries.py`

- **Purpose:** Simple JSON file-based metric recording (agent name, elapsed time, timestamp)
- **Output:** `agent_metrics.json`

#### `app/mim/offline_eval/` (5 files)

- `baseline_eval.py` — baseline model evaluation
- `feature_audit.py` — feature importance and sanity auditing
- `regression_tests.py` — model regression testing
- `snapshot_metadata.py` — evaluation snapshot management

#### `app/mim/metrics/learning_effectiveness.py`

- Learning outcome tracking metrics

---

## 4. Data Flow & Request Lifecycle

### Complete `/ai/feedback` Flow

```
Client POST /ai/feedback
    │
    ▼
┌─ Idempotency Check (MD5 key, 30s TTL) ─────────────────┐
│  Duplicate? → Return cached response                     │
└──────────────────────────────┬───────────────────────────┘
                               │ New request
                               ▼
┌─ Verdict Guard ─────────────────────────────────────────┐
│  Accepted Easy? → Skip all pipeline                      │
│  Accepted Medium? → Light RAG only                       │
│  Accepted Hard? → Light MIM + RAG                        │
│  Failed? → Full pipeline                                 │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌─ SYNC WORKFLOW (LangGraph, 45s budget) ─────────────────┐
│                                                          │
│  ┌─ Parallel (ThreadPool, 3 workers) ──────────────┐    │
│  │  retrieve_memory_node (Pinecone, 8s)             │    │
│  │  retrieve_problem_node (Backend API, 8s)         │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  ┌─ mim_prediction_node (ML models, 3s) ───────────┐    │
│  │  Extract features → Predict root_cause (Model A) │    │
│  │  → Predict subtype (Model B, masked)              │    │
│  │  → Derive failure_mechanism (rules)               │    │
│  │  → Pattern engine → Difficulty action             │    │
│  │  → Generate agent instructions                    │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  ┌─ build_user_profile_node ────────────────────────┐    │
│  │  Keyword-based analysis (no LLM)                  │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  ┌─ feedback_agent_node (LLM, 20s) ────────────────┐    │
│  │  MIM FeedbackInstruction → Natural language       │    │
│  │  Cache check → LLM → Parse → Cache write          │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  ┌─ hint_agent_node (LLM, 8s) ─────────────────────┐    │
│  │  20-word compression with subtype rules           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌─ Schedule ASYNC WORKFLOW (fire-and-forget) ──────────────┐
│  learning_agent → difficulty_adjustment → store_memory   │
│  → persist_cognitive_profile                             │
└──────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─ Build Progressive Hints ───────────────────────────────┐
│  Tiered by verdict: conceptual → specific → approach    │
│  → solution (revealed progressively)                     │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
                    Return AIFeedbackDTO
```

---

## 5. ML Models & Algorithms

### 5.1 Root Cause Classifier (Model A)

- **Algorithm:** LightGBM (LGBMClassifier)
- **Task:** Multiclass classification (4 classes → 5 with v3.1)
- **Features:** Delta features + is_cold_start + 17 code signal features
- **Configuration:** 300 trees, depth 10, learning rate 0.05, subsample 0.8, balanced class weights
- **Metric:** Macro F1 (NOT accuracy)
- **Calibration:** Isotonic regression post-hoc (Phase 2.1)

### 5.2 Subtype Classifier (Model B)

- **Algorithm:** LightGBM (LGBMClassifier), per-root_cause models
- **Task:** Multiclass with masking — invalid subtypes get probability=0
- **Constraint:** Output MUST be valid per ROOT_CAUSE_TO_SUBTYPES mask

### 5.3 Readiness Model

- **Algorithm:** LightGBM (LGBMClassifier, binary)
- **Configuration:** 200 trees
- **Purpose:** Predict learning readiness level

### 5.4 Performance Forecaster

- **Algorithm:** LightGBM (LGBMClassifier, binary)
- **Configuration:** 150 trees
- **Purpose:** Predict performance trajectory

### 5.5 Recommender

- **Algorithm:** LightGBM (Learning-to-Rank)
- **Features:** 13 features (user + problem + cross features)
- **Purpose:** Next problem recommendation
- **Minimum Training:** 50 samples

### 5.6 Deterministic Algorithms (No ML)

- **Pattern State Machine:** Weighted evidence thresholds with temporal decay
- **Difficulty Policy:** 5 sequential gates
- **Failure Mechanism Rules:** Subtype + signal → mechanism (pure function)
- **Frustration/Boredom Index:** Weighted linear combinations
- **Code Signal Extraction:** AST analysis + regex pattern detection
- **Algorithm Detection:** Regex-based classification for 13 algorithm types

---

## 6. Phase System & Evolution

The codebase follows a structured engineering phase system:

| Phase | Name                             | Status      | Key Changes                                                     |
| ----- | -------------------------------- | ----------- | --------------------------------------------------------------- |
| 1.1   | Code Signal Bridge               | ✅ Complete | AST-based code analysis, deterministic signals                  |
| 1.2   | Feature Sanity Audit             | ✅ Complete | Removed noisy features from Model A input                       |
| 1.3   | Code Signal Features in Training | ✅ Complete | 17 new features baked into training pipeline                    |
| 2.1   | Confidence Calibration           | ✅ Complete | Isotonic regression, conservative caps (max 0.90)               |
| 2.2   | Pattern State Machine            | ✅ Complete | NONE→SUSPECTED→CONFIRMED→STABLE with decay                      |
| 2.3   | Difficulty Policy Gates          | ✅ Complete | 5 sequential gates, frustration/boredom indices                 |
| 3.0   | Model Retraining V3              | ✅ Complete | LightGBM, masked subtype inference                              |
| 3.1   | RAG Quality Gates                | ✅ Complete | Storage gate, relevance gate, query builder                     |
| 4.2   | Model Registry                   | ✅ Complete | Versioned models with rollback                                  |
| 4.3   | Drift Detection                  | ✅ Complete | Feature + prediction drift monitoring                           |
| 4.4   | Shadow Mode                      | ✅ Complete | Safe A/B testing for model candidates                           |
| 6.0   | Human Verification               | ✅ Complete | 100-sample verification checklist                               |
| v3.x  | Intelligence Upgrade             | ✅ Complete | Regression detection, confidence adjustment, context enrichment |

### Version Evolution

- **v3.0:** LLM-based → deterministic ML for pattern/difficulty (saved ~29s per request)
- **v3.1:** Expanded taxonomy from 4 to 5 root causes (added problem_misinterpretation)
- **v3.2:** Delta updates for cognitive profiles, `decision_id` + `is_frozen` immutability
- **v3.3:** Added failure_mechanism, correct_code, concept_reinforcement to feedback
- **v3.4:** Confidence & pattern aware feedback agent

---

## 7. Testing Infrastructure

### Test Files (19 total)

| File                              | Coverage Area            |
| --------------------------------- | ------------------------ |
| `test_agents.py`                  | Agent execution pipeline |
| `test_agent_architecture.py`      | Agent design patterns    |
| `test_cache.py`                   | Redis caching            |
| `test_calibration_integration.py` | Phase 2.1 calibration    |
| `test_difficulty_policy.py`       | Phase 2.3 policy gates   |
| `test_integration.py`             | End-to-end integration   |
| `test_learning_effectiveness.py`  | Learning outcome metrics |
| `test_llm_service.py`             | LLM fallback behavior    |
| `test_mim.py`                     | MIM core pipeline        |
| `test_mim_gates.py`               | MIM gate logic           |
| `test_pattern_engine_v2.py`       | Phase 2.2 pattern engine |
| `test_problem_repository.py`      | Problem retrieval        |
| `test_rag.py`                     | RAG pipeline             |
| `test_rag_quality_gates.py`       | Phase 3.1 gates          |
| `test_routes.py`                  | API endpoints            |
| `test_services.py`                | Service layer            |
| `test_user_profile.py`            | Profile building         |
| `test_workflows.py`               | Sync/async workflows     |
| `conftest.py`                     | Shared fixtures          |

**Configuration:** `pytest.ini` at project root

---

## 8. Scripts & Tooling

### `scripts/` Directory (17 files)

| Script                                                 | Purpose                                    |
| ------------------------------------------------------ | ------------------------------------------ |
| `download_datasets.py`                                 | Download training datasets                 |
| `generate_mock_data.py`                                | Generate mock data for testing             |
| `generate_synthetic_practice_submissions_with_code.py` | Synthetic code submissions                 |
| `load_test.py`                                         | Load/stress testing                        |
| `mim_labeler.py`                                       | Manual labeling tool for MIM training data |
| `preprocess_training_data.py`                          | Data preprocessing pipeline                |
| `retrain_all_models.py`                                | Full retraining orchestration              |
| `seed_additional.py`                                   | Additional database seeding                |
| `seed_user_data.py`                                    | User data seeding                          |
| `seed_user_memory.py`                                  | RAG memory seeding                         |
| `test_user_flow.py`                                    | End-to-end user flow testing               |
| `test_v32_fixes.py`                                    | v3.2 regression testing                    |
| `train_mim_60.py`                                      | MIM training (60-feature version)          |
| `train_mim_models.py`                                  | MIM model training                         |
| `train_mim_v2.py`                                      | MIM v2 training pipeline                   |
| `validate_production.py`                               | Production validation                      |
| `verify_rag.py`                                        | RAG pipeline verification                  |

---

## 9. Key Architectural Patterns

### 9.1 "MIM is the BRAIN, Agents are the VOICE"

- All analytical decisions (root cause, subtype, difficulty, pattern detection) are made by MIM deterministically
- Agents receive structured `FeedbackInstruction`, `HintInstruction`, `LearningInstruction` and add natural language
- This separation ensures consistency, testability, and auditability

### 9.2 Strict Accepted/Failed Separation

- **No cross-contamination** at every level:
  - Training data: separate parquet files
  - Feature extraction: delta_features only process failures
  - Output schemas: CorrectnessFeedback ≠ ReinforcementFeedback
  - User model: `UserStateTracker` (failures only) vs `StrengthUpdater` (accepted only)
  - MIM decision node: completely separate code paths

### 9.3 Confidence-Gated Decision Making

- Every decision passes through confidence tiers (HIGH ≥ 0.80, MEDIUM ≥ 0.65, LOW < 0.65)
- LOW confidence triggers conservative mode (minimal adjustments, no increases)
- Confidence flows through: calibration → adjustment (regression/recurrence) → policy gates → agent instructions

### 9.4 Fail-Fast Taxonomy Enforcement

- `SubtypeValidationError` raised on any illegal (root_cause, subtype) pair
- `extra="forbid"` on all Pydantic schemas prevents unknown fields
- All training data validated against canonical schemas before use
- Runtime assertions via `MIMMetricsStore` invariants

### 9.5 Graceful Degradation

- LLM failover: Groq → Gemini with cooldowns
- ML fallback: LightGBM → sklearn
- MIM degradation: preserves partial results on error
- RAG fallback: empty memory → still generates feedback
- Code analysis: AST → regex fallback for non-Python languages

### 9.6 Temporal Awareness

- Pattern decay: half-life = 14 days
- Difficulty cooldown: 5 submissions between changes
- Inactivity demotion: 30 days → pattern state demotion
- History windowing: lookback_days parameter throughout

### 9.7 Observability by Design

- `MIMMetricsStore`: Thread-safe inference metrics with critical invariants
- `RAGMonitor`: Per-user retrieval statistics
- `ConfidenceMetadata`: Full calibration transparency (execution_mode, cognitive_version)
- `PolicyDecision`: Complete audit trail for difficulty decisions
- `EnrichedMIMOutput`: Additive context enrichment for debugging
- Agent metrics: JSON file recording per-agent latencies

---

## 10. Findings & Observations

### 10.1 Strengths

1. **Rigorous taxonomy enforcement** — The subtype mask system with runtime validation is well-designed and prevents invalid states at every level (inference, training, evaluation)

2. **Comprehensive phase system** — The multi-phase engineering approach (1.x → 2.x → 3.x → 4.x) shows disciplined incremental development with clear acceptance criteria

3. **Strong separation of concerns** — MIM (analytical) vs Agents (linguistic) separation makes the system testable and auditable

4. **Production-ready infrastructure** — Model registry, shadow mode, drift detection, and human verification scripts demonstrate production awareness

5. **Deterministic where possible** — Failure mechanism derivation, pattern detection, feature extraction, and difficulty policy are all pure functions

6. **Backward compatibility** — Legacy taxonomy migration maps, additive signal enrichment, and `extras` fields show careful evolution

### 10.2 Areas for Attention

1. **Decision engine duplication** — `decision_engine.py` (1120 lines) and `inference/mim_decision_node.py` (1029 lines) appear to implement overlapping functionality. The relationship between these two should be clarified (is one deprecated?).

2. **Model timestamp anomaly** — Training reports in `models/` directory show January 2026 dates, which may indicate clock misconfiguration during training runs.

3. **FAISS vs Pinecone duality** — The codebase uses Pinecone (serverless) for RAG user memory but FAISS (local) for mistake episodes and user state. This split is intentional but adds operational complexity.

4. **File-based persistence** — `MistakeMemoryStore` and `UserStateStore` use JSON file storage, which doesn't scale horizontally. Consider MongoDB or Pinecone for these as well.

5. **Cold start edge cases** — Multiple cold start thresholds exist across modules (<2, <5 submissions) with slightly different semantics. A centralized cold start configuration would improve consistency.

6. **Deprecated code** — `agent_cache.py` is marked DEPRECATED but still present. The legacy 15-category taxonomy constants remain in `model.py`.

7. **Test coverage gaps** — No dedicated tests for MIM inference node, code signals, calibration evaluator, production modules (drift, shadow, registry), or training pipeline.

8. **Hardcoded constants** — Many thresholds (decay half-life, frustration threshold, confidence caps, gate weights) are hardcoded as module-level constants. Consider externalizing to configuration.

9. **Agent metrics file** — Uses simple JSON append (`agent_metries.py` — note typo in filename), which will grow unbounded and doesn't support concurrent writes safely.

10. **Embedding model loading** — The all-MiniLM-L6-v2 model is pre-loaded at startup, which increases cold start time. Consider lazy loading or a separate service.

---

_This audit covers all 100+ source files across 18 top-level modules and 14 MIM sub-modules. Every file was reviewed for purpose, key classes/functions, integration points, and algorithms used._
