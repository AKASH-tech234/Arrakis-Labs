
#write
from typing import Dict
from app.rag.vector_store import user_memory_store


def store_user_feedback(
    user_id: str,
    problem_id: str,
    category: str,
    mistake_summary: str,
):
    """
    Stores a summarized learning signal in vector memory.
    """

    document = f"""
Mistake Summary:
{mistake_summary}

Problem Category:
{category}
"""

    metadata = {
        "user_id": user_id,
        "problem_id": problem_id,
        "category": category,
        "type": "user_mistake"
    }

    user_memory_store.add_texts(
        texts=[document],
        metadatas=[metadata]
    )


from typing import List
from app.rag.vector_store import user_memory_store


def retrieve_user_memory(
    user_id: str,
    query: str,
    k: int = 3
) -> List[str]:
    """
    Retrieves similar past mistakes for a specific user.
    """

    results = user_memory_store.similarity_search(
        query=query,
        k=k,
        filter={"user_id": user_id}
    )

    return [doc.page_content for doc in results]
