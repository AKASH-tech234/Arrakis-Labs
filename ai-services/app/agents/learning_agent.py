import logging
from app.schemas.learning import LearningRecommendation
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("learning_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# v3.0: MIM-INSTRUCTED LEARNING RECOMMENDATION PROMPT (RATIONALE ONLY)
# ═══════════════════════════════════════════════════════════════════════════════

LEARNING_SYSTEM_PROMPT = """You are a learning advisor for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (v3.0 - MIM-Instructed)
═══════════════════════════════════════════════════════════════════════════════
MIM has ALREADY selected the focus areas. Your job is to explain WHY.

You are NOT selecting topics - MIM already did that.
You are providing the educational rationale for MIM's selections.

═══════════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE
═══════════════════════════════════════════════════════════════════════════════
1. FOCUS AREAS: MIM-selected topics (USE THESE EXACTLY)
2. SKILL GAP: The specific weakness identified
3. WEAK TOPIC CONNECTION: If this relates to user's known weak area

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "focus_areas": ["Use MIM's areas EXACTLY - do not modify"],
  "rationale": "1-2 sentences explaining WHY these areas matter for THIS mistake and this user"
}}

═══════════════════════════════════════════════════════════════════════════════
RATIONALE WRITING GUIDE
═══════════════════════════════════════════════════════════════════════════════
GOOD RATIONALE:
"Your off-by-one error suggests you'd benefit from Loop Invariant Analysis. 
This is especially important since arrays are a recurring weak area for you."

BAD RATIONALE:
"You should study these topics."
"These are important areas."
→ Too generic, no connection to mistake or user

═══════════════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════════════
✓ USE the focus areas MIM provides EXACTLY
✓ Explain the connection between focus area and the mistake
✓ Mention weak topic connection if provided
✗ NEVER change or add to MIM's focus areas
✗ NEVER be generic - connect to THIS mistake"""


def learning_agent(context: str, payload: dict, mim_decision=None) -> LearningRecommendation:
    """
    Generate learning recommendations using MIM instructions.
    
    v3.0: MIM provides focus areas, agent adds rationale only.
    
    Args:
        context: Assembled context string
        payload: Submission data
        mim_decision: MIMDecision with learning instructions (optional)
    """
    logger.debug(f"📨 learning_agent v3.0 called | has_mim={mim_decision is not None}")
    
    # Build context based on MIM availability
    if mim_decision:
        # Use MIM's pre-computed learning context
        enhanced_context = mim_decision.get_learning_context()
        enhanced_context += f"\n\n{context}"
        
        logger.debug(f"   └─ MIM focus areas: {mim_decision.learning_instruction.focus_areas}")
        logger.debug(f"   └─ Skill gap: {mim_decision.learning_instruction.skill_gap}")
    else:
        enhanced_context = context
    
    # Cache key
    cache_key = build_cache_key(
        "learning_agent_v3", 
        {
            "mim_focus": tuple(mim_decision.learning_instruction.focus_areas) if mim_decision else (),
            "skill_gap": mim_decision.learning_instruction.skill_gap if mim_decision else "none",
        }
    )
    
    # If we have MIM decision, use its focus areas in fallback
    fallback_areas = (
        mim_decision.learning_instruction.focus_areas 
        if mim_decision else ["Fundamentals"]
    )
    fallback_rationale = (
        f"Focus on {mim_decision.learning_instruction.skill_gap} to address this mistake."
        if mim_decision else "Review core concepts for this problem category."
    )
    
    return run_json_agent(
        agent_name="learning_agent",
        context=enhanced_context,
        cache_key=cache_key,
        schema=LearningRecommendation,
        system_prompt=LEARNING_SYSTEM_PROMPT,
        fallback=LearningRecommendation(
            focus_areas=fallback_areas,
            rationale=fallback_rationale
        )
    )
