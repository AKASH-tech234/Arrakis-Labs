"""
MIM Code Signals Module (Phase 1.1)
===================================

Deterministic code signal extraction for MIM feature enhancement.

This module provides:
- AST-based code structure analysis
- Pattern detection for common failure modes
- Semantic signals that bridge code to diagnosis

CRITICAL DESIGN PRINCIPLES:
- ALL signals are deterministic (no ML, no LLM)
- Signals are appended as new feature group to MIM
- No taxonomy change required
- Graceful fallback to regex if AST parsing fails

Signals extracted:
- Loop nesting depth
- Mutable state across iterations
- Boundary access patterns
- Recursion depth indicators
- Array index arithmetic
- Early exits / break patterns
"""

from .extractor import (
    CodeSignalExtractor,
    CodeStructureSignals,
    extract_code_signals,
)

from .ast_analyzer import (
    ASTAnalyzer,
    ASTFeatures,
)

from .pattern_detector import (
    PatternDetector,
    DetectedPatterns,
)

__all__ = [
    "CodeSignalExtractor",
    "CodeStructureSignals", 
    "extract_code_signals",
    "ASTAnalyzer",
    "ASTFeatures",
    "PatternDetector",
    "DetectedPatterns",
]
