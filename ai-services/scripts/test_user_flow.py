"""
═══════════════════════════════════════════════════════════════════════════════
TEST USER FLOW - Complete E2E Testing Runner
═══════════════════════════════════════════════════════════════════════════════

Usage:
    python scripts/test_user_flow.py <user_id>
    
Example:
    python scripts/test_user_flow.py 678abc123def456789012345

This script:
1. Seeds mock submissions into MongoDB for the given user
2. Seeds historical mistakes into RAG (ChromaDB) 
3. Outputs instructions to trigger a test submission from frontend
4. Logs will show full pipeline execution with verbose context

The data is NOT cleaned up - it persists for debugging and analysis.
"""

import sys
import os
import time
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


def create_test_log_dir():
    """Create directory for test logs"""
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_logs")
    os.makedirs(log_dir, exist_ok=True)
    return log_dir


def run_full_test_setup(user_id: str):
    """Run complete test setup for a user"""
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = create_test_log_dir()
    log_file = os.path.join(log_dir, f"test_{user_id[:8]}_{timestamp}.json")
    
    test_results = {
        "user_id": user_id,
        "timestamp": timestamp,
        "mongodb_seeding": None,
        "rag_seeding": None,
        "instructions": None,
    }
    
    print(f"\n{'═'*80}")
    print(f"🧪 E2E TEST SETUP - AI SERVICES")
    print(f"{'═'*80}")
    print(f"📋 User ID: {user_id}")
    print(f"🕐 Timestamp: {timestamp}")
    print(f"📁 Log file: {log_file}")
    print(f"{'═'*80}\n")
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Seed MongoDB Submissions
    # ─────────────────────────────────────────────────────────────────────────
    print(f"{'─'*80}")
    print(f"STEP 1: Seeding MongoDB Submissions")
    print(f"{'─'*80}\n")
    
    try:
        from scripts.seed_user_data import seed_user_submissions
        mongodb_success = seed_user_submissions(user_id, clear_existing=True)
        test_results["mongodb_seeding"] = {
            "success": mongodb_success,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"❌ MongoDB seeding failed: {e}")
        test_results["mongodb_seeding"] = {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Seed RAG Memory
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n{'─'*80}")
    print(f"STEP 2: Seeding RAG Memory (ChromaDB)")
    print(f"{'─'*80}\n")
    
    try:
        from scripts.seed_user_memory import seed_user_memory
        rag_success = seed_user_memory(user_id)
        test_results["rag_seeding"] = {
            "success": rag_success,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"❌ RAG seeding failed: {e}")
        test_results["rag_seeding"] = {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
    
    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Print Testing Instructions
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n{'═'*80}")
    print(f"✅ TEST DATA SEEDED SUCCESSFULLY")
    print(f"{'═'*80}")
    
    instructions = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  NEXT STEPS - How to Test the AI Services Pipeline                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  1. ENSURE AI-SERVICES IS RUNNING:                                          ║
║     cd ai-services                                                           ║
║     uvicorn app.main:app --reload                                            ║
║                                                                              ║
║  2. LOG INTO FRONTEND with the test user (user_id: {user_id[:20]}...)    ║
║                                                                              ║
║  3. SUBMIT CODE to any problem with a WRONG answer or TLE                    ║
║     For best test results, submit code for:                                  ║
║     • Array problems (to trigger off-by-one pattern detection)               ║
║     • DP problems (to trigger memoization pattern detection)                 ║
║     • Binary Search (to trigger boundary error detection)                    ║
║                                                                              ║
║  4. WATCH THE AI-SERVICES TERMINAL for verbose logs showing:                 ║
║     • RAG memory retrieval results                                           ║
║     • User profile built from history                                        ║
║     • Full context assembled for LLM                                         ║
║     • LLM prompts and responses                                              ║
║     • Agent outputs (feedback, patterns, hints)                              ║
║                                                                              ║
║  5. Expected Behavior:                                                       ║
║     • RAG should retrieve past mistakes matching the problem category        ║
║     • User profile should show "off-by-one" as a recurring mistake           ║
║     • Feedback should reference the user's historical patterns               ║
║     • Hints should be personalized based on weak topics                      ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  SEEDED DATA SUMMARY                                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  MongoDB Submissions:                                                        ║
║    • 10 submissions (6 wrong, 2 TLE, 2 accepted)                            ║
║    • Categories: Array, Binary Search, DP, Graph, Stack, Linked List        ║
║    • Deliberate patterns: off-by-one, edge case misses, missing memo         ║
║                                                                              ║
║  RAG Memory (Historical Mistakes):                                           ║
║    • 11 mistake patterns stored in ChromaDB                                  ║
║    • Categories: Array, Binary Search, DP, Tree, Matrix, Graph               ║
║    • Patterns: off-by-one (3x), edge case (2x), boundary (2x), algo (2x)    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
    
    print(instructions)
    test_results["instructions"] = instructions
    
    # ─────────────────────────────────────────────────────────────────────────
    # Save test results to JSON file
    # ─────────────────────────────────────────────────────────────────────────
    try:
        with open(log_file, 'w') as f:
            json.dump(test_results, f, indent=2, default=str)
        print(f"\n📝 Test setup log saved to: {log_file}\n")
    except Exception as e:
        print(f"\n⚠️  Could not save log file: {e}\n")
    
    return test_results


def test_api_directly(user_id: str):
    """
    Optionally test the API directly without frontend.
    Sends a test submission to /ai/feedback endpoint.
    """
    import requests
    
    print(f"\n{'═'*80}")
    print(f"🔬 DIRECT API TEST")
    print(f"{'═'*80}\n")
    
    # Test payload - simulates a wrong answer submission
    test_payload = {
        "user_id": user_id,
        "problem_id": "test_two_sum_direct",
        "problem_category": "Array",
        "constraints": "2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9",
        "code": """def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i, len(nums)):  # BUG: off-by-one, should be i+1
            if nums[i] + nums[j] == target:
                return [i, j]
    return []""",
        "language": "python",
        "verdict": "wrong_answer",
        "error_type": "logical_error"
    }
    
    print(f"📤 Sending test submission to AI service...")
    print(f"   └─ User ID: {user_id}")
    print(f"   └─ Problem: {test_payload['problem_id']}")
    print(f"   └─ Category: {test_payload['problem_category']}")
    print(f"   └─ Verdict: {test_payload['verdict']}")
    
    try:
        # Try localhost first
        url = "http://localhost:8000/ai/feedback"
        response = requests.post(url, json=test_payload, timeout=120)
        
        print(f"\n{'─'*80}")
        print(f"📥 API RESPONSE")
        print(f"{'─'*80}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Success: {result.get('success')}")
            print(f"📝 Verdict: {result.get('verdict')}")
            print(f"🔍 Detected Pattern: {result.get('detected_pattern')}")
            print(f"\n📌 Hints:")
            for hint in result.get('hints', []):
                print(f"   Level {hint.get('level')}: {hint.get('content')}")
            print(f"\n📖 Explanation: {result.get('explanation')}")
            
            if result.get('mim_insights'):
                mim = result['mim_insights']
                print(f"\n🧠 MIM Insights:")
                if mim.get('root_cause'):
                    print(f"   └─ Root Cause: {mim['root_cause'].get('failure_cause')} ({mim['root_cause'].get('confidence', 0):.0%} confidence)")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"\n⚠️  Could not connect to AI service at {url}")
        print(f"   Make sure the service is running: uvicorn app.main:app --reload")
    except Exception as e:
        print(f"\n❌ API test failed: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Usage: python scripts/test_user_flow.py <user_id> [--api-test]")
        print("   Example: python scripts/test_user_flow.py 678abc123def456789012345")
        print("   Options:")
        print("     --api-test    Also run direct API test after seeding")
        sys.exit(1)
    
    user_id = sys.argv[1]
    run_api_test = "--api-test" in sys.argv
    
    # Run setup
    results = run_full_test_setup(user_id)
    
    # Optionally run direct API test
    if run_api_test:
        test_api_directly(user_id)
    
    sys.exit(0 if results["mongodb_seeding"]["success"] and results["rag_seeding"]["success"] else 1)
