# Frontend Documentation

> **React + Vite SPA** - Modern, responsive user interface for the competitive programming platform.

---

## Overview

The frontend is a single-page application built with React 19 and Vite, featuring:

- Monaco Editor for code writing
- Real-time contest leaderboards via WebSocket
- AI feedback visualization with progressive hint disclosure
- MIM (Mistake Inference Model) insights dashboard
- Admin panel for platform management

**Port**: 5173  
**Build Tool**: Vite  
**Styling**: Tailwind CSS + Framer Motion

---

## Directory Structure

```
frontend/
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Main router & providers
│   ├── App.css                   # Global styles
│   ├── index.css                 # Tailwind imports
│   │
│   ├── pages/                    # Route components
│   │   ├── landing.jsx           # Homepage
│   │   ├── login.jsx             # User login
│   │   ├── signup.jsx            # User registration
│   │   ├── problem.jsx           # Problem listing
│   │   ├── problemdetail.jsx     # Problem solving view
│   │   ├── profile.jsx           # User profile
│   │   ├── submission.jsx        # Submission results
│   │   │
│   │   ├── admin/                # Admin pages
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProblemEditor.jsx
│   │   │   ├── ProblemList.jsx
│   │   │   ├── ContestManagement.jsx
│   │   │   ├── TestCaseManager.jsx
│   │   │   ├── UserManagement.jsx
│   │   │   ├── CSVImporter.jsx
│   │   │   └── AdminPOTDScheduler.jsx
│   │   │
│   │   └── contest/              # Contest pages
│   │       ├── ContestList.jsx
│   │       ├── ContestDetail.jsx
│   │       └── ContestProblem.jsx
│   │
│   ├── components/               # Reusable UI components
│   │   ├── auth/                 # Authentication components
│   │   │   ├── LoginForm.jsx
│   │   │   └── SignupForm.jsx
│   │   │
│   │   ├── admin/                # Admin components
│   │   │   ├── AdminNavbar.jsx
│   │   │   ├── AdminSidebar.jsx
│   │   │   ├── common/
│   │   │   └── layout/
│   │   │
│   │   ├── editor/               # Code editor
│   │   │   ├── CodeEditor.jsx
│   │   │   └── OutputPanel.jsx
│   │   │
│   │   ├── feedback/             # AI feedback display
│   │   │   ├── AIFeedbackPanel.jsx
│   │   │   ├── AIFeedbackPanelV2.jsx
│   │   │   ├── AIFeedbackModal.jsx
│   │   │   ├── AIFeedbackIntegration.jsx
│   │   │   ├── AILoadingScreen.jsx
│   │   │   ├── ConfidenceBadge.jsx
│   │   │   ├── LearningTimeline.jsx
│   │   │   └── WeeklyReportUI.jsx
│   │   │
│   │   ├── mim/                  # MIM insights components
│   │   │   ├── MIMInsights.jsx
│   │   │   ├── CognitiveProfile.jsx
│   │   │   ├── LearningRoadmap.jsx
│   │   │   ├── ProblemRecommendations.jsx
│   │   │   └── SkillRadarChart.jsx
│   │   │
│   │   ├── problem/              # Problem display
│   │   │   ├── ProblemCard.jsx
│   │   │   ├── ProblemList.jsx
│   │   │   ├── ProblemDescription.jsx
│   │   │   └── ProblemFilters.jsx
│   │   │
│   │   ├── charts/               # Analytics visualizations
│   │   │   ├── ActivityHeatmap.jsx
│   │   │   ├── CategoryChart.jsx
│   │   │   ├── ProfileHeader.jsx
│   │   │   ├── StatsOverview.jsx
│   │   │   └── SubmissionSummary.jsx
│   │   │
│   │   ├── landing/              # Landing page sections
│   │   │   ├── HERO3D.jsx
│   │   │   ├── features.jsx
│   │   │   ├── howitworks.jsx
│   │   │   ├── cta.jsx
│   │   │   └── footer.jsx
│   │   │
│   │   └── ui/                   # Shared UI components
│   │       ├── animated-shader-hero.jsx
│   │       ├── ArrakisLogo.jsx
│   │       ├── button.jsx
│   │       └── ScrollEffect.jsx
│   │
│   ├── context/                  # React Context providers
│   │   ├── AuthContext.jsx
│   │   ├── AdminAuthContext.jsx
│   │   └── SubmissionContext.jsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAIFeedback.js
│   │   ├── useAIFeedbackEnhanced.js
│   │   ├── useConfidenceBadge.js
│   │   ├── useContestTimer.js
│   │   ├── useContestWebSocket.js
│   │   ├── useLearningTimeline.js
│   │   ├── useProfileAnalytics.js
│   │   ├── useResizable.js
│   │   └── useWeeklyReport.js
│   │
│   ├── services/                 # API clients
│   │   ├── api.js
│   │   ├── aiApi.js
│   │   ├── adminApi.js
│   │   ├── contestApi.js
│   │   └── potdApi.js
│   │
│   ├── routes/                   # Route definitions
│   │   └── adminRoutes.jsx
│   │
│   ├── layouts/                  # Page layouts
│   │   └── MainLayout.jsx
│   │
│   ├── utils/                    # Helper utilities
│   │   └── formatExampleInput.js
│   │
│   ├── lib/                      # Third-party integrations
│   ├── styles/                   # Additional stylesheets
│   ├── types/                    # TypeScript types (if used)
│   └── assets/                   # Static assets
│
├── public/                       # Public assets
├── index.html                    # HTML template
├── vite.config.js                # Vite configuration
├── tailwind.config.js            # Tailwind configuration
├── eslint.config.js              # ESLint configuration
└── package.json
```

---

## Core Files

### main.jsx - Entry Point

**Purpose**: Bootstraps React application with StrictMode.

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

### App.jsx - Router & Providers

**Purpose**: Sets up routing, authentication context, and protected routes.

**Structure**:

```jsx
<BrowserRouter>
  <AuthProvider>
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/problems" element={<Problems />} />
      <Route path="/problems/:id" element={<ProblemDetail />} />

      {/* Protected User Routes */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route path="/contests" element={<ContestList />} />
      <Route path="/contests/:id" element={<ContestDetail />} />

      {/* Admin Routes */}
      <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

---

## Pages

### landing.jsx

**Purpose**: Homepage with hero section, features, and call-to-action.

**Sections**:

- Hero with 3D animation
- Features showcase
- How it works explanation
- Call-to-action for signup
- Footer

---

### problemdetail.jsx

**Purpose**: Main problem-solving interface with code editor and AI feedback.

**Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│  Problem Title                              Language ▼      │
├───────────────────────────────┬─────────────────────────────┤
│                               │                             │
│   Problem Description         │     Monaco Code Editor      │
│   - Description               │                             │
│   - Examples                  │                             │
│   - Constraints               │                             │
│                               ├─────────────────────────────┤
│                               │     Output Panel            │
│                               │     - Test Results          │
│                               │     - AI Feedback           │
│                               │                             │
└───────────────────────────────┴─────────────────────────────┘
                    [Run Code]  [Submit]
```

**Features**:

- Resizable panels
- Syntax highlighting
- Auto-complete
- Test case display
- AI feedback integration

---

### contest/ContestProblem.jsx

**Purpose**: Problem solving within a timed contest.

**Additional Features**:

- Contest timer
- Live leaderboard sidebar
- Submission count
- Penalty tracking

---

### profile.jsx

**Purpose**: User profile dashboard with statistics and history.

**Sections**:

- Profile header with avatar
- Stats overview (problems solved, streak, etc.)
- Activity heatmap
- Category performance chart
- Recent submissions
- MIM insights (if available)

---

### admin/Dashboard.jsx

**Purpose**: Admin overview with platform statistics.

**Widgets**:

- Total users count
- Total problems count
- Active contests
- Recent submissions
- Quick actions

---

## Components

### editor/CodeEditor.jsx

**Purpose**: Monaco Editor wrapper for code editing.

**Features**:

```javascript
{
  language: 'python' | 'javascript' | 'java' | 'cpp' | ...,
  theme: 'vs-dark',
  minimap: { enabled: false },
  fontSize: 14,
  automaticLayout: true,
  tabSize: 4,
  wordWrap: 'on'
}
```

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `code` | string | Current code content |
| `onChange` | function | Called when code changes |
| `language` | string | Programming language |
| `readOnly` | boolean | Disable editing |

---

### editor/OutputPanel.jsx

**Purpose**: Displays code execution results.

**Display States**:

- **Idle**: "Run code to see output"
- **Running**: Loading spinner
- **Success**: Test case results (✅/❌ per case)
- **Error**: Compilation/runtime error message
- **AI Feedback**: Progressive hint display

---

### feedback/AIFeedbackPanel.jsx

**Purpose**: Displays AI-generated feedback with progressive disclosure.

**Structure**:

```
┌─────────────────────────────────────────┐
│  🧠 AI Feedback                         │
├─────────────────────────────────────────┤
│  Explanation                            │
│  "Your solution fails because..."       │
├─────────────────────────────────────────┤
│  💡 Hints                               │
│  [Hint 1] Conceptual hint               │
│  [Hint 2] More specific (locked 🔒)     │
│  [Hint 3] Detailed hint (locked 🔒)     │
├─────────────────────────────────────────┤
│  📈 Confidence: 85%                     │
│  🎯 Detected Pattern: Off-by-one error  │
└─────────────────────────────────────────┘
```

**Progressive Hint Logic**:

- Hint 1: Always visible (conceptual)
- Hint 2: Unlocked after 2nd attempt
- Hint 3: Unlocked after 3rd attempt

---

### feedback/ConfidenceBadge.jsx

**Purpose**: Visual indicator of AI confidence level.

**Levels**:
| Score | Color | Label |
|-------|-------|-------|
| 80-100% | Green | High Confidence |
| 60-79% | Yellow | Medium Confidence |
| 0-59% | Red | Low Confidence |

---

### feedback/LearningTimeline.jsx

**Purpose**: Shows user's learning progress over time.

**Visualization**: Timeline with milestones for:

- Problems solved
- Skills unlocked
- Patterns identified
- Streak achievements

---

### mim/MIMInsights.jsx

**Purpose**: Dashboard for ML-based predictions and recommendations.

**Sections**:

```
┌───────────────────────────────────────────────────────────┐
│  🧬 Cognitive Profile                                     │
│  [Skill Radar Chart]                                      │
├───────────────────────────────────────────────────────────┤
│  📚 Recommended Problems                                  │
│  - Problem A (targets: arrays, edge cases)                │
│  - Problem B (targets: recursion)                         │
├───────────────────────────────────────────────────────────┤
│  🛤️ Learning Roadmap                                      │
│  Step 1: Master basic arrays                              │
│  Step 2: Learn two-pointers → ...                         │
└───────────────────────────────────────────────────────────┘
```

---

### mim/SkillRadarChart.jsx

**Purpose**: Radar chart visualization of user's skill areas.

**Dimensions**:

- Arrays & Strings
- Dynamic Programming
- Graphs & Trees
- Math & Number Theory
- Greedy Algorithms
- Recursion & Backtracking

---

### mim/ProblemRecommendations.jsx

**Purpose**: AI-recommended problems based on skill gaps.

**Display**:

```jsx
{
  recommendations.map((rec) => (
    <RecommendationCard
      problem={rec.problem}
      reason={rec.reason} // "Targets your weakness in edge cases"
      difficulty={rec.difficulty}
      estimatedTime={rec.time}
    />
  ));
}
```

---

### charts/ActivityHeatmap.jsx

**Purpose**: GitHub-style contribution heatmap showing solving activity.

**Data**: Submissions per day for the past year  
**Colors**: Intensity based on submission count

---

### charts/CategoryChart.jsx

**Purpose**: Bar/pie chart showing performance by problem category.

**Metrics**:

- Problems attempted per category
- Acceptance rate per category
- Time spent per category

---

## Context Providers

### AuthContext.jsx

**Purpose**: Manages user authentication state globally.

**State**:

```javascript
{
  user: {
    id: string,
    username: string,
    email: string,
    role: 'user' | 'admin'
  } | null,
  isLoading: boolean,
  isAuthenticated: boolean
}
```

**Actions**:
| Function | Description |
|----------|-------------|
| `login(credentials)` | Authenticates user, stores token |
| `logout()` | Clears auth state and cookie |
| `updateUser(data)` | Updates local user data |
| `checkAuth()` | Validates existing session |

---

### AdminAuthContext.jsx

**Purpose**: Separate auth context for admin users.

**Why Separate?**:

- Different token storage
- Different permission levels
- Allows simultaneous user + admin sessions in development

---

### SubmissionContext.jsx

**Purpose**: Manages submission state across components.

**State**:

```javascript
{
  currentSubmission: {
    code: string,
    language: string,
    status: 'idle' | 'running' | 'submitted',
    result: Object | null
  },
  history: Array
}
```

---

## Custom Hooks

### useAIFeedback.js

**Purpose**: Manages AI feedback fetching and progressive hint disclosure.

```javascript
const {
  feedback, // AI feedback object
  isLoading, // Loading state
  error, // Error message
  hintsUnlocked, // Number of hints revealed
  unlockNextHint, // Function to reveal next hint
  fetchFeedback, // Trigger feedback fetch
} = useAIFeedback(submissionId);
```

**Progressive Disclosure**:

```javascript
// Hint unlocking logic
const canUnlockHint = (hintIndex) => {
  return attempts >= hintIndex + 1;
};
```

---

### useContestWebSocket.js

**Purpose**: Manages WebSocket connection for live contest updates.

```javascript
const {
  leaderboard, // Current leaderboard array
  isConnected, // WebSocket connection status
  error, // Connection error
  myRank, // Current user's rank
} = useContestWebSocket(contestId);
```

**Events Handled**:

- `leaderboard_update` - Updates local leaderboard state
- `contest_started` - Enables submission
- `contest_ended` - Shows final results
- `reconnect` - Auto-reconnects on disconnect

---

### useContestTimer.js

**Purpose**: Countdown timer for active contests.

```javascript
const {
  timeRemaining, // { hours, minutes, seconds }
  isExpired, // Contest ended
  formattedTime, // "01:23:45"
} = useContestTimer(endTime);
```

---

### useProfileAnalytics.js

**Purpose**: Fetches and processes user analytics data.

```javascript
const {
  stats, // { solved, attempted, acceptanceRate }
  categoryData, // Performance by category
  activityData, // Daily submission counts
  streak, // Current solving streak
  isLoading,
} = useProfileAnalytics(userId);
```

---

### useResizable.js

**Purpose**: Enables resizable panels in the problem solving view.

```javascript
const {
  leftWidth, // Left panel width (%)
  rightWidth, // Right panel width (%)
  handleDrag, // Mouse drag handler
  resetLayout, // Reset to default
} = useResizable(defaultLeftWidth);
```

---

## Services

### api.js

**Purpose**: Base Axios instance with authentication headers.

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true, // Sends cookies
  timeout: 30000,
});

// Request interceptor for auth
api.interceptors.request.use((config) => {
  // Token handled via HTTP-only cookie
  return config;
});

// Response interceptor for errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error);
  },
);
```

---

### aiApi.js

**Purpose**: AI service API endpoints.

```javascript
export const aiApi = {
  // Get AI feedback for submission
  getFeedback: (submissionId) => api.get(`/ai/feedback/${submissionId}`),

  // Get MIM profile
  getProfile: (userId) => api.get(`/ai/mim/profile/${userId}`),

  // Get problem recommendations
  getRecommendations: (userId) => api.get(`/ai/mim/recommend/${userId}`),

  // Get weekly report
  getWeeklyReport: (userId) => api.get(`/ai/weekly-report/${userId}`),
};
```

---

### contestApi.js

**Purpose**: Contest-related API endpoints.

```javascript
export const contestApi = {
  // List all contests
  getContests: () => api.get("/contests"),

  // Get contest details
  getContest: (id) => api.get(`/contests/${id}`),

  // Register for contest
  register: (id) => api.post(`/contests/${id}/register`),

  // Get leaderboard
  getLeaderboard: (id) => api.get(`/contests/${id}/leaderboard`),

  // Submit code
  submit: (contestId, problemId, data) =>
    api.post(`/contests/${contestId}/problems/${problemId}/submit`, data),
};
```

---

## Routing

### Public Routes

| Path            | Component       | Description       |
| --------------- | --------------- | ----------------- |
| `/`             | `Landing`       | Homepage          |
| `/login`        | `Login`         | User login        |
| `/signup`       | `Signup`        | User registration |
| `/problems`     | `Problems`      | Problem listing   |
| `/problems/:id` | `ProblemDetail` | Problem solving   |

### Protected Routes (require auth)

| Path                          | Component        | Description     |
| ----------------------------- | ---------------- | --------------- |
| `/profile`                    | `Profile`        | User dashboard  |
| `/contests/:id/problems/:pid` | `ContestProblem` | Contest problem |

### Admin Routes

| Path                  | Component            | Description        |
| --------------------- | -------------------- | ------------------ |
| `/admin/login`        | `AdminLogin`         | Admin login        |
| `/admin/dashboard`    | `Dashboard`          | Admin overview     |
| `/admin/problems`     | `ProblemList`        | Problem management |
| `/admin/problems/new` | `ProblemEditor`      | Create problem     |
| `/admin/contests`     | `ContestManagement`  | Contest management |
| `/admin/potd`         | `AdminPOTDScheduler` | POTD scheduling    |

---

## State Management

### Local State

- Component-level `useState` for UI state
- Form inputs, toggles, modals

### Context State

- Auth state (user, isAuthenticated)
- Submission state (current code, results)

### Server State

- API data fetched on mount
- Refreshed on user actions

### WebSocket State

- Real-time leaderboard updates
- Contest status changes

---

## Styling

### Tailwind CSS

**Configuration** (`tailwind.config.js`):

```javascript
{
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {...},
        secondary: {...}
      },
      animation: {
        'fade-in': '...',
        'slide-up': '...'
      }
    }
  },
  plugins: []
}
```

### Framer Motion

**Usage**:

```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>
```

---

## Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000

# AI Services
VITE_AI_SERVICE_URL=http://localhost:8000

# Feature Flags
VITE_ENABLE_MIM=true
VITE_ENABLE_POTD=true
```

---

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## Performance Optimizations

- **Code Splitting**: Lazy loading for admin routes
- **Memoization**: `useMemo` / `useCallback` for expensive operations
- **Virtualization**: Long lists use virtual scrolling
- **Image Optimization**: WebP format, lazy loading
- **Bundle Analysis**: Vite build analyzer
