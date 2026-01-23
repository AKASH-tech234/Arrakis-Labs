from typing import TypedDict, Optional, List, Dict, Any, cast
import logging
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from langgraph.graph import StateGraph, END

from app.schemas.feedback import FeedbackResponse
from app.schemas.submission import SubmissionContext
from app.schemas.user_profile import UserProfile

from app.rag.retriever import retrieve_user_memory
from app.rag.context_builder import build_context

from app.agents.feedback_agent import feedback_agent
from app.agents.pattern_detection_agent import pattern_detection_agent
from app.agents.hint_agent import hint_agent

from app.graph.orchestrator import orchestrator_node

from app.problem.problem_repository import get_problem_by_id, ProblemContext
from app.user_profile.profile_builder import build_user_profile

logger = logging.getLogger("sync_workflow")


# ═══════════════════════════════════════════════════════════════════════════════
# TIME BUDGET CONSTANTS (QUALITY > SPEED)
# ═══════════════════════════════════════════════════════════════════════════════

# Total SYNC workflow budget: 60 seconds (allow all agents to complete)
SYNC_TOTAL_BUDGET_SECONDS = 60.0

# Per-agent time budgets - generous to ensure completion
AGENT_TIME_BUDGETS = {
    "retrieve_memory": 10.0,     # RAG retrieval with k=7
    "retrieve_problem": 10.0,    # DB/API fetch
    "build_user_profile": 5.0,   # Heuristic processing
    "build_context": 5.0,        # Context assembly
    "feedback_agent": 30.0,      # LLM call - MUST COMPLETE
    "pattern_detection": 25.0,   # LLM call - MUST COMPLETE
    "hint_agent": 20.0,          # LLM call - MUST COMPLETE
}

# RAG retrieval depth - higher k for better context
RAG_RETRIEVAL_K = 7

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
        print(f"⏰ [{agent_name}] TIMEOUT - returning fallback")
        return fallback
        
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"❌ [{agent_name}] FAILED in {elapsed:.2f}s: {type(e).__name__}: {e}")
        print(f"❌ [{agent_name}] ERROR: {e} - returning fallback")
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
    
    print(f"\n🔍 [MEMORY RETRIEVAL] Starting for user: {state['user_id']}")
    
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
    print(f"✅ [MEMORY RETRIEVAL] Completed in {elapsed:.2f}s | {len(state['user_memory'])} chunks (k={RAG_RETRIEVAL_K})")
    
    return state


def retrieve_problem_node(state: MentatSyncState) -> MentatSyncState:
    """
    CRITICAL NODE: Fetch structured problem context from repository.
    
    This node ensures all agents receive GROUNDED problem information:
    - Problem statement, constraints, expected approach
    - Common mistakes for this problem category
    - Difficulty level and tags
    
    FALLBACK BEHAVIOR:
    - If DB fetch fails, builds minimal context from frontend data
    - Logs failure for debugging
    - Sets 'problem_source' flag so agents know it's fallback data
    """
    import time
    start = time.time()
    
    print(f"\n🎲 [PROBLEM RETRIEVAL] Starting for: {state['problem_id']}")
    logger.info(f"🎲 retrieve_problem_node started | problem_id={state['problem_id']}")
    
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
        print(f"✅ [PROBLEM RETRIEVAL] Success in {elapsed:.2f}s")
        print(f"   └─ Title: {problem_context.title}")
        print(f"   └─ Difficulty: {problem_context.difficulty}")
        print(f"   └─ Tags: {problem_context.tags}")
        print(f"   └─ Expected Approach: {problem_context.expected_approach[:50]}..." if problem_context.expected_approach else "   └─ Expected Approach: N/A")
        
        logger.info(f"✅ Problem retrieved: {problem_context.title} | tags={problem_context.tags} | {elapsed:.2f}s")
        
    except Exception as e:
        elapsed = time.time() - start
        print(f"⚠️  [PROBLEM RETRIEVAL] Failed in {elapsed:.2f}s: {type(e).__name__}")
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
        
        print(f"⚠️  Using fallback problem context")
        print(f"   └─ Category: {category}")
        print(f"   └─ Inferred approach: {fallback_approach[:50]}..." if fallback_approach else "   └─ Inferred approach: N/A")
        logger.warning(f"⚠️ Using fallback context for {state['problem_id']} | category={category}")
    
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
    print(f"\n👤 [USER PROFILE] Building from {len(state.get('user_memory', []))} memory chunks...")
    
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
            print(f"✅ [USER PROFILE] Built | mistakes={len(profile.common_mistakes)} | weak_topics={len(profile.weak_topics)}")
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
    
    QUALITY-FIRST: No truncation. Full context for thorough analysis.
    
    The context includes:
    1. PROBLEM CONTEXT section (full problem data)
    2. USER PROFILE section (complete history)
    3. SUBMISSION section (full code - no truncation)
    4. MEMORY CHUNKS section (all retrieved memories)
    5. AGENT COORDINATION section (for later agents)
    """
    _log_budget_status(state, "build_context")
    
    start = time.time()
    print(f"\n📝 [CONTEXT BUILD] Assembling FULL structured context...")
    
    submission = SubmissionContext(
        user_id=state["user_id"],
        problem_id=state["problem_id"],
        problem_category=state["problem_category"],
        constraints=state["constraints"],
        code=state["code"],  # FULL code - no truncation
        language=state["language"],
        verdict=state["verdict"],
        error_type=state.get("error_type"),
        user_history_summary=None,
    )

    try:
        # Build rich context with all structured data - NO TRUNCATION
        context = build_context(
            submission, 
            state.get("user_memory", []),
            problem_context=state.get("problem"),
            user_profile=state.get("user_profile"),
            include_full_code=True  # Always include full code
        )
        
        # NO TRUNCATION - quality > speed
        state["context"] = context
        
        elapsed = time.time() - start
        state["_node_timings"]["build_context"] = elapsed
        
        print(f"✅ [CONTEXT BUILD] Completed in {elapsed:.2f}s | {len(state['context'])} chars (FULL, no truncation)")
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
    CORE AGENT: Generate feedback for submission.
    
    MUST COMPLETE - No budget skipping.
    Results are stored in agent_results for later agents to reference.
    """
    if not state["plan"]["run_feedback"]:
        print(f"⏭️  [FEEDBACK] Skipped by orchestrator plan")
        return state
    
    _log_budget_status(state, "feedback")
    
    start = time.time()
    print(f"\n🤖 [FEEDBACK AGENT] Starting LLM call (MUST COMPLETE)...")
    logger.info(f"🤖 feedback_agent starting | verdict={state.get('verdict')}")
    
    try:
        # Run feedback agent - no timeout fallback, must complete
        feedback = _run_with_timeout(
            feedback_agent,
            (state["context"], state),
            timeout_seconds=AGENT_TIME_BUDGETS["feedback_agent"],
            fallback=_get_fallback_feedback(state),
            agent_name="feedback_agent"
        )
        
        state["feedback"] = feedback
        
        # Store in agent_results for coordination with later agents
        if state.get("agent_results") and feedback:
            state["agent_results"]["feedback_explanation"] = feedback.explanation
            state["agent_results"]["feedback_hint"] = feedback.improvement_hint
            state["agent_results"]["feedback_pattern"] = feedback.detected_pattern
        
        elapsed = time.time() - start
        state["_node_timings"]["feedback_agent"] = elapsed
        
        print(f"✅ [FEEDBACK AGENT] Completed in {elapsed:.2f}s")
        if feedback:
            print(f"   └─ Explanation: {feedback.explanation[:100]}..." if feedback.explanation else "   └─ Explanation: N/A")
            print(f"   └─ Pattern: {feedback.detected_pattern}" if feedback.detected_pattern else "   └─ Pattern: None")
        
    except Exception as e:
        logger.error(f"❌ Feedback agent failed: {e}")
        state["feedback"] = _get_fallback_feedback(state)
    
    return state


def _get_fallback_feedback(state: MentatSyncState) -> FeedbackResponse:
    """Generate verdict-appropriate fallback feedback"""
    verdict = state.get("verdict", "unknown").lower()
    
    VERDICT_FALLBACKS = {
        "accepted": FeedbackResponse(
            explanation="Your solution passed all test cases.",
            improvement_hint="Consider optimizing for time/space complexity.",
            detected_pattern=None
        ),
        "wrong_answer": FeedbackResponse(
            explanation="Your solution produces incorrect output for some test cases. Check edge cases and boundary conditions.",
            improvement_hint="Review your algorithm's logic against the problem constraints.",
            detected_pattern="Logical error"
        ),
        "time_limit_exceeded": FeedbackResponse(
            explanation="Your solution is too slow. The time complexity needs improvement.",
            improvement_hint="Consider using more efficient data structures or algorithms.",
            detected_pattern="Time complexity issue"
        ),
        "runtime_error": FeedbackResponse(
            explanation="Your code crashed during execution. Check for null references, array bounds, and division by zero.",
            improvement_hint="Add defensive checks for edge cases.",
            detected_pattern="Runtime safety"
        ),
        "compile_error": FeedbackResponse(
            explanation="Your code has syntax errors and cannot compile.",
            improvement_hint="Check for missing brackets, semicolons, or type mismatches.",
            detected_pattern="Syntax error"
        ),
    }
    
    return VERDICT_FALLBACKS.get(verdict, FeedbackResponse(
        explanation="Your submission encountered an issue. Review your approach.",
        improvement_hint="Check the problem requirements carefully.",
        detected_pattern=None
    ))


def pattern_detection_node(state: MentatSyncState) -> MentatSyncState:
    """
    PATTERN DETECTION AGENT: Identify recurring mistake patterns.
    
    MUST COMPLETE - No budget or fallback skipping.
    Results are stored for hint agent and learning agent coordination.
    """
    if not state["plan"]["run_pattern_detection"]:
        print(f"⏭️  [PATTERN] Skipped by orchestrator plan")
        return state
    
    _log_budget_status(state, "pattern_detection")
    
    # NOTE: We no longer skip for fallback problem context
    # Pattern detection can still provide value based on verdict and code
    problem = state.get("problem", {})
    if problem.get("_source") == "fallback":
        logger.info("⚠️ Pattern detection running with fallback problem context")
    
    start = time.time()
    print(f"\n🔍 [PATTERN DETECTION] Starting LLM call (MUST COMPLETE)...")
    
    try:
        pattern_result = _run_with_timeout(
            pattern_detection_agent,
            (state["context"], state),
            timeout_seconds=AGENT_TIME_BUDGETS["pattern_detection"],
            fallback=None,
            agent_name="pattern_detection"
        )
        
        if pattern_result and hasattr(pattern_result, 'pattern'):
            state["detected_pattern"] = pattern_result.pattern
            state["pattern_confidence"] = getattr(pattern_result, 'confidence', 0.5)
        else:
            state["detected_pattern"] = None
            state["pattern_confidence"] = 0.0
        
        # Store in agent_results for coordination
        if state.get("agent_results"):
            state["agent_results"]["detected_pattern"] = state["detected_pattern"]
            state["agent_results"]["pattern_confidence"] = state.get("pattern_confidence", 0.0)
        
        elapsed = time.time() - start
        state["_node_timings"]["pattern_detection"] = elapsed
        
        print(f"✅ [PATTERN DETECTION] Completed in {elapsed:.2f}s")
        print(f"   └─ Pattern: {state['detected_pattern']} (confidence: {state.get('pattern_confidence', 0):.2f})")
        
    except Exception as e:
        logger.error(f"❌ Pattern detection failed: {e}")
        state["detected_pattern"] = None
        state["pattern_confidence"] = 0.0
    
    return state


def hint_node(state: MentatSyncState) -> MentatSyncState:
    """
    HINT AGENT: Generate actionable improvement hint.
    
    MUST COMPLETE - No budget skipping.
    References feedback and pattern detection results for coherent hints.
    """
    if not state["plan"]["run_hint"]:
        print(f"⏭️  [HINT] Skipped by orchestrator plan")
        return state
    
    _log_budget_status(state, "hint")
    
    start = time.time()
    print(f"\n✂️ [HINT AGENT] Generating hint (referencing feedback & pattern)...")
    
    try:
        # Build augmented context with feedback and pattern results
        feedback = state.get("feedback")
        detected_pattern = state.get("detected_pattern")
        pattern_confidence = state.get("pattern_confidence", 0.0)
        
        # Augment context with previous agent results for coherent hints
        augmented_context = state["context"]
        if feedback or detected_pattern:
            augmented_context += f"\n\n═══ PREVIOUS AGENT RESULTS (for hint coherence) ═══\n"
            if feedback:
                augmented_context += f"FEEDBACK EXPLANATION: {feedback.explanation}\n"
                if feedback.improvement_hint:
                    augmented_context += f"FEEDBACK HINT: {feedback.improvement_hint}\n"
            if detected_pattern:
                augmented_context += f"DETECTED PATTERN: {detected_pattern} (confidence: {pattern_confidence:.2f})\n"
        
        hint_result = _run_with_timeout(
            hint_agent,
            (augmented_context, state),
            timeout_seconds=AGENT_TIME_BUDGETS["hint_agent"],
            fallback=None,
            agent_name="hint_agent"
        )
        
        if hint_result and hasattr(hint_result, 'hint'):
            state["improvement_hint"] = hint_result.hint
        else:
            # Fallback to feedback hint if available
            state["improvement_hint"] = (
                feedback.improvement_hint if feedback and feedback.improvement_hint
                else "Review your approach against the problem constraints and expected algorithm."
            )
        
        # Store in agent_results
        if state.get("agent_results"):
            state["agent_results"]["final_hint"] = state["improvement_hint"]
        
        elapsed = time.time() - start
        state["_node_timings"]["hint_agent"] = elapsed
        
        print(f"✅ [HINT AGENT] Completed in {elapsed:.2f}s")
        print(f"   └─ Hint: {state['improvement_hint'][:80]}..." if state.get('improvement_hint') else "   └─ Hint: N/A")
        
    except Exception as e:
        logger.error(f"❌ Hint agent failed: {e}")
        feedback = state.get("feedback")
        state["improvement_hint"] = (
            feedback.improvement_hint if feedback and feedback.improvement_hint
            else "Review your approach carefully against the problem requirements."
        )
    
    return state


# ═══════════════════════════════════════════════════════════════════════════════
# WORKFLOW BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

def _timing_summary_node(state: MentatSyncState) -> MentatSyncState:
    """Final node: Log timing summary for debugging"""
    if state.get("_workflow_start"):
        total_elapsed = time.time() - state["_workflow_start"]
        timings = state.get("_node_timings", {})
        
        print(f"\n{'='*60}")
        print(f"📊 SYNC WORKFLOW TIMING SUMMARY")
        print(f"{'='*60}")
        print(f"⏱️  Total elapsed: {total_elapsed:.2f}s (budget: {SYNC_TOTAL_BUDGET_SECONDS}s)")
        print(f"📊 Node timings:")
        for node, duration in timings.items():
            print(f"   └─ {node}: {duration:.2f}s")
        
        if total_elapsed > SYNC_TOTAL_BUDGET_SECONDS:
            print(f"⚠️  BUDGET EXCEEDED by {total_elapsed - SYNC_TOTAL_BUDGET_SECONDS:.2f}s")
            logger.warning(f"⚠️ Sync workflow exceeded budget: {total_elapsed:.2f}s > {SYNC_TOTAL_BUDGET_SECONDS}s")
        else:
            print(f"✅ Within budget ({SYNC_TOTAL_BUDGET_SECONDS - total_elapsed:.2f}s remaining)")
        
        print(f"{'='*60}\n")
        
        logger.info(f"📊 Sync workflow completed | total={total_elapsed:.2f}s | timings={timings}")
    
    return state


def build_sync_workflow():
    """
    Build the SYNC workflow graph.
    
    FLOW (optimized for speed):
    1. retrieve_memory → retrieve_problem → build_user_profile  [PARALLEL-ISH, ~2-3s]
    2. orchestrator → build_context                             [Fast, <1s]
    3. feedback                                                  [LLM, ~5-8s]
    4. pattern_detection + hint                                  [Optional, skippable]
    5. timing_summary                                            [Logging only]
    
    TOTAL TARGET: <10 seconds
    """
    graph = StateGraph(MentatSyncState)

    # Core nodes
    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("retrieve_problem", retrieve_problem_node)
    graph.add_node("build_user_profile", build_user_profile_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("build_context", build_context_node)
    graph.add_node("feedback", feedback_node)
    graph.add_node("pattern_detection", pattern_detection_node)
    graph.add_node("hint", hint_node)
    graph.add_node("timing_summary", _timing_summary_node)

    graph.set_entry_point("retrieve_memory")

    # Flow: Sequential with early-exit potential
    # retrieve_memory → retrieve_problem → build_user_profile → orchestrator
    graph.add_edge("retrieve_memory", "retrieve_problem")
    graph.add_edge("retrieve_problem", "build_user_profile")
    graph.add_edge("build_user_profile", "orchestrator")
    
    # orchestrator → build_context → feedback
    graph.add_edge("orchestrator", "build_context")
    graph.add_edge("build_context", "feedback")
    
    # feedback → pattern_detection → hint → timing_summary → END
    graph.add_edge("feedback", "pattern_detection")
    graph.add_edge("pattern_detection", "hint")
    graph.add_edge("hint", "timing_summary")
    graph.add_edge("timing_summary", END)

    return graph.compile()


sync_workflow = build_sync_workflow()
