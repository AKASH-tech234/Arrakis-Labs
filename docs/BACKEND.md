# Backend Documentation

> **Mentat Trials Backend** - Node.js/Express API server handling authentication, problem management, code execution, contests, and AI service orchestration.

## 📁 Directory Structure

```
backend/src/
├── app.js                      # Application entry point & server setup
│
├── controllers/                # Request handlers
│   ├── admin/
│   │   ├── adminController.js          # Admin CRUD operations
│   │   ├── adminContestController.js   # Contest management
│   │   ├── adminPlatformStatsController.js
│   │   └── adminPOTDController.js      # POTD scheduling
│   │
│   ├── ai/
│   │   └── aiController.js             # AI service proxy
│   │
│   ├── auth/
│   │   └── authController.js           # Authentication logic
│   │
│   ├── contest/
│   │   ├── contestController.js        # Contest operations
│   │   ├── contestJudgeController.js   # Contest submissions
│   │   └── contestProfileController.js # Contest stats
│   │
│   ├── judge/
│   │   └── judgeController.js          # Code execution & judging
│   │
│   ├── potd/
│   │   └── potdController.js           # Problem of the Day
│   │
│   ├── profile/
│   │   ├── codingProfileController.js  # External profiles
│   │   ├── exportController.js         # PDF export
│   │   ├── platformProfilesController.js
│   │   └── profileAnalyticsController.js
│   │
│   ├── question/
│   │   ├── questionController.js       # Problem CRUD
│   │   └── testCaseController.js       # Test case management
│   │
│   └── discussion/
│       └── discussionController.js     # Solution discussions
│
├── middleware/
│   ├── admin/
│   │   ├── adminAuth.js        # Admin JWT verification
│   │   ├── adminMiddleware.js  # Admin role checks
│   │   └── auditLog.js         # Action logging
│   │
│   └── auth/
│       └── authMiddleware.js   # User JWT verification
│
├── models/                     # Mongoose schemas
│   ├── admin/
│   │   ├── Admin.js            # Admin users
│   │   └── AuditLog.js         # Admin action logs
│   │
│   ├── auth/
│   │   └── User.js             # User accounts
│   │
│   ├── contest/
│   │   ├── Contest.js          # Contest definitions
│   │   ├── ContestRegistration.js
│   │   └── ContestSubmission.js
│   │
│   ├── discussion/
│   │   ├── DiscussionMessage.js
│   │   ├── DiscussionThread.js
│   │   └── SolutionPost.js
│   │
│   ├── potd/
│   │   ├── POTDCalendar.js     # POTD schedule
│   │   ├── PublishedPOTD.js    # Published problems
│   │   └── UserPOTDTracking.js # User streaks
│   │
│   ├── profile/
│   │   ├── AggregatedStats.js  # Pre-computed stats
│   │   ├── PlatformProfile.js  # External platform links
│   │   ├── PlatformStats.js
│   │   ├── PublicProfileSettings.js
│   │   ├── Submission.js       # Code submissions
│   │   └── UserStreak.js       # Activity streaks
│   │
│   └── question/
│       ├── Question.js         # Problem definitions
│       └── TestCase.js         # Test cases
│
├── routes/                     # Express routers
│   ├── admin/
│   │   ├── adminRoutes.js
│   │   ├── adminContestRoutes.js
│   │   └── adminPOTDRoutes.js
│   │
│   ├── auth/
│   │   ├── authRoutes.js
│   │   └── devRoutes.js        # Development helpers
│   │
│   ├── contest/
│   │   ├── contestRoutes.js
│   │   └── contestProfileRoutes.js
│   │
│   ├── discussion/
│   │   └── discussionRoutes.js
│   │
│   ├── potd/
│   │   └── potdRoutes.js
│   │
│   ├── profile/
│   │   ├── profileRoutes.js
│   │   ├── publicRoutes.js
│   │   └── exportRoutes.js
│   │
│   ├── aiProfileRoutes.js      # AI profile endpoints
│   └── mimRoutes.js            # MIM direct endpoints
│
├── services/
│   ├── ai/
│   │   └── aiService.js        # AI service client
│   │
│   ├── contest/
│   │   ├── contestScheduler.js     # Auto start/end contests
│   │   ├── leaderboardService.js   # Real-time rankings
│   │   └── websocketServer.js      # Live updates
│   │
│   ├── potd/
│   │   └── potdScheduler.js    # Daily problem publishing
│   │
│   └── profile/
│       ├── platformSyncService.js      # External profile sync
│       └── profileAggregationService.js
│
└── utils/
    ├── stdinConverter.js       # I/O format conversion
    └── userStatsAggregator.js  # Stats computation
```

---

## 🔌 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/signup` | Register new user | Public |
| POST | `/signin` | Login user | Public |
| POST | `/signout` | Logout user | User |
| GET | `/me` | Get current user | User |
| PUT | `/update-profile` | Update user profile | User |
| PUT | `/change-password` | Change password | User |
| GET | `/google` | Google OAuth start | Public |
| GET | `/google/callback` | Google OAuth callback | Public |
| GET | `/github` | GitHub OAuth start | Public |
| GET | `/github/callback` | GitHub OAuth callback | Public |

### Problems (`/api/questions`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all problems | User |
| GET | `/:id` | Get problem details | User |
| POST | `/run` | Run code against examples | User |
| POST | `/submit` | Submit solution | User |
| GET | `/submissions` | Get user submissions | User |
| GET | `/submissions/:questionId` | Get submissions for problem | User |

### AI Services (`/api/ai`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/feedback` | Request AI feedback | User |
| GET | `/profile/:userId` | Get cognitive profile | User |
| GET | `/recommendations/:userId` | Get problem recommendations | User |
| GET | `/report/weekly/:userId` | Get weekly learning report | User |
| GET | `/health` | AI service health check | Public |

#### AI Feedback Response Contract (Phase 2.x)

The `/feedback` endpoint returns a canonical response with MIM diagnostic data:

```javascript
{
  "success": true,
  "data": {
    // === MIM FACTS (treat as authoritative) ===
    "diagnosis": {
      "rootCause": "correctness",           // correctness, efficiency, implementation, understanding_gap
      "subtype": "off_by_one",              // Granular classification
      "failureMechanism": "Loop boundary"   // Human-readable explanation
    },
    "confidence": {
      "combinedConfidence": 0.82,           // 0.0 - 1.0, calibrated
      "confidenceLevel": "high",            // "high", "medium", "low"
      "conservativeMode": false,            // True if low confidence
      "calibrationApplied": true            // Isotonic calibration used
    },
    "pattern": {
      "state": "confirmed",                 // "none", "suspected", "confirmed", "stable"
      "evidenceCount": 3,                   // Supporting instances
      "confidenceSupport": "high"           // Pattern detection confidence
    },
    "difficulty": {
      "action": "maintain",                 // "increase", "maintain", "decrease"
      "reason": "pattern_unresolved",       // Why this decision
      "confidenceTier": "high"              // Influencing confidence
    },
    
    // === LLM-Generated Content ===
    "feedback": {
      "explanation": "Your loop...",        // Detailed explanation
      "correctCode": "...",                 // Example fix (optional)
      "edgeCases": [...]                    // Edge cases (optional)
    },
    "hint": { "text": "Consider..." },      // Hint from agent
    
    // === RAG Metadata ===
    "rag": {
      "used": true,                         // Whether RAG was used
      "relevance": 0.67                     // Retrieval relevance
    },
    
    // === Legacy Fields (backward compatibility) ===
    "hints": [...],
    "explanation": "...",
    "mimInsights": {...}
  }
}
```

**Logging Requirements:**
- Log `confidenceLevel` for all feedback requests
- Log `pattern.state` when not "none"
- Log `difficulty.action` when not "maintain"

### Contests (`/api/contests`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all contests | Public |
| GET | `/:id` | Get contest details | Public |
| POST | `/:id/register` | Register for contest | User |
| GET | `/:id/problems` | Get contest problems | User |
| GET | `/:id/problems/:problemId` | Get specific problem | User |
| POST | `/:id/submit` | Submit contest solution | User |
| GET | `/:id/leaderboard` | Get live leaderboard | Public |
| GET | `/:id/my-submissions` | Get user's submissions | User |

### POTD (`/api/potd`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/today` | Get today's problem | User |
| GET | `/history` | Get POTD history | User |
| GET | `/calendar/:year/:month` | Get month calendar | User |
| GET | `/streak` | Get user's streak | User |
| GET | `/leaderboard` | Get streak leaderboard | User |
| POST | `/submit` | Submit POTD solution | User |

### Profile (`/api/profile`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get user profile | User |
| GET | `/stats` | Get user statistics | User |
| GET | `/submissions` | Get submission history | User |
| GET | `/activity` | Get activity heatmap | User |
| GET | `/export/pdf` | Export profile as PDF | User |
| GET | `/public/:username` | Get public profile | Public |

### Admin (`/api/admin`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/login` | Admin login | Public |
| GET | `/dashboard` | Get dashboard stats | Admin |
| GET | `/questions` | List all questions | Admin |
| POST | `/questions` | Create question | Admin |
| PUT | `/questions/:id` | Update question | Admin |
| DELETE | `/questions/:id` | Delete question | Admin |
| POST | `/questions/:id/test-cases` | Add test cases | Admin |
| POST | `/upload/csv` | Bulk upload questions | Admin |

---

## 📊 Data Models

### User Model

```javascript
{
  name: String,                    // Display name
  email: String,                   // Unique email
  password: String,                // Hashed password (select: false)
  role: "user" | "admin",
  
  profileImage: String,            // Avatar URL
  googleId: String,                // OAuth ID
  githubId: String,                // OAuth ID
  
  preferences: {
    difficulty: "easy" | "medium" | "hard",
    language: String,              // Default: "javascript"
    theme: "light" | "dark",
    emailNotifications: Boolean
  },
  
  stats: {
    totalSolved: Number,
    totalAttempted: Number,
    currentStreak: Number,
    bestStreak: Number,
    lastActivityDate: Date
  },
  
  // AI-computed cognitive profile
  aiProfile: {
    weakTopics: [String],          // Topics needing work
    strongTopics: [String],        // Mastered topics
    commonMistakes: [String],      // Recurring patterns
    recommendedDifficulty: String, // Current level
    lastUpdated: Date
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

### Question Model

```javascript
{
  externalId: String,              // External reference
  title: String,                   // Problem title
  description: String,             // Problem statement (Markdown)
  difficulty: "Easy" | "Medium" | "Hard",
  constraints: String,             // Input constraints
  
  examples: [{
    input: String,
    output: String,
    explanation: String
  }],
  
  tags: [String],                  // Topic tags
  categoryType: String,            // UI category (e.g., "Math")
  topic: String,                   // Primary topic
  
  // AI-assist fields
  expectedApproach: String,        // e.g., "Two pointers"
  commonMistakes: [String],        // Known pitfalls
  timeComplexityHint: String,      // Expected O() notation
  spaceComplexityHint: String,
  canonicalAlgorithms: [String],   // v3.2: Preferred algorithms
  
  // Statistics
  totalSubmissions: Number,
  acceptedSubmissions: Number,
  
  isActive: Boolean,
  version: Number,                 // Optimistic concurrency
  
  createdBy: ObjectId,             // Admin reference
  updatedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// Virtuals
acceptanceRate: (acceptedSubmissions / totalSubmissions * 100)
```

### Submission Model

```javascript
{
  userId: ObjectId,                // User reference
  questionId: ObjectId,            // Question reference
  
  code: String,                    // Submitted code (max 64KB)
  language: "python" | "javascript" | "java" | "cpp",
  
  status: "pending" | "running" | "accepted" | "wrong_answer" |
          "time_limit_exceeded" | "memory_limit_exceeded" |
          "runtime_error" | "compile_error" | "internal_error",
  
  passedCount: Number,
  totalCount: Number,
  
  testResults: [{
    testCaseId: ObjectId,
    passed: Boolean,
    executionTime: Number,         // ms
    memoryUsed: Number,            // MB
    actualOutput: String,
    error: String
  }],
  
  totalExecutionTime: Number,
  maxMemoryUsed: Number,
  compileError: String,
  
  isRun: Boolean,                  // Run vs Submit
  
  // AI tracking fields
  timeSpent: Number,               // Seconds on problem
  hintsUsed: Number,
  attemptNumber: Number,           // Which attempt
  aiFeedbackReceived: Boolean,
  
  // Denormalized problem data
  problemCategory: String,
  problemDifficulty: String,
  problemTags: [String],
  
  createdAt: Date,
  updatedAt: Date
}
```

### Contest Model

```javascript
{
  name: String,
  slug: String,                    // URL-friendly ID
  description: String,
  
  startTime: Date,
  duration: Number,                // Minutes
  
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled",
  
  problems: [{
    problem: ObjectId,             // Question reference
    order: Number,
    label: String,                 // e.g., "A", "B", "C"
    points: Number
  }],
  
  scoringRules: {
    problemPoints: Map<String, Number>,
    defaultPoints: Number,
    partialScoring: Boolean
  },
  
  penaltyRules: {
    wrongSubmissionPenalty: Number, // Minutes
    penaltyOnlyAfterAC: Boolean,
    maxPenaltyPerProblem: Number
  },
  
  registrationRequired: Boolean,
  maxParticipants: Number,
  registeredCount: Number,
  
  isPublic: Boolean,
  
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔐 Authentication Flow

### JWT-Based Authentication

```javascript
// 1. User signs in
POST /api/auth/signin
{ email: "user@example.com", password: "..." }

// 2. Server validates and returns JWT
{
  success: true,
  token: "eyJhbGciOiJIUzI1NiIs...",
  user: { id, name, email, role }
}

// 3. Client stores token and includes in requests
Authorization: Bearer <token>

// 4. Middleware validates token
// middleware/auth/authMiddleware.js
export const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};
```

### OAuth Flow (Google/GitHub)

```
1. User clicks "Sign in with Google"
2. Redirect to /api/auth/google
3. Google OAuth consent screen
4. Callback to /api/auth/google/callback
5. Server creates/updates user, generates JWT
6. Redirect to frontend with token
```

---

## ⚡ Code Execution Flow

### Judge Controller (`controllers/judge/judgeController.js`)

```javascript
// POST /api/questions/submit
export const submitCode = async (req, res) => {
  const { questionId, code, language } = req.body;
  const userId = req.user._id;
  
  // 1. Validate input
  if (!LANGUAGE_MAP[language]) {
    return res.status(400).json({ message: 'Unsupported language' });
  }
  
  // 2. Get question and test cases
  const question = await Question.findById(questionId);
  const testCases = await TestCase.find({ questionId, isHidden: true });
  
  // 3. Create submission record
  const submission = await Submission.create({
    userId,
    questionId,
    code,
    language,
    status: 'running',
    totalCount: testCases.length,
    problemCategory: question.categoryType,
    problemDifficulty: question.difficulty,
    attemptNumber: await getAttemptNumber(userId, questionId)
  });
  
  // 4. Execute code against each test case
  const results = [];
  for (const tc of testCases) {
    const execution = await executePiston(code, language, tc.stdin);
    const passed = compareOutputs(execution.stdout, tc.expectedStdout);
    results.push({ testCaseId: tc._id, passed, ...execution });
    
    if (execution.compileError) break;
  }
  
  // 5. Determine verdict
  const passedCount = results.filter(r => r.passed).length;
  const hasCompileError = results.some(r => r.compileError);
  const hasTLE = results.some(r => r.timedOut);
  
  let status = 'accepted';
  if (hasCompileError) status = 'compile_error';
  else if (hasTLE) status = 'time_limit_exceeded';
  else if (passedCount < testCases.length) status = 'wrong_answer';
  
  // 6. Update submission
  submission.status = status;
  submission.passedCount = passedCount;
  submission.testResults = results;
  await submission.save();
  
  // 7. Update question stats
  await Question.findByIdAndUpdate(questionId, {
    $inc: {
      totalSubmissions: 1,
      acceptedSubmissions: status === 'accepted' ? 1 : 0
    }
  });
  
  // 8. Return result (AI feedback requested separately)
  return res.json({
    success: true,
    submission: submission.toUserResponse()
  });
};
```

### Piston API Integration

```javascript
// Execute code in sandboxed environment
async function executePiston(code, language, stdin, timeLimit = 2000) {
  const langConfig = LANGUAGE_MAP[language];
  
  const response = await axios.post(`${PISTON_URL}/execute`, {
    language: langConfig.language,
    version: langConfig.version,
    files: [{ content: code }],
    stdin: stdin || '',
    run_timeout: timeLimit,
    compile_timeout: 10000,
    compile_memory_limit: 256 * 1024 * 1024,
    run_memory_limit: 256 * 1024 * 1024
  });
  
  return {
    stdout: response.data.run?.stdout || '',
    stderr: response.data.run?.stderr || '',
    exitCode: response.data.run?.code || 0,
    timedOut: response.data.run?.signal === 'SIGKILL',
    compileError: !!response.data.compile?.stderr
  };
}

// Supported languages
const LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'cpp', version: '10.2.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' }
};
```

---

## 🤖 AI Service Integration

### AI Service Client (`services/ai/aiService.js`)

```javascript
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = 90000;

// Request AI feedback for submission
export async function getAIFeedback(submissionData) {
  const response = await axios.post(
    `${AI_SERVICE_URL}/ai/feedback`,
    {
      submission_id: submissionData.submissionId,
      user_id: submissionData.userId,
      problem_id: submissionData.problemId,
      code: submissionData.code,
      verdict: submissionData.verdict,
      language: submissionData.language,
      problem: submissionData.problem,
      problem_category: submissionData.problemCategory,
      user_history: submissionData.userHistory,
      previous_attempts: submissionData.previousAttempts
    },
    { timeout: AI_TIMEOUT_MS }
  );
  
  return response.data;
}

// Transform MIM V3.0 insights for frontend
export function transformMIMInsights(mimInsights) {
  if (!mimInsights) return null;
  
  return {
    feedbackType: mimInsights.feedback_type,
    
    correctnessFeedback: mimInsights.correctness_feedback ? {
      rootCause: mimInsights.correctness_feedback.root_cause,
      subtype: mimInsights.correctness_feedback.subtype,
      failureMechanism: mimInsights.correctness_feedback.failure_mechanism,
      confidence: mimInsights.correctness_feedback.confidence,
      isRecurring: mimInsights.correctness_feedback.is_recurring,
      recurrenceCount: mimInsights.correctness_feedback.recurrence_count
    } : null,
    
    performanceFeedback: mimInsights.performance_feedback ? {
      rootCause: 'efficiency',
      expectedComplexity: mimInsights.performance_feedback.expected_complexity,
      observedComplexity: mimInsights.performance_feedback.observed_complexity,
      optimizationDirection: mimInsights.performance_feedback.optimization_direction
    } : null,
    
    reinforcementFeedback: mimInsights.reinforcement_feedback ? {
      category: mimInsights.reinforcement_feedback.category,
      technique: mimInsights.reinforcement_feedback.technique,
      confidenceBoost: mimInsights.reinforcement_feedback.confidence_boost,
      strengthSignal: mimInsights.reinforcement_feedback.strength_signal
    } : null,
    
    // Legacy fields
    rootCause: mimInsights.root_cause,
    readiness: mimInsights.readiness,
    isColdStart: mimInsights.is_cold_start,
    modelVersion: mimInsights.model_version
  };
}
```

---

## 🏆 Contest System

### Real-Time Leaderboard

```javascript
// services/contest/leaderboardService.js
class LeaderboardService {
  constructor() {
    this.leaderboards = new Map(); // contestId -> sorted rankings
  }
  
  // Update score after submission
  async updateScore(contestId, userId, problemLabel, isAccepted, penalty) {
    const contest = await Contest.findById(contestId);
    const registration = await ContestRegistration.findOne({ contestId, userId });
    
    if (isAccepted && !registration.solvedProblems.includes(problemLabel)) {
      registration.solvedProblems.push(problemLabel);
      registration.score += contest.scoringRules.problemPoints.get(problemLabel);
      registration.penalty += penalty;
      await registration.save();
      
      // Broadcast update via WebSocket
      wsServer.broadcastToContest(contestId, {
        type: 'LEADERBOARD_UPDATE',
        data: await this.getLeaderboard(contestId)
      });
    }
  }
  
  // Get current rankings
  async getLeaderboard(contestId, limit = 100) {
    return ContestRegistration.find({ contestId })
      .sort({ score: -1, penalty: 1, lastACTime: 1 })
      .limit(limit)
      .populate('userId', 'name profileImage');
  }
}
```

### WebSocket Server

```javascript
// services/contest/websocketServer.js
class WebSocketServer {
  constructor() {
    this.wss = null;
    this.contestRooms = new Map(); // contestId -> Set<ws>
  }
  
  initialize(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws/contest' });
    
    this.wss.on('connection', (ws, req) => {
      const contestId = req.url.split('/').pop();
      this.joinRoom(contestId, ws);
      
      ws.on('close', () => this.leaveRoom(contestId, ws));
    });
  }
  
  broadcastToContest(contestId, message) {
    const room = this.contestRooms.get(contestId);
    if (room) {
      room.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    }
  }
}
```

---

## 📅 Scheduled Tasks

### Contest Scheduler

```javascript
// services/contest/contestScheduler.js
class ContestScheduler {
  start() {
    // Check every minute for contests to start/end
    setInterval(() => this.checkContests(), 60000);
  }
  
  async checkContests() {
    const now = new Date();
    
    // Start scheduled contests
    const toStart = await Contest.find({
      status: 'scheduled',
      startTime: { $lte: now }
    });
    
    for (const contest of toStart) {
      contest.status = 'active';
      await contest.save();
      wsServer.broadcastToContest(contest._id, {
        type: 'CONTEST_STARTED'
      });
    }
    
    // End active contests
    const toEnd = await Contest.find({ status: 'active' });
    
    for (const contest of toEnd) {
      const endTime = new Date(contest.startTime.getTime() + contest.duration * 60000);
      if (now >= endTime) {
        contest.status = 'ended';
        await contest.save();
        wsServer.broadcastToContest(contest._id, {
          type: 'CONTEST_ENDED'
        });
      }
    }
  }
}
```

### POTD Scheduler

```javascript
// services/potd/potdScheduler.js
class POTDScheduler {
  start() {
    // Run at midnight every day
    cron.schedule('0 0 * * *', () => this.publishDailyProblem());
  }
  
  async publishDailyProblem() {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already published
    const existing = await PublishedPOTD.findOne({ date: today });
    if (existing) return;
    
    // Get scheduled problem from calendar
    const scheduled = await POTDCalendar.findOne({ date: today });
    
    if (scheduled) {
      await PublishedPOTD.create({
        date: today,
        problemId: scheduled.problemId,
        difficulty: scheduled.difficulty
      });
    }
  }
}
```

---

## 🛡️ Security

### Rate Limiting

```javascript
// app.js
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  skip: () => process.env.NODE_ENV !== 'production'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                    // 10 auth attempts
  message: { message: 'Too many authentication attempts' }
});

const codeLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 20,                    // 20 submissions per minute
  keyGenerator: (req) => req.user?._id?.toString() || req.ip
});
```

### Input Validation

```javascript
// Mongoose sanitization
app.use(mongoSanitize());

// Code size limits
const MAX_CODE_SIZE = 65536;    // 64KB
const MAX_STDIN_SIZE = 1024 * 1024; // 1MB

if (code.length > MAX_CODE_SIZE) {
  throw new Error('Code size exceeds maximum limit (64KB)');
}
```

---

## 🔧 Environment Variables

```bash
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/mentat

# Authentication
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=7d

# External Services
AI_SERVICE_URL=http://localhost:8000
PISTON_URL=https://emkc.org/api/v2/piston

# OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

## 🚀 Running the Server

```bash
# Development
npm run dev

# Production
npm start

# With specific port
PORT=3000 npm start
```

Server starts at `http://localhost:5000` by default.
