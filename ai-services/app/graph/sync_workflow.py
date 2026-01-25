from typing import TypedDict, Optional, List, Dict, Any, cast
import logging
import time
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.submission import SubmissionContext
from app.schemas.user_profile import UserProfile

from app.rag.retriever import retrieve_user_memory
from app.rag.context_builder import build_context, build_feedback_context_focused, build_hint_context_minimal

from app.agents.feedback_agent import feedback_agent
from app.agents.hint_agent import hint_agent

from app.graph.orchestrator import orchestrator_node

from app.problem.problem_repository import get_problem_by_id, ProblemContext
from app.user_profile.profile_builder import build_user_profile

# MIM Integration - v3.0 Decision Engine
from app.mim.decision_engine import MIMDecisionEngine, make_decision
from app.mim.mim_decision import MIMDecision

logger = logging.getLogger("sync_workflow")

# ═══════════════════════════════════════════════════════════════════════════════
# v3.2: VERBOSE LOGGING TOGGLE - Set VERBOSE_LOGGING=1 for debug output
# ═══════════════════════════════════════════════════════════════════════════════
VERBOSE_LOGGING = os.environ.get("VERBOSE_LOGGING", "0") == "1"

def _vprint(*args, **kwargs):
    """Verbose print - only outputs if VERBOSE_LOGGING is enabled."""
    if VERBOSE_LOGGING:
        print(*args, **kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
# TIME BUDGET CONSTANTS (QUALITY > SPEED) - v3.1 OPTIMIZED
# ═══════════════════════════════════════════════════════════════════════════════

# Total SYNC workflow budget: 45 seconds (v3.1: Reduced with optimizations)
SYNC_TOTAL_BUDGET_SECONDS = 45.0

# Per-agent time budgets - v3.1: Tighter budgets with optimized contexts
AGENT_TIME_BUDGETS = {
    "retrieve_memory": 8.0,      # RAG retrieval with k=5 (reduced)
    "retrieve_problem": 8.0,    # DB/API fetch
    "mim_prediction": 3.0,      # MIM inference (sklearn - fast)
    "build_user_profile": 3.0,  # Heuristic processing
    "build_context": 3.0,       # Context assembly
    "feedback_agent": 20.0,     # LLM call - MUST COMPLETE (main agent)
    "pattern_detection": 0.0,   # v3.1: DISABLED - MIM handles this
    "hint_agent": 8.0,          # v3.1: Reduced - minimal context now
}

# RAG retrieval depth - v3.1: Reduced for speed
RAG_RETRIEVAL_K = 5

# Thread pool for parallel execution
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="sync_agent_")


class MentatSyncState(TypedDict):
    """
    SYNC Workflow State - Quality-First Design
    
    PHILOSOPHY: All agents MUST complete. Quality > Speed.
    Budget is 60 seconds to allow thorough analysis.
    """
    # === INPUT (from frontend) ===
    user_id: str
    problem_id: str
    problem_category: str
    constraints: str
    code: str  # FULL code - no truncation
    language: str
    verdict: str
    error_type: Optional[str]

    # === ORCHESTRATOR DECISION ===
    plan: Dict

    # === RAG DATA (with metadata) ===
    user_memory: List[str]  # Raw memory chunks
    user_memory_with_scores: Optional[List[Dict[str, Any]]]  # Memory with relevance scores
    context: str  # Main assembled context

    # === STRUCTURED PROBLEM CONTEXT ===
    problem: Optional[Dict[str, Any]]
    
    # === STRUCTURED USER PROFILE ===
    user_profile: Optional[Dict[str, Any]]
    
    # === MIM DECISION (NEW v3.0) ===
    mim_decision: Optional[MIMDecision]  # Full MIM decision with agent instructions

    # === AGENT OUTPUTS (shared for coordination) ===
    feedback: Optional[FeedbackResponse]
    detected_pattern: Optional[str]
    pattern_confidence: Optional[float]  # For hint agent to reference
    improvement_hint: Optional[str]
    
    # === AGENT RESULTS BUNDLE (for cross-agent reference) ===
    agent_results: Optional[Dict[str, Any]]  # Accumulated results for later agents
    
    # === TIMING METADATA ===
    _workflow_start: Optional[float]
    _node_timings: Optional[Dict[str, float]]
    _budget_exceeded: Optional[bool]  # Only logged, never used to skip


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: TIMED EXECUTION WITH TIMEOUT
# ═══════════════════════════════════════════════════════════════════════════════

def _run_with_timeout(func, args, timeout_seconds: float, fallback, agent_name: str):
    """
    Execute function with hard timeout. Returns fallback on timeout.
    
    Args:
        func: Function to execute
        args: Arguments tuple
        timeout_seconds: Hard timeout in seconds
        fallback: Value to return if timeout
        agent_name: For logging
    
    Returns:
        Function result or fallback
    """
    start = time.time()
    
    try:
        future = _executor.submit(func, *args)
        result = future.result(timeout=timeout_seconds)
        elapsed = time.time() - start
        logger.info(f"⏱️ [{agent_name}] completed in {elapsed:.2f}s (budget: {timeout_seconds}s)")
        return result
        
    except FuturesTimeoutError:
        elapsed = time.time() - start
        logger.warning(f"⏰ [{agent_name}] TIMEOUT after {elapsed:.2f}s (budget: {timeout_seconds}s)")
        _vprint(f"⏰ [{agent_name}] TIMEOUT - returning fallback")
        return fallback
        
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"❌ [{agent_name}] FAILED in {elapsed:.2f}s: {type(e).__name__}: {e}")
        _vprint(f"❌ [{agent_name}] ERROR: {e} - returning fallback")
        return fallback


# ═══════════════════════════════════════════════════════════════════════════════
# NODES (with timing and guardrails)
# ═══════════════════════════════════════════════════════════════════════════════

def _init_timing(state: MentatSyncState) -> MentatSyncState:
    """Initialize timing metadata"""
    state["_workflow_start"] = time.time()
    state["_node_timings"] = {}
    state["_budget_exceeded"] = False
    return state


def _log_budget_status(state: MentatSyncState, node_name: str) -> None:
    """Log budget status for monitoring. NEVER skips agents."""
    if not state.get("_workflow_start"):
        return
    
    elapsed = time.time() - state["_workflow_start"]
    remaining = SYNC_TOTAL_BUDGET_SECONDS - elapsed
    
    if remaining < 10.0:
        logger.info(f"⏱️ Budget status before {node_name} | elapsed={elapsed:.2f}s | remaining={remaining:.2f}s")
    
    if remaining < 0:
        # Log but NEVER skip - quality > speed
        logger.warning(f"⏰ Budget exceeded at {node_name} | elapsed={elapsed:.2f}s (continuing anyway)")
        state["_budget_exceeded"] = True


def retrieve_memory_node(state: MentatSyncState) -> MentatSyncState:
    """
    RAG Memory Retrieval - Fetch user's historical mistakes with relevance scores.
    
    QUALITY-FIRST: Uses k=7 for comprehensive history retrieval.
    Returns both raw chunks and scored metadata for context building.
    """
    _init_timing(state)
    start = time.time()
    
    _vprint(f"\n🔍 [MEMORY RETRIEVAL] Starting for user: {state['user_id']}")
    
    # Build rich query with full problem context
    query_parts = [
        state['problem_category'],
        state.get('error_type', ''),
        state.get('verdict', ''),
        state.get('constraints', '')[:100]  # Include constraints for relevance
    ]
    query = " ".join(filter(None, query_parts)).strip()
    
    try:
        # Use higher k for comprehensive retrieval
        memories = _run_with_timeout(
            retrieve_user_memory,
            (state["user_id"], query, RAG_RETRIEVAL_K),
            timeout_seconds=AGENT_TIME_BUDGETS["retrieve_memory"],
            fallback=[],
            agent_name="retrieve_memory"
        )
        state["user_memory"] = memories if memories else []
        
        # ═══════════════════════════════════════════════════════════════════════════════
        # VERBOSE LOGGING: Show all retrieved RAG memory chunks
        # ═══════════════════════════════════════════════════════════════════════════════
        _vprint(f"\n{'='*80}")
        _vprint(f"🧠 [RAG MEMORY] Retrieved {len(state['user_memory'])} chunks for user: {state['user_id']}")
        _vprint(f"{'='*80}")
        _vprint(f"📌 Query: {query}")
        if state['user_memory']:
            for i, chunk in enumerate(state['user_memory'], 1):
                _vprint(f"\n📄 Memory {i}:")
                _vprint(f"   {chunk}")
        else:
            _vprint(f"\n⚠️  No memories found (new user or empty RAG store)")
        _vprint(f"{'='*80}\n")
        
        # Initialize agent_results for coordination
        state["agent_results"] = {
            "memory_retrieved": len(state["user_memory"]),
            "memory_query": query[:100]
        }
        
    except Exception as e:
        logger.error(f"❌ Memory retrieval failed: {e}")
        state["user_memory"] = []
        state["agent_results"] = {"memory_retrieved": 0, "memory_error": str(e)}
    
    elapsed = time.time() - start
    state["_node_timings"]["retrieve_memory"] = elapsed
    _vprint(f"✅ [MEMORY RETRIEVAL] Completed in {elapsed:.2f}s | {len(state['user_memory'])} chunks (k={RAG_RETRIEVAL_K})")
    
    return state


def retrieve_problem_node(state: MentatSyncState) -> MentatSyncState:
    """
    CRITICAL NODE: Fetch structured problem context from repository.
    
    This node ensures all agents receive GROUNDED problem information:
    - Problem statement, constraints, expected approach
    - Common mistakes for this problem category
    - Difficulty level and tags
    
    PRIORITY ORDER:
    1. Use problem data from incoming payload (sent by backend)
    2. If not available, fetch from backend API
    3. If fetch fails, use fallback with inferred data
    """
    import time
    start = time.time()
    
    _vprint(f"\n🎲 [PROBLEM RETRIEVAL] Starting for: {state['problem_id']}")
    logger.info(f"🎲 retrieve_problem_node started | problem_id={state['problem_id']}")
    
    # Check if problem data was sent in the payload (from backend)
    payload_problem = state.get("problem")
    if payload_problem and isinstance(payload_problem, dict) and payload_problem.get("title"):
        # Use problem context from payload
        problem_dict = {
            "problem_id": state["problem_id"],
            "title": payload_problem.get("title", f"Problem {state['problem_id']}"),
            "statement": payload_problem.get("description", "Problem statement from backend"),
            "constraints": state.get("constraints", payload_problem.get("constraints", "No constraints")),
            "tags": payload_problem.get("tags", [state.get("problem_category", "General")]),
            "difficulty": payload_problem.get("difficulty", "Medium"),
            "expected_approach": payload_problem.get("expected_approach") or payload_problem.get("expectedApproach"),
            "time_complexity_hint": payload_problem.get("time_complexity_hint") or payload_problem.get("timeComplexityHint"),
            "space_complexity_hint": payload_problem.get("space_complexity_hint") or payload_problem.get("spaceComplexityHint"),
            "common_mistakes": payload_problem.get("common_mistakes") or payload_problem.get("commonMistakes", []),
            "_source": "payload",  # Mark as coming from backend payload
            "_fetched_at": time.time()
        }
        state["problem"] = problem_dict
        
        elapsed = time.time() - start
        _vprint(f"✅ [PROBLEM RETRIEVAL] Using payload data in {elapsed:.2f}s")
        _vprint(f"   └─ Title: {problem_dict['title']}")
        _vprint(f"   └─ Difficulty: {problem_dict['difficulty']}")
        _vprint(f"   └─ Tags: {problem_dict['tags']}")
        _vprint(f"   └─ Expected Approach: {problem_dict['expected_approach'][:50]}..." if problem_dict.get('expected_approach') else "   └─ Expected Approach: N/A")
        
        logger.info(f"✅ Problem from payload: {problem_dict['title']} | tags={problem_dict['tags']} | {elapsed:.2f}s")
        return state
    
    # If no payload problem, try fetching from backend API
    try:
        # FIXED: Use correct parameter names (category, constraints)
        problem_context = get_problem_by_id(
            problem_id=state["problem_id"],
            category=state.get("problem_category", ""),
            constraints=state.get("constraints", "")
        )
        
        problem_dict = problem_context.model_dump()
        problem_dict["_source"] = "database"  # Mark as real data
        problem_dict["_fetched_at"] = time.time()
        state["problem"] = problem_dict
        
        elapsed = time.time() - start
        _vprint(f"✅ [PROBLEM RETRIEVAL] Success in {elapsed:.2f}s")
        _vprint(f"   └─ Title: {problem_context.title}")
        _vprint(f"   └─ Difficulty: {problem_context.difficulty}")
        _vprint(f"   └─ Tags: {problem_context.tags}")
        _vprint(f"   └─ Expected Approach: {problem_context.expected_approach[:50]}..." if problem_context.expected_approach else "   └─ Expected Approach: N/A")
        
        logger.info(f"✅ Problem retrieved: {problem_context.title} | tags={problem_context.tags} | {elapsed:.2f}s")
        
    except Exception as e:
        elapsed = time.time() - start
        _vprint(f"⚠️  [PROBLEM RETRIEVAL] Failed in {elapsed:.2f}s: {type(e).__name__}")
        logger.error(f"❌ Problem retrieval failed: {type(e).__name__}: {e}")
        
        # FALLBACK: Build minimal context from frontend payload
        # Agents MUST know this is fallback data
        category = state.get("problem_category", "General")
        tags = [category] if category else ["General"]
        
        # Infer approach from category
        from app.problem.problem_repository import _infer_approach, _get_common_mistakes
        fallback_approach = _infer_approach(tags, "Medium")
        fallback_mistakes = _get_common_mistakes(tags)
        
        state["problem"] = {
            "problem_id": state["problem_id"],
            "title": f"Problem {state['problem_id']}",
            "statement": "Problem statement not available (fallback mode)",
            "constraints": state.get("constraints", "No constraints provided"),
            "tags": tags,
            "difficulty": "Medium",
            "expected_approach": fallback_approach,
            "time_complexity_hint": None,
            "space_complexity_hint": None,
            "common_mistakes": fallback_mistakes,
            "_source": "fallback",  # CRITICAL: Mark as fallback
            "_fallback_reason": str(e),
            "_fetched_at": time.time()
        }
        
        _vprint(f"⚠️  Using fallback problem context")
        _vprint(f"   └─ Category: {category}")
        _vprint(f"   └─ Inferred approach: {fallback_approach[:50]}..." if fallback_approach else "   └─ Inferred approach: N/A")
        logger.warning(f"⚠️ Using fallback context for {state['problem_id']} | category={category}")
    
    return state


def mim_prediction_node(state: MentatSyncState) -> MentatSyncState:
    """
    MIM DECISION ENGINE v3.0 - Authoritative decision-making.
    
    Runs AFTER retrieve_problem, BEFORE build_user_profile.
    
    Provides agents with:
    - Complete MIMDecision with pre-computed instructions
    - Root cause, pattern detection, difficulty adjustment
    - Focus areas, hint direction, feedback instructions
    
    REPLACES: pattern_detection_agent, difficulty_agent
    AGENTS RECEIVE: Instructions, not data to analyze
    """
    _log_budget_status(state, "mim_decision")
    
    start = time.time()
    _vprint(f"\n🧠 [MIM DECISION ENGINE v3.0] Starting...")
    logger.info(f"🧠 mim_decision_node v3.0 started | user={state['user_id']} | verdict={state.get('verdict')}")
    
    try:
        # Get user history from MongoDB for feature extraction
        from app.db.mongodb import mongo_client
        user_history = []
        
        try:
            if mongo_client.db is not None:
                user_history = mongo_client.get_user_submissions(
                    user_id=state["user_id"],
                    limit=50
                ) or []
        except Exception as e:
            logger.warning(f"Failed to fetch user history for MIM: {e}")
        
        # Run MIM Decision Engine v3.0
        decision = make_decision(
            submission={
                "user_id": state["user_id"],
                "problem_id": state["problem_id"],
                "code": state.get("code", ""),
                "verdict": state.get("verdict", ""),
                "language": state.get("language", ""),
                "problem_category": state.get("problem_category", ""),
                "error_type": state.get("error_type"),
                "constraints": state.get("constraints", ""),
            },
            user_history=user_history,
            problem_context=state.get("problem"),
            user_memory=state.get("user_memory", []),
            user_profile=state.get("user_profile"),
        )
        
        # Store decision in state for agents
        state["mim_decision"] = decision
        
        # Also store as dict for backward compatibility
        state["mim_insights"] = {
            "root_cause": {
                "failure_cause": decision.root_cause,
                "confidence": decision.root_cause_confidence,
            },
            "readiness": {
                "current_level": decision.user_skill_level,
                "recommended_difficulty": decision.difficulty_action.target_difficulty,
            },
            "performance_forecast": {
                "learning_velocity": decision.learning_velocity,
                "plateau_risk": decision.difficulty_action.plateau_risk,
                "burnout_risk": decision.difficulty_action.burnout_risk,
            },
            "is_cold_start": decision.is_cold_start,
            "model_version": decision.model_version,
        }
        
        elapsed = time.time() - start
        state["_node_timings"]["mim_decision"] = elapsed
        
        # === VERBOSE LOGGING ===
        _vprint(f"\n{'='*80}")
        _vprint(f"🧠 MIM DECISION ENGINE v3.0 OUTPUT")
        _vprint(f"{'='*80}")
        _vprint(f"✅ ROOT CAUSE: {decision.root_cause} (confidence: {decision.root_cause_confidence:.0%})")
        _vprint(f"🔄 PATTERN: {decision.pattern.pattern_name or 'None'}")
        if decision.pattern.is_recurring:
            _vprint(f"   ⚠️ RECURRING: {decision.pattern.recurrence_count} times!")
        _vprint(f"📊 USER LEVEL: {decision.user_skill_level}")
        _vprint(f"📈 DIFFICULTY ACTION: {decision.difficulty_action.action.upper()} → {decision.difficulty_action.target_difficulty}")
        _vprint(f"   └─ Rationale: {decision.difficulty_action.rationale}")
        _vprint(f"🎯 FOCUS AREAS: {', '.join(decision.focus_areas)}")
        _vprint(f"💡 FEEDBACK TONE: {decision.feedback_instruction.tone}")
        _vprint(f"⏱️ Inference time: {decision.inference_time_ms:.1f}ms")
        _vprint(f"{'='*80}\n")
        
        logger.info(
            f"✅ MIM decision complete | "
            f"root_cause={decision.root_cause} "
            f"pattern={decision.pattern.pattern_name} "
            f"recurring={decision.pattern.is_recurring} "
            f"time={elapsed:.2f}s"
        )
        
        # Add to agent_results for coordination
        if state.get("agent_results"):
            state["agent_results"]["mim_root_cause"] = decision.root_cause
            state["agent_results"]["mim_confidence"] = decision.root_cause_confidence
            state["agent_results"]["mim_pattern"] = decision.pattern.pattern_name
            state["agent_results"]["mim_recurring"] = decision.pattern.is_recurring
        
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"❌ MIM decision failed: {e}", exc_info=True)
        _vprint(f"⚠️  [MIM DECISION] Failed in {elapsed:.2f}s: {e}")
        _vprint(f"   └─ Agents will proceed without MIM instructions")
        
        # Graceful degradation - agents still work
        state["mim_decision"] = None
        state["mim_insights"] = None
        state["_node_timings"]["mim_decision"] = elapsed
    
    return state


def build_user_profile_node(state: MentatSyncState) -> MentatSyncState:
    """
    Build User Profile - Heuristic pattern extraction (NO LLM).
    
    ALWAYS RUNS - No budget skipping.
    Extracts patterns from RAG memory WITHOUT LLM calls:
    - Common mistakes (keyword matching)
    - Weak topics (frequency analysis)
    - Recurring patterns (deduplication)
    """
    _log_budget_status(state, "build_user_profile")
    
    start = time.time()
    _vprint(f"\n👤 [USER PROFILE] Building from {len(state.get('user_memory', []))} memory chunks...")
    
    try:
        memory_text = "\n".join(state.get("user_memory", []))
        
        profile = _run_with_timeout(
            build_user_profile,
            (state["user_id"], memory_text, None, state.get("verdict")),
            timeout_seconds=AGENT_TIME_BUDGETS["build_user_profile"],
            fallback=None,
            agent_name="build_user_profile"
        )
        
        if profile:
            state["user_profile"] = profile.model_dump()
            
            # ═══════════════════════════════════════════════════════════════════════════════
            # VERBOSE LOGGING: Show full user profile details
            # ═══════════════════════════════════════════════════════════════════════════════
            _vprint(f"\n{'='*80}")
            _vprint(f"👤 [USER PROFILE] Built for user: {state['user_id']}")
            _vprint(f"{'='*80}")
            _vprint(f"🚩 Common Mistakes ({len(profile.common_mistakes)}):")
            for mistake in profile.common_mistakes:
                _vprint(f"   • {mistake}")
            _vprint(f"\n📊 Weak Topics ({len(profile.weak_topics)}):")
            for topic in profile.weak_topics:
                _vprint(f"   • {topic}")
            _vprint(f"\n🔄 Recurring Patterns ({len(profile.recurring_patterns)}):")
            for pattern in profile.recurring_patterns:
                _vprint(f"   • {pattern}")
            _vprint(f"\n📊 Stats:")
            _vprint(f"   • Success Rate: {profile.success_rate or 'N/A'}")
            _vprint(f"   • Total Submissions: {profile.total_submissions or 'N/A'}")
            _vprint(f"   • Last Verdict: {profile.last_verdict or 'N/A'}")
            _vprint(f"{'='*80}\n")
            
            _vprint(f"✅ [USER PROFILE] Built | mistakes={len(profile.common_mistakes)} | weak_topics={len(profile.weak_topics)}")
            logger.info(f"✅ User profile built | user={state['user_id']} | mistakes={len(profile.common_mistakes)}")
            
            # Add to agent_results for coordination
            if state.get("agent_results"):
                state["agent_results"]["user_profile_built"] = True
                state["agent_results"]["common_mistakes"] = profile.common_mistakes
                state["agent_results"]["weak_topics"] = profile.weak_topics
        else:
            state["user_profile"] = _get_fallback_profile(state)
            
    except Exception as e:
        logger.error(f"❌ User profile building failed: {e}")
        state["user_profile"] = _get_fallback_profile(state)
    
    elapsed = time.time() - start
    state["_node_timings"]["build_user_profile"] = elapsed
    
    return state


def _get_fallback_profile(state: MentatSyncState) -> Dict[str, Any]:
    """Generate fallback user profile"""
    return {
        "user_id": state["user_id"],
        "common_mistakes": [],
        "weak_topics": [],
        "recurring_patterns": [],
        "recent_categories": [state.get("problem_category", "")],
        "last_verdict": state.get("verdict"),
        "success_rate": None,
        "total_submissions": None,
        "_source": "fallback"
    }


def build_context_node(state: MentatSyncState) -> MentatSyncState:
    """
    Build Structured Context - Format data for agent prompts.
    
    v3.1 OPTIMIZED: Creates FOCUSED contexts per agent type.
    
    - context: Full context (for backward compat)
    - context_focused: Optimized context for feedback_agent (~2500 chars)
    - hint_context: Minimal context for hint_agent (~500 chars)
    """
    _log_budget_status(state, "build_context")
    
    start = time.time()
    _vprint(f"\n📝 [CONTEXT BUILD v3.1] Building focused contexts...")
    
    submission = SubmissionContext(
        user_id=state["user_id"],
        problem_id=state["problem_id"],
        problem_category=state["problem_category"],
        constraints=state["constraints"],
        code=state["code"],
        language=state["language"],
        verdict=state["verdict"],
        error_type=state.get("error_type"),
        user_history_summary=None,
    )

    try:
        # v3.1: Build FOCUSED context for feedback agent (primary)
        focused_context = build_feedback_context_focused(
            submission=submission,
            problem_context=state.get("problem"),
            user_profile=state.get("user_profile"),
            mim_decision=state.get("mim_decision"),
        )
        
        # Store focused context for feedback agent
        state["context"] = focused_context
        state["context_focused"] = focused_context
        
        # v3.1: Pre-build minimal hint context (for hint_agent)
        mim_decision = state.get("mim_decision")
        hint_context = build_hint_context_minimal(
            mim_decision=mim_decision,
            feedback_hint="",  # Will be filled by feedback agent later
        )
        state["hint_context"] = hint_context
        
        # ═══════════════════════════════════════════════════════════════════════════════
        # VERBOSE LOGGING: Show context sizes
        # ═══════════════════════════════════════════════════════════════════════════════
        _vprint(f"\n{'='*80}")
        _vprint(f"📝 [CONTEXT BUILD v3.1] Optimized contexts ready")
        _vprint(f"{'='*80}")
        _vprint(f"📊 Focused feedback context: {len(focused_context)} chars")
        _vprint(f"📊 Minimal hint context: {len(hint_context)} chars")
        _vprint(f"\n📄 Feedback context preview:")
        _vprint(f"{'-'*80}")
        print(focused_context[:1500])
        if len(focused_context) > 1500:
            _vprint(f"\n... [{len(focused_context) - 1500} more characters] ...")
        _vprint(f"{'-'*80}")
        _vprint(f"{'='*80}\n")
        
        elapsed = time.time() - start
        state["_node_timings"]["build_context"] = elapsed
        
        _vprint(f"✅ [CONTEXT BUILD] Completed in {elapsed:.2f}s | {len(state['context'])} chars (FULL, no truncation)")
        logger.info(f"✅ Context built | length={len(state['context'])} | {elapsed:.2f}s")
        
    except Exception as e:
        logger.error(f"❌ Context building failed: {e}")
        state["context"] = _build_minimal_context(state)
    
    return state


def _build_minimal_context(state: MentatSyncState) -> str:
    """Build minimal context when full context building fails"""
    return f"""
=== MINIMAL CONTEXT (fallback) ===
Problem: {state.get('problem_id', 'unknown')}
Category: {state.get('problem_category', 'unknown')}
Verdict: {state.get('verdict', 'unknown')}
Language: {state.get('language', 'unknown')}
Error Type: {state.get('error_type', 'N/A')}

Code (truncated):
{state.get('code', '')[:500]}

INSTRUCTIONS: Provide generic feedback based on verdict type.
"""


def feedback_node(state: MentatSyncState) -> MentatSyncState:
    """
    CORE AGENT v3.0: Generate feedback using MIM instructions.
    
    MUST COMPLETE - No budget skipping.
    Receives MIMDecision with pre-computed instructions.
    Agent's job: Add code-specific evidence, not diagnose.
    """
    if not state["plan"]["run_feedback"]:
        _vprint(f"⏭️  [FEEDBACK] Skipped by orchestrator plan")
        return state
    
    _log_budget_status(state, "feedback")
    
    start = time.time()
    mim_decision = state.get("mim_decision")
    
    _vprint(f"\n🤖 [FEEDBACK AGENT v3.0] Starting (MIM-instructed={mim_decision is not None})...")
    logger.info(f"🤖 feedback_agent v3.0 starting | verdict={state.get('verdict')} | has_mim={mim_decision is not None}")
    
    try:
        # Run feedback agent with MIM decision
        feedback = _run_with_timeout(
            feedback_agent,
            (state["context"], state, mim_decision),  # Pass MIM decision
            timeout_seconds=AGENT_TIME_BUDGETS["feedback_agent"],
            fallback=_get_fallback_feedback(state),
            agent_name="feedback_agent"
        )
        
        state["feedback"] = feedback
        
        # Use MIM's pattern if available (replaces pattern_detection_agent)
        if mim_decision and mim_decision.pattern.pattern_name:
            state["detected_pattern"] = mim_decision.pattern.pattern_name
            state["pattern_confidence"] = mim_decision.pattern.confidence
        elif feedback and feedback.detected_pattern:
            state["detected_pattern"] = feedback.detected_pattern
            state["pattern_confidence"] = 0.7  # Default confidence for agent-detected
        else:
            state["detected_pattern"] = None
            state["pattern_confidence"] = 0.0
        
        # Store in agent_results for coordination
        if state.get("agent_results") and feedback:
            state["agent_results"]["feedback_explanation"] = feedback.explanation
            state["agent_results"]["feedback_hint"] = feedback.improvement_hint
            state["agent_results"]["feedback_pattern"] = state.get("detected_pattern")
            state["agent_results"]["pattern_confidence"] = state.get("pattern_confidence", 0.0)
            if mim_decision:
                state["agent_results"]["mim_pattern_recurring"] = mim_decision.pattern.is_recurring
        
        elapsed = time.time() - start
        state["_node_timings"]["feedback_agent"] = elapsed
        
        _vprint(f"✅ [FEEDBACK AGENT v3.0] Completed in {elapsed:.2f}s")
        if feedback:
            _vprint(f"   └─ Explanation: {feedback.explanation[:100]}..." if feedback.explanation else "   └─ Explanation: N/A")
            _vprint(f"   └─ Pattern: {state.get('detected_pattern')} (MIM-provided)" if mim_decision else f"   └─ Pattern: {state.get('detected_pattern')}")
            if mim_decision and mim_decision.pattern.is_recurring:
                _vprint(f"   ⚠️ RECURRING PATTERN: User made this mistake {mim_decision.pattern.recurrence_count} times before!")
        
    except Exception as e:
        logger.error(f"❌ Feedback agent failed: {e}")
        state["feedback"] = _get_fallback_feedback(state)
    
    return state


def _get_fallback_feedback(state: MentatSyncState) -> FeedbackResponse:
    """Generate verdict-appropriate fallback feedback"""
    verdict = state.get("verdict", "unknown").lower()
    
    VERDICT_FALLBACKS = {
        "accepted": FeedbackResponse(
            explanation="Congratulations! Your solution correctly handles all test cases. The approach you used is valid and produces correct results. Consider reviewing the complexity analysis for potential optimizations.",
            improvement_hint="Solution is correct. Review complexity for potential optimizations.",
            detected_pattern=None
        ),
        "wrong_answer": FeedbackResponse(
            explanation="Your solution produces incorrect output for some test cases. This typically indicates a logical issue in your algorithm or missing edge case handling. Carefully trace through your code with the failing inputs to identify where the output diverges from expected.",
            improvement_hint="Review your algorithm's logic against the problem constraints and edge cases.",
            detected_pattern="Logical error"
        ),
        "time_limit_exceeded": FeedbackResponse(
            explanation="Your solution exceeds the time limit, indicating that your algorithm's time complexity is too high for the given constraints. Look for opportunities to reduce nested loops or use more efficient data structures.",
            improvement_hint="Consider using more efficient data structures or algorithms to reduce time complexity.",
            detected_pattern="Time complexity issue"
        ),
        "runtime_error": FeedbackResponse(
            explanation="Your code crashed during execution, which typically happens due to null references, array index out of bounds, stack overflow, or division by zero. Check your code for these common issues.",
            improvement_hint="Add defensive checks for edge cases and validate array indices before accessing.",
            detected_pattern="Runtime safety"
        ),
        "compile_error": FeedbackResponse(
            explanation="Your code has syntax errors and cannot compile. Common causes include missing brackets, semicolons, incorrect variable declarations, or type mismatches. Review the compiler error message carefully.",
            improvement_hint="Check for missing brackets, semicolons, or type mismatches in your code.",
            detected_pattern="Syntax error"
        ),
    }
    
    return VERDICT_FALLBACKS.get(verdict, FeedbackResponse(
        explanation="Your submission encountered an issue during processing. Please review your approach against the problem requirements and ensure your solution handles all specified constraints.",
        improvement_hint="Check the problem requirements carefully and review your implementation.",
        detected_pattern=None
    ))


def pattern_detection_node(state: MentatSyncState) -> MentatSyncState:
    """
    PATTERN DETECTION v3.0: MIM handles this now.
    
    This node is kept for backward compatibility but is now a NO-OP.
    Pattern detection is handled by MIM's PatternEngine (no LLM call).
    
    The pattern is already set by feedback_node from MIMDecision.
    """
    if not state["plan"].get("run_pattern_detection", False):
        _vprint(f"⏭️  [PATTERN] Skipped by orchestrator plan")
        return state
    
    # v3.0: Pattern already detected by MIM in feedback_node
    mim_decision = state.get("mim_decision")
    if mim_decision:
        _vprint(f"✅ [PATTERN v3.0] Using MIM pattern: {mim_decision.pattern.pattern_name or 'None'}")
        if mim_decision.pattern.is_recurring:
            _vprint(f"   ⚠️ RECURRING: {mim_decision.pattern.recurrence_count} times")
        # Pattern already set by feedback_node
        return state
    
    # Fallback: If no MIM, pattern was set by feedback_agent
    pattern = state.get("detected_pattern")
    _vprint(f"⚠️  [PATTERN] No MIM - using feedback agent pattern: {pattern}")
    
    return state


def hint_node(state: MentatSyncState) -> MentatSyncState:
    """
    HINT AGENT v3.1: Generate hint using MINIMAL context.
    
    MUST COMPLETE - No budget skipping.
    v3.1: Uses pre-built minimal context for fast execution.
    """
    if not state["plan"]["run_hint"]:
        _vprint(f"⏭️  [HINT] Skipped by orchestrator plan")
        return state
    
    _log_budget_status(state, "hint")
    
    start = time.time()
    mim_decision = state.get("mim_decision")
    
    _vprint(f"\n✂️ [HINT AGENT v3.1] Generating hint (minimal context)...")
    
    try:
        # Get feedback hint for context
        feedback = state.get("feedback")
        raw_hint = feedback.improvement_hint if feedback and feedback.improvement_hint else ""
        
        # v3.1: Use minimal context (pre-built or build now)
        hint_context = build_hint_context_minimal(
            mim_decision=mim_decision,
            feedback_hint=raw_hint,
        )
        
        # Log context size
        _vprint(f"   └─ Hint context size: {len(hint_context)} chars (optimized)")
        
        # Run hint agent with minimal context
        hint_result = _run_with_timeout(
            hint_agent,
            (raw_hint, {"hint_context": hint_context}, mim_decision),  # Pass minimal context
            timeout_seconds=AGENT_TIME_BUDGETS["hint_agent"],
            fallback=None,
            agent_name="hint_agent"
        )
        
        if hint_result and hasattr(hint_result, 'hint'):
            state["improvement_hint"] = hint_result.hint
        else:
            # Fallback: Use MIM hint direction or feedback hint
            if mim_decision:
                state["improvement_hint"] = mim_decision.hint_instruction.hint_direction[:100]
            elif feedback and feedback.improvement_hint:
                state["improvement_hint"] = feedback.improvement_hint
            else:
                state["improvement_hint"] = "Review your approach against the problem constraints."
        
        # Store in agent_results
        if state.get("agent_results"):
            state["agent_results"]["final_hint"] = state["improvement_hint"]
        
        elapsed = time.time() - start
        state["_node_timings"]["hint_agent"] = elapsed
        
        _vprint(f"✅ [HINT AGENT v3.1] Completed in {elapsed:.2f}s")
        _vprint(f"   └─ Hint: {state['improvement_hint'][:80]}..." if state.get('improvement_hint') else "   └─ Hint: N/A")
        
    except Exception as e:
        logger.error(f"❌ Hint agent failed: {e}")
        mim_decision = state.get("mim_decision")
        feedback = state.get("feedback")
        if mim_decision:
            state["improvement_hint"] = mim_decision.hint_instruction.hint_direction[:100]
        elif feedback and feedback.improvement_hint:
            state["improvement_hint"] = feedback.improvement_hint
        else:
            state["improvement_hint"] = "Review your approach carefully against the problem requirements."
    
    return state


# ═══════════════════════════════════════════════════════════════════════════════
# WORKFLOW BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

def _timing_summary_node(state: MentatSyncState) -> MentatSyncState:
    """Final node: Log timing summary for debugging"""
    if state.get("_workflow_start"):
        total_elapsed = time.time() - state["_workflow_start"]
        timings = state.get("_node_timings", {})
        
        _vprint(f"\n{'='*60}")
        _vprint(f"📊 SYNC WORKFLOW TIMING SUMMARY")
        _vprint(f"{'='*60}")
        _vprint(f"⏱️  Total elapsed: {total_elapsed:.2f}s (budget: {SYNC_TOTAL_BUDGET_SECONDS}s)")
        _vprint(f"📊 Node timings:")
        for node, duration in timings.items():
            _vprint(f"   └─ {node}: {duration:.2f}s")
        
        if total_elapsed > SYNC_TOTAL_BUDGET_SECONDS:
            _vprint(f"⚠️  BUDGET EXCEEDED by {total_elapsed - SYNC_TOTAL_BUDGET_SECONDS:.2f}s")
            logger.warning(f"⚠️ Sync workflow exceeded budget: {total_elapsed:.2f}s > {SYNC_TOTAL_BUDGET_SECONDS}s")
        else:
            _vprint(f"✅ Within budget ({SYNC_TOTAL_BUDGET_SECONDS - total_elapsed:.2f}s remaining)")
        
        _vprint(f"{'='*60}\n")
        
        logger.info(f"📊 Sync workflow completed | total={total_elapsed:.2f}s | timings={timings}")
    
    return state


def build_sync_workflow():
    """
    Build the SYNC workflow graph.
    
    FLOW (with MIM integration):
    1. retrieve_memory → retrieve_problem                        [Data fetch, ~2-3s]
    2. mim_prediction                                            [ML inference, ~0.3s]
    3. build_user_profile → orchestrator → build_context         [Fast, <1s]
    4. feedback                                                  [LLM, ~5-8s]
    5. pattern_detection + hint                                  [Optional, skippable]
    6. timing_summary                                            [Logging only]
    
    TOTAL TARGET: <15 seconds (extended for MIM)
    """
    graph = StateGraph(MentatSyncState)

    # Core nodes
    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("retrieve_problem", retrieve_problem_node)
    graph.add_node("mim_prediction", mim_prediction_node)  # ✨ NEW: MIM Intelligence
    graph.add_node("build_user_profile", build_user_profile_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("hint", hint_node)
    graph.add_node("timing_summary", _timing_summary_node)

    graph.set_entry_point("retrieve_memory")

    # Flow: Sequential with MIM integration
    # retrieve_memory → retrieve_problem → mim_prediction → build_user_profile → orchestrator
    graph.add_edge("retrieve_memory", "retrieve_problem")
    graph.add_edge("retrieve_problem", "mim_prediction")  # ✨ NEW EDGE
    graph.add_edge("mim_prediction", "build_user_profile")  # ✨ MODIFIED EDGE
    graph.add_edge("build_user_profile", "orchestrator")
    
    # orchestrator → build_context → feedback
    graph.add_edge("orchestrator", "build_context")
    graph.add_edge("build_context", "feedback")
    
    # feedback → pattern_detection → hint → timing_summary → END
    graph.add_edge("feedback", "hint")
    graph.add_edge("hint", "timing_summary")
    graph.add_edge("timing_summary", END)

    return graph.compile()


sync_workflow = build_sync_workflow()
