"""
Phase 3.2 Learning Effectiveness Tests
======================================

Tests for learning effectiveness metrics that validate:
- Recurrence reduction after feedback
- Time-to-AC improvement
- Confidence trajectory stability
- Difficulty control stability
- RAG utility signal

Acceptance Criteria (from Phase 3.2 spec):
✓ Recurrence rate ↓ after feedback
✓ Time-to-AC ↓ or stable (not worse)
✓ Confidence does not inflate artificially
✓ Difficulty oscillation bounded
✓ RAG usage correlates with improvement (or skipped safely)
"""

import pytest
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from app.mim.metrics.learning_effectiveness import (
    LearningEffectivenessTracker,
    LearningEffectivenessReport,
    RecurrenceMetrics,
    TimeToACMetrics,
    MasteryMetrics,
    ConfidenceTrajectoryMetrics,
    DifficultyStabilityMetrics,
    RAGUtilityMetrics,
    evaluate_learning_effectiveness,
)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def tracker():
    return LearningEffectivenessTracker()


@pytest.fixture
def now():
    return datetime.now(timezone.utc)


@pytest.fixture
def sample_submissions(now):
    """Sample submissions showing improvement over time."""
    submissions = []
    for i in range(20):
        # Earlier submissions have more failures
        is_success = i >= 10 or (i % 3 == 0)
        submissions.append({
            "problem_id": f"problem_{i % 5}",
            "category": "Array" if i % 2 == 0 else "DP",
            "difficulty": "Medium",
            "verdict": "accepted" if is_success else "wrong_answer",
            "created_at": (now - timedelta(days=20-i)).isoformat(),
        })
    return submissions


@pytest.fixture
def sample_feedback_events(now):
    """Sample MIM feedback events with confidence scores."""
    events = []
    # Earlier events have lower confidence, later have higher
    for i in range(10):
        conf = 0.65 + (i * 0.025)  # 0.65 -> 0.875
        events.append({
            "root_cause": "implementation" if i % 2 == 0 else "efficiency",
            "subtype": "off_by_one",
            "mim_confidence": conf,
            "timestamp": (now - timedelta(days=10-i)).isoformat(),
        })
    return events


@pytest.fixture
def sample_focus_areas(now):
    """Sample focus areas for mastery tracking."""
    return [
        {
            "area": "Array",
            "recommended_at": (now - timedelta(days=15)).isoformat(),
            "baseline_success_rate": 0.4,
        },
        {
            "area": "DP",
            "recommended_at": (now - timedelta(days=15)).isoformat(),
            "baseline_success_rate": 0.3,
        },
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# RECURRENCE METRICS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestRecurrenceMetrics:
    """Test recurrence reduction calculation."""
    
    def test_recurrence_reduction_positive(self, tracker, now):
        """Fewer recurrences after feedback = positive reduction."""
        feedback = [
            {"root_cause": "implementation", "timestamp": (now - timedelta(days=10)).isoformat()},
            {"root_cause": "implementation", "timestamp": (now - timedelta(days=8)).isoformat()},
        ]
        
        # Only 1 recurrence after feedback (instead of expected ~1.4)
        submissions = [
            {"root_cause": "implementation", "created_at": (now - timedelta(days=5)).isoformat()},
        ]
        
        metrics = tracker._compute_recurrence_metrics(feedback, submissions)
        
        assert len(metrics) == 1
        assert metrics[0].root_cause == "implementation"
        assert metrics[0].reduction_rate > 0  # Positive reduction
    
    def test_recurrence_multiple_root_causes(self, tracker, now):
        """Track recurrence separately per root cause."""
        feedback = [
            {"root_cause": "implementation", "timestamp": (now - timedelta(days=10)).isoformat()},
            {"root_cause": "efficiency", "timestamp": (now - timedelta(days=10)).isoformat()},
        ]
        
        submissions = [
            {"root_cause": "implementation", "created_at": (now - timedelta(days=5)).isoformat()},
            {"root_cause": "efficiency", "created_at": (now - timedelta(days=5)).isoformat()},
        ]
        
        metrics = tracker._compute_recurrence_metrics(feedback, submissions)
        
        assert len(metrics) == 2
        root_causes = {m.root_cause for m in metrics}
        assert "implementation" in root_causes
        assert "efficiency" in root_causes


# ═══════════════════════════════════════════════════════════════════════════════
# TIME-TO-AC METRICS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestTimeToACMetrics:
    """Test time-to-AC improvement calculation."""
    
    def test_time_to_ac_improvement(self, tracker, now):
        """Fewer attempts after cutoff = improvement."""
        cutoff = now - timedelta(days=15)
        
        # Before cutoff: 3 attempts per problem
        # After cutoff: 2 attempts per problem
        submissions = [
            # Before cutoff
            {"problem_id": "p1", "category": "Array", "verdict": "wrong_answer", 
             "created_at": (cutoff - timedelta(days=3)).isoformat()},
            {"problem_id": "p1", "category": "Array", "verdict": "wrong_answer",
             "created_at": (cutoff - timedelta(days=2)).isoformat()},
            {"problem_id": "p1", "category": "Array", "verdict": "accepted",
             "created_at": (cutoff - timedelta(days=1)).isoformat()},
            # After cutoff
            {"problem_id": "p2", "category": "Array", "verdict": "wrong_answer",
             "created_at": (cutoff + timedelta(days=1)).isoformat()},
            {"problem_id": "p2", "category": "Array", "verdict": "accepted",
             "created_at": (cutoff + timedelta(days=2)).isoformat()},
        ]
        
        metrics = tracker._compute_time_to_ac_metrics(submissions, cutoff)
        
        # Should show improvement (3 attempts -> 2 attempts)
        array_metric = next((m for m in metrics if m.category == "Array"), None)
        if array_metric:
            assert array_metric.improvement_rate > 0


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE TRAJECTORY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceTrajectoryMetrics:
    """Test confidence trajectory calculation."""
    
    def test_confidence_stabilizing(self, tracker, now):
        """Increasing confidence with decreasing volatility = stabilizing."""
        cutoff = now - timedelta(days=30)
        
        # Early: low confidence, high variance
        # Late: higher confidence, lower variance
        feedback = [
            {"mim_confidence": 0.60, "timestamp": (now - timedelta(days=20)).isoformat()},
            {"mim_confidence": 0.70, "timestamp": (now - timedelta(days=18)).isoformat()},
            {"mim_confidence": 0.55, "timestamp": (now - timedelta(days=16)).isoformat()},
            {"mim_confidence": 0.65, "timestamp": (now - timedelta(days=14)).isoformat()},
            # Later: more stable
            {"mim_confidence": 0.78, "timestamp": (now - timedelta(days=8)).isoformat()},
            {"mim_confidence": 0.80, "timestamp": (now - timedelta(days=6)).isoformat()},
            {"mim_confidence": 0.79, "timestamp": (now - timedelta(days=4)).isoformat()},
            {"mim_confidence": 0.81, "timestamp": (now - timedelta(days=2)).isoformat()},
        ]
        
        metrics = tracker._compute_confidence_trajectory(feedback, cutoff)
        
        assert metrics is not None
        assert metrics.avg_confidence_late > metrics.avg_confidence_early
        assert metrics.confidence_trend > 0
        assert metrics.volatility_late < metrics.volatility_early
        assert metrics.is_stabilizing is True
    
    def test_confidence_not_inflating(self, tracker, now):
        """Confidence shouldn't spike artificially."""
        cutoff = now - timedelta(days=30)
        
        # Stable confidence (not inflating)
        feedback = [
            {"mim_confidence": 0.75, "timestamp": (now - timedelta(days=i)).isoformat()}
            for i in range(20, 0, -2)
        ]
        
        metrics = tracker._compute_confidence_trajectory(feedback, cutoff)
        
        assert metrics is not None
        assert abs(metrics.confidence_trend) < 0.20  # Not inflating
    
    def test_insufficient_data_returns_none(self, tracker, now):
        """Not enough data points returns None."""
        cutoff = now - timedelta(days=30)
        
        feedback = [
            {"mim_confidence": 0.75, "timestamp": (now - timedelta(days=5)).isoformat()},
        ]
        
        metrics = tracker._compute_confidence_trajectory(feedback, cutoff)
        
        assert metrics is None


# ═══════════════════════════════════════════════════════════════════════════════
# DIFFICULTY STABILITY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestDifficultyStabilityMetrics:
    """Test difficulty stability calculation."""
    
    def test_stable_difficulty(self, tracker, now):
        """Consistent difficulty = high stability."""
        submissions = [
            {"difficulty": "Medium", "created_at": (now - timedelta(days=i)).isoformat()}
            for i in range(10)
        ]
        
        metrics = tracker._compute_difficulty_stability([], submissions)
        
        assert metrics is not None
        assert metrics.oscillation_count == 0
        assert metrics.stability_score >= 0.9
        assert metrics.is_stable is True
    
    def test_oscillating_difficulty(self, tracker, now):
        """Frequent changes = low stability."""
        # Easy -> Medium -> Easy -> Medium -> Easy
        difficulties = ["Easy", "Medium", "Easy", "Medium", "Easy", "Medium", "Easy"]
        submissions = [
            {"difficulty": d, "created_at": (now - timedelta(days=7-i)).isoformat()}
            for i, d in enumerate(difficulties)
        ]
        
        metrics = tracker._compute_difficulty_stability([], submissions)
        
        assert metrics is not None
        assert metrics.oscillation_count >= 4
        assert metrics.oscillation_rate > 3.0
        assert metrics.is_stable is False
    
    def test_time_at_difficulty_levels(self, tracker, now):
        """Track time spent at each difficulty."""
        submissions = [
            {"difficulty": "Easy", "created_at": (now - timedelta(days=10)).isoformat()},
            {"difficulty": "Easy", "created_at": (now - timedelta(days=9)).isoformat()},
            {"difficulty": "Medium", "created_at": (now - timedelta(days=8)).isoformat()},
            {"difficulty": "Medium", "created_at": (now - timedelta(days=7)).isoformat()},
            {"difficulty": "Medium", "created_at": (now - timedelta(days=6)).isoformat()},
            {"difficulty": "Hard", "created_at": (now - timedelta(days=5)).isoformat()},
        ]
        
        metrics = tracker._compute_difficulty_stability([], submissions)
        
        assert metrics is not None
        assert metrics.time_at_easy == pytest.approx(2/6, rel=0.01)
        assert metrics.time_at_medium == pytest.approx(3/6, rel=0.01)
        assert metrics.time_at_hard == pytest.approx(1/6, rel=0.01)


# ═══════════════════════════════════════════════════════════════════════════════
# RAG UTILITY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestRAGUtilityMetrics:
    """Test RAG utility calculation."""
    
    def test_rag_beneficial(self, tracker, now):
        """Higher success with RAG = beneficial."""
        rag_events = [
            {"was_used": True, "relevance": 0.75, "problem_id": "p1"},
            {"was_used": True, "relevance": 0.80, "problem_id": "p2"},
            {"was_used": False, "problem_id": "p3"},
            {"was_used": False, "problem_id": "p4"},
        ]
        
        # Success with RAG, failure without
        submissions = [
            {"problem_id": "p1", "verdict": "accepted"},
            {"problem_id": "p2", "verdict": "accepted"},
            {"problem_id": "p3", "verdict": "wrong_answer"},
            {"problem_id": "p4", "verdict": "wrong_answer"},
        ]
        
        metrics = tracker._compute_rag_utility(rag_events, submissions)
        
        assert metrics is not None
        assert metrics.improvement_with_rag > metrics.improvement_without_rag
        assert metrics.rag_lift > 0
        assert metrics.is_beneficial is True
    
    def test_rag_usage_rate(self, tracker, now):
        """Track RAG usage rate."""
        rag_events = [
            {"was_used": True, "relevance": 0.75, "problem_id": "p1"},
            {"was_used": True, "relevance": 0.80, "problem_id": "p2"},
            {"was_used": False, "problem_id": "p3"},
        ]
        
        submissions = []
        
        metrics = tracker._compute_rag_utility(rag_events, submissions)
        
        assert metrics is not None
        assert metrics.total_retrievals == 3
        assert metrics.retrievals_used == 2
        assert metrics.retrievals_skipped == 1
        assert metrics.usage_rate == pytest.approx(2/3, rel=0.01)
    
    def test_no_rag_events_returns_none(self, tracker):
        """No RAG events returns None."""
        metrics = tracker._compute_rag_utility([], [])
        assert metrics is None


# ═══════════════════════════════════════════════════════════════════════════════
# FULL EVALUATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestFullEvaluation:
    """Test complete effectiveness evaluation."""
    
    def test_full_evaluation(
        self, tracker, sample_submissions, sample_feedback_events, sample_focus_areas
    ):
        """Test complete user evaluation."""
        report = tracker.evaluate_user(
            user_id="test_user",
            submissions=sample_submissions,
            feedback_events=sample_feedback_events,
            focus_areas=sample_focus_areas,
            evaluation_days=30,
        )
        
        assert report.user_id == "test_user"
        assert report.evaluation_period_days == 30
        assert 0 <= report.overall_effectiveness_score <= 1
        assert report.timestamp
    
    def test_acceptance_criteria_evaluation(self, tracker, now):
        """Test acceptance criteria flags."""
        # Create data that meets all criteria
        submissions = [
            {"problem_id": f"p{i}", "category": "Array", "difficulty": "Medium",
             "verdict": "accepted", "created_at": (now - timedelta(days=i)).isoformat()}
            for i in range(10)
        ]
        
        feedback = [
            {"root_cause": "implementation", "mim_confidence": 0.80,
             "timestamp": (now - timedelta(days=15)).isoformat()},
        ]
        
        report = tracker.evaluate_user(
            user_id="test_user",
            submissions=submissions,
            feedback_events=feedback,
            focus_areas=[],
            evaluation_days=30,
        )
        
        # Check that acceptance criteria are evaluated
        assert isinstance(report.meets_recurrence_criteria, bool)
        assert isinstance(report.meets_time_to_ac_criteria, bool)
        assert isinstance(report.meets_confidence_criteria, bool)
        assert isinstance(report.meets_difficulty_criteria, bool)
        assert isinstance(report.meets_rag_criteria, bool)
        assert isinstance(report.ready_for_production, bool)
    
    def test_convenience_function(
        self, sample_submissions, sample_feedback_events, sample_focus_areas
    ):
        """Test convenience function works."""
        report = evaluate_learning_effectiveness(
            user_id="test_user",
            submissions=sample_submissions,
            feedback_events=sample_feedback_events,
            focus_areas=sample_focus_areas,
        )
        
        assert isinstance(report, LearningEffectivenessReport)


# ═══════════════════════════════════════════════════════════════════════════════
# REPORT OUTPUT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestReportOutput:
    """Test report serialization and display."""
    
    def test_to_dict_complete(
        self, tracker, sample_submissions, sample_feedback_events, sample_focus_areas
    ):
        """Report to_dict includes all fields."""
        report = tracker.evaluate_user(
            user_id="test_user",
            submissions=sample_submissions,
            feedback_events=sample_feedback_events,
            focus_areas=sample_focus_areas,
        )
        
        d = report.to_dict()
        
        assert "user_id" in d
        assert "overall_effectiveness_score" in d
        assert "recurrence" in d
        assert "time_to_ac" in d
        assert "mastery" in d
        assert "signals" in d
        assert "acceptance_criteria" in d
        assert "confidence_trajectory" in d
        assert "difficulty_stability" in d
        assert "rag_utility" in d
    
    def test_print_summary_no_error(
        self, tracker, sample_submissions, sample_feedback_events, sample_focus_areas, capsys
    ):
        """print_summary should not raise errors."""
        report = tracker.evaluate_user(
            user_id="test_user",
            submissions=sample_submissions,
            feedback_events=sample_feedback_events,
            focus_areas=sample_focus_areas,
        )
        
        # Should not raise
        report.print_summary()
        
        captured = capsys.readouterr()
        assert "LEARNING EFFECTIVENESS REPORT" in captured.out
        assert "ACCEPTANCE CRITERIA" in captured.out


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
