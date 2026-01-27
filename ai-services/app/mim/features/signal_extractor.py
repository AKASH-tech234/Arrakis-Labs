"""
MIM Code Signal Extractor
=========================

Extract signals from code and execution for failure mechanism derivation.

These signals are used by the deterministic rule engine to derive
FAILURE_MECHANISM. They are NOT learned.

Signals include:
- Code patterns (loops, recursion, data structures)
- Execution signals (verdict, test case position)
- Constraint signals (large N, edge cases)
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import re


# ═══════════════════════════════════════════════════════════════════════════════
# DATA TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CodeSignals:
    """
    Signals extracted from code + execution for failure mechanism derivation.
    
    All fields are booleans or simple values. No complex types.
    """
    # Code pattern signals
    loop_bounds: bool = False
    prefix_sum: bool = False
    two_pointers: bool = False
    binary_search: bool = False
    sliding_window: bool = False
    recursion_depth: bool = False
    memo: bool = False
    no_memo: bool = False
    
    # Execution signals
    verdict: str = ""
    failed_test_position: Optional[int] = None  # 1 = first, None = unknown
    
    # Constraint signals
    large_n: bool = False
    empty_input: bool = False
    null_check: bool = False
    equality_check: bool = False
    division: bool = False
    multiplication: bool = False
    linear_search: bool = False
    fence_post: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for rule engine."""
        return {
            "loop_bounds": self.loop_bounds,
            "prefix_sum": self.prefix_sum,
            "two_pointers": self.two_pointers,
            "binary_search": self.binary_search,
            "sliding_window": self.sliding_window,
            "recursion_depth": self.recursion_depth,
            "memo": self.memo,
            "no_memo": self.no_memo,
            "verdict": self.verdict,
            "failed_test_position": self.failed_test_position,
            "large_n": self.large_n,
            "empty_input": self.empty_input,
            "null_check": self.null_check,
            "equality_check": self.equality_check,
            "division": self.division,
            "multiplication": self.multiplication,
            "linear_search": self.linear_search,
            "fence_post": self.fence_post,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SIGNAL EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

def extract_code_signals(
    *,
    code: str,
    verdict: str = "",
    failed_test_position: Optional[int] = None,
    constraints: Optional[Dict[str, Any]] = None,
    problem_tags: Optional[List[str]] = None,
) -> CodeSignals:
    """
    Extract signals from code and execution context.
    
    Parameters
    ----------
    code : str
        Submitted code
    verdict : str
        Execution verdict (wrong_answer, time_limit_exceeded, etc.)
    failed_test_position : int, optional
        Which test case failed (1-indexed)
    constraints : dict, optional
        Problem constraints (e.g., {"n": 100000})
    problem_tags : list, optional
        Problem tags (e.g., ["binary_search", "two_pointers"])
        
    Returns
    -------
    CodeSignals
        Extracted signals for rule engine
    """
    
    constraints = constraints or {}
    problem_tags = problem_tags or []
    
    signals = CodeSignals(
        verdict=verdict.lower() if verdict else "",
        failed_test_position=failed_test_position,
    )
    
    code_lower = code.lower()
    
    # ───────────────────────────────────────────────────────────────────────────
    # CODE PATTERN SIGNALS
    # ───────────────────────────────────────────────────────────────────────────
    
    # Loop bounds detection
    loop_patterns = [
        r"for\s*\(",
        r"while\s*\(",
        r"for\s+\w+\s+in",
        r"\.length",
        r"\.size\(\)",
        r"\[\s*i\s*\]",
        r"\[\s*j\s*\]",
    ]
    if any(re.search(p, code_lower) for p in loop_patterns):
        # Check for boundary-related patterns
        boundary_patterns = [
            r"<\s*=",
            r">\s*=",
            r"\+\s*1",
            r"-\s*1",
            r"\.length\s*-\s*1",
            r"n\s*-\s*1",
        ]
        if any(re.search(p, code_lower) for p in boundary_patterns):
            signals.loop_bounds = True
    
    # Prefix sum detection
    prefix_patterns = [
        r"prefix",
        r"cumsum",
        r"cumulative",
        r"\[\s*i\s*\]\s*\+\s*\[\s*i\s*-\s*1\s*\]",
        r"sum\s*\+=",
        r"running.*sum",
    ]
    if any(re.search(p, code_lower) for p in prefix_patterns):
        signals.prefix_sum = True
    
    # Two pointers detection
    two_pointer_patterns = [
        r"left.*right",
        r"lo.*hi",
        r"i.*j.*while",
        r"start.*end",
        r"\+\+.*--",
        r"--.*\+\+",
    ]
    if any(re.search(p, code_lower) for p in two_pointer_patterns):
        signals.two_pointers = True
    if "two_pointers" in problem_tags or "two pointers" in problem_tags:
        signals.two_pointers = True
    
    # Binary search detection
    binary_search_patterns = [
        r"binary.?search",
        r"bisect",
        r"mid\s*=.*\/\s*2",
        r"left.*right.*mid",
        r"lo.*hi.*mid",
    ]
    if any(re.search(p, code_lower) for p in binary_search_patterns):
        signals.binary_search = True
    if "binary_search" in problem_tags or "binary search" in problem_tags:
        signals.binary_search = True
    
    # Sliding window detection
    sliding_patterns = [
        r"window",
        r"slide",
        r"deque",
        r"\[\s*i\s*:\s*i\s*\+",
        r"substring",
    ]
    if any(re.search(p, code_lower) for p in sliding_patterns):
        signals.sliding_window = True
    if "sliding_window" in problem_tags or "sliding window" in problem_tags:
        signals.sliding_window = True
    
    # Recursion detection
    recursion_patterns = [
        r"def\s+(\w+)\s*\([^)]*\)[^:]*:.*\1\s*\(",  # Function calls itself (fixed backreference)
        r"return.*\w+\s*\(",
        r"recursive",
        r"dfs\s*\(",
        r"bfs\s*\(",
        r"backtrack",
    ]
    if any(re.search(p, code_lower) for p in recursion_patterns):
        signals.recursion_depth = True
    
    # Memoization detection
    memo_patterns = [
        r"@lru_cache",
        r"@cache",
        r"memo",
        r"dp\s*\[",
        r"cache\s*\[",
        r"visited\s*\[",
    ]
    if any(re.search(p, code_lower) for p in memo_patterns):
        signals.memo = True
    else:
        # Recursion without memoization
        if signals.recursion_depth:
            signals.no_memo = True
    
    # ───────────────────────────────────────────────────────────────────────────
    # CONSTRAINT SIGNALS
    # ───────────────────────────────────────────────────────────────────────────
    
    # Large N detection
    n_value = constraints.get("n") or constraints.get("N")
    if n_value:
        try:
            if int(n_value) >= 10000:
                signals.large_n = True
        except (ValueError, TypeError):
            pass
    
    # Empty input handling
    empty_patterns = [
        r"len\s*\(\s*\w+\s*\)\s*==\s*0",
        r"\.length\s*==\s*0",
        r"\.isEmpty\(\)",
        r"not\s+\w+",
        r"if\s+\w+\s*:",
    ]
    signals.empty_input = any(re.search(p, code_lower) for p in empty_patterns)
    
    # Null check detection
    null_patterns = [
        r"is\s+None",
        r"==\s*None",
        r"!=\s*None",
        r"null",
        r"undefined",
    ]
    signals.null_check = any(re.search(p, code_lower) for p in null_patterns)
    
    # Equality check detection
    equality_patterns = [
        r"==",
        r"!=",
        r"\.equals\(",
    ]
    signals.equality_check = any(re.search(p, code_lower) for p in equality_patterns)
    
    # Division detection
    division_patterns = [
        r"\/\s*[^\/]",  # Division but not //
        r"\/\/",        # Integer division
        r"%",           # Modulo
    ]
    signals.division = any(re.search(p, code) for p in division_patterns)  # Case-sensitive
    
    # Multiplication detection (for overflow risk)
    mult_patterns = [
        r"\*",
        r"pow\s*\(",
        r"\*\*",
    ]
    signals.multiplication = any(re.search(p, code) for p in mult_patterns)
    
    # Linear search detection
    linear_patterns = [
        r"for.*in.*if",
        r"\.index\(",
        r"\.find\(",
        r"in\s+\w+\s*:",
    ]
    signals.linear_search = any(re.search(p, code_lower) for p in linear_patterns)
    
    # Fence post detection (classic off-by-one scenario)
    fence_patterns = [
        r"range\s*\(\s*\d+\s*,",
        r"for.*<.*length",
        r"for.*<=.*length",
    ]
    signals.fence_post = any(re.search(p, code_lower) for p in fence_patterns)
    
    return signals
