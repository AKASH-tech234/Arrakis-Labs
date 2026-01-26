"""
Hint Agent v3.3 - Subtype-Aware
===============================

PHILOSOPHY: Agent compresses MIM's hint direction into 20 words.

v3.3 UPGRADE:
- Uses MIM subtype to focus hints correctly
- Correctness subtype → correctness hints (NO efficiency)
- Efficiency subtype → efficiency hints
"""

import logging
from app.schemas.hint import CompressedHint
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("hint_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# v3.3: SUBTYPE-AWARE HINT COMPRESSION PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

HINT_SYSTEM_PROMPT = """You are a hint compressor for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (v3.3 - Subtype-Aware)
═══════════════════════════════════════════════════════════════════════════════
MIM has decided WHAT to hint at + the SUBTYPE of the problem.

Your job: Compress into 20 words, aligned with the SUBTYPE.

═══════════════════════════════════════════════════════════════════════════════
SUBTYPE RULES (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
CORRECTNESS SUBTYPES (wrong_invariant, wrong_data_structure, logic_error):
- Focus on WHAT property is violated
- DON'T mention efficiency - that's not the problem
- Examples:
  - "Consider what property your algorithm needs to preserve through the operation."
  - "Think about which edge case your logic doesn't handle."

EFFICIENCY SUBTYPES (brute_force, time_complexity, premature_optimization):
- Focus on reducing work
- Mention complexity reduction
- Examples:
  - "Consider if there's redundant computation you can avoid."
  - "Think about whether a data structure could speed up lookups."

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
✓ ALIGN with SUBTYPE (correctness vs efficiency)
✓ Point toward MIM's direction without using avoid words

✗ NEVER use words from the AVOID list
✗ NEVER exceed 20 words
✗ NEVER reveal algorithms or data structures by name
✗ NEVER give efficiency hints for correctness problems
✗ NEVER give correctness hints for efficiency problems

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES BY SUBTYPE
═══════════════════════════════════════════════════════════════════════════════
SUBTYPE: wrong_invariant
Direction: "Sorting destroys original indices needed for lookup"
Compressed: "Consider what property of the input your operation destroys that you still need."

SUBTYPE: brute_force
Direction: "O(n²) loop can be reduced using hash map"
Compressed: "Think about whether you can trade space for time to avoid nested iteration."

SUBTYPE: logic_error
Direction: "Off-by-one in loop bounds"
Compressed: "Trace through your loop bounds for the first and last elements carefully."
"""


def hint_agent(raw_hint: str, payload: dict, mim_decision=None) -> CompressedHint:
    """
    Compress hint using MIM instructions + subtype awareness.
    
    v3.3: Subtype-aware hinting.
    - Correctness subtypes get correctness hints
    - Efficiency subtypes get efficiency hints
    - Never cross the streams
    
    Args:
        raw_hint: Improvement hint from feedback (backward compat)
        payload: Submission data
        mim_decision: MIMDecision with hint instructions (optional)
    """
    logger.debug(f"✂️ hint_agent v3.3 called | has_mim={mim_decision is not None}")

    # v3.3: Include subtype in context
    if mim_decision:
        hint_direction = mim_decision.hint_instruction.hint_direction[:200]
        avoid_words = ", ".join(mim_decision.hint_instruction.avoid_revealing[:3])
        
        # Get subtype from feedback instruction (MIM sets it)
        subtype = getattr(mim_decision.feedback_instruction, 'root_cause_subtype', None) or 'unspecified'
        failure_mechanism = getattr(mim_decision.feedback_instruction, 'failure_mechanism', None) or ''
        
        # Categorize subtype
        correctness_subtypes = {'wrong_invariant', 'wrong_data_structure', 'logic_error', 'off_by_one'}
        efficiency_subtypes = {'brute_force', 'time_complexity', 'premature_optimization'}
        
        if subtype in correctness_subtypes:
            subtype_category = "CORRECTNESS"
            focus = "Focus on WHAT property is violated. NO efficiency hints."
        elif subtype in efficiency_subtypes:
            subtype_category = "EFFICIENCY"
            focus = "Focus on reducing work/complexity."
        else:
            subtype_category = "GENERAL"
            focus = "Focus on the specific issue."
        
        feedback_snippet = (raw_hint.split(".")[0][:100] + ".") if raw_hint else ""
        
        augmented_context = f"""SUBTYPE: {subtype} ({subtype_category})
HINT DIRECTION: {hint_direction}
FAILURE: {failure_mechanism[:100]}
AVOID: {avoid_words}
FEEDBACK: {feedback_snippet}

{focus}
Compress into ONE sentence (max 40 words). Start with action verb."""
        
        logger.debug(f"   └─ Subtype: {subtype} ({subtype_category})")
        logger.debug(f"   └─ Context size: {len(augmented_context)} chars")
    else:
        # Fallback: minimal context
        feedback_snippet = (raw_hint.split(".")[0][:100] + ".") if raw_hint else "Review your approach."
        
        augmented_context = f"""HINT TO COMPRESS: {feedback_snippet}
Compress into ONE actionable sentence (max 20 words). Start with action verb."""

    # Cache key
    cache_key = build_cache_key(
        "hint_agent_v3.3", 
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
