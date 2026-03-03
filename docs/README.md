# Building an AI-Powered Learning System for Competitive Programming: A Deep Dive into Arrakis Lab's AI Architecture

When we set out to build Arrakis Lab, our competitive programming platform, we had one clear goal: transform failed submissions from dead ends into structured learning opportunities. The challenge wasn't just building another online judge—it was creating an AI system that could consistently provide actionable feedback without hallucinating or contradicting itself.

Here's how we architected the AI services that power our platform's learning engine.

## The Philosophy: Decision Layer + Agent Layer + Memory

Most AI-powered educational tools make the mistake of giving large language models too much responsibility. They ask the LLM to both diagnose what went wrong AND explain it, leading to inconsistent feedback where the same mistake gets different explanations on different days.

We took a different approach: **separation of concerns**.

```
┌─────────────────────────────────────────────────────────────┐
│                    DECISION LAYER                           │
│              (Deterministic + Rules-Based)                  │
│   ✓ What kind of failure is this?                          │
│   ✓ Is this a recurring pattern?                           │
│   ✓ Should difficulty increase/decrease/maintain?           │
│   ✓ What focus areas need attention?                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     AGENT LAYER                             │
│                  (LLM-Powered Explanation)                  │
│   ✓ Turn decisions into readable explanations               │
│   ✓ Generate progressive hints                              │
│   ✓ Create learning recommendations                         │
│   ✓ Build weekly progress reports                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY LAYER                             │
│                 (RAG + Vector Storage)                      │
│   ✓ Store successful recognitions for consistency           │
│   ✓ Retrieve relevant past mistakes for context            │
│   ✓ Quality-gate memories to prevent noise                 │
└─────────────────────────────────────────────────────────────┘
```

The decision layer produces authoritative diagnoses. The agents explain them in human language. The memory layer ensures consistency over time.

## The Decision Engine: MIM (Mistake Inference Model)

At the heart of our system is what we call MIM—the Machine Intelligence Model. The core philosophy is **deterministic reasoning** — structured heuristic classifiers and rule engines make every diagnostic decision.

### Root Cause Taxonomy

Every submission failure gets classified into one of four root causes:

```python
ROOT_CAUSES = {
    "correctness",        # Logic produces wrong outputs
    "efficiency",         # Too slow or memory-heavy
    "implementation",     # Correct approach, buggy code
    "understanding_gap",  # Misunderstood the problem
}
```

Each root cause then gets refined into specific subtypes:

```python
SUBTYPE_DESCRIPTIONS = {
    "wrong_invariant": "Loop or recursion invariant does not hold",
    "incorrect_boundary": "Start/end conditions are wrong (off-by-one, inclusive/exclusive)",
    "partial_case_handling": "Some valid input cases are not handled",
    "state_loss": "Critical state not preserved across calls/iterations",
    "brute_force_under_constraints": "Solution complexity exceeds what constraints allow",
    "premature_optimization": "Optimized code that doesn't solve the problem correctly",
    "misread_constraint": "Constraint value or meaning was misunderstood",
}
```

### Pattern Detection Engine

The system tracks recurring mistakes through a state machine:

```
NONE → SUSPECTED → CONFIRMED → STABLE
```

When the same mistake pattern appears multiple times, it transitions through these states. A "CONFIRMED" pattern triggers different coaching strategies than a first-time mistake.

### Difficulty Policy Engine

Based on the diagnosis and pattern state, the system decides what to do with problem difficulty:

```python
DIFFICULTY_ACTIONS = {
    "increase": "User is ready for harder problems",
    "maintain": "Keep current difficulty level",
    "decrease": "Need to solidify fundamentals"
}
```

The key insight: **these decisions are rules-based, not predicted**. Same inputs always produce the same outputs, ensuring reliability.

## The Agent Architecture

Once the decision layer has made its authoritative diagnosis, four specialized agents transform this into human-readable guidance:

### 1. Feedback Agent

**Purpose**: Convert the technical diagnosis into a clear explanation of what went wrong.

**Input**: MIM decision + code snippet + problem context
**Output**: Structured explanation with failure mechanism and fix direction

The agent receives pre-computed facts like:

```json
{
  "root_cause": "correctness",
  "subtype": "incorrect_boundary",
  "failure_mechanism": "Array index or loop bound at line 15 is off by one",
  "confidence": 0.87,
  "focus_areas": ["Boundary condition handling", "Index arithmetic precision"]
}
```

And transforms it into readable feedback:

> "Your loop boundary condition is causing an off-by-one error. When iterating through the array, you're using `i < n` but accessing `arr[i+1]`, which goes beyond the array bounds on the final iteration. Consider what happens when `i` reaches `n-1`..."

### 2. Hint Agent

**Purpose**: Generate progressive hints that guide without spoiling.

**Strategy**: Three-tier progressive disclosure:

- **Conceptual**: "Think about what happens at the boundaries"
- **Specific**: "Check the first and last iterations of your loop"
- **Approach**: "Consider using `i <= n-2` or restructuring the access pattern"

The agent has instructions to avoid giving away the exact fix:

```python
HINT_DIRECTIONS = {
    "incorrect_boundary": {
        "direction": "Check what happens at the very first and very last elements",
        "avoid": ["off by one", "change <=", "boundary"]
    }
}
```

### 3. Learning Agent

**Purpose**: Recommend focused practice based on detected weaknesses.

**Modes**:

- **Diagnosis mode** (for failed submissions): Identifies skill gaps and suggests targeted exercises
- **Reinforcement mode** (for accepted submissions): Acknowledges success and recommends next challenges

The agent builds personalized learning paths:

```json
{
  "focus_areas": ["Boundary condition handling", "Edge case enumeration"],
  "rationale": "Pattern shows recurring off-by-one errors in array traversal problems",
  "skill_gap": "Array indexing precision",
  "exercises": [
    "Practice problems with inclusive/exclusive bounds",
    "Implement safe array utilities"
  ],
  "summary": "Focus on systematic boundary checking before coding"
}
```

### 4. Report Agent

**Purpose**: Generate weekly progress summaries on-demand.

Synthesizes a week's worth of submissions into:

- **Strengths**: Concepts you've mastered
- **Improvement Areas**: Patterns needing attention
- **Recurring Patterns**: Specific mistakes to watch for
- **Progress Trends**: Are you improving in targeted areas?

## The RAG Memory System

The Retrieval-Augmented Generation (RAG) system ensures feedback consistency by maintaining a personalized memory store for each user.

### Memory Storage Strategy

When a submission receives AI feedback, the system decides whether to store it in long-term memory based on quality scoring:

```python
class MemoryQualityScorer:
    STORAGE_THRESHOLD = 0.6  # Minimum quality to store

    WEIGHTS = {
        "mim_confidence": 0.35,      # How confident was the diagnosis?
        "pattern_recurrence": 0.25,   # Is this a validated pattern?
        "content_completeness": 0.25, # Does it have full context?
        "user_feedback": 0.15,       # Did user find it helpful?
    }
```

Only high-quality memories get stored, preventing the accumulation of noise.

### Memory Retrieval Process

When generating new feedback, the system retrieves relevant past mistakes:

1. **Query Building**: Constructs search queries from the current problem context and detected failure type
2. **Vector Search**: Uses embedding similarity to find related past mistakes
3. **Relevance Filtering**: Applies quality gates to ensure retrieved memories are actually helpful
4. **Context Assembly**: Incorporates past mistakes into current feedback for consistency

This ensures that if you made the same mistake three months ago, the current feedback acknowledges that history and builds on previous explanations.

### Vector Store Architecture

We use Pinecone for production-grade vector storage:

```python
class PineconeVectorStore:
    def similarity_search_with_relevance_scores(
        self,
        query: str,
        k: int = 5,
        namespace: str = "user_memory",
        metadata_filter: Optional[Dict] = None
    ) -> List[Tuple[str, float]]:
        # Retrieve similar past mistakes with relevance scores
        # Apply quality filtering
        # Return contextualized memories
```

Each memory document includes:

- **Content**: The explanation or insight
- **Metadata**: Root cause, subtype, problem category, timestamp
- **Quality Score**: Computed relevance and usefulness metrics
- **User Context**: Problem-solving history and pattern state

## Workflow Orchestration: Sync vs Async

The AI system runs two parallel workflows to balance responsiveness with thoroughness:

### Sync Workflow (User-Facing, <10 seconds)

**Purpose**: Provide immediate feedback that doesn't block the user.

**Pipeline**:

1. **Memory Retrieval**: Fetch relevant past mistakes (8s budget)
2. **MIM Decision**: Run diagnosis engine (3s budget)
3. **Feedback Agent**: Generate explanation (20s budget)
4. **Hint Agent**: Create progressive hints (8s budget)

**Quality-First Design**: All agents must complete. If an agent times out, it returns a fallback response rather than failing silently.

### Async Workflow (Background Processing)

**Purpose**: Handle expensive operations that improve future interactions.

**Pipeline**:

1. **Learning Agent**: Generate personalized recommendations (45s budget)
2. **Memory Storage**: Persist high-quality feedback to RAG store (15s budget)
3. **Profile Updates**: Update user skill assessments and patterns (background)
4. **Report Generation**: Build weekly progress reports when requested (45s budget)

The async workflow never affects response latency—it runs after the user receives their immediate feedback.

### Orchestration Logic

```python
def orchestrator_node(state: Dict) -> Dict:
    verdict = state.get("verdict", "").lower()

    # Sync agents (user-facing)
    run_feedback = True  # Always run primary agent
    run_hint = not (verdict == "accepted")  # Skip hints for successful submissions

    # Async agents (background)
    run_learning = True  # Always run, but mode differs by verdict
    run_memory_storage = True  # Always persist quality feedback

    return {
        "sync_plan": {"feedback": run_feedback, "hint": run_hint},
        "async_plan": {"learning": run_learning, "storage": run_memory_storage}
    }
```

## Guardrails and Quality Control

### Idempotency Protection

The system prevents duplicate processing of the same submission:

```python
def _check_and_mark_processed(submission_id: str) -> bool:
    """Prevent duplicate async processing for same submission."""
    if submission_id in _processed_submissions:
        logger.warning(f"Submission {submission_id} already processed - SKIPPING")
        return True
    _processed_submissions.add(submission_id)
    return False
```

### Verdict Guards

Different submission outcomes trigger different processing strategies:

```python
class VerdictGuard:
    @staticmethod
    def get_guardrails(verdict: str) -> Dict[str, bool]:
        if verdict == "accepted":
            return {
                "skip_mim": False,      # Still analyze for reinforcement
                "skip_rag": True,       # No need for failure history
                "skip_hint": True,      # No hints needed for success
                "skip_learning_diagnosis": True  # Use reinforcement mode
            }
        return {"skip_mim": False, "skip_rag": False, "skip_hint": False}
```

### Agent Input Standardization

All agents receive the same structured input to ensure consistency:

```python
@dataclass
class AgentInput:
    # MIM decisions (authoritative)
    root_cause: Optional[str]
    subtype: Optional[str]
    failure_mechanism: Optional[str]
    confidence: float

    # Pattern context
    pattern_state: Optional[str]  # none, suspected, confirmed, stable
    recurrence_count: int

    # RAG context
    relevant_memories: List[str]
    memory_query: str

    # Code context (truncated for efficiency)
    code_snippet: str  # First 500 chars
    problem_description: str  # First 500 chars
```

## API Design and Integration

### Feedback Endpoint

The main AI feedback endpoint follows a clean request/response pattern:

```python
@router.post("/ai/feedback")
def request_feedback(payload: SubmissionContext) -> AIFeedbackDTO:
    """
    Generate AI feedback for a code submission.

    Returns structured feedback with:
    - Progressive hints (ordered from vague to specific)
    - Full explanation (expandable)
    - Pattern detection results
    - MIM diagnostic insights
    """
```

**Response Structure**:

```json
{
  "success": true,
  "verdict": "wrong_answer",
  "submission_id": "sub_123",
  "hints": [
    {
      "level": 1,
      "content": "Consider edge cases...",
      "hint_type": "conceptual"
    },
    {
      "level": 2,
      "content": "What happens with empty input?",
      "hint_type": "specific"
    }
  ],
  "explanation": "Your algorithm fails when the input array is empty...",
  "detected_pattern": "boundary_condition_oversight",
  "mim_insights": {
    "root_cause": { "failure_cause": "incorrect_boundary", "confidence": 0.85 },
    "pattern_state": "suspected",
    "focus_areas": ["Boundary handling", "Edge case enumeration"]
  }
}
```

### Weekly Report Endpoint

```python
@router.post("/ai/weekly-report")
def generate_weekly_report(payload: SubmissionContext) -> Dict[str, Any]:
    """
    On-demand weekly progress report generation.

    Analyzes recent submissions and generates:
    - Strength areas and improvement opportunities
    - Recurring mistake patterns
    - Learning recommendations
    - Progress trends
    """
```

### Health and Monitoring

```python
@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Mentat Trials AI Service",
        "timestamp": "2024-01-15T10:30:00Z",
        "version": "3.0.0"
    }

@router.get("/health/llm")
def llm_health_check():
    """Check LLM provider rate limits and availability."""
    return get_rate_limit_status()
```

## Error Handling and Resilience

### Graceful Degradation

When components fail, the system provides reduced functionality rather than complete failure:

```python
def _run_with_timeout(func, args, timeout_seconds: float, fallback, agent_name: str):
    """Execute function with timeout, return fallback on failure."""
    try:
        future = executor.submit(func, *args)
        return future.result(timeout=timeout_seconds)
    except TimeoutError:
        logger.warning(f"{agent_name} TIMEOUT - returning fallback")
        return fallback
    except Exception as e:
        logger.error(f"{agent_name} ERROR: {e} - returning fallback")
        return fallback
```

### Structured Logging

All operations are traced with structured JSON logs:

```python
class StructuredLogger:
    def info(self, event: str, **kwargs):
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "trace_id": trace_id_var.get(),
            "service": "ai-services",
            "level": "INFO",
            "event": event,
            **kwargs
        }
        self.logger.info(str(log_entry))
```

This enables debugging across the distributed system and monitoring of agent performance.

## Performance and Scalability Considerations

### Caching Strategy

```python
class AgentCache:
    def get_cached_response(
        self,
        cache_key: str,
        ttl_seconds: int = 3600
    ) -> Optional[Dict]:
        """Retrieve cached agent response if still valid."""

    def cache_response(
        self,
        cache_key: str,
        response: Dict,
        ttl_seconds: int = 3600
    ) -> None:
        """Store agent response with expiration."""
```

Common feedback patterns get cached to reduce LLM API calls while maintaining personalization through cache key construction.

### Embedding Model Optimization

```python
# Eager initialization prevents per-request model loading
print("🧠 Pre-loading embedding model (one-time initialization)...")
try:
    from app.rag.embeddings import get_embeddings
    embeddings = get_embeddings()
    _ = embeddings.embed_query("initialization test")  # Force model load
    print("✅ Embedding model loaded and ready")
except Exception as e:
    print(f"⚠️ Embedding model pre-load failed: {e}")
```

The embedding model loads once at startup rather than per request to eliminate cold start latency.

## Deployment and Configuration

### Environment Configuration

```python
# Production-ready CORS setup
def get_allowed_origins():
    origins = ["http://localhost:5173"]  # Dev defaults

    # Add production URLs
    if frontend_url := os.getenv("FRONTEND_URL"):
        origins.append(frontend_url)

    # Parse additional origins
    if extra_origins := os.getenv("ALLOWED_ORIGINS"):
        origins.extend(o.strip() for o in extra_origins.split(","))

    return list(set(origins))
```

### Request Tracing

```python
@app.middleware("http")
async def tracing_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4())[:8])
    trace_id_var.set(trace_id)

    # Log and time all requests
    start_time = time.time()
    response = await call_next(request)
    elapsed = time.time() - start_time

    response.headers["X-Trace-ID"] = trace_id
    return response
```

Every request gets a trace ID for debugging across the distributed system.

## Lessons Learned and Future Directions

### What Worked Well

1. **Separation of Concerns**: Splitting decision-making from explanation prevents inconsistent feedback
2. **Quality Gates**: Not all feedback is worth storing; quality scoring prevents memory pollution
3. **Progressive Hints**: Three-tier hint system guides learning without spoiling solutions
4. **Async Processing**: Background workflows improve future interactions without affecting response time

### Areas for Improvement

1. **Confidence Calibration**: Better uncertainty quantification for edge cases
2. **Multi-Modal Input**: Incorporating problem-solving drawings or thought processes
3. **Collaborative Learning**: Leveraging anonymized patterns across users
4. **Real-Time Adaptation**: Dynamic adjustment based on user feedback loops

### Architecture Evolution

The system evolved from a monolithic "ask LLM everything" approach to the current layered architecture through several iterations:

1. **v1.0**: Direct LLM prompting (inconsistent, expensive)
2. **v2.0**: Rule-based classification + LLM explanation (better, but limited taxonomy)
3. **v3.0**: MIM decision engine + specialized agents + RAG memory (current)

Each iteration maintained backward compatibility while improving consistency and reducing hallucination.

## Conclusion

Building an AI system for educational feedback requires balancing multiple constraints: consistency, personalization, speed, and accuracy. By separating authoritative decision-making from natural language generation, we created a system that provides reliable guidance while remaining maintainable and debuggable.

The key insight was recognizing that AI doesn't have to be "smart" everywhere—it just needs to be smart in the right places. Deterministic rules handle the critical decisions, while LLMs handle what they do best: making technical concepts accessible through clear explanation.

The result is an AI service that turns every failed submission into a structured learning opportunity, helping developers build mental models rather than guess their way to solutions.

---

_The complete Arrakis Lab codebase is available at [https://github.com/AKASH-tech234/Arrakis-Labs](https://lnkd.in/eBrk3CVS), with the AI services implementation in the `/ai-services` directory._
