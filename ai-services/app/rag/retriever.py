from .monitoring import rag_monitor
import logging
from typing import List, Any, Optional, Dict, Tuple
from app.rag.vector_store import user_memory_store
from app.rag.quality_gates import (
    get_relevance_gate,
    get_query_builder,
    RelevanceDecision,
)

logger = logging.getLogger("retriever")


def retrieve_user_memory(
    user_id: str,
    query: str,
    k: int = 3,
    # Phase 3.1: Enhanced retrieval parameters
    root_cause: Optional[str] = None,
    subtype: Optional[str] = None,
    category: Optional[str] = None,
    pattern_state: Optional[str] = None,
    apply_relevance_gate: bool = True,
) -> List[str]:
    """
    Retrieve user memories with Phase 3.1 quality gates.
    
    Parameters
    ----------
    user_id : str
        User identifier
    query : str
        Search query (or will be built from context if root_cause provided)
    k : int
        Number of results to retrieve
    root_cause : str, optional
        MIM root cause for better query construction
    subtype : str, optional
        MIM subtype for better query construction
    category : str, optional
        Problem category for query construction
    pattern_state : str, optional
        Current pattern state for context bonus
    apply_relevance_gate : bool
        Whether to apply relevance gate (default True)
        
    Returns
    -------
    List[str]
        List of relevant memory content strings (may be empty if gated)
    """
    # Phase 3.1: Build better query if context provided
    query_builder = get_query_builder()
    
    if root_cause or subtype:
        query = query_builder.build_query(
            root_cause=root_cause,
            subtype=subtype,
            category=category,
            pattern_state=pattern_state,
        )
    
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
        
        # ─────────────────────────────────────────────────────────────────────
        # Phase 3.1: Apply relevance gate
        # ─────────────────────────────────────────────────────────────────────
        if apply_relevance_gate and results_with_scores:
            relevance_gate = get_relevance_gate()
            
            # Build query context for bonus scoring
            query_context = query_builder.build_query_context(
                root_cause=root_cause,
                subtype=subtype,
                category=category,
                pattern_state=pattern_state,
            )
            
            gate_decision = relevance_gate.evaluate(
                results_with_scores=results_with_scores,
                query_context=query_context,
            )
            
            if not gate_decision.should_use:
                logger.info(f"🚫 RELEVANCE GATE: {gate_decision.reason}")
                print(f"🚫 Relevance gate blocked: {gate_decision.reason}")
                rag_monitor.log_retrieval(user_id, query, [], [])
                return []
            
            # Use filtered results
            results_with_scores = gate_decision.filtered_results
            logger.info(
                f"✅ Relevance gate passed: {gate_decision.metrics.get('num_filtered', 0)}"
                f"/{gate_decision.metrics.get('num_raw', 0)} results, "
                f"avg_relevance={gate_decision.aggregate_relevance:.2f}"
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
    mistake_summary: str,
    # Phase 3.1: Enhanced storage with quality gating
    mim_confidence: float = 0.70,
    root_cause: Optional[str] = None,
    subtype: Optional[str] = None,
    pattern_state: str = "none",
    is_recurring: bool = False,
    recurrence_count: int = 0,
) -> bool:
    """
    Store user feedback/mistake in the RAG vector store with quality gating.
    
    Phase 3.1: Applies storage gate to prevent low-quality memories.
    
    Args:
        user_id: User identifier
        problem_id: Problem identifier  
        category: Problem category (e.g., "Array", "DP")
        mistake_summary: Summary of the mistake made
        mim_confidence: Calibrated MIM confidence (Phase 2.1)
        root_cause: MIM root cause
        subtype: MIM subtype
        pattern_state: Pattern state from Phase 2.2
        is_recurring: Whether this is a recurring pattern
        recurrence_count: Number of recurrences
        
    Returns:
        True if stored successfully, False otherwise (including if gated)
    """
    from app.rag.quality_gates import get_storage_gate
    
    logger.debug(f"💾 store_user_feedback called")
    logger.debug(f"   └─ user_id: {user_id}")
    logger.debug(f"   └─ problem_id: {problem_id}")
    logger.debug(f"   └─ category: {category}")
    logger.debug(f"   └─ mim_confidence: {mim_confidence:.2f}")
    
    if not mistake_summary or not mistake_summary.strip():
        logger.warning("⚠️ Empty mistake_summary, skipping storage")
        return False
    
    # ─────────────────────────────────────────────────────────────────────────
    # Phase 3.1: Apply storage gate
    # ─────────────────────────────────────────────────────────────────────────
    storage_gate = get_storage_gate()
    content = f"[{category}] Problem {problem_id}: {mistake_summary}"
    
    gate_decision = storage_gate.evaluate(
        content=content,
        mim_confidence=mim_confidence,
        pattern_state=pattern_state,
        root_cause=root_cause,
        subtype=subtype,
        category=category,
        is_recurring=is_recurring,
        recurrence_count=recurrence_count,
    )
    
    if not gate_decision.should_store:
        logger.info(f"🚫 STORAGE GATE: {gate_decision.reason}")
        print(f"🚫 Storage gate blocked: {gate_decision.reason}")
        return False
    
    logger.info(
        f"✅ Storage gate passed: quality={gate_decision.quality_score:.2f}, "
        f"tier={gate_decision.confidence_tier}"
    )
    
    try:
        from langchain_core.documents import Document
        from datetime import datetime, timezone
        
        # Create document with enhanced metadata
        metadata = {
            "user_id": user_id,
            "problem_id": problem_id,
            "category": category,
            "stored_at": datetime.now(timezone.utc).isoformat(),
            **gate_decision.metadata_to_add,
        }
        
        doc = Document(
            page_content=content,
            metadata=metadata,
        )
        
        # Add to vector store (quality gate already passed)
        user_memory_store.add_documents([doc], enforce_quality_gate=False)
        
        logger.info(f"✅ Stored user feedback for {user_id} on problem {problem_id}")
        print(f"✅ Stored memory with quality={gate_decision.quality_score:.2f}")
        return True
        
    except Exception as e:
        logger.error(f"❌ store_user_feedback FAILED: {type(e).__name__}: {e}")
        return False