from typing import List
import logging
import traceback

from .vector_store import user_memory_store

logger = logging.getLogger("rag_retriever")


def retrieve_user_memory(
    user_id: str,
    query: str,
    k: int = 3
) -> List[str]:
    logger.debug(f"🔍 retrieve_user_memory called")
    logger.debug(f"   └─ user_id: {user_id}")
    logger.debug(f"   └─ query: {query[:50]}...")
    logger.debug(f"   └─ k: {k}")
    
    try:
        results = user_memory_store.similarity_search(
            query=query,
            k=k,
            filter={"user_id": user_id}
        )
        logger.info(f"✅ Retrieved {len(results)} memory documents")
        return [doc.page_content for doc in results]
    except Exception as e:
        logger.error(f"❌ retrieve_user_memory FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
        return []  # Return empty list on failure


def store_user_feedback(
    user_id: str,
    problem_id: str,
    category: str,
    mistake_summary: str,
) -> None:
    logger.debug(f"💾 store_user_feedback called")
    logger.debug(f"   └─ user_id: {user_id}")
    logger.debug(f"   └─ problem_id: {problem_id}")
    logger.debug(f"   └─ category: {category}")
    
    document = f"""
Mistake Summary:
{mistake_summary}

Problem Category:
{category}
""".strip()

    metadata = {
        "user_id": user_id,
        "problem_id": problem_id,
        "category": category,
        "type": "user_mistake"
    }

    try:
        user_memory_store.add_texts(
            texts=[document],
            metadatas=[metadata]
        )
        logger.info(f"✅ User feedback stored successfully")
    except Exception as e:
        logger.error(f"❌ store_user_feedback FAILED: {type(e).__name__}: {e}")
        logger.error(f"   └─ Traceback: {traceback.format_exc()}")
