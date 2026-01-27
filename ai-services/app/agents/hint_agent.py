"""
Hint Agent V3.0 - Subtype-Aware
===============================

PHILOSOPHY: Agent compresses MIM's hint direction into 20 words.

V3.0 UPGRADE:
- Uses new 4-category taxonomy with 7 subtypes
- Correctness/implementation subtypes → correctness hints (NO efficiency)
- Efficiency subtypes → efficiency hints
"""

import logging
from app.schemas.hint import CompressedHint
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("hint_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# V3.0: SUBTYPE-AWARE HINT COMPRESSION PROMPT (NEW TAXONOMY)
# ═══════════════════════════════════════════════════════════════════════════════

HINT_SYSTEM_PROMPT = """You are a hint compressor for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (V3.0 - Subtype-Aware)
═══════════════════════════════════════════════════════════════════════════════
MIM has decided WHAT to hint at + the ROOT_CAUSE and SUBTYPE.

Your job: Compress into 20 words, aligned with the ROOT_CAUSE and SUBTYPE.

═══════════════════════════════════════════════════════════════════════════════
V3.0 TAXONOMY (USE THESE EXACTLY)
═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSES (4 categories):
- correctness: Algorithm logic error
- efficiency: Time/space complexity issue
- implementation: Coding bug (off-by-one, state loss)
- understanding_gap: Problem/constraint misread

SUBTYPES (7 total):
- wrong_invariant: Loop invariant doesn't hold
- incorrect_boundary: Off-by-one or wrong comparison
- partial_case_handling: Missing edge cases
- state_loss: Variable state lost
- brute_force_under_constraints: Too slow
- premature_optimization: Optimization broke correctness
- misread_constraint: Constraint misunderstood

═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSE RULES (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
CORRECTNESS ROOT_CAUSE (subtypes: wrong_invariant, partial_case_handling):
- Focus on WHAT property is violated
- DON'T mention efficiency - that's not the problem
- Examples:
  - "Consider what property your algorithm needs to preserve through the operation."
  - "Think about which edge case your logic doesn't handle."

IMPLEMENTATION ROOT_CAUSE (subtypes: incorrect_boundary, state_loss):
- Focus on coding bugs
- Mention boundary conditions or variable scope
- Examples:
  - "Check your loop bounds at the first and last elements."
  - "Trace what happens to your variable inside the loop."

EFFICIENCY ROOT_CAUSE (subtypes: brute_force_under_constraints, premature_optimization):
- Focus on reducing work
- Mention complexity reduction
- Examples:
  - "Consider if there's redundant computation you can avoid."
  - "Think about whether a data structure could speed up lookups."

UNDERSTANDING_GAP ROOT_CAUSE (subtype: misread_constraint):
- Focus on re-reading constraints
- Examples:
  - "Re-read the constraint on input size."
  - "Check if you understood the problem's edge case requirements."

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "hint": "Your 20-word-max compressed hint"
}}

═══════════════════════════════════════════════════════════════════════════════
COMPRESSION RULES
═══════════════════════════════════════════════════════════════════════════════
✓ Start with an action verb: "Consider...", "Check...", "Think about..."
✓ Maximum 20 words (HARD LIMIT)
✓ ALIGN with ROOT_CAUSE (correctness vs efficiency vs implementation vs understanding_gap)
✓ Point toward MIM's direction without using avoid words

✗ NEVER use words from the AVOID list
✗ NEVER exceed 20 words
✗ NEVER reveal algorithms or data structures by name
✗ NEVER give efficiency hints for correctness problems
✗ NEVER give correctness hints for efficiency problems

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES BY ROOT_CAUSE AND SUBTYPE
═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSE: correctness, SUBTYPE: wrong_invariant
Direction: "Sorting destroys original indices needed for lookup"
Compressed: "Consider what property of the input your operation destroys that you still need."

ROOT_CAUSE: efficiency, SUBTYPE: brute_force_under_constraints
Direction: "O(n²) loop can be reduced using hash map"
Compressed: "Think about whether you can trade space for time to avoid nested iteration."

ROOT_CAUSE: implementation, SUBTYPE: incorrect_boundary
Direction: "Off-by-one in loop bounds"
Compressed: "Trace through your loop bounds for the first and last elements carefully."

ROOT_CAUSE: understanding_gap, SUBTYPE: misread_constraint
Direction: "Problem allows k=0 but solution assumes k>=1"
Compressed: "Re-read the constraints. Check if your solution handles the minimum case."
"""


def hint_agent(raw_hint: str, payload: dict, mim_decision=None) -> CompressedHint:
    """
    Compress hint using MIM instructions + subtype awareness.
    
    V3.0: Root cause and subtype-aware hinting using new 4-category taxonomy.
    - correctness/implementation → correctness hints
    - efficiency → efficiency hints
    - understanding_gap → constraint reading hints
    - Never cross the streams
    
    Args:
        raw_hint: Improvement hint from feedback (backward compat)
        payload: Submission data
        mim_decision: MIMDecision with hint instructions (optional)
    """
    logger.debug(f"✂️ hint_agent V3.0 called | has_mim={mim_decision is not None}")

    # V3.0: Include root_cause and subtype in context
    if mim_decision:
        hint_direction = mim_decision.hint_instruction.hint_direction[:200]
        avoid_words = ", ".join(mim_decision.hint_instruction.avoid_revealing[:3])
        
        # Get root_cause and subtype from feedback instruction (MIM sets it)
        root_cause = getattr(mim_decision.feedback_instruction, 'root_cause', None) or 'correctness'
        subtype = getattr(mim_decision.feedback_instruction, 'root_cause_subtype', None) or 'unspecified'
        failure_mechanism = getattr(mim_decision.feedback_instruction, 'failure_mechanism', None) or ''
        
        # V3.0: Categorize by ROOT_CAUSE (new taxonomy)
        if root_cause in {'correctness', 'implementation'}:
            subtype_category = "CORRECTNESS"
            focus = "Focus on WHAT property is violated or coding bug. NO efficiency hints."
        elif root_cause == 'efficiency':
            subtype_category = "EFFICIENCY"
            focus = "Focus on reducing work/complexity."
        elif root_cause == 'understanding_gap':
            subtype_category = "UNDERSTANDING"
            focus = "Focus on re-reading constraints and problem statement."
        else:
            subtype_category = "GENERAL"
            focus = "Focus on the specific issue."
        
        feedback_snippet = (raw_hint.split(".")[0][:100] + ".") if raw_hint else ""
        
        augmented_context = f"""ROOT_CAUSE: {root_cause}
SUBTYPE: {subtype} ({subtype_category})
HINT DIRECTION: {hint_direction}
FAILURE: {failure_mechanism[:100]}
AVOID: {avoid_words}
FEEDBACK: {feedback_snippet}

{focus}
Compress into ONE sentence (max 40 words). Start with action verb."""
        
        logger.debug(f"   └─ Root cause: {root_cause}, Subtype: {subtype} ({subtype_category})")
        logger.debug(f"   └─ Context size: {len(augmented_context)} chars")
    else:
        # Fallback: minimal context
        feedback_snippet = (raw_hint.split(".")[0][:100] + ".") if raw_hint else "Review your approach."
        
        augmented_context = f"""HINT TO COMPRESS: {feedback_snippet}
Compress into ONE actionable sentence (max 20 words). Start with action verb."""

    # Cache key
    cache_key = build_cache_key(
        "hint_agent_V3.0", 
        {
            "hint_hash": hash(raw_hint[:50]) if raw_hint else 0,
            "mim_direction": mim_decision.hint_instruction.hint_direction[:30] if mim_decision else "none",
            "subtype": subtype if mim_decision else "none",
        }
    )

    return run_json_agent(
        agent_name="hint_agent",
        context=augmented_context,
        cache_key=cache_key,
        schema=CompressedHint,
        system_prompt=HINT_SYSTEM_PROMPT,
        timeout_seconds=8,
        fallback=CompressedHint(
            hint=mim_decision.hint_instruction.hint_direction[:100] if mim_decision 
                 else (raw_hint.split(".")[0][:100] if raw_hint else "Review your approach carefully.")
        )
    )
