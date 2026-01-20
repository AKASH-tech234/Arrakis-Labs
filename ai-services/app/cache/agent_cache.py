import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("agent_cache")

CACHE_DIR = Path("agent_cache")
CACHE_DIR.mkdir(exist_ok=True)
logger.info(f"📁 Cache directory: {CACHE_DIR.absolute()}")


def get_cached(key: str) -> Any | None:
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        logger.debug(f"⚡ Cache HIT for key: {key[:16]}...")
        try:
            return json.loads(path.read_text())
        except Exception as e:
            logger.error(f"❌ Cache read error: {e}")
            return None
    logger.debug(f"🚫 Cache MISS for key: {key[:16]}...")
    return None


def set_cached(key: str, value: Any) -> None:
    path = CACHE_DIR / f"{key}.json"
    try:
        path.write_text(json.dumps(value, indent=2))
        logger.debug(f"💾 Cache WRITE for key: {key[:16]}...")
    except Exception as e:
        logger.error(f"❌ Cache write error: {e}")
