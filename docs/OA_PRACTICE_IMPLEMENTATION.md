# OA Practice Feature - Implementation Specification

> **Customized Online Assessment (OA) – Real Experience**  
> Simulate real company OA experiences that adapt dynamically to user's knowledge, preferences, and selected companies.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Backend API Design](#backend-api-design)
4. [Smart OA Selection Algorithm](#smart-oa-selection-algorithm)
5. [Frontend Component Structure](#frontend-component-structure)
6. [OA Scheduling System](#oa-scheduling-system)
7. [Anti-Cheat & Proctoring](#anti-cheat--proctoring)
8. [Post-OA Analysis Engine](#post-oa-analysis-engine)
9. [Implementation Prompt](#implementation-prompt)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        OA PRACTICE SYSTEM ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Dashboard │────▶│  OA Config Modal │────▶│  OA Scheduler   │
│   "Start OA"     │     │  (or Quick Fight)│     │  Service        │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           QUESTION SELECTION ENGINE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Company    │  │    Topic     │  │  Difficulty  │  │   History    │        │
│  │   Patterns   │  │   Weights    │  │  Distribution│  │   Filter     │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
│                              │                                                   │
│                              ▼                                                   │
│                    ┌──────────────────┐                                         │
│                    │  Weighted Random │                                         │
│                    │    Selection     │                                         │
│                    └──────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OA SESSION (LOCKED)                                    │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Session State: scheduled → live → submitted/terminated/expired          │   │
│  │  Timer Source: DB (startAt + endAt) - NOT frontend state                 │   │
│  │  Questions: Locked at creation, immutable during session                 │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────────────────┐
                    │                                     │                                     │
                    ▼                                     ▼                                     ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐     ┌─────────────────────────┐
│     MCQ SECTION         │     │       CODING SECTION            │     │    PROCTORING LAYER     │
│  • Auto-evaluation      │     │  • Piston judge execution       │     │  • Tab switch detection │
│  • Instant scoring      │     │  • Hidden test cases            │     │  • Warning counter      │
│  • Time tracking        │     │  • Partial scoring              │     │  • Violation logging    │
└─────────────────────────┘     └─────────────────────────────────┘     └─────────────────────────┘
                    │                                     │                                     │
                    └─────────────────────────────────────┼─────────────────────────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         POST-OA ANALYSIS ENGINE                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Company     │  │   Topic      │  │  Difficulty  │  │    Time      │        │
│  │  Score       │  │   Accuracy   │  │  Performance │  │   Analysis   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
│                              │                                                   │
│                              ▼                                                   │
│                    ┌──────────────────┐                                         │
│                    │  AI Suggestions  │                                         │
│                    │  & Weak Topics   │                                         │
│                    └──────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### 1. MCQQuestion (New Collection)

```javascript
// backend/src/models/oa/MCQQuestion.js

const mcqQuestionSchema = new mongoose.Schema({
  // === IDENTIFICATION ===
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  description: {
    type: String,
    required: true,
  },
  
  // === CLASSIFICATION ===
  topic: {
    type: String,
    required: true,
    enum: [
      // DSA Topics
      'Array', 'String', 'LinkedList', 'Stack', 'Queue', 'Tree', 'Graph',
      'DynamicProgramming', 'Greedy', 'Backtracking', 'BinarySearch',
      'Sorting', 'Hashing', 'Heap', 'Trie', 'BitManipulation',
      // CS Fundamentals
      'OS', 'DBMS', 'CN', 'OOPs', 'SystemDesign',
      // Aptitude
      'Aptitude', 'LogicalReasoning', 'VerbalAbility'
    ],
    index: true,
  },
  subtopic: {
    type: String,
    default: null,
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: true,
    index: true,
  },
  
  // === COMPANY TAGGING ===
  companyTags: {
    type: [String],
    default: [],
    index: true,
  },
  oaPattern: {
    type: String,
    enum: ['conceptual', 'applied', 'tricky', 'calculation', 'code_output'],
    default: 'conceptual',
  },
  
  // === QUESTION CONTENT ===
  options: [{
    id: { type: String, required: true },
    text: { type: String, required: true },
    isCode: { type: Boolean, default: false }, // For code-based options
  }],
  correctOptionId: {
    type: String,
    required: true,
    select: false, // NEVER sent to client by default
  },
  explanation: {
    type: String,
    default: '',
  },
  
  // === METADATA ===
  timeEstimateSeconds: {
    type: Number,
    default: 60,
  },
  points: {
    type: Number,
    default: 1,
  },
  negativeMarking: {
    type: Number,
    default: 0, // 0 = no negative, 0.25 = 1/4th negative
  },
  
  // === SOURCE TRACKING ===
  source: {
    type: String,
    enum: ['admin', 'community', 'real_oa'],
    default: 'admin',
  },
  contributedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  realOACompany: String, // If from actual OA
  realOADate: Date,
  
  // === STATUS ===
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  
}, { timestamps: true });

// Indexes
mcqQuestionSchema.index({ topic: 1, difficulty: 1, isActive: 1 });
mcqQuestionSchema.index({ companyTags: 1, isActive: 1 });
mcqQuestionSchema.index({ topic: 1, companyTags: 1, difficulty: 1 });
```

### 2. CompanyOAPattern (Company-specific OA configurations)

```javascript
// backend/src/models/oa/CompanyOAPattern.js

const companyOAPatternSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  companySlug: {
    type: String,
    required: true,
    unique: true,
  },
  logo: String,
  
  // === OA STRUCTURE ===
  oaStructure: {
    totalDurationMinutes: { type: Number, default: 90 },
    sections: [{
      type: { type: String, enum: ['mcq', 'coding'], required: true },
      count: { type: Number, required: true },
      durationMinutes: { type: Number, required: true },
      allowSectionSwitch: { type: Boolean, default: false },
    }],
  },
  
  // === DIFFICULTY DISTRIBUTION ===
  difficultyDistribution: {
    mcq: {
      easy: { type: Number, default: 30 },    // percentage
      medium: { type: Number, default: 50 },
      hard: { type: Number, default: 20 },
    },
    coding: {
      easy: { type: Number, default: 20 },
      medium: { type: Number, default: 50 },
      hard: { type: Number, default: 30 },
    },
  },
  
  // === TOPIC WEIGHTS (what topics appear frequently) ===
  topicWeights: {
    type: Map,
    of: Number, // topic -> weight (1-10)
    default: new Map(),
  },
  
  // === OA SETTINGS ===
  settings: {
    negativeMarkingMCQ: { type: Number, default: 0 },
    partialScoringCoding: { type: Boolean, default: true },
    allowLanguages: { type: [String], default: ['cpp', 'java', 'python'] },
    tabSwitchWarnings: { type: Number, default: 3 },
  },
  
  // === STATS ===
  stats: {
    totalAttempts: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    avgCompletionTime: { type: Number, default: 0 },
  },
  
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
```

### 3. OAConfig (User's OA Configuration)

```javascript
// backend/src/models/oa/OAConfig.js

const oaConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // === COMPANY SELECTION ===
  companyMode: {
    type: String,
    enum: ['all', 'selected', 'quick_fight'],
    default: 'all',
  },
  selectedCompanies: {
    type: [String],
    default: [],
  },
  
  // === OA TYPE ===
  oaType: {
    type: String,
    enum: ['coding', 'mcq', 'mixed'],
    default: 'mixed',
  },
  
  // === TOPIC SELECTION ===
  selectedTopics: {
    type: [String],
    default: [], // Empty = all topics
  },
  
  // === DIFFICULTY ===
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'adaptive', 'mixed'],
    default: 'mixed',
  },
  
  // === QUESTION COUNTS ===
  questionCounts: {
    mcq: { type: Number, default: 15 },
    coding: { type: Number, default: 2 },
  },
  
  // === TIMING ===
  timingMode: {
    type: String,
    enum: ['fixed', 'company_specific'],
    default: 'fixed',
  },
  fixedDurationMinutes: {
    type: Number,
    default: 90,
  },
  
  // === PREFERENCES ===
  preferredLanguages: {
    type: [String],
    default: ['python', 'cpp', 'java'],
  },
  
  // === SCHEDULING ===
  startMode: {
    type: String,
    enum: ['now', 'scheduled'],
    default: 'now',
  },
  scheduledStartAt: {
    type: Date,
    default: null,
  },
  
  // === PROCTORING ===
  proctoring: {
    enableTabSwitchDetection: { type: Boolean, default: true },
    warningsAllowed: { type: Number, default: 3 },
    actionOnExceed: { type: String, enum: ['auto_submit', 'terminate'], default: 'auto_submit' },
    enableFullscreen: { type: Boolean, default: true },
  },
  
}, { timestamps: true });

oaConfigSchema.index({ userId: 1, createdAt: -1 });
```

### 4. OASession (The Live Session - Source of Truth)

```javascript
// backend/src/models/oa/OASession.js

const oaSessionSchema = new mongoose.Schema({
  // === IDENTIFICATION ===
  sessionCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  configId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OAConfig',
    required: true,
  },
  
  // === STATUS (State Machine) ===
  status: {
    type: String,
    enum: ['scheduled', 'live', 'paused', 'submitted', 'terminated', 'expired'],
    default: 'scheduled',
    index: true,
  },
  
  // === TIMING (Backend Authoritative) ===
  startAt: {
    type: Date,
    required: true,
    index: true,
  },
  endAt: {
    type: Date,
    required: true,
    index: true,
  },
  actualStartedAt: Date,
  submittedAt: Date,
  
  // === LOCKED QUESTIONS (Immutable after creation) ===
  sections: [{
    type: { type: String, enum: ['mcq', 'coding'], required: true },
    order: Number,
    durationMinutes: Number,
    questions: [{
      order: Number,
      kind: { type: String, enum: ['mcq', 'coding'], required: true },
      refId: { type: mongoose.Schema.Types.ObjectId, required: true },
      // Snapshots for stable reporting
      titleSnapshot: String,
      topicSnapshot: String,
      difficultySnapshot: String,
      companyTagsSnapshot: [String],
      points: { type: Number, default: 1 },
      negativeMarking: { type: Number, default: 0 },
    }],
  }],
  
  // === PROCTORING STATE ===
  proctoring: {
    warningsAllowed: { type: Number, default: 3 },
    warningCount: { type: Number, default: 0 },
    violationCount: { type: Number, default: 0 },
    isFullscreen: { type: Boolean, default: true },
    actionOnExceed: { type: String, default: 'auto_submit' },
  },
  
  // === TERMINATION ===
  terminatedReason: {
    type: String,
    enum: ['warnings_exceeded', 'time_expired', 'manual', 'system'],
    default: null,
  },
  
  // === METADATA ===
  companyContext: String, // Primary company for this OA
  oaType: String,
  difficulty: String,
  
}, { timestamps: true });

// Indexes for scheduler queries
oaSessionSchema.index({ status: 1, startAt: 1 });
oaSessionSchema.index({ status: 1, endAt: 1 });
oaSessionSchema.index({ userId: 1, status: 1 });
```

### 5. OAAnswer (Autosaved Answers)

```javascript
// backend/src/models/oa/OAAnswer.js

const oaAnswerSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OASession',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // === QUESTION REFERENCE ===
  questionKind: {
    type: String,
    enum: ['mcq', 'coding'],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  sectionIndex: Number,
  questionIndex: Number,
  
  // === ANSWER DATA ===
  answer: {
    // MCQ
    selectedOptionId: { type: String, default: null },
    // Coding
    code: { type: String, default: '' },
    language: { type: String, default: 'python' },
  },
  
  // === SUBMISSION STATE (for coding) ===
  submission: {
    isSubmitted: { type: Boolean, default: false },
    submittedAt: Date,
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    verdict: String,
    executionTime: Number,
  },
  
  // === TIME TRACKING ===
  firstSeenAt: Date,
  lastFocusedAt: Date,
  timeSpentSeconds: { type: Number, default: 0 },
  
  // === AUTOSAVE META ===
  clientUpdatedAt: Date,
  serverUpdatedAt: { type: Date, default: Date.now },
  saveCount: { type: Number, default: 0 },
  
}, { timestamps: true });

// Unique constraint: one answer per question per session
oaAnswerSchema.index({ sessionId: 1, refId: 1 }, { unique: true });
oaAnswerSchema.index({ sessionId: 1, serverUpdatedAt: -1 });
```

### 6. OAViolation (Proctoring Logs)

```javascript
// backend/src/models/oa/OAViolation.js

const oaViolationSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OASession',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // === VIOLATION TYPE ===
  type: {
    type: String,
    enum: [
      'tab_hidden',      // document.visibilityState = 'hidden'
      'tab_blur',        // window.blur
      'fullscreen_exit', // Exited fullscreen
      'copy_attempt',    // Tried to copy (optional)
      'paste_attempt',   // Tried to paste (optional)
      'devtools_open',   // DevTools detected (optional)
    ],
    required: true,
  },
  
  // === TIMESTAMPS ===
  occurredAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  clientOccurredAt: Date,
  
  // === CONTEXT ===
  meta: {
    visibilityState: String,
    focusedElement: String,
    url: String,
  },
  
  // === OUTCOME ===
  wasWarning: { type: Boolean, default: true },
  warningNumber: Number,
  triggeredAction: {
    type: String,
    enum: ['none', 'warning_shown', 'auto_submit', 'terminate'],
    default: 'warning_shown',
  },
  
}, { timestamps: true });

oaViolationSchema.index({ sessionId: 1, occurredAt: -1 });
```

### 7. OAReport (Immutable Final Report)

```javascript
// backend/src/models/oa/OAReport.js

const oaReportSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OASession',
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // === TIMING ===
  startedAt: Date,
  submittedAt: Date,
  totalTimeSeconds: Number,
  
  // === OVERALL SCORE ===
  score: {
    earned: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  
  // === MCQ PERFORMANCE ===
  mcqPerformance: {
    attempted: Number,
    correct: Number,
    wrong: Number,
    skipped: Number,
    score: Number,
    accuracy: Number,
  },
  
  // === CODING PERFORMANCE ===
  codingPerformance: {
    attempted: Number,
    fullySolved: Number,
    partiallySolved: Number,
    score: Number,
    avgTestCasePass: Number,
  },
  
  // === COMPANY-WISE BREAKDOWN ===
  companyWise: [{
    company: String,
    questionsAttempted: Number,
    score: Number,
    accuracy: Number,
  }],
  
  // === TOPIC-WISE BREAKDOWN ===
  topicWise: [{
    topic: String,
    attempted: Number,
    correct: Number,
    accuracy: Number,
    avgTimeSeconds: Number,
    status: { type: String, enum: ['strong', 'moderate', 'weak'] },
  }],
  
  // === DIFFICULTY-WISE BREAKDOWN ===
  difficultyWise: {
    easy: { attempted: Number, correct: Number, accuracy: Number },
    medium: { attempted: Number, correct: Number, accuracy: Number },
    hard: { attempted: Number, correct: Number, accuracy: Number },
  },
  
  // === TIME ANALYSIS ===
  timeAnalysis: {
    avgTimePerMCQ: Number,
    avgTimePerCoding: Number,
    fastestQuestion: { refId: mongoose.Schema.Types.ObjectId, seconds: Number },
    slowestQuestion: { refId: mongoose.Schema.Types.ObjectId, seconds: Number },
    perQuestion: [{
      refId: mongoose.Schema.Types.ObjectId,
      kind: String,
      topic: String,
      seconds: Number,
      wasCorrect: Boolean,
    }],
  },
  
  // === INTEGRITY ===
  integrity: {
    tabSwitches: Number,
    warningsUsed: Number,
    wasTerminated: Boolean,
    terminatedReason: String,
    status: { type: String, enum: ['clean', 'warnings_used', 'violated'] },
  },
  
  // === AI INSIGHTS ===
  insights: {
    practiceLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'OA-Ready'],
    },
    weakTopics: [String],
    strongTopics: [String],
    recommendations: [{
      type: { type: String, enum: ['topic', 'difficulty', 'speed', 'accuracy'] },
      message: String,
      actionable: String,
    }],
    recommendedProblems: [{
      problemId: mongoose.Schema.Types.ObjectId,
      reason: String,
    }],
    comparisonToAvg: {
      score: String, // 'above', 'below', 'average'
      percentile: Number,
    },
  },
  
  // === RAW DATA (for debugging/audit) ===
  rawAnswers: [{
    refId: mongoose.Schema.Types.ObjectId,
    kind: String,
    answer: mongoose.Schema.Types.Mixed,
    isCorrect: Boolean,
    pointsEarned: Number,
    timeSpent: Number,
  }],
  
}, { timestamps: true });

oaReportSchema.index({ userId: 1, createdAt: -1 });
oaReportSchema.index({ userId: 1, 'score.percentage': -1 });
```

### 8. UserOAHistory (Aggregated user history for adaptive selection)

```javascript
// backend/src/models/oa/UserOAHistory.js

const userOAHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  
  // === ATTEMPTED QUESTIONS (to avoid repeats) ===
  attemptedMCQs: [{
    questionId: mongoose.Schema.Types.ObjectId,
    lastAttemptedAt: Date,
    wasCorrect: Boolean,
    attemptCount: Number,
  }],
  attemptedCoding: [{
    questionId: mongoose.Schema.Types.ObjectId,
    lastAttemptedAt: Date,
    bestScore: Number,
    attemptCount: Number,
  }],
  
  // === TOPIC PROFICIENCY (for adaptive) ===
  topicProficiency: {
    type: Map,
    of: {
      attempted: Number,
      correct: Number,
      accuracy: Number,
      avgTime: Number,
      lastAttempted: Date,
    },
  },
  
  // === DIFFICULTY PROFICIENCY ===
  difficultyProficiency: {
    easy: { attempted: Number, accuracy: Number },
    medium: { attempted: Number, accuracy: Number },
    hard: { attempted: Number, accuracy: Number },
  },
  
  // === STATS ===
  totalOAs: Number,
  avgScore: Number,
  bestScore: Number,
  totalTimeSpent: Number,
  
}, { timestamps: true });
```

---

## 🔌 Backend API Design

### Route Structure

```
/api/oa/
├── /metadata                    GET     - Get companies, topics, defaults
├── /configs                     POST    - Save OA configuration
├── /sessions                    POST    - Create new OA session
├── /sessions/:sessionId         GET     - Get session state (timer, questions)
├── /sessions/:sessionId/start   POST    - Manually start (if scheduled)
├── /sessions/:sessionId/answers PUT     - Autosave answer
├── /sessions/:sessionId/submit-code POST - Submit coding solution
├── /sessions/:sessionId/violations POST - Log tab switch violation
├── /sessions/:sessionId/submit  POST    - Final submit
├── /sessions/:sessionId/report  GET     - Get OA report
├── /history                     GET     - User's OA history
├── /insights                    GET     - User's weak topics, recommendations
├── /leaderboard                 GET     - Global/company OA leaderboard
```

### API Contracts

#### 1. GET /api/oa/metadata
```javascript
// Response
{
  "success": true,
  "data": {
    "companies": [
      { "name": "Google", "slug": "google", "logo": "...", "avgDuration": 90 },
      { "name": "Amazon", "slug": "amazon", "logo": "...", "avgDuration": 120 },
      // ...
    ],
    "topics": {
      "dsa": ["Array", "String", "DP", "Graph", "Tree", "Greedy", "BinarySearch", ...],
      "csFundamentals": ["OS", "DBMS", "CN", "OOPs"],
      "aptitude": ["Aptitude", "LogicalReasoning", "VerbalAbility"]
    },
    "difficulties": ["easy", "medium", "hard", "adaptive", "mixed"],
    "oaTypes": ["coding", "mcq", "mixed"],
    "limits": {
      "maxMCQ": 30,
      "maxCoding": 5,
      "minDuration": 15,
      "maxDuration": 180
    },
    "defaults": {
      "mcqCount": 15,
      "codingCount": 2,
      "duration": 90,
      "warningsAllowed": 3
    }
  }
}
```

#### 2. POST /api/oa/sessions
```javascript
// Request
{
  "companyMode": "selected",
  "selectedCompanies": ["google", "amazon"],
  "oaType": "mixed",
  "selectedTopics": ["Array", "String", "DP"],
  "difficulty": "mixed",
  "questionCounts": { "mcq": 15, "coding": 2 },
  "durationMinutes": 90,
  "startMode": "now",
  "scheduledStartAt": null,
  "proctoring": {
    "enableTabSwitchDetection": true,
    "warningsAllowed": 3,
    "enableFullscreen": true
  },
  "preferredLanguages": ["python", "cpp"]
}

// Response
{
  "success": true,
  "data": {
    "sessionId": "oa_abc123xyz",
    "sessionCode": "OA-2026-001234",
    "status": "live",
    "startAt": "2026-01-31T10:00:00Z",
    "endAt": "2026-01-31T11:30:00Z",
    "serverNow": "2026-01-31T10:00:05Z",
    "sections": [
      {
        "type": "mcq",
        "questionCount": 15,
        "durationMinutes": 45
      },
      {
        "type": "coding",
        "questionCount": 2,
        "durationMinutes": 45
      }
    ],
    "proctoring": {
      "warningsAllowed": 3,
      "warningCount": 0
    }
  }
}
```

#### 3. GET /api/oa/sessions/:sessionId
```javascript
// Response
{
  "success": true,
  "data": {
    "sessionId": "oa_abc123xyz",
    "status": "live",
    "startAt": "2026-01-31T10:00:00Z",
    "endAt": "2026-01-31T11:30:00Z",
    "serverNow": "2026-01-31T10:15:30Z", // CRITICAL: Client uses this for timer
    "remainingSeconds": 4470,
    
    "sections": [{
      "type": "mcq",
      "order": 0,
      "questions": [{
        "order": 0,
        "kind": "mcq",
        "refId": "mcq_123",
        "title": "What is the time complexity of...",
        "description": "...",
        "topic": "Array",
        "difficulty": "Medium",
        "options": [
          { "id": "a", "text": "O(n)" },
          { "id": "b", "text": "O(n²)" },
          { "id": "c", "text": "O(log n)" },
          { "id": "d", "text": "O(1)" }
        ],
        // NOTE: correctOptionId is NEVER included
        "points": 1,
        "savedAnswer": "b" // User's current answer if any
      }]
    }, {
      "type": "coding",
      "order": 1,
      "questions": [{
        "order": 0,
        "kind": "coding",
        "refId": "q_456",
        "title": "Two Sum",
        "description": "Given an array...",
        "examples": [...],
        "constraints": "1 <= n <= 10^5",
        "topic": "Array",
        "difficulty": "Easy",
        "points": 50,
        "savedAnswer": {
          "code": "def twoSum(nums, target):\n    ...",
          "language": "python"
        },
        "submission": {
          "isSubmitted": true,
          "passedCount": 8,
          "totalCount": 10,
          "verdict": "partial"
        }
      }]
    }],
    
    "proctoring": {
      "warningsAllowed": 3,
      "warningCount": 1
    }
  }
}
```

#### 4. PUT /api/oa/sessions/:sessionId/answers
```javascript
// Request (MCQ)
{
  "kind": "mcq",
  "refId": "mcq_123",
  "selectedOptionId": "b",
  "timeSpentSeconds": 45,
  "clientUpdatedAt": "2026-01-31T10:15:30Z"
}

// Request (Coding)
{
  "kind": "coding",
  "refId": "q_456",
  "code": "def twoSum(nums, target):\n    ...",
  "language": "python",
  "timeSpentSeconds": 600,
  "clientUpdatedAt": "2026-01-31T10:25:30Z"
}

// Response
{
  "success": true,
  "data": {
    "saved": true,
    "serverUpdatedAt": "2026-01-31T10:15:31Z"
  }
}
```

#### 5. POST /api/oa/sessions/:sessionId/violations
```javascript
// Request
{
  "type": "tab_hidden",
  "clientOccurredAt": "2026-01-31T10:20:00Z",
  "meta": {
    "visibilityState": "hidden"
  }
}

// Response
{
  "success": true,
  "data": {
    "recorded": true,
    "warningCount": 2,
    "warningsAllowed": 3,
    "message": "Warning 2 of 3. One more violation will auto-submit your OA.",
    "action": "warning_shown",
    "sessionStatus": "live" // or "submitted" / "terminated" if limit exceeded
  }
}
```

#### 6. POST /api/oa/sessions/:sessionId/submit
```javascript
// Response
{
  "success": true,
  "data": {
    "reportId": "report_xyz",
    "score": {
      "earned": 72,
      "total": 100,
      "percentage": 72
    },
    "summary": {
      "mcq": { "correct": 12, "total": 15 },
      "coding": { "fullySolved": 1, "partial": 1, "total": 2 }
    },
    "redirectTo": "/oa/sessions/oa_abc123xyz/report"
  }
}
```

---

## 🧠 Smart OA Selection Algorithm

```javascript
// backend/src/services/oa/questionSelectionEngine.js

class QuestionSelectionEngine {
  
  /**
   * Main entry point for selecting OA questions
   */
  async selectQuestions(config, userId) {
    // 1. Get user's history to avoid repeats
    const userHistory = await UserOAHistory.findOne({ userId });
    const attemptedMCQIds = new Set(userHistory?.attemptedMCQs.map(m => m.questionId.toString()) || []);
    const attemptedCodingIds = new Set(userHistory?.attemptedCoding.map(c => c.questionId.toString()) || []);
    
    // 2. Build selection criteria
    const criteria = this.buildCriteria(config);
    
    // 3. Get company patterns for difficulty distribution
    const companyPatterns = await this.getCompanyPatterns(config.selectedCompanies);
    const difficultyDist = this.calculateDifficultyDistribution(config, companyPatterns);
    
    // 4. Select MCQs
    const mcqs = await this.selectMCQs({
      count: config.questionCounts.mcq,
      criteria,
      difficultyDist: difficultyDist.mcq,
      excludeIds: attemptedMCQIds,
      userHistory,
    });
    
    // 5. Select Coding questions
    const coding = await this.selectCodingQuestions({
      count: config.questionCounts.coding,
      criteria,
      difficultyDist: difficultyDist.coding,
      excludeIds: attemptedCodingIds,
      userHistory,
    });
    
    // 6. Shuffle within sections for randomness
    return {
      mcqs: this.weightedShuffle(mcqs),
      coding: this.weightedShuffle(coding),
    };
  }
  
  /**
   * Build MongoDB query criteria from config
   */
  buildCriteria(config) {
    const criteria = { isActive: true };
    
    // Topic filter
    if (config.selectedTopics?.length > 0) {
      criteria.topic = { $in: config.selectedTopics };
    }
    
    // Company filter
    if (config.companyMode === 'selected' && config.selectedCompanies?.length > 0) {
      criteria.companyTags = { $in: config.selectedCompanies };
    }
    
    // Difficulty filter (non-adaptive)
    if (config.difficulty !== 'adaptive' && config.difficulty !== 'mixed') {
      criteria.difficulty = this.normalizeDifficulty(config.difficulty);
    }
    
    return criteria;
  }
  
  /**
   * Calculate difficulty distribution based on company patterns
   */
  calculateDifficultyDistribution(config, companyPatterns) {
    if (config.difficulty === 'adaptive') {
      // Use user's proficiency to adapt
      return this.adaptiveDifficultyDistribution(config.userId);
    }
    
    if (config.difficulty === 'mixed') {
      // Aggregate company patterns or use defaults
      if (companyPatterns.length > 0) {
        return this.aggregateCompanyDistributions(companyPatterns);
      }
      return {
        mcq: { Easy: 30, Medium: 50, Hard: 20 },
        coding: { Easy: 20, Medium: 50, Hard: 30 },
      };
    }
    
    // Single difficulty - 100% of that level
    const diff = this.normalizeDifficulty(config.difficulty);
    return {
      mcq: { [diff]: 100 },
      coding: { [diff]: 100 },
    };
  }
  
  /**
   * Select MCQs using weighted random sampling
   */
  async selectMCQs({ count, criteria, difficultyDist, excludeIds, userHistory }) {
    const selected = [];
    const difficultyBuckets = this.calculateBucketCounts(count, difficultyDist);
    
    for (const [difficulty, bucketCount] of Object.entries(difficultyBuckets)) {
      if (bucketCount === 0) continue;
      
      const bucketCriteria = {
        ...criteria,
        difficulty,
        _id: { $nin: Array.from(excludeIds) },
      };
      
      // Weighted selection: prefer questions user got wrong before (for reinforcement)
      const weakTopics = this.getWeakTopics(userHistory);
      
      const questions = await MCQQuestion.aggregate([
        { $match: bucketCriteria },
        {
          $addFields: {
            weight: {
              $cond: {
                if: { $in: ['$topic', weakTopics] },
                then: 2, // Higher weight for weak topics
                else: 1,
              },
            },
          },
        },
        { $sample: { size: bucketCount * 3 } }, // Oversample
        { $sort: { weight: -1 } },
        { $limit: bucketCount },
      ]);
      
      selected.push(...questions);
    }
    
    return selected;
  }
  
  /**
   * Select coding questions with similar logic
   */
  async selectCodingQuestions({ count, criteria, difficultyDist, excludeIds, userHistory }) {
    const selected = [];
    const difficultyBuckets = this.calculateBucketCounts(count, difficultyDist);
    
    for (const [difficulty, bucketCount] of Object.entries(difficultyBuckets)) {
      if (bucketCount === 0) continue;
      
      const bucketCriteria = {
        ...criteria,
        difficulty,
        _id: { $nin: Array.from(excludeIds) },
        isActive: true,
      };
      
      const questions = await Question.aggregate([
        { $match: bucketCriteria },
        { $sample: { size: bucketCount * 2 } },
        { $limit: bucketCount },
      ]);
      
      selected.push(...questions);
    }
    
    return selected;
  }
  
  /**
   * Adaptive difficulty based on user performance
   */
  async adaptiveDifficultyDistribution(userId) {
    const userHistory = await UserOAHistory.findOne({ userId });
    
    if (!userHistory || userHistory.totalOAs < 3) {
      // Cold start: use balanced distribution
      return {
        mcq: { Easy: 30, Medium: 50, Hard: 20 },
        coding: { Easy: 30, Medium: 50, Hard: 20 },
      };
    }
    
    const { difficultyProficiency } = userHistory;
    
    // If high accuracy at current level, increase difficulty
    // If low accuracy, decrease difficulty
    const easyAcc = difficultyProficiency.easy?.accuracy || 0.5;
    const medAcc = difficultyProficiency.medium?.accuracy || 0.5;
    const hardAcc = difficultyProficiency.hard?.accuracy || 0.5;
    
    if (hardAcc > 0.7) {
      // User is crushing hard - give more hard
      return {
        mcq: { Easy: 10, Medium: 30, Hard: 60 },
        coding: { Easy: 0, Medium: 30, Hard: 70 },
      };
    } else if (medAcc > 0.7 && hardAcc > 0.4) {
      // Ready for more hard
      return {
        mcq: { Easy: 15, Medium: 45, Hard: 40 },
        coding: { Easy: 10, Medium: 50, Hard: 40 },
      };
    } else if (medAcc < 0.5) {
      // Struggling with medium - more easy
      return {
        mcq: { Easy: 50, Medium: 40, Hard: 10 },
        coding: { Easy: 50, Medium: 40, Hard: 10 },
      };
    }
    
    // Default balanced
    return {
      mcq: { Easy: 25, Medium: 50, Hard: 25 },
      coding: { Easy: 25, Medium: 50, Hard: 25 },
    };
  }
  
  /**
   * Calculate bucket counts from percentages
   */
  calculateBucketCounts(total, distribution) {
    const buckets = {};
    let assigned = 0;
    
    for (const [diff, pct] of Object.entries(distribution)) {
      const count = Math.round(total * (pct / 100));
      buckets[diff] = count;
      assigned += count;
    }
    
    // Handle rounding errors
    if (assigned < total) {
      buckets['Medium'] = (buckets['Medium'] || 0) + (total - assigned);
    }
    
    return buckets;
  }
  
  /**
   * Get user's weak topics for weighted selection
   */
  getWeakTopics(userHistory) {
    if (!userHistory?.topicProficiency) return [];
    
    const weak = [];
    for (const [topic, prof] of userHistory.topicProficiency.entries()) {
      if (prof.accuracy < 0.5 && prof.attempted >= 3) {
        weak.push(topic);
      }
    }
    return weak;
  }
  
  /**
   * Weighted shuffle - maintains some structure while adding randomness
   */
  weightedShuffle(questions) {
    // Group by difficulty
    const groups = { Easy: [], Medium: [], Hard: [] };
    questions.forEach(q => groups[q.difficulty]?.push(q) || groups.Medium.push(q));
    
    // Shuffle within groups
    Object.values(groups).forEach(g => this.fisherYatesShuffle(g));
    
    // Interleave: Easy -> Medium -> Hard -> Medium -> Easy pattern
    const result = [];
    const maxLen = Math.max(...Object.values(groups).map(g => g.length));
    
    for (let i = 0; i < maxLen; i++) {
      if (groups.Easy[i]) result.push(groups.Easy[i]);
      if (groups.Medium[i]) result.push(groups.Medium[i]);
      if (groups.Hard[i]) result.push(groups.Hard[i]);
    }
    
    return result;
  }
  
  fisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

export default new QuestionSelectionEngine();
```

---

## 🎨 Frontend Component Structure

```
frontend/src/
├── pages/
│   └── oa/
│       ├── OADashboard.jsx          # Entry point with "Start OA" button
│       ├── OAConfigModal.jsx        # Configuration modal
│       ├── OASession.jsx            # Main OA execution page
│       ├── OAReport.jsx             # Post-OA report page
│       └── OAHistory.jsx            # Past OA attempts
│
├── components/
│   └── oa/
│       ├── config/
│       │   ├── CompanySelector.jsx
│       │   ├── TopicSelector.jsx
│       │   ├── DifficultySelector.jsx
│       │   ├── QuestionCountConfig.jsx
│       │   ├── TimingConfig.jsx
│       │   └── ProctoringConfig.jsx
│       │
│       ├── session/
│       │   ├── OATimer.jsx           # Server-synced countdown
│       │   ├── OASectionNav.jsx      # MCQ/Coding tab navigation
│       │   ├── OAQuestionList.jsx    # Question palette
│       │   ├── OAProgressBar.jsx     # Section progress
│       │   ├── OAWarningBanner.jsx   # Tab switch warnings
│       │   └── OASubmitConfirm.jsx   # Final submit modal
│       │
│       ├── mcq/
│       │   ├── MCQQuestion.jsx
│       │   ├── MCQOptions.jsx
│       │   └── MCQNavigation.jsx
│       │
│       ├── coding/
│       │   ├── CodingQuestion.jsx
│       │   ├── CodingEditor.jsx      # Monaco editor
│       │   ├── TestCasePanel.jsx
│       │   ├── RunButton.jsx
│       │   └── SubmitButton.jsx
│       │
│       └── report/
│           ├── ScoreSummary.jsx
│           ├── TopicBreakdown.jsx
│           ├── DifficultyBreakdown.jsx
│           ├── TimeAnalysis.jsx
│           ├── IntegrityStatus.jsx
│           ├── WeakTopicsCard.jsx
│           └── RecommendedProblems.jsx
│
├── hooks/
│   └── oa/
│       ├── useOASession.js           # Session state management
│       ├── useOATimer.js             # Server-synced timer logic
│       ├── useAutosave.js            # Debounced autosave
│       ├── useTabVisibility.js       # Tab switch detection
│       ├── useFullscreen.js          # Fullscreen API
│       └── useOAProctoring.js        # Combined proctoring logic
│
├── services/
│   └── oa/
│       └── oaService.js              # API calls
│
└── context/
    └── OASessionContext.jsx          # Global OA state
```

### Key Component: useOATimer.js

```javascript
// frontend/src/hooks/oa/useOATimer.js

import { useState, useEffect, useCallback, useRef } from 'react';

export function useOATimer(session) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const serverTimeOffset = useRef(0);
  
  // Calculate server time offset on session load
  useEffect(() => {
    if (session?.serverNow && session?.endAt) {
      const serverNow = new Date(session.serverNow).getTime();
      const clientNow = Date.now();
      serverTimeOffset.current = serverNow - clientNow;
      
      // Calculate initial remaining time
      const endAt = new Date(session.endAt).getTime();
      const adjustedNow = clientNow + serverTimeOffset.current;
      const remaining = Math.max(0, Math.floor((endAt - adjustedNow) / 1000));
      
      setRemainingSeconds(remaining);
      setIsExpired(remaining <= 0);
    }
  }, [session?.serverNow, session?.endAt]);
  
  // Countdown ticker
  useEffect(() => {
    if (remainingSeconds <= 0 || isExpired) return;
    
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [remainingSeconds, isExpired]);
  
  // Format time display
  const formatTime = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isExpired,
    isWarning: remainingSeconds > 0 && remainingSeconds <= 300, // Last 5 mins
    isCritical: remainingSeconds > 0 && remainingSeconds <= 60,  // Last 1 min
  };
}
```

### Key Component: useTabVisibility.js

```javascript
// frontend/src/hooks/oa/useTabVisibility.js

import { useEffect, useRef, useCallback } from 'react';
import { oaService } from '../../services/oa/oaService';

export function useTabVisibility(sessionId, onWarning, onTerminate) {
  const cooldownRef = useRef(false);
  const cooldownMs = 2000; // Debounce rapid events
  
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === 'hidden' && !cooldownRef.current) {
      cooldownRef.current = true;
      
      try {
        const response = await oaService.logViolation(sessionId, {
          type: 'tab_hidden',
          clientOccurredAt: new Date().toISOString(),
          meta: { visibilityState: document.visibilityState },
        });
        
        if (response.data.sessionStatus === 'submitted' || 
            response.data.sessionStatus === 'terminated') {
          onTerminate?.(response.data);
        } else {
          onWarning?.(response.data);
        }
      } catch (error) {
        console.error('Failed to log violation:', error);
      }
      
      setTimeout(() => {
        cooldownRef.current = false;
      }, cooldownMs);
    }
  }, [sessionId, onWarning, onTerminate]);
  
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also detect window blur (secondary)
    const handleBlur = () => {
      if (!cooldownRef.current) {
        handleVisibilityChange();
      }
    };
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleVisibilityChange]);
}
```

---

## ⏰ OA Scheduling System

```javascript
// backend/src/services/oa/oaScheduler.js

import OASession from '../../models/oa/OASession.js';

class OAScheduler {
  constructor() {
    this.checkInterval = null;
  }
  
  async initialize() {
    console.log('✓ OA Scheduler initialized');
    
    // Initial check
    await this.checkAndUpdateSessions();
    
    // Periodic check every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkAndUpdateSessions();
    }, 10000);
  }
  
  async checkAndUpdateSessions() {
    const now = new Date();
    
    try {
      // 1. Start scheduled sessions that should be live
      const shouldBeLive = await OASession.find({
        status: 'scheduled',
        startAt: { $lte: now },
        endAt: { $gt: now },
      });
      
      for (const session of shouldBeLive) {
        session.status = 'live';
        session.actualStartedAt = now;
        await session.save();
        console.log(`[OA Scheduler] Session ${session.sessionCode} is now LIVE`);
      }
      
      // 2. Expire sessions past their end time
      const shouldBeExpired = await OASession.find({
        status: 'live',
        endAt: { $lte: now },
      });
      
      for (const session of shouldBeExpired) {
        await this.expireSession(session);
      }
      
    } catch (error) {
      console.error('[OA Scheduler] Error:', error.message);
    }
  }
  
  async expireSession(session) {
    session.status = 'expired';
    session.terminatedReason = 'time_expired';
    await session.save();
    
    // Trigger auto-evaluation
    await this.generateReport(session._id);
    
    console.log(`[OA Scheduler] Session ${session.sessionCode} EXPIRED`);
  }
  
  async generateReport(sessionId) {
    // Import here to avoid circular dependency
    const { generateOAReport } = await import('./reportGenerator.js');
    await generateOAReport(sessionId);
  }
  
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    console.log('✓ OA Scheduler shut down');
  }
}

export default new OAScheduler();
```

---

## 🛡️ Anti-Cheat & Proctoring

### Backend Violation Handler

```javascript
// backend/src/controllers/oa/violationController.js

export const logViolation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, clientOccurredAt, meta } = req.body;
    const userId = req.user._id;
    
    // 1. Verify session belongs to user and is live
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: 'live',
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or not active',
      });
    }
    
    // 2. Create violation record
    const violation = await OAViolation.create({
      sessionId,
      userId,
      type,
      occurredAt: new Date(),
      clientOccurredAt: clientOccurredAt ? new Date(clientOccurredAt) : null,
      meta,
      warningNumber: session.proctoring.warningCount + 1,
    });
    
    // 3. Increment warning count
    session.proctoring.warningCount += 1;
    session.proctoring.violationCount += 1;
    
    let action = 'warning_shown';
    let message = `Warning ${session.proctoring.warningCount} of ${session.proctoring.warningsAllowed}.`;
    
    // 4. Check if limit exceeded
    if (session.proctoring.warningCount >= session.proctoring.warningsAllowed) {
      if (session.proctoring.actionOnExceed === 'auto_submit') {
        session.status = 'submitted';
        session.terminatedReason = 'warnings_exceeded';
        session.submittedAt = new Date();
        action = 'auto_submit';
        message = 'Warning limit exceeded. Your OA has been auto-submitted.';
        
        // Trigger report generation
        generateOAReport(sessionId); // Fire and forget
        
      } else {
        session.status = 'terminated';
        session.terminatedReason = 'warnings_exceeded';
        action = 'terminate';
        message = 'Warning limit exceeded. Your OA has been terminated.';
      }
    } else {
      const remaining = session.proctoring.warningsAllowed - session.proctoring.warningCount;
      message += ` ${remaining} warning(s) remaining.`;
    }
    
    violation.triggeredAction = action;
    await violation.save();
    await session.save();
    
    res.status(200).json({
      success: true,
      data: {
        recorded: true,
        warningCount: session.proctoring.warningCount,
        warningsAllowed: session.proctoring.warningsAllowed,
        message,
        action,
        sessionStatus: session.status,
      },
    });
    
  } catch (error) {
    console.error('[Violation] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to log violation',
    });
  }
};
```

---

## 📊 Post-OA Analysis Engine

```javascript
// backend/src/services/oa/reportGenerator.js

export async function generateOAReport(sessionId) {
  const session = await OASession.findById(sessionId);
  const answers = await OAAnswer.find({ sessionId });
  const violations = await OAViolation.find({ sessionId });
  
  // 1. Evaluate MCQs
  const mcqResults = await evaluateMCQs(session, answers);
  
  // 2. Evaluate Coding (already done during submit, just aggregate)
  const codingResults = aggregateCodingResults(session, answers);
  
  // 3. Calculate scores
  const score = calculateTotalScore(mcqResults, codingResults, session);
  
  // 4. Topic-wise breakdown
  const topicWise = calculateTopicBreakdown(session, answers, mcqResults);
  
  // 5. Difficulty-wise breakdown
  const difficultyWise = calculateDifficultyBreakdown(session, answers, mcqResults);
  
  // 6. Time analysis
  const timeAnalysis = calculateTimeAnalysis(answers);
  
  // 7. Integrity assessment
  const integrity = assessIntegrity(session, violations);
  
  // 8. AI Insights
  const insights = await generateInsights({
    score,
    topicWise,
    difficultyWise,
    timeAnalysis,
    integrity,
    session,
  });
  
  // 9. Create report
  const report = await OAReport.create({
    sessionId,
    userId: session.userId,
    startedAt: session.actualStartedAt || session.startAt,
    submittedAt: session.submittedAt || new Date(),
    totalTimeSeconds: calculateTotalTime(session),
    score,
    mcqPerformance: mcqResults.summary,
    codingPerformance: codingResults.summary,
    topicWise,
    difficultyWise,
    timeAnalysis,
    integrity,
    insights,
    rawAnswers: buildRawAnswers(answers, mcqResults),
  });
  
  // 10. Update user history
  await updateUserOAHistory(session.userId, report);
  
  return report;
}

async function generateInsights(data) {
  const { score, topicWise, difficultyWise, timeAnalysis } = data;
  
  // Determine practice level
  let practiceLevel = 'Beginner';
  if (score.percentage >= 80 && difficultyWise.hard.accuracy >= 0.5) {
    practiceLevel = 'OA-Ready';
  } else if (score.percentage >= 60 && difficultyWise.medium.accuracy >= 0.6) {
    practiceLevel = 'Advanced';
  } else if (score.percentage >= 40) {
    practiceLevel = 'Intermediate';
  }
  
  // Find weak and strong topics
  const weakTopics = topicWise
    .filter(t => t.accuracy < 0.5 && t.attempted >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
    .map(t => t.topic);
  
  const strongTopics = topicWise
    .filter(t => t.accuracy >= 0.7 && t.attempted >= 2)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3)
    .map(t => t.topic);
  
  // Generate recommendations
  const recommendations = [];
  
  if (weakTopics.length > 0) {
    recommendations.push({
      type: 'topic',
      message: `Focus on improving: ${weakTopics.join(', ')}`,
      actionable: `Practice 10 problems each from ${weakTopics[0]}`,
    });
  }
  
  if (timeAnalysis.avgTimePerMCQ > 120) {
    recommendations.push({
      type: 'speed',
      message: 'Your MCQ solving speed is slower than optimal',
      actionable: 'Target 60-90 seconds per MCQ in practice',
    });
  }
  
  if (difficultyWise.hard.accuracy < 0.3 && difficultyWise.medium.accuracy > 0.7) {
    recommendations.push({
      type: 'difficulty',
      message: 'Ready to tackle more hard problems',
      actionable: 'Include 2-3 hard problems in daily practice',
    });
  }
  
  // Get recommended problems (from weak topics)
  const recommendedProblems = await getRecommendedProblems(weakTopics, data.session.userId);
  
  return {
    practiceLevel,
    weakTopics,
    strongTopics,
    recommendations,
    recommendedProblems,
    comparisonToAvg: await calculatePercentile(score.percentage),
  };
}
```

---

## 🚀 Implementation Prompt

Copy this prompt to implement the feature:

---

**PROMPT FOR IMPLEMENTATION:**

```
You are a senior full-stack engineer implementing an "OA Practice" feature for an existing EdTech platform (Arrakis-Labs).

EXISTING CODEBASE CONTEXT:
- Backend: Node.js + Express in backend/src/app.js
- Routes mounted under /api/* with patterns from contestRoutes.js
- Auth middleware: `protect` from middleware/auth/authMiddleware.js
- Existing models: Question, TestCase, Submission in backend/src/models/
- Judge system: Piston-based execution in services/judge/
- Frontend: React + Tailwind in frontend/src/
- Routing: react-router in frontend/src/App.jsx with ProtectedRoute

FEATURE: Customized Online Assessment (OA) Practice

REQUIREMENTS:

1. OA CONFIGURATION FLOW
   - Add "Start OA Practice" button to user dashboard
   - Show configuration modal with:
     - Company selection (all/specific multi-select)
     - OA type (coding/mcq/mixed)
     - Topics (DSA: Array, String, DP, etc. | CS: OS, DBMS, CN, OOPs)
     - Difficulty (easy/medium/hard/adaptive/mixed)
     - Question counts (MCQ count, coding count)
     - Duration (fixed minutes or company-specific)
     - Language preference
     - Start mode (now/scheduled)
     - Proctoring settings (tab switch detection, warnings allowed)
   - "Quick Fight" option: randomized OA with defaults

2. SMART QUESTION SELECTION (Backend)
   - Select questions based on topics, companies, difficulty
   - Implement weighted random selection
   - Difficulty distribution matching real OA patterns
   - Avoid repeating previously attempted questions
   - Adaptive difficulty based on user history (optional)

3. OA SESSION MANAGEMENT
   - Backend authoritative timer: store startAt + endAt in DB
   - Client timer syncs from serverNow, never from local state
   - Session states: scheduled → live → submitted/terminated/expired
   - Lock questions at session creation (immutable)
   - Page refresh must not reset timer or questions

4. REAL OA EXPERIENCE UI
   - Fullscreen mode (optional, using Fullscreen API)
   - Section tabs: MCQ section, Coding section
   - Question palette/navigation
   - Live countdown timer (server-synced)
   - Autosave answers (debounced, every change)
   - Warning banner for low time

5. PROCTORING (Tab Switch Detection Only)
   - Use document.visibilitychange + window.blur
   - Log violations to backend with timestamps
   - Show warning count to user
   - Configurable warning limit (default 3)
   - Auto-submit or terminate on limit exceeded
   - DO NOT implement: camera, fullscreen enforcement, clipboard blocking

6. EVALUATION
   - MCQs: Auto-evaluate against correctOptionId
   - Coding: Use existing Piston judge with hidden tests
   - Support partial scoring for coding (passedCount/totalCount)
   - Calculate per-question scores

7. POST-OA REPORT
   - Total score + percentage
   - MCQ performance (correct/wrong/skipped)
   - Coding performance (full solve/partial/attempted)
   - Topic-wise accuracy breakdown
   - Difficulty-wise performance
   - Time spent per question
   - Tab switch count + integrity status
   - Practice level assessment (Beginner/Intermediate/Advanced/OA-Ready)
   - Weak topics identification
   - Recommended practice problems

8. DATA PERSISTENCE
   - Store: OA configs, sessions, answers, violations, reports
   - User OA history with attempted questions
   - Enable future analytics and improvement tracking

DELIVERABLES:

BACKEND:
1. Models (in backend/src/models/oa/):
   - MCQQuestion.js
   - CompanyOAPattern.js
   - OAConfig.js
   - OASession.js
   - OAAnswer.js
   - OAViolation.js
   - OAReport.js
   - UserOAHistory.js

2. Routes (in backend/src/routes/oa/):
   - oaRoutes.js with all endpoints

3. Controllers (in backend/src/controllers/oa/):
   - metadataController.js
   - sessionController.js
   - answerController.js
   - violationController.js
   - reportController.js

4. Services (in backend/src/services/oa/):
   - questionSelectionEngine.js
   - oaScheduler.js
   - evaluationEngine.js
   - reportGenerator.js

5. Mount routes in app.js:
   app.use("/api/oa", oaRoutes);

6. Initialize scheduler in app.js startup

FRONTEND:
1. Pages (in frontend/src/pages/oa/):
   - OADashboard.jsx
   - OAConfigModal.jsx
   - OASession.jsx
   - OAReport.jsx
   - OAHistory.jsx

2. Components (in frontend/src/components/oa/)

3. Hooks (in frontend/src/hooks/oa/):
   - useOASession.js
   - useOATimer.js
   - useAutosave.js
   - useTabVisibility.js

4. Services (in frontend/src/services/oa/):
   - oaService.js

5. Routes in App.jsx:
   - /oa → OADashboard
   - /oa/session/:sessionId → OASession
   - /oa/session/:sessionId/report → OAReport
   - /oa/history → OAHistory

CRITICAL RULES:
- Timer MUST be derived from (endAt - serverNow), never from frontend state
- correctOptionId MUST never be sent to client during live session
- Session questions are immutable after creation
- All autosaves must be debounced (300-500ms)
- Proctoring violations must be server-timestamped
- Follow existing code patterns and folder structure
- Use protect middleware for all authenticated routes
- Handle all edge cases (network errors, session expiry, etc.)

QUALITY:
- Clean separation of concerns
- Consistent error handling
- Proper indexes on collections
- Idempotent API operations where applicable
- No modification of unrelated existing features
```

---

## UX Best Practices (FAANG-Level Feel)

1. **Pre-OA Checklist**
   - Show system requirements check
   - Verify stable internet
   - Confirm fullscreen capability
   - Test tab switch detection

2. **During OA**
   - Persistent timer always visible
   - Clear section navigation
   - Auto-save indicator ("Saved ✓")
   - Smooth transitions between questions
   - Keyboard shortcuts (Ctrl+S to save, arrows to navigate)

3. **Warning UX**
   - Non-blocking toast for first warning
   - Modal for second warning
   - Full-screen alert for final warning

4. **Post-OA**
   - Immediate score reveal with animation
   - Detailed breakdown with visualizations
   - Actionable next steps
   - Share/download report option

---

This specification is now tailored to your Arrakis-Labs codebase and ready for implementation!
