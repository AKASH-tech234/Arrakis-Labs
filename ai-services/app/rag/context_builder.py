"""
Context Builder - Structured Context for Agent Prompts
======================================================

This module builds STRUCTURED context that agents can reliably parse.

CRITICAL: Agents receive explicit sections, NOT raw concatenated blobs.

Sections:
1. PROBLEM CONTEXT - title, statement, constraints, expected approach
2. USER PROFILE - common mistakes, weak topics, success rate
3. CURRENT SUBMISSION - code, verdict, error type
4. ANALYSIS RULES - instructions for the agent

The context is designed to be:
- Parseable by LLMs
- Grounded in real data
- Explicitly structured
"""

from typing import List, Dict, Any, Optional
import logging

from app.schemas.submission import SubmissionContext
from app.db.mongodb import mongo_client

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION FORMATTERS
# ═══════════════════════════════════════════════════════════════════════════════

def format_problem_section(problem_context: Optional[Dict[str, Any]]) -> str:
    """
    Format problem context for agent prompts.
    
    CRITICAL: Agents use this to ground their feedback.
    If problem is fallback, agents should know and adjust behavior.
    """
    if not problem_context:
        return """
⚠️ PROBLEM DETAILS NOT AVAILABLE
- Agents should provide generic, verdict-based feedback
- Do not make assumptions about specific problem requirements
"""
    
    is_fallback = problem_context.get("_source") == "fallback"
    fallback_warning = "\n⚠️ NOTE: Using fallback data - problem details may be incomplete" if is_fallback else ""
    
    # Build expected approach section
    expected_approach = problem_context.get('expected_approach', 'Not specified')
    approach_section = f"Expected Approach: {expected_approach}" if expected_approach != 'Not specified' else ""
    
    # Build common mistakes section
    common_mistakes = problem_context.get('common_mistakes', [])
    mistakes_section = f"Known Pitfalls: {', '.join(common_mistakes[:3])}" if common_mistakes else ""
    
    return f"""
Problem ID: {problem_context.get('problem_id', 'N/A')}
Title: {problem_context.get('title', 'Unknown Problem')}
Difficulty: {problem_context.get('difficulty', 'Medium')}
Tags: {', '.join(problem_context.get('tags', ['General']))}
{approach_section}
{mistakes_section}
Constraints: {problem_context.get('constraints', 'Not provided')}
{fallback_warning}
""".strip()


def format_user_profile_section(user_profile: Optional[Dict[str, Any]]) -> str:
    """
    Format user profile for agent prompts.
    
    CRITICAL: Agents use this for personalization.
    Empty profile means generic advice only.
    """
    if not user_profile:
        return "No historical data available. Provide generic feedback."
    
    sections = []
    
    # Recurring mistakes (most important for personalization)
    mistakes = user_profile.get('common_mistakes', [])
    if mistakes:
        sections.append(f"🔄 RECURRING MISTAKES: {', '.join(mistakes[:3])}")
        sections.append("   → CHECK if current submission repeats these patterns")
    
    # Weak topics
    weak_topics = user_profile.get('weak_topics', [])
    if weak_topics:
        sections.append(f"📚 WEAK TOPICS: {', '.join(weak_topics[:3])}")
    
    # Recurring patterns (abstract)
    patterns = user_profile.get('recurring_patterns', [])
    if patterns:
        sections.append(f"🔍 PATTERNS: {', '.join(patterns[:2])}")
    
    # Success rate (for difficulty adjustment)
    success_rate = user_profile.get('success_rate')
    if success_rate is not None:
        sections.append(f"📊 Success Rate: {success_rate:.1%}")
    
    # Total submissions (for context)
    total_subs = user_profile.get('total_submissions')
    if total_subs:
        sections.append(f"📝 Total Submissions: {total_subs}")
    
    # Is fallback?
    if user_profile.get('_source') == 'fallback':
        sections.append("⚠️ NOTE: Limited user history - provide general advice")
    
    return '\n'.join(sections) if sections else "No significant patterns detected."


def format_memory_chunks(user_memory: Optional[List[str]]) -> str:
    """
    Format RAG memory chunks for agent prompts.
    
    These are historical mistakes/submissions retrieved via similarity search.
    HARDENED: Handles mixed types gracefully.
    """
    if not user_memory:
        return "No prior submissions retrieved from memory."
    
    # Format with indices for reference
    chunks = []
    for i, chunk in enumerate(user_memory[:5], 1):  # Limit to 5 chunks
        # DEFENSIVE: Handle non-string chunks
        if isinstance(chunk, dict):
            chunk_text = chunk.get("content") or chunk.get("text") or chunk.get("page_content") or str(chunk)
        elif not isinstance(chunk, str):
            chunk_text = str(chunk)
        else:
            chunk_text = chunk
        
        # Truncate long chunks
        truncated = chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text
        chunks.append(f"[{i}] {truncated}")
    
    if not chunks:
        return "No prior submissions retrieved from memory."
    
    return '\n'.join(chunks)


def format_mim_section(mim_insights: Optional[Dict[str, Any]]) -> str:
    """
    Format MIM predictions for agent prompts.
    
    Provides structured ML predictions to guide agent analysis.
    """
    if not mim_insights:
        return ""
    
    try:
        root_cause = mim_insights.get("root_cause", {})
        readiness = mim_insights.get("readiness", {})
        performance = mim_insights.get("performance_forecast", {})
        similar_mistakes = mim_insights.get("similar_past_mistakes", [])
        focus_areas = mim_insights.get("recommended_focus_areas", [])
        is_cold_start = mim_insights.get("is_cold_start", False)
        
        confidence = root_cause.get("confidence", 0)
        confidence_level = "HIGH" if confidence >= 0.7 else "MEDIUM" if confidence >= 0.5 else "LOW"
        
        cold_start_note = "\n⚠️ NEW USER: Limited history - predictions based on problem difficulty" if is_cold_start else ""
        
        similar_str = "\n".join([f"   • {m[:100]}..." if len(m) > 100 else f"   • {m}" for m in similar_mistakes[:3]]) if similar_mistakes else "   (No similar mistakes found)"
        focus_str = "\n".join([f"   • {f}" for f in focus_areas[:3]]) if focus_areas else "   (Continue current approach)"
        
        return f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🧠 MIM INTELLIGENCE INSIGHTS (Confidence: {confidence_level})                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
{cold_start_note}

PREDICTED ROOT CAUSE: {root_cause.get('failure_cause', 'unknown')}
   Confidence: {confidence:.0%}

USER READINESS:
   Current Level: {readiness.get('current_level', 'Medium')}
   Easy: {readiness.get('easy_readiness', 0.5):.0%} | Medium: {readiness.get('medium_readiness', 0.5):.0%} | Hard: {readiness.get('hard_readiness', 0.3):.0%}

PERFORMANCE FORECAST:
   Expected Success (next 5): {performance.get('expected_success_rate', 0.5):.0%}
   Learning Velocity: {performance.get('learning_velocity', 'stable')}

SIMILAR PAST MISTAKES:
{similar_str}

RECOMMENDED FOCUS AREAS:
{focus_str}

═══════════════════════════════════════════════════════════════════════════════
MIM USAGE INSTRUCTIONS:
- If confidence >= 70%: Structure feedback around predicted root cause
- If confidence 50-70%: Consider MIM prediction as strong hypothesis  
- If confidence < 50%: Use as supplementary signal, investigate independently
- ALWAYS mention if your analysis agrees/disagrees with MIM prediction
═══════════════════════════════════════════════════════════════════════════════
"""
    except Exception as e:
        logger.warning(f"Failed to format MIM section: {e}")
        return ""


def _format_user_code(submission: SubmissionContext, include_full: bool = True) -> str:
    """
    Format user's submitted code for agent context.
    
    PHILOSOPHY: Full code is essential for accurate analysis.
    Truncation loses critical context like function definitions, imports, etc.
    
    Args:
        submission: The submission context
        include_full: If True, include entire code without truncation
    
    Returns:
        Formatted code string with line numbers
    """
    code = getattr(submission, 'code', None) or getattr(submission, 'user_code', None)
    
    if not code:
        return "⚠️ User code not available in submission context."
    
    if not include_full and len(code) > 4000:
        # Legacy truncation mode (not recommended)
        truncated_code = code[:4000] + f"\n\n... [TRUNCATED: {len(code) - 4000} more characters]"
        return f"```{submission.language}\n{truncated_code}\n```"
    
    # Add line numbers for precise reference
    lines = code.split('\n')
    numbered_lines = []
    for i, line in enumerate(lines, 1):
        numbered_lines.append(f"{i:4d} | {line}")
    
    numbered_code = '\n'.join(numbered_lines)
    
    return f"```{submission.language}\n{numbered_code}\n```\n(Total: {len(lines)} lines, {len(code)} characters)"


def build_context(
    submission: SubmissionContext,
    user_memory: Optional[List[str]] = None,
    problem_knowledge: Optional[List[str]] = None,
    problem_context: Optional[Dict[str, Any]] = None,
    user_profile: Optional[Dict[str, Any]] = None,
    include_full_code: bool = True,
    mim_insights: Optional[Dict[str, Any]] = None,  # ✨ NEW: MIM predictions
) -> str:
    """
    Build STRUCTURED context for agent consumption.
    
    CRITICAL: This context MUST be parseable by agents.
    Each section is clearly delimited and labeled.
    
    PHILOSOPHY: Include FULL context for maximum insight.
    Truncation is disabled by default - quality over brevity.
    
    Args:
        submission: Current submission data
        user_memory: RAG-retrieved memory chunks
        problem_knowledge: (deprecated) problem knowledge base
        problem_context: Structured problem data from repository
        user_profile: Structured user profile from profile builder
        include_full_code: If True, include full user code without truncation (DEFAULT: True)
        mim_insights: MIM prediction results for agent guidance
    
    Returns:
        Formatted context string with explicit sections
    """
    import time
    start = time.time()
    
    logger.debug(f"📄 build_context called | include_full_code={include_full_code} | mim={mim_insights is not None}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1: MONGODB STATISTICS (Real-time data)
    # ═══════════════════════════════════════════════════════════════════════════
    mongo_stats_section = ""
    try:
        # ✨ FIX: Check mongo_client first before accessing .db attribute
        if mongo_client is not None and mongo_client.db is not None:
            mongo_submissions = mongo_client.get_user_submissions(
                user_id=submission.user_id,
                limit=20
            )
            
            if mongo_submissions:
                total = len(mongo_submissions)
                accepted = len([s for s in mongo_submissions if s.get("status") == "accepted"])
                rate = (accepted / total * 100) if total > 0 else 0
                pattern = _analyze_pattern(mongo_submissions)
                
                mongo_stats_section = f"""
📊 REAL-TIME STATISTICS (MongoDB):
- Submissions analyzed: {total}
- Accepted: {accepted} ({rate:.1f}%)
- Recent trend: {pattern}
"""
                logger.info(f"✅ MongoDB stats: {total} submissions, {rate:.1f}% success")
            else:
                logger.debug("No MongoDB submissions found")
    except Exception as e:
        logger.warning(f"⚠️ MongoDB stats failed: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # BUILD SECTIONS
    # ═══════════════════════════════════════════════════════════════════════════
    problem_section = format_problem_section(problem_context)
    user_profile_section = format_user_profile_section(user_profile)
    memory_section = format_memory_chunks(user_memory)
    mim_section = format_mim_section(mim_insights)  # ✨ NEW: MIM insights section
    
    # Determine data quality flags
    has_grounded_problem = problem_context and problem_context.get("_source") != "fallback"
    has_user_history = bool(user_memory) or bool(user_profile and user_profile.get("common_mistakes"))
    has_mim_predictions = bool(mim_insights)  # ✨ NEW
    
    # ═══════════════════════════════════════════════════════════════════════════
    # BUILD FINAL CONTEXT
    # ═══════════════════════════════════════════════════════════════════════════
    context = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 1: PROBLEM DEFINITION                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
{problem_section}

╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 2: USER PROFILE & HISTORY                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
{user_profile_section}
{mongo_stats_section}

Historical Submissions (RAG Retrieved):
{memory_section}
{mim_section}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 3: CURRENT SUBMISSION                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
Language: {submission.language}
Verdict: {submission.verdict}
Error Type: {submission.error_type or "N/A"}

USER CODE:
{_format_user_code(submission, include_full_code)}

╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 4: ANALYSIS INSTRUCTIONS                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
DATA QUALITY FLAGS:
- Problem grounded: {"✓ YES" if has_grounded_problem else "✗ NO (use generic advice)"}
- User history available: {"✓ YES" if has_user_history else "✗ NO (skip personalization)"}
- MIM predictions available: {"✓ YES" if has_mim_predictions else "✗ NO (analyze without ML guidance)"}

MANDATORY ANALYSIS STEPS:
1. {"Compare user's approach with EXPECTED APPROACH" if has_grounded_problem else "Analyze based on verdict type only"}
2. {"Check if user repeats RECURRING MISTAKES from profile" if has_user_history else "Skip personalization"}
3. {"Use MIM root cause prediction as starting hypothesis (confidence shown above)" if has_mim_predictions else "Determine root cause independently"}
4. Reference specific problem CONSTRAINTS when relevant
5. Focus on THIS submission, not generic advice
6. If user has known WEAK TOPICS matching this problem, address them

OUTPUT REQUIREMENTS:
- Be specific to THIS problem
- Reference problem constraints
- If user repeats a known mistake, explicitly mention it
- {"State whether you agree/disagree with MIM's predicted root cause" if has_mim_predictions else ""}
- Do NOT provide full solutions or corrected code
╚══════════════════════════════════════════════════════════════════════════════╝
"""
    
    # Log context metrics
    elapsed = time.time() - start
    logger.info(f"📄 Context built | length={len(context)} | grounded={has_grounded_problem} | history={has_user_history} | {elapsed:.3f}s")
    
    # Log to RAG monitor
    try:
        from app.rag.monitoring import rag_monitor
        rag_monitor.log_context_usage(
            user_id=submission.user_id,
            context_length=len(context),
            memory_chunks_used=len(user_memory) if user_memory else 0,
            problem_context_present=has_grounded_problem,
            user_profile_present=has_user_history
        )
    except Exception as e:
        logger.debug(f"RAG monitoring failed: {e}")
    
    return context.strip()

def _analyze_pattern(submissions: List[Dict]) -> str:
    """Analyze recent submission pattern"""
    
    if len(submissions) < 3:
        return "Insufficient data"
    
    recent_3 = submissions[:3]
    statuses = [s["status"] for s in recent_3]
    
    if all(s == "accepted" for s in statuses):
        return "Improving (3 consecutive accepted)"
    elif all(s != "accepted" for s in statuses):
        return "Struggling (3 consecutive failures)"
    else:
        return "Mixed performance"