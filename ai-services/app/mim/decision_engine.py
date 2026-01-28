"""
MIM Decision Engine - v3.0
==========================

Upgraded inference that produces MIMDecision with agent instructions.

REPLACES: Old inference.py predict() method
ELIMINATES: pattern_detection_agent, difficulty_agent, duplicate reasoning

This module:
1. Runs ML models (root cause, readiness, performance)
2. Runs pattern engine (deterministic)
3. Computes difficulty action (rules-based)
4. Generates agent instructions (pre-computed)
5. Returns single authoritative MIMDecision

PHILOSOPHY:
- MIM is the BRAIN, agents are the VOICE
- All decisions computed here, agents just verbalize
- No LLM calls in this module - pure ML + rules
"""

import time
import logging
from typing import Dict, List, Optional, Any, Tuple

from app.mim.feature_extractor import MIMFeatureExtractor, MIN_SUBMISSIONS_FOR_FULL_FEATURES
from app.mim.model import MIMModel
from app.mim.pattern_engine import get_pattern_engine, PatternEngine
from app.mim.mim_decision import (
    MIMDecision,
    PatternResult,
    DifficultyAction,
    FeedbackInstruction,
    HintInstruction,
    LearningInstruction,
)
# V3.0: Import canonical taxonomy
from app.mim.taxonomy.subtype_masks import (
    ROOT_CAUSE_TO_SUBTYPES,
    SUBTYPES,
    is_valid_pair,
    get_valid_subtypes,
)
from app.mim.taxonomy.root_causes import ROOT_CAUSES
from app.mim.taxonomy.failure_mechanism_rules import derive_failure_mechanism

logger = logging.getLogger("mim.decision_engine")


# ═══════════════════════════════════════════════════════════════════════════════
# V3.0 CANONICAL TAXONOMY (from subtype_masks.py)
# 4 ROOT_CAUSES: correctness, efficiency, implementation, understanding_gap
# 7 SUBTYPES: wrong_invariant, incorrect_boundary, partial_case_handling,
#             state_loss, brute_force_under_constraints, premature_optimization,
#             misread_constraint
# ═══════════════════════════════════════════════════════════════════════════════

# SUBTYPE DESCRIPTIONS for feedback generation
SUBTYPE_DESCRIPTIONS = {
    "wrong_invariant": "Loop or recursion invariant does not hold",
    "incorrect_boundary": "Start/end conditions are wrong (off-by-one, inclusive/exclusive)",
    "partial_case_handling": "Some valid input cases are not handled",
    "state_loss": "Critical state not preserved across calls/iterations",
    "brute_force_under_constraints": "Solution complexity exceeds what constraints allow",
    "premature_optimization": "Optimized code that doesn't solve the problem correctly",
    "misread_constraint": "Constraint value or meaning was misunderstood",
    # V3.1: Problem misinterpretation subtypes
    "wrong_input_format": "Code expects different input structure than problem provides",
    "wrong_problem_entirely": "Solution is for a completely different problem",
    "misread_constraints": "Constraints on input/output were misunderstood",
}

# OLD ROOT CAUSE → NEW ROOT CAUSE MIGRATION MAP (V3.1 updated)
OLD_TO_NEW_ROOT_CAUSE = {
    "algorithm_choice": "correctness",
    "boundary_condition_blindness": "correctness",
    "off_by_one_error": "implementation",
    "time_complexity_issue": "efficiency",
    "logic_error": "correctness",
    "recursion_issue": "implementation",
    "comparison_error": "implementation",
    "integer_overflow": "implementation",
    "wrong_data_structure": "efficiency",
    "edge_case_handling": "correctness",
    "input_parsing": "problem_misinterpretation",  # V3.1: Map to new category
    "misread_problem": "problem_misinterpretation",  # V3.1: Map to new category  
    "partial_solution": "correctness",
    "type_error": "implementation",
    # Direct mappings (V3.1: 5 categories now)
    "correctness": "correctness",
    "efficiency": "efficiency",
    "implementation": "implementation",
    "understanding_gap": "understanding_gap",
    "problem_misinterpretation": "problem_misinterpretation",
}

# ═══════════════════════════════════════════════════════════════════════════════
# V3.0 FAILURE MECHANISM TEMPLATES (using new taxonomy)
# ═══════════════════════════════════════════════════════════════════════════════

FAILURE_MECHANISM_TEMPLATES = {
    # Correctness subtypes
    ("correctness", "wrong_invariant"): "Your {approach} doesn't maintain the required correctness invariant",
    ("correctness", "incorrect_boundary"): "Boundary condition at {location} is off by one or uses wrong comparison",
    ("correctness", "partial_case_handling"): "Input case {missing_case} is not handled by your logic",
    ("correctness", "state_loss"): "Critical state {state_name} is not preserved across {scope}",
    # Efficiency subtypes
    ("efficiency", "brute_force_under_constraints"): "Your O({actual}) approach exceeds the required O({expected}) for n={size}",
    ("efficiency", "premature_optimization"): "Optimization introduced bug: {bug_description}",
    # Implementation subtypes
    ("implementation", "incorrect_boundary"): "Array index or loop bound {location} is off by one",
    ("implementation", "state_loss"): "Variable {var_name} loses its value due to {reason}",
    ("implementation", "partial_case_handling"): "Edge case {case} crashes or returns wrong value",
    # Understanding gap subtypes
    ("understanding_gap", "misread_constraint"): "Constraint {constraint} was misinterpreted as {misinterpretation}",
    ("understanding_gap", "wrong_invariant"): "Conceptual misunderstanding of {concept} leads to wrong approach",
    # V3.1: Problem misinterpretation subtypes
    ("problem_misinterpretation", "wrong_input_format"): "Code expects {expected_format} but problem provides {actual_format}",
    ("problem_misinterpretation", "wrong_problem_entirely"): "Solution solves a different problem than what was asked",
    ("problem_misinterpretation", "misread_constraints"): "Constraint {constraint} was misread or ignored",
}

# ═══════════════════════════════════════════════════════════════════════════════
# V3.1 EDGE CASE RULES (by root cause)
# ═══════════════════════════════════════════════════════════════════════════════

EDGE_CASE_RULES = {
    "correctness": [
        "Empty input (n=0)",
        "Single element (n=1)",
        "All elements identical",
        "Maximum/minimum constraint values",
        "Negative numbers if allowed",
    ],
    "efficiency": [
        "Large n (n > 10^5)",
        "Worst-case input patterns",
        "Dense graphs (m ≈ n²)",
        "Long strings",
    ],
    "implementation": [
        "First/last element access",
        "Loop boundary conditions",
        "Integer overflow potential",
        "Null/undefined values",
    ],
    "understanding_gap": [
        "Constraint edge values",
        "Return type requirements",
        "Output format exactness",
        "Special input patterns",
    ],
    # V3.1: Problem misinterpretation edge cases
    "problem_misinterpretation": [
        "Input format exactly as specified",
        "Output format requirements",
        "Constraint values and their meaning",
        "Problem statement nuances",
    ],
    "unknown": [],
}


# ═══════════════════════════════════════════════════════════════════════════════
# V3.0 HINT DIRECTIONS (by root cause + subtype)
# ═══════════════════════════════════════════════════════════════════════════════

HINT_DIRECTIONS = {
    # ROOT CAUSES
    "correctness": {
        "direction": "Walk through your algorithm with a small example - does it produce the right answer?",
        "avoid": ["the bug is", "fix line", "change to"],
    },
    "efficiency": {
        "direction": "Think about whether you can avoid redundant computation or use a more efficient approach",
        "avoid": ["O(n)", "hashmap", "binary search", "specific algorithm"],
    },
    "implementation": {
        "direction": "Trace through the first and last iterations carefully - check your boundaries",
        "avoid": ["< vs <=", "off by one", "change index"],
    },
    "understanding_gap": {
        "direction": "Re-read the problem constraints carefully - what exactly is required?",
        "avoid": ["the problem says", "you misread", "constraint is"],
    },
    "problem_misinterpretation": {
        "direction": "Compare your code's input parsing with the problem's expected format - are they aligned?",
        "avoid": ["wrong problem", "misread", "input format is"],
    },
    # SUBTYPES (more specific hints)
    "wrong_invariant": {
        "direction": "Consider what property must remain true throughout your algorithm",
        "avoid": ["invariant is", "you need to maintain"],
    },
    "incorrect_boundary": {
        "direction": "Check what happens at the very first and very last elements",
        "avoid": ["off by one", "change <=", "boundary"],
    },
    "partial_case_handling": {
        "direction": "What happens when the input is empty, has one element, or all same values?",
        "avoid": ["add check", "handle case", "if empty"],
    },
    "state_loss": {
        "direction": "Is there any information you're losing that you need later?",
        "avoid": ["store", "save state", "preserve"],
    },
    "brute_force_under_constraints": {
        "direction": "Can you precompute something to avoid checking every combination?",
        "avoid": ["use hashmap", "sort first", "binary search"],
    },
    "premature_optimization": {
        "direction": "Does your optimized version handle all the cases correctly?",
        "avoid": ["simplify", "brute force first", "correctness"],
    },
    "misread_constraint": {
        "direction": "Re-read the constraints - what are the exact limits and requirements?",
        "avoid": ["constraint is", "n is", "you misread"],
    },
    "wrong_input_format": {
        "direction": "Look at the expected input format - is your code parsing it correctly?",
        "avoid": ["input is", "parse as", "format is"],
    },
    "wrong_problem_entirely": {
        "direction": "Verify your code is solving the right problem - compare expected output format",
        "avoid": ["wrong problem", "should be solving", "problem is actually"],
    },
    "misread_constraints": {
        "direction": "Check the constraints again - what are the exact limits on values and sizes?",
        "avoid": ["constraint says", "limit is", "maximum is"],
    },
    "unknown": {
        "direction": "Review your approach step by step to find where it diverges",
        "avoid": [],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# V3.0 FOCUS AREA MAP (by root cause + subtype)
# ═══════════════════════════════════════════════════════════════════════════════

FOCUS_AREA_MAP = {
    # ROOT CAUSES
    "correctness": [
        "Algorithm correctness verification",
        "Systematic edge case enumeration",
        "Loop invariant reasoning",
    ],
    "efficiency": [
        "Algorithm complexity analysis",
        "Optimization pattern recognition",
        "Time-space tradeoff understanding",
    ],
    "implementation": [
        "Boundary condition handling",
        "Index arithmetic precision",
        "State management practices",
    ],
    "understanding_gap": [
        "Problem constraint analysis",
        "Requirement extraction techniques",
        "Input-output specification matching",
    ],
    "problem_misinterpretation": [
        "Problem statement comprehension",
        "Input/output format verification",
        "Constraint and edge case alignment",
    ],
    # SUBTYPES
    "wrong_invariant": [
        "Loop invariant identification",
        "Correctness proof techniques",
        "Property preservation under operations",
    ],
    "incorrect_boundary": [
        "Off-by-one error prevention",
        "Inclusive vs exclusive range reasoning",
        "Array boundary safety patterns",
    ],
    "partial_case_handling": [
        "Edge case enumeration methodology",
        "Input domain coverage analysis",
        "Defensive programming patterns",
    ],
    "state_loss": [
        "Variable lifetime tracking",
        "State persistence patterns",
        "Scope and mutation awareness",
    ],
    "brute_force_under_constraints": [
        "Constraint-to-complexity mapping",
        "Algorithm optimization techniques",
        "Preprocessing and caching patterns",
    ],
    "premature_optimization": [
        "Correctness-first development",
        "Incremental optimization approach",
        "Testing before optimizing",
    ],
    "misread_constraint": [
        "Constraint extraction methodology",
        "Problem statement close reading",
        "Requirement verification habits",
    ],
    "wrong_input_format": [
        "Input format recognition",
        "Parser verification techniques",
        "Format template matching",
    ],
    "wrong_problem_entirely": [
        "Problem statement comprehension",
        "Expected output verification",
        "Solution-problem alignment",
    ],
    "misread_constraints": [
        "Constraint awareness training",
        "Limit verification habits",
        "Numeric overflow prevention",
    ],
    "unknown": [
        "General debugging techniques",
        "Systematic problem solving",
        "Code review practices",
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# MIM DECISION ENGINE CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class MIMDecisionEngine:
    """
    Central decision-making engine.
    
    Produces MIMDecision containing:
    - ML predictions (root cause, readiness, performance)
    - Pattern detection (deterministic)
    - Difficulty adjustment (rules-based)
    - Agent instructions (pre-computed)
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize decision engine."""
        if MIMDecisionEngine._initialized:
            return
        
        self.feature_extractor = MIMFeatureExtractor()
        self.model = MIMModel()
        self.pattern_engine = get_pattern_engine()
        
        # Load trained model
        loaded = self.model.load()
        if not loaded:
            logger.warning("MIM running with untrained model")
        
        MIMDecisionEngine._initialized = True
        logger.info("MIM Decision Engine v3.0 initialized")
    
    def decide(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]],
        problem_context: Optional[Dict[str, Any]] = None,
        user_memory: Optional[List[str]] = None,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> MIMDecision:
        """
        Generate complete MIM decision.
        
        This is the main entry point - replaces old predict() method.
        
        Returns MIMDecision with all agent instructions pre-computed.
        """
        start_time = time.time()
        
        try:
            # 1. Extract features
            features = self.feature_extractor.extract(
                submission=submission,
                user_history=user_history,
                problem_context=problem_context,
                user_memory=user_memory,
            )
            
            # 2. Run ML predictions
            root_cause_result = self.model.predict_root_cause(features)
            readiness_result = self.model.predict_readiness(features)
            performance_result = self.model.predict_performance(features)
            
            # V3.1: MIGRATE OLD ROOT CAUSE TO NEW TAXONOMY IMMEDIATELY
            raw_root_cause = root_cause_result["failure_cause"]
            migrated_root_cause = self._migrate_root_cause(raw_root_cause)
            
            # V3.1: Check for problem_misinterpretation before other analysis
            # (cheap heuristic check on code vs problem schema)
            misinterpretation = self._detect_problem_misinterpretation(
                submission.get("code", ""),
                problem_context,
            )
            if misinterpretation:
                migrated_root_cause = "problem_misinterpretation"
                root_cause_result = {
                    **root_cause_result,
                    "failure_cause": migrated_root_cause,
                    "confidence": 0.85,
                    "misinterpretation_details": misinterpretation,
                }
            else:
                # Update the root_cause_result with migrated value
                root_cause_result = {
                    **root_cause_result,
                    "failure_cause": migrated_root_cause,
                    "_original_cause": raw_root_cause,  # Keep for debugging
                }
            
            # 3. Run pattern engine (now with migrated root cause)
            pattern = self.pattern_engine.detect_pattern(
                root_cause=migrated_root_cause,  # V3.1: Use migrated cause
                root_cause_confidence=root_cause_result["confidence"],
                verdict=submission.get("verdict", ""),
                user_history=user_history,
                user_memory=user_memory,
                problem_tags=problem_context.get("tags") if problem_context else None,
            )
            
            # 4. Compute difficulty action
            difficulty_action = self._compute_difficulty_action(
                readiness_result, performance_result, user_history
            )
            
            # 5. Generate agent instructions
            # v3.3: Pass code, verdict, problem_context for subtype inference
            feedback_instruction = self._generate_feedback_instruction(
                root_cause_result, pattern, user_profile, performance_result,
                code=submission.get("code", ""),
                verdict=submission.get("verdict", ""),
                problem_context=problem_context,
            )
            hint_instruction = self._generate_hint_instruction(
                root_cause_result, problem_context, user_profile
            )
            learning_instruction = self._generate_learning_instruction(
                root_cause_result, user_profile
            )
            
            # 6. Generate focus areas
            focus_areas = self._generate_focus_areas(
                migrated_root_cause,  # V3.1: Use migrated
                readiness_result,
                problem_context,
            )
            
            # 7. Build final decision
            is_cold_start = len(user_history) < MIN_SUBMISSIONS_FOR_FULL_FEATURES
            inference_time = (time.time() - start_time) * 1000
            
            decision = MIMDecision(
                # Core predictions - V3.1: Always use migrated root cause
                root_cause=migrated_root_cause,
                root_cause_confidence=root_cause_result["confidence"],
                root_cause_alternatives=root_cause_result.get("alternatives", []),
                
                # Pattern (replaces pattern_detection_agent)
                pattern=pattern,
                
                # Difficulty (replaces difficulty_agent)
                difficulty_action=difficulty_action,
                
                # User state
                user_skill_level=readiness_result["current_level"],
                learning_velocity=performance_result["learning_velocity"],
                user_weak_topics=user_profile.get("weak_topics", []) if user_profile else [],
                
                # Agent instructions
                feedback_instruction=feedback_instruction,
                hint_instruction=hint_instruction,
                learning_instruction=learning_instruction,
                
                # Recommendations
                recommended_problems=[],  # Will be filled by recommender
                focus_areas=focus_areas,
                
                # Metadata
                is_cold_start=is_cold_start,
                model_version=f"v3.1-taxonomy-{self.model.model_version}-ml",  # v3.1 taxonomy with v2.0 ML model
                inference_time_ms=inference_time,
            )
            
            logger.info(
                f"MIM decision complete | root_cause={decision.root_cause} "
                f"pattern={pattern.pattern_name} recurring={pattern.is_recurring} "
                f"time={inference_time:.1f}ms"
            )
            
            return decision
            
        except Exception as e:
            logger.error(f"MIM decision failed: {e}", exc_info=True)
            return self._fallback_decision(submission, user_history)
    
    def _compute_difficulty_action(
        self,
        readiness: Dict[str, Any],
        performance: Dict[str, Any],
        user_history: List[Dict[str, Any]],
    ) -> DifficultyAction:
        """
        Compute difficulty adjustment using rules.
        
        NO LLM CALL - pure logic based on ML predictions.
        """
        plateau_risk = performance.get("plateau_risk", 0.0)
        burnout_risk = performance.get("burnout_risk", 0.0)
        velocity = performance.get("learning_velocity", "stable")
        current_level = readiness.get("current_level", "Medium")
        
        # Determine target difficulty
        recommended = readiness.get("recommended_difficulty", "Medium")
        
        # Compute success probability at recommended level
        success_probs = {
            "Easy": readiness.get("easy_readiness", 0.7),
            "Medium": readiness.get("medium_readiness", 0.5),
            "Hard": readiness.get("hard_readiness", 0.3),
        }
        success_prob = success_probs.get(recommended, 0.5)
        
        # Determine action and rationale
        if burnout_risk > 0.6:
            action = "decrease"
            rationale = f"High burnout risk ({burnout_risk:.0%}). Easier problems will rebuild confidence."
            recommended = "Easy"
            success_prob = success_probs["Easy"]
        elif plateau_risk > 0.5 and velocity in ["stable", "stalled"]:
            action = "stretch"
            rationale = f"Plateau detected (risk: {plateau_risk:.0%}). A challenging problem may reignite progress."
            if recommended != "Hard":
                recommended = "Medium" if recommended == "Easy" else "Hard"
            success_prob = success_probs[recommended]
        elif velocity == "accelerating":
            action = "increase"
            rationale = f"Learning velocity is accelerating. Ready for harder challenges."
            if recommended != "Hard":
                recommended = "Medium" if recommended == "Easy" else "Hard"
            success_prob = success_probs[recommended]
        elif velocity == "decelerating":
            action = "maintain"
            rationale = f"Learning velocity slowing. Consolidate at current level before advancing."
        else:
            action = "maintain"
            rationale = f"Steady progress at {current_level} level. Continue current difficulty."
        
        return DifficultyAction(
            action=action,
            current_level=current_level,
            target_difficulty=recommended,
            rationale=rationale,
            success_probability=success_prob,
            plateau_risk=plateau_risk,
            burnout_risk=burnout_risk,
        )
    
    def _infer_subtype(
        self,
        root_cause: str,
        code: str,
        verdict: str,
        problem_context: Optional[Dict[str, Any]],
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        V3.0: Infer granular subtype and failure mechanism from code patterns.
        
        Uses the canonical taxonomy from subtype_masks.py:
        - correctness: wrong_invariant, incorrect_boundary, partial_case_handling, state_loss
        - efficiency: brute_force_under_constraints, premature_optimization
        - implementation: incorrect_boundary, state_loss, partial_case_handling
        - understanding_gap: misread_constraint, wrong_invariant
        
        Returns:
            (subtype, failure_mechanism)
        """
        # V3.0: Migrate old root cause to new taxonomy if needed
        new_root_cause = OLD_TO_NEW_ROOT_CAUSE.get(root_cause, root_cause)
        
        # Get valid subtypes for this root cause
        valid_subtypes = ROOT_CAUSE_TO_SUBTYPES.get(new_root_cause)
        if not valid_subtypes:
            return None, None
        
        code_lower = code.lower() if code else ""
        category = problem_context.get("category", "") if problem_context else ""
        
        # EFFICIENCY subtypes
        if new_root_cause == "efficiency":
            if verdict in ["time_limit_exceeded", "tle"]:
                if code_lower.count("for") >= 2:
                    return "brute_force_under_constraints", "Nested loops create O(n²) or worse complexity"
                return "brute_force_under_constraints", "Solution exceeds time constraints"
            else:
                # Wrong answer but complexity-focused root cause → premature optimization
                return "premature_optimization", "Optimization introduced correctness bug"
        
        # CORRECTNESS subtypes
        elif new_root_cause == "correctness":
            # Check for invariant issues
            if "sort" in code_lower:
                return "wrong_invariant", "Sorting may destroy required ordering invariant"
            
            # Check for boundary issues
            if "<=" in code or ">=" in code or "-1" in code or "+1" in code:
                if verdict == "wrong_answer":
                    return "incorrect_boundary", "Boundary condition may be off by one"
            
            # Check for partial case handling
            if "if" in code_lower and ("return" in code_lower or "break" in code_lower):
                if verdict == "wrong_answer":
                    return "partial_case_handling", "Some input cases may not be handled"
            
            # Check for state loss
            if "=" in code and ("for" in code_lower or "while" in code_lower):
                if "memo" not in code_lower and "dp" not in code_lower:
                    return "state_loss", "Variable state may not be preserved correctly"
            
            # Default
            return "wrong_invariant", "Algorithm doesn't maintain required correctness property"
        
        # IMPLEMENTATION subtypes
        elif new_root_cause == "implementation":
            # Off-by-one patterns
            if "<=" in code or ">=" in code or "[" in code and ("-1" in code or "+1" in code):
                return "incorrect_boundary", "Array index or loop bound may be off by one"
            
            # State loss patterns
            if "=" in code and ("for" in code_lower or "while" in code_lower):
                return "state_loss", "Variable may be overwritten or lost in loop"
            
            # Default
            return "partial_case_handling", "Edge case not handled in implementation"
        
        # UNDERSTANDING_GAP subtypes
        elif new_root_cause == "understanding_gap":
            # Check problem context for constraint issues
            expected_complexity = problem_context.get("expected_complexity", "") if problem_context else ""
            if expected_complexity and code_lower.count("for") > 1:
                return "misread_constraint", f"Constraint requires {expected_complexity} but approach may be slower"
            
            # Default
            return "misread_constraint", "Problem constraint or requirement may be misunderstood"
        
        # PROBLEM_MISINTERPRETATION subtypes (V3.1)
        elif new_root_cause == "problem_misinterpretation":
            # Get misinterpretation details if available
            details = root_cause_result.get("misinterpretation_details", {}) if isinstance(root_cause_result, dict) else {}
            subtype = details.get("subtype", "wrong_input_format")
            reason = details.get("reason", "Code structure doesn't match problem requirements")
            return subtype, reason
        
        return None, None
    
    def _detect_problem_misinterpretation(
        self,
        code: str,
        problem_context: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, str]]:
        """
        V3.1: Detect problem misinterpretation using cheap heuristics.
        
        Checks if code structure doesn't match problem input schema.
        This runs BEFORE ML prediction and can override root cause.
        
        Returns:
            Dict with subtype and reason if misinterpretation detected, None otherwise
        """
        if not code or not problem_context:
            return None
        
        code_lower = code.lower()
        
        # Extract problem expectations
        expected_inputs = problem_context.get("input_format", "")
        expected_outputs = problem_context.get("output_format", "")
        problem_title = problem_context.get("title", "").lower()
        problem_tags = [t.lower() for t in problem_context.get("tags", [])]
        
        # Heuristic 1: Check for input format mismatch
        # If problem expects array but code doesn't read array
        if expected_inputs:
            expects_array = any(kw in expected_inputs.lower() for kw in ["array", "list", "[]", "vector"])
            expects_string = any(kw in expected_inputs.lower() for kw in ["string", "str"])
            expects_graph = any(kw in expected_inputs.lower() for kw in ["edge", "node", "graph", "tree"])
            
            # Check what code actually parses
            reads_array = any(kw in code_lower for kw in ["split()", ".split", "list(", "[]", "array"])
            reads_graph = any(kw in code_lower for kw in ["edge", "adj", "graph", "node"])
            
            if expects_graph and not reads_graph:
                return {
                    "subtype": "wrong_input_format",
                    "reason": f"Problem expects graph input but code doesn't process graph structure"
                }
            if expects_array and not reads_array and "input" in code_lower:
                return {
                    "subtype": "wrong_input_format", 
                    "reason": "Problem expects array input but code doesn't read array"
                }
        
        # Heuristic 2: Check for solving completely wrong problem
        # Common patterns that indicate wrong problem understanding
        problem_keywords = set()
        if "sum" in problem_title:
            problem_keywords.add("sum")
        if "sort" in problem_title:
            problem_keywords.add("sort")
        if "search" in problem_title or "find" in problem_title:
            problem_keywords.update(["search", "find", "index"])
        if "tree" in problem_tags or "binary tree" in problem_title:
            problem_keywords.update(["tree", "root", "left", "right", "node"])
        if "graph" in problem_tags:
            problem_keywords.update(["graph", "edge", "vertex", "adj"])
        
        if problem_keywords:
            code_has_keywords = any(kw in code_lower for kw in problem_keywords)
            if not code_has_keywords and len(code) > 50:
                # Code doesn't seem to relate to problem at all
                return {
                    "subtype": "wrong_problem_entirely",
                    "reason": f"Code doesn't contain expected elements for this problem type"
                }
        
        # Heuristic 3: Check for constraint misreading
        constraints = problem_context.get("constraints", "")
        if constraints:
            # Check if code handles the scale properly
            if "10^9" in constraints or "1e9" in constraints or "10**9" in constraints:
                if "mod" not in code_lower and "%" not in code and "int" in code_lower:
                    return {
                        "subtype": "misread_constraints",
                        "reason": "Large numbers in constraints but no modulo operation"
                    }
        
        return None
    
    def _migrate_root_cause(self, raw_root_cause: str) -> str:
        """Migrate old root cause to new V3.1 taxonomy (5 categories)."""
        return OLD_TO_NEW_ROOT_CAUSE.get(raw_root_cause, raw_root_cause)
    
    def _generate_feedback_instruction(
        self,
        root_cause_result: Dict[str, Any],
        pattern: PatternResult,
        user_profile: Optional[Dict[str, Any]],
        performance: Dict[str, Any],
        code: str = "",
        verdict: str = "",
        problem_context: Optional[Dict[str, Any]] = None,
    ) -> FeedbackInstruction:
        """Generate pre-computed instruction for feedback_agent."""
        raw_root_cause = root_cause_result["failure_cause"]
        
        # V3.0: Migrate to new taxonomy
        root_cause = self._migrate_root_cause(raw_root_cause)
        
        # V3.0: Infer subtype and failure mechanism using new taxonomy
        subtype, failure_mechanism = self._infer_subtype(
            root_cause, code, verdict, problem_context
        )
        
        # If no failure mechanism, try to derive using rules engine
        if not failure_mechanism and subtype:
            try:
                # Phase 1.1: Use real deterministic code signals (no placeholders)
                from app.mim.features.signal_extractor import extract_code_signals as _extract_legacy_signals
                sig_obj = _extract_legacy_signals(
                    code=code or "",
                    verdict=verdict or "",
                    constraints=problem_context.get("constraints") if problem_context else None,
                    problem_tags=problem_context.get("tags") if problem_context else None,
                )
                sig_dict = sig_obj.to_dict()

                # Compatibility: derive_failure_mechanism signature differs between modules.
                import inspect
                params = set(inspect.signature(derive_failure_mechanism).parameters.keys())

                if {"root_cause", "subtype", "category", "signals"}.issubset(params):
                    failure_mechanism = derive_failure_mechanism(
                        root_cause=root_cause,
                        subtype=subtype,
                        category=problem_context.get("category", "") if problem_context else "",
                        signals=sig_dict,
                    )
                else:
                    # Legacy signature fallback
                    mechanism_result = derive_failure_mechanism(
                        root_cause=root_cause,
                        subtype=subtype,
                        code_signals=sig_dict,
                        problem_category=problem_context.get("category", "") if problem_context else "",
                    )
                    if isinstance(mechanism_result, dict):
                        failure_mechanism = mechanism_result.get("failure_mechanism", "")
                    else:
                        failure_mechanism = str(mechanism_result)
            except Exception:
                pass
        
        # Get edge cases for this root cause (using new taxonomy)
        edge_cases = EDGE_CASE_RULES.get(root_cause, EDGE_CASE_RULES.get("unknown", []))
        
        # Determine tone based on user state
        burnout_risk = performance.get("burnout_risk", 0.0)
        if burnout_risk > 0.5:
            tone = "encouraging"
        elif pattern.is_recurring and pattern.recurrence_count >= 3:
            tone = "firm"  # User keeps making same mistake
        else:
            tone = "direct"
        
        # Get complexity verdict if efficiency-related
        complexity_verdict = None
        if root_cause == "efficiency":
            complexity_verdict = "Solution appears to have suboptimal time complexity"
        
        # Check for similar past context
        similar_past_context = None
        if pattern.is_recurring and user_profile:
            # Try to find context from profile
            patterns = user_profile.get("recurring_patterns", [])
            for p in patterns:
                if isinstance(p, dict) and root_cause in str(p).lower():
                    similar_past_context = str(p)[:200]
                    break
        
        return FeedbackInstruction(
            root_cause=root_cause,  # V3.0: Now uses new 4-category taxonomy
            root_cause_subtype=subtype,
            failure_mechanism=failure_mechanism,
            root_cause_confidence=root_cause_result["confidence"],
            is_recurring_mistake=pattern.is_recurring,
            recurrence_count=pattern.recurrence_count,
            similar_past_context=similar_past_context,
            complexity_verdict=complexity_verdict,
            edge_cases_likely=edge_cases[:3] if edge_cases else [],
            tone=tone,
        )
    
    def _generate_hint_instruction(
        self,
        root_cause_result: Dict[str, Any],
        problem_context: Optional[Dict[str, Any]],
        user_profile: Optional[Dict[str, Any]],
        subtype: Optional[str] = None,
    ) -> HintInstruction:
        """Generate pre-computed instruction for hint_agent."""
        raw_root_cause = root_cause_result["failure_cause"]
        root_cause = self._migrate_root_cause(raw_root_cause)
        
        # V3.0: Try subtype-specific hint first, then root cause
        hint_config = HINT_DIRECTIONS.get(
            subtype,
            HINT_DIRECTIONS.get(
                root_cause,
                {"direction": "Review your approach carefully", "avoid": []}
            )
        )
        
        # Check if relates to user's weak topic
        weak_topic_relevance = None
        if user_profile:
            weak_topics = user_profile.get("weak_topics", [])
            for topic in weak_topics:
                if any(kw in topic.lower() for kw in root_cause.replace("_", " ").split()):
                    weak_topic_relevance = topic
                    break
        
        return HintInstruction(
            hint_direction=hint_config["direction"],
            avoid_revealing=hint_config["avoid"],
            user_weak_topic_relevance=weak_topic_relevance,
        )
    
    def _generate_learning_instruction(
        self,
        root_cause_result: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]],
        subtype: Optional[str] = None,
    ) -> LearningInstruction:
        """Generate pre-computed instruction for learning_agent."""
        raw_root_cause = root_cause_result["failure_cause"]
        root_cause = self._migrate_root_cause(raw_root_cause)
        
        # V3.0: Try subtype-specific focus areas first, then root cause
        focus_areas = FOCUS_AREA_MAP.get(
            subtype,
            FOCUS_AREA_MAP.get(
                root_cause,
                ["General Problem-Solving Skills"]
            )
        )[:3]
        
        # Determine skill gap using subtype description if available
        if subtype and subtype in SUBTYPE_DESCRIPTIONS:
            skill_gap = SUBTYPE_DESCRIPTIONS[subtype]
        else:
            skill_gap = root_cause.replace("_", " ").title()
        
        # Check connection to weak topics
        connects_to_weak = False
        weak_topic_name = None
        if user_profile:
            weak_topics = user_profile.get("weak_topics", [])
            for topic in weak_topics:
                if any(kw in topic.lower() for kw in root_cause.replace("_", " ").split()):
                    connects_to_weak = True
                    weak_topic_name = topic
                    break
        
        return LearningInstruction(
            focus_areas=focus_areas,
            skill_gap=skill_gap,
            connects_to_weak_topic=connects_to_weak,
            weak_topic_name=weak_topic_name,
        )
    
    def _generate_focus_areas(
        self,
        root_cause: str,
        readiness: Dict[str, Any],
        problem_context: Optional[Dict[str, Any]],
    ) -> List[str]:
        """Generate recommended focus areas."""
        focus_areas = []
        
        # V3.0: Migrate root cause first
        new_root_cause = self._migrate_root_cause(root_cause)
        
        # Primary: from root cause
        if new_root_cause in FOCUS_AREA_MAP:
            focus_areas.extend(FOCUS_AREA_MAP[new_root_cause][:2])
        
        # Secondary: from skill level
        current_level = readiness.get("current_level", "Medium")
        if current_level in ["Beginner", "Easy"]:
            focus_areas.append("Fundamental Problem-Solving Patterns")
        elif current_level in ["Hard", "Hard+", "Expert"]:
            focus_areas.append("Advanced Algorithm Techniques")
        
        # Tertiary: from problem tags
        if problem_context:
            tags = problem_context.get("tags", [])
            if tags:
                focus_areas.append(f"Practice more {tags[0]} problems")
        
        return focus_areas[:3]
    
    def _fallback_decision(
        self,
        submission: Dict[str, Any],
        user_history: List[Dict[str, Any]],
    ) -> MIMDecision:
        """Generate fallback decision when inference fails."""
        # Handle None user_history
        user_history = user_history or []
        
        verdict = submission.get("verdict", "").lower()
        
        # Default cause based on verdict
        if "time" in verdict:
            cause = "time_complexity_issue"
        elif "runtime" in verdict:
            cause = "boundary_condition_blindness"
        else:
            cause = "logic_error"
        
        return MIMDecision(
            root_cause=cause,
            root_cause_confidence=0.3,
            root_cause_alternatives=[],
            pattern=PatternResult(),
            difficulty_action=DifficultyAction(
                action="maintain",
                current_level="Medium",
                target_difficulty="Medium",
                rationale="Unable to determine - maintaining current difficulty",
                success_probability=0.5,
            ),
            user_skill_level="Medium",
            learning_velocity="stable",
            user_weak_topics=[],
            feedback_instruction=FeedbackInstruction(
                root_cause=cause,
                root_cause_confidence=0.3,
                tone="encouraging",
            ),
            hint_instruction=HintInstruction(
                hint_direction="Review your approach carefully",
                avoid_revealing=[],
            ),
            learning_instruction=LearningInstruction(
                focus_areas=["General Problem-Solving Skills"],
                skill_gap="Unknown",
            ),
            focus_areas=["General practice"],
            is_cold_start=len(user_history) < MIN_SUBMISSIONS_FOR_FULL_FEATURES,
            model_version="fallback",
        )
    
    def reload_model(self) -> bool:
        """Reload model from disk."""
        return self.model.load()
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model metadata."""
        return self.model.get_model_info()


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_decision_engine() -> MIMDecisionEngine:
    """Get singleton MIMDecisionEngine instance."""
    return MIMDecisionEngine()


def make_decision(
    submission: Dict[str, Any],
    user_history: List[Dict[str, Any]],
    problem_context: Optional[Dict[str, Any]] = None,
    user_memory: Optional[List[str]] = None,
    user_profile: Optional[Dict[str, Any]] = None,
) -> MIMDecision:
    """
    Convenience function for workflow integration.
    
    v3.2: Automatically freezes the decision with a unique ID
    to enforce single immutable MIM decision per submission.
    
    Usage:
        from app.mim.decision_engine import make_decision
        decision = make_decision(submission, history, problem, memory, profile)
    """
    import uuid
    
    engine = get_decision_engine()
    decision = engine.decide(submission, user_history, problem_context, user_memory, user_profile)
    
    # v3.2: Freeze decision with unique ID to enforce immutability
    decision_id = f"mim_{uuid.uuid4().hex[:12]}"
    decision.freeze(decision_id)
    
    logger.info(f"🔒 MIM decision frozen | id={decision_id} | root_cause={decision.root_cause}")
    
    return decision
