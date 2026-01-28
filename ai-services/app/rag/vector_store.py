"""
Vector Store Module - Pinecone Cloud
=====================================

Uses Pinecone for production-grade vector storage:
- Serverless infrastructure (no Ollama dependency)
- Fast similarity search with metadata filtering
- Automatic scaling and high availability

Configuration via .env:
- PINECONE_API_KEY
- PINECONE_INDEX_NAME
- PINECONE_ENVIRONMENT (optional)
"""

import logging
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass
from dotenv import load_dotenv

logger = logging.getLogger("vector_store")

# Load environment variables
load_dotenv()

# Pinecone configuration
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "arrakis-labs")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT", "us-east-1")

logger.info("🗃️  Initializing Pinecone vector store...")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3.1: MEMORY QUALITY CONTROL
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class MemoryQualityScore:
    """Quality score for a memory document."""
    score: float  # 0-1
    components: Dict[str, float]
    should_store: bool
    reason: str


class MemoryQualityScorer:
    """
    Phase 3.1: Deterministic quality scoring for RAG memories.
    
    Quality factors:
    - MIM confidence (diagnosis reliability)
    - Pattern recurrence (validated learning signal)
    - User feedback (if available)
    - Content completeness
    
    Guarantees:
    - Deterministic (same inputs = same score)
    - No LLM involvement in scoring
    - Quality is a control signal, not a prediction
    """
    
    # Quality thresholds
    STORAGE_THRESHOLD = 0.6  # Minimum quality to store
    HIGH_QUALITY_THRESHOLD = 0.8
    
    # Component weights
    WEIGHTS = {
        "mim_confidence": 0.35,
        "pattern_recurrence": 0.25,
        "content_completeness": 0.25,
        "user_feedback": 0.15,
    }
    
    def score(
        self,
        content: str,
        metadata: Dict[str, Any],
    ) -> MemoryQualityScore:
        """
        Compute quality score for a memory document.
        
        Parameters
        ----------
        content : str
            Memory content text
        metadata : dict
            Memory metadata including mim_confidence, pattern info, etc.
            
        Returns
        -------
        MemoryQualityScore
            Quality assessment with storage recommendation
        """
        components = {}
        
        # MIM confidence component
        mim_conf = metadata.get("mim_confidence", 0.5)
        components["mim_confidence"] = float(mim_conf)
        
        # Pattern recurrence component (validated signal)
        is_recurring = metadata.get("is_recurring", False)
        recurrence_count = metadata.get("recurrence_count", 0)
        if is_recurring and recurrence_count >= 2:
            components["pattern_recurrence"] = min(1.0, 0.5 + recurrence_count * 0.1)
        elif is_recurring:
            components["pattern_recurrence"] = 0.6
        else:
            components["pattern_recurrence"] = 0.3
        
        # Content completeness component
        completeness = self._compute_content_completeness(content, metadata)
        components["content_completeness"] = completeness
        
        # User feedback component (if available)
        was_helpful = metadata.get("was_helpful")
        if was_helpful is True:
            components["user_feedback"] = 1.0
        elif was_helpful is False:
            components["user_feedback"] = 0.0
        else:
            components["user_feedback"] = 0.5  # Unknown
        
        # Weighted score
        score = sum(
            self.WEIGHTS[k] * components.get(k, 0.5)
            for k in self.WEIGHTS
        )
        
        # Storage decision
        should_store = score >= self.STORAGE_THRESHOLD
        
        if not should_store:
            reason = f"Quality {score:.2f} below threshold {self.STORAGE_THRESHOLD}"
        elif score >= self.HIGH_QUALITY_THRESHOLD:
            reason = f"High quality memory ({score:.2f})"
        else:
            reason = f"Acceptable quality ({score:.2f})"
        
        return MemoryQualityScore(
            score=round(score, 3),
            components=components,
            should_store=should_store,
            reason=reason,
        )
    
    def _compute_content_completeness(
        self,
        content: str,
        metadata: Dict[str, Any],
    ) -> float:
        """Compute content completeness score."""
        score = 0.0
        
        # Content length (minimum useful length)
        if len(content) >= 100:
            score += 0.3
        elif len(content) >= 50:
            score += 0.15
        
        # Has root cause
        if metadata.get("root_cause"):
            score += 0.2
        
        # Has subtype
        if metadata.get("subtype"):
            score += 0.15
        
        # Has category context
        if metadata.get("category"):
            score += 0.1
        
        # Has problem reference
        if metadata.get("problem_id") or metadata.get("questionId"):
            score += 0.1
        
        # Has timestamp (for decay tracking)
        if metadata.get("created_at") or metadata.get("timestamp"):
            score += 0.15
        
        return min(1.0, score)


# Global scorer instance
_memory_scorer = MemoryQualityScorer()


class PineconeVectorStore:
    """
    Pinecone-based vector store for user memory and problem knowledge.
    
    Provides LangChain-compatible interface for:
    - similarity_search_with_relevance_scores
    - add_documents
    - delete (by metadata filter)
    """
    
    def __init__(self, namespace: str = "user_memory"):
        """
        Initialize Pinecone vector store.
        
        Args:
            namespace: Pinecone namespace for isolation (user_memory, problem_knowledge)
        """
        self.namespace = namespace
        self._index = None
        self._embeddings = None
        self._initialized = False
        
        logger.info(f"📦 PineconeVectorStore created | namespace={namespace}")
    
    def _ensure_initialized(self):
        """Lazy initialization of Pinecone client and embeddings."""
        if self._initialized:
            return
        
        try:
            from pinecone import Pinecone
            from .embeddings import get_embeddings, EMBEDDING_DIMENSION
            
            if not PINECONE_API_KEY:
                raise ValueError("PINECONE_API_KEY not set in environment")
            
            # Initialize Pinecone client
            logger.info(f"🔌 Connecting to Pinecone | index={PINECONE_INDEX_NAME}")
            pc = Pinecone(api_key=PINECONE_API_KEY)
            
            # Check if index exists, create if not
            existing_indexes = [idx.name for idx in pc.list_indexes()]
            
            if PINECONE_INDEX_NAME not in existing_indexes:
                logger.info(f"📝 Creating Pinecone index: {PINECONE_INDEX_NAME}")
                from pinecone import ServerlessSpec
                pc.create_index(
                    name=PINECONE_INDEX_NAME,
                    dimension=EMBEDDING_DIMENSION,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region=PINECONE_ENVIRONMENT
                    )
                )
                logger.info(f"✅ Index created: {PINECONE_INDEX_NAME}")
            
            self._index = pc.Index(PINECONE_INDEX_NAME)
            self._embeddings = get_embeddings()
            self._initialized = True
            
            # Log index stats
            stats = self._index.describe_index_stats()
            logger.info(f"✅ Pinecone connected | vectors={stats.get('total_vector_count', 0)}")
            
        except Exception as e:
            logger.error(f"❌ Pinecone initialization failed: {e}")
            raise
    
    def similarity_search_with_relevance_scores(
        self,
        query: str,
        k: int = 5,
        filter: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[Any, float]]:
        """
        Search for similar documents with relevance scores.
        
        Args:
            query: Search query text
            k: Number of results to return
            filter: Metadata filter (e.g., {"user_id": "123"})
            
        Returns:
            List of (Document, score) tuples
        """
        self._ensure_initialized()
        
        try:
            from langchain_core.documents import Document
            
            # Get query embedding
            query_embedding = self._embeddings.embed_query(query)
            
            # Query Pinecone
            results = self._index.query(
                vector=query_embedding,
                top_k=k,
                namespace=self.namespace,
                filter=filter,
                include_metadata=True,
            )
            
            # Convert to LangChain format
            docs_with_scores = []
            for match in results.get("matches", []):
                doc = Document(
                    page_content=match.get("metadata", {}).get("text", ""),
                    metadata={k: v for k, v in match.get("metadata", {}).items() if k != "text"}
                )
                score = match.get("score", 0.0)
                docs_with_scores.append((doc, score))
            
            logger.debug(f"🔍 Query returned {len(docs_with_scores)} results")
            return docs_with_scores
            
        except Exception as e:
            logger.error(f"❌ similarity_search failed: {e}")
            return []
    
    def add_documents(
        self,
        documents: List[Any],
        ids: Optional[List[str]] = None,
        enforce_quality_gate: bool = True,
    ) -> List[str]:
        """
        Add documents to the vector store with quality gating.
        
        Phase 3.1: Implements selective storage based on quality scores.
        
        Args:
            documents: List of LangChain Document objects
            ids: Optional list of document IDs
            enforce_quality_gate: If True, filter low-quality documents
            
        Returns:
            List of document IDs (only stored documents)
        """
        self._ensure_initialized()
        
        if not documents:
            return []
        
        try:
            import uuid
            
            # Generate IDs if not provided
            if ids is None:
                ids = [str(uuid.uuid4()) for _ in documents]
            
            # Phase 3.1: Quality gating
            filtered_docs = []
            filtered_ids = []
            quality_scores = []
            
            for doc, doc_id in zip(documents, ids):
                if enforce_quality_gate and self.namespace == "user_memory":
                    quality = _memory_scorer.score(doc.page_content, doc.metadata)
                    quality_scores.append(quality)
                    
                    if not quality.should_store:
                        logger.debug(f"🚫 Skipping low-quality memory: {quality.reason}")
                        continue
                    
                    # Add quality score to metadata
                    doc.metadata["quality_score"] = quality.score
                    doc.metadata["quality_components"] = quality.components
                
                filtered_docs.append(doc)
                filtered_ids.append(doc_id)
            
            if not filtered_docs:
                logger.info(f"📭 No documents passed quality gate (0/{len(documents)})")
                return []
            
            if len(filtered_docs) < len(documents):
                logger.info(
                    f"🔍 Quality gate: {len(filtered_docs)}/{len(documents)} documents passed"
                )
            
            # Prepare vectors
            texts = [doc.page_content for doc in filtered_docs]
            embeddings = self._embeddings.embed_documents(texts)
            
            # Prepare upsert data with TTL metadata
            vectors = []
            now = datetime.now(timezone.utc).isoformat()
            
            for doc, embedding, doc_id in zip(filtered_docs, embeddings, filtered_ids):
                metadata = {
                    "text": doc.page_content,
                    "stored_at": now,
                    **doc.metadata
                }
                
                # Phase 3.1: Set TTL based on quality
                quality_score = doc.metadata.get("quality_score", 0.6)
                if quality_score >= 0.8:
                    metadata["ttl_days"] = 365  # High quality: 1 year
                elif quality_score >= 0.7:
                    metadata["ttl_days"] = 180  # Medium quality: 6 months
                else:
                    metadata["ttl_days"] = 90  # Lower quality: 3 months
                
                vectors.append({
                    "id": doc_id,
                    "values": embedding,
                    "metadata": metadata,
                })
            
            # Upsert to Pinecone (batch size 100)
            batch_size = 100
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                self._index.upsert(vectors=batch, namespace=self.namespace)
            
            logger.info(f"✅ Added {len(vectors)} documents to namespace '{self.namespace}'")
            return filtered_ids
            
        except Exception as e:
            logger.error(f"❌ add_documents failed: {e}")
            return []
    
    def boost_memory(self, doc_id: str, boost_reason: str = "retrieved") -> bool:
        """
        Phase 3.1: Boost memory quality/TTL when it's successfully retrieved.
        
        Useful memories get extended retention.
        """
        self._ensure_initialized()
        
        try:
            # Fetch current metadata
            result = self._index.fetch(ids=[doc_id], namespace=self.namespace)
            vectors = result.get("vectors", {})
            
            if doc_id not in vectors:
                return False
            
            metadata = vectors[doc_id].get("metadata", {})
            
            # Increase TTL
            current_ttl = metadata.get("ttl_days", 90)
            metadata["ttl_days"] = min(365, current_ttl + 30)
            
            # Track retrieval count
            retrieval_count = metadata.get("retrieval_count", 0) + 1
            metadata["retrieval_count"] = retrieval_count
            metadata["last_retrieved"] = datetime.now(timezone.utc).isoformat()
            
            # Boost quality score slightly
            quality = metadata.get("quality_score", 0.6)
            metadata["quality_score"] = min(1.0, quality + 0.02)
            
            # Update in Pinecone
            self._index.update(
                id=doc_id,
                set_metadata=metadata,
                namespace=self.namespace,
            )
            
            logger.debug(f"📈 Boosted memory {doc_id}: ttl={metadata['ttl_days']}, retrievals={retrieval_count}")
            return True
            
        except Exception as e:
            logger.warning(f"Failed to boost memory {doc_id}: {e}")
            return False
    
    def delete(self, filter: Dict[str, Any]) -> bool:
        """
        Delete documents by metadata filter.
        
        Args:
            filter: Metadata filter for deletion
            
        Returns:
            True if successful
        """
        self._ensure_initialized()
        
        try:
            # Pinecone requires IDs for deletion, so we need to query first
            # For simplicity, we'll delete by namespace if filter is empty
            if not filter:
                self._index.delete(delete_all=True, namespace=self.namespace)
            else:
                # Query to get IDs, then delete
                # This is a limitation - Pinecone doesn't support delete by filter directly
                logger.warning("Delete by filter not fully supported - using query+delete")
                results = self._index.query(
                    vector=[0.0] * 384,  # Dummy vector
                    top_k=10000,
                    namespace=self.namespace,
                    filter=filter,
                    include_metadata=False,
                )
                ids_to_delete = [m["id"] for m in results.get("matches", [])]
                if ids_to_delete:
                    self._index.delete(ids=ids_to_delete, namespace=self.namespace)
            
            logger.info(f"✅ Deleted documents from namespace '{self.namespace}'")
            return True
            
        except Exception as e:
            logger.error(f"❌ delete failed: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCES
# ═══════════════════════════════════════════════════════════════════════════════

# User memory store (historical mistakes, patterns)
user_memory_store = PineconeVectorStore(namespace="user_memory")
logger.info("✅ user_memory_store ready (Pinecone)")

# Problem knowledge store (problem descriptions, solutions)
problem_knowledge_store = PineconeVectorStore(namespace="problem_knowledge")
logger.info("✅ problem_knowledge_store ready (Pinecone)")

logger.info("🟢 All Pinecone vector stores initialized")
