"""
MIM Feedback Generator
======================

Generates personalized, non-generic feedback.

CRITICAL:
- User state snapshot MUST be used for personalization
- Generic phrases are rejected
- Feedback must reference user's history
"""

from typing import Dict, Any, List
from datetime import datetime

from app.mim.output_schemas.correctness_feedback import CorrectnessFeedback
from app.mim.output_schemas.performance_feedback import PerformanceFeedback
from app.mim.output_schemas.reinforcement_feedback import ReinforcementFeedback

from app.mim.taxonomy.subtypes import SUBTYPE_DESCRIPTIONS


# ═══════════════════════════════════════════════════════════════════════════════
# CORRECTNESS FEEDBACK GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_correctness_feedback(
    *,
    user_id: str,
    problem_id: str,
    submission_id: str,
    root_cause: str,
    subtype: str,
    failure_mechanism: str,
    confidence: float,
    category: str,
    difficulty: str,
    is_recurring: bool,
    recurrence_count: int,
    user_state_snapshot: Dict[str, Any],
) -> CorrectnessFeedback:
    """
    Generate personalized correctness feedback.
    
    Uses:
    - Subtype descriptions for specific guidance
    - User state for personalization
    - Recurrence for escalation
    """
    
    subtype_info = SUBTYPE_DESCRIPTIONS.get(subtype, {})
    
    # Build personalized explanation
    explanation = _build_personalized_explanation(
        subtype=subtype,
        subtype_info=subtype_info,
        failure_mechanism=failure_mechanism,
        category=category,
        is_recurring=is_recurring,
        recurrence_count=recurrence_count,
        user_state_snapshot=user_state_snapshot,
    )
    
    # Build fix direction
    fix_direction = _build_fix_direction(
        subtype=subtype,
        subtype_info=subtype_info,
        is_recurring=is_recurring,
        user_state_snapshot=user_state_snapshot,
    )
    
    # Build example fix
    example_fix = _build_example_fix(
        subtype=subtype,
        failure_mechanism=failure_mechanism,
        category=category,
    )
    
    # Find related past problems
    related_problems = _find_related_problems(
        user_state_snapshot=user_state_snapshot,
        subtype=subtype,
    )
    
    return CorrectnessFeedback(
        user_id=user_id,
        problem_id=problem_id,
        submission_id=submission_id,
        root_cause="correctness",  # Schema enforces this
        subtype=subtype,
        failure_mechanism=failure_mechanism,
        confidence=confidence,
        explanation=explanation,
        fix_direction=fix_direction,
        example_fix=example_fix,
        is_recurring=is_recurring,
        recurrence_count=recurrence_count,
        related_past_problems=related_problems,
        category=category,
        difficulty=difficulty,
        timestamp=datetime.utcnow().isoformat(),
    )


def _build_personalized_explanation(
    *,
    subtype: str,
    subtype_info: Dict,
    failure_mechanism: str,
    category: str,
    is_recurring: bool,
    recurrence_count: int,
    user_state_snapshot: Dict,
) -> str:
    """Build a personalized, non-generic explanation."""
    
    base_description = subtype_info.get("description", f"Issue classified as {subtype}")
    example = subtype_info.get("example", "")
    
    # Start with specific description
    explanation = f"Your submission has a **{subtype_info.get('name', subtype)}** issue. "
    explanation += f"{base_description}. "
    
    # Add category-specific context
    explanation += f"In {category} problems, this often manifests as {failure_mechanism.replace('_', ' ')}. "
    
    # Add recurrence personalization
    if is_recurring:
        explanation += f"**This is a recurring pattern** — you've encountered similar issues {recurrence_count} times before. "
        
        # Check if user is improving or stagnant
        improving = user_state_snapshot.get("improving_areas", [])
        stagnant = user_state_snapshot.get("stagnant_areas", [])
        
        if category.lower() in stagnant:
            explanation += f"Progress in {category} has been slow; consider deliberate practice. "
        elif category.lower() in improving:
            explanation += "But you're making progress in this area — keep it up! "
    
    # Add example if available
    if example:
        explanation += f"Example scenario: {example}. "
    
    return explanation.strip()


def _build_fix_direction(
    *,
    subtype: str,
    subtype_info: Dict,
    is_recurring: bool,
    user_state_snapshot: Dict,
) -> str:
    """Build specific fix direction."""
    
    base_fix = subtype_info.get("fix_direction", f"Review your logic for {subtype}")
    
    fix = f"**Recommended approach**: {base_fix}. "
    
    if is_recurring:
        fix += "Since this is a recurring issue, try these additional steps: "
        fix += "(1) Before coding, explicitly write down the invariants. "
        fix += "(2) Trace through with at least 3 edge cases by hand. "
        fix += "(3) Add assertions to validate your assumptions. "
    else:
        fix += "This appears to be a new type of mistake for you. "
        fix += "Take time to understand why this happened before moving on. "
    
    # Add technique suggestions if user has demonstrated skills
    techniques = user_state_snapshot.get("strong_techniques", [])
    if techniques:
        fix += f"You've shown skill with {', '.join(techniques[:2])} — consider if any apply here. "
    
    return fix.strip()


def _build_example_fix(
    *,
    subtype: str,
    failure_mechanism: str,
    category: str,
) -> str:
    """Build concrete example or pseudocode fix."""
    
    examples = {
        "wrong_invariant": """
```python
# Before: invariant not maintained
for i in range(n):
    prefix[i] = prefix[i-1] + arr[i]  # Bug: i=0 causes index error

# After: handle base case
prefix[0] = arr[0]
for i in range(1, n):
    prefix[i] = prefix[i-1] + arr[i]  # Invariant: prefix[i] = sum(arr[0:i+1])
```
""",
        "incorrect_boundary": """
```python
# Before: boundary off by one
while left < right:  # May miss final element
    
# After: correct boundary
while left <= right:  # Includes all elements
```
""",
        "off_by_one": """
```python
# Before: fence post error
for i in range(len(arr)):  # if arr has n elements, runs n times
    
# After: verify range matches intent
for i in range(len(arr) - 1):  # runs n-1 times for n-1 pairs
```
""",
        "brute_force_under_constraints": """
```python
# Before: O(n²) - too slow for n=10^5
for i in range(n):
    for j in range(n):
        if arr[i] + arr[j] == target: ...

# After: O(n) with hash map
seen = set()
for x in arr:
    if target - x in seen:
        return True
    seen.add(x)
```
""",
        "state_loss": """
```python
# Before: state reset inside loop
for node in graph:
    visited = set()  # Bug: resets on each iteration!
    dfs(node, visited)

# After: state preserved
visited = set()  # Initialize outside loop
for node in graph:
    if node not in visited:
        dfs(node, visited)
```
""",
    }
    
    return examples.get(subtype, examples.get(failure_mechanism, 
        f"# Review {subtype} pattern and apply standard fix"))


def _find_related_problems(
    *,
    user_state_snapshot: Dict,
    subtype: str,
) -> List[str]:
    """Find related problems from user history."""
    # This would query the mistake_memory store
    # For now, return empty list
    return []


# ═══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE FEEDBACK GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_performance_feedback(
    *,
    user_id: str,
    problem_id: str,
    submission_id: str,
    subtype: str,
    failure_mechanism: str,
    confidence: float,
    category: str,
    difficulty: str,
    expected_complexity: str,
    constraints: Dict[str, Any],
    is_recurring: bool,
    user_state_snapshot: Dict[str, Any],
) -> PerformanceFeedback:
    """
    Generate personalized performance/efficiency feedback.
    """
    
    # Infer used complexity from subtype
    used_complexity = _infer_used_complexity(subtype, constraints)
    
    # Build complexity gap description
    complexity_gap = f"Your solution appears to be {used_complexity}, but {expected_complexity} is required for the given constraints."
    
    # Build optimization strategy
    strategy, technique = _build_optimization_strategy(
        subtype=subtype,
        category=category,
        constraints=constraints,
        user_state_snapshot=user_state_snapshot,
    )
    
    # Check if user has used technique before
    user_techniques = user_state_snapshot.get("strong_techniques", [])
    has_used_before = technique in user_techniques
    
    # Related optimizations user knows
    related = [t for t in user_techniques if t != technique][:3]
    
    # Get N from constraints
    n_value = constraints.get("n", constraints.get("N", 10000))
    if isinstance(n_value, str):
        try:
            n_value = int(n_value)
        except:
            n_value = 10000
    
    return PerformanceFeedback(
        user_id=user_id,
        problem_id=problem_id,
        submission_id=submission_id,
        root_cause="efficiency",
        subtype=subtype,
        failure_mechanism=failure_mechanism,
        confidence=confidence,
        used_complexity=used_complexity,
        expected_complexity=expected_complexity,
        complexity_gap=complexity_gap,
        optimization_strategy=strategy,
        suggested_technique=technique,
        technique_explanation=_get_technique_explanation(technique, category),
        is_recurring=is_recurring,
        has_used_technique_before=has_used_before,
        related_optimizations=related,
        category=category,
        difficulty=difficulty,
        constraint_n=n_value,
        timestamp=datetime.utcnow().isoformat(),
    )


def _infer_used_complexity(subtype: str, constraints: Dict) -> str:
    """Infer used complexity from subtype."""
    
    mapping = {
        "brute_force_under_constraints": "O(n^2)",
        "state_space_blowup": "O(2^n)",
        "redundant_computation": "O(n^2)",
        "suboptimal_data_structure": "O(n^2)",
    }
    
    return mapping.get(subtype, "O(n^2)")


def _build_optimization_strategy(
    *,
    subtype: str,
    category: str,
    constraints: Dict,
    user_state_snapshot: Dict,
) -> tuple:
    """Build optimization strategy and suggested technique."""
    
    strategies = {
        "brute_force_under_constraints": {
            "arrays": ("Use a hash map for O(1) lookups instead of nested loops", "hash_map"),
            "strings": ("Use two pointers or sliding window for linear time", "two_pointers"),
            "graph": ("Consider BFS/DFS with pruning or memoization", "graph_traversal"),
            "dp": ("Identify overlapping subproblems and use memoization", "dynamic_programming"),
        },
        "state_space_blowup": {
            "dp": ("Reduce DP dimensions by identifying unnecessary state", "state_reduction"),
            "graph": ("Use bidirectional search or iterative deepening", "bidirectional_search"),
        },
        "redundant_computation": {
            "default": ("Precompute values or use memoization", "memoization"),
        },
        "suboptimal_data_structure": {
            "default": ("Use a more efficient data structure like heap, tree set, or hash map", "optimal_ds"),
        },
    }
    
    subtype_strategies = strategies.get(subtype, {})
    cat_lower = category.lower()
    
    if cat_lower in subtype_strategies:
        return subtype_strategies[cat_lower]
    elif "default" in subtype_strategies:
        return subtype_strategies["default"]
    else:
        return ("Analyze the complexity bottleneck and apply standard optimization patterns", "general_optimization")


def _get_technique_explanation(technique: str, category: str) -> str:
    """Get explanation for suggested technique."""
    
    explanations = {
        "hash_map": "A hash map provides O(1) average-case lookups, turning O(n) searches into O(1). For two-sum patterns, store seen values and check complements.",
        "two_pointers": "Two pointers technique processes arrays/strings in O(n) by maintaining left/right pointers that converge based on conditions.",
        "dynamic_programming": "DP stores solutions to subproblems to avoid recomputation. Identify the recurrence relation and base cases.",
        "memoization": "Memoization caches function results to prevent redundant computation. Add a cache keyed by function arguments.",
        "graph_traversal": "Efficient graph traversal uses visited sets and appropriate search strategy (BFS for shortest path, DFS for connectivity).",
        "state_reduction": "Analyze which dimensions of state are truly needed. Often you can reduce 3D DP to 2D by noticing dependencies.",
    }
    
    return explanations.get(technique, f"Apply {technique} pattern to reduce complexity.")


# ═══════════════════════════════════════════════════════════════════════════════
# REINFORCEMENT FEEDBACK GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_reinforcement_feedback(
    *,
    user_id: str,
    problem_id: str,
    submission_id: str,
    category: str,
    difficulty: str,
    technique: str,
    time_to_solve: float,
    attempt_count: int,
    was_optimal: bool,
    user_state_snapshot: Dict[str, Any],
) -> ReinforcementFeedback:
    """
    Generate reinforcement feedback for accepted submission.
    
    CRITICAL: No root cause, no mistake history update.
    """
    
    # Compute confidence boost
    base_boost = {"easy": 0.1, "medium": 0.15, "hard": 0.25}.get(difficulty.lower(), 0.15)
    attempt_factor = 1.0 / max(1, attempt_count ** 0.5)
    confidence_boost = base_boost * attempt_factor
    
    # Determine readiness
    strong_cats = user_state_snapshot.get("strong_categories", [])
    ready_for_harder = category.lower() in strong_cats or attempt_count <= 2
    
    # Suggest next difficulty
    current_level = {"easy": 0, "medium": 1, "hard": 2}.get(difficulty.lower(), 1)
    if ready_for_harder and current_level < 2:
        suggested_diff = ["easy", "medium", "hard"][current_level + 1]
    else:
        suggested_diff = difficulty
    
    # Suggest next categories
    stagnant = user_state_snapshot.get("stagnant_areas", [])
    suggested_cats = stagnant[:2] if stagnant else [category]
    
    return ReinforcementFeedback(
        user_id=user_id,
        problem_id=problem_id,
        submission_id=submission_id,
        category=category,
        difficulty=difficulty,
        technique=technique,
        confidence_boost=confidence_boost,
        time_to_solve_seconds=time_to_solve,
        attempt_count=attempt_count,
        was_optimal=was_optimal,
        categories_strengthened=[category],
        techniques_demonstrated=[technique],
        readiness_delta=confidence_boost,
        ready_for_harder=ready_for_harder,
        suggested_next_difficulty=suggested_diff,
        suggested_next_categories=suggested_cats,
        timestamp=datetime.utcnow().isoformat(),
    )
