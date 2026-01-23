# AI Services Documentation

## Overview

The **AI Services** module is the core AI-powered backend for the Mentat Trials coding platform. It provides **intelligence-first**, in-depth feedback, pattern detection, learning recommendations, and difficulty adjustment for user code submissions using LangChain and Google's Gemini AI.

**Philosophy**: Quality over speed. All agents must complete successfully with full context to maximize learning value and pedagogical effectiveness.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Metrics & Capabilities](#key-metrics--capabilities)
3. [Intelligence-First Architecture (v2.0)](#intelligence-first-architecture-v20)
4. [Directory Structure](#directory-structure)
5. [Core Components](#core-components)
6. [API Endpoints](#api-endpoints)
7. [Agent System](#agent-system)
8. [Agent Coordination](#agent-coordination-v20)
9. [Caching Strategy](#caching-strategy)
10. [RAG (Retrieval-Augmented Generation)](#rag-retrieval-augmented-generation)
11. [Workflows](#workflows)
12. [Configuration](#configuration)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [API Usage Examples](#api-usage-examples)
16. [Troubleshooting](#troubleshooting)
17. [Contributing](#contributing)
18. [Version History](#version-history)

---

## Key Metrics & Capabilities

### Performance Profile (v2.0)

| Metric                  | Value       | Notes                                   |
| ----------------------- | ----------- | --------------------------------------- |
| **Response Time**       | 45-55s      | Intelligence-first design               |
| **Test Coverage**       | 102/102 ✅  | Core functionality fully tested         |
| **RAG Context**         | 7 documents | Up from 3 for richer analysis           |
| **Code Truncation**     | None        | Full code with line numbers             |
| **Agent Success Rate**  | 100%        | All agents complete, fallback on errors |
| **Concurrent Requests** | Async-ready | FastAPI with background tasks           |

### Intelligent Features

✅ **Comprehensive Feedback**

- Step-by-step reasoning
- Conceptual explanations
- Line-specific code references

✅ **Pattern Recognition**

- Recurring mistake detection
- Confidence scoring
- Historical pattern matching

✅ **Personalized Learning**

- User-specific recommendations
- Skill gap identification
- Progressive difficulty adjustment

✅ **Rich Context**

- Full problem constraints
- User history (7 most relevant)
- Complete code analysis

✅ **Progressive Hints**

- 3-level hint system
- Conceptual → Specific → Concrete
- Never reveals full solutions

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/Vite)                            │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ HTTP POST /ai/feedback
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI Application (main.py)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │  CORS Middleware│  │ Tracing Middleware│  │    Request Validation     │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘   │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            API Routes (routes.py)                             │
│  ┌──────────────┐  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │ /health      │  │ /ai/feedback       │  │ /ai/weekly-report           │   │
│  └──────────────┘  └────────────────────┘  └─────────────────────────────┘   │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
┌───────────────────────────────┐    ┌───────────────────────────────────────┐
│     SYNC WORKFLOW             │    │          ASYNC WORKFLOW               │
│  (User-facing, fast)          │    │     (Background processing)           │
│  ┌─────────────────────────┐  │    │  ┌─────────────────────────────────┐  │
│  │ • Memory Retrieval      │  │    │  │ • Learning Recommendations      │  │
│  │ • Problem Context       │  │    │  │ • Difficulty Adjustment         │  │
│  │ • User Profile          │  │    │  │ • Weekly Reports                │  │
│  │ • Feedback Generation   │  │    │  │ • Memory Storage                │  │
│  │ • Pattern Detection     │  │    │  └─────────────────────────────────┘  │
│  │ • Hint Generation       │  │    └───────────────────────────────────────┘
│  └─────────────────────────┘  │
└───────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AGENTS (LangChain + Gemini)                         │
│  ┌─────────────┐ ┌────────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │  Feedback   │ │ Pattern Detect │ │  Hint Agent  │ │  Learning Agent     │ │
│  └─────────────┘ └────────────────┘ └──────────────┘ └─────────────────────┘ │
│  ┌─────────────┐ ┌────────────────┐                                          │
│  │ Difficulty  │ │ Report Agent   │                                          │
│  └─────────────┘ └────────────────┘                                          │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
         ┌─────────────────┐ ┌─────────────┐ ┌───────────────────┐
         │   Redis Cache   │ │  ChromaDB   │ │    MongoDB        │
         │   (Responses)   │ │ (RAG Store) │ │ (User History)    │
         └─────────────────┘ └─────────────┘ └───────────────────┘
```

---

## Directory Structure

```
ai-services/
├── main.py                     # FastAPI application entry point
├── requirement.txt             # Python dependencies
├── pytest.ini                  # Test configuration
├── .env                        # Environment variables (not in git)
├── .gitignore
│
├── app/
│   ├── __init__.py
│   │
│   ├── api/
│   │   └── routes.py           # API endpoint definitions
│   │
│   ├── agents/                 # AI Agents (LangChain-based)
│   │   ├── base_json_agent.py  # Base agent with caching & error handling
│   │   ├── feedback_agent.py   # Code feedback generation
│   │   ├── hint_agent.py       # Hint compression
│   │   ├── pattern_detection_agent.py  # Mistake pattern detection
│   │   ├── learning_agent.py   # Learning recommendations
│   │   ├── difficulty_agent.py # Difficulty adjustment
│   │   ├── report_agent.py     # Weekly progress reports
│   │   └── context_compressor.py
│   │
│   ├── cache/                  # Caching layer
│   │   ├── redis_cache.py      # Redis-based caching (PRIMARY)
│   │   ├── agent_cache.py      # File-based caching (DEPRECATED)
│   │   └── cache_key.py        # Cache key generation
│   │
│   ├── db/
│   │   └── mongodb.py          # MongoDB client for user history
│   │
│   ├── graph/                  # LangGraph workflows
│   │   ├── sync_workflow.py    # Synchronous workflow
│   │   ├── async_workflow.py   # Asynchronous background workflow
│   │   ├── orchestrator.py     # Workflow decision logic
│   │   └── workflow.py         # Legacy workflow (deprecated)
│   │
│   ├── metrics/
│   │   └── agent_metries.py    # Agent performance metrics
│   │
│   ├── problem/
│   │   └── problem_repository.py  # Problem context fetching
│   │
│   ├── prompts/                # System prompts for agents
│   │   ├── feedback.py
│   │   ├── learning.py
│   │   ├── difficulty.py
│   │   └── report.py
│   │
│   ├── rag/                    # RAG components
│   │   ├── __init__.py
│   │   ├── vector_store.py     # ChromaDB vector stores
│   │   ├── embeddings.py       # Embedding model (Ollama)
│   │   ├── retriever.py        # Memory retrieval & storage
│   │   ├── context_builder.py  # Context construction
│   │   └── monitoring.py       # RAG quality monitoring
│   │
│   ├── schemas/                # Pydantic models
│   │   ├── submission.py       # SubmissionContext
│   │   ├── feedback.py         # FeedbackResponse
│   │   ├── hint.py             # CompressedHint
│   │   ├── pattern.py          # DetectedPattern
│   │   ├── learning.py         # LearningRecommendation
│   │   ├── difficulty.py       # DifficultyAdjustment
│   │   ├── report.py           # WeeklyProgressReport
│   │   └── user_profile.py     # UserProfile
│   │
│   ├── services/
│   │   └── llm.py              # LLM factory (Google Gemini)
│   │
│   ├── sync/
│   │   └── submission_sync.py  # Submission synchronization
│   │
│   └── user_profile/
│       └── profile_builder.py  # User profile construction
│
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── conftest.py             # Test fixtures
│   ├── test_cache.py
│   ├── test_agents.py
│   ├── test_routes.py
│   ├── test_rag.py
│   ├── test_user_profile.py
│   ├── test_problem_repository.py
│   ├── test_workflows.py
│   └── test_services.py
│
└── vector_db/                  # ChromaDB persistence
    ├── user_memory/
    └── problem_knowledge/
```

---

## Core Components

### 1. FastAPI Application (`main.py`)

The main entry point that:

- Configures CORS for frontend communication
- Sets up request tracing middleware
- Registers API routes
- Provides structured JSON logging

### API Routes (`app/api/routes.py`)

| Endpoint                  | Method | Description                              | Timeout |
| ------------------------- | ------ | ---------------------------------------- | ------- |
| `/health`                 | GET    | Health check                             | -       |
| `/ai/feedback`            | POST   | Generate AI feedback for code submission | **65s** |
| `/ai/weekly-report`       | POST   | Generate weekly progress report          | 30s     |
| `/ai/rag-stats/{user_id}` | GET    | Get RAG statistics for debugging         | -       |

**Timeout Update:** `/ai/feedback` timeout increased from 30s to **65s** to accommodate the 60s sync workflow budget plus overhead.

### 3. Schemas (`app/schemas/`)

Pydantic models for request/response validation:

```python
# SubmissionContext - Input from frontend
class SubmissionContext(BaseModel):
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: Optional[str]

# FeedbackResponse - Agent output
class FeedbackResponse(BaseModel):
    explanation: str
    improvement_hint: str
    detected_pattern: Optional[str]
```

---

## Agent System

All agents extend the base JSON agent pattern defined in `base_json_agent.py`:

### Base JSON Agent

```python
def run_json_agent(
    context: str,           # Input context
    cache_key: str,         # Redis cache key
    schema: Type,           # Pydantic output schema
    system_prompt: str,     # Agent-specific prompt
    fallback,               # Fallback response on error
    agent_name: str         # For logging/metrics
) -> schema
```

Features:

- **Redis Caching**: Responses are cached to reduce LLM costs
- **Automatic Retries**: Uses correction prompts on parse failures
- **Fallback Responses**: Returns graceful fallback on errors
- **Metrics Recording**: Tracks agent performance

### Available Agents

| Agent                     | Purpose                               | Caching              |
| ------------------------- | ------------------------------------- | -------------------- |
| `feedback_agent`          | Analyze code and provide feedback     | ❌ Non-deterministic |
| `hint_agent`              | Compress hints to actionable guidance | ❌ Non-deterministic |
| `pattern_detection_agent` | Detect recurring mistake patterns     | ✅ Cached            |
| `learning_agent`          | Recommend learning areas              | ✅ Cached            |
| `difficulty_agent`        | Suggest difficulty adjustment         | ✅ Cached            |
| `report_agent`            | Generate weekly reports               | ✅ Cached            |

---

## Caching Strategy

### Redis Cache (Primary)

Location: `app/cache/redis_cache.py`

```python
# Configuration
REDIS_URL = os.getenv("REDIS_URL")  # e.g., redis://localhost:6379/0
DEFAULT_TTL = 3600  # 1 hour

# Usage
redis_cache.get(agent_name, cache_key)
redis_cache.set(agent_name, cache_key, value, ttl=7200)
redis_cache.invalidate_user(user_id)
```

### Cache Key Generation

Location: `app/cache/cache_key.py`

Cache keys are generated from:

- Agent name
- User ID
- Problem ID
- Problem category
- Verdict
- Code hash

```python
cache_key = build_cache_key("feedback_agent", payload)
# Returns: SHA256 hash of stable payload
```

### Deprecated: File-based Cache

The file-based cache in `agent_cache.py` is **deprecated**. All new code should use Redis caching.

---

## RAG (Retrieval-Augmented Generation)

### Vector Stores (`app/rag/vector_store.py`)

Uses ChromaDB with Ollama embeddings:

```python
# User memory store - stores mistake patterns
user_memory_store = Chroma(
    collection_name="user_memory",
    persist_directory="./vector_db/user_memory"
)

# Problem knowledge store - stores problem-specific data
problem_knowledge_store = Chroma(
    collection_name="problem_knowledge",
    persist_directory="./vector_db/problem_knowledge"
)
```

### Memory Retrieval (`app/rag/retriever.py`)

**Enhanced with k=7 for richer context:**

```python
# Retrieve relevant memories with higher k
memories = retrieve_user_memory(
    user_id="user_123",
    query="array problem edge cases",
    k=7  # Increased from 3
)

# Store ALL submissions with comprehensive metadata
store_user_feedback(
    user_id="user_123",
    problem_id="prob_001",
    category="Array",
    mistake_summary="Verdict: wrong_answer | Analysis: ... | Learning: ... | Difficulty: ..."
)
```

**Future Enhancement (Planned):**
Return relevance scores with chunks for better transparency.

### Context Building (`app/rag/context_builder.py`)

**Intelligence-First Philosophy: Full context, no truncation**

```python
def build_context(
    submission: SubmissionContext,
    user_memory: Optional[List[str]] = None,
    problem_knowledge: Optional[List[str]] = None,
    problem_context: Optional[Dict[str, Any]] = None,
    user_profile: Optional[Dict[str, Any]] = None,
    include_full_code: bool = True,  # NEW: Default to full code
) -> str
```

Builds structured context for agents including:

1. **Problem Definition** - Title, difficulty, tags, expected approach, constraints
2. **User Profile & History** - Recurring mistakes, weak topics, patterns, success rate
3. **Historical Submissions** (RAG Retrieved) - 5 most relevant chunks
4. **Current Submission** - Language, verdict, error type, **FULL CODE WITH LINE NUMBERS**
5. **Analysis Instructions** - Data quality flags, mandatory steps, output requirements

**Key Features:**

- ✅ **Full code with line numbers** - Enables precise reference (e.g., "Line 42")
- ✅ **No truncation** - Was 4000 chars, now unlimited
- ✅ **Structured sections** - Clearly delimited with box drawing characters
- ✅ **Data quality flags** - Indicates if problem/user data is available

**Example Code Format:**

````python
USER CODE:
```cpp
   1 | #include <iostream>
   2 | using namespace std;
   3 |
   4 | int main() {
   5 |     // User's code here
   6 | }
````

(Total: 6 lines, 87 characters)

```

---

## Workflows

### Design Philosophy: Intelligence-First

**Key Principles:**
- ✅ **All agents MUST complete** - No skipping due to budget constraints
- ✅ **Full context, no truncation** - Complete code with line numbers for accurate analysis
- ✅ **Agent coordination** - Results shared between agents for coherent outputs
- ✅ **Comprehensive memory** - ALL submissions stored with full metadata
- ✅ **Quality over speed** - 60s budget allows thorough analysis

### Sync Workflow (User-facing)

Location: `app/graph/sync_workflow.py`

**Budget: 60 seconds total** (generous allocations per agent)

Executes sequentially for immediate response:

```

retrieve_memory (k=7) → retrieve_problem → build_user_profile → orchestrator
→ build_context (FULL CODE) → feedback (30s) → pattern_detection (25s) → hint (20s) → END

````

**Key Changes:**
- **RAG_RETRIEVAL_K = 7** (increased from 3 for richer context)
- **No budget-based skipping** - All agents complete regardless of time
- **Agent coordination via `agent_results` dict** - Hint agent references feedback & patterns
- **Full code inclusion** - No 4000 char truncation
- **`_log_budget_status()`** replaced `_check_budget()` - Logs but never skips

**Time Budgets:**
```python
SYNC_TOTAL_BUDGET_SECONDS = 60.0  # Was 10s
SYNC_AGENT_BUDGETS = {
    "retrieve_memory": 10.0,
    "build_user_profile": 5.0,
    "feedback_agent": 30.0,      # Most critical
    "pattern_detection": 25.0,
    "hint_agent": 20.0,
}
````

**State Structure:**

```python
class MentatSyncState(TypedDict):
    # ... existing fields ...
    agent_results: Dict[str, Any]        # NEW: Cross-agent coordination
    pattern_confidence: float            # NEW: For hint agent reference
    user_memory_with_scores: List[Dict]  # NEW: Relevance scores
```

### Async Workflow (Background)

Location: `app/graph/async_workflow.py`

**Philosophy: ALL agents MUST run** - No skip conditions

Runs after sync workflow returns:

```
learning (ALWAYS) → difficulty (ALWAYS) → weekly_report → store_memory (ALWAYS) → END
```

**Key Changes:**

- **Learning agent ALWAYS runs** - Even for accepted submissions (recommends optimizations)
- **Difficulty agent ALWAYS runs** - No skip conditions based on verdict
- **Store memory ALWAYS runs** - Every submission stored with comprehensive metadata
- **Agent coordination** - Learning results inform difficulty decisions

**Time Budgets:**

```python
ASYNC_AGENT_BUDGETS = {
    "learning_agent": 45.0,    # MUST COMPLETE
    "difficulty_agent": 30.0,  # MUST COMPLETE
    "weekly_report": 45.0,
    "store_memory": 15.0,      # ALWAYS STORE
}
```

**Store Memory Enhancement:**
Stores ALL submissions with:

- Verdict and problem metadata
- Feedback explanation and pattern
- Learning recommendations
- Difficulty adjustments

### Orchestrator

Location: `app/graph/orchestrator.py`

Decides which agents run based on verdict:

| Verdict               | SYNC Agents                       | ASYNC Agents         |
| --------------------- | --------------------------------- | -------------------- |
| `Accepted`            | feedback only                     | learning, difficulty |
| `wrong_answer`        | feedback, pattern_detection, hint | learning, difficulty |
| `time_limit_exceeded` | feedback, pattern_detection, hint | learning, difficulty |
| `runtime_error`       | feedback, pattern_detection, hint | learning, difficulty |

**Note:** Once orchestrator enables an agent, it **MUST complete** - no budget-based skipping.

---

## Agent Coordination (v2.0)

### Cross-Agent State Sharing

Agents now coordinate via shared `agent_results` dictionary:

```python
# In sync_workflow.py
state["agent_results"] = {
    "feedback": feedback_result,
    "pattern": pattern_result,
    "pattern_confidence": 0.95
}

# Hint agent uses previous results
augmented_context = state["context"]
if state["agent_results"].get("feedback"):
    augmented_context += f"\nPREVIOUS FEEDBACK: {feedback.explanation}"
if state["agent_results"].get("pattern"):
    augmented_context += f"\nDETECTED PATTERN: {pattern} (confidence: {confidence})"
```

### Agent Execution Flow

**Sync Workflow (Sequential):**

```
1. feedback_agent
   └─> Stores result in agent_results["feedback"]

2. pattern_detection_agent
   └─> Stores result in agent_results["pattern"]
   └─> Stores confidence in state["pattern_confidence"]

3. hint_agent
   └─> Reads agent_results["feedback"] and agent_results["pattern"]
   └─> Generates coherent hint referencing previous insights
```

**Async Workflow (Sequential but independent):**

```
1. learning_agent
   └─> Receives sync workflow results (feedback, pattern)
   └─> Generates learning recommendations

2. difficulty_agent
   └─> Reads learning_agent results
   └─> Makes informed difficulty decisions

3. store_memory_node
   └─> Collects ALL agent results
   └─> Stores comprehensive submission record
```

### Benefits

- ✅ **Coherent outputs** - Hint references specific feedback points
- ✅ **Context awareness** - Each agent knows what previous agents found
- ✅ **Better decisions** - Difficulty adjusts based on learning needs
- ✅ **Rich memory** - All insights stored together

---

## Configuration

### Environment Variables

Create a `.env` file in the `ai-services` directory:

```bash
# ═══════════════════════════════════════════════════════════════
# REQUIRED
# ═══════════════════════════════════════════════════════════════
GOOGLE_API_KEY=your-gemini-api-key

# ═══════════════════════════════════════════════════════════════
# OPTIONAL (for full functionality)
# ═══════════════════════════════════════════════════════════════

# Redis - For response caching (recommended)
REDIS_URL=redis://localhost:6379/0

# MongoDB - For user submission history (optional)
MONGODB_URI=mongodb://localhost:27017/mentat

# Backend API - For problem retrieval
BACKEND_API_URL=http://localhost:5000/api

# ═══════════════════════════════════════════════════════════════
# PERFORMANCE TUNING (v2.0 defaults)
# ═══════════════════════════════════════════════════════════════

# Sync workflow total budget (seconds)
SYNC_TOTAL_BUDGET_SECONDS=60.0

# RAG retrieval count (higher = more context)
RAG_RETRIEVAL_K=7

# Request timeout (should be > sync budget)
MAX_REQUEST_SECONDS=65
```

### LLM Configuration

Location: `app/services/llm.py`

```python
DEFAULT_MODEL = "gemini-2.5-flash"  # Fast, high-quality
# Alternative: "gemini-2.5-pro" for even better quality

def get_llm(temperature: float = 0.2):
    return ChatGoogleGenerativeAI(
        model=DEFAULT_MODEL,
        temperature=temperature,  # Low for consistency
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )
```

**Model Selection:**

- `gemini-2.5-flash` - **Recommended** - Fast, cost-effective, high quality
- `gemini-2.5-pro` - Maximum quality, slower, higher cost
- `gemini-1.5-pro` - Stable, reliable fallback

### Workflow Configuration

**Sync Workflow Constants (`app/graph/sync_workflow.py`):**

```python
# Total budget for user-facing response
SYNC_TOTAL_BUDGET_SECONDS = 60.0  # Generous for quality

# Per-agent budgets
SYNC_AGENT_BUDGETS = {
    "retrieve_memory": 10.0,
    "build_user_profile": 5.0,
    "feedback_agent": 30.0,      # Most important
    "pattern_detection": 25.0,
    "hint_agent": 20.0,
}

# RAG retrieval count
RAG_RETRIEVAL_K = 7  # More context = better analysis
```

**Async Workflow Constants (`app/graph/async_workflow.py`):**

```python
# Background processing budgets (generous)
ASYNC_AGENT_BUDGETS = {
    "learning_agent": 45.0,
    "difficulty_agent": 30.0,
    "weekly_report": 45.0,
    "store_memory": 15.0,
}
```

### Caching Configuration

**Redis Settings (`app/cache/redis_cache.py`):**

```python
# Connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# TTL (time-to-live) settings
DEFAULT_TTL = 3600  # 1 hour for most responses
LONG_TTL = 7200     # 2 hours for stable results

# Cache invalidation
# Use: redis_cache.invalidate_user(user_id)
```

**Which Agents Use Cache:**
| Agent | Cached | TTL | Reason |
| ---------------------- | ------ | ------ | ----------------------------- |
| feedback_agent | ❌ | - | Non-deterministic, context varies |
| pattern_detection | ✅ | 2h | Deterministic analysis |
| learning_agent | ✅ | 1h | Stable recommendations |
| difficulty_agent | ✅ | 1h | Consistent decisions |
| hint_agent | ❌ | - | References other agents |

---

## Testing

### Running Tests

```bash
# Navigate to ai-services directory
cd ai-services

# Install test dependencies
pip install pytest pytest-asyncio pytest-cov

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_agents.py

# Run specific test class
pytest tests/test_agents.py::TestFeedbackAgent

# Run with verbose output
pytest -v

# Run excluding slow integration tests
pytest --ignore=tests/test_routes.py
```

### Test Results

**Status: ✅ 102/102 tests passing** (excluding route integration tests that make real API calls)

**Test Coverage:**

- Core workflows: ✅ All passing
- Agents: ✅ All passing
- RAG components: ✅ All passing
- User profile building: ✅ All passing
- Cache systems: ✅ All passing

### Test Structure

| Test File                    | Tests                                  | Status |
| ---------------------------- | -------------------------------------- | ------ |
| `test_cache.py`              | Redis cache, cache key generation      | ✅     |
| `test_agents.py`             | All AI agents                          | ✅     |
| `test_routes.py`             | API endpoints, progressive hints       | ⚠️ \*  |
| `test_rag.py`                | Retriever, context builder, monitoring | ✅     |
| `test_user_profile.py`       | Profile building, pattern extraction   | ✅     |
| `test_problem_repository.py` | Problem context, approach inference    | ✅     |
| `test_workflows.py`          | Sync/async workflows, orchestrator     | ✅     |
| `test_services.py`           | LLM service, metrics                   | ✅     |

\* _Route tests make real API calls and may timeout - excluded from CI_

### Test Fixtures

Common fixtures are defined in `conftest.py`:

```python
@pytest.fixture
def sample_submission_payload():
    return {
        "user_id": "test_user_123",
        "problem_id": "prob_001",
        "code": "def solution(): ...",
        ...
    }
```

### Recent Test Updates

**Intelligence-First Refactoring:**

- ✅ Removed `_check_budget` mocks (function no longer exists)
- ✅ Added `agent_results` and `pattern_confidence` to test state
- ✅ Updated build_user_profile_node tests to reflect no-skip behavior

---

## Deployment

### Development

```bash
# Install dependencies
pip install -r requirement.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
# Using gunicorn with uvicorn workers
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Docker (Recommended)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirement.txt .
RUN pip install -r requirement.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Required Services

1. **Redis**: For response caching

   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **MongoDB**: For user submission history

   ```bash
   docker run -d -p 27017:27017 mongo:latest
   ```

3. **Ollama**: For embeddings (optional, can use cloud embeddings)
   ```bash
   ollama serve
   ollama pull nomic-embed-text
   ```

---

## API Usage Examples

### Generate Feedback

**Request:**

```bash
curl -X POST http://localhost:8000/ai/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "problem_id": "prob_001",
    "problem_category": "Array",
    "constraints": "1 <= n <= 10^4",
    "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]",
    "language": "python",
    "verdict": "wrong_answer",
    "error_type": "Wrong Answer"
  }'
```

**Response (v2.0):**

```json
{
  "success": true,
  "verdict": "wrong_answer",
  "submission_id": "sub_abc123def456",
  "hints": [
    {
      "level": 1,
      "content": "Your solution has a logical error that allows incorrect element pairing.",
      "hint_type": "conceptual"
    },
    {
      "level": 2,
      "content": "Consider what happens when index i equals index j in your nested loops.",
      "hint_type": "specific"
    },
    {
      "level": 3,
      "content": "The problem requires using two DIFFERENT elements. Add a condition to check i != j.",
      "hint_type": "concrete"
    }
  ],
  "explanation": "Your solution correctly attempts to find two numbers that sum to the target using nested loops. However, there's a critical logical error: when i equals j, you're using the same element twice, which violates the problem requirement. For example, if nums=[3,3] and target=6, your code would incorrectly return [0,0] or [1,1].\n\nThe time complexity O(n²) also suggests room for optimization, but fix the logic error first.",
  "detected_pattern": "index boundary handling",
  "pattern_confidence": 0.85,
  "feedback_type": "error_feedback",
  "execution_time_ms": 52340
}
```

### Response Format (Detailed)

**Success Response:**

```json
{
  "success": true,
  "verdict": "wrong_answer", // From submission
  "submission_id": "sub_...",

  // SYNC WORKFLOW RESULTS
  "hints": [
    /* Progressive hints */
  ],
  "explanation": "Detailed feedback from feedback_agent",
  "detected_pattern": "Pattern name or null",
  "pattern_confidence": 0.85, // NEW in v2.0
  "feedback_type": "error_feedback",

  // METADATA
  "execution_time_ms": 52340, // Total workflow time
  "agent_results": {
    // NEW in v2.0: For debugging
    "feedback_completed": true,
    "pattern_completed": true,
    "hint_completed": true
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Get RAG Stats

**Request:**

```bash
curl http://localhost:8000/ai/rag-stats/user_123
```

**Response:**

```json
{
  "user_id": "user_123",
  "total_memories": 15,
  "last_retrieval": "2026-01-24T00:36:52Z",
  "average_relevance": 0.67,
  "retrieval_count": 42,
  "context_builds": 38
}
```

### Weekly Report

**Request:**

```bash
curl -X POST http://localhost:8000/ai/weekly-report \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123"
  }'
```

**Response:**

```json
{
  "summary": "This week you attempted 12 problems...",
  "strengths": ["Dynamic Programming", "Tree Traversal"],
  "areas_for_improvement": ["Time complexity analysis", "Edge cases"],
  "recommended_topics": ["Hash Tables", "Binary Search"],
  "progress_indicators": {
    "problems_attempted": 12,
    "problems_solved": 8,
    "success_rate": 0.67
  }
}
```

---

## Intelligence-First Architecture (v2.0)

### Design Philosophy

The v2.0 refactoring represents a fundamental shift from **speed-first** to **quality-first** design:

#### Core Principles

1. **No Agent Skipping**
   - Budget checks replaced with budget logging
   - All agents run to completion
   - Failures fallback gracefully, not skip

2. **Full Context Always**
   - No code truncation (was 4000 chars)
   - Complete code with line numbers
   - All 7 RAG memory chunks included (was 3)

3. **Agent Coordination**
   - Shared `agent_results` state dict
   - Hint agent references feedback & pattern results
   - Learning agent results inform difficulty decisions

4. **Comprehensive Memory**
   - Store ALL submissions (not just failures)
   - Include feedback, learning, difficulty metadata
   - Enable rich historical analysis

5. **Generous Time Budgets**
   - 60s sync workflow (was 10s)
   - 45s per async agent (was 10-15s)
   - Quality analysis over quick responses

### Why This Matters

**For Users:**

- 🎯 More accurate, insightful feedback
- 📚 Better learning recommendations
- 🔍 Deeper pattern recognition
- 💡 Contextual, coherent hints

**For System:**

- 📊 Richer data collection
- 🔄 Better long-term personalization
- 🧠 Improved agent decision quality
- 🐛 Easier debugging (full context logged)

### Trade-offs

**Pros:**

- ✅ Significantly better feedback quality
- ✅ More pedagogically useful
- ✅ Better user learning outcomes
- ✅ Richer data for future improvements

**Cons:**

- ⚠️ Higher latency (50-60s vs 10-15s)
- ⚠️ More LLM API costs
- ⚠️ Higher memory usage (full context)

**Decision:** For an educational platform, learning quality > response speed.

---

## Troubleshooting

### Common Issues

1. **504 Gateway Timeout**
   - **Symptom:** Request times out despite workflow completing
   - **Cause:** Route timeout (30s) shorter than workflow budget (60s)
   - **Fix:** Route timeout increased to 65s in v2.0

2. **Redis Connection Failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check REDIS_URL environment variable
   - Fallback: Caching disabled, but system works

3. **LLM API Errors**
   - Verify GOOGLE_API_KEY is set correctly
   - Check API quota limits at [Google AI Studio](https://makersuite.google.com/)
   - Check for rate limiting (429 errors)

4. **Vector Store Errors**
   - Ensure Ollama is running for embeddings: `ollama serve`
   - Check vector_db directory permissions
   - Verify nomic-embed-text model: `ollama list`

5. **Budget Exceeded Warnings**
   - **Normal in v2.0:** System logs but continues
   - Workflow completes regardless of budget
   - No agents are skipped due to timeout

6. **MongoDB Connection Issues**
   - System works without MongoDB (optional feature)
   - Check MONGODB_URI environment variable
   - Real-time stats disabled if MongoDB unavailable

7. **Import Errors**
   - Ensure all dependencies are installed: `pip install -r requirement.txt`
   - Check Python version (3.11+ recommended)
   - Verify Python path includes project root

### Logging

Structured JSON logs are output to stdout. Key log events:

**Startup:**

- `service_startup` - Application starting
- `module_loaded` - Modules initialized
- `service_ready` - Ready to accept requests

**Request Handling:**

- `request_received` - API request received
- `workflow_starting` - Workflow beginning
- `workflow_completed` - Workflow finished
- `request_completed` - Response sent

**Agent Execution:**

- `feedback_agent starting` - Agent beginning work
- `⏱️ [agent_name] completed in Xs` - Agent finished
- `✅ [AGENT] Completed` - Success summary

**Caching:**

- `cache_hit` / `cache_miss` - Cache status
- `🔑 Cache key generated` - Key creation

**Budget Logging (v2.0):**

- `⏰ [agent_name] Budget status` - Time remaining (informational only)
- `⚠️ BUDGET EXCEEDED by Xs` - Exceeded, but continued
- `✅ Within budget` - Completed on time

### Performance Monitoring

**Expected Timings (v2.0):**

```
Sync Workflow: 45-55s typical, 60s max
├─ retrieve_memory: 0.5-1s
├─ build_user_profile: <0.1s
├─ build_context: <0.1s
├─ feedback_agent: 10-20s (LLM call)
├─ pattern_detection: 15-25s (LLM call)
└─ hint_agent: 15-20s (LLM call)

Async Workflow: 60-90s (background)
├─ learning_agent: 15-30s
├─ difficulty_agent: 10-20s
└─ store_memory: 0.5-2s
```

**If slower:**

- Check LLM API response times
- Verify network latency
- Check Redis connection speed
- Monitor embedding generation time

---

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Use type hints
4. Update documentation

---

## Version History

### 2.0.0 - Intelligence-First Refactoring (2026-01-24)

**Major Changes:**

**Philosophy Shift:** Quality over speed

- All agents MUST complete - no budget-based skipping
- Full context without truncation
- Cross-agent coordination via shared state
- Comprehensive memory storage for ALL submissions

**Sync Workflow:**

- ⏱️ Budget increased from 10s to **60s**
- 📊 RAG retrieval k increased from 3 to **7**
- ❌ Removed `_check_budget()` → `_log_budget_status()` (never skips)
- ✅ Added `agent_results` dict for agent coordination
- ✅ Added `pattern_confidence` for hint agent
- 📝 Full code with line numbers (no truncation)

**Async Workflow:**

- ✅ Learning agent ALWAYS runs (even for accepted)
- ✅ Difficulty agent ALWAYS runs (no skip conditions)
- ✅ Store memory ALWAYS runs (comprehensive metadata)
- 🤝 Agent coordination via sync workflow results

**Context Builder:**

- 📝 Added `include_full_code=True` parameter
- 🔢 Added line numbers to code for precise reference
- ❌ Removed 4000 char truncation
- 📊 Enhanced with agent-specific context building

**Routes:**

- ⏱️ `/ai/feedback` timeout increased from 30s to **65s**

**Testing:**

- ✅ 102/102 core tests passing
- 🔧 Updated test fixtures for new state structure
- 🧪 Removed deprecated `_check_budget` mocks

### 1.2.0 - Pattern Detection & User Profiling

- Added user profile building
- Pattern detection improvements
- MongoDB integration

### 1.1.0 - Redis Caching

- Added Redis caching
- Deprecated file-based cache
- Performance improvements

### 1.0.0 - Initial Release

- Core feedback functionality
- Basic agent system
- File-based caching
