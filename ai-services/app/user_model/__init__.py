"""
User Model Module
=================

Tracks user state and updates strength signals.

CRITICAL:
- state_tracker: Handles FAILED submission transitions
- strength_updater: Handles ACCEPTED submission reinforcement
- These are SEPARATE and must not contaminate each other
"""

from .state_tracker import (
    UserStateTracker,
    update_failure_state,
)
from .strength_updater import (
    StrengthUpdater,
    update_strength_signals,
)

__all__ = [
    "UserStateTracker",
    "update_failure_state",
    "StrengthUpdater",
    "update_strength_signals",
]
