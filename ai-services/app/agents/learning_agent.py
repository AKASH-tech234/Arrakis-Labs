import logging
from app.schemas.learning import LearningRecommendation
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("learning_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# REWRITTEN: PERSONALIZED LEARNING RECOMMENDATION PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

LEARNING_SYSTEM_PROMPT = """You are a personalized learning advisor for competitive programming.

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════
Recommend 2-3 specific learning topics based on:
1. The mistake in THIS submission
2. User's historical WEAK TOPICS
3. The gap between user's approach and EXPECTED APPROACH

═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION ALGORITHM
═══════════════════════════════════════════════════════════════════════════════
STEP 1: Identify the SKILL GAP in this submission
        → What concept/technique did user need but didn't apply?

STEP 2: Check USER'S WEAK TOPICS
        → If this submission's gap overlaps, PRIORITIZE fundamentals

STEP 3: Check EXPECTED APPROACH for the problem
        → If user didn't use expected technique, recommend it

STEP 4: Generate 2-3 specific topics (not vague categories)

═══════════════════════════════════════════════════════════════════════════════
TOPIC SPECIFICITY GUIDE
═══════════════════════════════════════════════════════════════════════════════
❌ TOO VAGUE (don't recommend):
- "Arrays"
- "Algorithms"
- "Data Structures"
- "Practice more"

✓ SPECIFIC (recommend these):
- "Two Pointer Technique for Sorted Arrays"
- "Binary Search Edge Case Handling"
- "DP State Transition Design"
- "Hash Map Collision Strategies"
- "Monotonic Stack for Range Queries"

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "focus_areas": ["Specific Topic 1", "Specific Topic 2", "Specific Topic 3"],
  "rationale": "1-2 sentence explanation connecting the recommendation to the mistake and user history"
}}

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 1 (matches weak topic):
User weak topics: ["Binary Search"]
Current mistake: Off-by-one in binary search
→ focus_areas: ["Binary Search Loop Invariants", "Boundary Condition Verification"]
→ rationale: "Your off-by-one error in binary search matches a recurring weak area. Focus on loop invariants first."

EXAMPLE 2 (new skill gap):
User weak topics: ["Recursion"]
Current mistake: Used O(n²) brute force, expected O(n log n)
→ focus_areas: ["Divide and Conquer Patterns", "Merge Sort Applications"]
→ rationale: "This problem requires divide and conquer, which is new for you. Start with merge sort then generalize."

═══════════════════════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════════════════════
✓ ALWAYS recommend specific techniques, not vague categories
✓ ALWAYS connect to user's weak topics if relevant
✓ ALWAYS explain WHY these topics matter for THIS mistake
✗ NEVER recommend more than 3 topics (focus > breadth)"""


def learning_agent(context: str, payload: dict) -> LearningRecommendation:
    logger.debug(f"📨 learning_agent called")
    
    # Extract structured data
    problem = payload.get("problem", {})
    user_profile = payload.get("user_profile", {})
    
    cache_key = build_cache_key(
        "learning_agent", 
        {
            **payload,
            # Include user's weak topics for personalization
            "weak_topics_hash": hash(tuple(user_profile.get("weak_topics", []))),
            # Include problem category
            "problem_tags": tuple(problem.get("tags", [])),
        }
    )
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    logger.debug(f"   └─ User weak topics: {user_profile.get('weak_topics', [])}")
    logger.debug(f"   └─ Problem tags: {problem.get('tags', [])}")
    
    return run_json_agent(
        agent_name="learning_agent",
        context=context,
        cache_key=cache_key,
        schema=LearningRecommendation,
        system_prompt=LEARNING_SYSTEM_PROMPT,
        fallback=LearningRecommendation(
            focus_areas=["Fundamentals"],
            rationale="Review core concepts for this problem category."
        )
    )
