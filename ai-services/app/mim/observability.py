"""
MIM V3.0 Runtime Observability
==============================

PHASE 5: Online Safety & Metrics

This module provides:
1. Runtime assertions for invariants
2. Metrics collection for monitoring
3. Alerting hooks for violations

MANDATORY METRICS:
- % accepted triggering mistake logic (MUST be 0)
- % invalid taxonomy attempts (MUST be 0)
- Subtype distribution per root_cause
- Cold-start vs non-cold-start accuracy

MANDATORY ALERTS:
- Any verdict gate violation
- Any schema validation failure
"""

import logging
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
import json

from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    is_valid_pair,
    SubtypeValidationError,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# METRICS STORE
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class MIMMetricsStore:
    """
    Thread-safe metrics store for MIM observability.
    
    CRITICAL INVARIANTS (violations trigger alerts):
    - accepted_mistake_logic_count MUST be 0
    - invalid_taxonomy_count MUST be 0
    """
    
    # Counters
    total_inferences: int = 0
    accepted_submissions: int = 0
    failed_submissions: int = 0
    
    # CRITICAL - these MUST be 0
    accepted_mistake_logic_count: int = 0  # Accepted triggering mistake logic
    invalid_taxonomy_count: int = 0        # Invalid (root_cause, subtype) pairs
    verdict_gate_violations: int = 0       # Verdict gate failures
    schema_validation_failures: int = 0    # Schema validation errors
    
    # Per-root-cause subtype distributions
    subtype_distribution: Dict[str, Dict[str, int]] = field(
        default_factory=lambda: defaultdict(lambda: defaultdict(int))
    )
    
    # Cold-start metrics
    cold_start_inferences: int = 0
    non_cold_start_inferences: int = 0
    cold_start_correct: int = 0
    non_cold_start_correct: int = 0
    
    # Latency tracking
    inference_latencies_ms: List[float] = field(default_factory=list)
    
    # Timestamp
    last_reset: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    # Thread safety
    _lock: Lock = field(default_factory=Lock)
    
    def record_inference(
        self,
        *,
        verdict: str,
        root_cause: Optional[str] = None,
        subtype: Optional[str] = None,
        is_cold_start: bool = False,
        was_correct: Optional[bool] = None,
        latency_ms: float = 0.0,
    ) -> None:
        """Record a MIM inference event."""
        with self._lock:
            self.total_inferences += 1
            
            # Track verdict type
            is_accepted = verdict.lower() in ("accepted", "ac")
            if is_accepted:
                self.accepted_submissions += 1
            else:
                self.failed_submissions += 1
            
            # CRITICAL CHECK: Accepted triggering mistake logic
            if is_accepted and (root_cause or subtype):
                self.accepted_mistake_logic_count += 1
                logger.error(
                    f"ALERT: Accepted submission triggered mistake logic! "
                    f"root_cause={root_cause}, subtype={subtype}"
                )
            
            # Track subtype distribution (for failed only)
            if not is_accepted and root_cause and subtype:
                self.subtype_distribution[root_cause][subtype] += 1
            
            # Track cold-start metrics
            if not is_accepted:
                if is_cold_start:
                    self.cold_start_inferences += 1
                    if was_correct:
                        self.cold_start_correct += 1
                else:
                    self.non_cold_start_inferences += 1
                    if was_correct:
                        self.non_cold_start_correct += 1
            
            # Track latency
            if latency_ms > 0:
                self.inference_latencies_ms.append(latency_ms)
                # Keep only last 1000
                if len(self.inference_latencies_ms) > 1000:
                    self.inference_latencies_ms = self.inference_latencies_ms[-1000:]
    
    def record_taxonomy_violation(
        self,
        root_cause: str,
        subtype: str,
    ) -> None:
        """Record an invalid taxonomy attempt."""
        with self._lock:
            self.invalid_taxonomy_count += 1
            logger.error(
                f"ALERT: Invalid taxonomy! ({root_cause}, {subtype}) is not a valid pair."
            )
    
    def record_verdict_gate_violation(
        self,
        verdict: str,
        feedback_type: str,
    ) -> None:
        """Record a verdict gate violation."""
        with self._lock:
            self.verdict_gate_violations += 1
            logger.error(
                f"ALERT: Verdict gate violation! verdict={verdict}, feedback_type={feedback_type}"
            )
    
    def record_schema_failure(
        self,
        schema_name: str,
        error: str,
    ) -> None:
        """Record a schema validation failure."""
        with self._lock:
            self.schema_validation_failures += 1
            logger.error(
                f"ALERT: Schema validation failure! schema={schema_name}, error={error}"
            )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics snapshot."""
        with self._lock:
            # Compute derived metrics
            accepted_mistake_pct = (
                (self.accepted_mistake_logic_count / self.accepted_submissions * 100)
                if self.accepted_submissions > 0 else 0.0
            )
            invalid_taxonomy_pct = (
                (self.invalid_taxonomy_count / self.failed_submissions * 100)
                if self.failed_submissions > 0 else 0.0
            )
            cold_start_accuracy = (
                (self.cold_start_correct / self.cold_start_inferences)
                if self.cold_start_inferences > 0 else None
            )
            non_cold_start_accuracy = (
                (self.non_cold_start_correct / self.non_cold_start_inferences)
                if self.non_cold_start_inferences > 0 else None
            )
            
            latency_p50 = (
                sorted(self.inference_latencies_ms)[len(self.inference_latencies_ms) // 2]
                if self.inference_latencies_ms else None
            )
            latency_p99 = (
                sorted(self.inference_latencies_ms)[int(len(self.inference_latencies_ms) * 0.99)]
                if len(self.inference_latencies_ms) >= 100 else None
            )
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "last_reset": self.last_reset,
                
                # Totals
                "total_inferences": self.total_inferences,
                "accepted_submissions": self.accepted_submissions,
                "failed_submissions": self.failed_submissions,
                
                # CRITICAL (MUST be 0)
                "accepted_mistake_logic_count": self.accepted_mistake_logic_count,
                "accepted_mistake_logic_pct": accepted_mistake_pct,
                "invalid_taxonomy_count": self.invalid_taxonomy_count,
                "invalid_taxonomy_pct": invalid_taxonomy_pct,
                "verdict_gate_violations": self.verdict_gate_violations,
                "schema_validation_failures": self.schema_validation_failures,
                
                # Subtype distribution
                "subtype_distribution": dict(self.subtype_distribution),
                
                # Cold-start metrics
                "cold_start_inferences": self.cold_start_inferences,
                "non_cold_start_inferences": self.non_cold_start_inferences,
                "cold_start_accuracy": cold_start_accuracy,
                "non_cold_start_accuracy": non_cold_start_accuracy,
                
                # Latency
                "latency_p50_ms": latency_p50,
                "latency_p99_ms": latency_p99,
            }
    
    def check_invariants(self) -> List[str]:
        """
        Check critical invariants and return list of violations.
        
        Returns empty list if all invariants hold.
        """
        violations = []
        
        with self._lock:
            if self.accepted_mistake_logic_count > 0:
                violations.append(
                    f"CRITICAL: {self.accepted_mistake_logic_count} accepted submissions "
                    f"triggered mistake logic (MUST be 0)"
                )
            
            if self.invalid_taxonomy_count > 0:
                violations.append(
                    f"CRITICAL: {self.invalid_taxonomy_count} invalid taxonomy attempts "
                    f"(MUST be 0)"
                )
            
            if self.verdict_gate_violations > 0:
                violations.append(
                    f"CRITICAL: {self.verdict_gate_violations} verdict gate violations"
                )
            
            if self.schema_validation_failures > 0:
                violations.append(
                    f"WARNING: {self.schema_validation_failures} schema validation failures"
                )
        
        return violations
    
    def reset(self) -> None:
        """Reset all metrics."""
        with self._lock:
            self.total_inferences = 0
            self.accepted_submissions = 0
            self.failed_submissions = 0
            self.accepted_mistake_logic_count = 0
            self.invalid_taxonomy_count = 0
            self.verdict_gate_violations = 0
            self.schema_validation_failures = 0
            self.subtype_distribution = defaultdict(lambda: defaultdict(int))
            self.cold_start_inferences = 0
            self.non_cold_start_inferences = 0
            self.cold_start_correct = 0
            self.non_cold_start_correct = 0
            self.inference_latencies_ms = []
            self.last_reset = datetime.utcnow().isoformat()


# Global metrics store
_metrics_store = MIMMetricsStore()


def get_metrics_store() -> MIMMetricsStore:
    """Get the global metrics store."""
    return _metrics_store


# ═══════════════════════════════════════════════════════════════════════════════
# RUNTIME ASSERTIONS
# ═══════════════════════════════════════════════════════════════════════════════

class MIMAssertionError(Exception):
    """Raised when a MIM invariant is violated."""
    pass


def assert_verdict_feedback_match(
    verdict: str,
    feedback_type: str,
    output: Dict[str, Any],
) -> None:
    """
    Assert that verdict and feedback type match.
    
    RULES:
    - Accepted → reinforcement ONLY
    - Failed → correctness OR performance ONLY
    
    Raises MIMAssertionError on violation.
    """
    is_accepted = verdict.lower() in ("accepted", "ac")
    
    if is_accepted:
        if feedback_type != "reinforcement":
            _metrics_store.record_verdict_gate_violation(verdict, feedback_type)
            raise MIMAssertionError(
                f"Accepted submission must produce 'reinforcement' feedback, "
                f"got '{feedback_type}'"
            )
        
        # Also check no mistake fields
        if any(k in output for k in ["root_cause", "subtype", "failure_mechanism"]):
            _metrics_store.record_verdict_gate_violation(verdict, feedback_type)
            raise MIMAssertionError(
                f"Accepted submission feedback contains mistake fields"
            )
    else:
        if feedback_type == "reinforcement":
            _metrics_store.record_verdict_gate_violation(verdict, feedback_type)
            raise MIMAssertionError(
                f"Failed submission must not produce 'reinforcement' feedback"
            )
        
        if feedback_type not in ("correctness", "performance"):
            _metrics_store.record_verdict_gate_violation(verdict, feedback_type)
            raise MIMAssertionError(
                f"Failed submission must produce 'correctness' or 'performance' feedback, "
                f"got '{feedback_type}'"
            )


def assert_valid_taxonomy(root_cause: str, subtype: str) -> None:
    """
    Assert that (root_cause, subtype) pair is valid.
    
    Raises MIMAssertionError on violation.
    """
    if not is_valid_pair(root_cause, subtype):
        _metrics_store.record_taxonomy_violation(root_cause, subtype)
        raise MIMAssertionError(
            f"Invalid taxonomy: subtype '{subtype}' not valid for "
            f"root_cause '{root_cause}'"
        )


def assert_no_accepted_mistake_logic(
    verdict: str,
    root_cause: Optional[str],
    subtype: Optional[str],
) -> None:
    """
    Assert that accepted submissions don't trigger mistake logic.
    
    Raises MIMAssertionError on violation.
    """
    is_accepted = verdict.lower() in ("accepted", "ac")
    
    if is_accepted and (root_cause is not None or subtype is not None):
        _metrics_store.record_inference(
            verdict=verdict,
            root_cause=root_cause,
            subtype=subtype,
        )
        raise MIMAssertionError(
            f"Accepted submission triggered mistake logic: "
            f"root_cause={root_cause}, subtype={subtype}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# INFERENCE WRAPPER WITH OBSERVABILITY
# ═══════════════════════════════════════════════════════════════════════════════

def observe_inference(
    inference_fn: Callable,
) -> Callable:
    """
    Decorator to add observability to inference function.
    
    Records:
    - Latency
    - Verdict/feedback type
    - Taxonomy validity
    - Invariant violations
    """
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = inference_fn(*args, **kwargs)
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Extract fields for metrics
            verdict = kwargs.get("verdict") or (args[0].verdict if args else "unknown")
            feedback_type = result.get("feedback_type", "unknown")
            root_cause = result.get("root_cause")
            subtype = result.get("subtype")
            is_cold_start = result.get("is_cold_start", False)
            
            # Record metrics
            _metrics_store.record_inference(
                verdict=verdict,
                root_cause=root_cause,
                subtype=subtype,
                is_cold_start=is_cold_start,
                latency_ms=latency_ms,
            )
            
            return result
            
        except Exception as e:
            # Record failure
            _metrics_store.record_schema_failure(
                schema_name="inference",
                error=str(e),
            )
            raise
    
    return wrapper


# ═══════════════════════════════════════════════════════════════════════════════
# ALERT HOOKS
# ═══════════════════════════════════════════════════════════════════════════════

# List of alert handlers
_alert_handlers: List[Callable[[str, Dict], None]] = []


def register_alert_handler(handler: Callable[[str, Dict], None]) -> None:
    """
    Register an alert handler.
    
    Handler receives (alert_type: str, details: Dict).
    """
    _alert_handlers.append(handler)


def trigger_alert(alert_type: str, details: Dict[str, Any]) -> None:
    """
    Trigger an alert to all registered handlers.
    """
    logger.error(f"ALERT [{alert_type}]: {json.dumps(details)}")
    
    for handler in _alert_handlers:
        try:
            handler(alert_type, details)
        except Exception as e:
            logger.error(f"Alert handler failed: {e}")


# Default console alert handler
def _console_alert_handler(alert_type: str, details: Dict[str, Any]) -> None:
    """Default alert handler that logs to console."""
    print(f"\n{'='*60}")
    print(f"🚨 MIM ALERT: {alert_type}")
    print(f"{'='*60}")
    for key, value in details.items():
        print(f"  {key}: {value}")
    print(f"{'='*60}\n")


# Register default handler
register_alert_handler(_console_alert_handler)


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

def health_check() -> Dict[str, Any]:
    """
    Perform MIM health check.
    
    Returns health status and any violations.
    """
    violations = _metrics_store.check_invariants()
    metrics = _metrics_store.get_metrics()
    
    return {
        "healthy": len(violations) == 0,
        "violations": violations,
        "metrics": metrics,
        "timestamp": datetime.utcnow().isoformat(),
    }


def print_health_report() -> None:
    """Print formatted health report."""
    health = health_check()
    
    print("\n" + "="*60)
    print("MIM V3.0 HEALTH REPORT")
    print("="*60)
    
    if health["healthy"]:
        print("✅ STATUS: HEALTHY")
    else:
        print("❌ STATUS: UNHEALTHY")
        print("\nVIOLATIONS:")
        for v in health["violations"]:
            print(f"  - {v}")
    
    print("\nMETRICS:")
    metrics = health["metrics"]
    print(f"  Total Inferences: {metrics['total_inferences']}")
    print(f"  Accepted: {metrics['accepted_submissions']}")
    print(f"  Failed: {metrics['failed_submissions']}")
    print(f"\n  CRITICAL INVARIANTS:")
    print(f"    Accepted → Mistake Logic: {metrics['accepted_mistake_logic_count']} (MUST be 0)")
    print(f"    Invalid Taxonomy: {metrics['invalid_taxonomy_count']} (MUST be 0)")
    print(f"    Verdict Gate Violations: {metrics['verdict_gate_violations']}")
    print(f"    Schema Failures: {metrics['schema_validation_failures']}")
    
    if metrics.get("subtype_distribution"):
        print(f"\n  SUBTYPE DISTRIBUTION:")
        for rc, subtypes in metrics["subtype_distribution"].items():
            print(f"    {rc}:")
            for st, count in subtypes.items():
                print(f"      - {st}: {count}")
    
    print(f"\n  COLD-START METRICS:")
    print(f"    Cold-start Inferences: {metrics['cold_start_inferences']}")
    print(f"    Non-cold-start Inferences: {metrics['non_cold_start_inferences']}")
    if metrics.get("cold_start_accuracy") is not None:
        print(f"    Cold-start Accuracy: {metrics['cold_start_accuracy']:.2%}")
    if metrics.get("non_cold_start_accuracy") is not None:
        print(f"    Non-cold-start Accuracy: {metrics['non_cold_start_accuracy']:.2%}")
    
    print(f"\n  LATENCY:")
    if metrics.get("latency_p50_ms"):
        print(f"    P50: {metrics['latency_p50_ms']:.2f}ms")
    if metrics.get("latency_p99_ms"):
        print(f"    P99: {metrics['latency_p99_ms']:.2f}ms")
    
    print("="*60 + "\n")
