from langchain_community.vectorstores import Chroma
from .embeddings import embeddings
from app.rag.embeddings import get_embeddings

user_memory_store = Chroma(
    collection_name="user_memory",
    embedding_function=embeddings
)

_embeddings = get_embeddings()

user_memory_store = Chroma(
    collection_name="user_memory",
    embedding_function=_embeddings,
    persist_directory="./vector_db/user_memory"
)

problem_knowledge_store = Chroma(
    collection_name="problem_knowledge",
    embedding_function=_embeddings,
    persist_directory="./vector_db/problem_knowledge"
)
