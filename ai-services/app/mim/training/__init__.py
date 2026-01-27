"""
MIM Training Module
===================

Training data builders and model trainers for the new MIM architecture.

CRITICAL DESIGN:
- Two SEPARATE pipelines: failure transitions vs reinforcement
- Delta-based features
- Per-user time-ordered splits
- No accepted → failure contamination
"""

from .dataset_builder import (
    DatasetBuilder,
    build_failure_transitions_dataset,
    build_reinforcement_events_dataset,
)
from .train_root_cause_model import train_root_cause_model
from .train_subtype_model import train_subtype_model
from .validate_taxonomy import validate_taxonomy_coverage

__all__ = [
    "DatasetBuilder",
    "build_failure_transitions_dataset",
    "build_reinforcement_events_dataset",
    "train_root_cause_model",
    "train_subtype_model",
    "validate_taxonomy_coverage",
]
