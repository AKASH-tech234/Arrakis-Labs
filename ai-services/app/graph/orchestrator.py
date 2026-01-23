"""
Orchestrator - Central Execution Planner
========================================

Decides which agents run in SYNC vs ASYNC workflows.

CRITICAL RULES:
1. SYNC must complete in <10 seconds
2. Only feedback_agent is mandatory for SYNC
3. pattern_detection and hint are optional and skippable
4. All expensive operations go to ASYNC
"""

import logging
from typing import Dict

logger = logging.getLogger("orchestrator")


def orchestrator_node(state: Dict) -> Dict:
    """
    Central execution planner with intelligent skip logic.
    
    Decides which agents run based on:
    1. Verdict (accepted vs failed)
    2. Problem context quality (grounded vs fallback)
    3. Time budget remaining
    4. User history availability
    """
    verdict = state.get("verdict", "").lower()
    user_requested_report = state.get("request_weekly_report", False)
    
    # Check problem context quality
    problem = state.get("problem", {})
    is_problem_grounded = problem.get("_source") != "fallback"
    
    # Check user profile quality
    user_profile = state.get("user_profile", {})
    has_user_history = bool(
        user_profile.get("common_mistakes") or 
        user_profile.get("weak_topics") or
        user_profile.get("recurring_patterns")
    )
    
    # === SYNC AGENTS (user-facing, must be fast) ===
    
    # Feedback is ALWAYS run (primary agent)
    run_feedback = True
    
    # Pattern detection: Skip for accepted OR if problem context is fallback
    # (can't reliably detect patterns without grounded problem data)
    run_pattern_detection = (
        verdict != "accepted" and 
        is_problem_grounded
    )
    
    # Hint: Skip for accepted OR if no feedback agent ran
    # Also skip if problem context is fallback (hints would be too generic)
    run_hint = (
        verdict != "accepted" and
        run_feedback
    )
    
    # === ASYNC AGENTS (background, no latency impact) ===
    
    # Learning: Only for failed submissions
    run_learning = verdict != "accepted"
    
    # Difficulty: Only for failed submissions with user history
    run_difficulty = verdict != "accepted" and has_user_history
    
    # Weekly report: Only on explicit request
    run_weekly_report = user_requested_report
    
    # Memory storage: Only for failures (store mistakes)
    store_memory = verdict != "accepted" or  verdict == "accepted"
    
    plan = {
        # ---- SYNC (user-facing, <10s total) ----
        "run_feedback": run_feedback,
        "run_pattern_detection": run_pattern_detection,
        "run_hint": run_hint,
        
        # ---- ASYNC (background) ----
        "run_learning": run_learning,
        "run_difficulty": run_difficulty,
        "run_weekly_report": run_weekly_report,
        "store_memory": store_memory,
        
        # ---- METADATA ----
        "problem_grounded": is_problem_grounded,
        "has_user_history": has_user_history,
    }

    state["plan"] = plan
    
    # Log decision
    sync_agents = [k for k, v in plan.items() if v and k.startswith("run_") and k in ["run_feedback", "run_pattern_detection", "run_hint"]]
    async_agents = [k for k, v in plan.items() if v and k.startswith("run_") and k in ["run_learning", "run_difficulty", "run_weekly_report"]]
    
    logger.info(f"🧠 Orchestrator decision:")
    logger.info(f"   └─ Verdict: {verdict}")
    logger.info(f"   └─ Problem grounded: {is_problem_grounded}")
    logger.info(f"   └─ User history: {has_user_history}")
    logger.info(f"   └─ SYNC agents: {sync_agents}")
    logger.info(f"   └─ ASYNC agents: {async_agents}")
    
    print(f"\n🧠 [ORCHESTRATOR] Execution plan:")
    print(f"   └─ SYNC: {sync_agents}")
    print(f"   └─ ASYNC: {async_agents}")
    print(f"   └─ Problem grounded: {is_problem_grounded}")
    
    return state
