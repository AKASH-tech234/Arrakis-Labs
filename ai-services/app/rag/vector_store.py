from langchain_community.vectorstores import Chroma
from langchain_core.embeddings import Embeddings

from .embeddings import get_embeddings


# Initialize embeddings once
embeddings: Embeddings = get_embeddings()


user_memory_store = Chroma(
    collection_name="user_memory",
    embedding_function=embeddings,
    persist_directory="./vector_db/user_memory"
)

problem_knowledge_store = Chroma(
    collection_name="problem_knowledge",
    embedding_function=embeddings,
    persist_directory="./vector_db/problem_knowledge"
)
