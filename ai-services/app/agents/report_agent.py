import logging
from app.schemas.report import WeeklyProgressReport
from app.agents.base_json_agent import run_json_agent
from app.cache.cache_key import build_cache_key

logger = logging.getLogger("report_agent")


# ============================================================================
# USER-AWARE WEEKLY REPORT SYSTEM PROMPT
# ============================================================================
WEEKLY_REPORT_SYSTEM_PROMPT = """You are a progress report generator for competitive programming.

CONTEXT AVAILABLE:
1. USER PROFILE - complete history including:
   - Total submissions
   - Success rate
   - Weak topics
   - Recurring mistakes
   - Recent categories attempted

TASK:
Generate a weekly progress report that includes:
1. SUMMARY: 2-3 sentence overview of performance
2. STRENGTHS: Topics/patterns where user excels
3. IMPROVEMENT AREAS: Topics needing more practice
4. RECURRING PATTERNS: Mistakes that keep appearing

REPORT GUIDELINES:
1. Be encouraging but honest
2. Reference SPECIFIC topics from user profile
3. If user has recurring mistakes, highlight them constructively
4. Suggest concrete next steps based on weak topics
5. Celebrate improvements if success rate is good

TONE:
- Professional yet supportive
- Data-driven (reference actual statistics)
- Action-oriented (suggest what to practice)

EXAMPLE FORMAT:
Summary: "This week you attempted 15 problems with a 60% success rate. Your array problems improved, but DP remains challenging."
Strengths: ["Array manipulation", "Two-pointer technique"]
Improvement Areas: ["Dynamic Programming", "Graph traversal"]
Recurring Patterns: ["Off-by-one errors in binary search"]"""


def report_agent(context: str, payload: dict) -> WeeklyProgressReport:
    logger.debug(f"📨 report_agent called")
    
    # Extract user profile
    user_profile = payload.get("user_profile", {})
    
    cache_key = build_cache_key(
        "weekly_report_agent", 
        {
            **payload,
            # Include user stats for meaningful cache
            "total_submissions": user_profile.get("total_submissions"),
            "success_rate": user_profile.get("success_rate"),
            "weak_topics_hash": hash(tuple(user_profile.get("weak_topics", []))),
        }
    )
    logger.debug(f"   └─ Cache key generated: {cache_key[:16]}...")
    logger.debug(f"   └─ User submissions: {user_profile.get('total_submissions', 'N/A')}")
    logger.debug(f"   └─ User weak topics: {user_profile.get('weak_topics', [])}")
    
    return run_json_agent(
        agent_name="weekly_report_agent",
        context=context,
        cache_key=cache_key,
        schema=WeeklyProgressReport,
        system_prompt=WEEKLY_REPORT_SYSTEM_PROMPT,
        fallback=WeeklyProgressReport(
            summary="Not enough data for a comprehensive report.",
            strengths=[],
            improvement_areas=user_profile.get("weak_topics", [])[:2],
            recurring_patterns=user_profile.get("common_mistakes", [])[:2]
        )
    )
