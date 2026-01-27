"""
Idempotency Module - Request Deduplication
==========================================

Prevents duplicate request processing for the same submission.

Problem: Frontend may trigger /ai/feedback multiple times:
- On page render
- On button click  
- On retry after timeout

Solution: Short-lived in-memory dedupe with response caching.

Design:
- Key: submission_id (or hash of user_id + problem_id + verdict)
- TTL: 30 seconds (covers duplicate clicks)
- Returns cached response for duplicates
"""

import time
import hashlib
import logging
from typing import Dict, Any, Optional
from threading import Lock
from dataclasses import dataclass, field
from collections import OrderedDict

logger = logging.getLogger("guardrails.idempotency")


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# How long to keep a request in the dedupe cache (seconds)
DEDUPE_TTL_SECONDS = 30.0

# Maximum entries in dedupe cache (LRU eviction)
MAX_DEDUPE_ENTRIES = 1000


# ═══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DedupeEntry:
    """Single entry in the dedupe cache."""
    request_key: str
    created_at: float
    completed: bool = False
    response: Optional[Dict[str, Any]] = None
    expires_at: float = field(default=0.0)
    
    def __post_init__(self):
        self.expires_at = self.created_at + DEDUPE_TTL_SECONDS
    
    def is_expired(self) -> bool:
        return time.time() > self.expires_at
    
    def is_in_flight(self) -> bool:
        return not self.completed and not self.is_expired()


# ═══════════════════════════════════════════════════════════════════════════════
# DEDUPLICATOR CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class RequestDeduplicator:
    """
    Request deduplication with response caching.
    
    Thread-safe singleton that prevents duplicate processing.
    """
    
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._cache: OrderedDict[str, DedupeEntry] = OrderedDict()
        self._cache_lock = Lock()
        self._initialized = True
        
        logger.info(f"RequestDeduplicator initialized | TTL={DEDUPE_TTL_SECONDS}s | max_entries={MAX_DEDUPE_ENTRIES}")
    
    def _generate_key(
        self,
        user_id: str,
        problem_id: str,
        verdict: str,
        code_hash: Optional[str] = None,
    ) -> str:
        """
        Generate unique request key.
        
        Key is based on user + problem + verdict + code hash.
        This ensures same submission = same key.
        """
        key_parts = [user_id, problem_id, verdict.lower()]
        
        if code_hash:
            key_parts.append(code_hash[:8])
        
        combined = ":".join(key_parts)
        return hashlib.md5(combined.encode()).hexdigest()[:16]
    
    def _cleanup_expired(self):
        """Remove expired entries (called periodically)."""
        now = time.time()
        expired_keys = [
            key for key, entry in self._cache.items()
            if entry.is_expired()
        ]
        
        for key in expired_keys:
            del self._cache[key]
        
        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired dedupe entries")
    
    def _evict_if_full(self):
        """LRU eviction if cache is full."""
        while len(self._cache) >= MAX_DEDUPE_ENTRIES:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            logger.debug(f"LRU evicted dedupe entry: {oldest_key}")
    
    def check_duplicate(
        self,
        user_id: str,
        problem_id: str,
        verdict: str,
        code: str = "",
    ) -> tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check if this is a duplicate request.
        
        Returns:
            (is_duplicate, cached_response)
            - If in-flight: (True, None) - caller should wait or return early
            - If completed: (True, response) - return cached response
            - If new: (False, None) - proceed with processing
        """
        code_hash = hashlib.md5(code.encode()).hexdigest() if code else None
        key = self._generate_key(user_id, problem_id, verdict, code_hash)
        
        with self._cache_lock:
            # Cleanup periodically
            if len(self._cache) > 100:
                self._cleanup_expired()
            
            # Check if exists
            if key in self._cache:
                entry = self._cache[key]
                
                # Move to end for LRU
                self._cache.move_to_end(key)
                
                if entry.is_expired():
                    # Expired - remove and treat as new
                    del self._cache[key]
                    logger.debug(f"Dedupe entry expired: {key}")
                
                elif entry.completed and entry.response:
                    # Completed with response - return cached
                    logger.info(f"🔄 DUPLICATE REQUEST (cached) | key={key}")
                    return (True, entry.response)
                
                elif entry.is_in_flight():
                    # Still processing - indicate duplicate
                    logger.warning(f"⚠️ DUPLICATE REQUEST (in-flight) | key={key}")
                    return (True, None)
            
            # New request - register it
            self._evict_if_full()
            self._cache[key] = DedupeEntry(
                request_key=key,
                created_at=time.time(),
            )
            
            logger.debug(f"New request registered: {key}")
            return (False, None)
    
    def mark_complete(
        self,
        user_id: str,
        problem_id: str,
        verdict: str,
        code: str = "",
        response: Optional[Dict[str, Any]] = None,
    ):
        """
        Mark a request as complete with optional response caching.
        
        Called after successful processing to enable response caching.
        """
        code_hash = hashlib.md5(code.encode()).hexdigest() if code else None
        key = self._generate_key(user_id, problem_id, verdict, code_hash)
        
        with self._cache_lock:
            if key in self._cache:
                entry = self._cache[key]
                entry.completed = True
                entry.response = response
                logger.debug(f"Request marked complete: {key} | cached={response is not None}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._cache_lock:
            total = len(self._cache)
            in_flight = sum(1 for e in self._cache.values() if e.is_in_flight())
            completed = sum(1 for e in self._cache.values() if e.completed)
            expired = sum(1 for e in self._cache.values() if e.is_expired())
            
            return {
                "total_entries": total,
                "in_flight": in_flight,
                "completed": completed,
                "expired": expired,
                "ttl_seconds": DEDUPE_TTL_SECONDS,
                "max_entries": MAX_DEDUPE_ENTRIES,
            }


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON ACCESSOR
# ═══════════════════════════════════════════════════════════════════════════════

_deduplicator: Optional[RequestDeduplicator] = None


def get_deduplicator() -> RequestDeduplicator:
    """Get the singleton deduplicator instance."""
    global _deduplicator
    if _deduplicator is None:
        _deduplicator = RequestDeduplicator()
    return _deduplicator


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def is_duplicate_request(
    user_id: str,
    problem_id: str,
    verdict: str,
    code: str = "",
) -> tuple[bool, Optional[Dict[str, Any]]]:
    """
    Check if this is a duplicate request.
    
    Convenience wrapper around RequestDeduplicator.check_duplicate().
    """
    return get_deduplicator().check_duplicate(user_id, problem_id, verdict, code)


def mark_request_complete(
    user_id: str,
    problem_id: str,
    verdict: str,
    code: str = "",
    response: Optional[Dict[str, Any]] = None,
):
    """
    Mark request as complete with optional response caching.
    
    Convenience wrapper around RequestDeduplicator.mark_complete().
    """
    get_deduplicator().mark_complete(user_id, problem_id, verdict, code, response)


def get_cached_response(
    user_id: str,
    problem_id: str,
    verdict: str,
    code: str = "",
) -> Optional[Dict[str, Any]]:
    """Get cached response for a previous request."""
    is_dup, response = is_duplicate_request(user_id, problem_id, verdict, code)
    return response if is_dup else None
