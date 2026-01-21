import logging
from app.schemas.difficulty import DifficultyAdjustment
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("difficulty_agent")


# ============================================================================
# USER-AWARE DIFFICULTY SYSTEM PROMPT
# ============================================================================
DIFFICULTY_SYSTEM_PROMPT = """You are a difficulty calibration agent for adaptive learning.

CONTEXT AVAILABLE:
1. PROBLEM DEFINITION - current difficulty level
2. USER PROFILE - success rate, total submissions, recent performance
3. Current submission verdict and mistake type

TASK:
Decide whether to INCREASE, DECREASE, or MAINTAIN problem difficulty.

DECISION MATRIX:
╔══════════════════╦═══════════════════════╦════════════════════════════════════╗
║ Scenario         ║ Action                ║ Rationale                          ║
╠══════════════════╬═══════════════════════╬════════════════════════════════════╣
║ Success Rate >70%║ Consider INCREASE     ║ User is ready for harder problems  ║
║ Success Rate <30%║ Consider DECREASE     ║ User needs easier problems first   ║
║ Repeated failures║ DECREASE              ║ Frustration risk                   ║
║ First attempt WA ║ MAINTAIN              ║ Give user another chance           ║
║ TLE (close)      ║ MAINTAIN              ║ User understands, needs optimize   ║
║ TLE (far off)    ║ DECREASE              ║ User needs simpler complexity      ║
╚══════════════════╩═══════════════════════╩════════════════════════════════════╝

ADJUSTMENT RULES:
1. Never adjust more than one level at a time
2. Consider user's WEAK TOPICS - don't increase if struggling there
3. Weight recent submissions more than historical
4. If user is repeatedly making SAME mistake, consider decrease

OUTPUT:
- action: "increase" | "decrease" | "maintain"
- rationale: Brief explanation referencing user's profile and current performance"""


def difficulty_agent(context: str, payload: dict) -> DifficultyAdjustment:
    logger.debug("📨 difficulty_agent called")
    
    # Extract structured data
    problem = payload.get("problem", {})
    user_profile = payload.get("user_profile", {})
    
    cache_key = build_cache_key(
        agent_name="difficulty_agent",
        payload={
            **payload,
            # Include current problem difficulty
            "problem_difficulty": problem.get("difficulty", "Medium"),
            # Include user's success rate
            "user_success_rate": user_profile.get("success_rate"),
            # Include recent verdict
            "verdict": payload.get("verdict", ""),
        }
    )
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    logger.debug(f"   └─ Problem difficulty: {problem.get('difficulty', 'Unknown')}")
    logger.debug(f"   └─ User success rate: {user_profile.get('success_rate', 'N/A')}")

    return run_json_agent(
        agent_name="difficulty_agent",
        context=context,
        cache_key=cache_key,
        schema=DifficultyAdjustment,
        system_prompt=DIFFICULTY_SYSTEM_PROMPT,
        fallback=DifficultyAdjustment(
            action="maintain",
            rationale="Insufficient signal to adjust difficulty."
        ),
    )
