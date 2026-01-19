# Arrakis Labs

> **AI-Powered Competitive Programming & Learning Platform**  
> Build coding mastery through intelligent feedback, real-time contests, and adaptive learning paths.

---

## Project Overview

**Arrakis Labs** (branded as **Mentat Trials**) is a full-stack competitive programming platform that combines traditional coding challenges with AI-driven personalized feedback. The platform enables users to solve algorithmic problems, participate in timed contests, and receive intelligent guidance that adapts to their learning patterns.

### Who It's For

- **Students** learning data structures and algorithms
- **Competitive programmers** preparing for coding interviews and contests
- **Educators** running coding assessments and contests
- **Developers** seeking to improve problem-solving skills with AI assistance

### What Problem It Solves

Traditional coding platforms provide binary feedback (pass/fail), leaving learners without guidance on *why* their solution failed or *how* to improve. Arrakis Labs bridges this gap by:

- Analyzing code submissions with AI agents powered by LangGraph
- Building a memory of user mistakes and patterns (RAG-based retrieval)
- Providing contextual, actionable feedback tailored to individual learning trajectories
- Enabling real-time competitive coding through WebSocket-powered leaderboards
- Offering admin tools for contest creation, problem management, and plagiarism detection

---

## Key Features

### 🧠 AI-Powered Feedback
- **Memory-driven analysis**: AI agents remember past mistakes and patterns
- **Contextual hints**: Actionable improvement suggestions without revealing full solutions
- **Learning recommendations**: Personalized focus areas based on submission history
- **Difficulty adjustment**: Dynamic problem difficulty based on performance

### 🏆 Real-Time Contests
- **Live leaderboards**: WebSocket-driven updates with sub-second latency
- **Automated scheduling**: Contest state transitions (scheduled → live → ended)
- **Multi-problem format**: Support for diverse problem sets
- **Penalty scoring**: Time-based penalties for incorrect submissions

### ⚡ Code Execution & Judging
- **Multi-language support**: Python, JavaScript, Java, C++
- **Sandboxed execution**: Secure code execution via Piston API
- **Hidden test cases**: Prevent gaming the system
- **Detailed results**: Test-by-test breakdown with visible/hidden distinction

### 🔐 Security & Access Control
- **JWT authentication**: Secure session management with HTTP-only cookies
- **Role-based access**: Separate admin and user roles
- **Rate limiting**: Prevent abuse of code execution and API endpoints
- **Input sanitization**: MongoDB injection prevention with express-mongo-sanitize
- **CORS protection**: Strict origin validation

### 📊 Admin Dashboard
- **Problem management**: Create, edit, and organize coding problems
- **Test case editor**: Manage visible and hidden test cases
- **Contest lifecycle**: Schedule, monitor, and finalize contests
- **User management**: View submissions, analytics, and user stats
- **CSV import**: Bulk problem upload from external datasets

---

## System Architecture

```
┌─────────────────┐
│   Frontend      │ React + Vite + Monaco Editor
│  (Port 5173)    │ WebSocket Client
└────────┬────────┘
         │ REST + WS
         ▼
┌─────────────────┐
│   Backend       │ Express.js + MongoDB
│  (Port 5000)    │ WebSocket Server + Scheduler
└────┬────┬───────┘
     │    │
     │    └────────────────┐
     │                     │
     ▼                     ▼
┌─────────────┐    ┌──────────────┐
│ Piston API  │    │ AI Service   │ FastAPI + LangGraph
│ (External)  │    │ (Port 8000)  │ LangChain Agents
└─────────────┘    └──────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │ Chroma DB    │ Vector Store
                   └──────────────┘
```

### Data Flow

1. **User submits code** → Backend validates and executes via Piston
2. **Backend saves submission** → MongoDB stores result
3. **If failed** → Backend fetches user history → Calls AI service
4. **AI service**:
   - Retrieves user memory from Chroma vector store
   - Runs LangGraph workflow (feedback → learning → difficulty agents)
   - Returns structured feedback
5. **Backend returns** → Submission result + AI feedback to frontend
6. **WebSocket broadcasts** → Leaderboard updates for active contests

---

## Repository Structure

```
arrakis-labs/
├── backend/               # Node.js Express API
│   ├── src/
│   │   ├── app.js        # Main server setup
│   │   ├── controllers/  # Route handlers
│   │   │   ├── authController.js
│   │   │   ├── judgeController.js
│   │   │   ├── contestController.js
│   │   │   ├── adminController.js
│   │   │   └── ...
│   │   ├── models/       # MongoDB schemas
│   │   │   ├── User.js
│   │   │   ├── Question.js
│   │   │   ├── Submission.js
│   │   │   ├── Contest.js
│   │   │   └── ...
│   │   ├── routes/       # API route definitions
│   │   ├── middleware/   # Auth, rate limiting, error handling
│   │   ├── services/     # Business logic
│   │   │   ├── aiService.js          # AI service client
│   │   │   ├── leaderboardService.js # Redis leaderboard
│   │   │   ├── websocketServer.js    # Real-time updates
│   │   │   └── contestScheduler.js   # Automated state transitions
│   │   └── utils/        # Helpers
│   ├── .env              # Environment variables
│   └── package.json
│
├── frontend/             # React SPA
│   ├── src/
│   │   ├── App.jsx       # Main router
│   │   ├── pages/        # Route components
│   │   │   ├── landing.jsx
│   │   │   ├── problem.jsx
│   │   │   ├── problemdetail.jsx
│   │   │   ├── contest/  # Contest pages
│   │   │   └── admin/    # Admin dashboard
│   │   ├── components/   # Reusable UI components
│   │   │   ├── feedback/ # AI feedback display
│   │   │   ├── admin/    # Admin components
│   │   │   └── ...
│   │   ├── context/      # React Context providers
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API clients
│   │   └── utils/        # Frontend utilities
│   ├── .env              # Frontend environment variables
│   └── package.json
│
├── ai-services/          # Python FastAPI microservice
│   ├── main.py           # FastAPI app entry point
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py # /ai/feedback endpoint
│   │   ├── agents/       # LangGraph agents
│   │   │   ├── feedback_agent.py
│   │   │   ├── learning_agent.py
│   │   │   ├── difficulty_agent.py
│   │   │   └── report_agent.py
│   │   ├── graph/
│   │   │   └── workflow.py # LangGraph workflow orchestration
│   │   ├── rag/          # RAG components
│   │   │   ├── retriever.py
│   │   │   ├── embeddings.py
│   │   │   └── vector_store.py
│   │   ├── schemas/      # Pydantic models
│   │   ├── cache/        # Agent response caching
│   │   ├── prompts/      # LLM prompts
│   │   └── services/     # LLM clients
│   ├── vector_db/        # Chroma persistent storage
│   ├── agent_cache/      # JSON cache for agent responses
│   └── requirement.txt
│
├── shared/               # Shared DTOs (future use)
│   └── dto/
│
└── docs/                 # Documentation
    ├── ADMIN_PANEL.md
    └── ADMIN_PANEL_DESIGN.md
```

---

## Backend Overview

### Express Application Structure

The backend is a modular Express.js application organized by domain:

**Core Components:**
- **`app.js`**: Server initialization, middleware setup, route registration
- **Controllers**: Business logic for auth, problems, contests, admin operations
- **Models**: Mongoose schemas for MongoDB collections
- **Services**: Stateful services (WebSocket, scheduler, leaderboard, AI client)
- **Middleware**: Authentication, rate limiting, input sanitization

### Authentication & Authorization

- **JWT-based**: Tokens stored in HTTP-only cookies
- **Role system**: `user` and `admin` roles
- **Middleware**: `protect` (requires auth), `optionalAuth` (conditional), `adminProtect` (admin-only)
- **Password hashing**: bcrypt with salt rounds

### Contest Lifecycle

1. **Creation**: Admins create contests with problems, start/end times
2. **Scheduling**: `contestScheduler.js` uses timers to transition states
3. **Registration**: Users register before start time
4. **Live phase**: Users submit solutions, leaderboard updates via Redis + WebSocket
5. **Finalization**: Scheduler calculates final rankings at end time

### Judge & Piston Integration

- **Piston API**: External service for sandboxed code execution
- **Language support**: Python, JavaScript, Java, C++, C, TypeScript, Go, Rust
- **Retry logic**: Handles transient network failures (3 retries with backoff)
- **Test case management**: Visible (for "run") vs. hidden (for "submit")
- **Verdict types**: Accepted, Wrong Answer, TLE, MLE, Runtime Error, Compile Error

### WebSocket Server

**Purpose**: Real-time updates for active contests

**Features:**
- Contest-specific rooms (users join via `contestId`)
- Leaderboard broadcasts on submission events
- Timer synchronization
- Heartbeat for connection health

**Events:**
- `join_contest`: User joins a contest room
- `leave_contest`: User leaves a room
- `leaderboard_update`: Broadcast new rankings
- `submission_status`: Notify user of their submission result

### Scheduler & Leaderboard

**`contestScheduler.js`:**
- Checks contest states every 30 seconds
- Automatically starts contests at `startTime`
- Automatically ends contests at `endTime`
- Calculates final rankings

**`leaderboardService.js`:**
- Redis sorted sets for O(log N) rank operations
- Composite score: `(problemsSolved * 1e12) - penaltyTime`
- Pub/Sub for real-time updates across services

---

## Frontend Overview

### React Application

Built with **React 19**, **Vite**, and **React Router v7**.

**Key Libraries:**
- **Monaco Editor**: Code editing with syntax highlighting
- **Framer Motion**: Smooth animations
- **Axios**: HTTP client
- **WebSocket API**: Real-time contest updates

### Contest Pages

**`ContestList`**: Browse all contests (scheduled, live, ended)  
**`ContestDetail`**: View contest info, problems, leaderboard  
**`ContestProblem`**: Solve a specific problem within a contest (Monaco editor, submit, leaderboard)

### Admin Panel

Comprehensive dashboard for platform management:

- **Problems**: CRUD operations, test case editor
- **Contests**: Create, schedule, monitor, finalize
- **Users**: View submissions, stats, manage roles
- **CSV Import**: Bulk upload problems from datasets
- **System Monitoring**: Judge workers, AI service status

### WebSocket Integration

**Custom Hook**: `useContestWebSocket(contestId)`

```javascript
// Automatically connects to WS server
// Subscribes to leaderboard updates
// Returns { leaderboard, isConnected, error }
```

**Usage in components:**
```jsx
const { leaderboard } = useContestWebSocket(contestId);
// Leaderboard auto-updates when submissions occur
```

---

## AI Services Overview

### Agent System

Built with **LangChain** and **LangGraph** for composable AI workflows.

**Agents:**
- **Feedback Agent**: Analyzes why code failed, provides improvement hints
- **Learning Agent**: Recommends focus areas based on mistake patterns
- **Difficulty Agent**: Suggests problem difficulty adjustments
- **Report Agent**: Generates weekly performance summaries

### LangGraph Workflow

```python
# Workflow nodes (executed sequentially):
1. retrieve_memory_node    # Fetch user's past mistakes from Chroma
2. build_context_node      # Construct LLM-safe context
3. feedback_node           # Generate feedback
4. parallel_learning_difficulty_node  # Run learning + difficulty in parallel
5. weekly_report_node      # Optional weekly summary
6. store_memory_node       # Save new mistake to vector store
```

### Metrics & Caching

**Caching Strategy:**
- Agent responses cached by hash of `(user_id, problem_id, code, verdict)`
- Cache hits avoid redundant LLM calls
- JSON files stored in `agent_cache/`

**Metrics:**
- Agent execution time logged to `agent_metrics.json`
- Used for performance monitoring and optimization

### Backend Integration

**`aiService.js`** (backend):
- Fetches user submission history
- Builds `user_history_summary` string
- Calls `/ai/feedback` endpoint
- Returns response to user (non-blocking, won't fail submission if AI is down)

**Request Payload:**
```json
{
  "user_id": "...",
  "problem_id": "...",
  "problem_category": "Arrays",
  "constraints": "1 ≤ n ≤ 10^5",
  "code": "...",
  "language": "python",
  "verdict": "Wrong Answer",
  "error_type": "Wrong Answer",
  "user_history_summary": "Recent 20 submissions: 5 accepted, 15 failed. Wrong answers: 10."
}
```

**Response:**
```json
{
  "explanation": "Your solution doesn't handle...",
  "improvement_hint": "Consider edge case...",
  "detected_pattern": "Off-by-one error",
  "learning_recommendation": { "focus_areas": [...], "rationale": "..." },
  "difficulty_adjustment": { "action": "maintain", "rationale": "..." },
  "weekly_report": { ... }
}
```

---

## Local Development Setup

### Prerequisites

- **Node.js**: v18+ (for backend & frontend)
- **Python**: 3.10+ (for AI services)
- **MongoDB**: Atlas account or local instance
- **Redis** (optional): For leaderboards
- **Git**: For version control

### Step-by-Step Setup

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/arrakis-labs.git
cd arrakis-labs
```

#### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, etc.

# Seed admin user (optional)
npm run seed:admin

# Start development server
npm run dev
```

Backend runs at `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd ../frontend
npm install

# Create .env file
cp .env.example .env
# Edit .env with API URL

# Start development server
npm run dev
```

Frontend runs at `http://localhost:5173`

#### 4. AI Services Setup

```bash
cd ../ai-services
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

pip install -r requirement.txt

# Create .env file
echo "GOOGLE_API_KEY=your_key_here" > .env

# Start FastAPI server
uvicorn main:app --reload --port 8000
```

AI service runs at `http://localhost:8000`

#### 5. Verify Setup

- Backend health: `http://localhost:5000/api/health`
- AI health: `http://localhost:8000/health`
- Frontend: `http://localhost:5173`

---

## API Overview

### Auth API (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/signup` | Register new user | Public |
| POST | `/signin` | Login | Public |
| POST | `/logout` | Logout | Protected |
| GET | `/me` | Get current user | Protected |
| PUT | `/update-profile` | Update profile | Protected |
| PUT | `/change-password` | Change password | Protected |

### Problems API (`/api`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/questions` | List public problems | Public |
| GET | `/questions/:id` | Get problem details | Public |
| POST | `/run` | Run code with visible tests | Rate-limited |
| POST | `/submit` | Submit code with all tests | Protected |
| GET | `/submissions` | User's submission history | Protected |

### Contest API (`/api/contests`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all contests | Optional auth |
| GET | `/:id` | Get contest details | Optional auth |
| POST | `/:id/register` | Register for contest | Protected |
| POST | `/:id/join` | Join live contest | Protected |
| GET | `/:id/problems/:problemId` | Get contest problem | Protected |
| POST | `/:id/problems/:problemId/run` | Run code in contest | Protected |
| POST | `/:id/problems/:problemId/submit` | Submit in contest | Protected |
| GET | `/:id/leaderboard` | Get leaderboard | Optional auth |
| GET | `/:id/standing` | Get user's rank | Protected |

### Admin API (`/api/admin`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/login` | Admin login | Public |
| GET | `/problems` | List all problems | Admin |
| POST | `/problems` | Create problem | Admin |
| PUT | `/problems/:id` | Update problem | Admin |
| DELETE | `/problems/:id` | Delete problem | Admin |
| POST | `/upload-csv` | Bulk import problems | Admin |
| GET | `/contests` | List admin contests | Admin |
| POST | `/contests` | Create contest | Admin |
| PUT | `/contests/:id` | Update contest | Admin |
| POST | `/contests/:id/finalize` | Finalize contest | Admin |

### AI API (`/ai`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | AI service health | Public |
| POST | `/feedback` | Generate AI feedback | Internal (backend) |

---

## WebSockets

### Connection

```javascript
const ws = new WebSocket('ws://localhost:5000/ws/contest');
```

### Events

**Client → Server:**
```json
{
  "type": "join_contest",
  "contestId": "contest123",
  "token": "jwt_token_here"
}
```

**Server → Client:**
```json
{
  "type": "leaderboard_update",
  "contestId": "contest123",
  "data": {
    "entries": [
      {
        "userId": "user123",
        "username": "Alice",
        "score": 300,
        "problemsSolved": 3,
        "penalty": 120,
        "rank": 1
      }
    ],
    "event": "submission"
  }
}
```

### Heartbeat

Server sends `ping` every 30 seconds. Clients should respond with `pong` to maintain connection.

---

## Security Considerations

### Rate Limiting

- **API general**: 100 requests / 15 min per IP
- **Auth endpoints**: 10 attempts / 15 min per IP
- **Code execution**: 20 runs / min per user
- **Contest submissions**: 10 submits / min per user per contest

### Input Sanitization

- **express-mongo-sanitize**: Strips `$` and `.` from user input to prevent NoSQL injection
- **Code size limits**: 64KB max for code, 1MB for stdin
- **Validation**: Pydantic for AI service, Mongoose schemas for backend

### Authentication Protection

- **JWT in HTTP-only cookies**: Prevents XSS attacks
- **Password hashing**: bcrypt with automatic salt
- **Token expiry**: Configurable (default 7 days)
- **Logout**: Server-side token invalidation

### CORS

- **Strict origin checking**: Only allowed origins can make requests
- **Credentials enabled**: Allows cookies in cross-origin requests
- **Preflight handling**: OPTIONS requests properly handled

---

## Future Improvements

### Scalability

- **Horizontal scaling**: Containerize services with Docker
- **Load balancing**: Nginx or cloud load balancers
- **Message queue**: Bull/BullMQ for async AI processing
- **Database sharding**: Partition contests/submissions by date

### Containerization

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["5000:5000"]
    depends_on: [mongodb, redis]
  
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
  
  ai-service:
    build: ./ai-services
    ports: ["8000:8000"]
  
  mongodb:
    image: mongo:7
    volumes: [mongo-data:/data/db]
  
  redis:
    image: redis:7-alpine
    volumes: [redis-data:/data]
```

### Cloud Deployment

- **Backend**: AWS ECS / Azure App Service / Google Cloud Run
- **Frontend**: Vercel / Netlify / Cloudflare Pages
- **AI Service**: AWS Lambda (serverless) / Azure Functions
- **Database**: MongoDB Atlas (managed)
- **Redis**: AWS ElastiCache / Azure Cache for Redis
- **Storage**: S3 / Azure Blob (for problem assets)

---

### Code Standards

**Backend (JavaScript):**
- Use ES6+ features
- Follow Airbnb style guide
- Use meaningful variable names
- Add JSDoc comments for functions
- Handle errors gracefully

**Frontend (React):**
- Functional components with hooks
- PropTypes or TypeScript for type safety
- Keep components small and focused
- Use semantic HTML
- Follow accessibility best practices (a11y)

**AI Services (Python):**
- Follow PEP 8 style guide
- Type hints for function signatures
- Docstrings for classes and functions
- Use async/await for I/O operations

## Acknowledgments

- **Piston API**: For providing sandboxed code execution
- **LangChain/LangGraph**: AI agent orchestration framework
- **Monaco Editor**: VSCode-quality code editing in the browser
- **Gemini API**: Powering intelligent feedback generation

---

**Built with 🧠 by Arrakis Labs**  
*Master the art of coding through memory, reasoning, and adaptive intelligence.*
