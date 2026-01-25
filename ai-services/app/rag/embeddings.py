"""
Embeddings Module - HuggingFace Sentence Transformers
======================================================

Uses all-MiniLM-L6-v2 for fast, high-quality embeddings:
- 384 dimensions (compact, efficient)
- ~80ms per embedding on CPU
- Optimized for semantic similarity search
- Works offline with cached model

Model: sentence-transformers/all-MiniLM-L6-v2
"""

import logging
import os
from typing import List
from langchain_core.embeddings import Embeddings

logger = logging.getLogger("embeddings")

# Model configuration
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384  # Must match Pinecone index dimension


class HuggingFaceLocalEmbeddings(Embeddings):
    """
    HuggingFace Sentence Transformers embeddings.
    
    Uses local cached model for fast, offline-capable embeddings.
    """
    
    def __init__(self, model_name: str = EMBEDDING_MODEL):
        """Initialize the embedding model."""
        self.model_name = model_name
        self._model = None
        logger.info(f"🔧 Initializing HuggingFace embeddings: {model_name}")
    
    @property
    def model(self):
        """Lazy load the model on first use."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                
                logger.info(f"📥 Loading SentenceTransformer model: {self.model_name}")
                self._model = SentenceTransformer(self.model_name)
                logger.info(f"✅ Model loaded successfully | dim={self._model.get_sentence_embedding_dimension()}")
            except Exception as e:
                logger.error(f"❌ Failed to load embedding model: {e}")
                raise
        return self._model
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of documents.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
        
        try:
            embeddings = self.model.encode(
                texts,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True  # L2 normalize for cosine similarity
            )
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"❌ embed_documents failed: {e}")
            raise
    
    def embed_query(self, text: str) -> List[float]:
        """
        Embed a single query text.
        
        Args:
            text: Query string to embed
            
        Returns:
            Embedding vector
        """
        try:
            embedding = self.model.encode(
                text,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True
            )
            return embedding.tolist()
        except Exception as e:
            logger.error(f"❌ embed_query failed: {e}")
            raise


# Singleton instance
_embeddings_instance = None


def get_embeddings() -> Embeddings:
    """
    Get the shared embeddings instance.
    
    Returns:
        HuggingFaceLocalEmbeddings instance
    """
    global _embeddings_instance
    
    if _embeddings_instance is None:
        logger.info("🔧 Creating HuggingFace embeddings instance")
        _embeddings_instance = HuggingFaceLocalEmbeddings(EMBEDDING_MODEL)
        logger.info("✅ HuggingFace embeddings ready")
    
    return _embeddings_instance


def get_embedding_dimension() -> int:
    """Return the embedding dimension for Pinecone index creation."""
    return EMBEDDING_DIMENSION
