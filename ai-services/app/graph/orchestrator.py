"""
Orchestrator - Central Execution Planner
========================================

Decides which agents run in SYNC vs ASYNC workflows.

CRITICAL RULES:
1. SYNC must complete in <10 seconds
2. Only feedback_agent is mandatory for SYNC
3. pattern_detection and hint are optional and skippable
4. All expensive operations go to ASYNC
5. RAG context MUST be validated before agents run

AUTHORITATIVE DECISION TABLE (v3.1):
╔═════════════╦═══════════╦══════════╦═════════╦═══════════╦════════════════════════╗
║ Verdict     ║ Difficulty║ Run MIM  ║ Run RAG ║ Run Hint  ║ Notes                  ║
╠═════════════╬═══════════╬══════════╬═════════╬═══════════╬════════════════════════╣
║ Accepted    ║ Easy      ║ ❌ NO    ║ ❌ NO   ║ ❌ NO     ║ Reinforcement only     ║
║ Accepted    ║ Medium    ║ ❌ NO    ║ ⚠️ Light ║ ❌ NO     ║ Pattern confirmation   ║
║ Accepted    ║ Hard      ║ ⚠️ Light ║ ⚠️ Light ║ ❌ NO     ║ Skill validation       ║
║ Wrong Answer║ Any       ║ ✅ YES   ║ ✅ YES  ║ ✅ YES    ║ Full pipeline          ║
║ TLE         ║ Any       ║ ✅ YES   ║ ✅ YES  ║ ✅ YES    ║ Algorithm focus        ║
║ Runtime Err ║ Any       ║ ✅ YES   ║ ✅ YES  ║ ✅ YES    ║ Safety & correctness   ║
╚═════════════╩═══════════╩══════════╩═════════╩═══════════╩════════════════════════╝

Architecture Upgrade:
- Uses Phase 3.1 QueryBuilder for better RAG queries
- Builds unified AgentInput from MIM outputs
- Integrates confidence tier and pattern state for agents
"""

import logging
from typing import Dict, Optional, Any

logger = logging.getLogger("orchestrator")


def validate_rag_context(state: Dict) -> Dict:
    """
    Validate and ensure RAG context is available for agents.
    
    RAG Context Always Passed Policy:
    - If user_memory is empty, attempt retrieval
    - If retrieval fails, set a flag so agents know to use fallback
    - Never run agents without at least attempting RAG retrieval
    
    Architecture Upgrade:
    - Uses Phase 3.1 QueryBuilder for better queries
    - Extracts MIM diagnosis info for context-aware retrieval
    - Stores RAG metadata for AgentInput
    """
    user_id = state.get("user_id", "")
    user_memory = state.get("user_memory", [])
    
    # Check if we have RAG context
    has_rag_context = bool(user_memory and len(user_memory) > 0)
    
    if not has_rag_context:
        logger.warning(f"⚠️ No RAG context available for user {user_id}")
        # Set flag so agents know context is missing
        state["_rag_context_available"] = False
        state["_rag_retrieval_attempted"] = state.get("_rag_retrieval_attempted", False)
        
        # Try to retrieve if not already attempted
        if not state.get("_rag_retrieval_attempted"):
            try:
                from app.rag.retriever import retrieve_user_memory
                from app.rag.quality_gates import get_query_builder
                
                # ─────────────────────────────────────────────────────────────
                # Phase 3.1: Build better query using MIM context
                # ─────────────────────────────────────────────────────────────
                query_builder = get_query_builder()
                
                # Extract MIM diagnosis info if available
                mim_output = state.get("mim_output")
                root_cause = None
                subtype = None
                pattern_state = None
                
                if mim_output:
                    cf = getattr(mim_output, 'correctness_feedback', None)
                    pf = getattr(mim_output, 'performance_feedback', None)
                    
                    if cf:
                        root_cause = cf.root_cause
                        subtype = cf.subtype
                    elif pf:
                        root_cause = "efficiency"
                        subtype = pf.subtype
                    
                    # Get pattern state from pattern result if available
                    pattern_result = state.get("pattern_result")
                    if pattern_result:
                        pattern_state = getattr(pattern_result, 'pattern_state', None)
                
                # Build context-aware query
                problem_category = state.get("problem_category", "")
                verdict = state.get("verdict", "")
                problem = state.get("problem", {})
                problem_tags = problem.get("tags", []) if isinstance(problem, dict) else []
                
                query = query_builder.build_query(
                    root_cause=root_cause,
                    subtype=subtype,
                    category=problem_category,
                    pattern_state=pattern_state,
                    verdict=verdict,
                    problem_tags=problem_tags,
                )
                
                # Store query for debugging
                state["_rag_query_used"] = query
                
                print(f"\n[RAG] Built query: '{query}'")
                logger.info(f"RAG query built: '{query}' (root_cause={root_cause}, subtype={subtype})")
                
                # Retrieve with Phase 3.1 enhanced retrieval
                memories = retrieve_user_memory(
                    user_id=user_id, 
                    query=query, 
                    k=5,
                    root_cause=root_cause,
                    subtype=subtype,
                    category=problem_category,
                    pattern_state=pattern_state,
                )
                
                if memories:
                    state["user_memory"] = memories
                    state["_rag_context_available"] = True
                    logger.info(f"✅ Retrieved {len(memories)} RAG memories for user {user_id}")
                else:
                    logger.info(f"ℹ️ No RAG memories found for user {user_id} (may be gated by relevance)")
                
                state["_rag_retrieval_attempted"] = True
                
            except Exception as e:
                logger.error(f"❌ RAG retrieval failed: {e}")
                state["_rag_retrieval_attempted"] = True
                state["_rag_context_available"] = False
    else:
        state["_rag_context_available"] = True
        logger.debug(f"✅ RAG context available: {len(user_memory)} memories")
    
    return state


def build_agent_input_from_state(state: Dict) -> Optional[Any]:
    """
    Build unified AgentInput from orchestrator state.
    
    This ensures all agents receive the same structured input
    with MIM decisions, confidence tiers, and pattern states.
    """
    try:
        from app.agents.agent_input import build_agent_input, AgentInput
        
        mim_output = state.get("mim_output")
        if not mim_output:
            return None
        
        pattern_result = state.get("pattern_result")
        difficulty_result = state.get("difficulty_result")
        rag_memories = state.get("user_memory", [])
        rag_query = state.get("_rag_query_used", "")
        
        code = state.get("code", "")
        problem = state.get("problem", {})
        problem_description = problem.get("description", "") if isinstance(problem, dict) else ""
        
        agent_input = build_agent_input(
            mim_output=mim_output,
            pattern_result=pattern_result,
            difficulty_result=difficulty_result,
            rag_memories=rag_memories,
            rag_query=rag_query,
            code_snippet=code[:500] if code else "",
            problem_description=problem_description[:500] if problem_description else "",
        )
        
        # Log for debugging
        agent_input.log()
        
        # Store in state for agents to use
        state["_agent_input"] = agent_input
        
        return agent_input
        
    except Exception as e:
        logger.error(f"Failed to build AgentInput: {e}")
        return None


def orchestrator_node(state: Dict) -> Dict:
    """
    Central execution planner with intelligent skip logic.
    
    Decides which agents run based on:
    1. Verdict (accepted vs failed)
    2. Problem context quality (grounded vs fallback)
    3. Time budget remaining
    4. User history availability
    5. RAG context availability (ALWAYS validate first)
    6. Guardrails from API layer (verdict guards)
    """
    # === FIRST: Validate RAG context ===
    state = validate_rag_context(state)
    
    verdict = state.get("verdict", "").lower()
    user_requested_report = state.get("request_weekly_report", False)
    
    # Check problem context quality
    problem = state.get("problem", {})
    is_problem_grounded = problem.get("_source") != "fallback"
    difficulty = problem.get("difficulty", "Medium") if isinstance(problem, dict) else "Medium"
    
    # Check user profile quality
    user_profile = state.get("user_profile", {})
    has_user_history = bool(
        user_profile.get("common_mistakes") or 
        user_profile.get("weak_topics") or
        user_profile.get("recurring_patterns")
    )
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # GUARDRAIL CHECK: Respect verdict guards from API layer
    # ═══════════════════════════════════════════════════════════════════════════════
    guardrails = state.get("_guardrails", {})
    is_accepted = verdict == "accepted"
    
    # === SYNC AGENTS (user-facing, must be fast) ===
    
    # Feedback is ALWAYS run (primary agent)
    run_feedback = True
    
    # Pattern detection: Skip for accepted OR if guardrails say so
    run_pattern_detection = (
        not is_accepted and 
        not guardrails.get("skip_mim", False) and
        is_problem_grounded
    )
    
    # Hint: Skip for accepted OR if guardrails say so
    run_hint = (
        not is_accepted and
        not guardrails.get("skip_hint", False) and
        run_feedback
    )
    
    # === ASYNC AGENTS (background, no latency impact) ===
    
    # Learning: For failures, run diagnosis. For accepted, run reinforcement.
    run_learning = True  # Always run, but mode differs
    
    # Difficulty: Only for failed submissions with user history
    run_difficulty = not is_accepted and has_user_history
    
    # Weekly report: Only on explicit request
    run_weekly_report = user_requested_report
    
    # Memory storage: ALWAYS (both success and failure are valuable signals)
    store_memory = True
    
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
        "rag_context_available": state.get("_rag_context_available", False),
        "is_accepted": is_accepted,
        "difficulty": difficulty,
    }

    state["plan"] = plan
    
    # Log decision
    sync_agents = [k for k, v in plan.items() if v and k.startswith("run_") and k in ["run_feedback", "run_pattern_detection", "run_hint"]]
    async_agents = [k for k, v in plan.items() if v and k.startswith("run_") and k in ["run_learning", "run_difficulty", "run_weekly_report"]]
    
    logger.info(f"🧠 Orchestrator decision:")
    logger.info(f"   - Verdict: {verdict}")
    logger.info(f"   - Difficulty: {difficulty}")
    logger.info(f"   - Is Accepted: {is_accepted}")
    logger.info(f"   - Problem grounded: {is_problem_grounded}")
    logger.info(f"   - User history: {has_user_history}")
    logger.info(f"   - SYNC agents: {sync_agents}")
    logger.info(f"   - ASYNC agents: {async_agents}")
    
    print(f"\n[ORCHESTRATOR] Execution plan:")
    print(f"   - Verdict: {verdict} | Accepted: {is_accepted}")
    print(f"   - SYNC: {sync_agents}")
    print(f"   - ASYNC: {async_agents}")
    print(f"   - Problem grounded: {is_problem_grounded}")
    
    return state
