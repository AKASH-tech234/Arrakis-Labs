from typing import List, Dict, Any
import logging
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)

class RAGMonitor:
    """Monitor RAG retrieval quality and usage"""
    
    def __init__(self):
        self.retrieval_stats = defaultdict(lambda: {
            "total_retrievals": 0,
            "empty_results": 0,
            "avg_relevance": 0.0,
            "documents_retrieved": []
        })
    
    def log_retrieval(
        self,
        user_id: str,
        query: str,
        results: List[Any],
        relevance_scores: List[float] = None
    ):
        """Log RAG retrieval event with quality metrics"""
        
        stats = self.retrieval_stats[user_id]
        stats["total_retrievals"] += 1
        
        if not results:
            stats["empty_results"] += 1
            logger.warning(f"Empty RAG retrieval for user {user_id}, query: {query[:50]}")
            return
        
        # Track number of documents retrieved
        stats["documents_retrieved"].append(len(results))
        
        # Track relevance if provided
        if relevance_scores:
            avg_score = sum(relevance_scores) / len(relevance_scores)
            stats["avg_relevance"] = (
                (stats["avg_relevance"] * (stats["total_retrievals"] - 1) + avg_score)
                / stats["total_retrievals"]
            )
        
        logger.info(
            f"RAG retrieval for user {user_id}: "
            f"{len(results)} docs, avg_relevance: {stats['avg_relevance']:.2f}"
        )
    
    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get RAG usage statistics for a user"""
        return dict(self.retrieval_stats[user_id])
    
    def log_context_usage(
        self,
        user_id: str,
        context_length: int,
        memory_chunks_used: int,
        problem_context_present: bool,
        user_profile_present: bool
    ):
        """Log how context was constructed"""
        
        logger.info(
            f"Context built for user {user_id}: "
            f"length={context_length}, "
            f"memory_chunks={memory_chunks_used}, "
            f"problem_context={problem_context_present}, "
            f"user_profile={user_profile_present}"
        )

# Singleton instance
rag_monitor = RAGMonitor()