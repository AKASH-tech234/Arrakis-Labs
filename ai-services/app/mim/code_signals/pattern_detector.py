"""
Pattern Detector for Code Signals
=================================

Detects common failure-prone patterns in code.

Patterns detected:
- Off-by-one indicators
- Boundary condition risks
- Integer overflow risks
- Uninitialized state risks
- Inefficiency patterns

All detection is DETERMINISTIC - no ML, no randomness.
"""

import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PatternMatch:
    """A detected pattern match."""
    pattern_type: str
    description: str
    line_hint: Optional[int] = None  # Approximate line number
    confidence: float = 1.0  # How confident in detection
    risk_level: str = "medium"  # low, medium, high


@dataclass
class DetectedPatterns:
    """
    All patterns detected in code.
    
    Used to bridge code structure to root cause diagnosis.
    """
    # Boundary/indexing issues
    off_by_one_indicators: List[PatternMatch] = field(default_factory=list)
    boundary_risks: List[PatternMatch] = field(default_factory=list)
    
    # Overflow risks
    overflow_risks: List[PatternMatch] = field(default_factory=list)
    
    # State management issues
    uninitialized_risks: List[PatternMatch] = field(default_factory=list)
    state_mutation_risks: List[PatternMatch] = field(default_factory=list)
    
    # Efficiency issues
    inefficiency_patterns: List[PatternMatch] = field(default_factory=list)
    
    # Algorithm-specific
    recursion_risks: List[PatternMatch] = field(default_factory=list)
    
    # Summary scores (0-1)
    correctness_risk: float = 0.0
    efficiency_risk: float = 0.0
    implementation_risk: float = 0.0
    
    def to_vector(self) -> List[float]:
        """Convert to feature vector."""
        return [
            float(len(self.off_by_one_indicators)),
            float(len(self.boundary_risks)),
            float(len(self.overflow_risks)),
            float(len(self.uninitialized_risks)),
            float(len(self.state_mutation_risks)),
            float(len(self.inefficiency_patterns)),
            float(len(self.recursion_risks)),
            self.correctness_risk,
            self.efficiency_risk,
            self.implementation_risk,
        ]
    
    @staticmethod
    def feature_names() -> List[str]:
        """Get feature names."""
        return [
            "pattern_off_by_one_count",
            "pattern_boundary_risk_count",
            "pattern_overflow_risk_count",
            "pattern_uninitialized_count",
            "pattern_state_mutation_count",
            "pattern_inefficiency_count",
            "pattern_recursion_risk_count",
            "pattern_correctness_risk",
            "pattern_efficiency_risk",
            "pattern_implementation_risk",
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "off_by_one_indicators": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.off_by_one_indicators
            ],
            "boundary_risks": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.boundary_risks
            ],
            "overflow_risks": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.overflow_risks
            ],
            "uninitialized_risks": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.uninitialized_risks
            ],
            "state_mutation_risks": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.state_mutation_risks
            ],
            "inefficiency_patterns": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.inefficiency_patterns
            ],
            "recursion_risks": [
                {"type": p.pattern_type, "desc": p.description, "risk": p.risk_level}
                for p in self.recursion_risks
            ],
            "risk_scores": {
                "correctness": self.correctness_risk,
                "efficiency": self.efficiency_risk,
                "implementation": self.implementation_risk,
            },
        }
    
    @property
    def total_risks(self) -> int:
        """Total number of detected risk patterns."""
        return (
            len(self.off_by_one_indicators) +
            len(self.boundary_risks) +
            len(self.overflow_risks) +
            len(self.uninitialized_risks) +
            len(self.state_mutation_risks) +
            len(self.inefficiency_patterns) +
            len(self.recursion_risks)
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PATTERN DETECTOR
# ═══════════════════════════════════════════════════════════════════════════════

class PatternDetector:
    """
    Detects failure-prone patterns in code.
    
    All detection is rule-based and deterministic.
    """
    
    # ─────────────────────────────────────────────────────────────────────────
    # OFF-BY-ONE PATTERNS
    # ─────────────────────────────────────────────────────────────────────────
    
    OFF_BY_ONE_PATTERNS = [
        # Loop bound issues
        (r"for\s*\([^;]*;\s*\w+\s*<=\s*\w+\.length", "loop_bound_inclusive", 
         "Loop uses <= with .length (should be <)", "high"),
        (r"for\s*\([^;]*;\s*\w+\s*<=\s*len\(\w+\)", "loop_bound_inclusive_py",
         "Loop uses <= with len() (should be <)", "high"),
        (r"for\s*\([^;]*;\s*\w+\s*<\s*\w+\s*-\s*1", "loop_bound_minus_one",
         "Loop stops at n-1 (might miss last element)", "medium"),
        
        # Index access patterns
        (r"\[\s*\w+\s*\+\s*1\s*\]", "index_plus_one",
         "Index arithmetic +1 (potential overflow)", "medium"),
        (r"\[\s*\w+\s*-\s*1\s*\]", "index_minus_one",
         "Index arithmetic -1 (potential underflow)", "medium"),
        
        # String/array slicing
        (r"\[\s*:\s*-1\s*\]", "slice_minus_one",
         "Slice to -1 (excludes last element)", "low"),
    ]
    
    # ─────────────────────────────────────────────────────────────────────────
    # BOUNDARY PATTERNS
    # ─────────────────────────────────────────────────────────────────────────
    
    BOUNDARY_PATTERNS = [
        # Missing empty checks
        (r"(\w+)\[0\](?!.*if\s+\1)", "no_empty_check",
         "Access [0] without empty check", "high"),
        (r"(\w+)\[-1\](?!.*if\s+\1)", "no_empty_check_last",
         "Access [-1] without empty check", "high"),
        
        # Division without zero check
        (r"/\s*\w+(?!.*if.*==\s*0)", "division_no_zero_check",
         "Division without zero check nearby", "medium"),
        (r"%\s*\w+(?!.*if.*==\s*0)", "modulo_no_zero_check",
         "Modulo without zero check nearby", "medium"),
    ]
    
    # ─────────────────────────────────────────────────────────────────────────
    # OVERFLOW PATTERNS
    # ─────────────────────────────────────────────────────────────────────────
    
    OVERFLOW_PATTERNS = [
        # Large multiplications
        (r"\*\s*\w+\s*\*", "double_multiplication",
         "Multiple multiplications (overflow risk)", "medium"),
        (r"(\w+)\s*\*\s*\1", "self_multiplication",
         "Variable multiplied by itself (overflow risk)", "medium"),
        
        # Power operations
        (r"\*\*\s*\d+", "power_operation",
         "Power operation (potential overflow)", "medium"),
        (r"pow\s*\(", "pow_function",
         "pow() call (potential overflow)", "low"),
        
        # Sum accumulation in loops
        (r"(sum|total|result)\s*\+=", "accumulator_overflow",
         "Accumulator in loop (overflow risk for large n)", "low"),
    ]
    
    # ─────────────────────────────────────────────────────────────────────────
    # STATE MANAGEMENT PATTERNS
    # ─────────────────────────────────────────────────────────────────────────
    
    STATE_PATTERNS = [
        # Uninitialized risks
        (r"(\w+)\s*=[^=].*\n.*\1\s*\+", "potentially_uninitialized",
         "Variable used before clear initialization path", "low"),
        
        # Global state mutation
        (r"global\s+\w+", "global_mutation",
         "Global variable mutation", "medium"),
        
        # Mutable default arguments (Python)
        (r"def\s+\w+\([^)]*=\s*\[\]", "mutable_default_list",
         "Mutable default argument []", "high"),
        (r"def\s+\w+\([^)]*=\s*\{\}", "mutable_default_dict",
         "Mutable default argument {}", "high"),
    ]
    
    # ─────────────────────────────────────────────────────────────────────────
    # EFFICIENCY PATTERNS
    # ─────────────────────────────────────────────────────────────────────────
    
    EFFICIENCY_PATTERNS = [
        # Nested loops
        (r"for\s*\([^)]*\)[^}]*for\s*\([^)]*\)", "nested_loops",
         "Nested loops (O(n²) or worse)", "medium"),
        (r"for\s+\w+\s+in\s+[^:]+:[^#]*for\s+\w+\s+in", "nested_loops_py",
         "Nested loops (O(n²) or worse)", "medium"),
        
        # List operations in loops
        (r"for\s+.*:\s*\n.*\.append\(.*for\s+", "append_in_nested",
         "Append in nested loop (potential O(n²))", "medium"),
        
        # String concatenation in loops
        (r"for\s+.*:\s*\n.*\+\s*=\s*['\"]", "string_concat_loop",
         "String concatenation in loop (O(n²))", "high"),
        
        # Repeated list creation
        (r"for\s+.*:\s*\n.*=\s*\[\]", "list_creation_in_loop",
         "List creation inside loop", "low"),
        
        # Linear search in loop
        (r"for\s+.*:\s*\n.*\s+in\s+\w+", "linear_search_in_loop",
         "Linear search inside loop (potential O(n²))", "medium"),
    ]
    
    # ─────────────────────────────────────────────────────────────────────────
    # RECURSION PATTERNS
    # ─────────────────────────────────────────────────────────────────────────
    
    RECURSION_PATTERNS = [
        # No base case visible
        (r"def\s+(\w+)\([^)]*\):\s*\n(?!.*if).*\1\(", "no_base_case",
         "Recursive call without visible base case", "high"),
        
        # No memoization for recursive
        (r"def\s+\w+\([^)]*\):[^@]*\n.*return.*\w+\([^)]*\)\s*\+\s*\w+\(", 
         "no_memo_recursive_sum",
         "Recursive sum without memoization (exponential)", "high"),
        
        # Deep recursion risk
        (r"def\s+(\w+)\([^)]*n[^)]*\):[^}]*\1\([^)]*n\s*-\s*1", "deep_recursion",
         "Linear recursion on n (stack overflow for large n)", "medium"),
    ]
    
    def detect(self, code: str) -> DetectedPatterns:
        """
        Detect all patterns in code.
        
        Parameters
        ----------
        code : str
            Source code to analyze
            
        Returns
        -------
        DetectedPatterns
            All detected patterns with risk scores
        """
        if not code or not code.strip():
            return DetectedPatterns()
        
        patterns = DetectedPatterns()
        
        # Detect each pattern category
        patterns.off_by_one_indicators = self._detect_patterns(
            code, self.OFF_BY_ONE_PATTERNS, "off_by_one"
        )
        
        patterns.boundary_risks = self._detect_patterns(
            code, self.BOUNDARY_PATTERNS, "boundary"
        )
        
        patterns.overflow_risks = self._detect_patterns(
            code, self.OVERFLOW_PATTERNS, "overflow"
        )
        
        patterns.uninitialized_risks = self._detect_patterns(
            code, self.STATE_PATTERNS[:1], "state"  # First is uninitialized
        )
        
        patterns.state_mutation_risks = self._detect_patterns(
            code, self.STATE_PATTERNS[1:], "state"
        )
        
        patterns.inefficiency_patterns = self._detect_patterns(
            code, self.EFFICIENCY_PATTERNS, "efficiency"
        )
        
        patterns.recursion_risks = self._detect_patterns(
            code, self.RECURSION_PATTERNS, "recursion"
        )
        
        # Calculate risk scores
        patterns.correctness_risk = self._calculate_correctness_risk(patterns)
        patterns.efficiency_risk = self._calculate_efficiency_risk(patterns)
        patterns.implementation_risk = self._calculate_implementation_risk(patterns)
        
        return patterns
    
    def _detect_patterns(
        self,
        code: str,
        pattern_list: List[Tuple],
        category: str,
    ) -> List[PatternMatch]:
        """Detect patterns from a pattern list."""
        matches = []
        
        for pattern_tuple in pattern_list:
            regex, pattern_type, description, risk_level = pattern_tuple
            
            try:
                found = re.findall(regex, code, re.MULTILINE | re.IGNORECASE)
                if found:
                    matches.append(PatternMatch(
                        pattern_type=pattern_type,
                        description=description,
                        risk_level=risk_level,
                        confidence=0.8 if len(found) == 1 else 0.9,
                    ))
            except re.error as e:
                logger.debug(f"Regex error for pattern {pattern_type}: {e}")
        
        return matches
    
    def _calculate_correctness_risk(self, patterns: DetectedPatterns) -> float:
        """Calculate correctness risk score (0-1)."""
        risk = 0.0
        
        # Off-by-one is high risk for correctness
        for p in patterns.off_by_one_indicators:
            if p.risk_level == "high":
                risk += 0.3
            elif p.risk_level == "medium":
                risk += 0.2
            else:
                risk += 0.1
        
        # Boundary risks
        for p in patterns.boundary_risks:
            if p.risk_level == "high":
                risk += 0.25
            elif p.risk_level == "medium":
                risk += 0.15
            else:
                risk += 0.05
        
        # Recursion without base case
        for p in patterns.recursion_risks:
            if "no_base_case" in p.pattern_type:
                risk += 0.3
        
        return min(1.0, risk)
    
    def _calculate_efficiency_risk(self, patterns: DetectedPatterns) -> float:
        """Calculate efficiency risk score (0-1)."""
        risk = 0.0
        
        # Inefficiency patterns
        for p in patterns.inefficiency_patterns:
            if p.risk_level == "high":
                risk += 0.3
            elif p.risk_level == "medium":
                risk += 0.2
            else:
                risk += 0.1
        
        # Recursion without memo
        for p in patterns.recursion_risks:
            if "no_memo" in p.pattern_type:
                risk += 0.4
        
        return min(1.0, risk)
    
    def _calculate_implementation_risk(self, patterns: DetectedPatterns) -> float:
        """Calculate implementation risk score (0-1)."""
        risk = 0.0
        
        # State management issues
        for p in patterns.uninitialized_risks:
            risk += 0.2
        
        for p in patterns.state_mutation_risks:
            if p.risk_level == "high":
                risk += 0.25
            else:
                risk += 0.1
        
        # Overflow risks
        for p in patterns.overflow_risks:
            if p.risk_level == "high":
                risk += 0.2
            elif p.risk_level == "medium":
                risk += 0.15
            else:
                risk += 0.05
        
        return min(1.0, risk)
