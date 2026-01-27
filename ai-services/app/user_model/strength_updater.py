"""
Strength Updater
================

Updates user strength signals from ACCEPTED submissions.

CRITICAL:
- Only processes ACCEPTED submissions
- Never updates failure state (that's state_tracker's job)
- Updates strong_categories, strong_techniques, readiness
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import Counter, defaultdict

logger = logging.getLogger(__name__)


class StrengthUpdater:
    """
    Updates user strength signals from accepted submissions.
    
    CRITICAL:
    - Only processes ACCEPTED submissions
    - Does NOT update failure patterns
    """
    
    def __init__(self, vector_store=None):
        """
        Initialize updater.
        
        Parameters
        ----------
        vector_store : optional
            Vector store for persisting user state
        """
        self.vector_store = vector_store
        self._cache: Dict[str, Dict] = {}
    
    def get_strengths(self, user_id: str) -> Dict[str, Any]:
        """
        Get current strength signals for user.
        """
        
        if user_id in self._cache:
            return self._cache[user_id]
        
        if self.vector_store:
            stored = self.vector_store.get_user_strengths(user_id)
            if stored:
                self._cache[user_id] = stored
                return stored
        
        return self._empty_strengths(user_id)
    
    def update_on_success(
        self,
        user_id: str,
        submission: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Update strength signals after an ACCEPTED submission.
        
        Parameters
        ----------
        user_id : str
            User identifier
        submission : dict
            Accepted submission with:
            - category: str
            - difficulty: str
            - technique: str (optional)
            - time_to_solve: float (optional)
            - timestamp: str
            
        Returns
        -------
        Dict
            Updated strength signals
            
        CRITICAL:
        - This method only processes ACCEPTED submissions
        - Failed submissions must use UserStateTracker instead
        """
        
        verdict = submission.get("verdict", "accepted").lower()
        if verdict not in ("accepted", "ac"):
            raise ValueError(
                "StrengthUpdater.update_on_success() received a non-ACCEPTED submission. "
                "Use UserStateTracker.update_on_failure() instead."
            )
        
        logger.info(f"Updating strength signals for user {user_id}")
        
        # Get current strengths
        current = self._get_raw_strengths(user_id)
        
        # Extract submission info
        category = submission.get("category", "unknown").lower()
        difficulty = submission.get("difficulty", "medium").lower()
        technique = submission.get("technique", "general")
        time_to_solve = submission.get("time_to_solve", submission.get("timeToSolve", 0))
        timestamp = submission.get("timestamp", datetime.utcnow().isoformat())
        
        # Update success history
        if "success_history" not in current:
            current["success_history"] = []
        
        current["success_history"].append({
            "category": category,
            "difficulty": difficulty,
            "technique": technique,
            "time_to_solve": time_to_solve,
            "timestamp": timestamp,
        })
        
        # Keep last 100 successes
        current["success_history"] = current["success_history"][-100:]
        
        # Update category strength
        current = self._update_category_strength(current, category, difficulty)
        
        # Update technique strength
        current = self._update_technique_strength(current, technique)
        
        # Update readiness estimate
        current = self._update_readiness(current)
        
        # Update timestamp
        current["last_updated"] = datetime.utcnow().isoformat()
        current["total_accepted"] = len(current["success_history"])
        
        # Cache and persist
        self._cache[user_id] = current
        
        if self.vector_store:
            self.vector_store.update_user_strengths(user_id, current)
        
        return current
    
    def get_readiness(self, user_id: str, category: str = None) -> Dict[str, float]:
        """
        Get readiness estimates for user.
        
        Parameters
        ----------
        user_id : str
            User identifier
        category : str, optional
            Specific category to check
            
        Returns
        -------
        Dict
            Readiness estimates by difficulty
        """
        
        strengths = self.get_strengths(user_id)
        
        if category:
            cat_strengths = strengths.get("category_strengths", {}).get(category.lower(), {})
            return {
                "easy_readiness": cat_strengths.get("easy_success_rate", 0.5),
                "medium_readiness": cat_strengths.get("medium_success_rate", 0.3),
                "hard_readiness": cat_strengths.get("hard_success_rate", 0.1),
            }
        
        return strengths.get("overall_readiness", {
            "easy_readiness": 0.7,
            "medium_readiness": 0.5,
            "hard_readiness": 0.3,
        })
    
    def _get_raw_strengths(self, user_id: str) -> Dict[str, Any]:
        """Get raw strengths dict (for modification)."""
        
        if user_id in self._cache:
            return self._cache[user_id].copy()
        
        if self.vector_store:
            stored = self.vector_store.get_user_strengths(user_id)
            if stored:
                return stored.copy()
        
        return self._empty_strengths(user_id)
    
    def _empty_strengths(self, user_id: str) -> Dict[str, Any]:
        """Create empty strengths dict."""
        return {
            "user_id": user_id,
            "strong_categories": [],
            "strong_techniques": [],
            "category_strengths": {},
            "technique_counts": {},
            "overall_readiness": {
                "easy_readiness": 0.5,
                "medium_readiness": 0.3,
                "hard_readiness": 0.1,
            },
            "success_history": [],
            "total_accepted": 0,
            "last_updated": datetime.utcnow().isoformat(),
        }
    
    def _update_category_strength(
        self,
        strengths: Dict,
        category: str,
        difficulty: str,
    ) -> Dict:
        """Update strength for a category."""
        
        if "category_strengths" not in strengths:
            strengths["category_strengths"] = {}
        
        if category not in strengths["category_strengths"]:
            strengths["category_strengths"][category] = {
                "total_attempts": 0,
                "total_success": 0,
                "easy_attempts": 0,
                "easy_success": 0,
                "medium_attempts": 0,
                "medium_success": 0,
                "hard_attempts": 0,
                "hard_success": 0,
            }
        
        cat_stats = strengths["category_strengths"][category]
        cat_stats["total_attempts"] += 1
        cat_stats["total_success"] += 1
        
        diff_key = f"{difficulty}_attempts"
        success_key = f"{difficulty}_success"
        
        if diff_key in cat_stats:
            cat_stats[diff_key] += 1
            cat_stats[success_key] += 1
        
        # Compute success rates
        for diff in ["easy", "medium", "hard"]:
            attempts = cat_stats.get(f"{diff}_attempts", 0)
            success = cat_stats.get(f"{diff}_success", 0)
            if attempts > 0:
                cat_stats[f"{diff}_success_rate"] = success / attempts
            else:
                cat_stats[f"{diff}_success_rate"] = 0.0
        
        # Update strong_categories
        strong_cats = []
        for cat, stats in strengths["category_strengths"].items():
            if stats["total_attempts"] >= 3:
                success_rate = stats["total_success"] / stats["total_attempts"]
                if success_rate >= 0.7:
                    strong_cats.append(cat)
        
        strengths["strong_categories"] = strong_cats
        
        return strengths
    
    def _update_technique_strength(
        self,
        strengths: Dict,
        technique: str,
    ) -> Dict:
        """Update strength for a technique."""
        
        if "technique_counts" not in strengths:
            strengths["technique_counts"] = {}
        
        strengths["technique_counts"][technique] = \
            strengths["technique_counts"].get(technique, 0) + 1
        
        # Update strong_techniques (used at least 2 times successfully)
        strengths["strong_techniques"] = [
            tech for tech, count in strengths["technique_counts"].items()
            if count >= 2 and tech != "general"
        ]
        
        return strengths
    
    def _update_readiness(self, strengths: Dict) -> Dict:
        """Update overall readiness estimates."""
        
        history = strengths.get("success_history", [])
        
        if not history:
            return strengths
        
        # Count successes by difficulty
        diff_counts = Counter(h["difficulty"] for h in history)
        total = len(history)
        
        # Compute readiness based on recent history
        recent_30 = history[-30:]
        recent_diff_counts = Counter(h["difficulty"] for h in recent_30)
        recent_total = len(recent_30)
        
        if recent_total > 0:
            easy_rate = recent_diff_counts.get("easy", 0) / recent_total
            medium_rate = recent_diff_counts.get("medium", 0) / recent_total
            hard_rate = recent_diff_counts.get("hard", 0) / recent_total
            
            # Readiness is a smoothed estimate
            strengths["overall_readiness"] = {
                "easy_readiness": min(0.95, 0.5 + easy_rate * 0.5),
                "medium_readiness": min(0.85, 0.3 + medium_rate * 0.5 + easy_rate * 0.2),
                "hard_readiness": min(0.75, 0.1 + hard_rate * 0.5 + medium_rate * 0.2),
            }
        
        return strengths


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def update_strength_signals(
    user_id: str,
    submission: Dict[str, Any],
    vector_store=None,
) -> Dict[str, Any]:
    """
    Convenience function to update user strengths after success.
    
    Parameters
    ----------
    user_id : str
        User identifier
    submission : dict
        Accepted submission
    vector_store : optional
        Vector store for persistence
        
    Returns
    -------
    Dict
        Updated strengths
    """
    updater = StrengthUpdater(vector_store)
    return updater.update_on_success(user_id, submission)
