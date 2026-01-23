from .monitoring import rag_monitor
import logging
from typing import List, Any
from app.rag.vector_store import user_memory_store
logger = logging.getLogger("retriever")
def retrieve_user_memory(
    user_id: str,
    query: str,
    k: int = 3
) -> List[str]:
    print(f"\n🔍 Retrieving user memory from RAG:")
    print(f"   └─ user_id: {user_id}")
    print(f"   └─ query: {query[:80]}..." if len(query) > 80 else f"   └─ query: {query}")
    print(f"   └─ k: {k}")
    
    logger.debug(f"🔍 retrieve_user_memory called")
    logger.debug(f"   └─ user_id: {user_id}")
    logger.debug(f"   └─ query: {query[:50]}...")
    logger.debug(f"   └─ k: {k}")
    
    try:
        # Retrieve with similarity scores
        results_with_scores = user_memory_store.similarity_search_with_relevance_scores(
            query=query,
            k=k,
            filter={"user_id": user_id}
        )
        
        # Extract documents and scores
        results = [doc for doc, score in results_with_scores]
        scores = [score for doc, score in results_with_scores]
        
        # Log to monitor
        rag_monitor.log_retrieval(
            user_id=user_id,
            query=query,
            results=results,
            relevance_scores=scores
        )
        
        print(f"✅ Retrieved {len(results)} memory documents")
        if results:
            print(f"   └─ Relevance scores: {[f'{s:.2f}' for s in scores]}")
        
        logger.info(f"✅ Retrieved {len(results)} memory documents")
        
        if results:
            logger.debug(f"   └─ Relevance scores: {[f'{s:.2f}' for s in scores]}")
            logger.debug(f"   └─ Sample content: {results[0].page_content[:100]}...")
        
        return [doc.page_content for doc in results]
        
    except Exception as e:
        print(f"❌ Failed to retrieve user memory: {e}")
        logger.error(f"❌ retrieve_user_memory FAILED: {type(e).__name__}: {e}")
        rag_monitor.log_retrieval(user_id, query, [], [])
        return []


def store_user_feedback(
    user_id: str,
    problem_id: str,
    category: str,
    mistake_summary: str
) -> bool:
    """
    Store user feedback/mistake in the RAG vector store.
    
    Args:
        user_id: User identifier
        problem_id: Problem identifier  
        category: Problem category (e.g., "Array", "DP")
        mistake_summary: Summary of the mistake made
        
    Returns:
        True if stored successfully, False otherwise
    """
    logger.debug(f"💾 store_user_feedback called")
    logger.debug(f"   └─ user_id: {user_id}")
    logger.debug(f"   └─ problem_id: {problem_id}")
    logger.debug(f"   └─ category: {category}")
    
    if not mistake_summary or not mistake_summary.strip():
        logger.warning("⚠️ Empty mistake_summary, skipping storage")
        return False
    
    try:
        from langchain_core.documents import Document
        import time
        
        # Create document with metadata
        doc = Document(
            page_content=f"[{category}] Problem {problem_id}: {mistake_summary}",
            metadata={
                "user_id": user_id,
                "problem_id": problem_id,
                "category": category,
                "timestamp": int(time.time())
            }
        )
        
        # Add to vector store
        user_memory_store.add_documents([doc])
        
        logger.info(f"✅ Stored user feedback for {user_id} on problem {problem_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ store_user_feedback FAILED: {type(e).__name__}: {e}")
        return False