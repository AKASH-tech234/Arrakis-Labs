"""
MIM Features Module
===================

Delta-based behavioral feature extraction.

This module exports:
- compute_delta_features(): Extract deltas from submission history
- build_user_state_snapshot(): Build pre-inference user state
- extract_code_signals(): Extract signals for failure mechanism derivation
"""

from .delta_features import (
    compute_delta_features,
    DeltaFeatures,
)
from .state_snapshot import (
    build_user_state_snapshot,
    UserStateSnapshot,
)
from .signal_extractor import (
    extract_code_signals,
    CodeSignals,
)

__all__ = [
    "compute_delta_features",
    "DeltaFeatures",
    "build_user_state_snapshot",
    "UserStateSnapshot",
    "extract_code_signals",
    "CodeSignals",
]
