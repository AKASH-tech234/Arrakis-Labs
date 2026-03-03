# Arrakis Lab 🪐

> _"Failures shouldn't just return a verdict. They should return direction."_ 

Arrakis Lab is a next-generation **full-stack competitive programming ecosystem** designed to transform the traditional "Submit and Fail" cycle into a **continuous learning loop**. While traditional judges stop at a "Wrong Answer" verdict, Arrakis Lab utilizes a deterministic AI engine to provide context-aware guidance, mistake-pattern tracking, and structured improvement paths.

The platform pairs a sandboxed code execution pipeline with a machine learning diagnostic layer (MIM) and LLM-powered explanation agents. Every analytical decision (root cause, pattern, difficulty) is made deterministically by trained ML models. LLM agents receive those decisions as structured instructions and produce natural language — they never override the diagnostic layer.


---

## 🚀 The Philosophy: The Learning Loop

Arrakis Lab moves beyond the isolated submission model. Every interaction is part of a structured developer workflow:

**Discover → Solve → Run → Hidden Submit → Analyze → Improve**

Instead of treating each submission as an isolated event, the platform treats it as part of a continuous learning loop — where every attempt feeds into structured improvement. Instead of treating AI as a "magic box" that guesses solutions, we built a **Deterministic Learning Engine** that ensures feedback is grounded, consistent, and data-driven.

The hardest part wasn't adding AI. It was making sure the system stayed disciplined — deterministic logic, clean memory, and feedback that doesn't contradict itself over time.

---

## 🔎 Key Features at a Glance

| Feature                              | Highlights                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **💻 Robust Execution & Sandbox**    | Piston API for isolated, language-agnostic sandboxed execution. Dynamic stress test generation beyond static test cases to catch edge cases.                                                |
| **🧠 AI Learning Engine**            | Deterministic decision layer → Pinecone-backed RAG pipeline → Structured feedback workflows. Progressive hints, focused learning guidance, and memory closure for compounding intelligence. |
| **🏆 Real-Time Contests**            | WebSocket-powered live updates, Redis-backed sub-millisecond leaderboards, automated start/end scheduling, and safe fallback handling.                                                      |
| **📝 Online Assessment Mode**        | Timed sessions, adaptive difficulty strategies, integrity checks (tab-switch, fullscreen exit, devtools detection), and automated report generation.                                        |
| **📅 POTD + Streak Tracking**        | Daily curated problems with attempt tracking and calendar-style consistency tracking.                                                                                                       |
| **📊 Comprehensive User Profile**    | Unified dashboard with submission stats, AI feedback history, detected mistake patterns, difficulty progression, and learning insights over time.                                           |
| **🔗 External Platform Integration** | Bind LeetCode, Codeforces, and CodeChef accounts to view consolidated stats inside Arrakis Lab.                                                                                             |
| **🛡️ RBAC-Based Admin Panel**        | Question/testcase CRUD, CSV uploads, contest lifecycle management, disqualification controls, announcements, and audit logging.                                                             |
| **💬 Community Layer**               | Discussion threads, solution sharing, and public profile visibility.                                                                                                                        |

---

## 🛠 Tech Stack

| Layer                 | Technology                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| **Frontend**          | React 19, Vite, Tailwind CSS 4, Monaco Editor, Framer Motion, Spline 3D                                 |
| **Backend**           | Node.js, Express, MongoDB (Mongoose), ioredis                                                           |
| **Real-time / Cache** | WebSockets (ws), Redis                                                                                  |
| **AI Service**        | FastAPI, LangChain, LangGraph, LightGBM (Deterministic Decision Engine + Structured Feedback Workflows) |
| **Vector Database**   | Pinecone Serverless (384-dim embeddings, cosine similarity)                                             |
| **Code Execution**    | Piston API (Docker-sandboxed, 8 languages)                                                              |
| **LLM Providers**     | Groq (llama-3.3-70b) with Google Gemini (2.5-flash) fallback                                            |

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [AI Learning Engine](#2-ai-learning-engine)
3. [Competitive Programming Workflow](#3-competitive-programming-workflow)
4. [Contests](#4-contests)
5. [Online Assessment Mode](#5-online-assessment-mode)
6. [RBAC and Admin Panel](#6-rbac-and-admin-panel)
7. [User Profiles and Integrations](#7-user-profiles-and-integrations)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Setup Instructions](#9-setup-instructions)
10. [Engineering Principles](#10-engineering-principles)
11. [Recognition](#11-recognition)

---

## 1. System Architecture

Three independently deployed services communicating over HTTP and WebSocket, backed by MongoDB, Redis, and Pinecone.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                       │
│               React 19 · Vite · Tailwind CSS 4 · Monaco Editor          │
│                          Static Site (SPA)                               │
└────────────────────────┬───────────────────────┬─────────────────────────┘
                         │ HTTP/REST             │ WebSocket
                         ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                        │
│            Node.js · Express · Mongoose · ioredis · ws                   │
│                                                                          │
│  Auth · Problems · Judge · Contests · OA · POTD · Profiles · Admin       │
│  Schedulers: Contest (30s poll) · POTD (cron 00:00 UTC) · OA (10s poll)  │
└──────┬──────────────┬──────────────┬──────────────┬──────────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
  ┌─────────┐   ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐
  │ MongoDB │   │  Redis   │  │  Piston  │  │       AI SERVICE          │
  │  Atlas  │   │ (leaderb │  │  (code   │  │  FastAPI · LangChain ·    │
  │         │   │  + cache)│  │  sandbox)│  │  LangGraph ·   │
  └─────────┘   └──────────┘  └──────────┘  │                           │
                                            │  MIM Engine   
                                            │  LLM Agents (Groq/Gemini) │
                                            │  RAG Memory (Pinecone)    │
                                            └───────────────────────────┘
```

### Frontend

React 19 SPA built with Vite. Monaco Editor for code editing with a custom dark theme. Framer Motion for animations. Spline 3D on the landing page. Tailwind CSS 4 with a custom desert-toned design system (sand, spice, obsidian palette). No Redux or external state library — state is managed through three React Context providers: `AuthContext`, `AdminAuthContext`, and `SubmissionContext` (the latter uses `useReducer`).

Vendor and editor code are split into separate chunks via Vite's manual chunking for load performance.

### Backend

Express.js server (ES Modules) handling authentication, problem management, code execution, contests, online assessments, POTD, profiles, and admin operations. Three timer-based schedulers run in-process — contest lifecycle (30s polling + setTimeout for upcoming starts), POTD publishing (node-cron at midnight UTC), and OA session management (10s polling).

### AI Service

FastAPI server with a strict two-layer architecture. The Machine Intelligence Model (MIM) is the analytical core — trained LightGBM classifiers plus deterministic rule engines make all diagnostic decisions. LLM-powered agents (orchestrated via LangChain and LangGraph) receive those decisions as structured instructions and produce natural-language feedback. This separation is enforced at the code level: agents cannot access or modify MIM outputs.

### Databases and External Services

| Service                 | Role                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MongoDB Atlas**       | Primary datastore — users, problems, submissions, contests, OA sessions, audit logs, cognitive profiles                                                         |
| **Redis**               | Contest leaderboards (sorted sets), agent response caching, pub/sub for WebSocket broadcasts. Optional — all Redis operations gracefully degrade if unavailable |
| **Pinecone Serverless** | Vector store for RAG user memory (384-dim embeddings, cosine similarity)                                                                                        |
| **Piston API**          | Sandboxed code execution via Docker containers. Supports JavaScript, Python, Java, C++, C, TypeScript, Go, Rust                                                 |
| **Groq**                | Primary LLM provider (llama-3.3-70b-versatile with mixtral-8x7b-32768 fallback)                                                                                 |
| **Google Gemini**       | Fallback LLM provider (gemini-2.5-flash), activated when Groq is rate-limited                                                                                   |

---

## 2. AI Learning Engine

The AI service processes every submission through a pipeline that separates analytical decisions from natural language generation.

### Decision Layer (MIM)

MIM is the diagnostic core. It operates without LLM calls — all decisions are made by trained ML models and deterministic rule engines.

**Root Cause Classification (Model A)**
LightGBM multiclass classifier (300 trees, depth 10) predicting one of five root causes:

| Root Cause                  | When Assigned                                                     |
| --------------------------- | ----------------------------------------------------------------- |
| `correctness`               | Logic errors — wrong invariants, boundary mistakes, missing cases |
| `efficiency`                | Correct logic but exceeds time/memory constraints                 |
| `implementation`            | Correct approach but flawed translation to code                   |
| `understanding_gap`         | Misunderstood constraints or problem requirements                 |
| `problem_misinterpretation` | Solved a fundamentally different problem than what was asked      |

Each root cause maps to a constrained set of valid subtypes. This mapping is enforced at runtime — any prediction outside the mask raises `SubtypeValidationError`.

**Subtype Classification (Model B)**
Separate LightGBM classifiers per root cause. Invalid subtypes get probability zeroed via masking. The taxonomy includes subtypes like `wrong_invariant`, `incorrect_boundary`, `brute_force_under_constraints`, `state_loss`, `misread_constraint`, and others.

**Failure Mechanism Derivation**
Pure function (no ML) that maps `(subtype, code_signals)` to a specific failure mechanism from 30+ defined mechanisms — for example, `off_by_one`, `invariant_drift`, `exponential_path_explosion`, `missing_state_dimension`. Never returns "unknown" or "generic".

**Feature Extraction**
60-dimension feature vector covering submission structure (loops, recursion, data structures), error semantics, problem metadata, temporal signals (session velocity, retries), and historical performance. Additionally, 33 code structure features are extracted via AST analysis (Python) or regex fallback (C++, Java, JavaScript) — loop depth, boundary check patterns, off-by-one risk scores, cyclomatic complexity estimates.

**Confidence Calibration (Phase 2.1)**
Post-hoc isotonic regression on Model A outputs. Conservative cap at 0.90. Three tiers gate downstream behavior:

| Tier   | Threshold | Effect                                                                                          |
| ------ | --------- | ----------------------------------------------------------------------------------------------- |
| HIGH   | ≥ 0.80    | Full pipeline, assertive language                                                               |
| MEDIUM | ≥ 0.65    | Standard pipeline                                                                               |
| LOW    | < 0.65    | Conservative mode — blocks difficulty increases, blocks pattern evidence, blocks memory storage |

### Pattern Tracking (Phase 2.2)

State machine tracking recurring mistake patterns per user:

```
NONE ──(1.0 weighted evidence)──► SUSPECTED ──(2.5)──► CONFIRMED ──(4.0)──► STABLE
  ▲                                    │                     │                  │
  └────────────(30d inactivity)────────┴──(temporal decay)───┴──────────────────┘
```

Evidence is weighted by confidence tier (HIGH adds full weight, MEDIUM partial, LOW adds nothing). Temporal decay with 14-day half-life. Inactivity beyond 30 days demotes the pattern state. Pattern state feeds into both difficulty decisions and agent tone.

### Difficulty Policy (Phase 2.3)

Five sequential gates evaluate whether a difficulty adjustment is allowed:

1. **Confidence Gate** — LOW confidence blocks increases
2. **Pattern State Gate** — SUSPECTED or CONFIRMED patterns block increases
3. **Cooldown Gate** — 5 submissions must pass after last difficulty change
4. **Hysteresis Gate** — 3 consecutive eligible submissions required for increase
5. **Directional Bias Gate** — decreases are always allowed

A frustration index (weighted: consecutive failures 0.4, window failure rate 0.35, retry factor 0.25) and boredom index are computed to inform the proposed adjustment before the gates evaluate it.

### Agent Layer

Agents receive structured instructions from MIM and produce natural language. They cannot modify diagnosis or difficulty decisions.

| Agent        | Input                                                                           | Output                                                                               | Budget |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| **Feedback** | `FeedbackInstruction` (root cause, subtype, failure mechanism, tone directives) | Explanation, improvement hint, detected pattern, correct code, concept reinforcement | 20s    |
| **Hint**     | `HintInstruction` (direction, avoid-revealing constraints)                      | Single 20-word compressed hint                                                       | 8s     |
| **Learning** | `LearningInstruction` (focus areas, skill gap)                                  | Focus areas, rationale, exercises                                                    | Async  |
| **Report**   | Aggregated weekly data                                                          | Summary, strengths, improvement areas, recurring patterns                            | Async  |

Agents use a shared execution framework (`run_json_agent`) that handles Redis cache checks, rate limit detection, context truncation (3500 chars), LLM invocation via `ChatPromptTemplate` + `PydanticOutputParser`, retry on parse failure, and cache writes. LLM failover is automatic: Groq → Gemini with per-provider cooldowns (60s and 120s respectively).

### RAG Memory Pipeline

User mistake history is stored as vector embeddings in Pinecone and retrieved for context during feedback generation.

**Storage Gate** — Quality scoring before any memory is stored:

- MIM confidence weight: 0.35
- Pattern recurrence: 0.25
- Content completeness: 0.25
- User feedback: 0.15
- Threshold: 0.60 (below this, the memory is discarded)
- LOW confidence submissions are blocked entirely

**Retrieval** — Context-aware query construction using root cause, subtype, and pattern state. Results pass through a relevance gate that filters low-quality matches.

**Embeddings** — sentence-transformers/all-MiniLM-L6-v2 (384 dimensions, L2 normalized). Pre-loaded at startup.

### Sync vs Async Workflows

Orchestrated via LangGraph `StateGraph`:

**Sync workflow** (returns to user, 45s budget):

1. Retrieve user memory from Pinecone (8s)
2. Retrieve problem context from backend API (8s)
3. MIM prediction — feature extraction, ML inference, taxonomy validation, pattern engine, difficulty engine (3s)
4. Feedback agent — LLM call (20s)
5. Hint agent — LLM call (8s)

**Async workflow** (fire-and-forget after sync completes):

1. Learning agent → concept-level recommendations
2. Difficulty adjustment → persist to profile
3. Store memory → quality-gated Pinecone write
4. Persist cognitive profile → MongoDB update

The orchestrator skips pipeline stages based on verdict and difficulty:

| Verdict  | Difficulty | Sync Path     | Async Path                    |
| -------- | ---------- | ------------- | ----------------------------- |
| Accepted | Easy       | Skip all      | Light RAG only                |
| Accepted | Medium     | Feedback only | Learning + store memory       |
| Accepted | Hard       | Feedback only | Learning + MIM + store memory |
| Failed   | Any        | Full pipeline | Full async pipeline           |

### Guardrails

**Idempotency** — MD5 hash of `(user_id, problem_id, verdict, code_hash)` with 30-second TTL. Deduplicates within the window.

**Verdict Guard** — Determines which pipeline stages to execute based on verdict and difficulty, preventing unnecessary computation for easy accepted submissions.

---

## 3. Competitive Programming Workflow

### Run vs Submit

Two distinct code execution paths:

| Action     | Endpoint           | Test Cases                               | Saves to DB             | AI Feedback     |
| ---------- | ------------------ | ---------------------------------------- | ----------------------- | --------------- |
| **Run**    | `POST /api/run`    | Visible only                             | No                      | No              |
| **Submit** | `POST /api/submit` | Visible + hidden + dynamically generated | Yes (Submission record) | Yes (triggered) |

Rate limits: 20 runs/minute, 20 submits/minute (skipped in development).

### Code Execution

All code runs through the Piston API (sandboxed Docker containers):

- **Languages**: JavaScript (18.15.0), Python (3.10.0), Java (15.0.2), C++ (10.2.0), C (10.2.0), TypeScript (5.0.3), Go (1.16.2), Rust (1.68.2)
- **Limits**: 64KB code size, 1MB stdin, configurable per-test time limits
- **Retry**: 2 retries with exponential backoff on Piston failures

### Hidden Test Cases and Dynamic Generation

On `submit`, the judge runs three categories of test cases:

1. **Visible test cases** — stored in the `TestCase` collection, visible to the user
2. **Hidden test cases** — stored with `isHidden: true`, results shown but inputs hidden
3. **Dynamically generated tests** — generated at submission time for registered problems:
   - Per-problem configs with reference solutions and custom input generators
   - Type-based generators for common structures (arrays, trees)
   - Dynamic analysis of existing test cases to infer input patterns
   - Edge cases, random cases, stress cases, and adversarial cases

### Verdict Processing

Verdicts: `accepted`, `wrong_answer`, `time_limit_exceeded`, `runtime_error`, `compilation_error`, `memory_limit_exceeded`.

On submission:

1. Code executes against all test case categories
2. Outputs are compared (stdout match)
3. Submission record created with verdict, test results, and attempt number
4. Question acceptance stats updated
5. If the user is authenticated, AI feedback is triggered asynchronously

### Progressive Hints

AI feedback includes tiered hints revealed progressively to the user:

1. **Conceptual** — general algorithmic direction
2. **Specific** — targeted hint about the specific mistake
3. **Approach** — detailed approach description
4. **Solution** — near-complete guidance

The frontend manages hint reveal state through `SubmissionContext`'s reducer, tracking which level has been revealed per submission.

---

## 4. Contests

### Contest Lifecycle

```
draft ──► scheduled ──► live ──► ended
                │                  │
                └──► cancelled     └──► (final ranks computed)
```

**State transitions** are managed by the contest scheduler:

- Polls every 30 seconds for contests past their start/end times
- Pre-schedules `setTimeout` timers for contests starting within 1 hour
- On start: sets status to `live`, initializes Redis leaderboard, broadcasts via WebSocket
- On end: sets status to `ended`, freezes leaderboard, calculates final ranks, broadcasts

### WebSocket Events

The WebSocket server is mounted at `/ws/contest` using the native `ws` library.

**Client → Server:**

| Message           | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `authenticate`    | Attach JWT (also auto-attempted from cookies on connect) |
| `join_contest`    | Join a contest room to receive leaderboard updates       |
| `leave_contest`   | Leave a contest room                                     |
| `get_leaderboard` | Request current leaderboard snapshot                     |
| `get_time`        | Server timestamp for clock sync                          |
| `ping`            | Heartbeat                                                |

**Server → Client:**

| Message              | Purpose                                |
| -------------------- | -------------------------------------- |
| `leaderboard_update` | Score change broadcast                 |
| `contest_start`      | Contest has begun                      |
| `contest_end`        | Contest has ended                      |
| `announcement`       | Admin announcement to all participants |

Heartbeat: 30-second ping/pong interval. Stale clients are terminated.

### Redis Leaderboard

Composite scoring in a Redis sorted set: `(problemsSolved × 10,000,000) + (MAX_TIME - totalTimeSeconds)`. This produces automatic ICPC-style ranking where more problems solved ranks higher, and among equal solve counts, faster total time ranks higher.

Operations use Redis pipelines (ZADD + HSET + EXPIRE + PUBLISH) with 24-hour TTL. The leaderboard can be frozen mid-contest. All Redis operations include graceful fallback if Redis is unavailable.

### Contest Judge

Separate from the main judge. Rate limited at 30 runs/minute and 10 submits/minute per user per contest. Validates contest is live, user is registered and not disqualified. Records `ContestSubmission` and updates the Redis leaderboard.

Supported ranking types: LCB, ICPC, IOI. Configurable penalty for wrong submissions. Optional partial scoring.

---

## 5. Online Assessment Mode

A full OA simulation engine with company-specific patterns, timed sessions, proctoring, and post-session reporting.

### Timed Sessions

Session lifecycle: `scheduled → live → submitted | terminated | expired`

- The OA scheduler polls every 10 seconds to transition session states
- Sessions that exceed their duration are automatically expired
- Stale scheduled sessions (>24 hours old) are cleaned up
- Timer sync endpoint (`GET /sessions/:id/sync`) lets the frontend maintain accurate countdown clocks

### Company Patterns

Pre-seeded company OA templates (Google, Amazon, Meta, etc.) with:

- Topic weight distributions (e.g., Google weights graph problems higher)
- Difficulty distributions per question slot
- Duration and question count configurations

The question selection engine uses adaptive difficulty based on user history, topic weighting from the company pattern, and deduplication against previously seen problems.

### Integrity Checks

Proctoring tracks violations:

| Violation Type    | Detection               |
| ----------------- | ----------------------- |
| `tab_hidden`      | Browser visibility API  |
| `blur`            | Window blur events      |
| `fullscreen_exit` | Fullscreen API change   |
| `devtools`        | DevTools open detection |

Configurable warning thresholds with escalating actions: `warn → auto-submit → terminate`. Violations are stored with timestamps and warning numbers.

### Reporting

Post-session reports include:

- Overall score and coding performance metrics
- Topic-wise breakdown
- Difficulty-wise breakdown
- Time analysis per question
- Integrity assessment (violation summary)
- Insights and recommendations

Reports are auto-generated for expired sessions and available on-demand for submitted sessions.

---

## 6. RBAC and Admin Panel

### Authentication Model

Two separate authentication systems:

| System         | Model                                   | Token                                         | Expiry  |
| -------------- | --------------------------------------- | --------------------------------------------- | ------- |
| **User auth**  | `User` (email/password, Google, GitHub) | JWT with `{ id }`                             | 7 days  |
| **Admin auth** | `Admin` (email/password)                | JWT with `{ id, email, role, isAdmin: true }` | 8 hours |

Admin tokens include an `isAdmin` flag checked by middleware. The `Admin` model supports two roles: `super_admin` (full access) and `admin` (standard admin access).

A granular RBAC permission system is defined (`problems:*`, `contests:*`, `users:read`, `submissions:*`, `leaderboard:*`, `system:read`) with role-to-permission mappings for five roles (super_admin, admin, problem_setter, moderator, contest_manager), though the active admin routes use the simpler `verifyAdmin` / `requireSuperAdmin` middleware.

### Admin Capabilities

**Dashboard** — Aggregate counts of questions (by difficulty), test cases (hidden/visible split), submissions (by verdict), and total users.

**Question Management** — Full CRUD for problems with fields for title, description, difficulty, tags, companies, constraints, examples. Test case management with visibility toggle (hidden/visible), ordering, and per-case time/memory limits.

**CSV Upload** — Bulk import of questions and test cases from CSV. Multer handles file upload (5MB limit). The pipeline: parse with csv-parser, validate required columns, sanitize against CSV injection, preview mode for dry-run validation, transactional import in chunks of 25 rows (max 50 per upload). Test cases can be embedded as JSON in CSV rows and are auto-converted to stdin format.

**Contest Management** — Full lifecycle control: create, publish, start, end, cancel. View registrations and submissions. Disqualify participants. Send real-time announcements via WebSocket. View submission code.

**POTD Management** — Schedule problems for future dates. View POTD analytics. Force-publish for immediate override. Monitor scheduler status.

**Audit Logs** — All admin write operations are logged via `auditLog` middleware. The `AuditLog` collection records admin ID, action type, resource type, details, and IP address. Accessible only to super_admin with pagination and filters (action, admin, date range).

---

## 7. User Profiles and Integrations

### Public Profiles

Users can view their own profile at `/profile` or another user's at `/u/:username`. Profile analytics include submission history, category performance, activity patterns, and AI-generated cognitive assessments.

Visibility settings are configurable — users control what sections of their profile are public via `PublicProfileSettings`.

### External Platform Binding

The backend syncs competitive programming stats from three external platforms:

| Platform       | Method                                          | Data Retrieved                                                                                                           |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **LeetCode**   | GraphQL API                                     | Solved counts by difficulty, contest rating/history, submission calendar (activity heatmap), contest participation count |
| **Codeforces** | REST API (`/api/user.info`, `/api/user.status`) | Rating, max rating, problem difficulty breakdown, submission history                                                     |
| **CodeChef**   | HTML scraping (Cheerio)                         | Stars, rating, problems solved                                                                                           |

Users link their handles via `POST /api/profile/platform` and trigger sync via `POST /api/profile/platform/:id/sync`. Stats are stored in `PlatformStats` and aggregated into `AggregatedStats` for cross-platform views.

### Stats Aggregation

The `userStatsAggregator` utility computes combined statistics:

- Total problems solved across platforms
- Difficulty distribution
- Ratings and rankings
- Activity heatmap data
- AI profile integration (weak topics, strong topics, difficulty readiness)

Stats update is throttled — if the AI profile was recently refreshed, the aggregator skips recomputation.

### PDF Export

`POST /api/export/pdf` generates a branded PDF profile report using pdfkit. Available in one-page or two-page format. Contents: user info, aggregated stats, platform stats, AI profile (fetched from the AI service), and recent submissions. Streamed directly to the client.

### Cognitive Profile

The AI service maintains a cognitive profile per user in MongoDB (`user_cognitive_profiles` collection). The profile tracks:

- Dominant failure modes and root causes
- Improving, stagnant, and regressing topic areas
- Strong categories and techniques
- Recent transitions in performance
- Difficulty readiness (success probabilities for easy/medium/hard)
- A personalized learning roadmap with phases (foundation → skill building → consolidation → advancement → mastery) and topic dependency graphs

The profile is updated asynchronously after each submission via the async workflow.

### Discussion System

Problem-level discussions with solution posts, threaded comments, and voting. Users can share solution code with markdown explanations. Rate limited at 15 writes per minute.

---

## 8. Deployment Architecture

Three services deployed independently on Render:

```
┌────────────────────────────────────────────────────────────┐
│                         Render Cloud                       │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Frontend   │  │   Backend    │  │   AI Service     │  │
│  │  Static Site │  │ Web Service  │  │  Web Service     │  │
│  │              │  │              │  │                  │  │
│  │  Vite build  │  │  Node.js     │  │  Python 3 +      │  │
│  │  → dist/     │  │  Express     │  │  Uvicorn         │  │
│  │  SPA rewrite │  │  Port 10000  │  │  Port 10000      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                 │                  │             │
└─────────┼─────────────────┼──────────────────┼─────────────┘
          │                 │                  │
          │         ┌───────┴───────┐          │
          │         │               │          │
          │    ┌────▼────┐   ┌──────▼──────┐   │
          │    │ MongoDB │   │    Redis    │   │
          │    │  Atlas  │   │             │   │
          │    └─────────┘   └─────────────┘   │
          │                                    │
          │              ┌─────────────┐       │
          └──────────────│  Pinecone   │───────┘
                         │ Serverless  │
                         └─────────────┘
```

### Health Checks

| Service    | Endpoint             | Purpose                                                   |
| ---------- | -------------------- | --------------------------------------------------------- |
| Backend    | `GET /api/health`    | Returns `{ status: "ok" }`                                |
| Backend    | `GET /api/ai/health` | Proxies to AI service health endpoint                     |
| AI Service | `GET /health`        | Returns health status including LLM provider availability |

### Cold Start Considerations

On Render's free tier, services spin down after 15 minutes idle:

- **Backend** restarts in ~10-15 seconds
- **AI Service** restarts in ~45-90 seconds (ML embedding model loads at startup)
- External ping services (e.g., cron-job.org, UptimeRobot) hitting health endpoints every 14 minutes can prevent spin-down

### Environment Variables

**Backend:**

| Variable           | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `PORT`             | Server port (default: 5001 local, 10000 on Render) |
| `NODE_ENV`         | `development` or `production`                      |
| `MONGODB_URI`      | MongoDB connection string                          |
| `JWT_SECRET`       | JWT signing secret                                 |
| `JWT_EXPIRY`       | Token expiry (default: 7d)                         |
| `AI_SERVICE_URL`   | Python AI service URL                              |
| `FRONTEND_URL`     | Frontend origin (for CORS)                         |
| `REDIS_URL`        | Redis connection string (optional)                 |
| `PISTON_URL`       | Piston API URL                                     |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID                             |

**AI Service:**

| Variable           | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `PORT`             | Server port (default: 8000 local, 10000 on Render) |
| `MONGODB_URI`      | MongoDB connection string                          |
| `GROQ_API_KEY`     | Groq LLM provider API key                          |
| `GOOGLE_API_KEY`   | Google Gemini API key                              |
| `PINECONE_API_KEY` | Pinecone vector store API key                      |
| `REDIS_URL`        | Redis for agent cache (optional)                   |
| `FRONTEND_URL`     | Frontend origin (for CORS)                         |
| `BACKEND_URL`      | Backend URL (for problem context retrieval)        |

**Frontend (build-time):**

| Variable                | Purpose                    |
| ----------------------- | -------------------------- |
| `VITE_API_URL`          | Backend API base URL       |
| `VITE_AI_SERVICE_URL`   | AI service base URL        |
| `VITE_WS_URL`           | WebSocket URL for contests |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID     |

---

## 9. Setup Instructions

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- MongoDB (local or Atlas)
- Redis (optional — leaderboards and agent cache degrade gracefully without it)

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Create `.env`:

```
VITE_API_URL=http://localhost:5001/api
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:5001/ws/contest
```

### Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:5001
```

Create `.env`:

```
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/arrakis
JWT_SECRET=your-secret-key
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
PISTON_URL=https://emkc.org/api/v2/piston
```


### AI Service

```bash
cd ai-services
pip install -r requirement.txt
uvicorn main:app --reload --port 8000
```

Create `.env`:

```
MONGODB_URI=mongodb://localhost:27017/arrakis
GROQ_API_KEY=your-groq-key
GOOGLE_API_KEY=your-gemini-key
BACKEND_URL=http://localhost:5001
FRONTEND_URL=http://localhost:5173
```

The embedding model downloads automatically on first startup (~90MB).

---

## 10. Engineering Principles

**Determinism over hallucination.** Every diagnostic decision — root cause, subtype, failure mechanism, pattern state, difficulty adjustment — is made by trained ML models or deterministic rule engines. LLMs generate natural language from structured instructions. They cannot override, modify, or bypass MIM decisions. This makes the diagnostic layer testable, reproducible, and auditable.

**Strict taxonomy enforcement.** The root cause → subtype mapping is a runtime constraint, not documentation. Any prediction outside the mask raises a `SubtypeValidationError`. Pydantic schemas use `extra="forbid"` — unknown fields fail validation at the boundary. Training data is validated against canonical schemas before use.

**Accepted and failed paths never cross.** Separate training datasets (parquet files), separate feature extractors (`UserStateTracker` for failures, `StrengthUpdater` for accepted), separate output schemas (`CorrectnessFeedback` vs `ReinforcementFeedback`), and separate code paths in the inference node. An accepted submission never produces a root cause or subtype.

**Confidence gates downstream decisions.** Every MIM prediction carries a calibrated confidence score. Low confidence triggers conservative mode across the entire pipeline — difficulty increases are blocked, pattern evidence is discarded, memory storage is skipped, and agent language becomes less assertive. This prevents half-confident diagnoses from polluting user profiles.

**Quality-gated memory.** Not every submission produces a stored memory. The RAG storage gate scores each potential memory against four weighted criteria (MIM confidence, pattern recurrence, content completeness, user feedback) and discards anything below the threshold. This prevents noise accumulation in the vector store.

**Async orchestration.** The sync workflow has a 45-second budget and returns feedback to the user. Profile updates, memory storage, difficulty adjustments, and learning recommendations run asynchronously after the response is sent. This keeps response times bounded while ensuring the user's cognitive profile stays current.

**Graceful degradation at every layer.** LLM providers fail over (Groq → Gemini with cooldowns). ML models fall back to sklearn if LightGBM is unavailable. MIM preserves partial results on error. RAG returns empty memory and the pipeline still generates feedback. Redis operations return fallback data when unavailable. The system produces useful output even when individual components fail.

---

## Project Structure

```
arrakis-labs/
├── frontend/                  # React SPA
│   └── src/
│       ├── components/        # UI components (editor, feedback, mim, admin, potd, oa)
│       ├── context/           # AuthContext, AdminAuthContext, SubmissionContext
│       ├── hooks/             # Custom hooks (AI feedback, contests, OA, profiles)
│       ├── pages/             # Route pages (problems, contests, OA, admin, profile)
│       ├── services/          # API clients (ai, admin, contest, potd, OA, profile)
│       └── utils/             # Logger, formatters
├── backend/                   # Node.js API
│   └── src/
│       ├── controllers/       # Route handlers (auth, judge, contest, OA, admin, profile)
│       ├── middleware/        # Auth (JWT), admin (RBAC), audit logging
│       ├── models/            # Mongoose schemas (25+ collections)
│       ├── routes/            # Express route definitions
│       ├── services/          # Contest scheduler, leaderboard, POTD scheduler, OA engine,
│       │                      #   platform sync (LeetCode/Codeforces/CodeChef), Piston judge
│       └── utils/             # Stats aggregator, format converters
├── ai-services/               # Python AI engine
│   └── app/
│       ├── mim/               # MIM engine (14 sub-modules)
│       │   ├── inference/     # Decision node, feature extraction
│       │   ├── taxonomy/      # Root causes, subtypes, failure mechanisms
│       │   ├── features/      # Delta features, state snapshots, signal extraction
│       │   ├── code_signals/  # AST analysis, pattern detection
│       │   ├── calibration/   # Isotonic regression, threshold validation
│       │   ├── signals/       # Regression detection, confidence adjustment
│       │   ├── training/      # Dataset builder, model training
│       │   ├── production/    # Model registry, shadow mode, drift detection
│       │   └── models/        # Serialized LightGBM models
│       ├── agents/            # LLM agents (feedback, hint, learning, report)
│       ├── rag/               # Vector retrieval, quality gates, context builder
│       ├── graph/             # LangGraph orchestration (sync/async workflows)
│       ├── guardrails/        # Idempotency, verdict guards
│       ├── cache/             # Redis agent cache
│       └── db/                # MongoDB client, cognitive profile store
└── docs/                      # Architecture documentation
```
