import logging
from app.schemas.feedback import FeedbackResponse
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key
from app.prompts.feedback import FEEDBACK_PROMPT  # ✅ use prompts folder

logger = logging.getLogger("feedback_agent")


# ═══════════════════════════════════════════════════════════════════════════════
# REWRITTEN: PROBLEM-GROUNDED & USER-AWARE FEEDBACK PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

FEEDBACK_SYSTEM_PROMPT = """You are an expert competitive programming reviewer analyzing a submission.

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════
Analyze WHY this submission received this VERDICT, considering:
1. The PROBLEM'S expected approach and constraints
2. The USER'S historical mistake patterns
3. The specific logical flaw in the submitted code

═══════════════════════════════════════════════════════════════════════════════
CONTEXT YOU HAVE (in order of importance)
═══════════════════════════════════════════════════════════════════════════════
1. SECTION 1: PROBLEM DEFINITION
   - Expected Approach: The intended algorithm/technique
   - Constraints: Time/space limits, input bounds
   - Known Pitfalls: Common mistakes for this problem type

2. SECTION 2: USER PROFILE
   - RECURRING MISTAKES: Patterns this user makes repeatedly
   - WEAK TOPICS: Areas where user struggles
   - Success Rate: Historical performance

3. SECTION 3: CURRENT SUBMISSION
   - Verdict: The judge's result (wrong_answer, TLE, etc.)
   - Error Type: Specific error if available

═══════════════════════════════════════════════════════════════════════════════
ANALYSIS ALGORITHM (FOLLOW THIS ORDER)
═══════════════════════════════════════════════════════════════════════════════
STEP 1: Check if user's approach matches EXPECTED APPROACH
        → If different, this is likely the root cause

STEP 2: Check if user is repeating a RECURRING MISTAKE from their profile
        → If yes, explicitly mention: "You're repeating a pattern: [mistake]"

STEP 3: Check if the error matches KNOWN PITFALLS for this problem
        → Reference the specific pitfall

STEP 4: Identify the most likely logical cause for the VERDICT
        → Be specific: "Your loop terminates early when..." not "There's a bug"

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{{
  "explanation": "2-4 sentences explaining the ROOT CAUSE. Reference the expected approach or known pitfall if applicable.",
  "improvement_hint": "ONE specific, actionable suggestion (max 25 words). Point toward the fix without giving the solution.",
  "detected_pattern": "Abstract mistake pattern name (e.g., 'off-by-one in iteration', 'missing base case'). null if no clear pattern."
}}

═══════════════════════════════════════════════════════════════════════════════
RULES (MANDATORY)
═══════════════════════════════════════════════════════════════════════════════
✗ Do NOT restate the problem description
✗ Do NOT provide corrected code or full solutions
✗ Do NOT give generic advice like "debug your code" or "check for errors"
✗ Do NOT speculate without evidence from the submission

✓ DO reference the EXPECTED APPROACH when user's approach differs
✓ DO mention if user is REPEATING a known mistake pattern
✓ DO be specific about WHICH constraint or edge case is likely failing
✓ DO keep explanation under 100 words"""


def feedback_agent(context: str, payload: dict) -> FeedbackResponse:
    logger.debug(
        f"📨 feedback_agent called | verdict={payload.get('verdict')} "
        f"| language={payload.get('language')}"
    )

    # -------------------------
    # ACCEPTED → minimal feedback
    # -------------------------
    if payload.get("verdict") == "Accepted":
        return FeedbackResponse(
            explanation="Your solution passed all test cases successfully.",
            improvement_hint="No changes required.",
            detected_pattern=None,
        )

    # -------------------------
    # Cache key (code-aware + problem-aware)
    # -------------------------
    problem = payload.get("problem", {})
    user_profile = payload.get("user_profile", {})
    
    cache_key = build_cache_key(
        "feedback_agent",
        {
            **payload,
            # 🔑 Make cache code-sensitive
            "code_hash": hash(payload.get("code", "")),
            # 🔑 Include problem expected approach in cache key
            "expected_approach": problem.get("expected_approach", ""),
            # 🔑 Include user mistakes pattern for personalization
            "user_mistakes_hash": hash(tuple(user_profile.get("common_mistakes", []))),
        },
    )

    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    logger.debug(f"   └─ Problem: {problem.get('title', 'unknown')}, Expected: {problem.get('expected_approach', 'N/A')}")
    logger.debug(f"   └─ User recurring mistakes: {user_profile.get('common_mistakes', [])}")

    return run_json_agent(
        agent_name="feedback_agent",
        context=context,
        cache_key=cache_key,
        schema=FeedbackResponse,
        system_prompt=FEEDBACK_SYSTEM_PROMPT,
        fallback=FeedbackResponse(
            explanation=(
                "The submission failed due to a logical issue that causes "
                "incorrect results on certain test cases."
            ),
            improvement_hint=(
                "Re-check the algorithm's assumptions against edge cases "
                "revealed by the code."
            ),
            detected_pattern="Logical edge case handling",
        ),
    )
