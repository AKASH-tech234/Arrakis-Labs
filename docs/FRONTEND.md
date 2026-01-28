# Frontend Documentation

> **Mentat Trials Frontend** - React-based Single Page Application for the AI-powered competitive programming platform.

## 📁 Directory Structure

```
frontend/src/
├── main.jsx                    # Application entry point
├── App.jsx                     # Root component with routing
├── index.css                   # Global styles
│
├── components/                 # Reusable UI components
│   ├── admin/                  # Admin panel components
│   │   ├── AdminLayout.jsx     # Admin dashboard layout
│   │   ├── AdminSidebar.jsx    # Admin navigation
│   │   └── common/             # Shared admin components
│   │       ├── ConfirmModal.jsx
│   │       ├── DataTable.jsx
│   │       ├── Drawer.jsx
│   │       └── Pagination.jsx
│   │
│   ├── ai/                     # AI feedback components
│   │   └── PatternHistory.jsx  # Historical pattern display
│   │
│   ├── auth/                   # Route guards
│   │   ├── AdminRoute.jsx      # Admin-only routes
│   │   ├── GuestRoute.jsx      # Unauthenticated routes
│   │   └── ProtectedRoute.jsx  # Authenticated routes
│   │
│   ├── charts/                 # Data visualization
│   │   ├── ActivityHeatmap.jsx # GitHub-style activity grid
│   │   ├── CategoryChart.jsx   # Category breakdown
│   │   ├── StatsOverview.jsx   # Stats dashboard
│   │   └── SubmissionSummary.jsx
│   │
│   ├── editor/                 # Code editing
│   │   ├── CodeEditor.jsx      # Monaco editor wrapper
│   │   └── OutputPanel.jsx     # Execution results
│   │
│   ├── feedback/               # AI feedback display
│   │   ├── AIFeedbackPanel.jsx     # Main feedback component
│   │   ├── AIFeedbackPanelV2.jsx   # Enhanced version
│   │   ├── AILoadingScreen.jsx     # Loading states
│   │   ├── ConfidenceBadge.jsx     # ML confidence display
│   │   ├── LearningTimeline.jsx    # Progress timeline
│   │   └── WeeklyReportUI.jsx      # Weekly summaries
│   │
│   ├── mim/                    # MIM Intelligence components
│   │   ├── CognitiveProfile.jsx       # User skill profile
│   │   ├── LearningRoadmap.jsx        # Personalized path
│   │   ├── MIMInsights.jsx            # Legacy insights
│   │   ├── MIMInsightsV3.jsx          # V3 polymorphic display
│   │   ├── ProblemRecommendations.jsx # Smart suggestions
│   │   └── SkillRadarChart.jsx        # Skill visualization
│   │
│   ├── potd/                   # Problem of the Day
│   │   ├── POTDBanner.jsx      # Featured POTD display
│   │   ├── POTDCalendar.jsx    # Monthly calendar view
│   │   ├── POTDCard.jsx        # Individual POTD card
│   │   ├── StreakWidget.jsx    # Streak tracker
│   │   └── StreakLeaderboard.jsx
│   │
│   ├── problem/                # Problem browsing
│   │   ├── ProblemCard.jsx     # Problem list item
│   │   ├── ProblemDescription.jsx  # Full problem view
│   │   ├── ProblemFilters.jsx  # Search/filter UI
│   │   ├── ProblemList.jsx     # Problem grid/list
│   │   └── ProblemSubmissionsPanel.jsx
│   │
│   └── layout/                 # Layout components
│       ├── AppHeader.jsx       # Main navigation header
│       └── Header.jsx          # Alternative header
│
├── context/                    # React Context providers
│   ├── AuthContext.jsx         # User authentication state
│   ├── AdminAuthContext.jsx    # Admin authentication
│   └── SubmissionContext.jsx   # Submission & AI feedback state
│
├── hooks/                      # Custom React hooks
│   ├── admin/
│   │   ├── useConfirmation.js  # Confirmation dialogs
│   │   └── usePermission.js    # Permission checks
│   ├── ai/
│   │   ├── useAIFeedback.js         # Basic AI feedback
│   │   └── useAIFeedbackEnhanced.js # Enhanced with events
│   ├── common/
│   │   ├── useConfidenceBadge.js
│   │   └── useResizable.js     # Resizable panels
│   ├── contest/
│   │   ├── useContestTimer.js  # Countdown timer
│   │   └── useContestWebSocket.js  # Live updates
│   └── profile/
│       ├── useLearningTimeline.js
│       ├── useProfileAnalytics.js
│       └── useWeeklyReport.js
│
├── pages/                      # Route pages
│   ├── admin/                  # Admin pages
│   │   ├── AdminDashboard.jsx
│   │   ├── QuestionEditor.jsx
│   │   ├── QuestionList.jsx
│   │   ├── TestCaseManager.jsx
│   │   ├── AdminPOTDScheduler.jsx
│   │   └── contests/
│   │
│   ├── auth/                   # Authentication pages
│   │   ├── login.jsx
│   │   └── signup.jsx
│   │
│   ├── common/                 # Main user pages
│   │   ├── landing.jsx         # Homepage
│   │   ├── problem.jsx         # Problem library
│   │   ├── problemdetail.jsx   # Problem solving view
│   │   └── SubmissionResult.jsx # AI feedback display
│   │
│   ├── contest/                # Contest pages
│   │   ├── ContestList.jsx
│   │   ├── ContestDetail.jsx
│   │   └── ContestProblem.jsx
│   │
│   ├── potd/                   # POTD pages
│   │   ├── POTDHome.jsx
│   │   ├── POTDHistory.jsx
│   │   └── POTDLeaderboard.jsx
│   │
│   └── profile/                # User profile pages
│       ├── profile.jsx         # Main profile
│       └── codingProfile.jsx   # External profiles
│
├── services/                   # API service layers
│   ├── admin/
│   │   ├── adminApi.js         # Admin endpoints
│   │   └── adminContestApi.js
│   ├── ai/
│   │   └── aiApi.js            # AI service calls
│   ├── common/
│   │   ├── api.js              # Base API config
│   │   └── discussApi.js       # Discussion endpoints
│   ├── contest/
│   │   └── contestApi.js
│   ├── potd/
│   │   └── potdApi.js
│   └── profile/
│       └── codingProfileApi.js
│
└── types/                      # TypeScript-like type definitions
    ├── ai.types.js             # AI response types
    └── problem.types.js        # Problem types
```

---

## 🔀 Routing Structure

```jsx
// App.jsx - Route Configuration
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
  <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
  <Route path="/u/:username" element={<PublicProfile />} />
  <Route path="/contests" element={<ContestList />} />

  {/* Protected Routes (Authenticated Users) */}
  <Route path="/problems" element={<ProtectedRoute><ProblemLibrary /></ProtectedRoute>} />
  <Route path="/problems/:id" element={<ProtectedRoute><ProblemDetail /></ProtectedRoute>} />
  <Route path="/submissions/:id" element={<ProtectedRoute><SubmissionResult /></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
  <Route path="/coding-profile" element={<ProtectedRoute><CodingProfile /></ProtectedRoute>} />
  <Route path="/potd" element={<ProtectedRoute><POTDHome /></ProtectedRoute>} />
  <Route path="/contests/:contestId" element={<ProtectedRoute><ContestDetail /></ProtectedRoute>} />

  {/* Admin Routes */}
  <Route path="/admin/login" element={<AdminLogin />} />
  <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<AdminDashboard />} />
    <Route path="questions" element={<QuestionList />} />
    <Route path="questions/:id" element={<QuestionEditor />} />
    <Route path="contests" element={<AdminContestList />} />
    <Route path="potd" element={<AdminPOTDScheduler />} />
  </Route>
</Routes>
```

---

## 🧠 State Management

### Context Providers Hierarchy

```jsx
<AuthProvider>              {/* User authentication */}
  <AdminAuthProvider>       {/* Admin authentication */}
    <SubmissionProvider>    {/* Submissions & AI feedback */}
      <Router>
        <App />
      </Router>
    </SubmissionProvider>
  </AdminAuthProvider>
</AuthProvider>
```

### SubmissionContext (Core State)

The `SubmissionContext` manages the entire submission and AI feedback lifecycle:

```javascript
// State Structure
{
  // Current submission data
  currentSubmission: {
    id: "sub_abc123",
    questionId: "q_123",
    verdict: "wrong_answer",  // accepted, wrong_answer, tle, etc.
    language: "python",
    code: "...",
    runtime: 45,
    memory: 12.5,
    passedCount: 8,
    totalCount: 10
  },
  
  // Submission history (last 10)
  submissionHistory: [...],
  
  // Code execution state
  executionStatus: "idle" | "running" | "success" | "error",
  executionOutput: {...},
  executionError: null,
  
  // AI Feedback state
  aiStatus: "idle" | "loading" | "success" | "error",
  aiFeedback: {
    hints: [...],           // Progressive hints
    explanation: "...",     // Full explanation
    detectedPattern: "...", // Pattern name
    mimInsights: {...},     // MIM ML predictions
    optimizationTips: [...],
    complexityAnalysis: {...}
  },
  aiError: null,
  
  // UI state
  revealedHintLevel: 1,     // How many hints revealed
  showFullExplanation: false,
  showAIPanel: false
}
```

### Key Actions

```javascript
// SubmissionContext Actions
const actions = {
  // Code execution
  runCode(code, language, testCases),
  
  // Full submission
  submitCode(questionId, code, language),
  
  // AI feedback
  requestAIFeedback(),
  retryAIFeedback(),
  
  // Progressive hints
  revealNextHint(),
  toggleExplanation(),
  
  // State management
  clearSubmission(),
  resetAIFeedback()
};
```

---

## 🔄 Data Flow

### Submission Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User Types │     │   Submit    │     │   Backend   │     │  Piston API │
│    Code     │────▶│   Button    │────▶│   /submit   │────▶│  (Execute)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Display    │◀────│  AI Service │◀────│  Verdict +  │
│  Feedback   │     │  /feedback  │     │  Results    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### AI Feedback Flow

```javascript
// 1. Submission completes
dispatch({ type: 'SUBMISSION_COMPLETE', payload: { submission } });

// 2. Auto-trigger AI feedback request
useEffect(() => {
  if (hasSubmission && aiStatus === 'idle' && !hasAIFeedback) {
    requestAIFeedback();
  }
}, [hasSubmission, aiStatus, hasAIFeedback]);

// 3. Request AI feedback from backend
const requestAIFeedback = async () => {
  dispatch({ type: 'AI_REQUEST_START' });
  
  const response = await fetch('/api/ai/feedback', {
    method: 'POST',
    body: JSON.stringify({
      submission_id: currentSubmission.id,
      user_id: user.id,
      problem_id: currentSubmission.questionId,
      code: currentSubmission.code,
      verdict: currentSubmission.verdict,
      // ... more context
    })
  });
  
  const feedback = await response.json();
  dispatch({ type: 'AI_REQUEST_SUCCESS', payload: { feedback } });
};

// 4. Display in SubmissionResult.jsx
```

---

## 🎨 Key Components

### 1. CodeEditor (`components/editor/CodeEditor.jsx`)

Monaco-based code editor with syntax highlighting:

```jsx
<CodeEditor
  language="python"
  value={code}
  onChange={setCode}
  theme="vs-dark"
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    automaticLayout: true
  }}
/>
```

### 2. MIMInsightsV3 (`components/mim/MIMInsightsV3.jsx`)

Displays MIM V3.0 polymorphic feedback:

```jsx
// Handles three feedback types:
// 1. correctness_feedback - For WA/RE verdicts
// 2. performance_feedback - For TLE/MLE verdicts  
// 3. reinforcement_feedback - For accepted solutions

<MIMInsightsV3 
  insights={{
    feedbackType: "correctness",
    correctnessFeedback: {
      rootCause: "correctness",
      subtype: "off_by_one",
      failureMechanism: "Loop bounds incorrect",
      confidence: 0.85,
      isRecurring: true,
      recurrenceCount: 3
    }
  }}
  expanded={true}
/>
```

### 3. SubmissionResult (`pages/common/SubmissionResult.jsx`)

Main feedback display page with:
- Verdict badge and stats
- Progressive hints (HintsView)
- Full analysis (SummaryView)
- MIM Intelligence panel

```jsx
// View states
const [currentView, setCurrentView] = useState("initial");
// "initial" → "hints" (for WA) or "summary" (for AC)

// Auto-transition based on verdict
useEffect(() => {
  if (hasAIFeedback && currentView === "initial") {
    setCurrentView(isAccepted ? "summary" : "hints");
  }
}, [hasAIFeedback, isAccepted]);
```

### 4. CognitiveProfile (`components/mim/CognitiveProfile.jsx`)

Displays user's learning profile:
- Skill radar chart
- Strength/weakness topics
- Dominant mistake patterns
- Learning recommendations

### 5. ProblemRecommendations (`components/mim/ProblemRecommendations.jsx`)

Smart problem suggestions based on:
- Current skill gaps
- Difficulty readiness scores
- Recent mistake patterns

---

## 🪝 Custom Hooks

### useAIFeedbackEnhanced

Enhanced AI feedback hook with event system:

```javascript
const {
  feedback,
  isLoading,
  error,
  requestFeedback,
  retryFeedback,
  
  // Progressive hints
  revealedLevel,
  revealNextHint,
  hasMoreHints,
  
  // MIM insights
  mimInsights,
  rootCause,
  confidence
} = useAIFeedbackEnhanced(submissionId);
```

### useContestWebSocket

Real-time contest updates:

```javascript
const {
  isConnected,
  leaderboard,
  submissions,
  announcements,
  timeRemaining
} = useContestWebSocket(contestId);
```

### useProfileAnalytics

User analytics data:

```javascript
const {
  stats,
  activityHeatmap,
  categoryBreakdown,
  difficultyProgress,
  recentSubmissions
} = useProfileAnalytics(userId);
```

---

## 🔌 API Services

### AI API (`services/ai/aiApi.js`)

```javascript
// Request AI feedback for submission
export const getAIFeedback = async (submissionData) => {
  return api.post('/ai/feedback', submissionData);
};

// Get user's cognitive profile
export const getCognitiveProfile = async (userId) => {
  return api.get(`/ai/profile/${userId}`);
};

// Get problem recommendations
export const getRecommendations = async (userId) => {
  return api.get(`/ai/recommendations/${userId}`);
};

// Get weekly learning report
export const getWeeklyReport = async (userId) => {
  return api.get(`/ai/report/weekly/${userId}`);
};
```

### Common API (`services/common/api.js`)

```javascript
// Axios instance with auth interceptor
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

// Auto-attach auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 🎯 MIM V3.0 Frontend Integration

### Phase 2.x: Confidence-Aware UX

The frontend now receives calibrated confidence levels from MIM and must adjust UI accordingly.

#### Confidence Level Rules

| Level | Color | Badge Text | Language Style |
|-------|-------|------------|----------------|
| HIGH (≥0.80) | Green (#22C55E) | "High confidence diagnosis" | Direct, assertive |
| MEDIUM (≥0.65) | Yellow (#F59E0B) | "Likely issue" | Cautious |
| LOW (<0.65) | Grey (#78716C) | "Exploratory feedback" | Hedging ("may", "possibly") |

```jsx
// Example: Adjust tone based on confidence
const prefix = feedback.isLowConfidence ? "This may be" : "This is";
const message = `${prefix} an off-by-one error`;
```

### Phase 2.x: Pattern Semantics

Pattern states have specific UI treatments:

| State | Show UI? | Message | Show Count? |
|-------|----------|---------|-------------|
| `none` | ❌ No | - | No |
| `suspected` | ✅ Yes | "This may be a recurring pattern" | No |
| `confirmed` | ✅ Yes | "This is a confirmed recurring issue" | Yes |
| `stable` | ✅ Yes | "You've encountered this pattern before and improved" | Optional |

**CRITICAL**: Never use word "recurring" unless state === "confirmed" or "stable"

### Phase 2.x: Difficulty Explanation Rules

| Rule | Description |
|------|-------------|
| ❌ Never | Say "you should try harder problems" |
| ✅ Always | Only explain system decisions |
| ✅ Always | Use predefined messages from `DIFFICULTY_MESSAGES` |

Example messages:
- `maintain + pattern_unresolved` → "Difficulty maintained to reinforce correctness"
- `increase + consistent_success` → "Difficulty increased due to consistent success"
- `decrease + struggling` → "Difficulty adjusted to strengthen fundamentals"

### New UI Components (Phase 2.x)

| Component | Purpose | Location |
|-----------|---------|----------|
| `DiagnosisConfidenceBadge` | Shows confidence level | `components/feedback/ConfidenceBadge.jsx` |
| `PatternInsightPanel` | Shows pattern state | `components/feedback/PatternInsightPanel.jsx` |
| `DifficultyStatusPanel` | Shows difficulty decision | `components/feedback/DifficultyStatusPanel.jsx` |
| `MemoryIndicator` | Shows RAG usage | `components/feedback/MemoryIndicator.jsx` |

### Polymorphic Feedback Handling

```javascript
// MIMInsightsV3.jsx - Handles all feedback types
function MIMInsightsV3({ insights }) {
  const { feedbackType } = insights;
  
  switch (feedbackType) {
    case 'correctness':
    case 'implementation':
    case 'understanding_gap':
      return <CorrectnessFeedbackPanel data={insights.correctnessFeedback} />;
      
    case 'efficiency':
      return <PerformanceFeedbackPanel data={insights.performanceFeedback} />;
      
    case 'reinforcement':
      return <ReinforcementFeedbackPanel data={insights.reinforcementFeedback} />;
      
    default:
      return <LegacyMIMPanel data={insights} />;
  }
}
```

### Root Cause Display

```javascript
// Properly extract root cause from object or string
const rootCauseRaw = mimInsights.root_cause || mimInsights.rootCause;
const rootCause = typeof rootCauseRaw === "object" && rootCauseRaw !== null
  ? (rootCauseRaw.failure_cause || rootCauseRaw.failureCause)
  : rootCauseRaw;

// Format for display
const displayRootCause = rootCause
  .replace(/_/g, " ")
  .replace(/\b\w/g, (c) => c.toUpperCase());
// "correctness" → "Correctness"
// "off_by_one" → "Off By One"
```

---

## 🎨 Styling

### TailwindCSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Arrakis theme colors
        bg: '#0A0A08',
        bgCard: '#0F0F0D',
        border: '#1A1814',
        borderLight: '#2A2A24',
        textPrimary: '#E8E4D9',
        textSecondary: '#A29A8C',
        textMuted: '#78716C',
        accent: '#D97706',      // Orange
        accentHover: '#F59E0B',
        success: '#22C55E',     // Green
        error: '#EF4444',       // Red
        warning: '#F59E0B',     // Yellow
        info: '#3B82F6',        // Blue
      },
      fontFamily: {
        display: ['Rajdhani', 'Orbitron', 'system-ui', 'sans-serif'],
      }
    }
  }
};
```

### Animation with Framer Motion

```jsx
// Common animation patterns
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>

// Loading spinner
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
  className="w-12 h-12 border-2 rounded-full"
  style={{ borderTopColor: COLORS.accent }}
/>
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# E2E tests (if configured)
npm run test:e2e
```

---

## 📦 Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

Build output is in `dist/` directory, ready for static hosting (Vercel, Netlify, etc.).
