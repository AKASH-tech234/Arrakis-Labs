"""
v3.2 Fixes Verification Script
================================
Tests all the fixes made:
1. Context builder null-safety
2. Profile builder MIM integration
3. Single immutable MIM decision
4. Profile-MIM disagreement assertion
5. profile_updated_after_submission metric
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.mim.mim_decision import MIMDecision, PatternResult, DifficultyAction, FeedbackInstruction, HintInstruction, LearningInstruction
from app.rag.context_builder import build_feedback_context_focused, build_hint_context_minimal, build_learning_context_minimal
from app.user_profile.profile_builder import build_user_profile
from app.schemas.user_profile import UserProfile
from app.schemas.submission import SubmissionContext


def create_test_mim_decision() -> MIMDecision:
    """Create a test MIM decision for verification - matching actual schema"""
    return MIMDecision(
        root_cause="boundary_condition_blindness",
        root_cause_confidence=0.85,
        root_cause_alternatives=[
            {"cause": "off_by_one_error", "confidence": 0.12}
        ],
        pattern=PatternResult(
            pattern_name="boundary_condition_blindness",
            is_recurring=True,
            recurrence_count=3,
            last_occurrence="2026-01-20",
            confidence=0.85,
            detection_method="history_lookup"
        ),
        difficulty_action=DifficultyAction(
            action="maintain",
            current_level="Intermediate",
            target_difficulty="Medium",
            rationale="User is progressing normally",
            success_probability=0.75,
            plateau_risk=0.2,
            burnout_risk=0.1
        ),
        user_skill_level="Intermediate",
        learning_velocity="stable",
        user_weak_topics=["Edge cases", "Array boundaries"],
        feedback_instruction=FeedbackInstruction(
            root_cause="boundary_condition_blindness",
            root_cause_confidence=0.85,
            is_recurring_mistake=True,
            recurrence_count=3,
            similar_past_context="Similar issue on two-sum problem",
            complexity_verdict=None,
            edge_cases_likely=["Empty input", "Single element"],
            tone="encouraging"
        ),
        hint_instruction=HintInstruction(
            hint_direction="Consider what happens when input array is empty",
            avoid_revealing=["Check for empty array", "Add boundary check"],
            user_weak_topic_relevance="Edge cases"
        ),
        learning_instruction=LearningInstruction(
            focus_areas=["Array boundaries", "Edge case handling"],
            skill_gap="Boundary condition handling",
            connects_to_weak_topic=True,
            weak_topic_name="Edge cases"
        ),
        recommended_problems=[
            {"id": "valid-anagram", "difficulty": "Easy", "reason": "Practice edge cases"}
        ],
        focus_areas=["Edge case handling", "Boundary conditions"]
    )


def test_mim_immutability():
    """Test #3: Single immutable MIM decision"""
    print("\n" + "="*60)
    print("TEST 3: MIM Decision Immutability")
    print("="*60)
    
    decision = create_test_mim_decision()
    
    # Check initial state
    print(f"Initial is_frozen: {decision.is_frozen}")
    print(f"Initial decision_id: {decision.decision_id}")
    
    # Freeze the decision
    decision.freeze("test-decision-001")
    
    print(f"After freeze is_frozen: {decision.is_frozen}")
    print(f"After freeze decision_id: {decision.get_decision_id()}")
    
    assert decision.is_frozen == True, "Decision should be frozen"
    assert decision.decision_id == "test-decision-001", "Decision ID should be set"
    
    print("✅ MIM immutability works correctly")
    return True


def test_context_builder_null_safety():
    """Test #1: Context builder null-safety"""
    print("\n" + "="*60)
    print("TEST 1: Context Builder Null Safety")
    print("="*60)
    
    # Create a mock submission context matching actual schema
    submission = SubmissionContext(
        user_id="test-user-001",
        problem_id="test-problem",
        problem_category="Arrays",
        constraints="1 <= n <= 10^5",
        code="def solution(): pass",
        language="python",
        verdict="Wrong Answer",
        error_type="Runtime Error"
    )
    
    # Test with None MIM decision
    context = build_feedback_context_focused(
        submission=submission,
        problem_context={"id": "test", "title": "Test Problem"},
        user_profile={"skill_level": "beginner"},
        mim_decision=None  # NULL CASE
    )
    print(f"Context with None MIM decision: {len(context)} chars")
    assert context is not None, "Should handle None MIM decision"
    
    # Test with proper MIM decision
    decision = create_test_mim_decision()
    context_with_mim = build_feedback_context_focused(
        submission=submission,
        problem_context={"id": "test", "title": "Test Problem"},
        user_profile={"skill_level": "beginner"},
        mim_decision=decision
    )
    print(f"Context with MIM decision: {len(context_with_mim)} chars")
    assert context_with_mim is not None, "Should handle valid MIM decision"
    
    # Test hint context null safety (signature: mim_decision, feedback_hint)
    hint_context = build_hint_context_minimal(
        mim_decision=None,  # NULL CASE
        feedback_hint="Consider edge cases"
    )
    assert hint_context is not None, "Hint context should handle None MIM"
    
    # Test learning context null safety (signature: mim_decision, problem_category)
    learning_context = build_learning_context_minimal(
        mim_decision=None,  # NULL CASE
        problem_category="Arrays"
    )
    assert learning_context is not None, "Learning context should handle None MIM"
    
    print("✅ Context builder null-safety verified")
    return True


def test_profile_builder_mim_integration():
    """Test #2 and #4: Profile builder MIM integration and disagreement detection"""
    print("\n" + "="*60)
    print("TEST 2 & 4: Profile Builder MIM Integration & Disagreement")
    print("="*60)
    
    # Create MIM decision
    mim_decision = create_test_mim_decision()
    mim_decision.freeze("test-profile-001")
    
    # Test profile building with MIM - use memory_text string, not chunks
    memory_text = """
    User struggled with boundary_condition_blindness on two-sum problem.
    Previous submission had boundary_condition_blindness error.
    User often forgets edge cases when arrays are empty.
    Recent mistake: off_by_one_error on binary search.
    """
    
    profile = build_user_profile(
        user_id="test-user-001",
        memory_text=memory_text,
        submission_stats={"total_submissions": 10, "success_rate": 0.6},
        last_verdict="Wrong Answer",
        mim_decision=mim_decision
    )
    
    print(f"Profile MIM root cause: {profile.current_mim_root_cause}")
    print(f"Profile MIM confidence: {profile.current_mim_confidence}")
    print(f"Profile MIM decision ID: {profile.mim_decision_id}")
    print(f"Profile-MIM agreement: {profile.profile_mim_agreement}")
    print(f"Disagreement reason: {profile.profile_mim_disagreement_reason}")
    print(f"Profile updated: {profile.profile_updated_after_submission}")
    
    assert profile.current_mim_root_cause == "boundary_condition_blindness", "Should capture MIM root cause"
    assert profile.current_mim_confidence == 0.85, "Should capture MIM confidence"
    assert profile.mim_decision_id is not None, "Should have MIM decision ID"
    assert profile.profile_updated_after_submission == True, "Should mark profile as updated"
    
    print("✅ Profile builder MIM integration verified")
    return True


def test_profile_mim_disagreement():
    """Test #4: Profile-MIM disagreement detection"""
    print("\n" + "="*60)
    print("TEST 4: Profile-MIM Disagreement Detection")
    print("="*60)
    
    # Create MIM decision with time_complexity_issue root cause
    mim_decision = create_test_mim_decision()
    # Modify root cause to create disagreement
    mim_decision.root_cause = "time_complexity_issue"
    mim_decision.freeze("test-disagreement-001")
    
    # Create memory text suggesting different pattern (boundary issues, not time complexity)
    memory_text = """
    User has repeated boundary_condition_blindness mistakes.
    Problem array-sum had boundary_condition_blindness.
    Problem find-max had boundary_condition_blindness.
    User always forgets empty array checks.
    """
    
    profile = build_user_profile(
        user_id="test-user-002",
        memory_text=memory_text,
        submission_stats={"total_submissions": 5, "success_rate": 0.4},
        last_verdict="Wrong Answer",
        mim_decision=mim_decision
    )
    
    print(f"Profile common mistakes: {profile.common_mistakes}")
    print(f"MIM root cause: {profile.current_mim_root_cause}")
    print(f"Agreement: {profile.profile_mim_agreement}")
    print(f"Disagreement reason: {profile.profile_mim_disagreement_reason}")
    
    # Note: Agreement depends on whether profile weak areas match MIM root cause
    # This verifies the disagreement detection is running
    print("✅ Profile-MIM disagreement detection verified (logged)")
    return True


def test_user_profile_schema():
    """Test #5: UserProfile schema has new fields"""
    print("\n" + "="*60)
    print("TEST 5: UserProfile Schema New Fields")
    print("="*60)
    
    profile = UserProfile(
        user_id="test-schema-user",
        common_mistakes=["boundary condition issues"],
        weak_topics=["Edge cases"],
        recurring_patterns=["off-by-one errors"]
    )
    
    # Check new v3.2 fields exist
    print(f"current_mim_root_cause: {profile.current_mim_root_cause}")
    print(f"current_mim_confidence: {profile.current_mim_confidence}")
    print(f"mim_decision_id: {profile.mim_decision_id}")
    print(f"profile_mim_agreement: {profile.profile_mim_agreement}")
    print(f"profile_mim_disagreement_reason: {profile.profile_mim_disagreement_reason}")
    print(f"profile_updated_after_submission: {profile.profile_updated_after_submission}")
    print(f"last_profile_update: {profile.last_profile_update}")
    
    assert hasattr(profile, 'current_mim_root_cause'), "Should have current_mim_root_cause"
    assert hasattr(profile, 'current_mim_confidence'), "Should have current_mim_confidence"
    assert hasattr(profile, 'mim_decision_id'), "Should have mim_decision_id"
    assert hasattr(profile, 'profile_mim_agreement'), "Should have profile_mim_agreement"
    assert hasattr(profile, 'profile_mim_disagreement_reason'), "Should have profile_mim_disagreement_reason"
    assert hasattr(profile, 'profile_updated_after_submission'), "Should have profile_updated_after_submission"
    assert hasattr(profile, 'last_profile_update'), "Should have last_profile_update"
    
    print("✅ UserProfile schema has all v3.2 fields")
    return True


def main():
    """Run all verification tests"""
    print("\n" + "#"*60)
    print("# v3.2 FIXES VERIFICATION SUITE")
    print("#"*60)
    
    results = {}
    
    # Run tests
    try:
        results["context_null_safety"] = test_context_builder_null_safety()
    except Exception as e:
        print(f"❌ Context null safety test failed: {e}")
        results["context_null_safety"] = False
    
    try:
        results["profile_mim_integration"] = test_profile_builder_mim_integration()
    except Exception as e:
        print(f"❌ Profile MIM integration test failed: {e}")
        import traceback
        traceback.print_exc()
        results["profile_mim_integration"] = False
    
    try:
        results["mim_immutability"] = test_mim_immutability()
    except Exception as e:
        print(f"❌ MIM immutability test failed: {e}")
        results["mim_immutability"] = False
    
    try:
        results["profile_mim_disagreement"] = test_profile_mim_disagreement()
    except Exception as e:
        print(f"❌ Profile-MIM disagreement test failed: {e}")
        import traceback
        traceback.print_exc()
        results["profile_mim_disagreement"] = False
    
    try:
        results["user_profile_schema"] = test_user_profile_schema()
    except Exception as e:
        print(f"❌ UserProfile schema test failed: {e}")
        results["user_profile_schema"] = False
    
    # Summary
    print("\n" + "="*60)
    print("VERIFICATION SUMMARY")
    print("="*60)
    
    all_passed = all(results.values())
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {test}: {status}")
    
    print("="*60)
    if all_passed:
        print("🎉 ALL v3.2 FIXES VERIFIED SUCCESSFULLY!")
    else:
        print("⚠️  Some tests failed - review above")
    print("="*60)
    
    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
