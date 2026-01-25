"""
MIM Schemas - Pydantic models for MIM inputs/outputs
=====================================================

V2.0: Added Problem Recommendation, Difficulty Adjustment, expanded root causes (15)

These schemas define the contract between MIM and the rest of the system.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# EXPANDED ROOT CAUSE CATEGORIES (15 total - per requirements)
# ═══════════════════════════════════════════════════════════════════════════════

ROOT_CAUSE_CATEGORIES = [
    # Original 9
    "boundary_condition_blindness",   # Edge cases, empty inputs, n=1
    "off_by_one_error",               # Loop bounds, array indexing
    "integer_overflow",               # Large inputs causing overflow
    "wrong_data_structure",           # Suboptimal DS choice
    "logic_error",                    # Incorrect algorithm logic
    "time_complexity_issue",          # Inefficient approach causing TLE
    "recursion_issue",                # Stack overflow, missing base case
    "comparison_error",               # Wrong operators, floating point issues
    # New 6 (per requirements)
    "algorithm_choice",               # Wrong algorithm selected entirely
    "edge_case_handling",             # Specific edge case handling issues
    "input_parsing",                  # Failed to parse input correctly
    "misread_problem",                # Misunderstood problem statement
    "partial_solution",               # Solution is incomplete
    "type_error",                     # Type conversion/casting issues
    # Default
    "unknown",                        # Could not classify with confidence
]


# ═══════════════════════════════════════════════════════════════════════════════
# ROOT CAUSE PREDICTION
# ═══════════════════════════════════════════════════════════════════════════════

class MIMRootCause(BaseModel):
    """
    Predicted root cause of submission failure.
    
    15 Categories (expanded per requirements):
    - boundary_condition_blindness: Edge cases, empty inputs, n=1
    - off_by_one_error: Loop bounds, array indexing
    - integer_overflow: Large inputs causing overflow
    - wrong_data_structure: Suboptimal DS choice
    - logic_error: Incorrect algorithm logic
    - time_complexity_issue: Inefficient approach causing TLE
    - recursion_issue: Stack overflow, missing base case
    - comparison_error: Wrong operators, floating point issues
    - algorithm_choice: Wrong algorithm selected entirely
    - edge_case_handling: Specific edge case handling issues
    - input_parsing: Failed to parse input correctly
    - misread_problem: Misunderstood problem statement
    - partial_solution: Solution is incomplete
    - type_error: Type conversion/casting issues
    - unknown: Could not classify with confidence
    """
    failure_cause: str = Field(
        description="Predicted category of failure root cause"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Model confidence in this prediction (0-1)"
    )
    alternatives: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Alternative predictions with lower confidence"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# READINESS PREDICTION
# ═══════════════════════════════════════════════════════════════════════════════

class MIMReadiness(BaseModel):
    """
    User's readiness for different difficulty levels.
    
    Based on historical performance, learning velocity, and current state.
    """
    current_level: Literal["Beginner", "Easy", "Easy+", "Medium", "Medium+", "Hard", "Hard+", "Expert"] = Field(
        description="Estimated current skill level"
    )
    easy_readiness: float = Field(
        ge=0.0, le=1.0,
        description="Probability of success on Easy problems"
    )
    medium_readiness: float = Field(
        ge=0.0, le=1.0,
        description="Probability of success on Medium problems"
    )
    hard_readiness: float = Field(
        ge=0.0, le=1.0,
        description="Probability of success on Hard problems"
    )
    recommended_difficulty: Literal["Easy", "Medium", "Hard"] = Field(
        description="Recommended next problem difficulty"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE FORECAST
# ═══════════════════════════════════════════════════════════════════════════════

class MIMPerformanceForecast(BaseModel):
    """
    Predicted performance over next N submissions.
    """
    expected_success_rate: float = Field(
        ge=0.0, le=1.0,
        description="Expected success rate for next 5 submissions"
    )
    plateau_risk: float = Field(
        ge=0.0, le=1.0,
        description="Risk of learning plateau (not improving)"
    )
    burnout_risk: float = Field(
        ge=0.0, le=1.0,
        description="Risk of burnout (too many failures)"
    )
    learning_velocity: Literal["accelerating", "stable", "decelerating", "stalled"] = Field(
        description="Current learning trajectory direction"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# COGNITIVE PROFILE (FULL)
# ═══════════════════════════════════════════════════════════════════════════════

class MIMCognitiveProfile(BaseModel):
    """
    Full cognitive profile for a user.
    
    Generated from historical submissions + MIM analysis.
    """
    user_id: str
    
    # Skill assessment
    current_level: str
    strengths: List[str] = Field(default_factory=list)
    weak_topics: List[str] = Field(default_factory=list)
    
    # Behavioral patterns
    common_mistake_types: List[str] = Field(default_factory=list)
    recurring_patterns: List[str] = Field(default_factory=list)
    
    # Statistics
    total_submissions: int = 0
    success_rate: float = 0.0
    avg_attempts_to_solve: float = 0.0
    
    # Trajectory
    learning_velocity: str = "stable"
    improvement_trend: Literal["improving", "stable", "declining"] = "stable"
    
    # Timestamps
    profile_version: str = "v1.0"
    last_updated: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════════
# COMBINED MIM PREDICTION (MAIN OUTPUT)
# ═══════════════════════════════════════════════════════════════════════════════

class MIMPrediction(BaseModel):
    """
    Complete MIM prediction output for a submission.
    
    This is what gets added to workflow state as `mim_insights`.
    """
    # Core predictions
    root_cause: MIMRootCause
    readiness: MIMReadiness
    performance_forecast: MIMPerformanceForecast
    
    # Context for agents
    similar_past_mistakes: List[str] = Field(
        default_factory=list,
        description="Relevant past mistakes from user history"
    )
    recommended_focus_areas: List[str] = Field(
        default_factory=list,
        description="Topics user should focus on"
    )
    
    # Metadata
    is_cold_start: bool = Field(
        default=False,
        description="True if user has <5 submissions (using difficulty proxy)"
    )
    model_version: str = Field(
        default="v1.0",
        description="MIM model version used for prediction"
    )
    inference_time_ms: float = Field(
        default=0.0,
        description="Time taken for MIM inference in milliseconds"
    )

    def to_agent_context(self) -> str:
        """
        Format MIM prediction for inclusion in agent prompts.
        
        Returns a structured string that agents can parse.
        """
        confidence_level = (
            "HIGH" if self.root_cause.confidence >= 0.7 else
            "MEDIUM" if self.root_cause.confidence >= 0.5 else
            "LOW"
        )
        
        cold_start_warning = (
            "\n⚠️ NEW USER: Limited history - predictions based on problem difficulty"
            if self.is_cold_start else ""
        )
        
        return f"""
═══════════════════════════════════════════════════════════════════════════════
🧠 MIM INTELLIGENCE INSIGHTS (Confidence: {confidence_level})
═══════════════════════════════════════════════════════════════════════════════
{cold_start_warning}

PREDICTED ROOT CAUSE: {self.root_cause.failure_cause}
   Confidence: {self.root_cause.confidence:.0%}
   {f"Alternatives: {', '.join([a['cause'] for a in self.root_cause.alternatives[:2]])}" if self.root_cause.alternatives else ""}

USER READINESS:
   Current Level: {self.readiness.current_level}
   Easy Success: {self.readiness.easy_readiness:.0%} | Medium: {self.readiness.medium_readiness:.0%} | Hard: {self.readiness.hard_readiness:.0%}
   Recommended Next: {self.readiness.recommended_difficulty}

PERFORMANCE FORECAST:
   Expected Success (next 5): {self.performance_forecast.expected_success_rate:.0%}
   Plateau Risk: {self.performance_forecast.plateau_risk:.0%}
   Learning Velocity: {self.performance_forecast.learning_velocity}

SIMILAR PAST MISTAKES:
{chr(10).join([f'   • {m}' for m in self.similar_past_mistakes[:3]]) if self.similar_past_mistakes else '   (No similar mistakes found)'}

RECOMMENDED FOCUS AREAS:
{chr(10).join([f'   • {f}' for f in self.recommended_focus_areas[:3]]) if self.recommended_focus_areas else '   (Continue current approach)'}

═══════════════════════════════════════════════════════════════════════════════
MIM USAGE INSTRUCTIONS FOR AGENT:
- If confidence >= 70%: Structure feedback around predicted root cause
- If confidence 50-70%: Consider MIM prediction as strong hypothesis  
- If confidence < 50%: Use as supplementary signal, investigate independently
- ALWAYS mention if your analysis agrees/disagrees with MIM prediction
═══════════════════════════════════════════════════════════════════════════════
"""


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING DATA SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class MIMTrainingExample(BaseModel):
    """
    Single training example for MIM model.
    """
    submission_id: str
    user_id: str
    problem_id: str
    
    # Features (60 dimensions stored as list)
    features: List[float]
    
    # Labels
    root_cause_label: str
    was_successful: bool
    readiness_label: Optional[str] = None  # Easy/Medium/Hard
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    label_source: Literal["manual", "auto", "pattern_agent"] = "auto"
    label_confidence: float = 1.0


class MIMLabelingTask(BaseModel):
    """
    Task for manual labeling of submissions.
    """
    submission_id: str
    user_id: str
    problem_id: str
    
    # Context for labeler
    code: str
    verdict: str
    error_type: Optional[str]
    problem_title: str
    problem_difficulty: str
    
    # Auto-suggested label (from pattern_detection_agent)
    suggested_label: Optional[str] = None
    
    # Manual label (to be filled)
    manual_label: Optional[str] = None
    labeler_notes: Optional[str] = None
    labeled_at: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY ADJUSTMENT (NEW - per requirements)
# ═══════════════════════════════════════════════════════════════════════════════

class MIMDifficultyAdjustment(BaseModel):
    """
    Difficulty adjustment recommendation based on user performance.
    
    Used by difficulty_agent to calibrate problem recommendations.
    """
    recommendation: Literal["increase", "decrease", "maintain"] = Field(
        description="Recommended difficulty adjustment direction"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Model confidence in this recommendation"
    )
    current_difficulty: str = Field(
        description="User's current estimated difficulty level"
    )
    suggested_difficulty: str = Field(
        description="Suggested target difficulty level"
    )
    reasoning: str = Field(
        default="",
        description="Brief explanation for the recommendation"
    )
    
    # Supporting metrics
    recent_success_rate: float = Field(
        ge=0.0, le=1.0, default=0.5,
        description="Success rate over last 10 submissions"
    )
    frustration_index: float = Field(
        ge=0.0, le=1.0, default=0.0,
        description="Estimated frustration level (consecutive failures)"
    )
    boredom_index: float = Field(
        ge=0.0, le=1.0, default=0.0,
        description="Estimated boredom level (too many easy wins)"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROBLEM RECOMMENDATION (NEW - per requirements)
# ═══════════════════════════════════════════════════════════════════════════════

class MIMProblemRecommendation(BaseModel):
    """
    Single problem recommendation with scoring details.
    """
    problem_id: str = Field(description="Unique problem identifier")
    title: str = Field(description="Problem title")
    difficulty: str = Field(description="Problem difficulty level")
    tags: List[str] = Field(default_factory=list, description="Problem topic tags")
    
    # Scoring
    success_probability: float = Field(
        ge=0.0, le=1.0,
        description="Predicted probability of success for this user"
    )
    relevance_score: float = Field(
        ge=0.0, le=1.0,
        description="How relevant this problem is to user's learning goals"
    )
    
    # Ranking
    rank: int = Field(ge=1, description="Position in recommendation list")
    
    # Explanation
    reasoning: str = Field(
        default="",
        description="Why this problem is recommended"
    )
    
    # Source tracking
    recommendation_source: Literal["mim_model", "fallback_rule", "cold_start"] = Field(
        default="mim_model",
        description="How this recommendation was generated"
    )


class MIMRecommendations(BaseModel):
    """
    Complete problem recommendations for a user.
    
    Returned by the recommendation endpoint.
    """
    user_id: str = Field(description="User receiving recommendations")
    recommendations: List[MIMProblemRecommendation] = Field(
        default_factory=list,
        description="Ranked list of recommended problems"
    )
    
    # Context for why these were chosen
    focus_topics: List[str] = Field(
        default_factory=list,
        description="Topics the recommendations focus on"
    )
    avoid_topics: List[str] = Field(
        default_factory=list,
        description="Topics deliberately excluded (already mastered or too hard)"
    )
    
    # User state
    current_level: str = Field(
        default="Medium",
        description="User's current estimated level"
    )
    target_difficulty: str = Field(
        default="Medium",
        description="Target difficulty for recommendations"
    )
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.now)
    model_version: str = Field(default="v1.0")
    is_cold_start: bool = Field(
        default=False,
        description="True if recommendations are based on limited history"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL METRICS AND STATUS (NEW - per requirements)
# ═══════════════════════════════════════════════════════════════════════════════

class MIMModelMetrics(BaseModel):
    """
    Metrics for a trained MIM model.
    
    Generated during training/evaluation.
    """
    model_name: str = Field(description="Name/identifier of the model")
    
    # Classification metrics (root cause)
    accuracy: float = Field(ge=0.0, le=1.0, default=0.0)
    f1_macro: float = Field(ge=0.0, le=1.0, default=0.0)
    f1_weighted: float = Field(ge=0.0, le=1.0, default=0.0)
    roc_auc: Optional[float] = Field(ge=0.0, le=1.0, default=None)
    
    # Per-class metrics
    class_f1_scores: Dict[str, float] = Field(
        default_factory=dict,
        description="F1 score per root cause category"
    )
    
    # Confusion matrix (as nested list)
    confusion_matrix: Optional[List[List[int]]] = Field(
        default=None,
        description="Confusion matrix [true][predicted]"
    )
    class_labels: List[str] = Field(
        default_factory=list,
        description="Labels for confusion matrix axes"
    )
    
    # Ranking metrics (recommendations)
    precision_at_k: Dict[str, float] = Field(
        default_factory=dict,
        description="Precision@K for various K values"
    )
    ndcg_at_k: Dict[str, float] = Field(
        default_factory=dict,
        description="NDCG@K for various K values"
    )
    mrr: Optional[float] = Field(
        default=None,
        description="Mean Reciprocal Rank"
    )
    
    # Training info
    training_samples: int = Field(default=0)
    validation_samples: int = Field(default=0)
    training_time_seconds: float = Field(default=0.0)
    trained_at: Optional[datetime] = None
    
    # Cross-validation results
    cv_scores: List[float] = Field(
        default_factory=list,
        description="Cross-validation scores"
    )
    cv_mean: Optional[float] = Field(default=None)
    cv_std: Optional[float] = Field(default=None)


class MIMStatus(BaseModel):
    """
    Overall MIM system status.
    
    Returned by status endpoint to check model health.
    """
    is_trained: bool = Field(
        default=False,
        description="Whether the model has been trained"
    )
    model_version: str = Field(
        default="v2.1",
        description="Current model version"
    )
    
    # Model metrics summary
    metrics: Optional[MIMModelMetrics] = Field(
        default=None,
        description="Latest model metrics"
    )
    
    # Usage statistics
    total_predictions: int = Field(
        default=0,
        description="Total predictions made since deployment"
    )
    predictions_today: int = Field(
        default=0,
        description="Predictions made today"
    )
    avg_inference_time_ms: float = Field(
        default=0.0,
        description="Average inference time in milliseconds"
    )
    
    # Data statistics
    total_training_examples: int = Field(
        default=0,
        description="Total labeled examples available"
    )
    users_with_profiles: int = Field(
        default=0,
        description="Number of users with cognitive profiles"
    )
    
    # Health indicators
    model_health: Literal["healthy", "degraded", "untrained"] = Field(
        default="untrained",
        description="Overall model health status"
    )
    last_training: Optional[datetime] = Field(
        default=None,
        description="When model was last trained"
    )
    last_prediction: Optional[datetime] = Field(
        default=None,
        description="When last prediction was made"
    )
    
    # Component status
    components: Dict[str, bool] = Field(
        default_factory=lambda: {
            "root_cause_classifier": False,
            "readiness_predictor": False,
            "recommender": False,
            "difficulty_engine": True,  # Always available (rule-based)
            "roadmap_generator": True,  # Always available (rule-based)
            "feature_extractor": True,  # Always available
        },
        description="Status of individual MIM components"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# LEARNING ROADMAP SCHEMAS (NEW V2.1)
# ═══════════════════════════════════════════════════════════════════════════════

class RoadmapStep(BaseModel):
    """Single step in the micro-roadmap."""
    step_number: int = Field(ge=1, le=5, description="Position in 5-step roadmap")
    goal: str = Field(description="Learning goal for this step")
    target_problems: int = Field(default=2, description="Number of problems to complete")
    completed_problems: int = Field(default=0, description="Problems completed so far")
    focus_topics: List[str] = Field(default_factory=list, description="Topics to focus on")
    target_difficulty: Literal["Easy", "Medium", "Hard"] = Field(default="Medium")
    status: Literal["pending", "in_progress", "completed"] = Field(default="pending")
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class Milestone(BaseModel):
    """Learning milestone achievement."""
    name: str = Field(description="Milestone name")
    description: str = Field(description="What was achieved")
    achieved_at: datetime = Field(description="When achieved")
    evidence: str = Field(description="Evidence of achievement")


class LearningRoadmap(BaseModel):
    """
    Complete learning roadmap for a user.
    
    This is what makes Arrakis unique:
    - LeetCode: Static difficulty buckets
    - Codeforces: Elo-based rating
    - Arrakis + MIM: Cognitive trajectory modeling
    """
    user_id: str
    current_phase: Literal[
        "foundation", "skill_building", "consolidation", "advancement", "mastery"
    ] = Field(default="foundation", description="Current learning phase")
    
    # 5-step micro roadmap
    steps: List[RoadmapStep] = Field(
        default_factory=list,
        description="5-step immediate action plan"
    )
    
    # Topic dependencies (derived from co-occurrence)
    topic_dependencies: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Topic -> prerequisite topics mapping"
    )
    
    # Milestones
    milestones: List[Milestone] = Field(
        default_factory=list,
        description="Achievements unlocked"
    )
    
    # Long-term goals
    target_level: Literal["Beginner", "Easy", "Medium", "Hard", "Expert"] = Field(
        default="Medium"
    )
    estimated_weeks_to_target: Optional[int] = Field(
        default=None,
        description="Estimated weeks to reach target"
    )
    
    # Difficulty state
    difficulty_adjustment: Dict[str, Any] = Field(
        default_factory=dict,
        description="Current difficulty adjustment state"
    )
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.now)
    last_updated: Optional[datetime] = None
    version: str = Field(default="v2.1")


class EnhancedRecommendation(BaseModel):
    """
    Problem recommendation with full explanation.
    
    Includes WHY this problem is recommended and expected outcome.
    """
    problem_id: str
    title: str
    difficulty: str
    tags: List[str] = Field(default_factory=list)
    
    # Scoring (multi-factor)
    total_score: float = Field(ge=0.0, le=1.0, description="Combined recommendation score")
    score_breakdown: Dict[str, float] = Field(
        default_factory=dict,
        description="Individual factor scores"
    )
    
    # Explanation
    why: str = Field(description="Why this problem is recommended")
    expected_outcome: str = Field(description="What user will learn/improve")
    
    # Fit assessment
    difficulty_fit: Literal["perfect", "slightly_easy", "slightly_hard", "challenging"] = Field(
        default="perfect"
    )
    concept_relevance: float = Field(ge=0.0, le=1.0, default=0.5)
    
    # Source
    recommendation_source: Literal["mim_model", "fallback_rule", "cold_start", "roadmap"] = Field(
        default="mim_model"
    )
