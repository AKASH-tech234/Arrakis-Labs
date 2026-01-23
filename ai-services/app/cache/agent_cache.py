"""
File-based Agent Cache (DEPRECATED)
====================================

This module provided file-based caching for agent responses.
It has been replaced by Redis caching for better performance and scalability.

See: app/cache/redis_cache.py for the active caching implementation.

DEPRECATED: Do not use this module for new development.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("agent_cache")

# ========================================================================
# DEPRECATED: File-based caching has been replaced by Redis caching
# ========================================================================

# CACHE_DIR = Path("agent_cache")
# CACHE_DIR.mkdir(exist_ok=True)
# logger.info(f"📁 Cache directory: {CACHE_DIR.absolute()}")


def get_cached(key: str) -> Any | None:
    """
    DEPRECATED: Use redis_cache.get() instead.
    
    This function is kept for backward compatibility but logs a warning.
    Returns None to indicate cache miss (forcing fresh computation).
    """
    logger.warning(
        f"⚠️ DEPRECATED: get_cached() called. Use redis_cache.get() instead. "
        f"Key: {key[:16]}..."
    )
    # Return None to force cache miss - Redis should be used instead
    return None


def set_cached(key: str, value: Any) -> None:
    """
    DEPRECATED: Use redis_cache.set() instead.
    
    This function is kept for backward compatibility but logs a warning.
    Does not actually cache - Redis should be used instead.
    """
    logger.warning(
        f"⚠️ DEPRECATED: set_cached() called. Use redis_cache.set() instead. "
        f"Key: {key[:16]}..."
    )
    # Do not cache - Redis should be used instead
    pass


# ========================================================================
# Original file-based caching code (commented out for reference)
# ========================================================================

# def get_cached(key: str) -> Any | None:
#     path = CACHE_DIR / f"{key}.json"
#     if path.exists():
#         logger.debug(f"⚡ Cache HIT for key: {key[:16]}...")
#         try:
#             return json.loads(path.read_text())
#         except Exception as e:
#             logger.error(f"❌ Cache read error: {e}")
#             return None
#     logger.debug(f"🚫 Cache MISS for key: {key[:16]}...")
#     return None


# def set_cached(key: str, value: Any) -> None:
#     path = CACHE_DIR / f"{key}.json"
#     try:
#         path.write_text(json.dumps(value, indent=2))
#         logger.debug(f"💾 Cache WRITE for key: {key[:16]}...")
#     except Exception as e:
#         logger.error(f"❌ Cache write error: {e}")
