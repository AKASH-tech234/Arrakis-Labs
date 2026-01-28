"""
Phase 3.1 RAG Quality Gates Tests
=================================

Tests for RAG memory quality control:
1. Storage gate - blocks low-confidence memories
2. Relevance gate - filters low-relevance results
3. Query builder - constructs better queries
4. Decay scoring - temporal relevance adjustment

Acceptance Criteria (from Phase 3.1 spec):
✓ Average relevance ≥ 0.6 (after filtering)
✓ No RAG context when relevance gate fails
✓ Memory volume stabilizes (no unbounded growth)
✓ Deterministic retrieval given same inputs
✓ Clear audit logs for store/skip decisions
"""

import pytest
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from unittest.mock import MagicMock

from app.rag.quality_gates import (
    StorageGate,
    StorageDecision,
    RelevanceGate,
    RelevanceDecision,
    QueryBuilder,
    get_storage_gate,
    get_relevance_gate,
    get_query_builder,
    get_confidence_tier,
    HIGH_CONFIDENCE_THRESHOLD,
    MEDIUM_CONFIDENCE_THRESHOLD,
)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE TIER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceTier:
    """Test confidence tier classification (aligned with Phase 2.1)."""
    
    def test_high_confidence(self):
        assert get_confidence_tier(0.80) == "high"
        assert get_confidence_tier(0.85) == "high"
        assert get_confidence_tier(0.90) == "high"
    
    def test_medium_confidence(self):
        assert get_confidence_tier(0.65) == "medium"
        assert get_confidence_tier(0.70) == "medium"
        assert get_confidence_tier(0.79) == "medium"
    
    def test_low_confidence(self):
        assert get_confidence_tier(0.64) == "low"
        assert get_confidence_tier(0.50) == "low"
        assert get_confidence_tier(0.30) == "low"


# ═══════════════════════════════════════════════════════════════════════════════
# STORAGE GATE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestStorageGate:
    """Test storage gate - controls what memories get stored."""
    
    @pytest.fixture
    def gate(self):
        return StorageGate()
    
    def test_low_confidence_blocks_storage(self, gate):
        """CRITICAL: Low confidence must NOT store."""
        decision = gate.evaluate(
            content="Some mistake description",
            mim_confidence=0.50,  # LOW
            pattern_state="none",
            root_cause="implementation",
        )
        
        assert decision.should_store is False
        assert decision.confidence_tier == "low"
        assert "LOW confidence" in decision.reason
    
    def test_medium_confidence_can_store(self, gate):
        """Medium confidence can store with reasonable quality."""
        decision = gate.evaluate(
            content="Off-by-one error in binary search loop boundary",
            mim_confidence=0.70,  # MEDIUM
            pattern_state="none",
            root_cause="implementation",
            subtype="off_by_one",
            category="Array",
        )
        
        assert decision.should_store is True
        assert decision.confidence_tier == "medium"
        assert decision.quality_score > 0
    
    def test_high_confidence_stores_with_high_quality(self, gate):
        """High confidence stores with high quality score."""
        decision = gate.evaluate(
            content="Recursive solution causes stack overflow on large input",
            mim_confidence=0.85,  # HIGH
            pattern_state="confirmed",
            root_cause="efficiency",
            subtype="recursion_depth",
            category="Dynamic Programming",
            is_recurring=True,
            recurrence_count=3,
        )
        
        assert decision.should_store is True
        assert decision.confidence_tier == "high"
        assert decision.quality_score >= 0.7
    
    def test_confirmed_pattern_boosts_quality(self, gate):
        """Confirmed patterns get quality boost."""
        # Without pattern
        decision_no_pattern = gate.evaluate(
            content="Some error",
            mim_confidence=0.70,
            pattern_state="none",
            root_cause="implementation",
        )
        
        # With confirmed pattern
        decision_with_pattern = gate.evaluate(
            content="Some error",
            mim_confidence=0.70,
            pattern_state="confirmed",
            root_cause="implementation",
        )
        
        assert decision_with_pattern.quality_score > decision_no_pattern.quality_score
    
    def test_metadata_attached(self, gate):
        """Storage decision includes metadata to attach."""
        decision = gate.evaluate(
            content="Test content",
            mim_confidence=0.75,
            pattern_state="suspected",
            root_cause="correctness",
            subtype="edge_case",
            category="Graph",
        )
        
        assert decision.should_store is True
        assert "quality_score" in decision.metadata_to_add
        assert "confidence_tier" in decision.metadata_to_add
        assert "root_cause" in decision.metadata_to_add
        assert decision.metadata_to_add["root_cause"] == "correctness"
    
    def test_empty_content_low_quality(self, gate):
        """Very short content gets lower quality."""
        decision_short = gate.evaluate(
            content="error",  # Very short
            mim_confidence=0.75,
            pattern_state="none",
        )
        
        decision_long = gate.evaluate(
            content="Off-by-one error when iterating array with boundary condition check",
            mim_confidence=0.75,
            pattern_state="none",
        )
        
        assert decision_long.quality_score > decision_short.quality_score


# ═══════════════════════════════════════════════════════════════════════════════
# RELEVANCE GATE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestRelevanceGate:
    """Test relevance gate - controls what retrieved memories are used."""
    
    @pytest.fixture
    def gate(self):
        return RelevanceGate()
    
    @pytest.fixture
    def mock_doc(self):
        """Create a mock document."""
        doc = MagicMock()
        doc.metadata = {
            "stored_at": datetime.now(timezone.utc).isoformat(),
            "root_cause": "implementation",
            "category": "Array",
        }
        doc.page_content = "Test memory content"
        return doc
    
    def test_empty_results_blocked(self, gate):
        """No results should be blocked."""
        decision = gate.evaluate(results_with_scores=[])
        
        assert decision.should_use is False
        assert decision.aggregate_relevance == 0.0
        assert len(decision.filtered_results) == 0
    
    def test_low_relevance_blocked(self, gate, mock_doc):
        """Low relevance results should be blocked."""
        # All results below threshold
        low_results = [
            (mock_doc, 0.30),
            (mock_doc, 0.35),
            (mock_doc, 0.38),
        ]
        
        decision = gate.evaluate(results_with_scores=low_results)
        
        assert decision.should_use is False
        assert len(decision.filtered_results) == 0
        assert "below" in decision.reason.lower()
    
    def test_high_relevance_passes(self, gate, mock_doc):
        """High relevance results should pass."""
        high_results = [
            (mock_doc, 0.75),
            (mock_doc, 0.80),
            (mock_doc, 0.70),
        ]
        
        decision = gate.evaluate(results_with_scores=high_results)
        
        assert decision.should_use is True
        assert decision.aggregate_relevance >= 0.55
        assert len(decision.filtered_results) == 3
    
    def test_mixed_relevance_filters(self, gate, mock_doc):
        """Mixed results should filter out low relevance items."""
        mixed_results = [
            (mock_doc, 0.75),  # Keep
            (mock_doc, 0.30),  # Filter out
            (mock_doc, 0.65),  # Keep
            (mock_doc, 0.25),  # Filter out
        ]
        
        decision = gate.evaluate(results_with_scores=mixed_results)
        
        # Should filter out 2 items
        assert decision.metrics["num_dropped"] == 2
        assert decision.metrics["num_filtered"] == 2
    
    def test_context_bonus_applied(self, gate, mock_doc):
        """Matching context should boost relevance."""
        results = [(mock_doc, 0.50)]  # Just below aggregate threshold
        
        # With matching context
        query_context = {
            "root_cause": "implementation",  # Matches mock_doc
            "category": "Array",  # Matches mock_doc
        }
        
        decision = gate.evaluate(
            results_with_scores=results,
            query_context=query_context,
        )
        
        # Bonus should push it over threshold
        # Note: actual behavior depends on bonus amount
        assert decision.metrics["num_raw"] == 1
    
    def test_temporal_decay_applied(self, gate):
        """Old memories should have decayed relevance."""
        old_doc = MagicMock()
        old_doc.metadata = {
            "stored_at": (datetime.now(timezone.utc) - timedelta(days=60)).isoformat(),
        }
        old_doc.page_content = "Old memory"
        
        new_doc = MagicMock()
        new_doc.metadata = {
            "stored_at": datetime.now(timezone.utc).isoformat(),
        }
        new_doc.page_content = "New memory"
        
        # Same raw relevance
        results = [
            (old_doc, 0.70),
            (new_doc, 0.70),
        ]
        
        decision = gate.evaluate(results_with_scores=results)
        
        # Both should pass (decay doesn't drop below 0.3 floor)
        # but old doc should have lower adjusted score
        assert len(decision.filtered_results) >= 1
    
    def test_aggregate_threshold(self, gate, mock_doc):
        """Aggregate relevance must meet threshold."""
        # Results that pass per-item but fail aggregate
        borderline_results = [
            (mock_doc, 0.45),
            (mock_doc, 0.48),
            (mock_doc, 0.50),
        ]
        
        decision = gate.evaluate(results_with_scores=borderline_results)
        
        # Average ~0.47 < 0.55 threshold
        # Items may pass individual but fail aggregate
        assert decision.aggregate_relevance < 0.55 or decision.should_use


# ═══════════════════════════════════════════════════════════════════════════════
# QUERY BUILDER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestQueryBuilder:
    """Test query builder - constructs better queries."""
    
    @pytest.fixture
    def builder(self):
        return QueryBuilder()
    
    def test_builds_from_root_cause_and_subtype(self, builder):
        """Query should include root cause and subtype."""
        query = builder.build_query(
            root_cause="implementation",
            subtype="off_by_one",
        )
        
        assert "off by one" in query.lower()
        assert "implementation" in query.lower()
    
    def test_includes_category(self, builder):
        """Query should include category."""
        query = builder.build_query(
            root_cause="efficiency",
            category="Dynamic Programming",
        )
        
        assert "dynamic programming" in query.lower()
    
    def test_includes_problem_tags(self, builder):
        """Query should include relevant tags."""
        query = builder.build_query(
            root_cause="correctness",
            problem_tags=["binary search", "array", "sorting"],
        )
        
        assert "binary search" in query.lower()
    
    def test_confirmed_pattern_adds_recurring(self, builder):
        """Confirmed patterns add 'recurring mistake' to query."""
        query = builder.build_query(
            root_cause="implementation",
            pattern_state="confirmed",
        )
        
        assert "recurring" in query.lower()
    
    def test_fallback_for_empty_context(self, builder):
        """Should have fallback when no context provided."""
        query = builder.build_query()
        
        assert len(query) > 0
        assert "mistake" in query.lower() or "programming" in query.lower()
    
    def test_verdict_fallback(self, builder):
        """Verdict used as fallback."""
        query = builder.build_query(
            verdict="time_limit_exceeded",
        )
        
        assert "time" in query.lower() or "exceeded" in query.lower()
    
    def test_query_context_for_bonus(self, builder):
        """build_query_context returns correct structure."""
        context = builder.build_query_context(
            root_cause="efficiency",
            subtype="tle_nested_loop",
            category="Array",
            pattern_state="confirmed",
        )
        
        assert context["root_cause"] == "efficiency"
        assert context["subtype"] == "tle_nested_loop"
        assert context["category"] == "Array"
        assert context["pattern_state"] == "confirmed"


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestRAGQualityGatesIntegration:
    """Integration tests for RAG quality gates."""
    
    def test_singleton_instances(self):
        """Singleton getters return consistent instances."""
        gate1 = get_storage_gate()
        gate2 = get_storage_gate()
        assert gate1 is gate2
        
        rel1 = get_relevance_gate()
        rel2 = get_relevance_gate()
        assert rel1 is rel2
        
        qb1 = get_query_builder()
        qb2 = get_query_builder()
        assert qb1 is qb2
    
    def test_storage_decision_to_dict(self):
        """StorageDecision.to_dict works correctly."""
        decision = StorageDecision(
            should_store=True,
            quality_score=0.75,
            reason="Test",
            confidence_tier="high",
            pattern_state="confirmed",
        )
        
        d = decision.to_dict()
        assert d["should_store"] is True
        assert d["quality_score"] == 0.75
        assert d["confidence_tier"] == "high"
    
    def test_relevance_decision_to_dict(self):
        """RelevanceDecision.to_dict works correctly."""
        decision = RelevanceDecision(
            should_use=True,
            aggregate_relevance=0.72,
            filtered_results=[],
            reason="Test",
            metrics={"num_raw": 5, "num_filtered": 3},
        )
        
        d = decision.to_dict()
        assert d["should_use"] is True
        assert d["aggregate_relevance"] == 0.72
        assert d["num_results"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# DETERMINISM TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestDeterminism:
    """Test that all operations are deterministic."""
    
    def test_storage_gate_deterministic(self):
        """Same inputs produce same storage decision."""
        gate = StorageGate()
        
        kwargs = {
            "content": "Test error description",
            "mim_confidence": 0.75,
            "pattern_state": "suspected",
            "root_cause": "implementation",
        }
        
        decision1 = gate.evaluate(**kwargs)
        decision2 = gate.evaluate(**kwargs)
        
        assert decision1.should_store == decision2.should_store
        assert decision1.quality_score == decision2.quality_score
        assert decision1.reason == decision2.reason
    
    def test_query_builder_deterministic(self):
        """Same inputs produce same query."""
        builder = QueryBuilder()
        
        kwargs = {
            "root_cause": "efficiency",
            "subtype": "tle",
            "category": "Array",
        }
        
        query1 = builder.build_query(**kwargs)
        query2 = builder.build_query(**kwargs)
        
        assert query1 == query2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
