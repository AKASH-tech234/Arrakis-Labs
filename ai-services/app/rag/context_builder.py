"""
Context Builder - Structured Context for Agent Prompts
======================================================

This module builds STRUCTURED context that agents can reliably parse.

CRITICAL: Agents receive explicit sections, NOT raw concatenated blobs.

v3.1: Added focused context builders for specific agents:
- build_feedback_context: Full context for feedback agent (main agent)
- build_hint_context: Minimal context for hint agent (fast)
- build_learning_context: Minimal context for learning agent

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
# v3.1: FOCUSED CONTEXT BUILDERS (Optimized per-agent)
# ═══════════════════════════════════════════════════════════════════════════════

def build_feedback_context_focused(
    submission: SubmissionContext,
    problem_context: Optional[Dict[str, Any]] = None,
    user_profile: Optional[Dict[str, Any]] = None,
    mim_decision = None,  # MIMDecision object
) -> str:
    """
    Build FOCUSED context for feedback_agent.
    
    v3.1: Includes only what feedback needs:
    - Problem constraints & expected approach
    - User code (with line numbers)
    - MIM root cause & instructions
    - User weak topics (if recurring)
    
    v3.2: HARDENED null-safety for all optional fields
    
    Target: ~2500 chars for fast LLM inference
    """
    sections = []
    
    # 1. PROBLEM ESSENTIALS (constraints + expected approach) - NULL-SAFE
    if problem_context and isinstance(problem_context, dict):
        constraints = str(problem_context.get('constraints') or 'N/A')[:300]
        expected = str(problem_context.get('expected_approach') or 'Not specified')[:200]
        difficulty = str(problem_context.get('difficulty') or 'Medium')
        sections.append(f"""PROBLEM:
Difficulty: {difficulty}
Constraints: {constraints}
Expected Approach: {expected}""")
    else:
        sections.append("PROBLEM: Context not available - provide generic feedback")
    
    # 2. MIM INSTRUCTIONS (pre-computed analysis) - NULL-SAFE
    if mim_decision is not None:
        try:
            # Safely access nested attributes with defaults
            root_cause = getattr(mim_decision, 'root_cause', 'unknown') or 'unknown'
            confidence = getattr(mim_decision, 'root_cause_confidence', 0.0) or 0.0
            
            # Safely access feedback_instruction
            feedback_inst = getattr(mim_decision, 'feedback_instruction', None)
            tone = 'encouraging'
            is_recurring = False
            recurrence_count = 0
            edge_cases = []
            
            if feedback_inst is not None:
                tone = getattr(feedback_inst, 'tone', 'encouraging') or 'encouraging'
                is_recurring = getattr(feedback_inst, 'is_recurring_mistake', False) or False
                recurrence_count = getattr(feedback_inst, 'recurrence_count', 0) or 0
                edge_cases = getattr(feedback_inst, 'edge_cases_likely', []) or []
            
            # Safely access pattern
            pattern = getattr(mim_decision, 'pattern', None)
            if pattern is not None and is_recurring:
                pattern_count = getattr(pattern, 'recurrence_count', recurrence_count) or recurrence_count
            else:
                pattern_count = recurrence_count
            
            recurring_note = ""
            if is_recurring:
                recurring_note = f"\n⚠️ RECURRING MISTAKE ({pattern_count}x before)"
            
            edge_cases_str = ', '.join(edge_cases[:3]) if edge_cases else 'Analyze from code'
            
            sections.append(f"""MIM DIAGNOSIS:
Root Cause: {root_cause} (confidence: {confidence:.0%})
Tone: {tone}{recurring_note}
Edge Cases to Check: {edge_cases_str}""")
        except Exception as e:
            logger.warning(f"Failed to format MIM decision: {e}")
            sections.append("MIM DIAGNOSIS: Not available")
    
    # 3. USER CODE (with line numbers - ESSENTIAL for specific feedback)
    code = submission.code or ""
    if code:
        lines = code.split('\n')
        numbered = '\n'.join([f"{i+1:3d}| {line}" for i, line in enumerate(lines[:50])])  # Max 50 lines
        truncate_note = f"\n... [{len(lines) - 50} more lines]" if len(lines) > 50 else ""
        sections.append(f"""USER CODE ({submission.language}):
```
{numbered}{truncate_note}
```""")
    else:
        sections.append("USER CODE: ⚠️ EMPTY OR MISSING - Note this in feedback!")
    
    # 4. VERDICT & ERROR
    sections.append(f"""SUBMISSION:
Verdict: {submission.verdict}
Error Type: {submission.error_type or 'N/A'}""")
    
    # 5. USER WEAK TOPICS (only if relevant)
    if user_profile and user_profile.get('weak_topics'):
        weak = ', '.join(user_profile['weak_topics'][:3])
        sections.append(f"USER WEAK AREAS: {weak}")
    
    return '\n\n'.join(sections)


def build_hint_context_minimal(
    mim_decision,
    feedback_hint: str = "",
) -> str:
    """
    Build MINIMAL context for hint_agent.
    
    v3.1: ULTRA-LEAN - hints don't need deep reasoning.
    v3.2: HARDENED null-safety
    Target: < 500 chars for instant LLM inference
    """
    if mim_decision is not None:
        try:
            # Safely access hint_instruction with defaults
            hint_inst = getattr(mim_decision, 'hint_instruction', None)
            if hint_inst is not None:
                direction = str(getattr(hint_inst, 'hint_direction', '') or 'Review your approach')[:150]
                avoid_list = getattr(hint_inst, 'avoid_revealing', []) or []
                avoid = ', '.join(avoid_list[:3]) if avoid_list else 'N/A'
                return f"""COMPRESS THIS HINT:
Direction: {direction}
Avoid saying: {avoid}

Output: ONE sentence, max 20 words, starts with action verb."""
        except Exception as e:
            logger.warning(f"Failed to format hint context from MIM: {e}")
    
    # Fallback - NULL-SAFE
    feedback_hint = feedback_hint or ""
    if feedback_hint and '.' in feedback_hint:
        snippet = feedback_hint.split('.')[0][:100] + '.'
    elif feedback_hint:
        snippet = feedback_hint[:100]
    else:
        snippet = "Review approach."
    return f"""COMPRESS: {snippet}
Output: ONE sentence, max 20 words."""


def build_learning_context_minimal(
    mim_decision,
    problem_category: str = "",
) -> str:
    """
    Build MINIMAL context for learning_agent.
    
    v3.1: Only needs MIM's learning instruction.
    v3.2: HARDENED null-safety
    Target: < 400 chars
    """
    if mim_decision is not None:
        try:
            # Safely access learning_instruction with defaults
            learning_inst = getattr(mim_decision, 'learning_instruction', None)
            if learning_inst is not None:
                focus_areas = getattr(learning_inst, 'focus_areas', []) or []
                focus = ', '.join(focus_areas[:3]) if focus_areas else 'General practice'
                gap = str(getattr(learning_inst, 'skill_gap', '') or 'Not identified')[:100]
                return f"""EXPLAIN WHY THESE FOCUS AREAS MATTER:
Focus Areas: {focus}
Skill Gap: {gap}
Category: {problem_category or 'General'}

Output: 1-2 sentence rationale connecting focus areas to this mistake."""
        except Exception as e:
            logger.warning(f"Failed to format learning context from MIM: {e}")
    
    return f"""Category: {problem_category or 'General'}
Provide generic learning recommendation."""


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
    
    V2.1 Enhancement: Now includes difficulty adjustment and roadmap context.
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
        
        # V2.1: Difficulty adjustment insights
        difficulty_adjustment = mim_insights.get("difficulty_adjustment", {})
        frustration_index = difficulty_adjustment.get("frustration_index", 0)
        boredom_index = difficulty_adjustment.get("boredom_index", 0)
        adjustment_direction = difficulty_adjustment.get("adjustment", "maintain")
        adjustment_reason = difficulty_adjustment.get("reason", "")
        
        # V2.1: Roadmap context
        roadmap_context = mim_insights.get("roadmap_context", {})
        current_phase = roadmap_context.get("current_phase", "")
        current_goal = roadmap_context.get("current_goal", "")
        roadmap_progress = roadmap_context.get("progress", "")
        
        confidence = root_cause.get("confidence", 0)
        confidence_level = "HIGH" if confidence >= 0.7 else "MEDIUM" if confidence >= 0.5 else "LOW"
        
        cold_start_note = "\n⚠️ NEW USER: Limited history - predictions based on problem difficulty" if is_cold_start else ""
        
        similar_str = "\n".join([f"   • {m[:100]}..." if len(m) > 100 else f"   • {m}" for m in similar_mistakes[:3]]) if similar_mistakes else "   (No similar mistakes found)"
        focus_str = "\n".join([f"   • {f}" for f in focus_areas[:3]]) if focus_areas else "   (Continue current approach)"
        
        # V2.1: Format emotional state indicators
        emotional_state = ""
        if frustration_index > 0.6:
            emotional_state = """
⚠️ USER FRUSTRATION DETECTED (index: {:.0%})
   - User may be struggling with consecutive failures
   - Consider: Simpler explanation, more encouragement, smaller steps
   - Avoid: Complex terminology, multiple simultaneous corrections""".format(frustration_index)
        elif boredom_index > 0.7:
            emotional_state = """
💤 BOREDOM RISK DETECTED (index: {:.0%})
   - User may need more challenging problems
   - Consider: Advanced techniques, optimization focus
   - Avoid: Basic explanations they likely already know""".format(boredom_index)
        
        # V2.1: Format roadmap context
        roadmap_section = ""
        if current_phase and current_goal:
            roadmap_section = f"""
LEARNING JOURNEY:
   Current Phase: {current_phase}
   Current Goal: {current_goal}
   Progress: {roadmap_progress}"""
        
        # V2.1: Difficulty recommendation
        difficulty_section = ""
        if adjustment_direction and adjustment_reason:
            direction_emoji = "📈" if adjustment_direction == "increase" else "📉" if adjustment_direction == "decrease" else "➡️"
            difficulty_section = f"""
DIFFICULTY RECOMMENDATION:
   {direction_emoji} Adjustment: {adjustment_direction.upper()}
   Reason: {adjustment_reason}"""
        
        return f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🧠 MIM INTELLIGENCE INSIGHTS V2.1 (Confidence: {confidence_level})                     ║
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
{roadmap_section}
{difficulty_section}
{emotional_state}

SIMILAR PAST MISTAKES:
{similar_str}

RECOMMENDED FOCUS AREAS:
{focus_str}

═══════════════════════════════════════════════════════════════════════════════
MIM USAGE INSTRUCTIONS:
- If confidence >= 70%: Structure feedback around predicted root cause
- If confidence 50-70%: Consider MIM prediction as strong hypothesis  
- If confidence < 50%: Use as supplementary signal, investigate independently
- If frustration detected: Be extra encouraging, break down into smaller steps
- If boredom detected: Skip basics, focus on advanced concepts/optimizations
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
        # ✨ FIX: Use getattr to safely check if db exists and is connected
        has_db = getattr(mongo_client, 'db', None) is not None
        if has_db:
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