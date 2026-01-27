"""
Algorithm Detector - Pre-LLM Code Analysis
==========================================

Detects the algorithm/approach the user is attempting based on code patterns.
This anchors the LLM to avoid hallucinating incorrect algorithm suggestions.

v3.2: Uses regex patterns to classify user code before LLM call.
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger("algorithm_detector")


@dataclass
class AlgorithmDetection:
    """Result of algorithm detection from user code."""
    detected_algorithm: str  # e.g., "max_flow", "binary_search", "brute_force"
    confidence: float  # 0.0 to 1.0
    evidence: List[str]  # Code patterns that matched
    category: str  # e.g., "graph", "dp", "greedy"
    

# ═══════════════════════════════════════════════════════════════════════════════
# ALGORITHM PATTERNS (Regex-based detection)
# ═══════════════════════════════════════════════════════════════════════════════

ALGORITHM_PATTERNS: Dict[str, Dict] = {
    # ─────────────────────────────────────────────────────────────────────────────
    # GRAPH ALGORITHMS
    # ─────────────────────────────────────────────────────────────────────────────
    "max_flow": {
        "patterns": [
            r"\b(source|sink|capacity|cap|flow)\b",
            r"\b(addEdge|add_edge)\s*\([^)]*capacity",
            r"\b(bfs|dfs)\s*\([^)]*level",
            r"\b(dinic|ford_fulkerson|edmonds_karp)\b",
            r"while\s*\(?\s*bfs\s*\(",
            r"\bresidual\b.*\bgraph\b",
        ],
        "required_count": 2,
        "category": "graph",
        "keywords": ["source", "sink", "cap", "flow", "residual"],
    },
    
    "bipartite_matching": {
        "patterns": [
            r"\b(match|matching|augment)\b",
            r"\bmatch\s*\[\s*\w+\s*\]",
            r"\b(left|right)\s*\[\s*\w+\s*\]",
            r"\b(kuhn|hungarian|hopcroft_karp)\b",
            r"for\s+\w+\s+in\s+\w+\s*:\s*.*match",
        ],
        "required_count": 2,
        "category": "graph",
        "keywords": ["match", "bipartite", "left", "right", "augment"],
    },
    
    "dijkstra": {
        "patterns": [
            r"\b(dijkstra|shortest_path|dist)\b",
            r"priority_queue|heapq|PriorityQueue",
            r"\bdist\s*\[\s*\w+\s*\]\s*[<>=]+\s*dist",
            r"heappush|heappop|push\s*\(\s*\{.*dist",
        ],
        "required_count": 2,
        "category": "graph",
        "keywords": ["dist", "heap", "priority", "shortest"],
    },
    
    "bfs_dfs": {
        "patterns": [
            r"\b(bfs|dfs|visited)\b",
            r"queue\s*[.=]|deque\s*\(",
            r"stack\s*[.=]|\.push\s*\(|\.pop\s*\(",
            r"\bvisited\s*\[\s*\w+\s*\]\s*=\s*(true|True|1)",
            r"while.*queue.*empty|while.*stack.*empty",
        ],
        "required_count": 2,
        "category": "graph",
        "keywords": ["queue", "stack", "visited", "bfs", "dfs"],
    },
    
    "union_find": {
        "patterns": [
            r"\b(union|find|parent|rank)\b",
            r"def\s+find\s*\(\s*\w+\s*\)",
            r"parent\s*\[\s*\w+\s*\]\s*=",
            r"if\s+find\s*\([^)]+\)\s*[!=]=\s*find\s*\(",
        ],
        "required_count": 2,
        "category": "graph",
        "keywords": ["union", "find", "parent", "rank", "disjoint"],
    },
    
    # ─────────────────────────────────────────────────────────────────────────────
    # DYNAMIC PROGRAMMING
    # ─────────────────────────────────────────────────────────────────────────────
    "dp_2d": {
        "patterns": [
            r"\bdp\s*\[\s*\w+\s*\]\s*\[\s*\w+\s*\]",
            r"\bmemo\s*\[\s*\w+\s*\]\s*\[\s*\w+\s*\]",
            r"for.*for.*dp\[",
            r"dp\s*=\s*\[\s*\[",
        ],
        "required_count": 2,
        "category": "dp",
        "keywords": ["dp", "memo", "tabulation"],
    },
    
    "dp_1d": {
        "patterns": [
            r"\bdp\s*\[\s*\w+\s*\]",
            r"dp\s*=\s*\[.*\]",
            r"dp\[\w+\]\s*=\s*(?:max|min)\s*\(",
        ],
        "required_count": 2,
        "category": "dp",
        "keywords": ["dp", "memo"],
    },
    
    "knapsack": {
        "patterns": [
            r"\b(weight|value|capacity)\b.*\b(weight|value|capacity)\b",
            r"dp\[.*\]\s*=\s*max\s*\(.*dp\[.*-.*weight",
            r"for.*weight.*for.*capacity",
        ],
        "required_count": 2,
        "category": "dp",
        "keywords": ["weight", "value", "capacity", "knapsack"],
    },
    
    # ─────────────────────────────────────────────────────────────────────────────
    # SEARCH ALGORITHMS
    # ─────────────────────────────────────────────────────────────────────────────
    "binary_search": {
        "patterns": [
            r"\b(left|lo|low)\s*[<>=]+\s*(right|hi|high)\b",
            r"\bmid\s*=\s*\(?.*\+.*\)?\s*[/>]\s*2",
            r"while\s*\(?\s*(left|lo|low)\s*[<>=]+\s*(right|hi|high)",
            r"\bbisect\b",
        ],
        "required_count": 2,
        "category": "search",
        "keywords": ["left", "right", "mid", "lo", "hi", "binary"],
    },
    
    "two_pointers": {
        "patterns": [
            r"\b(left|right|i|j)\b.*while.*\b(left|right|i|j)\b",
            r"while\s*\(?\s*\w+\s*<\s*\w+\s*\)?.*\+\+|\-\-",
            r"\bleft\s*\+\+|\bright\s*\-\-",
        ],
        "required_count": 2,
        "category": "search",
        "keywords": ["left", "right", "two", "pointer"],
    },
    
    # ─────────────────────────────────────────────────────────────────────────────
    # SORTING & GREEDY
    # ─────────────────────────────────────────────────────────────────────────────
    "sorting": {
        "patterns": [
            r"\b(sort|sorted)\s*\(",
            r"\.sort\s*\(",
            r"Arrays\.sort|Collections\.sort",
            r"qsort|mergesort|heapsort",
        ],
        "required_count": 1,
        "category": "sorting",
        "keywords": ["sort", "sorted", "order"],
    },
    
    "greedy": {
        "patterns": [
            r"\.sort\s*\(.*key\s*=",
            r"sorted\s*\(.*key\s*=",
            r"for.*sorted\(",
            r"max\(|min\(.*for",
        ],
        "required_count": 2,
        "category": "greedy",
        "keywords": ["greedy", "optimal", "local"],
    },
    
    # ─────────────────────────────────────────────────────────────────────────────
    # BRUTE FORCE (detected by absence of optimization)
    # ─────────────────────────────────────────────────────────────────────────────
    "brute_force": {
        "patterns": [
            r"for.*for.*for",  # Triple nested loops
            r"for.*in.*for.*in.*if",  # Nested enumeration
            r"itertools\.(permutations|combinations)",
        ],
        "required_count": 1,
        "category": "brute_force",
        "keywords": ["brute", "exhaustive", "enumerate"],
    },
    
    # ─────────────────────────────────────────────────────────────────────────────
    # DATA STRUCTURES
    # ─────────────────────────────────────────────────────────────────────────────
    "hash_map": {
        "patterns": [
            r"\bdict\s*\(|{.*:.*}",
            r"HashMap|unordered_map|defaultdict",
            r"\[\s*\w+\s*\]\s*=.*\[\s*\w+\s*\]",  # freq[x] = ...
        ],
        "required_count": 2,
        "category": "data_structure",
        "keywords": ["dict", "map", "hash", "frequency"],
    },
    
    "segment_tree": {
        "patterns": [
            r"\b(segment|segtree|tree)\b.*\b(build|update|query)\b",
            r"2\s*\*\s*\w+|2\s*\*\s*\w+\s*\+\s*1",  # 2*i, 2*i+1
            r"def\s+(update|query)\s*\(.*mid",
        ],
        "required_count": 2,
        "category": "data_structure",
        "keywords": ["segment", "tree", "range", "query"],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# CANONICAL ALGORITHM MAPPINGS (Problem type → Expected algorithms)
# ═══════════════════════════════════════════════════════════════════════════════

CANONICAL_ALGORITHMS: Dict[str, List[str]] = {
    # Graph problems
    "task_assignment": ["bipartite_matching", "max_flow"],
    "worker_assignment": ["bipartite_matching", "max_flow"],
    "maximum_matching": ["bipartite_matching", "max_flow", "kuhn"],
    "network_flow": ["max_flow", "dinic", "ford_fulkerson"],
    "shortest_path": ["dijkstra", "bfs", "bellman_ford"],
    "minimum_spanning_tree": ["kruskal", "prim", "union_find"],
    "connected_components": ["union_find", "bfs_dfs"],
    
    # DP problems
    "longest_subsequence": ["dp_1d", "dp_2d"],
    "knapsack": ["dp_2d", "knapsack"],
    "edit_distance": ["dp_2d"],
    "coin_change": ["dp_1d"],
    
    # Search problems
    "find_target": ["binary_search", "two_pointers"],
    "range_query": ["binary_search", "segment_tree"],
    "kth_element": ["binary_search", "quick_select"],
    
    # Array problems
    "two_sum": ["hash_map", "two_pointers"],
    "subarray_sum": ["hash_map", "prefix_sum"],
    "sliding_window": ["two_pointers", "deque"],
}


def detect_algorithm(code: str, problem_tags: List[str] = None) -> AlgorithmDetection:
    """
    Detect the algorithm the user is attempting from their code.
    
    Args:
        code: User's submitted code
        problem_tags: Optional problem tags for context
    
    Returns:
        AlgorithmDetection with detected algorithm and confidence
    """
    if not code or len(code.strip()) < 10:
        return AlgorithmDetection(
            detected_algorithm="unknown",
            confidence=0.0,
            evidence=["Code is empty or too short"],
            category="unknown"
        )
    
    code_lower = code.lower()
    detections: List[Tuple[str, float, List[str], str]] = []
    
    for algo_name, config in ALGORITHM_PATTERNS.items():
        matches = []
        
        # Check regex patterns
        for pattern in config["patterns"]:
            if re.search(pattern, code, re.IGNORECASE):
                matches.append(pattern)
        
        # Check keywords
        for keyword in config.get("keywords", []):
            if keyword.lower() in code_lower:
                matches.append(f"keyword:{keyword}")
        
        # Calculate confidence based on matches
        required = config["required_count"]
        if len(matches) >= required:
            confidence = min(1.0, len(matches) / (required + 2))
            detections.append((
                algo_name,
                confidence,
                matches[:5],  # Limit evidence
                config["category"]
            ))
    
    # Sort by confidence
    detections.sort(key=lambda x: x[1], reverse=True)
    
    if detections:
        best = detections[0]
        return AlgorithmDetection(
            detected_algorithm=best[0],
            confidence=best[1],
            evidence=best[2],
            category=best[3]
        )
    
    # Fallback: check for brute force indicators
    nested_loops = len(re.findall(r'\bfor\b', code, re.IGNORECASE))
    if nested_loops >= 3:
        return AlgorithmDetection(
            detected_algorithm="brute_force",
            confidence=0.6,
            evidence=[f"Found {nested_loops} for-loops suggesting brute force"],
            category="brute_force"
        )
    
    return AlgorithmDetection(
        detected_algorithm="unknown",
        confidence=0.0,
        evidence=["No recognizable algorithm pattern detected"],
        category="unknown"
    )


def get_canonical_algorithms(problem_category: str, problem_tags: List[str] = None) -> List[str]:
    """
    Get the canonical/expected algorithms for a problem type.
    
    Args:
        problem_category: Problem category (e.g., "Graph", "DP")
        problem_tags: Problem tags for more specific matching
    
    Returns:
        List of canonical algorithm names
    """
    canonical = []
    
    # Check direct category mapping
    category_lower = problem_category.lower().replace(" ", "_")
    if category_lower in CANONICAL_ALGORITHMS:
        canonical.extend(CANONICAL_ALGORITHMS[category_lower])
    
    # Check tags
    if problem_tags:
        for tag in problem_tags:
            tag_lower = tag.lower().replace(" ", "_")
            if tag_lower in CANONICAL_ALGORITHMS:
                canonical.extend(CANONICAL_ALGORITHMS[tag_lower])
    
    # Deduplicate while preserving order
    seen = set()
    result = []
    for algo in canonical:
        if algo not in seen:
            seen.add(algo)
            result.append(algo)
    
    return result if result else ["general"]


def compare_user_vs_canonical(
    user_detection: AlgorithmDetection,
    canonical_algorithms: List[str]
) -> Dict:
    """
    Compare user's detected algorithm against canonical solutions.
    
    Returns:
        Dict with comparison result and guidance
    """
    user_algo = user_detection.detected_algorithm
    
    # Check if user algorithm matches any canonical
    is_match = any(
        user_algo in canonical or canonical in user_algo
        for canonical in canonical_algorithms
    )
    
    # Check category match
    category_match = any(
        user_detection.category in canonical or canonical in user_detection.category
        for canonical in canonical_algorithms
    )
    
    if is_match:
        return {
            "status": "ALGORITHM_CORRECT",
            "message": f"Your {user_algo} approach is appropriate for this problem.",
            "guidance": "Focus on implementation details, not algorithm choice.",
            "user_algorithm": user_algo,
            "canonical_algorithms": canonical_algorithms,
        }
    elif category_match:
        return {
            "status": "CATEGORY_MATCH",
            "message": f"Your {user_algo} is in the right category but may not be optimal.",
            "guidance": f"Consider: {', '.join(canonical_algorithms[:2])}",
            "user_algorithm": user_algo,
            "canonical_algorithms": canonical_algorithms,
        }
    elif user_algo == "brute_force":
        return {
            "status": "INEFFICIENT_APPROACH",
            "message": "Your brute force approach may be too slow.",
            "guidance": f"This problem typically uses: {', '.join(canonical_algorithms[:2])}",
            "user_algorithm": user_algo,
            "canonical_algorithms": canonical_algorithms,
        }
    else:
        return {
            "status": "ALGORITHM_MISMATCH",
            "message": f"Your {user_algo} approach may not be the best fit.",
            "guidance": f"Expected approaches: {', '.join(canonical_algorithms[:2])}",
            "user_algorithm": user_algo,
            "canonical_algorithms": canonical_algorithms,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION FOR WORKFLOW
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_user_algorithm(
    code: str,
    problem_category: str,
    problem_tags: List[str] = None,
    canonical_from_db: List[str] = None
) -> Dict:
    """
    Full analysis of user's algorithm approach.
    
    Args:
        code: User's submitted code
        problem_category: Problem category
        problem_tags: Problem tags
        canonical_from_db: Canonical algorithms from problem DB (preferred)
    
    Returns:
        Complete analysis dict for feedback agent context
    """
    # Detect user's algorithm
    detection = detect_algorithm(code, problem_tags)
    
    # Get canonical algorithms (prefer DB, fallback to inference)
    canonical = canonical_from_db if canonical_from_db else get_canonical_algorithms(
        problem_category, problem_tags
    )
    
    # Compare
    comparison = compare_user_vs_canonical(detection, canonical)
    
    return {
        "user_algorithm": detection.detected_algorithm,
        "user_confidence": detection.confidence,
        "user_evidence": detection.evidence,
        "user_category": detection.category,
        "canonical_algorithms": canonical,
        "comparison": comparison,
    }
