"""
MIM Decision - Single Authoritative Output
==========================================

v3.0 Architecture: MIM is the BRAIN, agents are the VOICE.

This module defines the MIMDecision schema which contains:
1. All analytical decisions (root cause, patterns, difficulty)
2. Pre-computed instructions for each agent
3. Personalization data from user history

PHILOSOPHY:
- MIM makes ALL analytical decisions using ML + deterministic rules
- Agents receive instructions and add linguistic polish
- No duplicate reasoning between MIM and agents
- Agents CANNOT override MIM decisions (only add rationale)
"""

from typing import Dict, List, Optional, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT INSTRUCTION SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class FeedbackInstruction(BaseModel):
    """
    Pre-computed instruction for feedback_agent.
    
    Agent MUST use these facts, only adding linguistic polish.
    
    v3.3: Added root_cause_subtype for granular diagnosis.
    """
    root_cause: str = Field(
        description="Definitive root cause - agent uses this, does NOT guess"
    )
    # v3.3: MANDATORY subtype for granular diagnosis
    root_cause_subtype: Optional[str] = Field(
        default=None,
        description="Granular subtype (e.g., algorithm_choice->wrong_invariant, brute_force)"
    )
    root_cause_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence in root cause prediction"
    )
    # v3.3: Concrete failure mechanism explanation
    failure_mechanism: Optional[str] = Field(
        default=None,
        description="Concrete explanation of WHY the code fails (e.g., 'sorting breaks reversal equality')"
    )
    is_recurring_mistake: bool = Field(
        default=False,
        description="True if user has made this mistake before"
    )
    recurrence_count: int = Field(
        default=0,
        description="How many times user made this same mistake"
    )
    similar_past_context: Optional[str] = Field(
        default=None,
        description="Context from past similar mistake (for personalization)"
    )
    complexity_verdict: Optional[str] = Field(
        default=None,
        description="Pre-computed complexity analysis (e.g., 'O(n²) when O(n) expected')"
    )
    edge_cases_likely: List[str] = Field(
        default_factory=list,
        description="Pre-computed likely failing edge cases"
    )
    
    # Tone instruction based on user state
    tone: Literal["encouraging", "direct", "firm"] = Field(
        default="encouraging",
        description="Tone to use based on user frustration/plateau state"
    )


class HintInstruction(BaseModel):
    """
    Pre-computed instruction for hint_agent.
    
    Agent compresses this into 20 words, does NOT change direction.
    """
    hint_direction: str = Field(
        description="The specific direction hint should point to"
    )
    avoid_revealing: List[str] = Field(
        default_factory=list,
        description="Concepts to NOT mention (would reveal solution)"
    )
    user_weak_topic_relevance: Optional[str] = Field(
        default=None,
        description="If hint touches user's weak topic, mention this"
    )


class LearningInstruction(BaseModel):
    """
    Pre-computed instruction for learning_agent (rationale-only mode).
    
    MIM provides focus areas, agent adds rationale.
    """
    focus_areas: List[str] = Field(
        description="MIM-computed focus areas (agent explains WHY)"
    )
    skill_gap: str = Field(
        description="The specific skill gap identified"
    )
    connects_to_weak_topic: bool = Field(
        default=False,
        description="True if this mistake relates to user's weak topics"
    )
    weak_topic_name: Optional[str] = Field(
        default=None,
        description="Name of connected weak topic if any"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN RESULT (from Pattern Engine)
# ═══════════════════════════════════════════════════════════════════════════════

class PatternResult(BaseModel):
    """
    Result from deterministic pattern detection.
    
    NO LLM CALL - computed from user history lookup.
    
    Phase 2.2 Additions:
    - pattern_state: Explicit state (NONE/SUSPECTED/CONFIRMED/STABLE)
    - evidence_strength: Weighted evidence metrics
    - confidence_support: How confidence supports the pattern claim
    - Confidence gating: Low confidence cannot form patterns
    """
    pattern_name: Optional[str] = Field(
        default=None,
        description="Detected pattern name (e.g., 'off-by-one error')"
    )
    is_recurring: bool = Field(
        default=False,
        description="True if this exact pattern occurred before"
    )
    recurrence_count: int = Field(
        default=0,
        description="Number of past occurrences"
    )
    last_occurrence: Optional[str] = Field(
        default=None,
        description="When this pattern last occurred"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0, le=1.0,
        description="Confidence in pattern detection"
    )
    detection_method: Literal["ml_model", "history_lookup", "keyword_match", "none"] = Field(
        default="none",
        description="How pattern was detected"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 2.2: Extended Pattern Fields
    # ═══════════════════════════════════════════════════════════════════════════
    
    pattern_state: Literal["none", "suspected", "confirmed", "stable"] = Field(
        default="none",
        description="Explicit pattern state (Phase 2.2)"
    )
    evidence_strength: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Weighted evidence metrics (count, mean_confidence, recency)"
    )
    confidence_support: Optional[str] = Field(
        default=None,
        description="How confidence supports this pattern (all_high, some_high, medium_only)"
    )
    confidence_gated: bool = Field(
        default=False,
        description="True if pattern was blocked due to low confidence"
    )
    
    def is_actionable(self) -> bool:
        """Check if pattern is strong enough for action (CONFIRMED or STABLE)."""
        return self.pattern_state in ("confirmed", "stable")
    
    def is_suspected_only(self) -> bool:
        """Check if pattern is suspected but not confirmed."""
        return self.pattern_state == "suspected"


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY ACTION (from MIM readiness model)
# ═══════════════════════════════════════════════════════════════════════════════

class DifficultyAction(BaseModel):
    """
    MIM-computed difficulty adjustment.
    
    Replaces difficulty_agent entirely - no LLM call needed.
    """
    action: Literal["decrease", "maintain", "increase", "stretch"] = Field(
        description="What to do with difficulty"
    )
    current_level: str = Field(
        description="User's current skill level"
    )
    target_difficulty: Literal["Easy", "Medium", "Hard"] = Field(
        description="Recommended next problem difficulty"
    )
    rationale: str = Field(
        description="Pre-computed rationale (no LLM needed)"
    )
    success_probability: float = Field(
        ge=0.0, le=1.0,
        description="Predicted success rate at target difficulty"
    )
    
    # Risk factors
    plateau_risk: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Risk of learning plateau"
    )
    burnout_risk: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Risk of burnout from too many failures"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN MIM DECISION SCHEMA
# ═══════════════════════════════════════════════════════════════════════════════

class MIMDecision(BaseModel):
    """
    Single authoritative output from MIM.
    
    This is the ONLY decision-making output. Agents receive this
    and add linguistic polish without changing decisions.
    
    v3.2 ENHANCEMENT: Single Immutable Decision per Submission
    - Once decision_id is set, this decision CANNOT be recreated
    - Profile builder uses decision_id to detect duplicate MIM runs
    - Prevents MIM from making different decisions on retries
    
    REPLACES:
    - pattern_detection_agent (pattern field)
    - difficulty_agent (difficulty_action field)
    - Duplicate analysis in feedback_agent, learning_agent
    """
    
    # === v3.2: IMMUTABILITY ENFORCEMENT ===
    decision_id: Optional[str] = Field(
        default=None,
        description="Unique immutable ID - once set, decision cannot be recreated"
    )
    is_frozen: bool = Field(
        default=False,
        description="True after decision is used - prevents mutation"
    )
    
    # === CORE ANALYTICAL DECISIONS ===
    root_cause: str = Field(
        description="Primary root cause of failure"
    )
    root_cause_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence in root cause prediction"
    )
    root_cause_alternatives: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Alternative root causes with confidence scores"
    )
    
    # Pattern detection (replaces pattern_detection_agent)
    pattern: PatternResult = Field(
        description="Detected mistake pattern"
    )
    
    # Difficulty adjustment (replaces difficulty_agent)
    difficulty_action: DifficultyAction = Field(
        description="Difficulty adjustment decision"
    )
    
    # === PERSONALIZATION DATA ===
    user_skill_level: str = Field(
        description="Current estimated skill level"
    )
    learning_velocity: Literal["accelerating", "stable", "decelerating", "stalled"] = Field(
        description="Current learning trajectory"
    )
    user_weak_topics: List[str] = Field(
        default_factory=list,
        description="User's known weak topics"
    )
    
    # === AGENT INSTRUCTIONS ===
    feedback_instruction: FeedbackInstruction = Field(
        description="Pre-computed instruction for feedback_agent"
    )
    hint_instruction: HintInstruction = Field(
        description="Pre-computed instruction for hint_agent"
    )
    learning_instruction: LearningInstruction = Field(
        description="Pre-computed instruction for learning_agent"
    )
    
    # === RECOMMENDED CONTENT ===
    recommended_problems: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Recommended next problems"
    )
    focus_areas: List[str] = Field(
        default_factory=list,
        description="Recommended study focus areas"
    )
    
    # === METADATA ===
    is_cold_start: bool = Field(
        default=False,
        description="True if user has limited history"
    )
    model_version: str = Field(
        default="v3.2",
        description="MIM model version"
    )
    inference_time_ms: float = Field(
        default=0.0,
        description="Total MIM inference time in milliseconds"
    )
    timestamp: datetime = Field(
        default_factory=datetime.now,
        description="When decision was made"
    )
    
    model_config = {"arbitrary_types_allowed": True}
    
    def freeze(self, new_decision_id: str) -> "MIMDecision":
        """
        Freeze this decision with a unique ID.
        Once frozen, the decision should not be recreated.
        
        v3.2: Enforces single immutable MIM decision per submission.
        """
        self.decision_id = new_decision_id
        self.is_frozen = True
        return self
    
    def get_decision_id(self) -> Optional[str]:
        """Get the unique decision ID if frozen."""
        return self.decision_id
    
    def to_agent_context(self) -> str:
        """
        Format decision for inclusion in agent prompts.
        
        Note: Agents receive INSTRUCTIONS, not raw data.
        """
        pattern_info = ""
        if self.pattern.is_recurring:
            pattern_info = f"""
🔄 RECURRING PATTERN ALERT:
   Pattern: {self.pattern.pattern_name}
   Occurrences: {self.pattern.recurrence_count}
   Last seen: {self.pattern.last_occurrence or 'Unknown'}
   ⚠️ User keeps making this mistake - address it directly!
"""
        
        return f"""
═══════════════════════════════════════════════════════════════════════════════
🧠 MIM DECISION ({self.model_version}) - AUTHORITATIVE
═══════════════════════════════════════════════════════════════════════════════

ROOT CAUSE: {self.root_cause}
   Confidence: {self.root_cause_confidence:.0%}
   {f"Alternatives: {', '.join([a['cause'] for a in self.root_cause_alternatives[:2]])}" if self.root_cause_alternatives else ""}
{pattern_info}
USER STATE:
   Skill Level: {self.user_skill_level}
   Learning Velocity: {self.learning_velocity}
   Weak Topics: {', '.join(self.user_weak_topics[:3]) if self.user_weak_topics else 'None identified'}

DIFFICULTY RECOMMENDATION:
   Action: {self.difficulty_action.action.upper()}
   Target: {self.difficulty_action.target_difficulty}
   Success Probability: {self.difficulty_action.success_probability:.0%}
   Rationale: {self.difficulty_action.rationale}

FOCUS AREAS:
{chr(10).join([f'   • {f}' for f in self.focus_areas[:3]]) if self.focus_areas else '   (Continue current approach)'}

═══════════════════════════════════════════════════════════════════════════════
AGENT INSTRUCTIONS (DO NOT OVERRIDE):
═══════════════════════════════════════════════════════════════════════════════

FOR FEEDBACK_AGENT:
   • Use root cause: "{self.root_cause}" - DO NOT guess different cause
   • Tone: {self.feedback_instruction.tone}
   • Is recurring: {self.feedback_instruction.is_recurring_mistake}
   • Edge cases to mention: {', '.join(self.feedback_instruction.edge_cases_likely[:3]) if self.feedback_instruction.edge_cases_likely else 'Analyze from code'}

FOR HINT_AGENT:
   • Point toward: "{self.hint_instruction.hint_direction}"
   • DO NOT mention: {', '.join(self.hint_instruction.avoid_revealing) if self.hint_instruction.avoid_revealing else 'N/A'}

═══════════════════════════════════════════════════════════════════════════════
"""

    def get_feedback_context(self) -> str:
        """Get specific context for feedback_agent."""
        recurring_note = ""
        if self.feedback_instruction.is_recurring_mistake:
            recurring_note = f"""
⚠️ RECURRING MISTAKE ALERT:
This user has made the "{self.root_cause}" mistake {self.feedback_instruction.recurrence_count} times.
Previous context: {self.feedback_instruction.similar_past_context or 'N/A'}
→ Address this pattern directly and help them break the habit.
"""
        
        return f"""
═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR TASK: Explain WHY this submission failed (MIM has identified the cause)
═══════════════════════════════════════════════════════════════════════════════
{recurring_note}
MIM-IDENTIFIED ROOT CAUSE: {self.root_cause}
Confidence: {self.root_cause_confidence:.0%}

REQUIRED TONE: {self.feedback_instruction.tone}
{f"COMPLEXITY ISSUE: {self.feedback_instruction.complexity_verdict}" if self.feedback_instruction.complexity_verdict else ""}
LIKELY EDGE CASES: {', '.join(self.feedback_instruction.edge_cases_likely) if self.feedback_instruction.edge_cases_likely else 'Determine from code analysis'}

USER CONTEXT:
- Skill Level: {self.user_skill_level}
- Weak Topics: {', '.join(self.user_weak_topics[:2]) if self.user_weak_topics else 'None'}

═══════════════════════════════════════════════════════════════════════════════
RULES:
✓ Base your explanation on the MIM root cause (don't contradict)
✓ Add code-specific details that support the root cause
✓ If this is a recurring mistake, address it directly
✗ Do NOT identify a different root cause
✗ Do NOT be generic - reference the actual code
═══════════════════════════════════════════════════════════════════════════════
"""

    def get_hint_context(self) -> str:
        """Get specific context for hint_agent."""
        return f"""
═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR TASK: Compress this into a 20-word actionable hint
═══════════════════════════════════════════════════════════════════════════════

DIRECTION TO POINT TOWARD: {self.hint_instruction.hint_direction}

AVOID MENTIONING (would reveal solution): {', '.join(self.hint_instruction.avoid_revealing) if self.hint_instruction.avoid_revealing else 'N/A'}

{f"USER WEAK TOPIC NOTE: This touches their weak area in {self.hint_instruction.user_weak_topic_relevance}. Be encouraging." if self.hint_instruction.user_weak_topic_relevance else ""}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT: Single sentence, max 20 words, starts with action verb
═══════════════════════════════════════════════════════════════════════════════
"""

    def get_learning_context(self) -> str:
        """Get specific context for learning_agent."""
        return f"""
═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR TASK: Add rationale to these MIM-selected focus areas
═══════════════════════════════════════════════════════════════════════════════

MIM-SELECTED FOCUS AREAS (USE THESE, DO NOT CHANGE):
{chr(10).join([f'• {area}' for area in self.learning_instruction.focus_areas])}

SKILL GAP IDENTIFIED: {self.learning_instruction.skill_gap}

{f"CONNECTION TO WEAK TOPIC: This relates to their weakness in {self.learning_instruction.weak_topic_name}" if self.learning_instruction.connects_to_weak_topic else ""}

═══════════════════════════════════════════════════════════════════════════════
YOUR OUTPUT:
- Use the focus areas EXACTLY as provided
- Add 1-2 sentences explaining WHY these areas matter for this mistake
- Connect to user's learning history if relevant
═══════════════════════════════════════════════════════════════════════════════
"""
