"""
Pattern State Machine (Phase 2.2)
=================================

Defines explicit pattern states and confidence-aware transitions.

State Machine:
    NONE → SUSPECTED → CONFIRMED → STABLE
                ↓           ↓
            (decay)     (decay)
                ↓           ↓
              NONE       SUSPECTED

Design Principles:
- Confidence gates control state transitions (not just counts)
- No pattern formed from low-confidence predictions
- Medium-confidence patterns stay as SUSPECTED
- Only HIGH-confidence repeated diagnoses → CONFIRMED
- Temporal decay can demote pattern states
- All transitions are deterministic and testable

Integration:
- PatternEngine consumes confidence_metadata from MIM
- Pattern states are stored per-user per-pattern-type
- States affect difficulty adjustments and feedback tone
"""

from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import math


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN STATES
# ═══════════════════════════════════════════════════════════════════════════════

class PatternState(str, Enum):
    """
    Explicit pattern states (Phase 2.2).
    
    Replaces binary is_recurring logic with graduated states.
    """
    NONE = "none"           # No pattern detected
    SUSPECTED = "suspected" # Pattern emerging, needs confirmation
    CONFIRMED = "confirmed" # Pattern verified with high confidence
    STABLE = "stable"       # Long-standing confirmed pattern
    
    def __str__(self) -> str:
        return self.value


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE TIERS (from Phase 2.1)
# ═══════════════════════════════════════════════════════════════════════════════

class ConfidenceTier(str, Enum):
    """Confidence tiers aligned with Phase 2.1 calibration."""
    HIGH = "high"       # >= 0.80: Trust fully, allow confirmations
    MEDIUM = "medium"   # >= 0.65: Trust with caution, suspected only
    LOW = "low"         # < 0.65: Conservative mode, no pattern claims
    
    @classmethod
    def from_confidence(cls, confidence: float) -> "ConfidenceTier":
        """Convert confidence score to tier."""
        if confidence >= 0.80:
            return cls.HIGH
        elif confidence >= 0.65:
            return cls.MEDIUM
        else:
            return cls.LOW


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN EVIDENCE
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PatternEvidence:
    """
    Evidence for a pattern occurrence.
    
    Used to compute weighted pattern strength with temporal decay.
    """
    timestamp: datetime
    confidence: float
    confidence_tier: ConfidenceTier
    root_cause: str
    subtype: Optional[str] = None
    problem_id: Optional[str] = None
    
    def get_age_days(self, now: Optional[datetime] = None) -> float:
        """Get age of evidence in days."""
        if now is None:
            now = datetime.now(timezone.utc)
        return (now - self.timestamp).total_seconds() / 86400.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "confidence": self.confidence,
            "confidence_tier": str(self.confidence_tier),
            "root_cause": self.root_cause,
            "subtype": self.subtype,
            "problem_id": self.problem_id,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN STATE TRACKER
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PatternStateRecord:
    """
    Tracks state of a specific pattern for a user.
    
    This is the core data structure for Phase 2.2 pattern tracking.
    """
    pattern_name: str
    state: PatternState = PatternState.NONE
    evidence: List[PatternEvidence] = field(default_factory=list)
    
    # Computed metrics
    evidence_count: int = 0
    weighted_evidence: float = 0.0
    mean_confidence: float = 0.0
    recency_score: float = 0.0
    
    # State metadata
    state_entered_at: Optional[datetime] = None
    last_occurrence: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    
    # Transition history (for debugging/audit)
    transition_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pattern_name": self.pattern_name,
            "state": str(self.state),
            "evidence_count": self.evidence_count,
            "weighted_evidence": round(self.weighted_evidence, 3),
            "mean_confidence": round(self.mean_confidence, 3),
            "recency_score": round(self.recency_score, 3),
            "state_entered_at": self.state_entered_at.isoformat() if self.state_entered_at else None,
            "last_occurrence": self.last_occurrence.isoformat() if self.last_occurrence else None,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "transition_count": self.transition_count,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# STATE TRANSITION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class PatternStateTransitionEngine:
    """
    Manages pattern state transitions with confidence gating.
    
    Phase 2.2 Core Logic:
    - LOW confidence → Never forms patterns
    - MEDIUM confidence → Can create/maintain SUSPECTED only
    - HIGH confidence → Can promote to CONFIRMED/STABLE
    - Temporal decay can demote states
    """
    
    # Transition thresholds
    SUSPECTED_THRESHOLD = 1.0      # Weighted evidence to reach SUSPECTED
    CONFIRMED_THRESHOLD = 2.5     # Weighted evidence to reach CONFIRMED
    STABLE_THRESHOLD = 4.0        # Weighted evidence to reach STABLE
    
    # Temporal decay
    DECAY_HALF_LIFE_DAYS = 14.0   # Evidence half-weight after 14 days
    RECENCY_BOOST_WINDOW = 3.0    # Days for recency boost
    RECENCY_BOOST_FACTOR = 1.3    # Boost multiplier for recent evidence
    
    # Decay thresholds for demotion
    DECAY_TO_SUSPECTED = 1.5      # Below this, CONFIRMED → SUSPECTED
    DECAY_TO_NONE = 0.5           # Below this, SUSPECTED → NONE
    
    # Inactivity periods for demotion
    INACTIVITY_DAYS_TO_DEMOTE = 30  # Days without new evidence to consider demotion
    
    def __init__(self):
        self.now = datetime.now(timezone.utc)
    
    def update_now(self, now: Optional[datetime] = None):
        """Update current time reference."""
        self.now = now or datetime.now(timezone.utc)
    
    def add_evidence(
        self,
        record: PatternStateRecord,
        confidence: float,
        root_cause: str,
        subtype: Optional[str] = None,
        problem_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> PatternStateRecord:
        """
        Add new evidence and potentially transition state.
        
        CRITICAL: Confidence gating enforced here.
        
        Parameters
        ----------
        record : PatternStateRecord
            Current pattern state record
        confidence : float
            CALIBRATED confidence from MIM (Phase 2.1)
        root_cause : str
            Root cause from MIM diagnosis
        subtype : str, optional
            Subtype from MIM diagnosis
        problem_id : str, optional
            Problem identifier
        timestamp : datetime, optional
            Evidence timestamp (defaults to now)
            
        Returns
        -------
        PatternStateRecord
            Updated record (may have new state)
        """
        if timestamp is None:
            timestamp = self.now
        
        # Determine confidence tier
        tier = ConfidenceTier.from_confidence(confidence)
        
        # ─────────────────────────────────────────────────────────────────────
        # CONFIDENCE GATE (Phase 2.2 Critical Rule)
        # ─────────────────────────────────────────────────────────────────────
        if tier == ConfidenceTier.LOW:
            # LOW confidence → Do NOT add evidence, do NOT form patterns
            # This is a hard gate - no exceptions
            return record
        
        # Create evidence record
        evidence = PatternEvidence(
            timestamp=timestamp,
            confidence=confidence,
            confidence_tier=tier,
            root_cause=root_cause,
            subtype=subtype,
            problem_id=problem_id,
        )
        
        # Add to evidence list
        record.evidence.append(evidence)
        record.last_occurrence = timestamp
        
        # Recompute metrics with temporal decay
        self._recompute_metrics(record)
        
        # Determine state transition
        new_state = self._compute_state_transition(record, tier)
        
        if new_state != record.state:
            record.state = new_state
            record.state_entered_at = self.now
            record.transition_count += 1
            
            if new_state == PatternState.CONFIRMED:
                record.confirmed_at = self.now
        
        return record
    
    def apply_decay(self, record: PatternStateRecord) -> PatternStateRecord:
        """
        Apply temporal decay and potentially demote state.
        
        Called periodically or before pattern queries.
        """
        self._recompute_metrics(record)
        
        # Check for demotion based on decayed evidence
        if record.state == PatternState.STABLE:
            if record.weighted_evidence < self.CONFIRMED_THRESHOLD:
                record.state = PatternState.CONFIRMED
                record.state_entered_at = self.now
                record.transition_count += 1
        
        if record.state == PatternState.CONFIRMED:
            if record.weighted_evidence < self.DECAY_TO_SUSPECTED:
                record.state = PatternState.SUSPECTED
                record.state_entered_at = self.now
                record.transition_count += 1
        
        if record.state == PatternState.SUSPECTED:
            if record.weighted_evidence < self.DECAY_TO_NONE:
                record.state = PatternState.NONE
                record.state_entered_at = self.now
                record.transition_count += 1
        
        # Check for inactivity-based demotion
        if record.last_occurrence:
            days_since_last = (self.now - record.last_occurrence).total_seconds() / 86400.0
            if days_since_last > self.INACTIVITY_DAYS_TO_DEMOTE:
                if record.state in (PatternState.CONFIRMED, PatternState.STABLE):
                    record.state = PatternState.SUSPECTED
                    record.state_entered_at = self.now
                    record.transition_count += 1
        
        return record
    
    def _recompute_metrics(self, record: PatternStateRecord):
        """Recompute pattern metrics with temporal decay."""
        if not record.evidence:
            record.evidence_count = 0
            record.weighted_evidence = 0.0
            record.mean_confidence = 0.0
            record.recency_score = 0.0
            return
        
        record.evidence_count = len(record.evidence)
        
        # Compute weighted evidence with decay
        total_weight = 0.0
        total_confidence = 0.0
        recency_sum = 0.0
        
        for ev in record.evidence:
            weight = self._compute_decay_weight(ev.timestamp)
            total_weight += weight
            total_confidence += ev.confidence * weight
            
            # Recency score (higher for recent evidence)
            age_days = ev.get_age_days(self.now)
            if age_days <= self.RECENCY_BOOST_WINDOW:
                recency_sum += 1.0
            elif age_days <= 7:
                recency_sum += 0.5
            elif age_days <= 14:
                recency_sum += 0.25
        
        record.weighted_evidence = total_weight
        record.mean_confidence = total_confidence / total_weight if total_weight > 0 else 0.0
        record.recency_score = recency_sum / max(1, len(record.evidence))
    
    def _compute_decay_weight(self, timestamp: datetime) -> float:
        """Compute temporal decay weight for evidence."""
        age_days = (self.now - timestamp).total_seconds() / 86400.0
        
        if age_days < 0:
            age_days = 0
        
        # Exponential decay
        weight = math.pow(2, -age_days / self.DECAY_HALF_LIFE_DAYS)
        
        # Recency boost
        if age_days <= self.RECENCY_BOOST_WINDOW:
            weight = min(1.0, weight * self.RECENCY_BOOST_FACTOR)
        
        return weight
    
    def _compute_state_transition(
        self,
        record: PatternStateRecord,
        new_evidence_tier: ConfidenceTier,
    ) -> PatternState:
        """
        Compute new state based on evidence and confidence tier.
        
        CRITICAL RULES:
        - MEDIUM confidence can only reach SUSPECTED (never CONFIRMED)
        - HIGH confidence required for CONFIRMED/STABLE
        """
        weighted = record.weighted_evidence
        current = record.state
        
        # Count high-confidence evidence
        high_conf_count = sum(
            1 for ev in record.evidence
            if ev.confidence_tier == ConfidenceTier.HIGH
            and ev.get_age_days(self.now) <= 30  # Recent high-conf only
        )
        
        # ─────────────────────────────────────────────────────────────────────
        # MEDIUM CONFIDENCE GATE
        # ─────────────────────────────────────────────────────────────────────
        # Medium confidence can only reach SUSPECTED, never higher
        if new_evidence_tier == ConfidenceTier.MEDIUM:
            if current == PatternState.NONE and weighted >= self.SUSPECTED_THRESHOLD:
                return PatternState.SUSPECTED
            # Cannot promote beyond SUSPECTED with medium confidence
            return current
        
        # ─────────────────────────────────────────────────────────────────────
        # HIGH CONFIDENCE TRANSITIONS
        # ─────────────────────────────────────────────────────────────────────
        
        # NONE → SUSPECTED
        if current == PatternState.NONE:
            if weighted >= self.SUSPECTED_THRESHOLD:
                return PatternState.SUSPECTED
            return PatternState.NONE
        
        # SUSPECTED → CONFIRMED (requires high confidence)
        if current == PatternState.SUSPECTED:
            if weighted >= self.CONFIRMED_THRESHOLD and high_conf_count >= 2:
                return PatternState.CONFIRMED
            return PatternState.SUSPECTED
        
        # CONFIRMED → STABLE
        if current == PatternState.CONFIRMED:
            if weighted >= self.STABLE_THRESHOLD and high_conf_count >= 3:
                return PatternState.STABLE
            return PatternState.CONFIRMED
        
        # STABLE stays STABLE (unless decayed)
        return current
    
    def get_pattern_strength(self, record: PatternStateRecord) -> Dict[str, Any]:
        """
        Get pattern strength metrics for output.
        
        Used to populate extended PatternResult fields.
        """
        return {
            "state": str(record.state),
            "evidence_count": record.evidence_count,
            "weighted_evidence": round(record.weighted_evidence, 3),
            "mean_confidence": round(record.mean_confidence, 3),
            "recency_score": round(record.recency_score, 3),
            "is_actionable": record.state in (PatternState.CONFIRMED, PatternState.STABLE),
            "is_suspected": record.state == PatternState.SUSPECTED,
            "confidence_support": self._get_confidence_support(record),
        }
    
    def _get_confidence_support(self, record: PatternStateRecord) -> str:
        """Get description of confidence support for pattern."""
        if not record.evidence:
            return "no_evidence"
        
        high_count = sum(1 for ev in record.evidence if ev.confidence_tier == ConfidenceTier.HIGH)
        med_count = sum(1 for ev in record.evidence if ev.confidence_tier == ConfidenceTier.MEDIUM)
        
        total = len(record.evidence)
        
        if high_count == total:
            return "all_high_confidence"
        elif high_count > total / 2:
            return "majority_high_confidence"
        elif high_count > 0:
            return "some_high_confidence"
        elif med_count > 0:
            return "medium_confidence_only"
        else:
            return "low_confidence_only"


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def should_form_pattern(confidence: float) -> bool:
    """
    Quick check if confidence allows pattern formation.
    
    Phase 2.2 Gate: Low confidence predictions cannot form patterns.
    """
    return ConfidenceTier.from_confidence(confidence) != ConfidenceTier.LOW


def can_confirm_pattern(confidence: float) -> bool:
    """
    Check if confidence allows pattern confirmation.
    
    Only HIGH confidence can confirm patterns.
    """
    return ConfidenceTier.from_confidence(confidence) == ConfidenceTier.HIGH


def get_confidence_tier(confidence: float) -> str:
    """Get confidence tier as string."""
    return str(ConfidenceTier.from_confidence(confidence))
