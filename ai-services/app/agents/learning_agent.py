import logging
from app.schemas.learning import LearningRecommendation
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("learning_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# v3.3: CONCEPT-LEVEL LEARNING PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

LEARNING_SYSTEM_PROMPT = """You are a learning advisor for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR ROLE (v3.3 - Concept-Level Reinforcement)
═══════════════════════════════════════════════════════════════════════════════
MIM has identified the ROOT_CAUSE and SUBTYPE. Your job is to provide
CONCEPT-LEVEL learning recommendations, not taxonomy-level.

v3.3 UPGRADE:
- Replace "Arrays" → "Invariants preserved under array operations"
- Replace "Binary Search" → "Monotonicity recognition in search problems"
- Be SPECIFIC about the concept, not the category

═══════════════════════════════════════════════════════════════════════════════
WHAT YOU RECEIVE
═══════════════════════════════════════════════════════════════════════════════
1. ROOT_CAUSE: e.g., algorithm_choice
2. SUBTYPE: e.g., wrong_invariant
3. FAILURE_MECHANISM: e.g., "sorting destroys position info"
4. FOCUS AREAS: MIM-selected topics (refine these with concepts)
5. WEAK TOPIC CONNECTION: If this relates to user's known weak area

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "focus_areas": [
    "Concept-level description (not just topic name)",
    "e.g., 'Understanding which invariants are preserved under sorting'",
    "e.g., 'Recognizing when greedy fails due to overlapping subproblems'"
  ],
  "rationale": "2-3 sentences explaining WHY these concepts matter for THIS mistake. Connect to the SUBTYPE.",
  "exercises": [
    "Practice problem suggestions - optional, can be empty array",
    "Similar problems that reinforce the concept"
  ],
  "summary": "One-line takeaway. E.g., 'Master invariant identification before applying transformations.'"
}}

═══════════════════════════════════════════════════════════════════════════════
CONCEPT-LEVEL vs TAXONOMY-LEVEL (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════
BAD (Taxonomy - DON'T DO THIS):
- "Arrays"
- "Hash Tables"
- "Binary Search"
- "Dynamic Programming"

GOOD (Concept-Level):
- "Understanding which properties of an array must be preserved across operations"
- "Recognizing when O(1) lookup is needed vs when sorted access is needed"
- "Identifying monotonicity in the search space for binary search applicability"
- "Breaking problems into independent subproblems vs overlapping ones"

═══════════════════════════════════════════════════════════════════════════════
SUBTYPE-TO-CONCEPT MAPPING (USE THIS)
═══════════════════════════════════════════════════════════════════════════════
wrong_invariant:
- "Identifying invariants that must be preserved under operations"
- "Choosing data structures that maintain required properties"

wrong_data_structure:
- "Matching operation patterns to data structure strengths"
- "Understanding space-time tradeoffs for different structures"

brute_force:
- "Recognizing optimization patterns (sorting, hashing, preprocessing)"
- "Identifying redundant computation for elimination"

time_complexity:
- "Understanding constraint-to-complexity mapping"
- "Recognizing when n² is acceptable vs when it must be n log n"

logic_error:
- "Systematic edge case enumeration"
- "Off-by-one prevention patterns (closed vs open intervals)"

off_by_one:
- "Loop bound reasoning (< vs <=, 0-indexed vs 1-indexed)"
- "Array access at boundaries"

═══════════════════════════════════════════════════════════════════════════════
RATIONALE WRITING GUIDE
═══════════════════════════════════════════════════════════════════════════════
GOOD RATIONALE:
"Your sorting destroyed the index information needed for lookup. This indicates 
a gap in 'invariant identification' - recognizing what properties must be 
preserved. This is especially relevant since array problems are a recurring area."

BAD RATIONALE:
"You should study arrays and hash tables."
"These are important topics."
→ Too generic, no connection to the specific failure mechanism

═══════════════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════════════
✓ Transform MIM's focus areas into concept-level descriptions
✓ Explain the connection between concept and the SUBTYPE
✓ Mention weak topic connection if provided
✓ Include exercises if relevant similar problems exist
✗ NEVER give taxonomy-level recommendations ("Arrays", "DP")
✗ NEVER be generic - connect to the specific failure mechanism
✗ NEVER add unrelated topics - stay focused on the diagnosed issue"""


def learning_agent(context: str, payload: dict, mim_decision=None) -> LearningRecommendation:
    """
    Generate learning recommendations with concept-level focus.
    
    v3.3: Concept-level recommendations, not taxonomy-level.
    - "Invariant preservation" instead of "Arrays"
    - "Monotonicity recognition" instead of "Binary Search"
    
    Args:
        context: Assembled context string
        payload: Submission data
        mim_decision: MIMDecision with learning instructions (optional)
    """
    logger.debug(f"📨 learning_agent v3.3 called | has_mim={mim_decision is not None}")
    
    # Build context based on MIM availability
    if mim_decision:
        # Get subtype for concept mapping
        subtype = getattr(mim_decision.feedback_instruction, 'root_cause_subtype', None) or 'unspecified'
        failure_mechanism = getattr(mim_decision.feedback_instruction, 'failure_mechanism', None) or ''
        
        # Use MIM's pre-computed learning context + add subtype info
        enhanced_context = f"""
═══════════════════════════════════════════════════════════════════════════════
MIM DIAGNOSIS FOR CONCEPT MAPPING
═══════════════════════════════════════════════════════════════════════════════
ROOT_CAUSE: {mim_decision.root_cause}
SUBTYPE: {subtype}
FAILURE_MECHANISM: {failure_mechanism}

USE THE SUBTYPE-TO-CONCEPT MAPPING to transform focus areas into concept-level.
═══════════════════════════════════════════════════════════════════════════════

{mim_decision.get_learning_context()}

{context}"""
        
        logger.debug(f"   └─ MIM focus areas: {mim_decision.learning_instruction.focus_areas}")
        logger.debug(f"   └─ Subtype: {subtype}")
        logger.debug(f"   └─ Skill gap: {mim_decision.learning_instruction.skill_gap}")
    else:
        enhanced_context = context
    
    # Cache key
    subtype_key = "none"
    if mim_decision and hasattr(mim_decision.feedback_instruction, 'root_cause_subtype'):
        subtype_key = mim_decision.feedback_instruction.root_cause_subtype or "none"
    
    cache_key = build_cache_key(
        "learning_agent_v3.3", 
        {
            "mim_focus": tuple(mim_decision.learning_instruction.focus_areas) if mim_decision else (),
            "skill_gap": mim_decision.learning_instruction.skill_gap if mim_decision else "none",
            "subtype": subtype_key,
        }
    )
    
    # Build concept-level fallback based on subtype
    if mim_decision:
        subtype = getattr(mim_decision.feedback_instruction, 'root_cause_subtype', None) or 'unspecified'
        failure_mechanism = getattr(mim_decision.feedback_instruction, 'failure_mechanism', None) or ''
        
        # Concept-level fallback mapping
        concept_fallbacks = {
            "wrong_invariant": ["Understanding invariants preserved under operations", "Choosing transformations that maintain required properties"],
            "wrong_data_structure": ["Matching operation patterns to data structure strengths", "Understanding access pattern requirements"],
            "brute_force": ["Identifying redundant computation", "Recognizing optimization opportunities"],
            "time_complexity": ["Constraint-to-complexity mapping", "Algorithm selection by input size"],
            "logic_error": ["Systematic edge case enumeration", "Boundary condition reasoning"],
            "off_by_one": ["Loop bound reasoning", "Array boundary access patterns"],
        }
        
        fallback_areas = concept_fallbacks.get(
            subtype, 
            mim_decision.learning_instruction.focus_areas
        )
        
        fallback_rationale = (
            f"The {subtype.replace('_', ' ')} issue indicates a gap in understanding "
            f"{mim_decision.learning_instruction.skill_gap}. "
            f"Focus on the concept-level patterns to prevent this mistake pattern."
        )
    else:
        fallback_areas = ["Algorithmic thinking patterns", "Problem decomposition"]
        fallback_rationale = "Review core algorithmic concepts for this problem type."
    
    return run_json_agent(
        agent_name="learning_agent",
        context=enhanced_context,
        cache_key=cache_key,
        schema=LearningRecommendation,
        system_prompt=LEARNING_SYSTEM_PROMPT,
        fallback=LearningRecommendation(
            focus_areas=fallback_areas,
            rationale=fallback_rationale,
            exercises=[],
            summary="Focus on the concept-level pattern underlying this mistake."
        )
    )
