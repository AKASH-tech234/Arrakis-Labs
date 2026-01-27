"""
User State Tracker
==================

Tracks user state transitions from FAILED submissions.

CRITICAL:
- Only processes FAILED submissions
- Never updates strength signals (that's strength_updater's job)
- Maintains failure history for delta features
- Updates dominant_failure_modes, stagnant_areas, etc.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import Counter, defaultdict

from app.mim.features.state_snapshot import UserStateSnapshot, build_user_state_snapshot
from app.mim.taxonomy.subtypes import SUBTYPES

logger = logging.getLogger(__name__)


class UserStateTracker:
    """
    Tracks user state transitions from failure patterns.
    
    CRITICAL:
    - Only processes FAILED submissions
    - Does NOT update strength signals
    """
    
    def __init__(self, vector_store=None):
        """
        Initialize tracker.
        
        Parameters
        ----------
        vector_store : optional
            Vector store for persisting user state
        """
        self.vector_store = vector_store
        self._cache: Dict[str, Dict] = {}  # In-memory cache
    
    def get_state(self, user_id: str) -> UserStateSnapshot:
        """
        Get current user state.
        
        Returns cached state or builds from history.
        """
        
        if user_id in self._cache:
            cached = self._cache[user_id]
            return UserStateSnapshot(**cached)
        
        # Try loading from vector store
        if self.vector_store:
            stored = self.vector_store.get_user_state(user_id)
            if stored:
                self._cache[user_id] = stored
                return UserStateSnapshot(**stored)
        
        # Return empty state for new users
        return UserStateSnapshot.empty(user_id)
    
    def update_on_failure(
        self,
        user_id: str,
        submission: Dict[str, Any],
    ) -> UserStateSnapshot:
        """
        Update user state after a FAILED submission.
        
        Parameters
        ----------
        user_id : str
            User identifier
        submission : dict
            Failed submission with:
            - root_cause: str
            - subtype: str
            - category: str
            - timestamp: str
            
        Returns
        -------
        UserStateSnapshot
            Updated user state
            
        CRITICAL:
        - This method only processes FAILED submissions
        - Accepted submissions must use strength_updater instead
        """
        
        verdict = submission.get("verdict", "").lower()
        if verdict in ("accepted", "ac"):
            raise ValueError(
                "UserStateTracker.update_on_failure() received an ACCEPTED submission. "
                "Use StrengthUpdater.update_on_success() instead."
            )
        
        logger.info(f"Updating failure state for user {user_id}")
        
        # Get current state
        current_state = self._get_raw_state(user_id)
        
        # Extract submission info
        root_cause = submission.get("root_cause", "correctness")
        subtype = submission.get("subtype", "wrong_invariant")
        category = submission.get("category", "unknown").lower()
        timestamp = submission.get("timestamp", datetime.utcnow().isoformat())
        
        # Update failure history
        if "failure_history" not in current_state:
            current_state["failure_history"] = []
        
        current_state["failure_history"].append({
            "root_cause": root_cause,
            "subtype": subtype,
            "category": category,
            "timestamp": timestamp,
        })
        
        # Keep last 100 failures
        current_state["failure_history"] = current_state["failure_history"][-100:]
        
        # Recompute derived fields
        current_state = self._recompute_state(user_id, current_state)
        
        # Cache and persist
        self._cache[user_id] = current_state
        
        if self.vector_store:
            self.vector_store.update_user_state(user_id, current_state)
        
        return UserStateSnapshot(**current_state)
    
    def record_mistake_episode(
        self,
        user_id: str,
        problem_id: str,
        root_cause: str,
        subtype: str,
        delta_features: Dict[str, float],
        timestamp: str,
    ) -> None:
        """
        Record a mistake episode to vector store for similarity retrieval.
        
        Parameters
        ----------
        user_id : str
            User identifier
        problem_id : str
            Problem identifier  
        root_cause : str
            Predicted root cause
        subtype : str
            Predicted subtype
        delta_features : dict
            Delta feature vector
        timestamp : str
            Episode timestamp
        """
        
        if self.vector_store:
            self.vector_store.record_mistake_episode(
                user_id=user_id,
                problem_id=problem_id,
                root_cause=root_cause,
                subtype=subtype,
                delta_features=delta_features,
                timestamp=timestamp,
            )
    
    def _get_raw_state(self, user_id: str) -> Dict[str, Any]:
        """Get raw state dict (for modification)."""
        
        if user_id in self._cache:
            return self._cache[user_id].copy()
        
        if self.vector_store:
            stored = self.vector_store.get_user_state(user_id)
            if stored:
                return stored.copy()
        
        return self._empty_state(user_id)
    
    def _empty_state(self, user_id: str) -> Dict[str, Any]:
        """Create empty state dict."""
        return {
            "user_id": user_id,
            "dominant_failure_modes": [],
            "dominant_root_causes": [],
            "improving_areas": [],
            "stagnant_areas": [],
            "regressing_areas": [],
            "strong_categories": [],
            "strong_techniques": [],
            "recent_transitions": {
                "brute_force_to_optimized": False,
                "optimized_to_brute_force": False,
                "new_category_attempted": False,
            },
            "total_failed": 0,
            "total_accepted": 0,
            "history_span_days": 0,
            "failure_history": [],
            "snapshot_timestamp": datetime.utcnow().isoformat(),
        }
    
    def _recompute_state(
        self, 
        user_id: str, 
        state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Recompute derived fields from history."""
        
        history = state.get("failure_history", [])
        
        if not history:
            return state
        
        # Dominant failure modes (top 3 subtypes)
        subtype_counts = Counter(h["subtype"] for h in history if h.get("subtype"))
        state["dominant_failure_modes"] = [s for s, _ in subtype_counts.most_common(3)]
        
        # Dominant root causes (top 2)
        rc_counts = Counter(h["root_cause"] for h in history if h.get("root_cause"))
        state["dominant_root_causes"] = [r for r, _ in rc_counts.most_common(2)]
        
        # Trajectory analysis (improving/stagnant/regressing)
        state = self._compute_trajectory(state)
        
        # Recent transitions
        state["recent_transitions"] = self._detect_transitions(history)
        
        # Counts
        state["total_failed"] = len(history)
        state["snapshot_timestamp"] = datetime.utcnow().isoformat()
        
        return state
    
    def _compute_trajectory(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Compute category trajectories."""
        
        history = state.get("failure_history", [])
        
        if len(history) < 6:
            return state
        
        # Split into early and recent
        mid = len(history) // 2
        early = history[:mid]
        recent = history[mid:]
        
        # Failure rate per category
        def category_failure_rate(submissions: List[Dict]) -> Dict[str, float]:
            counts = Counter(s.get("category", "unknown") for s in submissions)
            total = len(submissions)
            return {cat: count / total for cat, count in counts.items()}
        
        early_rates = category_failure_rate(early)
        recent_rates = category_failure_rate(recent)
        
        improving = []
        stagnant = []
        regressing = []
        
        all_cats = set(early_rates.keys()) | set(recent_rates.keys())
        
        for cat in all_cats:
            early_rate = early_rates.get(cat, 0)
            recent_rate = recent_rates.get(cat, 0)
            
            diff = recent_rate - early_rate
            
            if diff < -0.1:  # Failure rate decreased
                improving.append(cat)
            elif diff > 0.1:  # Failure rate increased  
                regressing.append(cat)
            else:
                stagnant.append(cat)
        
        state["improving_areas"] = improving
        state["stagnant_areas"] = stagnant
        state["regressing_areas"] = regressing
        
        return state
    
    def _detect_transitions(self, history: List[Dict]) -> Dict[str, bool]:
        """Detect recent behavioral transitions."""
        
        transitions = {
            "brute_force_to_optimized": False,
            "optimized_to_brute_force": False,
            "new_category_attempted": False,
            "subtype_repeat_broken": False,
        }
        
        if len(history) < 3:
            return transitions
        
        recent_5 = history[-5:] if len(history) >= 5 else history
        
        # Check for new category
        all_categories = set(h.get("category") for h in history[:-1])
        latest_cat = history[-1].get("category")
        
        if latest_cat and latest_cat not in all_categories:
            transitions["new_category_attempted"] = True
        
        # Check for subtype pattern break
        recent_subtypes = [h.get("subtype") for h in recent_5 if h.get("subtype")]
        if len(recent_subtypes) >= 3:
            mode = Counter(recent_subtypes[:-1]).most_common(1)
            if mode and recent_subtypes[-1] != mode[0][0]:
                transitions["subtype_repeat_broken"] = True
        
        return transitions


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def update_failure_state(
    user_id: str,
    submission: Dict[str, Any],
    vector_store=None,
) -> UserStateSnapshot:
    """
    Convenience function to update user state after failure.
    
    Parameters
    ----------
    user_id : str
        User identifier
    submission : dict
        Failed submission
    vector_store : optional
        Vector store for persistence
        
    Returns
    -------
    UserStateSnapshot
        Updated state
    """
    tracker = UserStateTracker(vector_store)
    return tracker.update_on_failure(user_id, submission)
