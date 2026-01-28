"""
RAG Quality Gates (Phase 3.1)
=============================

Provides quality control for RAG memory operations:
1. Storage gates - Control what gets stored
2. Relevance gates - Control what gets retrieved
3. Query construction - Better queries for better retrieval
4. Decay scoring - Temporal relevance adjustment

Integration:
- Uses confidence tiers from Phase 2.1
- Uses pattern states from Phase 2.2
- No LLM involvement - all deterministic

Design Principles:
- RAG never decides, only supports explanations
- Low-quality context should not contaminate LLM prompts
- Conservative under uncertainty (skip RAG if unsure)
"""

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE & PATTERN INTEGRATION (Phase 2.1 & 2.2)
# ═══════════════════════════════════════════════════════════════════════════════

# Confidence thresholds (aligned with Phase 2.1)
HIGH_CONFIDENCE_THRESHOLD = 0.80
MEDIUM_CONFIDENCE_THRESHOLD = 0.65

# Pattern states (aligned with Phase 2.2)
ACTIONABLE_PATTERN_STATES = {"confirmed", "stable"}
STORAGE_ELIGIBLE_PATTERN_STATES = {"suspected", "confirmed", "stable"}


def get_confidence_tier(confidence: float) -> str:
    """Get confidence tier from calibrated confidence."""
    if confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return "high"
    elif confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
        return "medium"
    else:
        return "low"


# ═══════════════════════════════════════════════════════════════════════════════
# STORAGE GATE (Write-Time)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class StorageDecision:
    """Result of storage gate evaluation."""
    should_store: bool
    quality_score: float
    reason: str
    confidence_tier: str
    pattern_state: str
    metadata_to_add: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "should_store": self.should_store,
            "quality_score": self.quality_score,
            "reason": self.reason,
            "confidence_tier": self.confidence_tier,
            "pattern_state": self.pattern_state,
        }


class StorageGate:
    """
    Phase 3.1 Storage Gate - Controls what memories get stored.
    
    Rules:
    - LOW confidence → Do NOT store (unreliable diagnosis)
    - MEDIUM confidence + no pattern → Store with lower quality
    - HIGH confidence or CONFIRMED pattern → Store with higher quality
    
    This prevents garbage-in contamination of the memory store.
    """
    
    # Quality score weights
    WEIGHT_CONFIDENCE = 0.40
    WEIGHT_PATTERN = 0.30
    WEIGHT_COMPLETENESS = 0.20
    WEIGHT_RECENCY = 0.10
    
    # Storage thresholds
    MIN_QUALITY_FOR_STORAGE = 0.50
    HIGH_QUALITY_THRESHOLD = 0.75
    
    def evaluate(
        self,
        content: str,
        mim_confidence: float,
        pattern_state: str = "none",
        root_cause: Optional[str] = None,
        subtype: Optional[str] = None,
        category: Optional[str] = None,
        is_recurring: bool = False,
        recurrence_count: int = 0,
    ) -> StorageDecision:
        """
        Evaluate whether memory should be stored.
        
        Parameters
        ----------
        content : str
            Memory content to store
        mim_confidence : float
            CALIBRATED confidence from MIM (Phase 2.1)
        pattern_state : str
            Pattern state from Phase 2.2 (none/suspected/confirmed/stable)
        root_cause : str, optional
            Root cause from MIM
        subtype : str, optional
            Subtype from MIM
        category : str, optional
            Problem category
        is_recurring : bool
            Whether this is a recurring pattern
        recurrence_count : int
            Number of recurrences
            
        Returns
        -------
        StorageDecision
            Whether to store and with what quality score
        """
        confidence_tier = get_confidence_tier(mim_confidence)
        
        # ─────────────────────────────────────────────────────────────────────
        # HARD GATE: Low confidence → Do NOT store
        # ─────────────────────────────────────────────────────────────────────
        if confidence_tier == "low":
            return StorageDecision(
                should_store=False,
                quality_score=0.0,
                reason=f"LOW confidence ({mim_confidence:.2f}) - unreliable diagnosis, not storing",
                confidence_tier=confidence_tier,
                pattern_state=pattern_state,
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Compute quality score components
        # ─────────────────────────────────────────────────────────────────────
        
        # Confidence component (0-1)
        conf_score = mim_confidence
        
        # Pattern component (0-1)
        if pattern_state in ACTIONABLE_PATTERN_STATES:
            pattern_score = 1.0
        elif pattern_state == "suspected":
            pattern_score = 0.7
        elif is_recurring and recurrence_count >= 2:
            pattern_score = 0.8
        elif is_recurring:
            pattern_score = 0.6
        else:
            pattern_score = 0.4
        
        # Completeness component (0-1)
        completeness_score = self._compute_completeness(
            content, root_cause, subtype, category
        )
        
        # Recency component (always 1.0 for new memories)
        recency_score = 1.0
        
        # Weighted quality score
        quality_score = (
            self.WEIGHT_CONFIDENCE * conf_score +
            self.WEIGHT_PATTERN * pattern_score +
            self.WEIGHT_COMPLETENESS * completeness_score +
            self.WEIGHT_RECENCY * recency_score
        )
        
        # ─────────────────────────────────────────────────────────────────────
        # Storage decision
        # ─────────────────────────────────────────────────────────────────────
        should_store = quality_score >= self.MIN_QUALITY_FOR_STORAGE
        
        if not should_store:
            reason = f"Quality {quality_score:.2f} below threshold {self.MIN_QUALITY_FOR_STORAGE}"
        elif quality_score >= self.HIGH_QUALITY_THRESHOLD:
            reason = f"High quality memory ({quality_score:.2f})"
        else:
            reason = f"Acceptable quality ({quality_score:.2f})"
        
        # Metadata to attach
        metadata = {
            "quality_score": round(quality_score, 3),
            "confidence_tier": confidence_tier,
            "pattern_state": pattern_state,
            "mim_confidence": mim_confidence,
            "is_recurring": is_recurring,
            "recurrence_count": recurrence_count,
        }
        
        if root_cause:
            metadata["root_cause"] = root_cause
        if subtype:
            metadata["subtype"] = subtype
        if category:
            metadata["category"] = category
        
        return StorageDecision(
            should_store=should_store,
            quality_score=round(quality_score, 3),
            reason=reason,
            confidence_tier=confidence_tier,
            pattern_state=pattern_state,
            metadata_to_add=metadata,
        )
    
    def _compute_completeness(
        self,
        content: str,
        root_cause: Optional[str],
        subtype: Optional[str],
        category: Optional[str],
    ) -> float:
        """Compute content completeness score."""
        score = 0.0
        
        # Content length
        if len(content) >= 100:
            score += 0.4
        elif len(content) >= 50:
            score += 0.2
        
        # Has root cause
        if root_cause:
            score += 0.25
        
        # Has subtype
        if subtype:
            score += 0.2
        
        # Has category
        if category:
            score += 0.15
        
        return min(1.0, score)


# ═══════════════════════════════════════════════════════════════════════════════
# RELEVANCE GATE (Read-Time)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RelevanceDecision:
    """Result of relevance gate evaluation."""
    should_use: bool
    aggregate_relevance: float
    filtered_results: List[Tuple[Any, float]]
    reason: str
    metrics: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "should_use": self.should_use,
            "aggregate_relevance": round(self.aggregate_relevance, 3),
            "num_results": len(self.filtered_results),
            "reason": self.reason,
            "metrics": self.metrics,
        }


class RelevanceGate:
    """
    Phase 3.1 Relevance Gate - Controls what retrieved memories are used.
    
    Rules:
    - If aggregate relevance < threshold → Skip RAG entirely
    - Filter out individual results below per-item threshold
    - Apply temporal decay to relevance scores
    
    This prevents low-quality context from contaminating LLM prompts.
    """
    
    # Relevance thresholds
    MIN_AGGREGATE_RELEVANCE = 0.55  # Skip RAG if average below this
    MIN_ITEM_RELEVANCE = 0.40       # Filter out items below this
    HIGH_RELEVANCE_THRESHOLD = 0.70
    
    # Temporal decay
    DECAY_HALF_LIFE_DAYS = 30  # Relevance halves every 30 days
    
    def evaluate(
        self,
        results_with_scores: List[Tuple[Any, float]],
        query_context: Optional[Dict[str, Any]] = None,
    ) -> RelevanceDecision:
        """
        Evaluate whether retrieved results should be used.
        
        Parameters
        ----------
        results_with_scores : list
            List of (Document, relevance_score) tuples from vector search
        query_context : dict, optional
            Context about the query (root_cause, category, etc.) for bonus scoring
            
        Returns
        -------
        RelevanceDecision
            Whether to use results and filtered list
        """
        if not results_with_scores:
            return RelevanceDecision(
                should_use=False,
                aggregate_relevance=0.0,
                filtered_results=[],
                reason="No results retrieved",
                metrics={"num_raw": 0, "num_filtered": 0},
            )
        
        # ─────────────────────────────────────────────────────────────────────
        # Apply decay and context bonuses
        # ─────────────────────────────────────────────────────────────────────
        adjusted_results = []
        
        for doc, score in results_with_scores:
            adjusted_score = score
            
            # Apply temporal decay
            decay_factor = self._compute_decay(doc.metadata)
            adjusted_score *= decay_factor
            
            # Apply context bonus (if query context matches memory context)
            if query_context:
                bonus = self._compute_context_bonus(doc.metadata, query_context)
                adjusted_score = min(1.0, adjusted_score + bonus)
            
            adjusted_results.append((doc, adjusted_score))
        
        # ─────────────────────────────────────────────────────────────────────
        # Filter by per-item threshold
        # ─────────────────────────────────────────────────────────────────────
        filtered = [
            (doc, score) for doc, score in adjusted_results
            if score >= self.MIN_ITEM_RELEVANCE
        ]
        
        # ─────────────────────────────────────────────────────────────────────
        # Compute aggregate relevance
        # ─────────────────────────────────────────────────────────────────────
        if filtered:
            aggregate = sum(s for _, s in filtered) / len(filtered)
        else:
            aggregate = 0.0
        
        # ─────────────────────────────────────────────────────────────────────
        # Gate decision
        # ─────────────────────────────────────────────────────────────────────
        should_use = aggregate >= self.MIN_AGGREGATE_RELEVANCE and len(filtered) > 0
        
        metrics = {
            "num_raw": len(results_with_scores),
            "num_filtered": len(filtered),
            "num_dropped": len(results_with_scores) - len(filtered),
            "raw_avg_relevance": sum(s for _, s in results_with_scores) / len(results_with_scores),
            "filtered_avg_relevance": aggregate,
        }
        
        if not should_use:
            if not filtered:
                reason = f"All {len(results_with_scores)} results below item threshold {self.MIN_ITEM_RELEVANCE}"
            else:
                reason = f"Aggregate relevance {aggregate:.2f} below threshold {self.MIN_AGGREGATE_RELEVANCE}"
        elif aggregate >= self.HIGH_RELEVANCE_THRESHOLD:
            reason = f"High relevance ({aggregate:.2f}) - using {len(filtered)} memories"
        else:
            reason = f"Acceptable relevance ({aggregate:.2f}) - using {len(filtered)} memories"
        
        return RelevanceDecision(
            should_use=should_use,
            aggregate_relevance=round(aggregate, 3),
            filtered_results=filtered,
            reason=reason,
            metrics=metrics,
        )
    
    def _compute_decay(self, metadata: Dict[str, Any]) -> float:
        """Compute temporal decay factor."""
        stored_at = metadata.get("stored_at") or metadata.get("timestamp")
        
        if not stored_at:
            return 0.8  # Unknown age - slight penalty
        
        try:
            if isinstance(stored_at, str):
                stored_dt = datetime.fromisoformat(stored_at.replace("Z", "+00:00"))
            else:
                stored_dt = stored_at
            
            if stored_dt.tzinfo is None:
                stored_dt = stored_dt.replace(tzinfo=timezone.utc)
            
            now = datetime.now(timezone.utc)
            age_days = (now - stored_dt).total_seconds() / 86400
            
            # Exponential decay
            decay = math.pow(0.5, age_days / self.DECAY_HALF_LIFE_DAYS)
            
            return max(0.3, decay)  # Floor at 0.3
            
        except Exception:
            return 0.8
    
    def _compute_context_bonus(
        self,
        memory_metadata: Dict[str, Any],
        query_context: Dict[str, Any],
    ) -> float:
        """Compute bonus for context match."""
        bonus = 0.0
        
        # Root cause match
        if (memory_metadata.get("root_cause") and 
            memory_metadata["root_cause"] == query_context.get("root_cause")):
            bonus += 0.10
        
        # Category match
        if (memory_metadata.get("category") and
            memory_metadata["category"] == query_context.get("category")):
            bonus += 0.05
        
        # Subtype match
        if (memory_metadata.get("subtype") and
            memory_metadata["subtype"] == query_context.get("subtype")):
            bonus += 0.08
        
        # Pattern state match (both have confirmed patterns)
        if (memory_metadata.get("pattern_state") in ACTIONABLE_PATTERN_STATES and
            query_context.get("pattern_state") in ACTIONABLE_PATTERN_STATES):
            bonus += 0.05
        
        return bonus


# ═══════════════════════════════════════════════════════════════════════════════
# QUERY BUILDER (Better Queries)
# ═══════════════════════════════════════════════════════════════════════════════

class QueryBuilder:
    """
    Phase 3.1 Query Builder - Constructs better queries for RAG retrieval.
    
    Instead of generic "wrong answer" queries, builds specific queries like:
    "off_by_one_error in binary_search Array problem"
    
    This dramatically improves retrieval relevance.
    """
    
    def build_query(
        self,
        root_cause: Optional[str] = None,
        subtype: Optional[str] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        pattern_state: Optional[str] = None,
        verdict: Optional[str] = None,
        problem_tags: Optional[List[str]] = None,
    ) -> str:
        """
        Build a structured query for memory retrieval.
        
        Parameters
        ----------
        root_cause : str
            MIM root cause (e.g., "implementation", "efficiency")
        subtype : str
            MIM subtype (e.g., "off_by_one", "tle_nested_loop")
        category : str
            Problem category (e.g., "Array", "Dynamic Programming")
        difficulty : str
            Problem difficulty ("Easy", "Medium", "Hard")
        pattern_state : str
            Current pattern state
        verdict : str
            Submission verdict
        problem_tags : list
            Additional problem tags
            
        Returns
        -------
        str
            Constructed query string
        """
        parts = []
        
        # Primary: Root cause and subtype (most important)
        if subtype:
            parts.append(subtype.replace("_", " "))
        if root_cause:
            parts.append(root_cause.replace("_", " "))
        
        # Secondary: Category and tags
        if category:
            parts.append(category)
        
        if problem_tags:
            # Add top 2 tags
            for tag in problem_tags[:2]:
                if tag not in parts:
                    parts.append(tag)
        
        # Tertiary: Difficulty (for context)
        if difficulty:
            parts.append(f"{difficulty} problem")
        
        # Add pattern context if confirmed
        if pattern_state in ACTIONABLE_PATTERN_STATES:
            parts.append("recurring mistake")
        
        # Fallback
        if not parts:
            if verdict:
                parts.append(verdict.replace("_", " "))
            else:
                parts.append("programming mistake")
        
        query = " ".join(parts)
        
        logger.debug(f"Built query: '{query}' from root_cause={root_cause}, subtype={subtype}")
        
        return query
    
    def build_query_context(
        self,
        root_cause: Optional[str] = None,
        subtype: Optional[str] = None,
        category: Optional[str] = None,
        pattern_state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build context dict for relevance bonus scoring."""
        return {
            "root_cause": root_cause,
            "subtype": subtype,
            "category": category,
            "pattern_state": pattern_state,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCES
# ═══════════════════════════════════════════════════════════════════════════════

_storage_gate = StorageGate()
_relevance_gate = RelevanceGate()
_query_builder = QueryBuilder()


def get_storage_gate() -> StorageGate:
    """Get singleton storage gate."""
    return _storage_gate


def get_relevance_gate() -> RelevanceGate:
    """Get singleton relevance gate."""
    return _relevance_gate


def get_query_builder() -> QueryBuilder:
    """Get singleton query builder."""
    return _query_builder
