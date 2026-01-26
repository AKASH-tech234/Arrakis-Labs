"""
Guardrails Module - Orchestration Protection Layer
===================================================

Implements critical guardrails for the AI feedback system:

1. Idempotency/Dedupe: Prevent duplicate request processing
2. Verdict Guards: Skip MIM for Accepted submissions  
3. Reinforcement Signals: Success-only learning for Accepted
4. Async Dedupe: Prevent duplicate async agent runs

CRITICAL DESIGN PRINCIPLES:
- Accepted submissions get REINFORCEMENT, not DIAGNOSIS
- MIM only runs for failures (Wrong Answer, TLE, Runtime Error)
- No root cause, pattern detection, or hint for Accepted
- Memory storage always happens (positive and negative signals)
"""

from .idempotency import (
    RequestDeduplicator,
    get_deduplicator,
    is_duplicate_request,
    mark_request_complete,
    get_cached_response,
)

from .verdict_guards import (
    VerdictGuard,
    should_skip_mim,
    should_skip_rag,
    should_skip_hint,
    get_success_path,
    create_reinforcement_signal,
)

__all__ = [
    # Idempotency
    "RequestDeduplicator",
    "get_deduplicator",
    "is_duplicate_request", 
    "mark_request_complete",
    "get_cached_response",
    
    # Verdict Guards
    "VerdictGuard",
    "should_skip_mim",
    "should_skip_rag",
    "should_skip_hint",
    "get_success_path",
    "create_reinforcement_signal",
]
