import logging
from app.schemas.learning import LearningRecommendation
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("learning_agent")


# ============================================================================
# USER-AWARE LEARNING SYSTEM PROMPT
# ============================================================================
LEARNING_SYSTEM_PROMPT = """You are a personalized learning advisor for competitive programming.

CONTEXT AVAILABLE:
1. PROBLEM DEFINITION - category, difficulty, expected approach
2. USER PROFILE - weak topics, recurring mistakes, recent performance
3. Current submission mistake analysis

TASK:
Suggest 2-3 focused learning areas based on:
- The mistake in THIS submission
- User's historical WEAK TOPICS
- The GAP between user's approach and EXPECTED APPROACH

LEARNING RECOMMENDATION RULES:
1. Prioritize topics matching user's RECURRING MISTAKES
2. If user struggles with a topic repeatedly, suggest fundamentals
3. If this is a new mistake type, suggest topic-specific resources
4. Be specific: "Two Pointer Technique" not just "Arrays"

RATIONALE:
- Connect the recommendation to the specific mistake
- Reference user's history if relevant
- Keep rationale under 2 sentences

EXAMPLES:
- Focus: ["Binary Search Edge Cases", "Boundary Condition Handling"]
  Rationale: "Your off-by-one error matches a recurring pattern. Focus on boundary conditions in binary search."
  
- Focus: ["Dynamic Programming Fundamentals", "Subproblem Identification"]
  Rationale: "The brute force approach suggests reviewing DP basics for this category."
"""


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
