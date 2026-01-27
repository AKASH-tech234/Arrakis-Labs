"""
Additional Submissions Seeder - 30 more diverse submissions
"""

import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()


def get_additional_submissions(user_id: str) -> list:
    """Generate 30 more diverse submissions."""
    
    base_time = datetime.utcnow() - timedelta(days=60)  # Older submissions
    
    submissions = [
        # Trees - accepted
        {
            "userId": user_id,
            "questionId": "max_depth_tree_011",
            "problemTitle": "Maximum Depth of Binary Tree",
            "problemCategory": "Trees",
            "status": "accepted",
            "code": """def maxDepth(root):
    if not root:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=1),
            "executionTime": 40,
            "memoryUsed": 15.2,
        },
        # Strings - wrong answer
        {
            "userId": user_id,
            "questionId": "longest_substr_012",
            "problemTitle": "Longest Substring Without Repeating Characters",
            "problemCategory": "Strings",
            "status": "wrong_answer",
            "code": """def lengthOfLongestSubstring(s):
    seen = {}
    max_len = 0
    start = 0
    for i, c in enumerate(s):
        if c in seen:
            start = seen[c] + 1  # BUG: should be max(start, seen[c] + 1)
        seen[c] = i
        max_len = max(max_len, i - start + 1)
    return max_len""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "state_management",
            "isRun": False,
            "createdAt": base_time + timedelta(days=2),
            "executionTime": 100,
            "memoryUsed": 14.5,
        },
        # Heap - accepted
        {
            "userId": user_id,
            "questionId": "top_k_013",
            "problemTitle": "Top K Frequent Elements",
            "problemCategory": "Heap",
            "status": "accepted",
            "code": """def topKFrequent(nums, k):
    from collections import Counter
    import heapq
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=3),
            "executionTime": 65,
            "memoryUsed": 18.3,
        },
        # Backtracking - wrong answer
        {
            "userId": user_id,
            "questionId": "subsets_014",
            "problemTitle": "Subsets",
            "problemCategory": "Backtracking",
            "status": "wrong_answer",
            "code": """def subsets(nums):
    result = []
    def backtrack(start, path):
        result.append(path)  # BUG: should be path[:]
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()
    backtrack(0, [])
    return result""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "reference_vs_copy",
            "isRun": False,
            "createdAt": base_time + timedelta(days=4),
            "executionTime": 55,
            "memoryUsed": 13.0,
        },
        # Greedy - accepted
        {
            "userId": user_id,
            "questionId": "best_time_015",
            "problemTitle": "Best Time to Buy and Sell Stock",
            "problemCategory": "Greedy",
            "status": "accepted",
            "code": """def maxProfit(prices):
    min_price = float('inf')
    max_profit = 0
    for price in prices:
        min_price = min(min_price, price)
        max_profit = max(max_profit, price - min_price)
    return max_profit""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=5),
            "executionTime": 48,
            "memoryUsed": 12.1,
        },
        # DP - TLE
        {
            "userId": user_id,
            "questionId": "coin_change_016",
            "problemTitle": "Coin Change",
            "problemCategory": "Dynamic Programming",
            "status": "time_limit_exceeded",
            "code": """def coinChange(coins, amount):
    if amount == 0:
        return 0
    if amount < 0:
        return -1
    min_coins = float('inf')
    for coin in coins:
        result = coinChange(coins, amount - coin)
        if result >= 0:
            min_coins = min(min_coins, result + 1)
    return min_coins if min_coins != float('inf') else -1""",
            "language": "python",
            "verdict": "time_limit_exceeded",
            "errorType": "missing_memoization",
            "isRun": False,
            "createdAt": base_time + timedelta(days=6),
            "executionTime": 10000,
            "memoryUsed": 256.0,
        },
        # Graph - accepted
        {
            "userId": user_id,
            "questionId": "course_schedule_017",
            "problemTitle": "Course Schedule",
            "problemCategory": "Graph",
            "status": "accepted",
            "code": """def canFinish(numCourses, prerequisites):
    from collections import defaultdict, deque
    graph = defaultdict(list)
    in_degree = [0] * numCourses
    for course, prereq in prerequisites:
        graph[prereq].append(course)
        in_degree[course] += 1
    queue = deque([i for i in range(numCourses) if in_degree[i] == 0])
    count = 0
    while queue:
        course = queue.popleft()
        count += 1
        for next_course in graph[course]:
            in_degree[next_course] -= 1
            if in_degree[next_course] == 0:
                queue.append(next_course)
    return count == numCourses""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=7),
            "executionTime": 88,
            "memoryUsed": 19.5,
        },
        # Linked List - wrong answer
        {
            "userId": user_id,
            "questionId": "reverse_ll_018",
            "problemTitle": "Reverse Linked List",
            "problemCategory": "Linked List",
            "status": "wrong_answer",
            "code": """def reverseList(head):
    prev = None
    curr = head
    while curr:
        curr.next = prev  # BUG: lost reference to next node
        prev = curr
        curr = curr.next
    return prev""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "state_loss",
            "isRun": False,
            "createdAt": base_time + timedelta(days=8),
            "executionTime": 30,
            "memoryUsed": 10.5,
        },
        # Sliding Window - accepted
        {
            "userId": user_id,
            "questionId": "max_avg_019",
            "problemTitle": "Maximum Average Subarray I",
            "problemCategory": "Sliding Window",
            "status": "accepted",
            "code": """def findMaxAverage(nums, k):
    window_sum = sum(nums[:k])
    max_sum = window_sum
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum / k""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=9),
            "executionTime": 72,
            "memoryUsed": 17.8,
        },
        # Math - wrong answer
        {
            "userId": user_id,
            "questionId": "pow_x_n_020",
            "problemTitle": "Pow(x, n)",
            "problemCategory": "Math",
            "status": "wrong_answer",
            "code": """def myPow(x, n):
    result = 1
    for _ in range(n):
        result *= x
    return result""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "edge_case",
            "isRun": False,
            "createdAt": base_time + timedelta(days=10),
            "executionTime": 50,
            "memoryUsed": 10.0,
        },
        # Binary Search - accepted
        {
            "userId": user_id,
            "questionId": "first_bad_021",
            "problemTitle": "First Bad Version",
            "problemCategory": "Binary Search",
            "status": "accepted",
            "code": """def firstBadVersion(n):
    left, right = 1, n
    while left < right:
        mid = left + (right - left) // 2
        if isBadVersion(mid):
            right = mid
        else:
            left = mid + 1
    return left""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=11),
            "executionTime": 25,
            "memoryUsed": 9.5,
        },
        # Trees - wrong answer
        {
            "userId": user_id,
            "questionId": "validate_bst_022",
            "problemTitle": "Validate Binary Search Tree",
            "problemCategory": "Trees",
            "status": "wrong_answer",
            "code": """def isValidBST(root):
    def validate(node):
        if not node:
            return True
        if node.left and node.left.val >= node.val:
            return False
        if node.right and node.right.val <= node.val:
            return False
        return validate(node.left) and validate(node.right)
    return validate(root)""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "incorrect_validation",
            "isRun": False,
            "createdAt": base_time + timedelta(days=12),
            "executionTime": 45,
            "memoryUsed": 14.0,
        },
        # Hash Table - accepted
        {
            "userId": user_id,
            "questionId": "group_anagrams_023",
            "problemTitle": "Group Anagrams",
            "problemCategory": "Hash Table",
            "status": "accepted",
            "code": """def groupAnagrams(strs):
    from collections import defaultdict
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))
        groups[key].append(s)
    return list(groups.values())""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=13),
            "executionTime": 68,
            "memoryUsed": 16.5,
        },
        # Recursion - runtime error
        {
            "userId": user_id,
            "questionId": "flatten_tree_024",
            "problemTitle": "Flatten Binary Tree to Linked List",
            "problemCategory": "Trees",
            "status": "runtime_error",
            "code": """def flatten(root):
    flatten(root.left)
    flatten(root.right)
    root.right = root.left
    root.left = None""",
            "language": "python",
            "verdict": "runtime_error",
            "errorType": "missing_base_case",
            "isRun": False,
            "createdAt": base_time + timedelta(days=14),
            "executionTime": 0,
            "memoryUsed": 512.0,
        },
        # Stack - accepted
        {
            "userId": user_id,
            "questionId": "daily_temp_025",
            "problemTitle": "Daily Temperatures",
            "problemCategory": "Stack",
            "status": "accepted",
            "code": """def dailyTemperatures(T):
    result = [0] * len(T)
    stack = []
    for i, temp in enumerate(T):
        while stack and T[stack[-1]] < temp:
            prev_idx = stack.pop()
            result[prev_idx] = i - prev_idx
        stack.append(i)
    return result""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=15),
            "executionTime": 95,
            "memoryUsed": 20.3,
        },
        # DP - accepted
        {
            "userId": user_id,
            "questionId": "unique_paths_026",
            "problemTitle": "Unique Paths",
            "problemCategory": "Dynamic Programming",
            "status": "accepted",
            "code": """def uniquePaths(m, n):
    dp = [[1] * n for _ in range(m)]
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = dp[i-1][j] + dp[i][j-1]
    return dp[m-1][n-1]""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=16),
            "executionTime": 35,
            "memoryUsed": 13.2,
        },
        # Array - TLE
        {
            "userId": user_id,
            "questionId": "3sum_027",
            "problemTitle": "3Sum",
            "problemCategory": "Array",
            "status": "time_limit_exceeded",
            "code": """def threeSum(nums):
    result = []
    for i in range(len(nums)):
        for j in range(i+1, len(nums)):
            for k in range(j+1, len(nums)):
                if nums[i] + nums[j] + nums[k] == 0:
                    triplet = sorted([nums[i], nums[j], nums[k]])
                    if triplet not in result:
                        result.append(triplet)
    return result""",
            "language": "python",
            "verdict": "time_limit_exceeded",
            "errorType": "inefficient_algorithm",
            "isRun": False,
            "createdAt": base_time + timedelta(days=17),
            "executionTime": 10000,
            "memoryUsed": 25.0,
        },
        # Trie - accepted
        {
            "userId": user_id,
            "questionId": "implement_trie_028",
            "problemTitle": "Implement Trie",
            "problemCategory": "Trie",
            "status": "accepted",
            "code": """class Trie:
    def __init__(self):
        self.children = {}
        self.is_end = False
    def insert(self, word):
        node = self
        for c in word:
            if c not in node.children:
                node.children[c] = Trie()
            node = node.children[c]
        node.is_end = True""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=18),
            "executionTime": 110,
            "memoryUsed": 28.5,
        },
        # Bit Manipulation - wrong answer
        {
            "userId": user_id,
            "questionId": "single_number_029",
            "problemTitle": "Single Number",
            "problemCategory": "Bit Manipulation",
            "status": "wrong_answer",
            "code": """def singleNumber(nums):
    result = 0
    for num in nums:
        result = result | num  # BUG: should be XOR (^)
    return result""",
            "language": "python",
            "verdict": "wrong_answer",
            "errorType": "wrong_operator",
            "isRun": False,
            "createdAt": base_time + timedelta(days=19),
            "executionTime": 40,
            "memoryUsed": 11.0,
        },
        # Matrix - accepted
        {
            "userId": user_id,
            "questionId": "spiral_matrix_030",
            "problemTitle": "Spiral Matrix",
            "problemCategory": "Matrix",
            "status": "accepted",
            "code": """def spiralOrder(matrix):
    result = []
    while matrix:
        result += matrix.pop(0)
        matrix = list(zip(*matrix))[::-1]
    return result""",
            "language": "python",
            "verdict": "accepted",
            "errorType": None,
            "isRun": False,
            "createdAt": base_time + timedelta(days=20),
            "executionTime": 30,
            "memoryUsed": 12.8,
        },
    ]
    
    return submissions


def seed_additional_submissions(user_id: str):
    """Seed additional submissions for a user into MongoDB (APPEND mode)"""
    
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME") or os.getenv("MONGODB_DB")
    
    if not mongo_uri:
        print("❌ MONGODB_URI not set in environment")
        return False
    
    print(f"\n{'='*70}")
    print(f"🌱 SEEDING ADDITIONAL USER SUBMISSIONS (APPEND MODE)")
    print(f"{'='*70}")
    print(f"📋 User ID: {user_id}")
    print(f"{'='*70}\n")
    
    try:
        client = MongoClient(mongo_uri)
        db = client.get_database(db_name)
        
        # Test connection
        client.admin.command('ping')
        print("✅ MongoDB connected successfully\n")
        
        submissions_collection = db.submissions
        
        # Get additional submissions
        additional_submissions = get_additional_submissions(user_id)
        
        # Insert submissions
        print(f"📝 Inserting {len(additional_submissions)} additional submissions...\n")
        
        for i, sub in enumerate(additional_submissions, 1):
            result = submissions_collection.insert_one(sub)
            verdict_emoji = "✅" if sub["verdict"] == "accepted" else "❌"
            print(f"   {i:2d}. [{sub['problemCategory']:15s}] {sub['problemTitle']:35s} | {verdict_emoji} {sub['verdict']:20s}")
        
        # Also seed to vector store
        print(f"\n🗃️  Seeding to Pinecone...")
        seed_vector_store(user_id, additional_submissions)
        
        print(f"\n{'='*70}")
        print(f"✅ ADDITIONAL SEEDING COMPLETE: {len(additional_submissions)} submissions added")
        print(f"{'='*70}\n")
        
        # Get final counts
        count = submissions_collection.count_documents({"userId": user_id, "isRun": False})
        print(f"📊 TOTAL submissions for user: {count}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error seeding data: {e}")
        import traceback
        traceback.print_exc()
        return False


def seed_vector_store(user_id: str, submissions: list):
    """Store failed submissions in Pinecone."""
    try:
        from app.rag.vector_store import PineconeVectorStore
        from app.rag.embeddings import get_embeddings
        import hashlib
        
        vector_store = PineconeVectorStore(namespace="user_memory")
        vector_store._ensure_initialized()
        embeddings = get_embeddings()
        
        stored = 0
        failed_subs = [s for s in submissions if s.get("verdict") != "accepted"]
        
        for sub in failed_subs:
            try:
                text = f"""Problem: {sub.get('problemTitle', 'Unknown')}
Category: {sub.get('problemCategory', 'General')}
Verdict: {sub.get('verdict', 'unknown')}
Error Type: {sub.get('errorType', 'unknown')}
Code: {sub.get('code', '')[:300]}"""
                
                embedding = embeddings.embed_query(text)
                ts_str = sub.get('createdAt', datetime.utcnow()).isoformat()
                doc_id = hashlib.md5(f"{user_id}_{sub.get('questionId', '')}_{ts_str}".encode()).hexdigest()
                
                vector_store._index.upsert(
                    vectors=[{
                        "id": doc_id,
                        "values": embedding,
                        "metadata": {
                            "user_id": user_id,
                            "problem_id": sub.get("questionId", ""),
                            "problem_title": sub.get("problemTitle", ""),
                            "category": sub.get("problemCategory", "General"),
                            "verdict": sub.get("verdict", ""),
                            "error_type": sub.get("errorType", "unknown"),
                            "text": text,
                            "timestamp": ts_str,
                        }
                    }],
                    namespace="user_memory"
                )
                stored += 1
            except Exception as e:
                print(f"   ❌ Error: {e}")
        
        print(f"   ✅ Stored {stored} vectors in Pinecone")
        return stored
    except Exception as e:
        print(f"❌ Vector store error: {e}")
        return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_additional.py <user_id>")
        sys.exit(1)
    
    user_id = sys.argv[1]
    seed_additional_submissions(user_id)
