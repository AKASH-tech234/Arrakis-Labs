#!/usr/bin/env python3
"""
RAG Verification Script
Run this to verify RAG is working correctly
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.rag.vector_store import user_memory_store
from app.rag.retriever import retrieve_user_memory, store_user_feedback
from app.rag.embeddings import get_embeddings
import random

def verify_embedding_model():
    """Test that embeddings are working"""
    print("🔍 Testing embedding model...")
    
    embeddings = get_embeddings()
    test_text = "This is a test of the embedding system"
    
    try:
        embedding = embeddings.embed_query(test_text)
        print(f"✅ Embedding generated: dimension = {len(embedding)}")
        return True
    except Exception as e:
        print(f"❌ Embedding failed: {e}")
        return False

def verify_storage_and_retrieval():
    """Test storage and retrieval"""
    print("\n🔍 Testing storage and retrieval...")
    
    test_user_id = f"test_user_{random.randint(1000, 9999)}"
    test_problem_id = "test_problem_123"
    
    # Store test data
    print(f"   Storing test data for user {test_user_id}...")
    store_user_feedback(
        user_id=test_user_id,
        problem_id=test_problem_id,
        category="Arrays",
        mistake_summary="Array index out of bounds error when iterating"
    )
    
    # Retrieve with exact match
    print(f"   Retrieving with query 'array index error'...")
    results = retrieve_user_memory(
        user_id=test_user_id,
        query="array index error",
        k=1
    )
    
    if results:
        print(f"✅ Retrieval successful")
        print(f"   Retrieved content: {results[0][:100]}...")
        return True
    else:
        print(f"❌ No results retrieved")
        return False

def verify_user_memory_exists(user_id: str):
    """Check if a real user has stored memory"""
    print(f"\n🔍 Checking memory for user {user_id}...")
    
    results = retrieve_user_memory(
        user_id=user_id,
        query="mistake problem error",
        k=10
    )
    
    if results:
        print(f"✅ Found {len(results)} memory entries")
        for i, content in enumerate(results[:3], 1):
            print(f"\n   Entry {i}:")
            print(f"   {content[:200]}...")
        return True
    else:
        print(f"❌ No memory found for user {user_id}")
        return False

def main():
    print("=" * 60)
    print("RAG VERIFICATION SCRIPT")
    print("=" * 60)
    
    tests = [
        ("Embedding Model", verify_embedding_model),
        ("Storage & Retrieval", verify_storage_and_retrieval),
    ]
    
    results = {}
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print(f"❌ {name} failed with exception: {e}")
            results[name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    for name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name}: {status}")
    
    # Test with real user if provided
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
        verify_user_memory_exists(user_id)
    
    all_passed = all(results.values())
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()