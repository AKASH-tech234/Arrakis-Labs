"""
Feedback Agent v3.0 - MIM-Instructed
====================================

PHILOSOPHY: Agent is the VOICE, MIM is the BRAIN.

This agent receives pre-computed instructions from MIM and:
1. Uses MIM's root cause as the definitive diagnosis
2. Adds code-specific evidence to support the diagnosis
3. Verbalizes the feedback in a helpful, educational tone

ELIMINATES:
- Root cause guessing (MIM provides this)
- Pattern detection duplication (MIM provides this)
- Generic feedback (MIM provides personalization data)
"""

import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("feedback_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# v3.0: MIM-INSTRUCTED FEEDBACK PROMPT (STREAMLINED)
# ═══════════════════════════════════════════════════════════════════════════════

FEEDBACK_SYSTEM_PROMPT = """You are an expert competitive programming reviewer.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (v3.0 - MIM-Instructed)
═══════════════════════════════════════════════════════════════════════════════
MIM (Meta-Intelligence Model) has ALREADY identified the root cause.
Your job is to EXPLAIN it with code-specific evidence, NOT to diagnose.

Think of it like this:
- MIM = Doctor who diagnosed the condition
- You = Nurse who explains the diagnosis to the patient

═══════════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE FROM MIM
═══════════════════════════════════════════════════════════════════════════════
1. ROOT CAUSE (definitive - use this, don't contradict)
2. CONFIDENCE LEVEL (high/medium/low)
3. IS RECURRING (has user made this mistake before?)
4. TONE INSTRUCTION (encouraging/direct/firm)
5. EDGE CASES LIKELY (which inputs might fail)

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
RULES (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
✓ ALWAYS base explanation on MIM's root cause
✓ ALWAYS add code-specific evidence (line numbers, variable names)
✓ ALWAYS use the tone MIM specifies
✓ If recurring, acknowledge it: "You've encountered this pattern before..."

✗ NEVER contradict MIM's root cause diagnosis
✗ NEVER be generic - reference the actual code
✗ NEVER provide corrected code"""


def feedback_agent(context: str, payload: dict, mim_decision=None) -> FeedbackResponse:
    """
    Generate feedback using MIM instructions.
    
    v3.0: Receives MIMDecision with pre-computed instructions.
    Agent's job is to add code-specific evidence, NOT to diagnose.
    
    Args:
        context: Assembled context string
        payload: Submission data and problem context
        mim_decision: MIMDecision object with instructions (optional for backward compat)
    """
    logger.debug(
        f"📨 feedback_agent v3.0 called | verdict={payload.get('verdict')} "
        f"| has_mim={mim_decision is not None}"
    )

    # -------------------------
    # ACCEPTED → still provide optimization feedback
    # -------------------------
    verdict = (payload.get("verdict") or "").lower()
    if verdict == "accepted":
        return FeedbackResponse(
            explanation="Congratulations! Your solution correctly handles all test cases. "
                       "The approach you used is valid and produces correct results. "
                       "Consider reviewing the complexity analysis below for potential optimizations.",
            improvement_hint="Solution is correct. Review complexity for potential optimizations.",
            detected_pattern=None,
            complexity_analysis="Analysis not performed for accepted solutions.",
            edge_cases=None,
            optimization_tips=None,
        )

    # -------------------------
    # Build MIM-enhanced context if decision available
    # -------------------------
    enhanced_context = context
    if mim_decision:
        # Add MIM's specific feedback instructions to context
        mim_context = mim_decision.get_feedback_context()
        enhanced_context = f"{mim_context}\n\n{context}"
        
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
