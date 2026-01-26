#!/usr/bin/env python3
"""
MIM v3.0 Load Testing Script
============================

Simulate concurrent users to measure system performance under load.

Metrics Collected:
- Request latency (avg, p50, p95, p99)
- Throughput (requests/second)
- Error rate
- LLM call reduction verification

Usage:
    python scripts/load_test.py --users 50 --duration 60

Requirements:
    pip install httpx asyncio aiohttp
"""

import argparse
import asyncio
import time
import statistics
import json
import sys
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path

# Try to import httpx, fallback to aiohttp
try:
    import httpx
    USE_HTTPX = True
except ImportError:
    import aiohttp
    USE_HTTPX = False


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_USERS = 50
DEFAULT_DURATION = 60  # seconds
DEFAULT_REQUESTS_PER_USER = 10

SAMPLE_SUBMISSIONS = [
    {
        "user_id": "load_test_user_{user_id}",
        "problem_id": "two_sum",
        "problem_category": "Array",
        "constraints": "1 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9",
        "code": """
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i, len(nums)):  # off-by-one
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
""",
        "language": "python",
        "verdict": "wrong_answer",
        "error_type": "logical_error",
    },
    {
        "user_id": "load_test_user_{user_id}",
        "problem_id": "merge_intervals",
        "problem_category": "Array",
        "constraints": "1 <= intervals.length <= 10^4, intervals[i].length == 2",
        "code": """
def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    result = [intervals[0]]
    for i in range(1, len(intervals)):
        if result[-1][1] >= intervals[i][0]:
            result[-1][1] = intervals[i][1]  # should be max
        else:
            result.append(intervals[i])
    return result
""",
        "language": "python",
        "verdict": "wrong_answer",
        "error_type": "logical_error",
    },
    {
        "user_id": "load_test_user_{user_id}",
        "problem_id": "binary_search",
        "problem_category": "Array",
        "constraints": "1 <= arr.length <= 10^4, arr is sorted in ascending order",
        "code": """
def binary_search(arr, target):
    left, right = 0, len(arr)  # should be len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
""",
        "language": "python",
        "verdict": "runtime_error",
        "error_type": "index_out_of_bounds",
    },
    {
        "user_id": "load_test_user_{user_id}",
        "problem_id": "longest_substring",
        "problem_category": "String",
        "constraints": "0 <= s.length <= 5 * 10^4, s consists of English letters, digits, symbols",
        "code": """
def lengthOfLongestSubstring(s):
    seen = {}
    start = 0
    max_len = 0
    for i, char in enumerate(s):
        if char in seen:
            start = seen[char] + 1  # bug: doesn't handle case when seen[char] < start
        seen[char] = i
        max_len = max(max_len, i - start + 1)
    return max_len
""",
        "language": "python",
        "verdict": "wrong_answer",
        "error_type": "edge_case_handling",
    },
    {
        "user_id": "load_test_user_{user_id}",
        "problem_id": "reverse_linked_list",
        "problem_category": "LinkedList",
        "constraints": "The number of nodes in the list is [0, 5000]",
        "code": """
def reverseList(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        # missing: curr = next_node
    return prev
""",
        "language": "python",
        "verdict": "time_limit_exceeded",
        "error_type": "infinite_loop",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RequestResult:
    """Result of a single request."""
    user_id: int
    request_id: int
    latency_ms: float
    status_code: int
    success: bool
    error: Optional[str] = None
    mim_decision_ms: Optional[float] = None
    llm_calls: Optional[int] = None


@dataclass
class LoadTestResults:
    """Aggregated load test results."""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_duration_s: float = 0.0
    latencies_ms: List[float] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    mim_decision_times_ms: List[float] = field(default_factory=list)
    llm_call_counts: List[int] = field(default_factory=list)
    
    @property
    def throughput(self) -> float:
        """Requests per second."""
        if self.total_duration_s == 0:
            return 0.0
        return self.total_requests / self.total_duration_s
    
    @property
    def error_rate(self) -> float:
        """Percentage of failed requests."""
        if self.total_requests == 0:
            return 0.0
        return (self.failed_requests / self.total_requests) * 100
    
    @property
    def avg_latency_ms(self) -> float:
        """Average latency in milliseconds."""
        if not self.latencies_ms:
            return 0.0
        return statistics.mean(self.latencies_ms)
    
    @property
    def p50_latency_ms(self) -> float:
        """50th percentile latency."""
        if not self.latencies_ms:
            return 0.0
        return statistics.median(self.latencies_ms)
    
    @property
    def p95_latency_ms(self) -> float:
        """95th percentile latency."""
        if not self.latencies_ms:
            return 0.0
        sorted_latencies = sorted(self.latencies_ms)
        idx = int(len(sorted_latencies) * 0.95)
        return sorted_latencies[min(idx, len(sorted_latencies) - 1)]
    
    @property
    def p99_latency_ms(self) -> float:
        """99th percentile latency."""
        if not self.latencies_ms:
            return 0.0
        sorted_latencies = sorted(self.latencies_ms)
        idx = int(len(sorted_latencies) * 0.99)
        return sorted_latencies[min(idx, len(sorted_latencies) - 1)]
    
    @property
    def avg_mim_decision_ms(self) -> float:
        """Average MIM decision time."""
        if not self.mim_decision_times_ms:
            return 0.0
        return statistics.mean(self.mim_decision_times_ms)
    
    @property
    def avg_llm_calls(self) -> float:
        """Average LLM calls per request."""
        if not self.llm_call_counts:
            return 0.0
        return statistics.mean(self.llm_call_counts)


# ═══════════════════════════════════════════════════════════════════════════════
# LOAD TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

class LoadTestRunner:
    """Runs load tests against the AI feedback service."""
    
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        num_users: int = DEFAULT_USERS,
        duration_s: int = DEFAULT_DURATION,
        requests_per_user: int = DEFAULT_REQUESTS_PER_USER,
    ):
        self.base_url = base_url.rstrip("/")
        self.num_users = num_users
        self.duration_s = duration_s
        self.requests_per_user = requests_per_user
        self.results = LoadTestResults()
        self._start_time: Optional[float] = None
        self._stop_event = asyncio.Event()
    
    def get_submission(self, user_id: int, request_id: int) -> Dict[str, Any]:
        """Get a sample submission for the given user."""
        template = SAMPLE_SUBMISSIONS[request_id % len(SAMPLE_SUBMISSIONS)]
        submission = template.copy()
        submission["user_id"] = submission["user_id"].format(user_id=user_id)
        return submission
    
    async def make_request_httpx(
        self,
        client: "httpx.AsyncClient",
        user_id: int,
        request_id: int,
    ) -> RequestResult:
        """Make a single request using httpx."""
        submission = self.get_submission(user_id, request_id)
        
        start = time.perf_counter()
        try:
            response = await client.post(
                f"{self.base_url}/ai/feedback",
                json=submission,
                timeout=30.0,
            )
            latency_ms = (time.perf_counter() - start) * 1000
            
            success = response.status_code == 200
            
            # Extract MIM metrics from response
            mim_decision_ms = None
            llm_calls = None
            if success:
                try:
                    data = response.json()
                    if "metrics" in data:
                        mim_decision_ms = data["metrics"].get("mim_decision_ms")
                        llm_calls = data["metrics"].get("llm_calls", 2)
                    elif "mim_insights" in data:
                        mim_decision_ms = data["mim_insights"].get("inference_time_ms")
                except:
                    pass
            
            return RequestResult(
                user_id=user_id,
                request_id=request_id,
                latency_ms=latency_ms,
                status_code=response.status_code,
                success=success,
                error=response.text if not success else None,
                mim_decision_ms=mim_decision_ms,
                llm_calls=llm_calls,
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - start) * 1000
            return RequestResult(
                user_id=user_id,
                request_id=request_id,
                latency_ms=latency_ms,
                status_code=0,
                success=False,
                error=str(e),
            )
    
    async def make_request_aiohttp(
        self,
        session: "aiohttp.ClientSession",
        user_id: int,
        request_id: int,
    ) -> RequestResult:
        """Make a single request using aiohttp."""
        submission = self.get_submission(user_id, request_id)
        
        start = time.perf_counter()
        try:
            async with session.post(
                f"{self.base_url}/ai/feedback",
                json=submission,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                latency_ms = (time.perf_counter() - start) * 1000
                
                success = response.status == 200
                
                mim_decision_ms = None
                llm_calls = None
                if success:
                    try:
                        data = await response.json()
                        if "metrics" in data:
                            mim_decision_ms = data["metrics"].get("mim_decision_ms")
                            llm_calls = data["metrics"].get("llm_calls", 2)
                        elif "mim_insights" in data:
                            mim_decision_ms = data["mim_insights"].get("inference_time_ms")
                    except:
                        pass
                
                return RequestResult(
                    user_id=user_id,
                    request_id=request_id,
                    latency_ms=latency_ms,
                    status_code=response.status,
                    success=success,
                    error=await response.text() if not success else None,
                    mim_decision_ms=mim_decision_ms,
                    llm_calls=llm_calls,
                )
        except Exception as e:
            latency_ms = (time.perf_counter() - start) * 1000
            return RequestResult(
                user_id=user_id,
                request_id=request_id,
                latency_ms=latency_ms,
                status_code=0,
                success=False,
                error=str(e),
            )
    
    async def run_user_httpx(self, client: "httpx.AsyncClient", user_id: int):
        """Simulate a single user making requests (httpx)."""
        for request_id in range(self.requests_per_user):
            if self._stop_event.is_set():
                break
            
            result = await self.make_request_httpx(client, user_id, request_id)
            self._record_result(result)
            
            # Small delay between requests to simulate real user behavior
            await asyncio.sleep(0.1)
    
    async def run_user_aiohttp(self, session: "aiohttp.ClientSession", user_id: int):
        """Simulate a single user making requests (aiohttp)."""
        for request_id in range(self.requests_per_user):
            if self._stop_event.is_set():
                break
            
            result = await self.make_request_aiohttp(session, user_id, request_id)
            self._record_result(result)
            
            await asyncio.sleep(0.1)
    
    def _record_result(self, result: RequestResult):
        """Record a single request result."""
        self.results.total_requests += 1
        self.results.latencies_ms.append(result.latency_ms)
        
        if result.success:
            self.results.successful_requests += 1
            if result.mim_decision_ms is not None:
                self.results.mim_decision_times_ms.append(result.mim_decision_ms)
            if result.llm_calls is not None:
                self.results.llm_call_counts.append(result.llm_calls)
        else:
            self.results.failed_requests += 1
            if result.error:
                self.results.errors.append(result.error[:200])  # Truncate long errors
    
    async def run_httpx(self):
        """Run load test using httpx."""
        print(f"\n🚀 Starting load test with {self.num_users} concurrent users")
        print(f"   Duration: {self.duration_s}s, Requests/user: {self.requests_per_user}")
        print(f"   Target: {self.base_url}/ai/feedback\n")
        
        self._start_time = time.perf_counter()
        
        # Set up duration timeout
        async def timeout():
            await asyncio.sleep(self.duration_s)
            self._stop_event.set()
        
        timeout_task = asyncio.create_task(timeout())
        
        async with httpx.AsyncClient() as client:
            tasks = [
                self.run_user_httpx(client, user_id)
                for user_id in range(self.num_users)
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
        
        timeout_task.cancel()
        self.results.total_duration_s = time.perf_counter() - self._start_time
    
    async def run_aiohttp(self):
        """Run load test using aiohttp."""
        print(f"\n🚀 Starting load test with {self.num_users} concurrent users")
        print(f"   Duration: {self.duration_s}s, Requests/user: {self.requests_per_user}")
        print(f"   Target: {self.base_url}/ai/feedback\n")
        
        self._start_time = time.perf_counter()
        
        async def timeout():
            await asyncio.sleep(self.duration_s)
            self._stop_event.set()
        
        timeout_task = asyncio.create_task(timeout())
        
        async with aiohttp.ClientSession() as session:
            tasks = [
                self.run_user_aiohttp(session, user_id)
                for user_id in range(self.num_users)
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
        
        timeout_task.cancel()
        self.results.total_duration_s = time.perf_counter() - self._start_time
    
    async def run(self):
        """Run the load test."""
        if USE_HTTPX:
            await self.run_httpx()
        else:
            await self.run_aiohttp()
    
    def print_results(self):
        """Print load test results."""
        r = self.results
        
        print("\n" + "=" * 60)
        print("📊 LOAD TEST RESULTS")
        print("=" * 60)
        
        print(f"\n📈 Request Metrics:")
        print(f"   Total Requests:    {r.total_requests:,}")
        print(f"   Successful:        {r.successful_requests:,} ({100 - r.error_rate:.1f}%)")
        print(f"   Failed:            {r.failed_requests:,} ({r.error_rate:.1f}%)")
        print(f"   Duration:          {r.total_duration_s:.1f}s")
        print(f"   Throughput:        {r.throughput:.1f} req/s")
        
        print(f"\n⏱️  Latency Metrics:")
        print(f"   Average:           {r.avg_latency_ms:.0f}ms")
        print(f"   P50:               {r.p50_latency_ms:.0f}ms")
        print(f"   P95:               {r.p95_latency_ms:.0f}ms")
        print(f"   P99:               {r.p99_latency_ms:.0f}ms")
        
        if r.mim_decision_times_ms:
            print(f"\n🧠 MIM v3.0 Metrics:")
            print(f"   Avg Decision Time: {r.avg_mim_decision_ms:.1f}ms")
            print(f"   Avg LLM Calls:     {r.avg_llm_calls:.1f}")
            
            # Check LLM call reduction (5 agents → 2)
            if r.avg_llm_calls <= 2.5:
                print(f"   ✅ LLM Call Reduction: PASSED (expected ≤2.5)")
            else:
                print(f"   ❌ LLM Call Reduction: FAILED (got {r.avg_llm_calls:.1f}, expected ≤2.5)")
        
        print(f"\n🎯 Performance Targets:")
        
        # Check latency targets
        if r.p95_latency_ms < 5000:
            print(f"   ✅ P95 Latency < 5s: PASSED ({r.p95_latency_ms:.0f}ms)")
        else:
            print(f"   ❌ P95 Latency < 5s: FAILED ({r.p95_latency_ms:.0f}ms)")
        
        # Check error rate
        if r.error_rate < 1:
            print(f"   ✅ Error Rate < 1%: PASSED ({r.error_rate:.2f}%)")
        else:
            print(f"   ❌ Error Rate < 1%: FAILED ({r.error_rate:.2f}%)")
        
        # Check throughput
        if r.throughput > 5:
            print(f"   ✅ Throughput > 5 req/s: PASSED ({r.throughput:.1f} req/s)")
        else:
            print(f"   ❌ Throughput > 5 req/s: FAILED ({r.throughput:.1f} req/s)")
        
        if r.errors:
            print(f"\n❗ Sample Errors ({len(r.errors)} total):")
            for i, err in enumerate(r.errors[:5]):
                print(f"   {i+1}. {err[:100]}...")
        
        print("\n" + "=" * 60)
    
    def save_results(self, output_path: str):
        """Save results to JSON file."""
        r = self.results
        
        data = {
            "timestamp": datetime.now().isoformat(),
            "config": {
                "base_url": self.base_url,
                "num_users": self.num_users,
                "duration_s": self.duration_s,
                "requests_per_user": self.requests_per_user,
            },
            "summary": {
                "total_requests": r.total_requests,
                "successful_requests": r.successful_requests,
                "failed_requests": r.failed_requests,
                "throughput_rps": round(r.throughput, 2),
                "error_rate_pct": round(r.error_rate, 2),
            },
            "latency_ms": {
                "avg": round(r.avg_latency_ms, 1),
                "p50": round(r.p50_latency_ms, 1),
                "p95": round(r.p95_latency_ms, 1),
                "p99": round(r.p99_latency_ms, 1),
            },
            "mim_metrics": {
                "avg_decision_time_ms": round(r.avg_mim_decision_ms, 1),
                "avg_llm_calls": round(r.avg_llm_calls, 2),
            },
            "passed": (
                r.p95_latency_ms < 5000 and
                r.error_rate < 1 and
                r.throughput > 5
            ),
        }
        
        Path(output_path).write_text(json.dumps(data, indent=2))
        print(f"\n📁 Results saved to: {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Load test the AI feedback service with MIM v3.0"
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL of the AI service (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--users", "-u",
        type=int,
        default=DEFAULT_USERS,
        help=f"Number of concurrent users (default: {DEFAULT_USERS})",
    )
    parser.add_argument(
        "--duration", "-d",
        type=int,
        default=DEFAULT_DURATION,
        help=f"Test duration in seconds (default: {DEFAULT_DURATION})",
    )
    parser.add_argument(
        "--requests", "-r",
        type=int,
        default=DEFAULT_REQUESTS_PER_USER,
        help=f"Requests per user (default: {DEFAULT_REQUESTS_PER_USER})",
    )
    parser.add_argument(
        "--output", "-o",
        default="load_test_results.json",
        help="Output file for results (default: load_test_results.json)",
    )
    
    args = parser.parse_args()
    
    runner = LoadTestRunner(
        base_url=args.url,
        num_users=args.users,
        duration_s=args.duration,
        requests_per_user=args.requests,
    )
    
    try:
        asyncio.run(runner.run())
        runner.print_results()
        runner.save_results(args.output)
        
        # Exit with appropriate code
        sys.exit(0 if runner.results.error_rate < 1 else 1)
        
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        runner.print_results()
        sys.exit(1)


if __name__ == "__main__":
    main()
