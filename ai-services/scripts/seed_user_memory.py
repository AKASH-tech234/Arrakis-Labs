"""
═══════════════════════════════════════════════════════════════════════════════
SEED USER RAG MEMORY - Vector Store Test Data Seeder
═══════════════════════════════════════════════════════════════════════════════

Usage:
    python scripts/seed_user_memory.py <user_id>
    
Example:
    python scripts/seed_user_memory.py 678abc123def456789012345

This script seeds historical mistake patterns into RAG (ChromaDB) to test:
- RAG retrieval relevance
- User memory context building
- Pattern detection accuracy
- Personalized feedback grounding
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK RAG MEMORY DATA - Historical mistake patterns
# ═══════════════════════════════════════════════════════════════════════════════

def get_mock_memories(user_id: str) -> list:
    """
    Generate historical mistake patterns to seed into RAG.
    These will be retrieved during feedback generation to personalize responses.
    """
    
    memories = [
        # === OFF-BY-ONE ERRORS (recurring pattern) ===
        {
            "problem_id": "array_rotation_old_001",
            "category": "Array",
            "mistake_summary": "Off-by-one error in loop boundary. Used range(len(arr)) when accessing arr[i+1], causing IndexError on last iteration.",
        },
        {
            "problem_id": "sliding_window_old_002",
            "category": "Array",
            "mistake_summary": "Off-by-one error in window calculation. Window size was k but used range(n-k) instead of range(n-k+1), missing the last valid window.",
        },
        {
            "problem_id": "binary_search_old_003",
            "category": "Binary Search",
            "mistake_summary": "Off-by-one error in right pointer initialization. Set right=len(nums) instead of len(nums)-1, causing out-of-bounds access.",
        },
        
        # === EDGE CASE MISSES ===
        {
            "problem_id": "sum_array_old_004",
            "category": "Array",
            "mistake_summary": "Failed to handle empty array edge case. Function crashed with IndexError when input was an empty list [].",
        },
        {
            "problem_id": "tree_depth_old_005",
            "category": "Tree",
            "mistake_summary": "Failed to handle null/None root edge case. Recursion crashed when root was None instead of returning 0.",
        },
        
        # === BOUNDARY CONDITION ISSUES ===
        {
            "problem_id": "matrix_traverse_old_006",
            "category": "Matrix",
            "mistake_summary": "Boundary condition error in matrix traversal. Checked i >= 0 but forgot to check j >= 0, causing negative index access.",
        },
        {
            "problem_id": "dp_table_old_007",
            "category": "Dynamic Programming",
            "mistake_summary": "Incorrect base case initialization in DP. Set dp[0] = 0 when it should have been dp[0] = nums[0] for the first element.",
        },
        
        # === ALGORITHM COMPLEXITY ISSUES ===
        {
            "problem_id": "pair_sum_old_008",
            "category": "Array",
            "mistake_summary": "Used O(n²) nested loop approach for pair finding when O(n) hash map solution was expected. Resulted in TLE on large inputs.",
        },
        {
            "problem_id": "fib_recursive_old_009",
            "category": "Dynamic Programming",
            "mistake_summary": "Recursive solution without memoization for Fibonacci-style problem. Exponential time complexity O(2^n) caused TLE.",
        },
        
        # === LOGIC ERRORS ===
        {
            "problem_id": "comparison_old_010",
            "category": "Array",
            "mistake_summary": "Used wrong comparison operator. Used '<' when '<=' was needed, missing the boundary value in the valid range.",
        },
        {
            "problem_id": "return_value_old_011",
            "category": "Graph",
            "mistake_summary": "Forgot to return value from helper function. DFS function computed correct answer but didn't return it, causing None to propagate.",
        },
    ]
    
    return memories


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN SEEDING FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def seed_user_memory(user_id: str):
    """Seed RAG memory for a user into ChromaDB vector store"""
    
    print(f"\n{'='*70}")
    print(f"🧠 SEEDING USER RAG MEMORY")
    print(f"{'='*70}")
    print(f"📋 User ID: {user_id}")
    print(f"{'='*70}\n")
    
    try:
        # Import after path setup
        from app.rag.retriever import store_user_feedback, retrieve_user_memory
        from app.rag.vector_store import user_memory_store
        
        print("✅ RAG modules imported successfully\n")
        
        # Get mock memories
        mock_memories = get_mock_memories(user_id)
        
        # Store each memory
        print(f"📝 Storing {len(mock_memories)} mistake patterns in RAG...\n")
        
        success_count = 0
        for i, memory in enumerate(mock_memories, 1):
            result = store_user_feedback(
                user_id=user_id,
                problem_id=memory["problem_id"],
                category=memory["category"],
                mistake_summary=memory["mistake_summary"]
            )
            
            status = "✅" if result else "❌"
            print(f"   {i:2d}. [{memory['category']:20s}] {memory['problem_id']:25s} | {status}")
            
            if result:
                success_count += 1
        
        print(f"\n{'='*70}")
        print(f"✅ RAG SEEDING COMPLETE")
        print(f"{'='*70}")
        print(f"📊 Total memories stored: {success_count}/{len(mock_memories)}")
        print(f"\n🎯 Patterns seeded by category:")
        
        # Count by category
        category_counts = {}
        for m in mock_memories:
            cat = m["category"]
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        for cat, count in sorted(category_counts.items()):
            print(f"   └─ {cat}: {count}")
        
        # Test retrieval
        print(f"\n{'='*70}")
        print(f"🔍 TESTING RAG RETRIEVAL")
        print(f"{'='*70}")
        
        test_queries = [
            "array off-by-one error loop boundary",
            "dynamic programming base case initialization",
            "binary search index out of bounds",
        ]
        
        for query in test_queries:
            print(f"\n📌 Query: \"{query}\"")
            results = retrieve_user_memory(user_id=user_id, query=query, k=3)
            print(f"   └─ Retrieved {len(results)} results:")
            for j, result in enumerate(results[:2], 1):  # Show first 2
                preview = result[:100] + "..." if len(result) > 100 else result
                print(f"      {j}. {preview}")
        
        print(f"\n{'='*70}\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error seeding RAG memory: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Usage: python scripts/seed_user_memory.py <user_id>")
        print("   Example: python scripts/seed_user_memory.py 678abc123def456789012345")
        sys.exit(1)
    
    user_id = sys.argv[1]
    success = seed_user_memory(user_id)
    sys.exit(0 if success else 1)
