import logging
from typing import Dict

logger = logging.getLogger("orchestrator")


def orchestrator_node(state: Dict) -> Dict:
    """
    Central execution planner.
    Decides which agents run synchronously vs asynchronously.
    """

    verdict = state.get("verdict")
    user_requested_report = state.get("request_weekly_report", False)

    plan = {
        # ---- SYNC (always fast) ----
        "run_feedback": True,
        "run_pattern_detection": verdict != "Accepted",
        "run_hint": verdict != "Accepted",

        # ---- ASYNC (expensive) ----
        "run_learning": verdict != "Accepted",
        "run_difficulty": verdict != "Accepted",
        "run_weekly_report": user_requested_report,

        # ---- MEMORY ----
        "store_memory":  verdict != "Accepted",  # always store submission trace
    }

    state["plan"] = plan

    logger.info(f"🧠 Execution plan decided: {plan}")
    return state
