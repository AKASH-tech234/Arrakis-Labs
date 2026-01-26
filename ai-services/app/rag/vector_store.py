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
from dotenv import load_dotenv

logger = logging.getLogger("vector_store")

# Load environment variables
load_dotenv()

# Pinecone configuration
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "arrakis-labs")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT", "us-east-1")

logger.info("🗃️  Initializing Pinecone vector store...")


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
    ) -> List[str]:
        """
        Add documents to the vector store.
        
        Args:
            documents: List of LangChain Document objects
            ids: Optional list of document IDs
            
        Returns:
            List of document IDs
        """
        self._ensure_initialized()
        
        if not documents:
            return []
        
        try:
            import uuid
            
            # Generate IDs if not provided
            if ids is None:
                ids = [str(uuid.uuid4()) for _ in documents]
            
            # Prepare vectors
            texts = [doc.page_content for doc in documents]
            embeddings = self._embeddings.embed_documents(texts)
            
            # Prepare upsert data
            vectors = []
            for i, (doc, embedding, doc_id) in enumerate(zip(documents, embeddings, ids)):
                metadata = {
                    "text": doc.page_content,
                    **doc.metadata
                }
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
            return ids
            
        except Exception as e:
            logger.error(f"❌ add_documents failed: {e}")
            return []
    
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
