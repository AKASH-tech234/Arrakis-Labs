"""
═══════════════════════════════════════════════════════════════════════════════
SEED USER DATA - MongoDB Test Data Seeder
═══════════════════════════════════════════════════════════════════════════════

Usage:
    python scripts/seed_user_data.py <user_id>
    
Example:
    python scripts/seed_user_data.py 678abc123def456789012345

This script seeds realistic submission history for a user to test:
- Feedback Agent accuracy
- Pattern Detection Agent
- User Profile building
- RAG retrieval relevance
"""

import sys
import os
from datetime import datetime, timedelta
from bson import ObjectId

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK SUBMISSION DATA - Diverse patterns for testing
# ═══════════════════════════════════════════════════════════════════════════════

def get_mock_submissions(user_id: str) -> list:
    """
    Generate realistic submission history with deliberate patterns:
    - Off-by-one errors (recurring)
    - Edge case misses
    - TLE from O(n²) approaches
    - Some accepted submissions for contrast
    """
    
    base_time = datetime.utcnow() - timedelta(days=30)
    
    submissions = [
        # === ARRAY PROBLEMS ===
        {
            "userId": user_id,
            "questionId": "two_sum_001",
            "problemTitle": "Two Sum",
            "problemCategory": "Array",
            "status": "wrong_answer",
            "code": """def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i, len(nums)):  # BUG: should be i+1
            if nums[i] + nums[j] == target:
                return [i, j]
    return []""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "logical_error",
            "isRun": False,
            "createdAt": base_time + timedelta(days=1),
            "executionTime": 120,
            "memoryUsed": 14.5,
        },
        {
            "userId": user_id,
            "questionId": "max_subarray_002",
            "problemTitle": "Maximum Subarray",
            "problemCategory": "Array",
            "status": "wrong_answer",
            "code": """def maxSubArray(nums):
    max_sum = 0  # BUG: should be float('-inf')
    current_sum = 0
    for num in nums:
        current_sum = max(num, current_sum + num)
        max_sum = max(max_sum, current_sum)
    return max_sum""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "edge_case",
            "isRun": False,
            "createdAt": base_time + timedelta(days=3),
            "executionTime": 85,
            "memoryUsed": 12.3,
        },
        
        # === BINARY SEARCH PROBLEMS ===
        {
            "userId": user_id,
            "questionId": "binary_search_003",
            "problemTitle": "Binary Search",
            "problemCategory": "Binary Search",
            "status": "wrong_answer",
            "code": """def search(nums, target):
    left, right = 0, len(nums)  # BUG: should be len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1""",
            "language": "python",
            "verdict": "runtime_error",
            "errorType": "index_out_of_bounds",
            "isRun": False,
            "createdAt": base_time + timedelta(days=5),
            "executionTime": 0,
            "memoryUsed": 10.1,
        },
        {
            "userId": user_id,
            "questionId": "search_rotated_004",
            "problemTitle": "Search in Rotated Sorted Array",
            "problemCategory": "Binary Search",
            "status": "time_limit_exceeded",
            "code": """def search(nums, target):
    # Linear search instead of binary search
    for i in range(len(nums)):
        if nums[i] == target:
            return i
    return -1""",
            "language": "python",
            "verdict": "time_limit_exceeded",
            "errorType": "inefficient_algorithm",
            "isRun": False,
            "createdAt": base_time + timedelta(days=7),
            "executionTime": 5000,
            "memoryUsed": 11.2,
        },
        
        # === DYNAMIC PROGRAMMING ===
        {
            "userId": user_id,
            "questionId": "climbing_stairs_005",
            "problemTitle": "Climbing Stairs",
            "problemCategory": "Dynamic Programming",
            "status": "time_limit_exceeded",
            "code": """def climbStairs(n):
    # Recursive without memoization
    if n <= 2:
        return n
    return climbStairs(n-1) + climbStairs(n-2)""",
            "language": "python",
            "verdict": "time_limit_exceeded",
            "errorType": "missing_memoization",
            "isRun": False,
            "createdAt": base_time + timedelta(days=10),
            "executionTime": 10000,
            "memoryUsed": 50.5,
        },
        {
            "userId": user_id,
            "questionId": "house_robber_006",
            "problemTitle": "House Robber",
            "problemCategory": "Dynamic Programming",
            "status": "wrong_answer",
            "code": """def rob(nums):
    if not nums:
        return 0
    dp = [0] * len(nums)
    dp[0] = nums[0]
    dp[1] = nums[1]  # BUG: should be max(nums[0], nums[1])
    for i in range(2, len(nums)):
        dp[i] = max(dp[i-1], dp[i-2] + nums[i])
    return dp[-1]""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "incorrect_base_case",
            "isRun": False,
            "createdAt": base_time + timedelta(days=12),
            "executionTime": 95,
            "memoryUsed": 15.8,
        },
        
        # === GRAPH PROBLEMS ===
        {
            "userId": user_id,
            "questionId": "num_islands_007",
            "problemTitle": "Number of Islands",
            "problemCategory": "Graph",
            "status": "runtime_error",
            "code": """def numIslands(grid):
    def dfs(i, j):
        if i < 0 or j < 0 or i >= len(grid) or j >= len(grid[0]):
            return
        if grid[i][j] != '1':
            return
        grid[i][j] = '0'
        dfs(i+1, j)
        dfs(i-1, j)
        dfs(i, j+1)
        dfs(i, j-1)
    
    count = 0
    for i in range(len(grid)):
        for j in range(len(grid[0])):  # BUG: fails on empty grid
            if grid[i][j] == '1':
                dfs(i, j)
                count += 1
    return count""",
            "language": "python",
            "verdict": "runtime_error",
            "errorType": "empty_input_not_handled",
            "isRun": False,
            "createdAt": base_time + timedelta(days=15),
            "executionTime": 0,
            "memoryUsed": 8.5,
        },
        
        # === ACCEPTED SUBMISSIONS (for contrast) ===
        {
            "userId": user_id,
            "questionId": "valid_parentheses_008",
            "problemTitle": "Valid Parentheses",
            "problemCategory": "Stack",
            "status": "accepted",
            "code": """def isValid(s):
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in mapping:
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        else:
            stack.append(char)
    return len(stack) == 0""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=18),
            "executionTime": 45,
            "memoryUsed": 10.2,
        },
        {
            "userId": user_id,
            "questionId": "merge_sorted_009",
            "problemTitle": "Merge Two Sorted Lists",
            "problemCategory": "Linked List",
            "status": "accepted",
            "code": """def mergeTwoLists(l1, l2):
    dummy = ListNode(0)
    current = dummy
    while l1 and l2:
        if l1.val <= l2.val:
            current.next = l1
            l1 = l1.next
        else:
            current.next = l2
            l2 = l2.next
        current = current.next
    current.next = l1 or l2
    return dummy.next""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=20),
            "executionTime": 52,
            "memoryUsed": 11.8,
        },
        
        # === MORE OFF-BY-ONE PATTERNS ===
        {
            "userId": user_id,
            "questionId": "container_water_010",
            "problemTitle": "Container With Most Water",
            "problemCategory": "Two Pointers",
            "status": "wrong_answer",
            "code": """def maxArea(height):
    left, right = 0, len(height)  # BUG: off-by-one, should be len-1
    max_water = 0
    while left < right:
        width = right - left
        h = min(height[left], height[right])  # Will crash
        max_water = max(max_water, width * h)
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_water""",
            "language": "python",
            "verdict": "runtime_error",
            "errorType": "off_by_one",
            "isRun": False,
            "createdAt": base_time + timedelta(days=22),
            "executionTime": 0,
            "memoryUsed": 9.5,
        },
    ]
    
    return submissions


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN SEEDING FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def seed_user_submissions(user_id: str, clear_existing: bool = True):
    """Seed submission data for a user into MongoDB"""
    
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME") or os.getenv("MONGODB_DB")
    
    if not mongo_uri:
        print("❌ MONGODB_URI not set in environment")
        return False
    
    print(f"\n{'='*70}")
    print(f"🌱 SEEDING USER SUBMISSION DATA")
    print(f"{'='*70}")
    print(f"📋 User ID: {user_id}")
    print(f"🔌 MongoDB URI: {mongo_uri[:30]}...")
    print(f"📁 Database: {db_name}")
    print(f"{'='*70}\n")
    
    try:
        client = MongoClient(mongo_uri)
        db = client.get_database(db_name)
        
        # Test connection
        client.admin.command('ping')
        print("✅ MongoDB connected successfully\n")
        
        submissions_collection = db.submissions
        
        # Clear existing test submissions for this user (optional)
        if clear_existing:
            deleted = submissions_collection.delete_many({"userId": user_id})
            print(f"🗑️  Cleared {deleted.deleted_count} existing submissions for user\n")
        
        # Get mock submissions
        mock_submissions = get_mock_submissions(user_id)
        
        # Insert submissions
        print(f"📝 Inserting {len(mock_submissions)} mock submissions...\n")
        
        for i, sub in enumerate(mock_submissions, 1):
            # Convert string IDs if needed
            result = submissions_collection.insert_one(sub)
            verdict_emoji = "✅" if sub["verdict"] == "accepted" else "❌"
            print(f"   {i:2d}. [{sub['problemCategory']:15s}] {sub['problemTitle']:30s} | {verdict_emoji} {sub['verdict']:20s}")
        
        print(f"\n{'='*70}")
        print(f"✅ SEEDING COMPLETE")
        print(f"{'='*70}")
        print(f"📊 Total submissions seeded: {len(mock_submissions)}")
        print(f"   └─ Accepted: {sum(1 for s in mock_submissions if s['verdict'] == 'accepted')}")
        print(f"   └─ Wrong Answer: {sum(1 for s in mock_submissions if s['verdict'] == 'wrong_answer')}")
        print(f"   └─ TLE: {sum(1 for s in mock_submissions if s['verdict'] == 'time_limit_exceeded')}")
        print(f"   └─ Runtime Error: {sum(1 for s in mock_submissions if s['verdict'] == 'runtime_error')}")
        print(f"\n🎯 Deliberate patterns seeded:")
        print(f"   └─ Off-by-one errors (3 occurrences)")
        print(f"   └─ Edge case misses (2 occurrences)")
        print(f"   └─ Missing memoization (1 occurrence)")
        print(f"   └─ Inefficient algorithms (2 occurrences)")
        print(f"{'='*70}\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error seeding data: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Usage: python scripts/seed_user_data.py <user_id>")
        print("   Example: python scripts/seed_user_data.py 678abc123def456789012345")
        sys.exit(1)
    
    user_id = sys.argv[1]
    success = seed_user_submissions(user_id)
    sys.exit(0 if success else 1)
