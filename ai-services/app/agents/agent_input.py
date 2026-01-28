"""
Unified Agent Input Schema (Architecture Upgrade)
=================================================

Provides a single, structured input for all LLM agents.

Design Principles:
- Agents receive FACTS from MIM, not raw data to interpret
- Confidence tier controls explanation certainty
- Pattern state controls recurrence language
- Difficulty action is explained, not suggested
- RAG context is optional and quality-gated

This schema enforces the separation of concerns:
- MIM DECIDES (root cause, pattern state, difficulty)
- AGENTS EXPLAIN (polish, tone, language only)
- AGENTS NEVER OVERRIDE MIM DECISIONS
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE METADATA (from Phase 2.1)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AgentConfidenceInfo:
    """
    Confidence information for agents to control explanation certainty.
    
    Rules for agents:
    - HIGH: Use direct language ("This is...", "The error is...")
    - MEDIUM: Use moderate hedging ("This appears to be...", "Likely...")
    - LOW: Use strong hedging ("This may be...", "Possibly...", "Consider...")
    """
    confidence_level: Literal["high", "medium", "low"]
    combined_confidence: float
    conservative_mode: bool
    calibration_applied: bool
    
    def get_certainty_prefix(self) -> str:
        """Get appropriate language prefix based on confidence."""
        if self.confidence_level == "high":
            return ""  # Direct language
        elif self.confidence_level == "medium":
            return "This appears to be "
        else:
            return "This may be "
    
    def should_hedge(self) -> bool:
        """Whether agent should use hedging language."""
        return self.confidence_level != "high"


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN STATE INFO (from Phase 2.2)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AgentPatternInfo:
    """
    Pattern state information for agents to control recurrence language.
    
    Rules for agents:
    - NONE: Do not mention recurrence
    - SUSPECTED: "This may be a recurring pattern..."
    - CONFIRMED: "This is a confirmed recurring pattern..."
    - STABLE: "This is a long-standing pattern you've worked on..."
    """
    pattern_state: Literal["none", "suspected", "confirmed", "stable"]
    pattern_name: Optional[str]
    recurrence_count: int
    evidence_strength: Optional[Dict[str, Any]]
    confidence_gated: bool  # True if pattern was blocked due to low confidence
    
    def get_recurrence_phrase(self) -> Optional[str]:
        """Get appropriate recurrence phrase based on state."""
        if self.pattern_state == "none" or self.confidence_gated:
            return None
        elif self.pattern_state == "suspected":
            return f"This may be a recurring pattern ({self.pattern_name})"
        elif self.pattern_state == "confirmed":
            return f"This is a confirmed recurring pattern ({self.pattern_name}, seen {self.recurrence_count} times)"
        elif self.pattern_state == "stable":
            return f"This is a long-standing pattern you've encountered ({self.pattern_name})"
        return None
    
    def is_actionable(self) -> bool:
        """Whether pattern is strong enough to mention prominently."""
        return self.pattern_state in ("confirmed", "stable")


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY ACTION INFO (from Phase 2.3)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AgentDifficultyInfo:
    """
    Difficulty decision information for agents.
    
    CRITICAL: Agents EXPLAIN the decision, they do NOT suggest changes.
    
    Rules for agents:
    - If action is "maintain" due to gate: Explain why (e.g., "staying at current level to build confidence")
    - If action is "increase": Explain readiness
    - If action is "decrease": Explain supportively (not punitively)
    - NEVER suggest a different difficulty than MIM decided
    """
    current_difficulty: str
    action: Literal["increase", "decrease", "maintain"]
    next_difficulty: str
    confidence: float
    reason: str
    blocking_gate: Optional[str]  # Which gate blocked if any
    
    def get_explanation(self) -> str:
        """Get user-friendly explanation of difficulty decision."""
        if self.action == "maintain":
            if self.blocking_gate == "confidence_gate":
                return "We're keeping you at the current difficulty level while building more confidence in the diagnosis."
            elif self.blocking_gate == "pattern_state_gate":
                return "We're staying at the current level to help you work through this pattern first."
            elif self.blocking_gate == "hysteresis_gate":
                return "We're staying at the current level to ensure consistent progress before moving up."
            elif self.blocking_gate == "cooldown_gate":
                return "We're staying at the current level to give you time to adapt to recent changes."
            else:
                return "We're keeping you at the current difficulty level."
        elif self.action == "increase":
            return f"Based on your progress, you're ready to move up to {self.next_difficulty} problems."
        else:  # decrease
            return f"We're adjusting to {self.next_difficulty} problems to help build a stronger foundation."
    
    def was_gated(self) -> bool:
        """Whether the action was blocked by a safety gate."""
        return self.blocking_gate is not None


# ═══════════════════════════════════════════════════════════════════════════════
# RAG CONTEXT INFO (from Phase 3.1)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AgentRAGContext:
    """
    RAG memory context for agents.
    
    CRITICAL: RAG context is OPTIONAL. Agents must handle empty context gracefully.
    
    Rules for agents:
    - If has_context is False: Do not reference past mistakes
    - If has_context is True: Can reference, but do not fabricate
    - Never assume memories exist
    """
    has_context: bool
    memories: List[str]
    avg_relevance: float
    query_used: str
    
    def get_memory_reference(self) -> Optional[str]:
        """Get a safe reference to past context if available."""
        if not self.has_context or not self.memories:
            return None
        return f"Based on your history, you've encountered similar issues before."
    
    @classmethod
    def empty(cls) -> "AgentRAGContext":
        """Create empty context (RAG was skipped or no results)."""
        return cls(
            has_context=False,
            memories=[],
            avg_relevance=0.0,
            query_used="",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# MIM DIAGNOSIS INFO
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AgentDiagnosisInfo:
    """
    MIM diagnosis information (root cause, subtype, failure mechanism).
    
    These are FACTS that agents must use exactly as provided.
    Agents may explain or elaborate, but NEVER contradict.
    """
    root_cause: str
    subtype: str
    failure_mechanism: str
    category: str
    difficulty: str
    is_efficiency_issue: bool
    
    def get_user_friendly_root_cause(self) -> str:
        """Get user-friendly description of root cause."""
        descriptions = {
            "correctness": "a correctness issue",
            "efficiency": "an efficiency/performance issue",
            "implementation": "an implementation issue",
            "understanding_gap": "a problem understanding issue",
        }
        return descriptions.get(self.root_cause, f"a {self.root_cause} issue")
    
    def get_user_friendly_subtype(self) -> str:
        """Get user-friendly description of subtype."""
        return self.subtype.replace("_", " ")


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED AGENT INPUT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AgentInput:
    """
    Unified input for all LLM agents.
    
    This is the SINGLE SOURCE OF TRUTH for what agents receive.
    All MIM decisions are pre-computed and packaged here.
    
    Agents:
    - MUST use diagnosis info exactly as provided
    - MUST respect confidence tier for language certainty
    - MUST respect pattern state for recurrence language
    - MUST explain (not contradict) difficulty decisions
    - MUST handle missing RAG context gracefully
    - MUST NOT infer, guess, or override any MIM decisions
    """
    
    # User/submission context
    user_id: str
    problem_id: str
    submission_id: str
    
    # MIM diagnosis (FACTS - do not contradict)
    diagnosis: AgentDiagnosisInfo
    
    # Confidence (controls language certainty)
    confidence: AgentConfidenceInfo
    
    # Pattern state (controls recurrence language)
    pattern: AgentPatternInfo
    
    # Difficulty decision (explain, don't suggest)
    difficulty: Optional[AgentDifficultyInfo] = None
    
    # RAG context (optional, may be empty)
    rag_context: AgentRAGContext = field(default_factory=AgentRAGContext.empty)
    
    # Code context
    code_snippet: str = ""
    problem_description: str = ""
    
    # Feedback type routing
    feedback_type: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for logging/debugging."""
        return {
            "user_id": self.user_id,
            "problem_id": self.problem_id,
            "submission_id": self.submission_id,
            "diagnosis": {
                "root_cause": self.diagnosis.root_cause,
                "subtype": self.diagnosis.subtype,
                "failure_mechanism": self.diagnosis.failure_mechanism,
            },
            "confidence": {
                "level": self.confidence.confidence_level,
                "value": self.confidence.combined_confidence,
                "conservative_mode": self.confidence.conservative_mode,
            },
            "pattern": {
                "state": self.pattern.pattern_state,
                "name": self.pattern.pattern_name,
                "count": self.pattern.recurrence_count,
            },
            "difficulty": {
                "action": self.difficulty.action if self.difficulty else None,
                "next": self.difficulty.next_difficulty if self.difficulty else None,
                "gated_by": self.difficulty.blocking_gate if self.difficulty else None,
            },
            "rag_context": {
                "has_context": self.rag_context.has_context,
                "num_memories": len(self.rag_context.memories),
            },
            "feedback_type": self.feedback_type,
        }
    
    def log(self) -> None:
        """Log agent input for debugging."""
        print("\n" + "=" * 70)
        print("📝 AGENT INPUT")
        print("=" * 70)
        print(f"  user_id:        {self.user_id}")
        print(f"  problem_id:     {self.problem_id}")
        print(f"  feedback_type:  {self.feedback_type}")
        print(f"  DIAGNOSIS:")
        print(f"    └─ root_cause:        {self.diagnosis.root_cause}")
        print(f"    └─ subtype:           {self.diagnosis.subtype}")
        print(f"    └─ failure_mechanism: {self.diagnosis.failure_mechanism}")
        print(f"  CONFIDENCE:")
        print(f"    └─ level:             {self.confidence.confidence_level}")
        print(f"    └─ should_hedge:      {self.confidence.should_hedge()}")
        print(f"  PATTERN:")
        print(f"    └─ state:             {self.pattern.pattern_state}")
        print(f"    └─ is_actionable:     {self.pattern.is_actionable()}")
        if self.difficulty:
            print(f"  DIFFICULTY:")
            print(f"    └─ action:            {self.difficulty.action}")
            print(f"    └─ gated_by:          {self.difficulty.blocking_gate}")
        print(f"  RAG:")
        print(f"    └─ has_context:       {self.rag_context.has_context}")
        print(f"    └─ num_memories:      {len(self.rag_context.memories)}")
        print("=" * 70 + "\n")


# ═══════════════════════════════════════════════════════════════════════════════
# BUILDER (from MIM output)
# ═══════════════════════════════════════════════════════════════════════════════

def build_agent_input(
    mim_output: Any,  # MIMOutput
    pattern_result: Any = None,  # PatternResult
    difficulty_result: Any = None,  # DifficultyAdjustment
    rag_memories: Optional[List[str]] = None,
    rag_relevance: float = 0.0,
    rag_query: str = "",
    code_snippet: str = "",
    problem_description: str = "",
) -> AgentInput:
    """
    Build AgentInput from MIM outputs.
    
    This is the single point where MIM decisions are packaged for agents.
    """
    
    # Extract diagnosis info
    cf = mim_output.correctness_feedback
    pf = mim_output.performance_feedback
    
    if cf:
        diagnosis = AgentDiagnosisInfo(
            root_cause=cf.root_cause,
            subtype=cf.subtype,
            failure_mechanism=cf.failure_mechanism,
            category=cf.category,
            difficulty=cf.difficulty,
            is_efficiency_issue=False,
        )
    elif pf:
        diagnosis = AgentDiagnosisInfo(
            root_cause="efficiency",
            subtype=pf.subtype,
            failure_mechanism=pf.failure_mechanism,
            category=pf.category,
            difficulty=pf.difficulty,
            is_efficiency_issue=True,
        )
    else:
        # Reinforcement feedback - minimal diagnosis
        diagnosis = AgentDiagnosisInfo(
            root_cause="success",
            subtype="accepted",
            failure_mechanism="none",
            category="",
            difficulty="",
            is_efficiency_issue=False,
        )
    
    # Extract confidence info
    cm = mim_output.confidence_metadata
    if cm:
        confidence = AgentConfidenceInfo(
            confidence_level=cm.confidence_level,
            combined_confidence=cm.combined_confidence,
            conservative_mode=cm.conservative_mode,
            calibration_applied=cm.calibration_applied,
        )
    else:
        # Default to medium confidence
        confidence = AgentConfidenceInfo(
            confidence_level="medium",
            combined_confidence=0.70,
            conservative_mode=False,
            calibration_applied=False,
        )
    
    # Extract pattern info
    if pattern_result:
        pattern = AgentPatternInfo(
            pattern_state=pattern_result.pattern_state,
            pattern_name=pattern_result.pattern_name,
            recurrence_count=pattern_result.recurrence_count,
            evidence_strength=pattern_result.evidence_strength,
            confidence_gated=pattern_result.confidence_gated,
        )
    else:
        pattern = AgentPatternInfo(
            pattern_state="none",
            pattern_name=None,
            recurrence_count=0,
            evidence_strength=None,
            confidence_gated=False,
        )
    
    # Extract difficulty info
    if difficulty_result:
        difficulty = AgentDifficultyInfo(
            current_difficulty=difficulty_result.to_dict().get("current_difficulty", "Medium"),
            action=difficulty_result.adjustment,
            next_difficulty=difficulty_result.next_difficulty,
            confidence=difficulty_result.confidence,
            reason=difficulty_result.reason,
            blocking_gate=difficulty_result.blocking_gate,
        )
    else:
        difficulty = None
    
    # Build RAG context
    if rag_memories and len(rag_memories) > 0:
        rag_context = AgentRAGContext(
            has_context=True,
            memories=rag_memories,
            avg_relevance=rag_relevance,
            query_used=rag_query,
        )
    else:
        rag_context = AgentRAGContext.empty()
    
    return AgentInput(
        user_id=mim_output.user_id,
        problem_id=mim_output.problem_id,
        submission_id=mim_output.submission_id,
        diagnosis=diagnosis,
        confidence=confidence,
        pattern=pattern,
        difficulty=difficulty,
        rag_context=rag_context,
        code_snippet=code_snippet,
        problem_description=problem_description,
        feedback_type=mim_output.feedback_type,
    )
