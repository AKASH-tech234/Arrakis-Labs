from typing import List, Optional
from app.schemas.submission import SubmissionContext


def format_memory_chunks(chunks: Optional[List[str]]) -> str:
    if not chunks:
        return "No relevant past mistakes found."

    formatted = []
    for i, chunk in enumerate(chunks, start=1):
        formatted.append(f"{i}. {chunk}")

    return "\n".join(formatted)


def build_context(
    submission: SubmissionContext,
    user_memory: Optional[List[str]] = None,
    problem_knowledge: Optional[List[str]] = None,
) -> str:
    """
    Builds a controlled, LLM-safe context block for AI reasoning.

    This context is intentionally structured and concise.
    """

    memory_block = format_memory_chunks(user_memory)
    knowledge_block = format_memory_chunks(problem_knowledge)

    context = f"""
USER LEARNING PROFILE
- User ID: {submission.user_id}
- Common weaknesses: {submission.user_history_summary or "Not enough data yet"}

PROBLEM CONTEXT
- Problem ID: {submission.problem_id}
- Category: {submission.problem_category}
- Constraints: {submission.constraints}

SUBMISSION RESULT
- Verdict: {submission.verdict}
- Error Type: {submission.error_type or "Unknown"}
- Language: {submission.language}

RELEVANT PAST MISTAKES (USER-SPECIFIC)
{memory_block}

PROBLEM-SPECIFIC INSIGHTS
{knowledge_block}

INSTRUCTIONS FOR ANALYSIS
- Explain why the submission failed
- Reference patterns only if relevant
- Do NOT provide a full solution
- Give exactly ONE actionable improvement hint
- Be calm, precise, and analytical
"""

    return context.strip()
