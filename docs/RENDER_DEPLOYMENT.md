# Render Deployment Guide - Arrakis Labs Platform

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              RENDER CLOUD                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│   │   Frontend      │    │    Backend      │    │   AI Service    │    │
│   │  Static Site    │───▶│  Web Service    │───▶│  Web Service    │    │
│   │  (React/Vite)   │    │  (Node.js)      │    │  (Python/FastAPI│    │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘    │
│          │                       │                      │               │
│          │                       ▼                      │               │
│          │               ┌─────────────────┐            │               │
│          │               │   MongoDB       │◀───────────┘               │
│          │               │   (Atlas)       │                            │
│          │               └─────────────────┘                            │
│          │                       │                                      │
│          │               ┌─────────────────┐                            │
│          └──────────────▶│   Redis         │                            │
│                          │   (Optional)    │                            │
│                          └─────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Deploy with render.yaml

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New** → **Blueprint**
4. Connect your GitHub repo
5. Render auto-detects `render.yaml` and creates all 3 services
6. Set secret environment variables in dashboard

---

## Manual Deployment (Step-by-Step)

### Service 1: AI Service (Python/FastAPI)

| Setting | Value |
|---------|-------|
| **Name** | `arrakis-ai-service` |
| **Type** | Web Service |
| **Runtime** | Python 3 |
| **Root Directory** | `ai-services` |
| **Build Command** | `pip install -r requirement.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port 10000` |
| **Health Check Path** | `/health` |

**Environment Variables:**
```bash
PORT=10000
PYTHONUNBUFFERED=1
ENVIRONMENT=production
MONGODB_URI=<your-mongodb-uri>
OPENAI_API_KEY=<your-openai-key>
GROQ_API_KEY=<your-groq-key>
FRONTEND_URL=https://arrakis-frontend.onrender.com
BACKEND_URL=https://arrakis-backend.onrender.com
```

---

### Service 2: Backend (Node.js/Express)

| Setting | Value |
|---------|-------|
| **Name** | `arrakis-backend` |
| **Type** | Web Service |
| **Runtime** | Node |
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

**Environment Variables:**
```bash
PORT=10000
NODE_ENV=production
MONGODB_URI=<your-mongodb-uri>
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRY=7d
AI_SERVICE_URL=https://arrakis-ai-service.onrender.com
FRONTEND_URL=https://arrakis-frontend.onrender.com
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

---

### Service 3: Frontend (React/Vite Static Site)

| Setting | Value |
|---------|-------|
| **Name** | `arrakis-frontend` |
| **Type** | Static Site |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

**Environment Variables (Build Time):**
```bash
VITE_API_URL=https://arrakis-backend.onrender.com/api
VITE_AI_SERVICE_URL=https://arrakis-ai-service.onrender.com
VITE_WS_URL=wss://arrakis-backend.onrender.com/ws/contest
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

**Rewrite Rule (for SPA routing):**
```
Source: /*
Destination: /index.html
Action: Rewrite
```

---

## Free Tier Considerations

### Cold Start Problem

Render free tier services spin down after 15 minutes of inactivity.

**Impact:**
- First request after sleep: 30-60 seconds delay
- AI Service (Python): Slowest to start (~45-90 seconds)
- Backend (Node.js): Medium (~15-30 seconds)

**Mitigations:**

1. **Use Health Check Pings** (external cron service):
```bash
# Use cron-job.org or UptimeRobot to ping every 14 minutes:
https://arrakis-ai-service.onrender.com/health
https://arrakis-backend.onrender.com/api/health
```

2. **Upgrade to Starter Plan** ($7/month per service):
   - No cold starts
   - Always-on instances
   - Better for production

3. **Frontend Loading State:**
```javascript
// Show loading indicator while backend wakes up
const [isLoading, setIsLoading] = useState(true);
const [backendReady, setBackendReady] = useState(false);

useEffect(() => {
  const checkHealth = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/health`);
      setBackendReady(true);
    } catch {
      // Retry after 5 seconds
      setTimeout(checkHealth, 5000);
    }
    setIsLoading(false);
  };
  checkHealth();
}, []);
```

---

## Model Loading at Startup

The AI service loads ML models at startup (not per-request):

```python
# ai-services/main.py - Already configured

# EAGER INITIALIZATION: Load embeddings model at startup
print("🧠 Pre-loading embedding model (one-time initialization)...")
try:
    from app.rag.embeddings import get_embeddings
    embeddings = get_embeddings()
    _ = embeddings.embed_query("initialization test")
    print("✅ Embedding model loaded and ready")
except Exception as e:
    print(f"⚠️  Embedding model pre-load failed: {e}")
```

For custom ML models (joblib/pickle):

```python
# Example: Add to ai-services/app/mim/model_loader.py
import joblib
from functools import lru_cache

@lru_cache(maxsize=1)
def load_mim_model():
    """Load model once at startup, cache forever"""
    return joblib.load("./data/mim/model.joblib")

# In main.py, add before routes:
print("🧠 Pre-loading MIM model...")
model = load_mim_model()
print("✅ MIM model loaded")
```

---

## CORS Configuration

### AI Service (Python)
Already configured in `main.py`:
```python
def get_allowed_origins():
    origins = ["http://localhost:5173", "http://localhost:5174"]
    
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        if not frontend_url.startswith("http"):
            origins.append(f"https://{frontend_url}")
        else:
            origins.append(frontend_url)
    
    return list(set(origins))
```

### Backend (Node.js)
Already configured in `app.js`:
```javascript
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);
```

---

## Frontend API Calls

### Calling Backend API

```javascript
// src/services/common/api.js
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const api = {
  async get(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }
};

// Usage:
const questions = await api.get('/questions');
const result = await api.post('/submit', { code, language, questionId });
```

### Calling AI Service (for MIM predictions)

```javascript
// src/services/ai/aiApi.js
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

export const aiApi = {
  async predict(data) {
    const response = await fetch(`${AI_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async getFeedback(submissionId) {
    const response = await fetch(`${AI_SERVICE_URL}/ai/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: submissionId })
    });
    return response.json();
  }
};
```

---

## Deployment Checklist

### Before Deploy

- [ ] All secrets removed from code
- [ ] `.env` files in `.gitignore`
- [ ] MongoDB Atlas IP whitelist: `0.0.0.0/0` (allow all for Render)
- [ ] Google OAuth redirect URIs updated for production domains
- [ ] Frontend environment variables use `VITE_` prefix

### After Deploy

- [ ] Health check endpoints responding
- [ ] CORS working (no blocked requests in browser console)
- [ ] Authentication flow working
- [ ] AI feedback endpoint responding
- [ ] WebSocket connections for contests

### Test Commands

```bash
# Test AI Service
curl https://arrakis-ai-service.onrender.com/health

# Test Backend
curl https://arrakis-backend.onrender.com/api/health

# Test prediction endpoint
curl -X POST https://arrakis-ai-service.onrender.com/predict \
  -H "Content-Type: application/json" \
  -d '{"code": "print(1)", "language": "python"}'
```

---

## Troubleshooting

### "CORS blocked" errors
- Verify `FRONTEND_URL` env var is set correctly (include `https://`)
- Check browser Network tab for actual origin being blocked
- Ensure no trailing slash in URLs

### Cold start timeout
- First request may timeout - client should retry
- Consider upgrading from free tier for production

### "Module not found" in AI Service
- Check `requirement.txt` spelling (`requirement.txt` not `requirements.txt`)
- Ensure all dependencies are listed

### Build fails on Render
- Check build logs in Render dashboard
- Verify root directory is correct
- Test build locally first: `npm run build` or `pip install -r requirement.txt`

### MongoDB connection fails
- Whitelist `0.0.0.0/0` in MongoDB Atlas Network Access
- Verify connection string format
- Check if password has special characters (URL encode them)

---

## Local Development

```bash
# Terminal 1: AI Service
cd ai-services
pip install -r requirement.txt
uvicorn main:app --reload --port 8000

# Terminal 2: Backend
cd backend
npm install
npm run dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

Access at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001
- AI Service: http://localhost:8000
- AI Docs: http://localhost:8000/docs
