# Backend Documentation

> **Node.js Express API** - The core server handling authentication, code execution, contests, and AI integration.

---

## Overview

The backend is a modular Express.js application that serves as the central hub for:

- User authentication & authorization
- Code execution via Piston API
- Contest management & real-time leaderboards
- AI service integration for feedback
- Admin operations & analytics

**Port**: 5000  
**Database**: MongoDB  
**Real-time**: WebSocket (ws)

---

## Directory Structure

```
backend/
├── src/
│   ├── app.js                    # Main entry point
│   ├── routes.js                 # Route aggregator (optional)
│   │
│   ├── controllers/              # Request handlers
│   │   ├── authController.js
│   │   ├── judgeController.js
│   │   ├── aiController.js
│   │   ├── adminController.js
│   │   ├── contestController.js
│   │   ├── contestJudgeController.js
│   │   ├── adminContestController.js
│   │   ├── profileController.js
│   │   ├── profileAnalyticsController.js
│   │   ├── questionController.js
│   │   ├── testCaseController.js
│   │   ├── csvController.js
│   │   ├── exportController.js
│   │   ├── potdController.js
│   │   ├── adminPOTDController.js
│   │   └── platformProfilesController.js
│   │
│   ├── models/                   # Mongoose schemas
│   │   ├── User.js
│   │   ├── Question.js
│   │   ├── Submission.js
│   │   ├── TestCase.js
│   │   ├── Contest.js
│   │   ├── ContestSubmission.js
│   │   ├── ContestRegistration.js
│   │   ├── Admin.js
│   │   ├── AuditLog.js
│   │   ├── AggregatedStats.js
│   │   ├── PlatformProfile.js
│   │   ├── PlatformStats.js
│   │   ├── POTDCalendar.js
│   │   ├── PublishedPOTD.js
│   │   ├── UserPOTDTracking.js
│   │   ├── UserStreak.js
│   │   └── PublicProfileSettings.js
│   │
│   ├── routes/                   # API route definitions
│   │   ├── authRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── contestRoutes.js
│   │   ├── adminContestRoutes.js
│   │   ├── profileRoutes.js
│   │   ├── publicRoutes.js
│   │   ├── exportRoutes.js
│   │   ├── potdRoutes.js
│   │   ├── adminPOTDRoutes.js
│   │   ├── mimRoutes.js
│   │   └── aiProfileRoutes.js
│   │
│   ├── middleware/               # Express middleware
│   │   ├── authMiddleware.js
│   │   ├── adminMiddleware.js
│   │   ├── adminAuth.js
│   │   └── auditLog.js
│   │
│   ├── services/                 # Business logic services
│   │   ├── aiService.js
│   │   ├── leaderboardService.js
│   │   ├── websocketServer.js
│   │   ├── contestScheduler.js
│   │   ├── potdScheduler.js
│   │   └── profileAggregationService.js
│   │
│   ├── utils/                    # Helper utilities
│   │   ├── stdinConverter.js
│   │   └── userStatsAggregator.js
│   │
│   └── modules/                  # Feature modules (future)
│       ├── ai/
│       ├── judge/
│       ├── problems/
│       └── submissions/
│
├── config/                       # Configuration files
├── public/                       # Static assets
├── .env                          # Environment variables
└── package.json
```

---

## Core Components

### app.js - Main Entry Point

**Purpose**: Initializes the Express server with all middleware and route registrations.

**Key Responsibilities**:

- CORS configuration with credentials support
- Security middleware (helmet, rate-limiting, mongo-sanitize)
- Body parsing with size limits
- Cookie parsing for JWT tokens
- Route registration for all API endpoints
- WebSocket server initialization
- MongoDB connection management
- Scheduler initialization (contests, POTD)

**Middleware Chain**:

```
Request → CORS → Helmet → Rate Limit → Body Parser → Mongo Sanitize → Routes
```

---

## Controllers

### authController.js

**Purpose**: Handles user authentication flows.

| Function         | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `signup`         | Creates new user with hashed password                 |
| `signin`         | Validates credentials, issues JWT in HTTP-only cookie |
| `logout`         | Clears authentication cookie                          |
| `getMe`          | Returns current authenticated user                    |
| `updateProfile`  | Updates user profile fields                           |
| `changePassword` | Validates old password, updates to new                |

**Security Features**:

- Password hashing with bcrypt (salt rounds: 10)
- JWT stored in HTTP-only cookies (prevents XSS)
- Token expiry: 7 days (configurable)

---

### judgeController.js

**Purpose**: Handles code execution and submission judging.

| Function         | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `runCode`        | Executes code against visible test cases                |
| `submitCode`     | Executes code against all test cases (visible + hidden) |
| `getSubmissions` | Retrieves user's submission history                     |

**Piston Integration**:

```javascript
// Language mapping
const LANGUAGE_MAP = {
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "c++", version: "10.2.0" },
  // ... more languages
};
```

**Verdict Types**:

- `Accepted` - All tests passed
- `Wrong Answer` - Output mismatch
- `Time Limit Exceeded` - Execution timeout
- `Memory Limit Exceeded` - Memory exceeded
- `Runtime Error` - Program crashed
- `Compilation Error` - Code failed to compile

**Retry Logic**:

- 3 retries with exponential backoff for Piston API failures

---

### aiController.js

**Purpose**: Interfaces with the AI services for feedback generation.

| Function              | Description                              |
| --------------------- | ---------------------------------------- |
| `requestFeedback`     | Calls AI service for submission feedback |
| `getLearningInsights` | Retrieves aggregated learning data       |
| `healthCheck`         | Verifies AI service availability         |

**Request Flow**:

1. Receives failed submission data
2. Fetches user's recent submission history
3. Builds `user_history_summary` string
4. Calls `/ai/feedback` endpoint
5. Returns structured feedback to frontend

**Error Handling**:

- Non-blocking: AI failure doesn't fail the submission
- Timeout: 30 second limit for AI responses
- Fallback: Generic feedback if AI unavailable

---

### contestController.js

**Purpose**: User-facing contest operations.

| Function             | Description                                  |
| -------------------- | -------------------------------------------- |
| `listContests`       | Returns all contests with status             |
| `getContestById`     | Returns contest details + problems           |
| `registerForContest` | Registers user before contest starts         |
| `joinContest`        | Validates registration, returns contest data |
| `getContestProblem`  | Returns specific problem in contest          |
| `getLeaderboard`     | Returns current rankings                     |
| `getUserStanding`    | Returns user's rank and score                |

**Contest States**:

- `scheduled` - Not yet started, registration open
- `live` - In progress, submissions accepted
- `ended` - Finished, final rankings available

---

### contestJudgeController.js

**Purpose**: Handles code execution within contests.

| Function            | Description                       |
| ------------------- | --------------------------------- |
| `runContestCode`    | Runs code against visible tests   |
| `submitContestCode` | Submits code, updates leaderboard |

**Scoring Logic**:

```javascript
// Score calculation
const score = problemsSolved * 1e12 - penaltyTime;

// Penalty: Minutes from contest start + 20min per wrong attempt
const penalty = timeSinceStart + wrongAttempts * 20;
```

---

### adminController.js

**Purpose**: Admin panel operations for problem management.

| Function          | Description                     |
| ----------------- | ------------------------------- |
| `adminLogin`      | Authenticates admin users       |
| `getProblems`     | Lists all problems with filters |
| `createProblem`   | Creates new problem             |
| `updateProblem`   | Updates problem details         |
| `deleteProblem`   | Soft deletes problem            |
| `getProblemStats` | Returns submission statistics   |

---

### potdController.js

**Purpose**: Problem of the Day user operations.

| Function          | Description                       |
| ----------------- | --------------------------------- |
| `getTodaysPOTD`   | Returns today's scheduled problem |
| `getUserStreak`   | Returns user's POTD streak        |
| `getPOTDCalendar` | Returns monthly POTD schedule     |

---

### adminPOTDController.js

**Purpose**: Admin POTD scheduling operations.

| Function            | Description                  |
| ------------------- | ---------------------------- |
| `schedulePOTD`      | Schedules problem for a date |
| `getScheduledPOTDs` | Lists all scheduled POTDs    |
| `updatePOTD`        | Modifies scheduled POTD      |
| `deletePOTD`        | Removes scheduled POTD       |

---

### profileController.js & profileAnalyticsController.js

**Purpose**: User profile and analytics management.

| Function               | Description                     |
| ---------------------- | ------------------------------- |
| `getProfile`           | Returns user profile data       |
| `updateProfile`        | Updates profile settings        |
| `getSubmissionHistory` | Returns paginated submissions   |
| `getAnalytics`         | Returns solving statistics      |
| `getCategoryBreakdown` | Returns performance by category |

---

## Models

### User.js

**Purpose**: User account schema.

```javascript
{
  username: String (unique, required),
  email: String (unique, required),
  password: String (hashed),
  role: String ('user' | 'admin'),
  createdAt: Date,
  profilePicture: String,
  bio: String,
  linkedProfiles: {
    leetcode: String,
    codeforces: String
  }
}
```

---

### Question.js

**Purpose**: Problem definition schema.

```javascript
{
  title: String,
  slug: String (unique),
  description: String (markdown),
  difficulty: String ('easy' | 'medium' | 'hard'),
  category: [String],
  tags: [String],
  constraints: String,
  examples: [{
    input: String,
    output: String,
    explanation: String
  }],
  starterCode: {
    python: String,
    javascript: String,
    java: String,
    cpp: String
  },
  isPublic: Boolean,
  createdBy: ObjectId (Admin)
}
```

---

### Submission.js

**Purpose**: Code submission record.

```javascript
{
  user: ObjectId (User),
  question: ObjectId (Question),
  code: String,
  language: String,
  verdict: String,
  runtime: Number (ms),
  memory: Number (KB),
  testCasesPassed: Number,
  totalTestCases: Number,
  errorMessage: String,
  aiFeedback: {
    explanation: String,
    hints: [String],
    pattern: String
  },
  submittedAt: Date
}
```

---

### Contest.js

**Purpose**: Contest definition schema.

```javascript
{
  title: String,
  description: String,
  startTime: Date,
  endTime: Date,
  status: String ('scheduled' | 'live' | 'ended'),
  problems: [ObjectId (Question)],
  registeredUsers: [ObjectId (User)],
  createdBy: ObjectId (Admin),
  isPublic: Boolean
}
```

---

### ContestSubmission.js

**Purpose**: Contest-specific submission with scoring.

```javascript
{
  contest: ObjectId (Contest),
  user: ObjectId (User),
  problem: ObjectId (Question),
  code: String,
  language: String,
  verdict: String,
  score: Number,
  penalty: Number,
  submittedAt: Date
}
```

---

## Routes

### authRoutes.js (`/api/auth`)

| Method | Endpoint           | Middleware | Handler          |
| ------ | ------------------ | ---------- | ---------------- |
| POST   | `/signup`          | -          | `signup`         |
| POST   | `/signin`          | -          | `signin`         |
| POST   | `/logout`          | `protect`  | `logout`         |
| GET    | `/me`              | `protect`  | `getMe`          |
| PUT    | `/update-profile`  | `protect`  | `updateProfile`  |
| PUT    | `/change-password` | `protect`  | `changePassword` |

---

### contestRoutes.js (`/api/contests`)

| Method | Endpoint                    | Middleware             | Handler              |
| ------ | --------------------------- | ---------------------- | -------------------- |
| GET    | `/`                         | `optionalAuth`         | `listContests`       |
| GET    | `/:id`                      | `optionalAuth`         | `getContestById`     |
| POST   | `/:id/register`             | `protect`              | `registerForContest` |
| POST   | `/:id/join`                 | `protect`              | `joinContest`        |
| GET    | `/:id/problems/:pid`        | `protect`              | `getContestProblem`  |
| POST   | `/:id/problems/:pid/run`    | `protect`, `rateLimit` | `runContestCode`     |
| POST   | `/:id/problems/:pid/submit` | `protect`, `rateLimit` | `submitContestCode`  |
| GET    | `/:id/leaderboard`          | `optionalAuth`         | `getLeaderboard`     |
| GET    | `/:id/standing`             | `protect`              | `getUserStanding`    |

---

### adminRoutes.js (`/api/admin`)

| Method | Endpoint        | Middleware     | Handler         |
| ------ | --------------- | -------------- | --------------- |
| POST   | `/login`        | -              | `adminLogin`    |
| GET    | `/problems`     | `adminProtect` | `getProblems`   |
| POST   | `/problems`     | `adminProtect` | `createProblem` |
| PUT    | `/problems/:id` | `adminProtect` | `updateProblem` |
| DELETE | `/problems/:id` | `adminProtect` | `deleteProblem` |
| POST   | `/upload-csv`   | `adminProtect` | `uploadCSV`     |

---

## Middleware

### authMiddleware.js

**`protect`**: Requires valid JWT token.

```javascript
// Extracts token from HTTP-only cookie
// Verifies token validity
// Attaches user to request: req.user
// Returns 401 if invalid
```

**`optionalAuth`**: Attaches user if token exists, continues if not.

```javascript
// Does not fail if no token
// Used for public endpoints that show extra data to logged-in users
```

---

### adminMiddleware.js

**`adminProtect`**: Requires admin JWT token.

```javascript
// Verifies admin-specific token
// Attaches admin to request: req.admin
// Returns 401 if not admin
```

---

### auditLog.js

**Purpose**: Logs admin actions for accountability.

```javascript
// Creates AuditLog entry for sensitive operations
// Records: admin, action, target, timestamp, IP
```

---

## Services

### aiService.js

**Purpose**: Client for AI services communication.

```javascript
class AIService {
  // Calls FastAPI /ai/feedback endpoint
  async getFeedback(submissionData, userHistory) {
    return axios.post(`${AI_SERVICE_URL}/ai/feedback`, {
      user_id,
      problem_id,
      code,
      verdict,
      error_type,
      user_history_summary,
    });
  }

  // Fetches user's recent submissions for context
  async buildHistorySummary(userId) {
    // Returns: "Recent 20 submissions: 5 accepted, 15 failed..."
  }
}
```

---

### leaderboardService.js

**Purpose**: Real-time leaderboard management.

**Redis-Based** (if available):

```javascript
// Uses Redis sorted sets for O(log N) rank operations
// Key: contest:{contestId}:leaderboard
// Score: (problemsSolved * 1e12) - penalty
```

**MongoDB Fallback**:

```javascript
// Queries ContestSubmission aggregated by user
// Calculates ranks in-memory
```

---

### websocketServer.js

**Purpose**: Real-time WebSocket communication.

**Events**:

```javascript
// Client → Server
{ type: 'join_contest', contestId: '...', token: '...' }
{ type: 'leave_contest', contestId: '...' }

// Server → Client
{ type: 'leaderboard_update', data: [...] }
{ type: 'submission_status', data: {...} }
{ type: 'contest_started', contestId: '...' }
{ type: 'contest_ended', contestId: '...' }
```

**Heartbeat**: Ping every 30 seconds to maintain connections.

---

### contestScheduler.js

**Purpose**: Automated contest state transitions.

```javascript
// Runs every 30 seconds
// Checks all contests:
//   - If current time >= startTime && status === 'scheduled' → set 'live'
//   - If current time >= endTime && status === 'live' → set 'ended', calculate ranks
```

---

### potdScheduler.js

**Purpose**: Daily POTD publishing.

```javascript
// Runs at midnight (configurable)
// Publishes scheduled POTD for today
// Updates PublishedPOTD collection
```

---

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/mentat-trials

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:5173

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Piston API
PISTON_API_URL=https://emkc.org/api/v2/piston

# AI Services
AI_SERVICE_URL=http://localhost:8000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

---

## Rate Limiting

| Endpoint Category   | Limit                  |
| ------------------- | ---------------------- |
| General API         | 100 req / 15 min       |
| Auth endpoints      | 10 req / 15 min        |
| Code execution      | 20 req / min           |
| Contest submissions | 10 req / min / contest |

---

## Error Handling

**Standard Error Response**:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

**Error Codes**:

- `AUTH_REQUIRED` - No valid token
- `INVALID_CREDENTIALS` - Wrong username/password
- `NOT_FOUND` - Resource doesn't exist
- `RATE_LIMITED` - Too many requests
- `EXECUTION_ERROR` - Piston API error
- `VALIDATION_ERROR` - Invalid input data

---

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

---

## Development

```bash
# Start with hot reload
npm run dev

# Start production
npm start

# Seed admin user
npm run seed:admin
```
