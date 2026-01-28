"""
AST Analyzer for Code Signals
=============================

Lightweight AST analysis for extracting structural signals from code.

Supports:
- Python (via ast module)
- C++/Java/JavaScript (via regex fallback with structure detection)

All analysis is DETERMINISTIC - same code always produces same signals.
"""

import ast
import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Set

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ASTFeatures:
    """
    Features extracted from AST analysis.
    
    All fields are numeric or boolean for direct use as ML features.
    """
    # Structure metrics
    max_loop_depth: int = 0
    max_condition_depth: int = 0
    max_function_depth: int = 0
    total_loops: int = 0
    total_conditions: int = 0
    total_functions: int = 0
    
    # Loop analysis
    has_nested_loops: bool = False
    has_while_loop: bool = False
    has_for_loop: bool = False
    loop_with_break: int = 0
    loop_with_continue: int = 0
    loop_with_else: int = 0
    
    # Recursion indicators
    has_recursion: bool = False
    recursion_depth_bounded: bool = False  # Has explicit depth check
    
    # Boundary/index patterns
    array_access_count: int = 0
    index_arithmetic_count: int = 0  # i+1, i-1, etc.
    boundary_check_count: int = 0  # len(arr), .length, .size()
    off_by_one_risk_score: float = 0.0  # Heuristic
    
    # State management
    mutable_state_in_loop: int = 0  # Variables modified in loops
    global_variable_count: int = 0
    
    # Control flow
    early_return_count: int = 0
    multiple_return_paths: bool = False
    
    # Complexity indicators
    cyclomatic_complexity_estimate: int = 1  # Rough estimate
    
    # Language detection
    detected_language: str = "unknown"
    parse_success: bool = False
    
    def to_vector(self) -> List[float]:
        """Convert to feature vector for ML model."""
        return [
            float(self.max_loop_depth),
            float(self.max_condition_depth),
            float(self.total_loops),
            float(self.total_conditions),
            float(self.has_nested_loops),
            float(self.has_while_loop),
            float(self.has_for_loop),
            float(self.loop_with_break),
            float(self.has_recursion),
            float(self.recursion_depth_bounded),
            float(self.array_access_count),
            float(self.index_arithmetic_count),
            float(self.boundary_check_count),
            float(self.off_by_one_risk_score),
            float(self.mutable_state_in_loop),
            float(self.early_return_count),
            float(self.multiple_return_paths),
            float(self.cyclomatic_complexity_estimate),
            float(self.parse_success),
        ]
    
    @staticmethod
    def feature_names() -> List[str]:
        """Get feature names for the vector."""
        return [
            "ast_max_loop_depth",
            "ast_max_condition_depth",
            "ast_total_loops",
            "ast_total_conditions",
            "ast_has_nested_loops",
            "ast_has_while_loop",
            "ast_has_for_loop",
            "ast_loop_with_break",
            "ast_has_recursion",
            "ast_recursion_depth_bounded",
            "ast_array_access_count",
            "ast_index_arithmetic_count",
            "ast_boundary_check_count",
            "ast_off_by_one_risk",
            "ast_mutable_state_in_loop",
            "ast_early_return_count",
            "ast_multiple_return_paths",
            "ast_cyclomatic_complexity",
            "ast_parse_success",
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "max_loop_depth": self.max_loop_depth,
            "max_condition_depth": self.max_condition_depth,
            "max_function_depth": self.max_function_depth,
            "total_loops": self.total_loops,
            "total_conditions": self.total_conditions,
            "total_functions": self.total_functions,
            "has_nested_loops": self.has_nested_loops,
            "has_while_loop": self.has_while_loop,
            "has_for_loop": self.has_for_loop,
            "loop_with_break": self.loop_with_break,
            "loop_with_continue": self.loop_with_continue,
            "has_recursion": self.has_recursion,
            "recursion_depth_bounded": self.recursion_depth_bounded,
            "array_access_count": self.array_access_count,
            "index_arithmetic_count": self.index_arithmetic_count,
            "boundary_check_count": self.boundary_check_count,
            "off_by_one_risk_score": self.off_by_one_risk_score,
            "mutable_state_in_loop": self.mutable_state_in_loop,
            "global_variable_count": self.global_variable_count,
            "early_return_count": self.early_return_count,
            "multiple_return_paths": self.multiple_return_paths,
            "cyclomatic_complexity_estimate": self.cyclomatic_complexity_estimate,
            "detected_language": self.detected_language,
            "parse_success": self.parse_success,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# PYTHON AST ANALYZER
# ═══════════════════════════════════════════════════════════════════════════════

class PythonASTVisitor(ast.NodeVisitor):
    """AST visitor for Python code analysis."""
    
    def __init__(self):
        self.features = ASTFeatures()
        self.features.detected_language = "python"
        
        # Tracking state
        self.current_loop_depth = 0
        self.current_condition_depth = 0
        self.current_function_depth = 0
        self.function_names: Set[str] = set()
        self.called_functions: Set[str] = set()
        self.in_loop = False
        self.loop_modified_vars: Set[str] = set()
        self.return_count = 0
    
    def visit_FunctionDef(self, node: ast.FunctionDef):
        self.features.total_functions += 1
        self.function_names.add(node.name)
        
        self.current_function_depth += 1
        self.features.max_function_depth = max(
            self.features.max_function_depth,
            self.current_function_depth
        )
        
        # Track returns in this function
        old_return_count = self.return_count
        self.return_count = 0
        
        self.generic_visit(node)
        
        if self.return_count > 1:
            self.features.multiple_return_paths = True
        
        self.return_count = old_return_count
        self.current_function_depth -= 1
    
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        # Treat same as regular function
        self.visit_FunctionDef(node)  # type: ignore
    
    def visit_For(self, node: ast.For):
        self._handle_loop(node, is_for=True)
    
    def visit_While(self, node: ast.While):
        self._handle_loop(node, is_for=False)
    
    def _handle_loop(self, node, is_for: bool):
        self.features.total_loops += 1
        
        if is_for:
            self.features.has_for_loop = True
        else:
            self.features.has_while_loop = True
        
        was_in_loop = self.in_loop
        self.current_loop_depth += 1
        self.in_loop = True
        
        self.features.max_loop_depth = max(
            self.features.max_loop_depth,
            self.current_loop_depth
        )
        
        if self.current_loop_depth > 1:
            self.features.has_nested_loops = True
        
        # Check for else clause
        if hasattr(node, 'orelse') and node.orelse:
            self.features.loop_with_else += 1
        
        # Track complexity
        self.features.cyclomatic_complexity_estimate += 1
        
        self.generic_visit(node)
        
        self.current_loop_depth -= 1
        self.in_loop = was_in_loop
    
    def visit_If(self, node: ast.If):
        self.features.total_conditions += 1
        self.current_condition_depth += 1
        
        self.features.max_condition_depth = max(
            self.features.max_condition_depth,
            self.current_condition_depth
        )
        
        self.features.cyclomatic_complexity_estimate += 1
        
        self.generic_visit(node)
        self.current_condition_depth -= 1
    
    def visit_Break(self, node: ast.Break):
        self.features.loop_with_break += 1
        self.generic_visit(node)
    
    def visit_Continue(self, node: ast.Continue):
        self.features.loop_with_continue += 1
        self.generic_visit(node)
    
    def visit_Return(self, node: ast.Return):
        self.return_count += 1
        self.features.early_return_count += 1
        self.generic_visit(node)
    
    def visit_Call(self, node: ast.Call):
        # Track function calls for recursion detection
        if isinstance(node.func, ast.Name):
            self.called_functions.add(node.func.id)
        
        self.generic_visit(node)
    
    def visit_Subscript(self, node: ast.Subscript):
        # Array/list access
        self.features.array_access_count += 1
        
        # Check for index arithmetic (off-by-one risk)
        if isinstance(node.slice, ast.BinOp):
            if isinstance(node.slice.op, (ast.Add, ast.Sub)):
                self.features.index_arithmetic_count += 1
        
        self.generic_visit(node)
    
    def visit_Compare(self, node: ast.Compare):
        # Look for boundary checks
        for comparator in node.comparators:
            if isinstance(comparator, ast.Call):
                if isinstance(comparator.func, ast.Name):
                    if comparator.func.id == 'len':
                        self.features.boundary_check_count += 1
        
        self.generic_visit(node)
    
    def visit_Assign(self, node: ast.Assign):
        # Track mutable state in loops
        if self.in_loop:
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.loop_modified_vars.add(target.id)
        
        self.generic_visit(node)
    
    def visit_AugAssign(self, node: ast.AugAssign):
        # +=, -=, etc. in loops
        if self.in_loop:
            if isinstance(node.target, ast.Name):
                self.loop_modified_vars.add(node.target.id)
        
        self.generic_visit(node)
    
    def finalize(self):
        """Finalize analysis after visiting all nodes."""
        # Check for recursion
        self.features.has_recursion = bool(
            self.function_names & self.called_functions
        )
        
        # Mutable state in loop
        self.features.mutable_state_in_loop = len(self.loop_modified_vars)
        
        # Calculate off-by-one risk score
        self._calculate_off_by_one_risk()
    
    def _calculate_off_by_one_risk(self):
        """
        Heuristic risk score for off-by-one errors.
        
        High risk when:
        - Index arithmetic present
        - Loops with array access
        - Few boundary checks relative to accesses
        """
        if self.features.array_access_count == 0:
            self.features.off_by_one_risk_score = 0.0
            return
        
        base_risk = 0.0
        
        # Index arithmetic is risky
        if self.features.index_arithmetic_count > 0:
            base_risk += 0.3
        
        # Loops with array access
        if self.features.has_for_loop and self.features.array_access_count > 0:
            base_risk += 0.2
        
        # Nested loops with arrays
        if self.features.has_nested_loops and self.features.array_access_count > 1:
            base_risk += 0.2
        
        # Boundary checks reduce risk
        check_ratio = self.features.boundary_check_count / max(
            self.features.array_access_count, 1
        )
        base_risk -= check_ratio * 0.2
        
        self.features.off_by_one_risk_score = max(0.0, min(1.0, base_risk))


# ═══════════════════════════════════════════════════════════════════════════════
# REGEX FALLBACK ANALYZER (for non-Python code)
# ═══════════════════════════════════════════════════════════════════════════════

class RegexAnalyzer:
    """Regex-based analyzer for C++/Java/JavaScript."""
    
    # Language detection patterns
    LANG_PATTERNS = {
        "cpp": [
            r"#include\s*<",
            r"using\s+namespace\s+std",
            r"int\s+main\s*\(",
            r"cout\s*<<",
            r"cin\s*>>",
            r"vector<",
            r"::",
        ],
        "java": [
            r"public\s+class",
            r"public\s+static\s+void\s+main",
            r"System\.out\.print",
            r"import\s+java\.",
            r"new\s+\w+\[",
        ],
        "javascript": [
            r"function\s+\w+\s*\(",
            r"const\s+\w+\s*=",
            r"let\s+\w+\s*=",
            r"console\.log",
            r"=>\s*{",
        ],
    }
    
    # Structure patterns (language-agnostic)
    LOOP_PATTERNS = {
        "for": r"\bfor\s*\(",
        "while": r"\bwhile\s*\(",
        "do_while": r"\bdo\s*{",
    }
    
    INDEX_PATTERNS = [
        r"\[\s*\w+\s*[+\-]\s*\d+\s*\]",  # arr[i+1], arr[i-1]
        r"\[\s*\w+\s*\]",  # arr[i]
    ]
    
    BOUNDARY_PATTERNS = [
        r"\.length",
        r"\.size\(\)",
        r"len\(",
        r"\.length\(\)",
    ]
    
    RECURSION_PATTERNS = [
        r"(\w+)\s*\([^)]*\)[^{]*{[^}]*\1\s*\(",  # Function calling itself
    ]
    
    @classmethod
    def analyze(cls, code: str) -> ASTFeatures:
        """Analyze code using regex patterns."""
        features = ASTFeatures()
        
        # Detect language
        features.detected_language = cls._detect_language(code)
        
        # Count loops
        for loop_type, pattern in cls.LOOP_PATTERNS.items():
            matches = re.findall(pattern, code, re.IGNORECASE)
            count = len(matches)
            features.total_loops += count
            
            if loop_type == "for":
                features.has_for_loop = count > 0
            elif loop_type in ("while", "do_while"):
                features.has_while_loop = features.has_while_loop or count > 0
        
        # Estimate loop depth by nesting
        features.max_loop_depth = cls._estimate_loop_depth(code)
        features.has_nested_loops = features.max_loop_depth > 1
        
        # Count conditions
        if_matches = re.findall(r"\bif\s*\(", code)
        features.total_conditions = len(if_matches)
        features.max_condition_depth = cls._estimate_condition_depth(code)
        
        # Array access
        for pattern in cls.INDEX_PATTERNS:
            matches = re.findall(pattern, code)
            features.array_access_count += len(matches)
        
        # Index arithmetic (off-by-one risk)
        index_arith = re.findall(r"\[\s*\w+\s*[+\-]\s*\d+\s*\]", code)
        features.index_arithmetic_count = len(index_arith)
        
        # Boundary checks
        for pattern in cls.BOUNDARY_PATTERNS:
            matches = re.findall(pattern, code)
            features.boundary_check_count += len(matches)
        
        # Break/continue
        features.loop_with_break = len(re.findall(r"\bbreak\s*;", code))
        features.loop_with_continue = len(re.findall(r"\bcontinue\s*;", code))
        
        # Return statements
        features.early_return_count = len(re.findall(r"\breturn\b", code))
        features.multiple_return_paths = features.early_return_count > 1
        
        # Recursion (rough detection)
        features.has_recursion = cls._detect_recursion(code)
        
        # Estimate cyclomatic complexity
        features.cyclomatic_complexity_estimate = (
            1 + features.total_conditions + features.total_loops
        )
        
        # Off-by-one risk
        features.off_by_one_risk_score = cls._calculate_risk(features)
        
        features.parse_success = True
        return features
    
    @classmethod
    def _detect_language(cls, code: str) -> str:
        """Detect programming language from code patterns."""
        scores = {lang: 0 for lang in cls.LANG_PATTERNS}
        
        for lang, patterns in cls.LANG_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, code):
                    scores[lang] += 1
        
        if max(scores.values()) > 0:
            return max(scores, key=scores.get)
        return "unknown"
    
    @classmethod
    def _estimate_loop_depth(cls, code: str) -> int:
        """Estimate maximum loop nesting depth."""
        # Simple heuristic: count indentation levels of loop keywords
        lines = code.split('\n')
        max_depth = 0
        current_depth = 0
        
        for line in lines:
            stripped = line.lstrip()
            if re.match(r'(for|while)\s*\(', stripped):
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif stripped.startswith('}'):
                current_depth = max(0, current_depth - 1)
        
        return max(1, max_depth) if max_depth > 0 else 0
    
    @classmethod
    def _estimate_condition_depth(cls, code: str) -> int:
        """Estimate maximum condition nesting depth."""
        lines = code.split('\n')
        max_depth = 0
        current_depth = 0
        
        for line in lines:
            stripped = line.lstrip()
            if re.match(r'if\s*\(', stripped):
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif stripped.startswith('}'):
                current_depth = max(0, current_depth - 1)
        
        return max_depth
    
    @classmethod
    def _detect_recursion(cls, code: str) -> bool:
        """Detect if code contains recursive calls."""
        # Find function definitions
        func_defs = re.findall(
            r'(?:def|function|void|int|bool|string)\s+(\w+)\s*\([^)]*\)',
            code
        )
        
        for func_name in func_defs:
            # Check if function calls itself
            call_pattern = rf'\b{func_name}\s*\('
            # Find calls inside function body (rough approximation)
            if re.search(call_pattern, code):
                # Check if it appears more than once (def + call)
                if len(re.findall(call_pattern, code)) > 1:
                    return True
        
        return False
    
    @classmethod
    def _calculate_risk(cls, features: ASTFeatures) -> float:
        """Calculate off-by-one risk score."""
        if features.array_access_count == 0:
            return 0.0
        
        risk = 0.0
        
        if features.index_arithmetic_count > 0:
            risk += 0.3
        
        if features.has_for_loop and features.array_access_count > 0:
            risk += 0.2
        
        if features.has_nested_loops:
            risk += 0.2
        
        # Boundary checks reduce risk
        check_ratio = features.boundary_check_count / max(features.array_access_count, 1)
        risk -= check_ratio * 0.2
        
        return max(0.0, min(1.0, risk))


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ANALYZER CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class ASTAnalyzer:
    """
    Main AST analyzer with language detection and fallback.
    
    Usage:
        analyzer = ASTAnalyzer()
        features = analyzer.analyze(code)
    """
    
    def analyze(self, code: str) -> ASTFeatures:
        """
        Analyze code and extract structural features.
        
        Tries Python AST first, falls back to regex for other languages.
        
        Parameters
        ----------
        code : str
            Source code to analyze
            
        Returns
        -------
        ASTFeatures
            Extracted structural features
        """
        if not code or not code.strip():
            return ASTFeatures(parse_success=False)
        
        # Try Python AST first
        try:
            tree = ast.parse(code)
            visitor = PythonASTVisitor()
            visitor.visit(tree)
            visitor.finalize()
            visitor.features.parse_success = True
            return visitor.features
        except SyntaxError:
            # Not Python, try regex fallback
            pass
        except Exception as e:
            logger.debug(f"Python AST parse failed: {e}")
        
        # Regex fallback for non-Python
        try:
            return RegexAnalyzer.analyze(code)
        except Exception as e:
            logger.warning(f"Regex analysis failed: {e}")
            return ASTFeatures(parse_success=False)
