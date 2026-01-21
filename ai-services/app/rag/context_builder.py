from typing import List, Optional, Dict, Any
import logging
from app.schemas.submission import SubmissionContext

logger = logging.getLogger("context_builder")


def format_memory_chunks(chunks: Optional[List[str]]) -> str:
    if not chunks:
        return "No relevant past mistakes found."

    formatted = []
    for i, chunk in enumerate(chunks, start=1):
        formatted.append(f"{i}. {chunk}")

    return "\n".join(formatted)


def format_problem_section(problem_context: Optional[Dict[str, Any]]) -> str:
    """
    Format structured problem context into prompt section.
    """
    if not problem_context:
        return "Problem details not available."
    
    sections = []
    
    # Problem identity
    title = problem_context.get("title") or problem_context.get("problem_id", "Unknown")
    sections.append(f"Title: {title}")
    
    # Difficulty
    difficulty = problem_context.get("difficulty", "Unknown")
    sections.append(f"Difficulty: {difficulty}")
    
    # Tags/Categories
    tags = problem_context.get("tags", [])
    if tags:
        sections.append(f"Topics: {', '.join(tags)}")
    
    # Expected approach (CRITICAL for feedback quality)
    expected_approach = problem_context.get("expected_approach")
    if expected_approach:
        sections.append(f"Expected Approach: {expected_approach}")
    
    # Constraints
    constraints = problem_context.get("constraints", "")
    if constraints:
        sections.append(f"Constraints: {constraints}")
    
    # Common mistakes for this problem type
    common_mistakes = problem_context.get("common_mistakes", [])
    if common_mistakes:
        mistakes_str = ", ".join(common_mistakes[:3])  # Limit to 3
        sections.append(f"Common Mistakes: {mistakes_str}")
    
    return "\n".join(f"- {s}" for s in sections)


def format_user_profile_section(user_profile: Optional[Dict[str, Any]]) -> str:
    """
    Format structured user profile into prompt section.
    """
    if not user_profile:
        return "No user history available."
    
    sections = []
    
    # Common mistakes (CRITICAL for personalized feedback)
    common_mistakes = user_profile.get("common_mistakes", [])
    if common_mistakes:
        sections.append(f"Recurring Mistakes: {', '.join(common_mistakes)}")
    
    # Weak topics
    weak_topics = user_profile.get("weak_topics", [])
    if weak_topics:
        sections.append(f"Weak Topics: {', '.join(weak_topics)}")
    
    # Recurring patterns
    recurring_patterns = user_profile.get("recurring_patterns", [])
    if recurring_patterns:
        sections.append(f"Behavioral Patterns: {', '.join(recurring_patterns)}")
    
    # Statistics
    total_submissions = user_profile.get("total_submissions")
    success_rate = user_profile.get("success_rate")
    if total_submissions is not None:
        stats = f"Submissions: {total_submissions}"
        if success_rate is not None:
            stats += f", Success Rate: {success_rate:.1%}"
        sections.append(stats)
    
    # Last verdict
    last_verdict = user_profile.get("last_verdict")
    if last_verdict:
        sections.append(f"Current Verdict: {last_verdict}")
    
    if not sections:
        return "New user - no historical data."
    
    return "\n".join(f"- {s}" for s in sections)


def build_context(
    submission: SubmissionContext,
    user_memory: Optional[List[str]] = None,
    problem_knowledge: Optional[List[str]] = None,
    problem_context: Optional[Dict[str, Any]] = None,
    user_profile: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds a controlled, LLM-safe context block for AI reasoning.
    
    UPGRADED: Now includes structured problem and user profile sections.
    
    Context Structure:
    1. PROBLEM DEFINITION - What the problem is, expected approach
    2. USER PROFILE - User's weaknesses, patterns (from RAG)
    3. CURRENT SUBMISSION - Code, verdict, error
    4. ANALYSIS RULES - Instructions for the agent
    """
    logger.debug("📄 build_context called")
    logger.debug(f"   └─ user_memory chunks: {len(user_memory) if user_memory else 0}")
    logger.debug(f"   └─ problem_context: {'present' if problem_context else 'absent'}")
    logger.debug(f"   └─ user_profile: {'present' if user_profile else 'absent'}")

    # Format structured sections
    problem_section = format_problem_section(problem_context)
    user_profile_section = format_user_profile_section(user_profile)
    memory_block = format_memory_chunks(user_memory)
    knowledge_block = format_memory_chunks(problem_knowledge)

    # Build context with clear sections
    context = f"""
================================================================================
SECTION 1: PROBLEM DEFINITION
================================================================================
{problem_section}

================================================================================
SECTION 2: USER PROFILE (Historical Analysis)
================================================================================
{user_profile_section}

Past Mistakes (RAG Retrieved):
{memory_block}

================================================================================
SECTION 3: CURRENT SUBMISSION
================================================================================
- Language: {submission.language}
- Verdict: {submission.verdict}
- Error Type: {submission.error_type or "N/A"}

================================================================================
SECTION 4: ANALYSIS RULES (FOLLOW STRICTLY)
================================================================================
1. Reference the EXPECTED APPROACH when analyzing the code
2. Check if user is repeating their RECURRING MISTAKES
3. Consider the problem's COMMON MISTAKES for this category
4. Explain WHY the submission failed (not just what failed)
5. Give ONE actionable hint without revealing the full solution
6. If user has weak topics matching this problem, acknowledge it
7. Be precise, analytical, and encouraging
================================================================================
"""

    logger.info(f"✅ Context built: {len(context)} chars (structured format)")
    return context.strip()
