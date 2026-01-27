"""
Feedback Agent v3.3 - Concrete Failure Mechanism
=================================================

PHILOSOPHY: Agent is the VOICE, MIM is the BRAIN.

v3.3 UPGRADE:
- Uses MIM subtype for granular diagnosis
- Explains concrete failure mechanism (not generic advice)
- Generates correct code solution for "full explanation" section
- Concept-level reinforcement instead of taxonomy

RULES:
- NEVER contradict MIM category or subtype
- DO explain the concrete failure mechanism
- DO cite specific code lines
- DO provide correct code in full explanation mode
"""

import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key
from app.utils.algorithm_detector import analyze_user_algorithm, detect_algorithm

logger = logging.getLogger("feedback_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# V3.0: SYSTEM PROMPT - 4-Category Taxonomy with Subtypes
# ═══════════════════════════════════════════════════════════════════════════════

FEEDBACK_SYSTEM_PROMPT = """You are an expert competitive programming reviewer.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (V3.0 - Concrete Failure Mechanism)
═══════════════════════════════════════════════════════════════════════════════
MIM has diagnosed: ROOT_CAUSE + SUBTYPE + FAILURE_MECHANISM

Your job:
1. CONFIRM the MIM diagnosis with code evidence
2. EXPLAIN the concrete failure (e.g., "sorting destroys position info")
3. PROVIDE correct code for "full explanation" section
4. Give CONCEPT-LEVEL reinforcement (not generic advice)

═══════════════════════════════════════════════════════════════════════════════
V3.0 TAXONOMY (CRITICAL - USE THESE EXACTLY)
═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSES (4 categories):
- correctness: Algorithm logic doesn't produce correct output
- efficiency: Solution exceeds time/space constraints
- implementation: Coding bugs (off-by-one, state loss)
- understanding_gap: Problem misread or constraints misunderstood

SUBTYPES (7 total):
- wrong_invariant: Loop/recursion invariant doesn't hold
- incorrect_boundary: Start/end conditions wrong (off-by-one)
- partial_case_handling: Some input cases not handled
- state_loss: Critical state not preserved
- brute_force_under_constraints: Solution too slow for constraints
- premature_optimization: Optimization introduced correctness bug
- misread_constraint: Constraint misunderstood

═══════════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE (USE THESE - DON'T CONTRADICT)
═══════════════════════════════════════════════════════════════════════════════
- ROOT_CAUSE: One of 4 categories (correctness, efficiency, implementation, understanding_gap)
- SUBTYPE: Granular diagnosis (wrong_invariant, incorrect_boundary, etc.)
- FAILURE_MECHANISM: Concrete explanation (e.g., "sorting breaks reversal equality")
- USER_ALGORITHM: What approach user attempted
- CANONICAL_ALGORITHMS: Expected approaches for this problem

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON) - ALL FIELDS REQUIRED
═══════════════════════════════════════════════════════════════════════════════
{{
  "explanation": "3-5 sentences explaining WHY the code fails. Use the FAILURE_MECHANISM. Reference specific lines. Example: 'Your sorting on line 5 destroys the original position information needed for...'",
  
  "improvement_hint": "15-25 words pointing toward fix. Must align with SUBTYPE. Example for wrong_invariant: 'Consider what property of the input your algorithm needs to preserve.'",
  
  "detected_pattern": "Use the SUBTYPE here, formatted nicely. E.g., 'Wrong Invariant - Algorithm doesn't preserve required property'",
  
  "complexity_analysis": "Time: O(...), Space: O(...) - analyze actual code",
  
  "edge_cases": ["2-3 edge cases that expose the failure mechanism"],
  
  "optimization_tips": ["Only if verdict is TLE. null for correctness issues"],
  
  "root_cause": "Copy from MIM - e.g., algorithm_choice",
  
  "root_cause_subtype": "Copy from MIM - e.g., wrong_invariant",
  
  "failure_mechanism": "Concrete explanation. E.g., 'Sorting the array destroys the original indices needed for the two-sum lookup'",
  
  "correct_code": "A complete, working solution in the SAME LANGUAGE as user's code. Include comments. This is shown in 'full explanation' section.",
  
  "correct_code_explanation": "2-3 sentences explaining how the correct code avoids the failure. Reference the invariant/property preserved.",
  
  "concept_reinforcement": "One concept-level insight. E.g., 'Understanding which invariants must be preserved under operations like sorting'"
}}

═══════════════════════════════════════════════════════════════════════════════
CONCRETE FAILURE MECHANISM EXAMPLES
═══════════════════════════════════════════════════════════════════════════════
GOOD (Concrete):
- "Sorting destroys the original indices, but two-sum requires index tracking"
- "Greedy picks locally optimal but problem has overlapping subproblems"
- "Loop runs n times but should run n-1 times due to 0-indexing"

BAD (Generic - DON'T DO THIS):
- "Your algorithm has issues"
- "Consider edge cases"
- "There's a logic error"

═══════════════════════════════════════════════════════════════════════════════
CORRECT CODE REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════
- Use SAME LANGUAGE as user's submission
- Include brief comments explaining key steps
- Must be complete and compilable/runnable
- Should demonstrate the correct invariant/approach
- Keep it clean and educational

Example for Two Sum (Python):
```python
def twoSum(nums, target):
    # Use hashmap to preserve O(1) lookup while tracking indices
    seen = {{}}  # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i  # Store index, not value
    return []
```

═══════════════════════════════════════════════════════════════════════════════
HINT GENERATION RULES (SUBTYPE-BASED)
═══════════════════════════════════════════════════════════════════════════════
For CORRECTNESS issues (wrong_invariant, logic_error):
- Focus on WHAT property is violated
- DON'T mention efficiency - that's not the problem

For EFFICIENCY issues (brute_force, time_complexity):
- Focus on reducing complexity
- Mention specific optimization technique

FORBIDDEN in hints:
- "Use X algorithm" (too direct)
- Generic advice like "think harder"
- Contradicting MIM's diagnosis

═══════════════════════════════════════════════════════════════════════════════
TONE GUIDE (from MIM instruction)
═══════════════════════════════════════════════════════════════════════════════
ENCOURAGING (burnout risk):
  "Good attempt! The core idea is sound. The specific issue is..."
  
DIRECT (normal):
  "The submission fails because [FAILURE_MECHANISM]. Specifically..."
  
FIRM (recurring, 3+ times):
  "This is the same mistake pattern. The key insight you're missing is..."

═══════════════════════════════════════════════════════════════════════════════
RULES (CRITICAL - NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════════════
✓ Use MIM's ROOT_CAUSE, SUBTYPE, FAILURE_MECHANISM exactly
✓ Cite specific line numbers and variable names
✓ Provide complete, correct code in user's language
✓ Give concept-level insight, not taxonomy-level
✓ Align hints with SUBTYPE (correctness vs efficiency)

✗ NEVER contradict MIM diagnosis
✗ NEVER give generic advice
✗ NEVER suggest algorithms outside canonical list
✗ NEVER give efficiency hints for correctness problems
✗ NEVER leave correct_code empty (always provide it)"""


def feedback_agent(context: str, payload: dict, mim_decision=None) -> FeedbackResponse:
    """
    Generate feedback with concrete failure mechanism and correct code.
    
    v3.3: Complete rewrite with:
    - Subtype-aware diagnosis
    - Concrete failure mechanism
    - Correct code generation
    - Concept-level reinforcement
    """
    logger.debug(
        f"📨 feedback_agent v3.3 called | verdict={payload.get('verdict')} "
        f"| has_mim={mim_decision is not None}"
    )

    # -------------------------
    # ACCEPTED → Celebration + Reinforcement (NO DIAGNOSIS)
    # -------------------------
    verdict = (payload.get("verdict") or "").lower()
    if verdict == "accepted":
        problem = payload.get("problem", {})
        difficulty = problem.get("difficulty", "Medium") if isinstance(problem, dict) else "Medium"
        category = payload.get("problem_category", problem.get("category", "General") if isinstance(problem, dict) else "General")
        canonical_algorithms = problem.get("canonical_algorithms") or problem.get("canonicalAlgorithms") or []
        
        celebration = (
            f"Excellent work! Your {difficulty} solution is correct. "
            f"You've demonstrated solid understanding of {category} concepts."
        )
        
        pattern_note = None
        if canonical_algorithms:
            algo_names = [a.replace("_", " ") for a in canonical_algorithms[:2]]
            pattern_note = f"Correct use of {' and '.join(algo_names)}"
        
        return FeedbackResponse(
            explanation=celebration,
            improvement_hint="Solution accepted. Try similar problems to reinforce these concepts.",
            detected_pattern=pattern_note,
            concept_reinforcement=f"You've mastered the core {category} pattern for this problem type.",
        )

    # -------------------------
    # v3.3: ALGORITHM DETECTION + SUBTYPE CONTEXT
    # -------------------------
    code = payload.get("code", "")
    language = payload.get("language", "python")
    problem = payload.get("problem", {})
    problem_category = payload.get("problem_category", problem.get("category", "General"))
    problem_tags = problem.get("tags", [])
    
    canonical_from_db = problem.get("canonical_algorithms") or problem.get("canonicalAlgorithms")
    
    algo_analysis = analyze_user_algorithm(
        code=code,
        problem_category=problem_category,
        problem_tags=problem_tags,
        canonical_from_db=canonical_from_db
    )
    
    logger.debug(f"   └─ Detected algorithm: {algo_analysis['user_algorithm']}")

    # -------------------------
    # Build context with MIM subtype and failure mechanism
    # -------------------------
    enhanced_context = context
    
    # Add MIM diagnosis context with subtype
    if mim_decision:
        subtype = mim_decision.feedback_instruction.root_cause_subtype or "unspecified"
        failure_mechanism = mim_decision.feedback_instruction.failure_mechanism or "Review the algorithm approach"
        
        mim_context = f"""
═══════════════════════════════════════════════════════════════════════════════
MIM DIAGNOSIS (v3.3 - USE THIS, DON'T CONTRADICT)
═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSE: {mim_decision.root_cause}
SUBTYPE: {subtype}
FAILURE_MECHANISM: {failure_mechanism}
CONFIDENCE: {mim_decision.root_cause_confidence:.0%}
TONE: {mim_decision.feedback_instruction.tone}
IS_RECURRING: {mim_decision.feedback_instruction.is_recurring_mistake}
RECURRENCE_COUNT: {mim_decision.feedback_instruction.recurrence_count}

USER'S ALGORITHM: {algo_analysis['user_algorithm']}
CANONICAL ALGORITHMS: {', '.join(algo_analysis['canonical_algorithms'])}

EDGE CASES TO CHECK: {', '.join(mim_decision.feedback_instruction.edge_cases_likely)}

USER'S LANGUAGE: {language}
═══════════════════════════════════════════════════════════════════════════════
"""
        enhanced_context = f"{mim_context}\n\n{enhanced_context}"
        
        logger.debug(f"   └─ MIM subtype: {subtype}")
        logger.debug(f"   └─ Failure mechanism: {failure_mechanism}")

    # -------------------------
    # Cache key
    # -------------------------
    cache_key = build_cache_key(
        "feedback_agent_v3.3",
        {
            **payload,
            "code_hash": hash(code),
            "mim_root_cause": mim_decision.root_cause if mim_decision else "none",
            "mim_subtype": mim_decision.feedback_instruction.root_cause_subtype if mim_decision else "none",
        },
    )

    # Build fallback with MIM data
    fallback_pattern = None
    fallback_subtype = None
    fallback_mechanism = None
    
    if mim_decision:
        fallback_pattern = f"{mim_decision.root_cause.replace('_', ' ').title()}"
        if mim_decision.feedback_instruction.root_cause_subtype:
            fallback_pattern += f" - {mim_decision.feedback_instruction.root_cause_subtype.replace('_', ' ')}"
        fallback_subtype = mim_decision.feedback_instruction.root_cause_subtype
        fallback_mechanism = mim_decision.feedback_instruction.failure_mechanism

    return run_json_agent(
        agent_name="feedback_agent",
        context=enhanced_context,
        cache_key=cache_key,
        schema=FeedbackResponse,
        system_prompt=FEEDBACK_SYSTEM_PROMPT,
        fallback=FeedbackResponse(
            explanation=(
                f"The submission failed due to {mim_decision.root_cause.replace('_', ' ') if mim_decision else 'a logical issue'}. "
                f"{fallback_mechanism or 'Review the algorithm approach and trace through edge cases.'}"
            ),
            improvement_hint="Focus on the specific failure mechanism identified above.",
            detected_pattern=fallback_pattern,
            root_cause=mim_decision.root_cause if mim_decision else None,
            root_cause_subtype=fallback_subtype,
            failure_mechanism=fallback_mechanism,
            complexity_analysis="Review time and space complexity manually.",
            edge_cases=mim_decision.feedback_instruction.edge_cases_likely if mim_decision else None,
            concept_reinforcement="Review the core algorithmic concept required for this problem type.",
        ),
    )
