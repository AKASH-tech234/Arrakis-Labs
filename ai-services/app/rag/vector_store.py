import logging
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings

from .embeddings import get_embeddings

logger = logging.getLogger("vector_store")

logger.info("🗃️  Initializing vector stores...")

# Initialize embeddings once
logger.debug("   └─ Getting embeddings...")
embeddings: Embeddings = get_embeddings()
logger.info("✅ Embeddings initialized")

logger.debug("   └─ Creating user_memory_store...")
user_memory_store = Chroma(
    collection_name="user_memory",
    embedding_function=embeddings,
    persist_directory="./vector_db/user_memory"
)
logger.info("✅ user_memory_store ready")

logger.debug("   └─ Creating problem_knowledge_store...")
problem_knowledge_store = Chroma(
    collection_name="problem_knowledge",
    embedding_function=embeddings,
    persist_directory="./vector_db/problem_knowledge"
)
logger.info("✅ problem_knowledge_store ready")
logger.info("🟢 All vector stores initialized")
