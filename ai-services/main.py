from fastapi import FastAPI
import logging

# -------------------------
# LOGGING SETUP
# -------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("main")

logger.info("="*60)
logger.info("🚀 STARTING MENTAT TRIALS AI SERVICE")
logger.info("="*60)

from app.api.routes import router

logger.info("✅ Routes module imported successfully")

app = FastAPI(title="Mentat Trials AI Service")
logger.info("✅ FastAPI app created")

# Register API routes (includes /ai/feedback and /health)
app.include_router(router)
logger.info("✅ Router registered")
logger.info("🟢 AI Service ready to accept requests")
