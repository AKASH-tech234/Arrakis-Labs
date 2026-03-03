# AI Services Documentation

> **Mentat Trials AI Engine** - FastAPI-based AI/LLM service providing intelligent feedback, root cause analysis, pattern detection, and personalized learning recommendations.

## 📋 Quick Links

- **[MIM Specification](./MIM.md)** - Authoritative documentation for the MIM diagnostic engine
- **[Backend Integration](./BACKEND.md)** - API contracts and backend integration
- **[Frontend Integration](./FRONTEND.md)** - UX components and state management

---

## 🆕 Phase 2.x Upgrades

### Phase 2.1: Confidence Calibration

- Post-hoc calibration for prediction confidence
- Three-tier confidence levels: HIGH (≥0.80), MEDIUM (≥0.65), LOW (<0.65)
- Conservative mode for low-confidence predictions

### Phase 2.2: Pattern State Machine

- Explicit pattern states: NONE → SUSPECTED → CONFIRMED → STABLE
- Confidence-gated state transitions
- Temporal decay for pattern demotion

### Phase 2.3: Difficulty Policy

- Safety-first difficulty adjustments
- Pattern-aware blocking (no increase with unresolved patterns)
- Hysteresis for stability (requires consecutive eligible events)

### Agent Explain-Only Rule

- **CRITICAL**: LLM agents receive MIM decisions and CANNOT override them
- Agents only add natural language explanations to MIM facts
- This prevents hallucinated diagnoses and ensures consistency

### RAG Quality Gates

- Relevance threshold filtering for retrieved content
- User memory isolation (per-user vector store partitions)
- Staleness detection for old memories

## 📁 Directory Structure

```
ai-services/
├── main.py                     # FastAPI application entry
├── requirement.txt             # Python dependencies
├── pytest.ini                  # Test configuration
│
├── app/
│   ├── __init__.py
│   │
│   ├── api/
│   │   └── routes.py           # API endpoints & DTOs
│   │
│   ├── agents/                 # LangChain agents (LLM-powered)
│   │   ├── base_json_agent.py  # Base agent with JSON output
│   │   ├── context_compressor.py
│   │   ├── feedback_agent.py   # Generates explanations
│   │   ├── hint_agent.py       # Generates progressive hints
│   │   ├── learning_agent.py   # Learning path suggestions
│   │   └── report_agent.py     # Weekly report generation
│   │
│   ├── cache/                  # Caching layer
│   │   ├── agent_cache.py      # Agent response caching
│   │   ├── cache_key.py        # Key generation
│   │   └── redis_cache.py      # Redis integration
│   │
│   ├── db/
│   │   ├── mongodb.py          # MongoDB client
│   │   └── cognitive_profile_store.py  # User profile storage
│   │
│   ├── graph/                  # LangGraph workflows
│   │   ├── orchestrator.py     # Workflow orchestration
│   │   ├── sync_workflow.py    # Synchronous pipeline
│   │   ├── async_workflow.py   # Background processing
│   │   └── async_runner.py     # Async task runner
│   │
│   ├── guardrails/             # Safety & optimization
│   │   ├── idempotency.py      # Duplicate request handling
│   │   └── verdict_guards.py   # Verdict-based routing
│   │
│   ├── mim/                    # Machine Intelligence Model
│   │   ├── __init__.py
│   │   ├── model.py            # Heuristic classifier
│   │   ├── mim_decision.py     # Decision schema
│   │   ├── decision_engine.py  # Orchestrates predictions
│   │   ├── difficulty_engine.py
│   │   ├── pattern_engine.py   # Pattern detection
│   │   ├── recommender.py      # Problem recommendations
│   │   ├── feature_extractor.py
│   │   ├── evaluation.py       # Model evaluation
│   │   ├── observability.py    # Logging & metrics
│   │   ├── schemas.py          # Pydantic schemas
│   │   │
│   │   ├── features/           # Feature engineering
│   │   │   ├── delta_features.py
│   │   │   ├── signal_extractor.py
│   │   │   └── state_snapshot.py
│   │   │
│   │   ├── inference/          # Runtime prediction
│   │   │   ├── feedback_generator.py
│   │   │   └── mim_decision_node.py
│   │   │
│   │   ├── output_schemas/     # V3.0 polymorphic outputs
│   │   │   ├── mim_input.py
│   │   │   ├── mim_output.py
│   │   │   ├── correctness_feedback.py
│   │   │   ├── performance_feedback.py
│   │   │   └── reinforcement_feedback.py
│   │   │
│   │   ├── taxonomy/           # Root cause classification
│   │   │   ├── root_causes.py      # 4 root causes
│   │   │   ├── subtypes.py         # Granular subtypes
│   │   │   ├── subtype_masks.py    # Valid combinations
│   │   │   └── failure_mechanism_rules.py
│   │   │
│   │   ├── training/           # Classifier configuration
│   │   │   ├── dataset_builder.py
│   │   │   ├── train_models.py
│   │   │   ├── train_root_cause_model.py
│   │   │   ├── train_subtype_model.py
│   │   │   ├── reconstruct_datasets.py
│   │   │   ├── validate_taxonomy.py
│   │   │   └── canonical_dataset_schemas.py
│   │   │
│   │   └── verification/
│   │       └── human_verification.py
│   │
│   ├── prompts/                # LLM prompt templates
│   │   ├── feedback.py
│   │   ├── learning.py
│   │   ├── report.py
│   │   └── difficulty.py
│   │
│   ├── rag/                    # Retrieval-Augmented Generation
│   │   ├── __init__.py
│   │   ├── retriever.py        # Memory retrieval
│   │   ├── vector_store.py     # ChromaDB integration
│   │   ├── embeddings.py       # Text embeddings
│   │   ├── context_builder.py  # Context assembly
│   │   └── monitoring.py       # RAG metrics
│   │
│   ├── schemas/                # Pydantic models
│   │   ├── submission.py
│   │   ├── feedback.py
│   │   ├── hint.py
│   │   ├── learning.py
│   │   ├── pattern.py
│   │   ├── report.py
│   │   └── user_profile.py
│   │
│   ├── services/
│   │   └── llm.py              # LLM provider abstraction
│   │
│   ├── user_model/             # User state tracking
│   │   ├── state_tracker.py    # Learning state
│   │   └── strength_updater.py # Skill updates
│   │
│   ├── user_profile/
│   │   └── profile_builder.py  # Cognitive profile
│   │
│   ├── vector_store/
│   │   ├── mistake_memory_store.py
│   │   └── user_state_store.py
│   │
│   └── utils/
│       └── algorithm_detector.py
│
├── data/
│   ├── codeforces_500k.parquet # Training data
│   └── mim/
│       ├── failure_transitions.parquet
│       └── reinforcement_events.parquet
│
├── scripts/                    # Utility scripts
│   ├── configure_mim_classifiers.py
│   ├── retrain_all_models.py
│   ├── validate_production.py
│   └── ...
│
└── tests/
    ├── conftest.py
    ├── test_mim.py
    ├── test_agents.py
    ├── test_rag.py
    └── ...
```

---

## 🧠 MIM (Machine Intelligence Model)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MIM V3.0 ARCHITECTURE                              │
│                    "MIM is the BRAIN, Agents are the VOICE"                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Submission    │
                              │     Input       │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FEATURE EXTRACTION                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Code      │  │   User      │  │  Problem    │  │   Delta     │         │
│  │  Features   │  │  History    │  │  Features   │  │  Features   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DIAGNOSTIC LAYER                                      │
│                                                                               │
│   ┌─────────────────────┐      ┌─────────────────────┐                       │
│   │   Root Cause        │      │    Subtype          │                       │
│   │   Classifier        │ ───▶ │    Classifier       │                       │
│   │   (Heuristic)       │      │    (Heuristic)      │                       │
│   └─────────────────────┘      └─────────────────────┘                       │
│                                                                               │
│   4 Root Causes:                 Subtypes per root cause:                    │
│   • correctness                  • off_by_one, boundary_error, etc.          │
│   • efficiency                   • wrong_complexity, suboptimal_ds, etc.     │
│   • implementation               • null_reference, type_mismatch, etc.       │
│   • understanding_gap            • misread_constraints, wrong_problem, etc.  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       POLYMORPHIC OUTPUT (V3.0)                               │
│                                                                               │
│   Based on verdict + root cause, exactly ONE feedback type is generated:     │
│                                                                               │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│   │  Correctness    │  │  Performance    │  │ Reinforcement   │             │
│   │   Feedback      │  │   Feedback      │  │   Feedback      │             │
│   │  (WA/RE)        │  │  (TLE/MLE)      │  │  (Accepted)     │             │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          LLM AGENT LAYER                                      │
│                    (Adds linguistic polish to MIM decisions)                  │
│                                                                               │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │  Feedback   │  │    Hint     │  │  Learning   │  │   Report    │        │
│   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │        │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                               │
│   Agents receive MIM instructions and CANNOT override decisions.             │
│   They only add natural language explanations.                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Root Cause Taxonomy

```python
# mim/taxonomy/root_causes.py

ROOT_CAUSES = {
    "correctness",        # Logic produces wrong outputs
    "efficiency",         # Too slow or memory-heavy
    "implementation",     # Correct approach, buggy code
    "understanding_gap",  # Misunderstood the problem
}

ROOT_CAUSE_DESCRIPTIONS = {
    "correctness": {
        "name": "Correctness Error",
        "description": "The algorithm logic produces wrong outputs for some inputs.",
        "manifestation": "Wrong Answer (WA) verdicts",
        "learning_focus": "Invariant maintenance, boundary conditions, state tracking"
    },
    "efficiency": {
        "name": "Efficiency Problem",
        "description": "The solution is too slow or uses too much memory.",
        "manifestation": "Time Limit Exceeded (TLE) or Memory Limit Exceeded (MLE)",
        "learning_focus": "Complexity analysis, optimal algorithm selection"
    },
    "implementation": {
        "name": "Implementation Issue",
        "description": "The approach is correct but code has bugs.",
        "manifestation": "Runtime errors, partial test case failures",
        "learning_focus": "Code hygiene, defensive programming"
    },
    "understanding_gap": {
        "name": "Understanding Gap",
        "description": "The problem requirements were misunderstood.",
        "manifestation": "Solution solves a different problem",
        "learning_focus": "Problem decomposition, constraint analysis"
    }
}
```

### MIM Decision Schema

```python
# mim/mim_decision.py

class MIMDecision(BaseModel):
    """
    Central decision object from MIM.
    Contains ALL analytical decisions - agents only add linguistic polish.
    """

    # === CORE PREDICTIONS ===
    root_cause: str                    # correctness, efficiency, etc.
    root_cause_confidence: float       # 0.0 - 1.0
    root_cause_alternatives: List[Dict] # Other possible causes

    # === SUBTYPE (granular diagnosis) ===
    subtype: Optional[str]             # e.g., "off_by_one", "wrong_complexity"
    subtype_confidence: float
    failure_mechanism: Optional[str]   # Human-readable explanation

    # === PATTERN DETECTION ===
    pattern_instruction: PatternInstruction
    # - pattern_name: str
    # - is_recurring: bool
    # - recurrence_count: int
    # - severity: str

    # === DIFFICULTY RECOMMENDATION ===
    difficulty_instruction: DifficultyInstruction
    # - action: "increase" | "decrease" | "maintain" | "stretch"
    # - target_difficulty: str
    # - rationale: str

    # === AGENT INSTRUCTIONS ===
    feedback_instruction: FeedbackInstruction
    hint_instruction: HintInstruction

    # === USER CONTEXT ===
    user_state: Dict                   # From state tracker
    is_cold_start: bool                # New user flag

    # === METADATA ===
    model_version: str
    inference_latency_ms: float
```

---

## 🔌 API Endpoints

### Main Feedback Endpoint

```
POST /ai/feedback
```

**Request:**

```json
{
  "submission_id": "sub_abc123",
  "user_id": "user_123",
  "problem_id": "prob_456",
  "code": "def solution(arr):\n    ...",
  "verdict": "wrong_answer",
  "language": "python",
  "problem": {
    "title": "Two Sum",
    "description": "...",
    "difficulty": "Easy",
    "category": "Array",
    "constraints": "1 <= n <= 10^5",
    "expected_approach": "Hash Map"
  },
  "problem_category": "Array",
  "user_history": "Solved 45 problems, 60% acceptance rate...",
  "previous_attempts": [{ "verdict": "wrong_answer", "timestamp": "..." }]
}
```

**Response (V3.0 Polymorphic):**

```json
{
  "success": true,
  "verdict": "wrong_answer",
  "submission_id": "sub_abc123",

  "hints": [
    {
      "level": 1,
      "content": "Think about edge cases...",
      "hint_type": "conceptual"
    },
    {
      "level": 2,
      "content": "What happens when array is empty?",
      "hint_type": "specific"
    },
    { "level": 3, "content": "Check your loop bounds", "hint_type": "approach" }
  ],

  "explanation": "Your solution fails because...",
  "detected_pattern": "Off-by-one error in array iteration",

  "mim_insights": {
    "feedback_type": "correctness",

    "correctness_feedback": {
      "root_cause": "correctness",
      "subtype": "off_by_one",
      "failure_mechanism": "Loop iterates one element too few",
      "confidence": 0.87,
      "is_recurring": true,
      "recurrence_count": 3,
      "fix_direction": "Change < to <= in loop condition",
      "related_problems": ["prob_123", "prob_456"]
    },

    "root_cause": {
      "failure_cause": "off_by_one",
      "confidence": 0.87
    },
    "readiness": {
      "current_level": "Medium",
      "easy_readiness": 0.95,
      "medium_readiness": 0.72,
      "hard_readiness": 0.35
    },
    "is_cold_start": false,
    "model_version": "mim-v3.2"
  },

  "feedback_type": "error_feedback"
}
```

### Other Endpoints

| Method | Endpoint                        | Description             |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/health`                       | Service health check    |
| GET    | `/health/llm`                   | LLM provider status     |
| GET    | `/ai/rag-stats/{user_id}`       | RAG usage statistics    |
| GET    | `/ai/profile/{user_id}`         | Get cognitive profile   |
| GET    | `/ai/recommendations/{user_id}` | Problem recommendations |
| POST   | `/ai/report/weekly`             | Generate weekly report  |
| GET    | `/mim/status`                   | MIM model status        |
| POST   | `/mim/predict`                  | Direct MIM prediction   |

---

## 🔄 Workflow Pipeline

### Sync Workflow (User-Facing)

```python
# graph/sync_workflow.py

SYNC_TOTAL_BUDGET_SECONDS = 60  # Quality-first, no skipping

def create_sync_workflow():
    """
    Synchronous workflow for immediate user feedback.

    Pipeline:
    1. MIM Decision Node (diagnostic predictions)
    2. RAG Retrieval (user memory)
    3. Feedback Agent (LLM explanation)
    4. Hint Agent (progressive hints)
    """

    workflow = StateGraph(WorkflowState)

    # Add nodes
    workflow.add_node("mim_decision", mim_decision_node)
    workflow.add_node("rag_retrieval", rag_retrieval_node)
    workflow.add_node("feedback_agent", feedback_agent_node)
    workflow.add_node("hint_agent", hint_agent_node)

    # Define edges
    workflow.add_edge(START, "mim_decision")
    workflow.add_edge("mim_decision", "rag_retrieval")
    workflow.add_edge("rag_retrieval", "feedback_agent")
    workflow.add_edge("feedback_agent", "hint_agent")
    workflow.add_edge("hint_agent", END)

    return workflow.compile()
```

### Async Workflow (Background)

```python
# graph/async_workflow.py

def create_async_workflow():
    """
    Background workflow for non-blocking updates.

    Tasks:
    1. Store feedback in RAG memory
    2. Update user cognitive profile
    3. Compute difficulty adjustments
    4. Generate pattern insights
    """

    workflow = StateGraph(AsyncWorkflowState)

    workflow.add_node("store_memory", store_user_memory_node)
    workflow.add_node("update_profile", update_cognitive_profile_node)
    workflow.add_node("compute_difficulty", compute_difficulty_node)
    workflow.add_node("detect_patterns", detect_patterns_node)

    # Parallel execution where possible
    workflow.add_edge(START, "store_memory")
    workflow.add_edge(START, "update_profile")
    workflow.add_edge("update_profile", "compute_difficulty")
    workflow.add_edge("compute_difficulty", "detect_patterns")
    workflow.add_edge("store_memory", END)
    workflow.add_edge("detect_patterns", END)

    return workflow.compile()
```

### Guardrails

```python
# guardrails/verdict_guards.py

class VerdictGuard:
    """
    Optimizes pipeline based on verdict type.
    """

    @staticmethod
    def check(verdict: str, difficulty: str, has_user_history: bool) -> VerdictCheck:

        if verdict == "accepted":
            return VerdictCheck(
                skip_mim=False,          # Still analyze for reinforcement
                skip_rag=True,           # No need for mistake memory
                skip_hint=True,          # No hints needed
                use_success_path=True,   # Optimization feedback
                create_reinforcement=True
            )

        elif verdict in ("compile_error", "runtime_error"):
            return VerdictCheck(
                skip_mim=True,           # Obvious error, no diagnosis needed
                skip_rag=True,
                skip_hint=False,
                use_success_path=False,
                create_reinforcement=False
            )

        else:  # wrong_answer, tle, mle
            return VerdictCheck(
                skip_mim=False,
                skip_rag=False,
                skip_hint=False,
                use_success_path=False,
                create_reinforcement=False
            )
```

---

## 🤖 LLM Agents

### Agent Architecture

```python
# agents/base_json_agent.py

class BaseJSONAgent:
    """
    Base class for all LLM agents.
    Enforces JSON output and MIM instruction compliance.
    """

    def __init__(self, llm_provider: str = "groq"):
        self.llm = get_llm(provider=llm_provider)
        self.parser = JsonOutputParser()

    def invoke(self, mim_decision: MIMDecision, context: Dict) -> Dict:
        """
        Generate response based on MIM instructions.

        IMPORTANT: Agent CANNOT override MIM decisions.
        It only adds natural language polish.
        """
        prompt = self.build_prompt(mim_decision, context)
        response = self.llm.invoke(prompt)
        return self.parser.parse(response)
```

### Feedback Agent

````python
# agents/feedback_agent.py

class FeedbackAgent(BaseJSONAgent):
    """
    Generates detailed explanations for submission feedback.

    Receives from MIM:
    - root_cause (MUST use, cannot guess different)
    - root_cause_subtype
    - failure_mechanism
    - fix_direction

    Adds:
    - Natural language explanation
    - Code-specific examples
    - Learning suggestions
    """

    def build_prompt(self, mim_decision: MIMDecision, context: Dict) -> str:
        return f"""
        You are an expert programming tutor. Generate feedback for this submission.

        CRITICAL INSTRUCTION FROM MIM (DO NOT OVERRIDE):
        - Root Cause: {mim_decision.root_cause}
        - Subtype: {mim_decision.feedback_instruction.root_cause_subtype}
        - Confidence: {mim_decision.root_cause_confidence:.0%}

        PROBLEM: {context['problem']['title']}
        VERDICT: {context['verdict']}
        CODE:
        ```{context['language']}
        {context['code']}
        ```

        USER HISTORY:
        {context.get('user_history', 'No history available')}

        Generate a helpful explanation that:
        1. Uses the MIM-identified root cause (DO NOT guess a different cause)
        2. Points to specific code issues
        3. Suggests how to fix without giving the solution
        """
````

### Hint Agent

```python
# agents/hint_agent.py

class HintAgent(BaseJSONAgent):
    """
    Generates progressive hints (conceptual → specific → solution).
    """

    HINT_TYPES = ["conceptual", "specific", "approach", "solution"]

    def generate_hints(self, mim_decision: MIMDecision, context: Dict) -> List[Dict]:
        hints = []

        for level, hint_type in enumerate(self.HINT_TYPES, 1):
            hint = self.generate_single_hint(
                level=level,
                hint_type=hint_type,
                mim_decision=mim_decision,
                context=context
            )
            hints.append({
                "level": level,
                "content": hint,
                "hint_type": hint_type
            })

        return hints
```

---

## 📊 MIM Classifier Configuration

### Feature Engineering

```python
# mim/feature_extractor.py

def extract_features(submission: Dict, user_state: Dict, problem: Dict) -> np.ndarray:
    """
    Extract features for MIM prediction.

    Features:
    - Code complexity metrics (LOC, cyclomatic complexity)
    - User performance history
    - Problem characteristics
    - Submission patterns
    """

    features = []

    # Code features
    features.extend([
        len(submission['code'].split('\n')),        # Lines of code
        count_loops(submission['code']),            # Loop count
        count_conditionals(submission['code']),     # If/else count
        estimate_complexity(submission['code']),    # Big-O estimate
    ])

    # User features
    features.extend([
        user_state.get('total_submissions', 0),
        user_state.get('acceptance_rate', 0.5),
        user_state.get('avg_attempts_per_problem', 2),
        user_state.get('category_accuracy', {}).get(problem['category'], 0.5),
    ])

    # Problem features
    features.extend([
        {'Easy': 0, 'Medium': 1, 'Hard': 2}[problem['difficulty']],
        len(problem.get('tags', [])),
        problem.get('acceptance_rate', 50) / 100,
    ])

    # Delta features (vs previous attempts)
    features.extend([
        submission.get('attempt_number', 1),
        submission.get('time_since_last_attempt', 0),
        submission.get('code_change_ratio', 1.0),
    ])

    return np.array(features).reshape(1, -1)
```

### Training Pipeline

```python
# mim/training/train_models.py

def configure_mim_classifiers(training_data: pd.DataFrame):
    """
    Configure MIM classifiers from labeled submission data.
    """

    # 1. Prepare features and labels
    X = extract_all_features(training_data)
    y_root_cause = training_data['root_cause_label'].values
    y_subtype = training_data['subtype_label'].values

    # 2. Configure root cause classifier
    root_cause_model = build_root_cause_classifier(
        features=X,
        labels=y_root_cause,
        class_weight='balanced'
    )

    # 3. Configure subtype classifiers (one per root cause)
    subtype_models = {}
    for root_cause in ROOT_CAUSES:
        mask = y_root_cause == root_cause
        if mask.sum() > 100:  # Enough samples
            subtype_models[root_cause] = build_subtype_classifier(
                X[mask], y_subtype[mask]
            )

    # 4. Evaluate
    metrics = evaluate_models(root_cause_model, subtype_models, X, y_root_cause, y_subtype)

    # 5. Save classifiers
    save_models(root_cause_model, subtype_models, metrics)

    return metrics
```

---

## 🔍 RAG (Retrieval-Augmented Generation)

### Vector Store

```python
# rag/vector_store.py

from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# Initialize embeddings
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Initialize vector store
user_memory_store = Chroma(
    collection_name="user_mistakes",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)
```

### Memory Retrieval

```python
# rag/retriever.py

def retrieve_user_memory(user_id: str, query: str, k: int = 3) -> List[str]:
    """
    Retrieve relevant past mistakes for context.
    """

    results = user_memory_store.similarity_search_with_relevance_scores(
        query=query,
        k=k,
        filter={"user_id": user_id}
    )

    # Filter by relevance threshold
    relevant = [(doc, score) for doc, score in results if score > 0.5]

    return [doc.page_content for doc, _ in relevant]


def store_user_feedback(user_id: str, problem_id: str, category: str, mistake_summary: str):
    """
    Store mistake in vector store for future retrieval.
    """

    doc = Document(
        page_content=f"[{category}] Problem {problem_id}: {mistake_summary}",
        metadata={
            "user_id": user_id,
            "problem_id": problem_id,
            "category": category,
            "timestamp": int(time.time())
        }
    )

    user_memory_store.add_documents([doc])
```

---

## 👤 User State Tracking

```python
# user_model/state_tracker.py

class UserStateTracker:
    """
    Tracks user learning state across submissions.
    """

    def __init__(self, mongodb_client):
        self.db = mongodb_client

    def get_user_state(self, user_id: str) -> Dict:
        """
        Get current user state from submission history.
        """
        history = self.db.get_user_submissions(user_id, limit=100)

        state = {
            "total_submissions": len(history),
            "acceptance_rate": self._calc_acceptance_rate(history),
            "category_performance": self._calc_category_performance(history),
            "difficulty_performance": self._calc_difficulty_performance(history),
            "dominant_root_causes": self._get_dominant_root_causes(history),
            "recurring_patterns": self._detect_patterns(history),
            "current_streak": self._calc_streak(history),
            "skill_levels": self._estimate_skill_levels(history),
        }

        return state

    def update_state(self, user_id: str, submission: Dict, mim_decision: MIMDecision):
        """
        Update user state after submission.
        """
        self.db.add_submission_record(user_id, {
            "problem_id": submission["problem_id"],
            "verdict": submission["verdict"],
            "root_cause": mim_decision.root_cause,
            "category": submission["problem_category"],
            "difficulty": submission["problem_difficulty"],
            "timestamp": datetime.now()
        })
```

---

## 🔧 LLM Provider Configuration

```python
# services/llm.py

from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

# Rate limiting state
_groq_rate_limited_until = 0
_gemini_rate_limited_until = 0

def get_llm(provider: str = None):
    """
    Get LLM instance with automatic fallback.

    Priority: Groq (fast) → Gemini (backup)
    """

    if provider is None:
        provider = get_current_provider()

    if provider == "groq":
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            api_key=os.getenv("GROQ_API_KEY")
        )
    elif provider == "gemini":
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0.3,
            api_key=os.getenv("GOOGLE_API_KEY")
        )


def get_current_provider() -> str:
    """
    Determine which provider to use based on rate limits.
    """
    now = time.time()

    if now > _groq_rate_limited_until:
        return "groq"
    elif now > _gemini_rate_limited_until:
        return "gemini"
    else:
        # Both rate limited, wait for groq
        return "groq"
```

---

## 🧪 Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_mim.py -v

# Run with coverage
pytest --cov=app --cov-report=html

# Test MIM predictions
pytest tests/test_mim.py::test_root_cause_prediction -v
```

---

## 🚀 Running the Service

```bash
# Development
uvicorn main:app --reload --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# With specific log level
LOG_LEVEL=debug uvicorn main:app --reload
```

---

## 📊 Observability

### Structured Logging

```python
# All logs include trace_id for request tracking
{
    "timestamp": "2026-01-27T10:00:00Z",
    "trace_id": "abc123",
    "service": "ai-services",
    "level": "INFO",
    "event": "mim_prediction",
    "root_cause": "correctness",
    "confidence": 0.87,
    "latency_ms": 45
}
```

### Metrics

- `mim_prediction_latency_ms` - MIM inference time
- `llm_call_latency_ms` - LLM API call time
- `rag_retrieval_count` - Documents retrieved
- `root_cause_distribution` - Prediction breakdown
- `feedback_success_rate` - Successful responses

---

## 🔧 Environment Variables

```bash
# LLM Providers
GROQ_API_KEY=your-groq-key
GOOGLE_API_KEY=your-gemini-key

# Database
MONGODB_URI=mongodb://localhost:27017/mentat

# Vector Store
CHROMA_PERSIST_DIR=./chroma_db

# Model Settings
MIM_MODEL_VERSION=v3.2
MIM_CONFIDENCE_THRESHOLD=0.5

# Logging
LOG_LEVEL=INFO
```
