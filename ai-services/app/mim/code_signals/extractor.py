"""
Code Signal Extractor (Main Entry Point)
========================================

Combines AST analysis and pattern detection into unified code signals
for MIM feature enhancement.

Usage:
    extractor = CodeSignalExtractor()
    signals = extractor.extract(code, verdict="wrong_answer")
    
    # Get feature vector for ML
    features = signals.to_vector()
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional

from .ast_analyzer import ASTAnalyzer, ASTFeatures
from .pattern_detector import PatternDetector, DetectedPatterns

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# COMBINED CODE SIGNALS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CodeStructureSignals:
    """
    Complete code structure signals for MIM.
    
    Combines:
    - AST-based structural features
    - Pattern-based risk detection
    - Verdict-aware adjustments
    """
    
    # Component signals
    ast_features: ASTFeatures
    detected_patterns: DetectedPatterns
    
    # Execution context
    verdict: str = ""
    
    # Derived signals (computed from components + verdict)
    likely_root_cause: Optional[str] = None
    confidence: float = 0.0
    
    # Risk scores (0-1, adjusted by verdict)
    boundary_risk: float = 0.0
    efficiency_risk: float = 0.0
    implementation_risk: float = 0.0
    understanding_risk: float = 0.0
    
    def to_vector(self) -> List[float]:
        """
        Convert to feature vector for ML model.
        
        Returns vector of ~30 features.
        """
        vector = []
        
        # AST features (19 features)
        vector.extend(self.ast_features.to_vector())
        
        # Pattern features (10 features)
        vector.extend(self.detected_patterns.to_vector())
        
        # Derived risk scores (4 features)
        vector.extend([
            self.boundary_risk,
            self.efficiency_risk,
            self.implementation_risk,
            self.understanding_risk,
        ])
        
        return vector
    
    @staticmethod
    def feature_names() -> List[str]:
        """Get all feature names."""
        names = []
        names.extend(ASTFeatures.feature_names())
        names.extend(DetectedPatterns.feature_names())
        names.extend([
            "code_boundary_risk",
            "code_efficiency_risk",
            "code_implementation_risk",
            "code_understanding_risk",
        ])
        return names
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "ast_features": self.ast_features.to_dict(),
            "detected_patterns": self.detected_patterns.to_dict(),
            "verdict": self.verdict,
            "likely_root_cause": self.likely_root_cause,
            "confidence": self.confidence,
            "risk_scores": {
                "boundary": self.boundary_risk,
                "efficiency": self.efficiency_risk,
                "implementation": self.implementation_risk,
                "understanding": self.understanding_risk,
            },
        }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXTRACTOR
# ═══════════════════════════════════════════════════════════════════════════════

class CodeSignalExtractor:
    """
    Main code signal extractor.
    
    Combines AST analysis and pattern detection with verdict-aware
    risk scoring for MIM feature enhancement.
    """
    
    # Verdict to risk category mapping
    VERDICT_RISK_MAP = {
        "wrong_answer": "correctness",
        "time_limit_exceeded": "efficiency",
        "memory_limit_exceeded": "efficiency",
        "runtime_error": "implementation",
        "compile_error": "implementation",
    }
    
    def __init__(self):
        self.ast_analyzer = ASTAnalyzer()
        self.pattern_detector = PatternDetector()
    
    def extract(
        self,
        code: str,
        verdict: str = "",
        problem_tags: Optional[List[str]] = None,
        constraints: Optional[Dict[str, Any]] = None,
    ) -> CodeStructureSignals:
        """
        Extract code signals for MIM.
        
        Parameters
        ----------
        code : str
            Source code to analyze
        verdict : str
            Execution verdict (wrong_answer, time_limit_exceeded, etc.)
        problem_tags : List[str], optional
            Problem tags for context
        constraints : Dict[str, Any], optional
            Problem constraints for context
            
        Returns
        -------
        CodeStructureSignals
            Complete code signals for MIM
        """
        if not code or not code.strip():
            return CodeStructureSignals(
                ast_features=ASTFeatures(),
                detected_patterns=DetectedPatterns(),
                verdict=verdict,
            )
        
        # Run AST analysis
        ast_features = self.ast_analyzer.analyze(code)
        
        # Run pattern detection
        detected_patterns = self.pattern_detector.detect(code)
        
        # Create combined signals
        signals = CodeStructureSignals(
            ast_features=ast_features,
            detected_patterns=detected_patterns,
            verdict=verdict.lower() if verdict else "",
        )
        
        # Compute verdict-aware risk scores
        self._compute_risk_scores(signals, problem_tags, constraints)
        
        # Infer likely root cause
        self._infer_root_cause(signals)
        
        return signals
    
    def _compute_risk_scores(
        self,
        signals: CodeStructureSignals,
        problem_tags: Optional[List[str]],
        constraints: Optional[Dict[str, Any]],
    ) -> None:
        """Compute verdict-aware risk scores."""
        
        verdict = signals.verdict
        ast = signals.ast_features
        patterns = signals.detected_patterns
        
        # Base risks from pattern detection
        signals.boundary_risk = patterns.correctness_risk
        signals.efficiency_risk = patterns.efficiency_risk
        signals.implementation_risk = patterns.implementation_risk
        
        # Adjust based on AST features
        if ast.off_by_one_risk_score > 0:
            signals.boundary_risk = max(
                signals.boundary_risk,
                ast.off_by_one_risk_score
            )
        
        if ast.has_nested_loops:
            signals.efficiency_risk += 0.2
        
        if ast.has_recursion and not ast.recursion_depth_bounded:
            signals.implementation_risk += 0.2
        
        # Verdict-based adjustments (amplify relevant risks)
        if verdict == "wrong_answer":
            signals.boundary_risk *= 1.3
            signals.boundary_risk = min(1.0, signals.boundary_risk)
        elif verdict == "time_limit_exceeded":
            signals.efficiency_risk *= 1.5
            signals.efficiency_risk = min(1.0, signals.efficiency_risk)
        elif verdict == "runtime_error":
            signals.implementation_risk *= 1.3
            signals.boundary_risk *= 1.2  # Often boundary issues
            signals.implementation_risk = min(1.0, signals.implementation_risk)
            signals.boundary_risk = min(1.0, signals.boundary_risk)
        
        # Context adjustments (if available)
        if constraints:
            n_constraint = constraints.get("n", 0)
            if n_constraint >= 100000:
                # Large N: efficiency matters more
                if ast.has_nested_loops:
                    signals.efficiency_risk = min(1.0, signals.efficiency_risk + 0.3)
        
        # Understanding risk (harder to detect from code)
        # Usually low unless we see clear signs
        signals.understanding_risk = 0.1  # Base risk
        
        if problem_tags:
            # If code doesn't seem to match expected patterns
            expected_patterns = self._get_expected_patterns(problem_tags)
            if expected_patterns:
                matches = self._check_pattern_presence(
                    signals.ast_features, expected_patterns
                )
                if not matches:
                    signals.understanding_risk += 0.3
    
    def _get_expected_patterns(self, tags: List[str]) -> List[str]:
        """Get expected code patterns based on problem tags."""
        patterns = []
        
        tag_patterns = {
            "binary_search": ["binary_search"],
            "two_pointers": ["two_pointers"],
            "dynamic_programming": ["memo", "dp", "recursion"],
            "recursion": ["recursion"],
            "bfs": ["queue"],
            "dfs": ["recursion", "stack"],
            "sorting": ["sort"],
        }
        
        for tag in tags:
            tag_lower = tag.lower().replace(" ", "_")
            if tag_lower in tag_patterns:
                patterns.extend(tag_patterns[tag_lower])
        
        return patterns
    
    def _check_pattern_presence(
        self,
        ast: ASTFeatures,
        expected: List[str],
    ) -> bool:
        """Check if expected patterns are present in code."""
        for pattern in expected:
            if pattern == "recursion" and ast.has_recursion:
                return True
            if pattern == "memo" and ast.has_recursion:
                # Would need deeper check for actual memoization
                return True
            if pattern == "binary_search":
                # Check for binary search structure
                if ast.has_while_loop and ast.max_loop_depth >= 1:
                    return True
        
        return len(expected) == 0
    
    def _infer_root_cause(self, signals: CodeStructureSignals) -> None:
        """Infer likely root cause from signals."""
        
        risks = {
            "correctness": signals.boundary_risk,
            "efficiency": signals.efficiency_risk,
            "implementation": signals.implementation_risk,
            "understanding_gap": signals.understanding_risk,
        }
        
        # Find highest risk
        max_risk = max(risks.values())
        
        if max_risk < 0.2:
            signals.likely_root_cause = None
            signals.confidence = 0.0
            return
        
        # Get root cause with highest risk
        likely = max(risks, key=risks.get)
        
        # Verdict can override if strong signal
        verdict = signals.verdict
        if verdict:
            verdict_root = self.VERDICT_RISK_MAP.get(verdict)
            if verdict_root and risks.get(verdict_root, 0) > max_risk * 0.7:
                likely = verdict_root
        
        signals.likely_root_cause = likely
        signals.confidence = min(0.9, max_risk)  # Cap at 0.9 (never fully certain)


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

# Module-level extractor instance
_extractor = None


def extract_code_signals(
    code: str,
    verdict: str = "",
    problem_tags: Optional[List[str]] = None,
    constraints: Optional[Dict[str, Any]] = None,
) -> CodeStructureSignals:
    """
    Convenience function to extract code signals.
    
    Uses a cached extractor instance.
    """
    global _extractor
    if _extractor is None:
        _extractor = CodeSignalExtractor()
    
    return _extractor.extract(
        code=code,
        verdict=verdict,
        problem_tags=problem_tags,
        constraints=constraints,
    )
