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
from typing import Dict, List, Optional, Any

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

logger = logging.getLogger("mim.decision_engine")


# ═══════════════════════════════════════════════════════════════════════════════
# EDGE CASE DETECTION RULES
# ═══════════════════════════════════════════════════════════════════════════════

EDGE_CASE_RULES = {
    # Original 9
    "boundary_condition_blindness": ["Empty input (n=0)", "Single element (n=1)", "Maximum constraint value"],
    "off_by_one_error": ["First element", "Last element", "Loop boundary conditions"],
    "integer_overflow": ["Large inputs near INT_MAX", "Multiplication results", "Sum accumulation"],
    "wrong_data_structure": ["Access patterns", "Memory constraints", "Time complexity requirements"],
    "time_complexity_issue": ["Large n (n > 10^5)", "Nested loops", "Repeated computations"],
    "recursion_issue": ["Base case validation", "Maximum recursion depth", "Stack overflow"],
    "comparison_error": ["Equality vs inequality", "Floating point precision", "Type coercion"],
    "logic_error": ["Algorithm correctness", "State transitions", "Loop invariants"],
    # New 6
    "algorithm_choice": ["Problem constraints", "Expected time complexity", "Input size ranges"],
    "edge_case_handling": ["Empty input", "Single element", "All same elements", "Negative values"],
    "input_parsing": ["Whitespace handling", "Number formats", "Special characters", "Line endings"],
    "misread_problem": ["Return type", "Output format", "Constraint interpretation"],
    "partial_solution": ["Missing cases", "Incomplete coverage", "Partial implementation"],
    "type_error": ["Integer vs float", "String vs number", "Array vs scalar"],
    # Fallback
    "unknown": [],
}


# ═══════════════════════════════════════════════════════════════════════════════
# HINT DIRECTION GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

HINT_DIRECTIONS = {
    # Original 9
    "boundary_condition_blindness": {
        "direction": "Consider what happens when your input is empty or has only one element",
        "avoid": ["add check for empty", "if n == 0", "edge case handling"],
    },
    "off_by_one_error": {
        "direction": "Trace through the first and last iterations of your loop carefully",
        "avoid": ["< instead of <=", "change loop bound", "off by one"],
    },
    "integer_overflow": {
        "direction": "Think about what happens when numbers get very large",
        "avoid": ["use long", "modulo", "overflow"],
    },
    "wrong_data_structure": {
        "direction": "Consider if there's a data structure that gives faster lookup",
        "avoid": ["hashmap", "set", "dictionary", "specific DS name"],
    },
    "time_complexity_issue": {
        "direction": "Think about whether you can avoid checking every pair",
        "avoid": ["O(n)", "linear", "hashmap", "two pointer", "specific algorithm"],
    },
    "logic_error": {
        "direction": "Walk through your algorithm with a small example step by step",
        "avoid": ["the bug is", "change line", "fix the condition"],
    },
    "recursion_issue": {
        "direction": "Consider what happens at the very beginning and very end of recursion",
        "avoid": ["base case", "return statement", "stack"],
    },
    "comparison_error": {
        "direction": "Check each comparison operator in your code - are they the right ones?",
        "avoid": ["use <=", "change to >", "operator"],
    },
    # New 6
    "algorithm_choice": {
        "direction": "Think about whether a different approach might be more efficient",
        "avoid": ["use DP", "use greedy", "specific algorithm name"],
    },
    "edge_case_handling": {
        "direction": "Consider the simplest possible inputs - what would your code return?",
        "avoid": ["add if statement", "check for", "handle case"],
    },
    "input_parsing": {
        "direction": "Double-check how you're reading and processing the input format",
        "avoid": ["split", "parse", "read line", "convert"],
    },
    "misread_problem": {
        "direction": "Re-read the problem statement carefully - what EXACTLY is being asked?",
        "avoid": ["the problem says", "you misunderstood", "read again"],
    },
    "partial_solution": {
        "direction": "Is your solution handling ALL cases the problem requires?",
        "avoid": ["add case", "you missed", "incomplete"],
    },
    "type_error": {
        "direction": "Think about the types of values flowing through your code",
        "avoid": ["int to string", "cast", "convert type"],
    },
    # Fallback
    "unknown": {
        "direction": "Review your approach step by step to find where it diverges from expected behavior",
        "avoid": [],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# FOCUS AREA GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

FOCUS_AREA_MAP = {
    # Original 9
    "boundary_condition_blindness": [
        "Edge Case Analysis Techniques",
        "Input Validation Patterns",
        "Boundary Testing Methodology",
    ],
    "off_by_one_error": [
        "Loop Invariant Analysis",
        "Array Index Boundary Practice",
        "Iteration Pattern Verification",
    ],
    "integer_overflow": [
        "Large Number Handling",
        "Modular Arithmetic",
        "Type Range Awareness",
    ],
    "wrong_data_structure": [
        "Data Structure Selection Guide",
        "Time-Space Complexity Tradeoffs",
        "Container Operation Costs",
    ],
    "time_complexity_issue": [
        "Algorithm Complexity Analysis",
        "Optimization Techniques",
        "Common O(n) Patterns",
    ],
    "logic_error": [
        "Algorithm Correctness Verification",
        "Dry Run Technique",
        "Invariant Checking",
    ],
    "recursion_issue": [
        "Recursion Fundamentals",
        "Base Case Design",
        "Stack Space Analysis",
    ],
    "comparison_error": [
        "Operator Semantics",
        "Boolean Logic Verification",
        "Precision-Aware Comparisons",
    ],
    # New 6
    "algorithm_choice": [
        "Algorithm Pattern Recognition",
        "Greedy vs DP Decision Making",
        "Problem Classification Techniques",
    ],
    "edge_case_handling": [
        "Systematic Edge Case Enumeration",
        "Input Constraint Analysis",
        "Test Case Generation",
    ],
    "input_parsing": [
        "Input Format Parsing Patterns",
        "String Processing Techniques",
        "Type Conversion Best Practices",
    ],
    "misread_problem": [
        "Problem Statement Analysis",
        "Constraint Extraction Techniques",
        "Example Trace-Through Methods",
    ],
    "partial_solution": [
        "Completeness Checking",
        "Solution Coverage Analysis",
        "Systematic Case Enumeration",
    ],
    "type_error": [
        "Type System Understanding",
        "Implicit Conversion Awareness",
        "Type Safety Practices",
    ],
    # Fallback
    "unknown": [
        "General Debugging Techniques",
        "Systematic Problem Solving",
        "Code Review Practices",
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
            
            # 3. Run pattern engine
            pattern = self.pattern_engine.detect_pattern(
                root_cause=root_cause_result["failure_cause"],
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
            feedback_instruction = self._generate_feedback_instruction(
                root_cause_result, pattern, user_profile, performance_result
            )
            hint_instruction = self._generate_hint_instruction(
                root_cause_result, problem_context, user_profile
            )
            learning_instruction = self._generate_learning_instruction(
                root_cause_result, user_profile
            )
            
            # 6. Generate focus areas
            focus_areas = self._generate_focus_areas(
                root_cause_result["failure_cause"],
                readiness_result,
                problem_context,
            )
            
            # 7. Build final decision
            is_cold_start = len(user_history) < MIN_SUBMISSIONS_FOR_FULL_FEATURES
            inference_time = (time.time() - start_time) * 1000
            
            decision = MIMDecision(
                # Core predictions
                root_cause=root_cause_result["failure_cause"],
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
                model_version=self.model.model_version,
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
    
    def _generate_feedback_instruction(
        self,
        root_cause_result: Dict[str, Any],
        pattern: PatternResult,
        user_profile: Optional[Dict[str, Any]],
        performance: Dict[str, Any],
    ) -> FeedbackInstruction:
        """Generate pre-computed instruction for feedback_agent."""
        root_cause = root_cause_result["failure_cause"]
        
        # Get edge cases for this root cause
        edge_cases = EDGE_CASE_RULES.get(root_cause, [])
        
        # Determine tone based on user state
        burnout_risk = performance.get("burnout_risk", 0.0)
        if burnout_risk > 0.5:
            tone = "encouraging"
        elif pattern.is_recurring and pattern.recurrence_count >= 3:
            tone = "firm"  # User keeps making same mistake
        else:
            tone = "direct"
        
        # Get complexity verdict if TLE-related
        complexity_verdict = None
        if root_cause == "time_complexity_issue":
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
            root_cause=root_cause,
            root_cause_confidence=root_cause_result["confidence"],
            is_recurring_mistake=pattern.is_recurring,
            recurrence_count=pattern.recurrence_count,
            similar_past_context=similar_past_context,
            complexity_verdict=complexity_verdict,
            edge_cases_likely=edge_cases[:3],
            tone=tone,
        )
    
    def _generate_hint_instruction(
        self,
        root_cause_result: Dict[str, Any],
        problem_context: Optional[Dict[str, Any]],
        user_profile: Optional[Dict[str, Any]],
    ) -> HintInstruction:
        """Generate pre-computed instruction for hint_agent."""
        root_cause = root_cause_result["failure_cause"]
        
        # Get hint direction from map
        hint_config = HINT_DIRECTIONS.get(
            root_cause,
            {"direction": "Review your approach carefully", "avoid": []}
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
    ) -> LearningInstruction:
        """Generate pre-computed instruction for learning_agent."""
        root_cause = root_cause_result["failure_cause"]
        
        # Get focus areas from map
        focus_areas = FOCUS_AREA_MAP.get(
            root_cause,
            ["General Problem-Solving Skills"]
        )[:3]
        
        # Determine skill gap
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
        
        # Primary: from root cause
        if root_cause in FOCUS_AREA_MAP:
            focus_areas.extend(FOCUS_AREA_MAP[root_cause][:2])
        
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
    
    Usage:
        from app.mim.decision_engine import make_decision
        decision = make_decision(submission, history, problem, memory, profile)
    """
    engine = get_decision_engine()
    return engine.decide(submission, user_history, problem_context, user_memory, user_profile)
