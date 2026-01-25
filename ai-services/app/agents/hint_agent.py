"""
Hint Agent v3.0 - MIM-Instructed
================================

PHILOSOPHY: Agent compresses MIM's hint direction into 20 words.

This agent receives:
1. Hint direction from MIM (what to point toward)
2. Avoid list (concepts that would reveal the solution)
3. User weak topic info (for encouraging tone if relevant)

The agent's ONLY job is linguistic compression - not deciding what to hint.
"""

import logging
from app.schemas.hint import CompressedHint
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("hint_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# v3.0: MIM-INSTRUCTED HINT COMPRESSION PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

HINT_SYSTEM_PROMPT = """You are a hint compressor for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (v3.0 - MIM-Instructed)
═══════════════════════════════════════════════════════════════════════════════
MIM has decided WHAT to hint at. Your job is to compress it into 20 words.

You are NOT deciding the hint direction - MIM already did that.
You are making MIM's hint direction into a crisp, actionable sentence.

═══════════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE
═══════════════════════════════════════════════════════════════════════════════
1. HINT DIRECTION: The specific thing to point the user toward
2. AVOID LIST: Words/concepts that would reveal too much
3. WEAK TOPIC NOTE: If this touches user's weak area (be encouraging)

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
✓ Point toward MIM's direction without using avoid words
✓ Be encouraging if user's weak topic is mentioned

✗ NEVER use words from the AVOID list
✗ NEVER exceed 20 words
✗ NEVER reveal algorithms or data structures by name

═══════════════════════════════════════════════════════════════════════════════
COMPRESSION EXAMPLES
═══════════════════════════════════════════════════════════════════════════════
Direction: "Consider what happens when input is empty or has one element"
Compressed: "Consider the simplest possible inputs - what would your code return?"

Direction: "Think about whether you can avoid checking every pair"
Compressed: "Think about whether there's a way to reduce repeated comparisons."

Direction: "Check loop bounds for first and last iteration"
Compressed: "Trace through your loop for the first and last elements carefully."
"""


def hint_agent(raw_hint: str, payload: dict, mim_decision=None) -> CompressedHint:
    """
    Compress hint using MIM instructions.
    
    v3.1: OPTIMIZED - Minimal context for fast execution.
    Agent's job is ONLY to compress into 20 words.
    
    CONTEXT LIMIT: < 500 chars total (for speed)
    
    Args:
        raw_hint: Improvement hint from feedback (backward compat)
        payload: Submission data
        mim_decision: MIMDecision with hint instructions (optional)
    """
    logger.debug(f"✂️ hint_agent v3.1 called | has_mim={mim_decision is not None}")

    # v3.1: MINIMAL context - hints don't need deep reasoning
    # Only pass: MIM direction + one sentence from feedback
    if mim_decision:
        # Extract ONLY the essentials - no history, no full context
        hint_direction = mim_decision.hint_instruction.hint_direction[:200]
        avoid_words = ", ".join(mim_decision.hint_instruction.avoid_revealing[:3])
        
        # One sentence from feedback (first sentence only)
        feedback_snippet = (raw_hint.split(".")[0][:100] + ".") if raw_hint else ""
        
        augmented_context = f"""HINT DIRECTION: {hint_direction}
AVOID: {avoid_words}
FEEDBACK: {feedback_snippet}

Compress into ONE sentence (max 20 words). Start with action verb."""
        
        logger.debug(f"   └─ Context size: {len(augmented_context)} chars (optimized)")
    else:
        # Fallback: minimal context
        feedback_snippet = (raw_hint.split(".")[0][:100] + ".") if raw_hint else "Review your approach."
        
        augmented_context = f"""HINT TO COMPRESS: {feedback_snippet}
Compress into ONE actionable sentence (max 20 words). Start with action verb."""

    # Cache key - simpler for optimized context
    cache_key = build_cache_key(
        "hint_agent_v3.1", 
        {
            "hint_hash": hash(raw_hint[:50]) if raw_hint else 0,
            "mim_direction": mim_decision.hint_instruction.hint_direction[:30] if mim_decision else "none",
        }
    )

    return run_json_agent(
        agent_name="hint_agent",
        context=augmented_context,
        cache_key=cache_key,
        schema=CompressedHint,
        system_prompt=HINT_SYSTEM_PROMPT,
        timeout_seconds=8,  # v3.1: Reduced timeout - hints should be fast
        fallback=CompressedHint(
            hint=mim_decision.hint_instruction.hint_direction[:100] if mim_decision 
                 else (raw_hint.split(".")[0][:100] if raw_hint else "Review your approach carefully.")
        )
    )
