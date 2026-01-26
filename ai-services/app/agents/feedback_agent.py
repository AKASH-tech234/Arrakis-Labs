"""
Feedback Agent v3.2 - Algorithm-Grounded
========================================

PHILOSOPHY: Agent is the VOICE, MIM is the BRAIN.

v3.2 UPGRADE: Now includes algorithm detection and grounding.
- Detects user's algorithm approach before LLM call
- Compares against canonical algorithms for the problem
- Prevents hallucinated algorithm suggestions

This agent receives pre-computed instructions from MIM and:
1. Uses MIM's root cause as the definitive diagnosis
2. Adds code-specific evidence to support the diagnosis
3. Verbalizes the feedback in a helpful, educational tone
4. v3.2: Grounds algorithm feedback against canonical solutions

ELIMINATES:
- Root cause guessing (MIM provides this)
- Pattern detection duplication (MIM provides this)
- Generic feedback (MIM provides personalization data)
- v3.2: Algorithm hallucination (detector provides grounding)
"""

import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key
from app.utils.algorithm_detector import analyze_user_algorithm, detect_algorithm

logger = logging.getLogger("feedback_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# v3.2: MIM-INSTRUCTED + ALGORITHM-GROUNDED FEEDBACK PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

FEEDBACK_SYSTEM_PROMPT = """You are an expert competitive programming reviewer.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (v3.2 - MIM-Instructed + Algorithm-Grounded)
═══════════════════════════════════════════════════════════════════════════════
MIM (Meta-Intelligence Model) has ALREADY identified the root cause.
Algorithm Detector has ALREADY identified what algorithm the user is attempting.

Your job is to EXPLAIN with code-specific evidence, NOT to diagnose or guess algorithms.

Think of it like this:
- MIM = Doctor who diagnosed the condition
- Algorithm Detector = Lab that identified the treatment attempted
- You = Nurse who explains the diagnosis to the patient

═══════════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE
═══════════════════════════════════════════════════════════════════════════════
1. ROOT CAUSE (from MIM - definitive, don't contradict)
2. USER'S DETECTED ALGORITHM (from detector - what they're attempting)
3. CANONICAL ALGORITHMS (from problem DB - what's expected)
4. ALGORITHM COMPARISON (match/mismatch status)
5. CONFIDENCE LEVEL, TONE INSTRUCTION, EDGE CASES

═══════════════════════════════════════════════════════════════════════════════
ALGORITHM GROUNDING RULES (v3.2 - CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
MANDATORY:
- Identify what algorithm the user is attempting (USE THE DETECTED ALGORITHM)
- Compare ONLY against the provided CANONICAL_ALGORITHMS
- If user algorithm MATCHES canonical but has bugs → say "IMPLEMENTATION ISSUE"
- If user algorithm does NOT match canonical → say "ALGORITHM MISMATCH"

FORBIDDEN:
- NEVER suggest algorithms not in CANONICAL_ALGORITHMS
- NEVER invent alternative paradigms (e.g., suggesting "disjoint set" for a flow problem)
- NEVER guess at algorithms - use the provided detection
- NEVER say "consider using X" if X is not in canonical list

EXAMPLE (CORRECT):
  User detected: max_flow
  Canonical: [bipartite_matching, max_flow]
  → "Your max-flow approach is appropriate. The issue is in your capacity handling on line 15."

EXAMPLE (INCORRECT - DO NOT DO THIS):
  User detected: max_flow
  Canonical: [bipartite_matching, max_flow]
  → "Consider using a hash map instead" ← WRONG! Hash map is not canonical

═══════════════════════════════════════════════════════════════════════════════
YOUR OUTPUT FORMAT (JSON) - ALL FIELDS REQUIRED
═══════════════════════════════════════════════════════════════════════════════
{{
  "explanation": "3-5 sentences explaining WHY the MIM root cause applies to THIS code. Reference specific lines/constructs. If recurring, acknowledge the pattern.",
  
  "improvement_hint": "15-30 words pointing toward the fix WITHOUT giving the answer.",
  
  "detected_pattern": "Use MIM's pattern if provided, otherwise derive from root cause.",
  
  "complexity_analysis": "Time: O(...), Space: O(...) - analyze the actual code.",
  
  "edge_cases": ["List 2-3 from MIM's suggestions + any you identify in code"],
  
  "optimization_tips": ["1-2 specific optimizations if applicable, null if not"]
}}

═══════════════════════════════════════════════════════════════════════════════
TONE GUIDE (from MIM instruction)
═══════════════════════════════════════════════════════════════════════════════
ENCOURAGING (burnout risk high):
  "Great attempt! The core logic is sound, but there's a subtle issue with..."
  
DIRECT (normal):
  "The submission fails because... Specifically, in your code..."
  
FIRM (recurring mistake, 3+ times):
  "This is the same mistake pattern from before. Let's address it directly..."

═══════════════════════════════════════════════════════════════════════════════
MANDATORY REQUIREMENTS (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════════════
1. CITE USER'S CODE:
   - Reference specific line numbers (e.g., "On line 5, your for-loop...")
   - Quote actual variable names and function names from their code
   - If code is EMPTY or MISSING, explicitly state: "Your submission appears empty or incomplete"

2. CONTRAST APPROACHES (ONLY using canonical algorithms):
   - State what user's code does: "Your approach uses [DETECTED_ALGORITHM]..."
   - If mismatch: State what's expected: "This problem requires [CANONICAL_ALGORITHM]..."
   - If match: Focus on implementation: "Your [DETECTED_ALGORITHM] has a bug in..."

3. REFERENCE CONSTRAINTS:
   - Mention at least ONE specific constraint from the problem
   - Explain HOW that constraint impacts the solution
   - Example: "With n ≤ 10^6, your O(n²) approach would need 10^12 operations"

4. PERSONALIZE FOR RECURRING ISSUES:
   - If MIM flags is_recurring, say: "You've made this exact mistake before..."
   - Connect to user's weak_topics from profile
   - Suggest pattern to break the cycle

═══════════════════════════════════════════════════════════════════════════════
RULES (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
✓ ALWAYS base explanation on MIM's root cause
✓ ALWAYS use the DETECTED_ALGORITHM as the user's approach
✓ ALWAYS compare against CANONICAL_ALGORITHMS only
✓ ALWAYS add code-specific evidence (line numbers, variable names)
✓ ALWAYS use the tone MIM specifies
✓ If recurring, acknowledge it: "You've encountered this pattern before..."

✗ NEVER contradict MIM's root cause diagnosis
✗ NEVER suggest algorithms outside CANONICAL_ALGORITHMS
✗ NEVER be generic - reference the actual code
✗ NEVER provide corrected code
✗ NEVER say "your code has issues" without citing WHICH lines/constructs
✗ NEVER invent algorithm suggestions - use only what's provided"""


def feedback_agent(context: str, payload: dict, mim_decision=None) -> FeedbackResponse:
    """
    Generate feedback using MIM instructions + Algorithm Grounding.
    
    v3.2: Now includes algorithm detection before LLM call.
    - Detects user's algorithm from code patterns
    - Compares against canonical algorithms
    - Provides grounded context to prevent hallucination
    
    Args:
        context: Assembled context string
        payload: Submission data and problem context
        mim_decision: MIMDecision object with instructions (optional for backward compat)
    """
    logger.debug(
        f"📨 feedback_agent v3.2 called | verdict={payload.get('verdict')} "
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
        
        # Build celebration message based on difficulty
        if difficulty == "Easy":
            celebration = (
                "Well done! Your solution correctly handles all test cases. "
                f"This demonstrates solid understanding of {category} fundamentals."
            )
        elif difficulty == "Medium":
            celebration = (
                "Excellent work! Your solution passed all test cases. "
                f"Your approach to this {category} problem shows strong problem-solving skills."
            )
        else:  # Hard
            celebration = (
                "Outstanding! Solving this hard problem demonstrates advanced skills. "
                f"Your {category} solution is correct and shows deep understanding."
            )
        
        # Pattern confirmation (what they did RIGHT)
        pattern_note = None
        if canonical_algorithms:
            algo_names = [a.replace("_", " ") for a in canonical_algorithms[:2]]
            pattern_note = f"correct use of {' and '.join(algo_names)}"
        
        return FeedbackResponse(
            explanation=celebration,
            improvement_hint="Solution is correct. Consider exploring similar problems to reinforce these concepts.",
            detected_pattern=pattern_note,
            complexity_analysis=None,  # Don't analyze - it's correct
            edge_cases=None,  # Don't suggest - they handled them
            optimization_tips=None,  # Optional optimization can be added later
        )

    # -------------------------
    # v3.2: ALGORITHM DETECTION (Pre-LLM grounding)
    # -------------------------
    code = payload.get("code", "")
    problem = payload.get("problem", {})
    problem_category = payload.get("problem_category", problem.get("category", "General"))
    problem_tags = problem.get("tags", [])
    
    # Get canonical algorithms from problem DB if available
    canonical_from_db = problem.get("canonical_algorithms") or problem.get("canonicalAlgorithms")
    
    # Analyze user's algorithm approach
    algo_analysis = analyze_user_algorithm(
        code=code,
        problem_category=problem_category,
        problem_tags=problem_tags,
        canonical_from_db=canonical_from_db
    )
    
    logger.debug(f"   └─ Detected algorithm: {algo_analysis['user_algorithm']}")
    logger.debug(f"   └─ Canonical algorithms: {algo_analysis['canonical_algorithms']}")
    logger.debug(f"   └─ Comparison: {algo_analysis['comparison']['status']}")

    # -------------------------
    # Build MIM-enhanced context + Algorithm grounding
    # -------------------------
    enhanced_context = context
    
    # Add algorithm grounding section
    algo_context = f"""
═══════════════════════════════════════════════════════════════════════════════
ALGORITHM GROUNDING (v3.2 - Use this, don't contradict)
═══════════════════════════════════════════════════════════════════════════════
USER'S DETECTED ALGORITHM: {algo_analysis['user_algorithm']}
DETECTION CONFIDENCE: {algo_analysis['user_confidence']:.0%}
DETECTION EVIDENCE: {', '.join(algo_analysis['user_evidence'][:3])}

CANONICAL ALGORITHMS FOR THIS PROBLEM: {', '.join(algo_analysis['canonical_algorithms'])}

COMPARISON RESULT: {algo_analysis['comparison']['status']}
GUIDANCE: {algo_analysis['comparison']['guidance']}

IMPORTANT: Base your feedback on THIS comparison. Do NOT suggest algorithms outside the canonical list.
═══════════════════════════════════════════════════════════════════════════════
"""
    
    enhanced_context = f"{algo_context}\n\n{enhanced_context}"
    
    if mim_decision:
        # Add MIM's specific feedback instructions to context
        mim_context = mim_decision.get_feedback_context()
        enhanced_context = f"{mim_context}\n\n{enhanced_context}"
        
        logger.debug(f"   └─ MIM root cause: {mim_decision.root_cause}")
        logger.debug(f"   └─ MIM tone: {mim_decision.feedback_instruction.tone}")
        logger.debug(f"   └─ Is recurring: {mim_decision.feedback_instruction.is_recurring_mistake}")

    # -------------------------
    # Cache key (code-aware + MIM-aware)
    # -------------------------
    problem = payload.get("problem", {})
    
    cache_key = build_cache_key(
        "feedback_agent_v3",
        {
            **payload,
            "code_hash": hash(payload.get("code", "")),
            "mim_root_cause": mim_decision.root_cause if mim_decision else "none",
            "mim_recurring": mim_decision.feedback_instruction.is_recurring_mistake if mim_decision else False,
        },
    )

    logger.debug(f"   └─ Cache key: {cache_key[:16]}...")

    # Use MIM pattern if available, otherwise let agent detect
    mim_pattern = None
    if mim_decision and mim_decision.pattern.pattern_name:
        mim_pattern = mim_decision.pattern.pattern_name

    return run_json_agent(
        agent_name="feedback_agent",
        context=enhanced_context,
        cache_key=cache_key,
        schema=FeedbackResponse,
        system_prompt=FEEDBACK_SYSTEM_PROMPT,
        fallback=FeedbackResponse(
            explanation=(
                f"The submission failed due to {mim_decision.root_cause.replace('_', ' ') if mim_decision else 'a logical issue'}. "
                "This type of error typically occurs when the algorithm logic doesn't handle all expected cases correctly. "
                "Review the specific area mentioned and trace through your code with sample inputs to identify the fix."
            ),
            improvement_hint=(
                "Focus on the identified root cause area and trace through edge cases carefully."
            ),
            detected_pattern=mim_pattern,
            complexity_analysis="Unable to analyze - review manually.",
            edge_cases=mim_decision.feedback_instruction.edge_cases_likely if mim_decision else None,
            optimization_tips=None,
        ),
    )
