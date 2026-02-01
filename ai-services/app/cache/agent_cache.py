"""
File-based Agent Cache (DEPRECATED)
====================================

This module provided file-based caching for agent responses.
It has been replaced by Redis caching for better performance and scalability.

See: app/cache/redis_cache.py for the active caching implementation.

DEPRECATED: Do not use this module for new development.
"""

import logging
from typing import Any

logger = logging.getLogger("agent_cache")


def get_cached(key: str) -> Any | None:
    """
    DEPRECATED: Use redis_cache.get() instead.
    
    Returns None to indicate cache miss (forcing fresh computation).
    """
    logger.warning(f"DEPRECATED: get_cached() called. Use redis_cache.get() instead.")
    return None


def set_cached(key: str, value: Any) -> None:
    """
    DEPRECATED: Use redis_cache.set() instead.
    
    Does not actually cache - Redis should be used instead.
    """
    logger.warning(f"DEPRECATED: set_cached() called. Use redis_cache.set() instead.")
    pass
