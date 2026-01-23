"""
Tests for RAG (Retrieval-Augmented Generation) Module
======================================================

Tests for app/rag/ components
"""

import pytest
from unittest.mock import MagicMock, patch
from langchain_core.documents import Document


class TestRetriever:
    """Tests for the RAG retriever module."""

    @patch("app.rag.retriever.user_memory_store")
    def test_retrieve_user_memory_success(self, mock_vector_store):
        """Test successful memory retrieval."""
        from app.rag.retriever import retrieve_user_memory
        
        # Mock vector store response
        mock_docs = [
            (Document(page_content="Memory chunk 1"), 0.9),
            (Document(page_content="Memory chunk 2"), 0.8),
        ]
        mock_vector_store.similarity_search_with_relevance_scores.return_value = mock_docs
        
        result = retrieve_user_memory(
            user_id="test_user",
            query="array problem",
            k=3
        )
        
        assert len(result) == 2
        assert result[0] == "Memory chunk 1"
        assert result[1] == "Memory chunk 2"

    @patch("app.rag.retriever.user_memory_store")
    def test_retrieve_user_memory_empty(self, mock_vector_store):
        """Test memory retrieval with no results."""
        from app.rag.retriever import retrieve_user_memory
        
        mock_vector_store.similarity_search_with_relevance_scores.return_value = []
        
        result = retrieve_user_memory(
            user_id="test_user",
            query="unknown topic",
            k=3
        )
        
        assert result == []

    @patch("app.rag.retriever.user_memory_store")
    def test_retrieve_user_memory_handles_error(self, mock_vector_store):
        """Test memory retrieval error handling."""
        from app.rag.retriever import retrieve_user_memory
        
        mock_vector_store.similarity_search_with_relevance_scores.side_effect = Exception("DB Error")
        
        result = retrieve_user_memory(
            user_id="test_user",
            query="test query",
            k=3
        )
        
        assert result == []

    @patch("app.rag.retriever.user_memory_store")
    def test_store_user_feedback_success(self, mock_vector_store):
        """Test successful feedback storage."""
        from app.rag.retriever import store_user_feedback
        
        mock_vector_store.add_documents.return_value = None
        
        result = store_user_feedback(
            user_id="test_user",
            problem_id="prob_001",
            category="Array",
            mistake_summary="Off-by-one error in loop boundary"
        )
        
        assert result is True
        mock_vector_store.add_documents.assert_called_once()

    @patch("app.rag.retriever.user_memory_store")
    def test_store_user_feedback_empty_summary(self, mock_vector_store):
        """Test feedback storage with empty summary."""
        from app.rag.retriever import store_user_feedback
        
        result = store_user_feedback(
            user_id="test_user",
            problem_id="prob_001",
            category="Array",
            mistake_summary=""
        )
        
        assert result is False
        mock_vector_store.add_documents.assert_not_called()


class TestContextBuilder:
    """Tests for the context builder module."""

    def test_format_problem_section(self, sample_problem_context):
        """Test problem section formatting."""
        from app.rag.context_builder import format_problem_section
        
        result = format_problem_section(sample_problem_context)
        
        assert "prob_001" in result
        assert "Two Sum" in result
        assert "Easy" in result
        assert "Array" in result

    def test_format_problem_section_none(self):
        """Test problem section formatting with None."""
        from app.rag.context_builder import format_problem_section
        
        result = format_problem_section(None)
        
        assert "not available" in result.lower()

    def test_format_user_profile_section(self, sample_user_profile):
        """Test user profile section formatting."""
        from app.rag.context_builder import format_user_profile_section
        
        result = format_user_profile_section(sample_user_profile)
        
        assert "off-by-one" in result.lower() or "edge case" in result.lower()
        assert "Dynamic Programming" in result

    def test_format_user_profile_section_none(self):
        """Test user profile section formatting with None."""
        from app.rag.context_builder import format_user_profile_section
        
        result = format_user_profile_section(None)
        
        assert "no" in result.lower() or "generic" in result.lower()

    def test_format_memory_chunks(self, sample_user_memory):
        """Test memory chunks formatting."""
        from app.rag.context_builder import format_memory_chunks
        
        result = format_memory_chunks(sample_user_memory)
        
        assert "Array" in result
        assert "prob_001" in result

    def test_format_memory_chunks_empty(self):
        """Test memory chunks formatting with empty list."""
        from app.rag.context_builder import format_memory_chunks
        
        result = format_memory_chunks([])
        
        assert "no" in result.lower() and "prior" in result.lower() or "retrieved" in result.lower()

    @patch("app.db.mongodb.mongo_client")
    def test_build_context_full(
        self, 
        mock_mongo,
        sample_submission_payload,
        sample_user_memory,
        sample_problem_context,
        sample_user_profile
    ):
        """Test full context building."""
        from app.rag.context_builder import build_context
        from app.schemas.submission import SubmissionContext
        
        mock_mongo.db = None
        
        submission = SubmissionContext(**sample_submission_payload)
        
        result = build_context(
            submission=submission,
            user_memory=sample_user_memory,
            problem_context=sample_problem_context,
            user_profile=sample_user_profile
        )
        
        assert "PROBLEM DEFINITION" in result
        assert "USER PROFILE" in result
        assert "CURRENT SUBMISSION" in result
        assert sample_submission_payload["language"] in result


class TestRAGMonitor:
    """Tests for the RAG monitoring module."""

    def test_log_retrieval(self):
        """Test retrieval logging."""
        from app.rag.monitoring import RAGMonitor
        
        monitor = RAGMonitor()
        
        monitor.log_retrieval(
            user_id="test_user",
            query="test query",
            results=[MagicMock()],
            relevance_scores=[0.85]
        )
        
        stats = monitor.get_user_stats("test_user")
        
        assert stats["total_retrievals"] == 1
        assert stats["empty_results"] == 0

    def test_log_retrieval_empty(self):
        """Test retrieval logging with empty results."""
        from app.rag.monitoring import RAGMonitor
        
        monitor = RAGMonitor()
        
        monitor.log_retrieval(
            user_id="test_user",
            query="test query",
            results=[],
            relevance_scores=[]
        )
        
        stats = monitor.get_user_stats("test_user")
        
        assert stats["total_retrievals"] == 1
        assert stats["empty_results"] == 1

    def test_log_context_usage(self):
        """Test context usage logging."""
        from app.rag.monitoring import RAGMonitor
        
        monitor = RAGMonitor()
        
        # Should not raise
        monitor.log_context_usage(
            user_id="test_user",
            context_length=3500,
            memory_chunks_used=3,
            problem_context_present=True,
            user_profile_present=True
        )
