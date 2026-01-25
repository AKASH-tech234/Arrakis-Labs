# AI Services Documentation

> **FastAPI + LangGraph** - Intelligent feedback generation with ML-powered insights and personalized learning.

---

## Overview

The AI Services microservice is the intelligence layer of Mentat Trials, providing:

- **LangGraph Agents**: Orchestrated AI feedback generation
- **RAG System**: Memory-based context retrieval from past submissions
- **MIM (Mistake Inference Model)**: ML predictions and recommendations
- **Caching**: Efficient response caching to reduce LLM calls

**Port**: 8000  
**Framework**: FastAPI  
**LLM**: Google Gemini (configurable)  
**Vector Store**: ChromaDB

---

## Directory Structure

```
ai-services/
├── main.py                       # FastAPI entry point
├── requirement.txt               # Python dependencies
├── pytest.ini                    # Test configuration
│
├── app/
│   ├── __init__.py
│   │
│   ├── api/                      # API endpoints
│   │   └── routes.py             # All route definitions
│   │
│   ├── agents/                   # LangGraph agents
│   │   ├── base_json_agent.py    # Base agent with caching
│   │   ├── feedback_agent.py     # Code feedback generation
│   │   ├── hint_agent.py         # Progressive hint generation
│   │   ├── pattern_agent.py      # Mistake pattern detection
│   │   ├── difficulty_agent.py   # Difficulty assessment
│   │   ├── learning_agent.py     # Learning recommendations
│   │   ├── report_agent.py       # Weekly reports
│   │   └── context_compressor.py # Context optimization
│   │
│   ├── graph/                    # Workflow orchestration
│   │   ├── sync_workflow.py      # Main synchronous workflow
│   │   ├── async_workflow.py     # Background processing
│   │   ├── orchestrator.py       # Agent coordination
│   │   ├── workflow.py           # Workflow definitions
│   │   └── async_runner.py       # Async task execution
│   │
│   ├── mim/                      # Machine Learning models
│   │   ├── inference.py          # Real-time predictions
│   │   ├── model.py              # Model definitions
│   │   ├── feature_extractor.py  # Feature engineering
│   │   ├── training.py           # Model training
│   │   ├── evaluation.py         # Model evaluation
│   │   ├── difficulty.py         # Difficulty prediction
│   │   ├── recommender.py        # Problem recommendations
│   │   ├── roadmap.py            # Learning path generation
│   │   ├── schemas.py            # MIM data models
│   │   └── models/               # Saved model files
│   │
│   ├── rag/                      # Retrieval Augmented Generation
│   │   ├── retriever.py          # Memory retrieval
│   │   ├── vector_store.py       # ChromaDB management
│   │   ├── embeddings.py         # Text embeddings
│   │   ├── context_builder.py    # Context assembly
│   │   └── monitoring.py         # RAG metrics
│   │
│   ├── schemas/                  # Pydantic models
│   │   ├── feedback.py           # Feedback schemas
│   │   ├── submission.py         # Submission schemas
│   │   ├── user_profile.py       # User profile schemas
│   │   ├── hint.py               # Hint schemas
│   │   ├── pattern.py            # Pattern schemas
│   │   ├── difficulty.py         # Difficulty schemas
│   │   ├── learning.py           # Learning schemas
│   │   └── report.py             # Report schemas
│   │
│   ├── user_profile/             # User profiling
│   │   └── profile_builder.py    # Cognitive profile construction
│   │
│   ├── problem/                  # Problem data access
│   │   └── problem_repository.py # Problem CRUD
│   │
│   ├── cache/                    # Caching layer
│   │   ├── cache_key.py          # Cache key generation
│   │   ├── agent_cache.py        # Agent response cache
│   │   └── redis_cache.py        # Redis caching
│   │
│   ├── metrics/                  # Performance tracking
│   │   └── agent_metries.py      # Agent execution metrics
│   │
│   ├── sync/                     # Data synchronization
│   │   └── submission_sync.py    # Submission sync with backend
│   │
│   ├── db/                       # Database connections
│   │   └── mongodb.py            # MongoDB client
│   │
│   ├── services/                 # External services
│   │   └── llm.py                # LLM provider abstraction
│   │
│   └── prompts/                  # LLM prompts
│       └── (prompt templates)
│
├── tests/                        # Unit tests
│   ├── test_mim.py               # MIM tests (85+ tests)
│   └── ...
│
├── agent_cache/                  # JSON response cache
│   └── *.json
│
└── vector_db/                    # ChromaDB storage
    ├── problem_knowledge/
    └── user_memory/
```

---

## Core Files

### main.py - Entry Point

**Purpose**: Initializes FastAPI application with middleware and routes.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="Mentat Trials AI Service",
    version="2.0.0"
)

# CORS for backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router, prefix="/ai")

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}
```

---

### api/routes.py - API Endpoints

**Main Endpoints**:

| Method | Endpoint                                 | Description                         |
| ------ | ---------------------------------------- | ----------------------------------- |
| GET    | `/health`                                | Service health check                |
| POST   | `/ai/feedback`                           | Generate AI feedback for submission |
| GET    | `/ai/mim/status`                         | MIM model status                    |
| GET    | `/ai/mim/profile/{user_id}`              | User cognitive profile              |
| GET    | `/ai/mim/recommend/{user_id}`            | Problem recommendations             |
| POST   | `/ai/mim/train`                          | Trigger model training              |
| GET    | `/ai/mim/predict/{user_id}/{problem_id}` | Success prediction                  |

---

## Agents

### base_json_agent.py - Base Agent Class

**Purpose**: Provides common functionality for all LangGraph agents.

```python
class BaseJSONAgent:
    """
    Base class for all agents with:
    - Structured JSON output
    - Response caching (Redis + file)
    - Error handling
    - Metrics logging
    """

    def __init__(self, llm, cache_enabled=True):
        self.llm = llm
        self.cache = AgentCache() if cache_enabled else None

    async def invoke(self, state: dict) -> dict:
        # Check cache first
        cache_key = self._build_cache_key(state)
        if cached := self.cache.get(cache_key):
            return cached

        # Generate response
        response = await self._generate(state)

        # Cache and return
        self.cache.set(cache_key, response)
        return response
```

**Caching Strategy**:

- Cache key = hash of (user_id, problem_id, code, verdict)
- TTL: 24 hours
- Storage: Redis (primary) + JSON files (fallback)

---

### feedback_agent.py - Feedback Generation

**Purpose**: Analyzes failed code and generates contextual explanations.

**Input**:

```python
{
    "code": "def solution(arr):\n    ...",
    "language": "python",
    "verdict": "Wrong Answer",
    "error_type": "Wrong Answer",
    "problem_context": {...},
    "user_memory": [...]  # Past mistakes from RAG
}
```

**Output**:

```python
{
    "explanation": "Your solution fails on edge case where array is empty...",
    "root_cause": "Missing boundary check",
    "specific_line": 5,
    "confidence": 0.85
}
```

**Prompt Structure**:

```
You are an expert programming tutor analyzing a failed submission.

Problem: {problem_title}
Constraints: {constraints}
User's Code: {code}
Verdict: {verdict}
Error: {error_type}

Past Mistakes (similar problems):
{user_memory}

Analyze WHY the code failed and provide:
1. Clear explanation of the bug
2. Root cause identification
3. Specific line/area if identifiable

Do NOT reveal the full solution.
```

---

### hint_agent.py - Progressive Hints

**Purpose**: Generates tiered hints from conceptual to specific.

**Output**:

```python
{
    "hints": [
        {
            "level": 1,
            "type": "conceptual",
            "content": "Think about what happens when the input is empty"
        },
        {
            "level": 2,
            "type": "directional",
            "content": "Check the loop boundaries - what if start > end?"
        },
        {
            "level": 3,
            "type": "specific",
            "content": "Line 5: Add a condition to handle n == 0 before the loop"
        }
    ]
}
```

**Hint Levels**:
| Level | Type | When Revealed | Description |
|-------|------|---------------|-------------|
| 1 | Conceptual | Always | General direction |
| 2 | Directional | After 2nd attempt | Points to area |
| 3 | Specific | After 3rd attempt | Actionable fix |

---

### pattern_agent.py - Mistake Pattern Detection

**Purpose**: Identifies recurring error patterns across submissions.

**Common Patterns Detected**:

- Off-by-one errors
- Edge case handling (empty/single element)
- Integer overflow
- Array index out of bounds
- Incorrect base case (recursion)
- Wrong loop termination
- Floating point precision

**Output**:

```python
{
    "detected_pattern": "Off-by-one error",
    "frequency": 3,  # Times seen in last 10 submissions
    "description": "You tend to use < instead of <= in loop conditions",
    "recommendation": "Always verify loop bounds with smallest and largest inputs"
}
```

---

### learning_agent.py - Learning Recommendations

**Purpose**: Suggests focus areas based on weakness analysis.

**Output**:

```python
{
    "focus_areas": [
        {
            "topic": "Edge Case Handling",
            "priority": "high",
            "reason": "Failed 4 of last 5 edge case tests"
        },
        {
            "topic": "Dynamic Programming",
            "priority": "medium",
            "reason": "Struggling with state transitions"
        }
    ],
    "suggested_problems": [
        {"id": "...", "title": "...", "targets": "edge cases"}
    ],
    "estimated_time": "2-3 hours focused practice"
}
```

---

### difficulty_agent.py - Difficulty Assessment

**Purpose**: Evaluates if problem difficulty matches user level.

**Actions**:

- `increase` - User solving too easily
- `maintain` - Good challenge level
- `decrease` - User struggling too much

**Output**:

```python
{
    "action": "maintain",
    "rationale": "User is challenged but making progress",
    "current_level": "intermediate",
    "metrics": {
        "acceptance_rate": 0.45,
        "avg_attempts": 2.3,
        "time_trend": "improving"
    }
}
```

---

### report_agent.py - Weekly Reports

**Purpose**: Generates comprehensive weekly performance summaries.

**Output**:

```python
{
    "period": "2026-01-19 to 2026-01-25",
    "summary": {
        "problems_attempted": 15,
        "problems_solved": 12,
        "acceptance_rate": 0.80,
        "streak_days": 7
    },
    "improvements": [
        "Array manipulation accuracy improved by 20%"
    ],
    "areas_to_focus": [
        "Graph algorithms - only 40% success rate"
    ],
    "achievements": [
        "🔥 7-day solving streak!",
        "📈 Solved first hard problem"
    ],
    "next_week_goals": [
        "Attempt 2 graph problems",
        "Maintain streak"
    ]
}
```

---

## Graph Workflows

### sync_workflow.py - Main Workflow

**Purpose**: Orchestrates agent execution within 65-second budget.

**Workflow Nodes**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYNC WORKFLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Retrieve   │───▶│   Build     │───▶│  Feedback   │         │
│  │   Memory    │    │  Context    │    │   Agent     │         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
│                                               │                 │
│                                               ▼                 │
│                                    ┌─────────────────────┐      │
│                                    │  Parallel Execution │      │
│                                    │  ┌───────┬───────┐  │      │
│                                    │  │ Hint  │Pattern│  │      │
│                                    │  │ Agent │ Agent │  │      │
│                                    │  └───────┴───────┘  │      │
│                                    └──────────┬──────────┘      │
│                                               │                 │
│                                               ▼                 │
│                                    ┌─────────────────────┐      │
│                                    │  Parallel Execution │      │
│                                    │  ┌───────┬────────┐ │      │
│                                    │  │Learning│Difficul│ │      │
│                                    │  │ Agent  │ty Agent│ │      │
│                                    │  └───────┴────────┘ │      │
│                                    └──────────┬──────────┘      │
│                                               │                 │
│                                               ▼                 │
│                                    ┌─────────────────────┐      │
│                                    │   Store Memory      │      │
│                                    │   (if new pattern)  │      │
│                                    └─────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Time Budget**:

- Total: 65 seconds
- Memory retrieval: ~5s
- Context building: ~2s
- Feedback generation: ~15s
- Parallel agents: ~20s (each)
- Memory storage: ~3s

**Code Structure**:

```python
class SyncWorkflow:
    def __init__(self):
        self.feedback_agent = FeedbackAgent()
        self.hint_agent = HintAgent()
        self.pattern_agent = PatternAgent()
        self.learning_agent = LearningAgent()
        self.difficulty_agent = DifficultyAgent()
        self.retriever = MemoryRetriever()

    async def execute(self, request: FeedbackRequest) -> FeedbackResponse:
        # Step 1: Retrieve user memory
        memory = await self.retriever.retrieve(
            user_id=request.user_id,
            problem_category=request.problem_category
        )

        # Step 2: Build context
        context = self._build_context(request, memory)

        # Step 3: Generate feedback
        feedback = await self.feedback_agent.invoke(context)

        # Step 4: Parallel hint + pattern
        hint_task = self.hint_agent.invoke(context)
        pattern_task = self.pattern_agent.invoke(context)
        hints, pattern = await asyncio.gather(hint_task, pattern_task)

        # Step 5: Parallel learning + difficulty
        learning_task = self.learning_agent.invoke(context)
        difficulty_task = self.difficulty_agent.invoke(context)
        learning, difficulty = await asyncio.gather(learning_task, difficulty_task)

        # Step 6: Store new memory if pattern detected
        if pattern.detected_pattern:
            await self._store_memory(request, pattern)

        return FeedbackResponse(
            explanation=feedback.explanation,
            hints=hints.hints,
            detected_pattern=pattern.detected_pattern,
            learning_recommendation=learning,
            difficulty_adjustment=difficulty
        )
```

---

## MIM (Mistake Inference Model)

### inference.py - Real-Time Predictions

**Purpose**: Singleton service for ML predictions without LLM calls.

```python
class MIMInference:
    """
    Provides instant predictions:
    - Success probability
    - Time to solve estimation
    - Difficulty appropriateness
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_models()
        return cls._instance

    def predict_success(self, user_id: str, problem_id: str) -> float:
        features = self.feature_extractor.extract(user_id, problem_id)
        return self.success_model.predict_proba(features)[0][1]
```

---

### feature_extractor.py - Feature Engineering

**Purpose**: Extracts 60-dimensional feature vector from user + problem data.

**Feature Categories**:

```python
FEATURES = {
    # User features (30)
    "user_total_submissions": int,
    "user_acceptance_rate": float,
    "user_avg_attempts": float,
    "user_streak_days": int,
    "user_category_strengths": dict,  # 10 categories
    "user_difficulty_distribution": dict,  # easy/med/hard
    "user_recent_momentum": float,  # Last 7 days trend

    # Problem features (15)
    "problem_difficulty": int,  # 1-3
    "problem_category": str,  # One-hot encoded
    "problem_acceptance_rate": float,
    "problem_avg_time": float,
    "problem_hint_usage_rate": float,

    # Interaction features (15)
    "user_category_match": float,  # User strength vs problem category
    "difficulty_gap": float,  # User level vs problem level
    "similar_problems_solved": int,
    "time_since_similar": float,
    "prerequisite_coverage": float
}
```

---

### recommender.py - Problem Recommendations

**Purpose**: Suggests problems based on skill gaps and learning goals.

**Algorithm**:

1. Identify user's weak categories
2. Filter problems in weak categories
3. Score by difficulty appropriateness
4. Diversify recommendations
5. Add stretch goals

```python
def recommend(self, user_id: str, count: int = 5) -> List[Recommendation]:
    profile = self._get_user_profile(user_id)
    weak_areas = self._identify_weak_areas(profile)

    candidates = self._get_candidate_problems(weak_areas)
    scored = self._score_candidates(candidates, profile)

    # Ensure diversity
    recommendations = self._diversify(scored, count)

    return recommendations
```

**Output**:

```python
[
    {
        "problem_id": "...",
        "problem_title": "Two Sum",
        "reason": "Targets your weakness in hash maps",
        "difficulty": "easy",
        "estimated_success": 0.75,
        "estimated_time_minutes": 15
    }
]
```

---

### roadmap.py - Learning Path Generation

**Purpose**: Creates personalized multi-week learning roadmaps.

**Output**:

```python
{
    "current_level": "intermediate",
    "target_level": "advanced",
    "estimated_weeks": 8,
    "milestones": [
        {
            "week": 1,
            "focus": "Master two-pointer technique",
            "problems": [...],
            "expected_outcome": "Solve 80% of two-pointer problems"
        },
        {
            "week": 2,
            "focus": "Sliding window patterns",
            "problems": [...],
            "expected_outcome": "..."
        }
    ]
}
```

---

## RAG System

### retriever.py - Memory Retrieval

**Purpose**: Fetches relevant past mistakes from vector store.

```python
class MemoryRetriever:
    def __init__(self):
        self.vector_store = VectorStore()
        self.embeddings = EmbeddingModel()

    async def retrieve(
        self,
        user_id: str,
        problem_category: str,
        k: int = 5
    ) -> List[Memory]:
        # Build query from current context
        query = f"User {user_id} mistakes in {problem_category}"
        query_embedding = self.embeddings.embed(query)

        # Search vector store
        results = self.vector_store.similarity_search(
            query_embedding,
            filter={"user_id": user_id},
            k=k
        )

        return [Memory(**r) for r in results]
```

**Memory Schema**:

```python
{
    "user_id": str,
    "problem_id": str,
    "problem_category": str,
    "mistake_type": str,
    "code_snippet": str,
    "feedback_given": str,
    "timestamp": datetime
}
```

---

### vector_store.py - ChromaDB Management

**Purpose**: Manages persistent vector storage for user memories.

**Collections**:

- `user_memory` - User mistakes and patterns
- `problem_knowledge` - Problem-specific information

```python
class VectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path="./vector_db"
        )
        self.user_collection = self.client.get_or_create_collection(
            "user_memory",
            metadata={"hnsw:space": "cosine"}
        )

    def add(self, user_id: str, content: str, metadata: dict):
        embedding = self.embeddings.embed(content)
        self.user_collection.add(
            ids=[f"{user_id}_{uuid4()}"],
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata]
        )
```

---

### context_builder.py - Context Assembly

**Purpose**: Constructs LLM-safe context from multiple sources.

**Context Structure**:

```python
{
    "problem": {
        "title": str,
        "description": str (truncated),
        "constraints": str,
        "examples": List[dict]
    },
    "submission": {
        "code": str,
        "language": str,
        "verdict": str,
        "error_message": str
    },
    "user_memory": [
        {
            "problem": str,
            "mistake": str,
            "when": str
        }
    ],
    "user_stats": {
        "total_submissions": int,
        "acceptance_rate": float
    }
}
```

**Token Budget**: ~4000 tokens max to leave room for response.

---

## Schemas

### feedback.py

```python
class FeedbackRequest(BaseModel):
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str
    language: str
    verdict: str
    error_type: str
    user_history_summary: str

class FeedbackResponse(BaseModel):
    explanation: str
    hints: List[Hint]
    detected_pattern: Optional[str]
    learning_recommendation: LearningRecommendation
    difficulty_adjustment: DifficultyAdjustment
    confidence: float
    weekly_report: Optional[WeeklyReport]
```

---

### hint.py

```python
class Hint(BaseModel):
    level: int  # 1, 2, or 3
    type: Literal["conceptual", "directional", "specific"]
    content: str

class HintResponse(BaseModel):
    hints: List[Hint]
    should_reveal_more: bool
```

---

## Caching

### cache_key.py

**Purpose**: Generates deterministic cache keys.

```python
def generate_cache_key(
    user_id: str,
    problem_id: str,
    code: str,
    verdict: str
) -> str:
    content = f"{user_id}:{problem_id}:{code}:{verdict}"
    return hashlib.sha256(content.encode()).hexdigest()
```

### agent_cache.py

**Purpose**: File-based JSON cache for agent responses.

**Storage**: `agent_cache/*.json`

**TTL**: 24 hours (configurable)

---

## Metrics

### agent_metries.py

**Purpose**: Tracks agent performance metrics.

**Metrics Tracked**:

```python
{
    "agent_name": str,
    "execution_time_ms": float,
    "cache_hit": bool,
    "tokens_used": int,
    "error": Optional[str],
    "timestamp": datetime
}
```

**Output File**: `agent_metrics.json`

---

## Services

### llm.py - LLM Provider

**Purpose**: Abstracts LLM provider for easy switching.

```python
class LLMService:
    def __init__(self, provider: str = "gemini"):
        if provider == "gemini":
            self.client = GoogleGenerativeAI(
                model="gemini-pro",
                api_key=os.getenv("GOOGLE_API_KEY")
            )
        elif provider == "openai":
            self.client = ChatOpenAI(
                model="gpt-4",
                api_key=os.getenv("OPENAI_API_KEY")
            )

    async def generate(self, prompt: str, **kwargs) -> str:
        return await self.client.ainvoke(prompt, **kwargs)
```

---

## Database

### mongodb.py

**Purpose**: MongoDB client for syncing with backend.

```python
class MongoDBClient:
    def __init__(self):
        self.client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
        self.db = self.client.mentat_trials

    async def get_user_submissions(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[dict]:
        cursor = self.db.submissions.find(
            {"user": ObjectId(user_id)}
        ).sort("submittedAt", -1).limit(limit)
        return await cursor.to_list(length=limit)
```

---

## Environment Variables

```env
# LLM Configuration
GOOGLE_API_KEY=your_google_api_key
LLM_PROVIDER=gemini  # or "openai"

# Database
MONGODB_URI=mongodb://localhost:27017/mentat-trials

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Vector Store
CHROMA_PERSIST_DIRECTORY=./vector_db

# Caching
CACHE_TTL_HOURS=24
ENABLE_CACHE=true

# Workflow
WORKFLOW_TIMEOUT_SECONDS=65

# MIM
ENABLE_MIM=true
MIM_MODEL_PATH=./app/mim/models
```

---

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run MIM tests only
pytest tests/test_mim.py -v

# Run specific test
pytest tests/test_mim.py::test_feature_extraction -v
```

**Test Coverage**: 85+ MIM tests covering:

- Feature extraction
- Model predictions
- Recommendations
- Roadmap generation
- Edge cases

---

## Development

```bash
# Start with hot reload
uvicorn app.main:app --reload --port 8000

# Run with specific workers
uvicorn app.main:app --workers 4 --port 8000

# Train MIM models
python -m app.mim.training
```

---

## API Reference

### POST /ai/feedback

**Request**:

```json
{
  "user_id": "user123",
  "problem_id": "prob456",
  "problem_category": "Arrays",
  "constraints": "1 ≤ n ≤ 10^5",
  "code": "def solution(arr):\n    ...",
  "language": "python",
  "verdict": "Wrong Answer",
  "error_type": "Wrong Answer",
  "user_history_summary": "Recent 20 submissions: 5 accepted, 15 failed"
}
```

**Response**:

```json
{
  "explanation": "Your solution doesn't handle the edge case where...",
  "hints": [
    {"level": 1, "type": "conceptual", "content": "..."},
    {"level": 2, "type": "directional", "content": "..."},
    {"level": 3, "type": "specific", "content": "..."}
  ],
  "detected_pattern": "Off-by-one error",
  "learning_recommendation": {
    "focus_areas": [...],
    "rationale": "..."
  },
  "difficulty_adjustment": {
    "action": "maintain",
    "rationale": "..."
  },
  "confidence": 0.85,
  "weekly_report": null
}
```

### GET /ai/mim/profile/{user_id}

**Response**:

```json
{
  "user_id": "user123",
  "level": "intermediate",
  "strengths": ["arrays", "strings"],
  "weaknesses": ["dynamic_programming", "graphs"],
  "skill_scores": {
    "arrays": 0.85,
    "strings": 0.8,
    "dynamic_programming": 0.45,
    "graphs": 0.5
  },
  "predicted_next_milestone": "Solve first hard DP problem"
}
```

### GET /ai/mim/recommend/{user_id}

**Response**:

```json
{
  "recommendations": [
    {
      "problem_id": "...",
      "title": "Coin Change",
      "reason": "Targets your DP weakness",
      "difficulty": "medium",
      "estimated_success": 0.6,
      "tags": ["dynamic_programming", "arrays"]
    }
  ]
}
```
