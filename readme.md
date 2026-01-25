# Mentat Trials (Arrakis Labs)

> **AI-Powered Competitive Programming & Learning Platform**  
> Build coding mastery through intelligent feedback, real-time contests, and adaptive learning paths.

<div align="center">

![Version](https://img.shields.io/badge/version-2.0-blue)
![Node](https://img.shields.io/badge/node-18+-green)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![React](https://img.shields.io/badge/react-19-61dafb)

</div>

---

## 🎯 What is Mentat Trials?

**Mentat Trials** is a full-stack competitive programming platform that combines traditional coding challenges with AI-driven personalized feedback. Unlike traditional platforms that only tell you pass/fail, we tell you **why** and **how to improve**.

### The Problem We Solve

| Traditional Platforms       | Mentat Trials                            |
| --------------------------- | ---------------------------------------- |
| Binary feedback (pass/fail) | Contextual AI feedback explaining _why_  |
| Generic hints               | Progressive hints tailored to your level |
| No memory of past mistakes  | RAG-based memory learns your patterns    |
| Fixed difficulty            | Adaptive difficulty based on performance |
| No learning path            | Personalized roadmaps & recommendations  |

---

## ✨ Key Features

### 🧠 AI-Powered Feedback System

- **Progressive Hints**: Conceptual → Specific → Detailed (reveals more as you struggle)
- **Pattern Detection**: Identifies recurring mistakes across submissions
- **Memory System**: RAG-based retrieval remembers your past errors
- **Confidence Scoring**: AI indicates how confident it is in each suggestion

### 🎮 MIM (Mistake Inference Model)

- **ML Predictions**: Predicts success probability before you submit
- **Cognitive Profiling**: Builds a profile of your coding strengths/weaknesses
- **Smart Recommendations**: Suggests problems based on your skill gaps
- **Learning Roadmaps**: Personalized paths to improve weak areas

### 🏆 Real-Time Contests

- **Live Leaderboards**: WebSocket-driven updates in real-time
- **Auto Scheduling**: Contests auto-start and auto-end
- **Penalty Scoring**: Time-based penalties for wrong attempts
- **Multi-Problem Format**: Complete problem sets in timed sessions

### 📅 Problem of the Day (POTD)

- **Daily Challenges**: Fresh problems scheduled by admins
- **Streak Tracking**: Maintain your solving streak
- **Calendar View**: See upcoming and past problems

### ⚡ Code Execution

- **Multi-Language**: Python, JavaScript, Java, C++, Go, Rust, TypeScript, C
- **Sandboxed**: Secure execution via Piston API
- **Detailed Results**: Test-by-test breakdown with visible/hidden cases

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MENTAT TRIALS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────────────┐ │
│  │    FRONTEND     │────▶│     BACKEND     │────▶│     AI SERVICES       │ │
│  │  React + Vite   │     │ Express + MongoDB│    │  FastAPI + LangGraph  │ │
│  │   Port: 5173    │◀────│    Port: 5000   │◀────│     Port: 8000        │ │
│  └─────────────────┘     └────────┬────────┘     └───────────┬───────────┘ │
│          │                        │                          │             │
│          │                        ▼                          ▼             │
│  ┌───────▼───────┐       ┌───────────────┐         ┌─────────────────────┐ │
│  │   Monaco      │       │   Piston API  │         │   LangGraph Flow    │ │
│  │   Editor      │       │  (Execution)  │         │  ┌───────────────┐  │ │
│  │   + AI UI     │       └───────────────┘         │  │ Feedback Agent│  │ │
│  └───────────────┘                                 │  │ Hint Agent    │  │ │
│                                                    │  │ Pattern Agent │  │ │
│                                                    │  │ Learning Agent│  │ │
│                                                    │  └───────┬───────┘  │ │
│                                                    │          ▼          │ │
│                                                    │  ┌───────────────┐  │ │
│                                                    │  │ MIM (ML)      │  │ │
│                                                    │  │ + ChromaDB    │  │ │
│                                                    │  └───────────────┘  │ │
│                                                    └─────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Core Workflows

### Submission Flow (with AI Feedback)

```
User Submits Code
       │
       ▼
┌──────────────────┐
│  Backend Judge   │──────────┐
│  (Piston API)    │          │
└────────┬─────────┘          │
         │                    │
    ┌────▼────┐          ┌────▼────┐
    │ PASSED  │          │ FAILED  │
    └────┬────┘          └────┬────┘
         │                    │
         │              ┌─────▼─────────┐
         │              │ AI Services   │
         │              │               │
         │              │ 1. Retrieve   │
         │              │    Memory     │
         │              │ 2. Analyze    │
         │              │    Code       │
         │              │ 3. Generate   │
         │              │    Feedback   │
         │              │ 4. Store      │
         │              │    Pattern    │
         │              └───────┬───────┘
         │                      │
         ▼                      ▼
┌───────────────────────────────────────┐
│        Return to Frontend             │
│  - Verdict + Test Results             │
│  - AI Feedback (if failed)            │
│  - Progressive Hints                  │
│  - Learning Recommendations           │
└───────────────────────────────────────┘
```

### Contest Flow

```
Admin Creates Contest
         │
         ▼
┌─────────────────┐
│    SCHEDULED    │◀──── Users Register
└────────┬────────┘
         │ (Auto-transition at startTime)
         ▼
┌─────────────────┐
│      LIVE       │──── Users Solve Problems
│                 │──── Submissions Judged
│                 │──── WebSocket Updates
└────────┬────────┘
         │ (Auto-transition at endTime)
         ▼
┌─────────────────┐
│     ENDED       │──── Final Rankings
└─────────────────┘
```

---

## 📁 Project Structure

```
arrakis-labs/
├── backend/                 # Node.js Express API (Port 5000)
│   └── src/
│       ├── controllers/     # 16 controllers (auth, judge, contest, admin...)
│       ├── models/          # 18 Mongoose models
│       ├── routes/          # 12 route files
│       ├── middleware/      # Auth, admin, audit logging
│       ├── services/        # AI client, WebSocket, scheduler
│       └── utils/           # Helpers
│
├── frontend/                # React + Vite SPA (Port 5173)
│   └── src/
│       ├── pages/           # 15+ pages (problems, contests, admin...)
│       ├── components/      # UI components organized by feature
│       │   ├── feedback/    # AI feedback display
│       │   ├── mim/         # ML insights UI
│       │   ├── editor/      # Code editor
│       │   └── charts/      # Analytics visualizations
│       ├── hooks/           # 10+ custom hooks
│       ├── context/         # Auth & submission state
│       └── services/        # API clients
│
├── ai-services/             # Python FastAPI (Port 8000)
│   └── app/
│       ├── agents/          # 8 LangGraph agents
│       ├── graph/           # Workflow orchestration
│       ├── mim/             # ML models & inference
│       ├── rag/             # Vector store & retrieval
│       ├── schemas/         # Pydantic models
│       └── api/             # FastAPI routes
│
├── docs/                    # Documentation
│   ├── BACKEND.md           # Backend deep-dive
│   ├── FRONTEND.md          # Frontend deep-dive
│   └── AI_SERVICES.md       # AI services deep-dive
│
└── vector_db/               # ChromaDB persistent storage
```

> 📚 **Deep Documentation**: See [docs/BACKEND.md](docs/BACKEND.md), [docs/FRONTEND.md](docs/FRONTEND.md), [docs/AI_SERVICES.md](docs/AI_SERVICES.md) for detailed component breakdowns.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **MongoDB** (Atlas or local)
- **Redis** (optional, for leaderboards)

### 1. Clone & Install

```bash
git clone https://github.com/AKASH-tech234/Arrakis-Labs.git
cd Arrakis-Labs
```

### 2. Backend Setup

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT_SECRET, etc.

npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. AI Services Setup

```bash
cd ai-services
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

pip install -r requirement.txt

# Configure environment
echo "GOOGLE_API_KEY=your_key_here" > .env

uvicorn app.main:app --reload --port 8000
```

### 5. Verify

- Frontend: http://localhost:5173
- Backend: http://localhost:5000/api/health
- AI Services: http://localhost:8000/health

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint           | Description       |
| ------ | ------------------ | ----------------- |
| POST   | `/api/auth/signup` | Register new user |
| POST   | `/api/auth/signin` | Login             |
| GET    | `/api/auth/me`     | Get current user  |

### Problems & Submissions

| Method | Endpoint         | Description              |
| ------ | ---------------- | ------------------------ |
| GET    | `/api/questions` | List problems            |
| POST   | `/api/run`       | Run code (visible tests) |
| POST   | `/api/submit`    | Submit code (all tests)  |

### Contests

| Method | Endpoint                        | Description          |
| ------ | ------------------------------- | -------------------- |
| GET    | `/api/contests`                 | List contests        |
| POST   | `/api/contests/:id/register`    | Register for contest |
| GET    | `/api/contests/:id/leaderboard` | Get leaderboard      |

### AI Services

| Method | Endpoint                     | Description           |
| ------ | ---------------------------- | --------------------- |
| POST   | `/ai/feedback`               | Generate AI feedback  |
| GET    | `/ai/mim/profile/:user_id`   | Get cognitive profile |
| GET    | `/ai/mim/recommend/:user_id` | Get recommendations   |

---

## 🛡️ Security

- **JWT Authentication**: HTTP-only cookies
- **Role-Based Access**: User/Admin separation
- **Rate Limiting**: API & code execution limits
- **Input Sanitization**: MongoDB injection prevention
- **CORS Protection**: Strict origin validation
- **Sandboxed Execution**: Piston API isolation

---

## 🤝 Tech Stack

| Layer           | Technology                                   |
| --------------- | -------------------------------------------- |
| **Frontend**    | React 19, Vite, Monaco Editor, Framer Motion |
| **Backend**     | Express.js, MongoDB, Mongoose, WebSocket     |
| **AI Services** | FastAPI, LangGraph, LangChain, ChromaDB      |
| **ML Models**   | scikit-learn, LightGBM                       |
| **Execution**   | Piston API                                   |
| **Cache**       | Redis (optional)                             |

---

## 📈 Future Roadmap

- [ ] Docker Compose for easy deployment
- [ ] Kubernetes for production scaling
- [ ] Code plagiarism detection
- [ ] Team contests
- [ ] Discussion forums
- [ ] Mobile app

---

## 📄 License

This project is proprietary software developed by Arrakis Labs.

---

<div align="center">

**Built with 🧠 by Arrakis Labs**  
_Master the art of coding through memory, reasoning, and adaptive intelligence._

</div>
