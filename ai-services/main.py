from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
import uuid
from contextvars import ContextVar

# -------------------------
# CONTEXT VARIABLES FOR TRACING
# -------------------------
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")

# -------------------------
# LOGGING SETUP - JSON STRUCTURED
# -------------------------
class StructuredLogger:
    """Structured JSON logger for production observability"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _log(self, level: str, event: str, **kwargs):
        trace_id = trace_id_var.get()
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "trace_id": trace_id,
            "service": "ai-services",
            "level": level,
            "event": event,
            **kwargs
        }
        if level == "INFO":
            self.logger.info(str(log_entry))
        elif level == "ERROR":
            self.logger.error(str(log_entry))
        elif level == "DEBUG":
            self.logger.debug(str(log_entry))
        elif level == "WARNING":
            self.logger.warning(str(log_entry))
    
    def info(self, event: str, **kwargs):
        self._log("INFO", event, **kwargs)
    
    def error(self, event: str, **kwargs):
        self._log("ERROR", event, **kwargs)
    
    def debug(self, event: str, **kwargs):
        self._log("DEBUG", event, **kwargs)
    
    def warning(self, event: str, **kwargs):
        self._log("WARNING", event, **kwargs)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s",
    datefmt="%H:%M:%S"
)

logger = StructuredLogger("main")

print("\n" + "="*80)
print("🚀 MENTAT TRIALS AI SERVICE")
print("="*80)
print(f"📅 Starting at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print("="*80 + "\n")

logger.info("service_startup", message="STARTING MENTAT TRIALS AI SERVICE")

from app.api.routes import router

logger.info("module_loaded", module="routes")

# Initialize MongoDB connection
print("🔌 Initializing connections...")
from app.db.mongodb import mongo_client
try:
    mongo_connected = mongo_client.connect()
    if mongo_connected:
        print("✅ MongoDB connection established\n")
    else:
        print("⚠️  MongoDB not available - running without database features\n")
except Exception as e:
    print(f"⚠️  MongoDB connection failed: {e}\n")

# -------------------------
# FASTAPI APP
# -------------------------
app = FastAPI(
    title="Mentat Trials AI Service",
    description="AI-powered feedback service for coding platform",
    version="1.0.0"
)

# -------------------------
# CORS MIDDLEWARE - CRITICAL FIX
# -------------------------
# Allow all origins in development, restrict in production
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    # Add production domains here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Trace-ID"],
    max_age=600,  # Cache preflight for 10 minutes
)

logger.info("middleware_added", middleware="CORS", origins=ALLOWED_ORIGINS)

# -------------------------
# REQUEST TRACING MIDDLEWARE
# -------------------------
@app.middleware("http")
async def tracing_middleware(request: Request, call_next):
    # Generate or extract trace ID
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4())[:8])
    trace_id_var.set(trace_id)
    
    start_time = time.time()
    
    logger.info("request_received", 
        method=request.method,
        path=str(request.url.path),
        trace_id=trace_id
    )
    
    try:
        response = await call_next(request)
        elapsed = time.time() - start_time
        
        logger.info("request_completed",
            method=request.method,
            path=str(request.url.path),
            status_code=response.status_code,
            duration_ms=round(elapsed * 1000, 2),
            trace_id=trace_id
        )
        
        # Add trace ID to response headers
        response.headers["X-Trace-ID"] = trace_id
        return response
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error("request_failed",
            method=request.method,
            path=str(request.url.path),
            error=str(e),
            error_type=type(e).__name__,
            duration_ms=round(elapsed * 1000, 2),
            trace_id=trace_id
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "trace_id": trace_id}
        )

# -------------------------
# REGISTER ROUTES
# -------------------------
app.include_router(router)

print("✅ Routes registered: /health, /ai/feedback, /ai/weekly-report")
print("\n" + "="*80)
print("✨ AI SERVICE READY")
print("="*80)
print(f"🌐 Listening on: http://localhost:8000")
print(f"📝 API Docs: http://localhost:8000/docs")
print(f"📋 Health: http://localhost:8000/health")
print("="*80 + "\n")

logger.info("router_registered", routes=["/health", "/ai/feedback", "/ai/weekly-report"])
logger.info("service_ready", message="AI Service ready to accept requests")
