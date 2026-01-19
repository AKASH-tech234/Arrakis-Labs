# from langchain_openai import OpenAIEmbeddings

# def get_embeddings():
#     return OpenAIEmbeddings(
#         model="text-embedding-3-large"
#     )
import logging
from langchain_ollama import OllamaEmbeddings

logger = logging.getLogger("embeddings")

def get_embeddings():
    logger.info("🔧 Creating OllamaEmbeddings (model=nomic-embed-text)")
    try:
        embeddings = OllamaEmbeddings(
            model="nomic-embed-text"
        )
        logger.info("✅ OllamaEmbeddings created successfully")
        return embeddings
    except Exception as e:
        logger.error(f"❌ Failed to create embeddings: {type(e).__name__}: {e}")
        raise
