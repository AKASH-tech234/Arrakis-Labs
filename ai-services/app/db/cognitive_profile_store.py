"""
Cognitive Profile Store - Persistent User Learning State
=========================================================

v3.2: This is the missing piece that makes profiles dynamic.

PROBLEM SOLVED:
- Previously: Profile was recomputed from raw submissions every time
- Now: Profile deltas are PERSISTED and ACCUMULATED over time

This store manages the `user_cognitive_profiles` collection in MongoDB.

Schema:
{
    "user_id": str,
    "mistake_counts": {
        "algorithm_choice": 4,
        "boundary_condition_blindness": 2,
        ...
    },
    "weak_topics": {
        "Binary Search": 3,
        "Dynamic Programming": 2,
        ...
    },
    "strong_topics": {
        "Arrays": 5,
        "Strings": 3,
        ...
    },
    "patterns": {
        "recurring_algorithm_choice": 3,
        ...
    },
    "current_skill_level": "Intermediate",
    "learning_velocity": "stable",
    "readiness_scores": {
        "Easy": 0.85,
        "Medium": 0.62,
        "Hard": 0.25
    },
    "last_mim_id": "mim_2854fccf4bb1",
    "last_mim_root_cause": "algorithm_choice",
    "total_submissions_processed": 25,
    "total_correct": 15,
    "updated_at": datetime,
    "created_at": datetime
}
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

logger = logging.getLogger("cognitive_profile_store")


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECTION NAME
# ═══════════════════════════════════════════════════════════════════════════════

COLLECTION_NAME = "user_cognitive_profiles"


# ═══════════════════════════════════════════════════════════════════════════════
# PROFILE SCHEMA (Default Structure)
# ═══════════════════════════════════════════════════════════════════════════════

def get_empty_profile(user_id: str) -> Dict[str, Any]:
    """Create empty profile structure for new users"""
    now = datetime.utcnow()
    return {
        "user_id": user_id,
        
        # Accumulated mistake counts by root cause
        "mistake_counts": {},
        
        # Weak topics with occurrence counts
        "weak_topics": {},
        
        # Strong topics with success counts  
        "strong_topics": {},
        
        # Recurring patterns detected
        "patterns": {},
        
        # Current assessed skill level
        "current_skill_level": "Beginner",
        
        # Learning velocity (accelerating, stable, decelerating, stalled)
        "learning_velocity": "stable",
        
        # Readiness scores per difficulty
        "readiness_scores": {
            "Easy": 0.5,
            "Medium": 0.3,
            "Hard": 0.1
        },
        
        # Focus areas recommended by learning agent
        "focus_areas": [],
        
        # Last MIM decision tracking
        "last_mim_id": None,
        "last_mim_root_cause": None,
        "last_mim_confidence": None,
        
        # Statistics
        "total_submissions_processed": 0,
        "total_correct": 0,
        "total_incorrect": 0,
        
        # Recent learning recommendations (last 3)
        "recent_learning_recs": [],
        
        # Recent difficulty adjustments (last 3)
        "recent_difficulty_actions": [],
        
        # Timestamps
        "created_at": now,
        "updated_at": now
    }


# ═══════════════════════════════════════════════════════════════════════════════
# LOAD PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

def load_cognitive_profile(user_id: str) -> Dict[str, Any]:
    """
    Load user's cognitive profile from MongoDB.
    
    Returns empty profile structure if user doesn't exist yet.
    """
    try:
        from app.db.mongodb import mongo_client
        
        if mongo_client.db is None:
            logger.warning(f"MongoDB not connected - returning empty profile for {user_id}")
            return get_empty_profile(user_id)
        
        profile = mongo_client.db[COLLECTION_NAME].find_one({"user_id": user_id})
        
        if profile:
            # Remove MongoDB _id for cleaner response
            profile.pop("_id", None)
            logger.info(f"✅ Loaded cognitive profile for user={user_id}")
            return profile
        else:
            logger.info(f"📝 No existing profile for user={user_id} - creating new")
            return get_empty_profile(user_id)
            
    except Exception as e:
        logger.error(f"❌ Failed to load cognitive profile: {e}")
        return get_empty_profile(user_id)


# ═══════════════════════════════════════════════════════════════════════════════
# SAVE/UPSERT PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

def save_cognitive_profile(profile: Dict[str, Any]) -> bool:
    """
    Upsert user's cognitive profile to MongoDB.
    
    Uses upsert to create if not exists, update if exists.
    """
    try:
        from app.db.mongodb import mongo_client
        
        if mongo_client.db is None:
            logger.warning("MongoDB not connected - cannot save profile")
            return False
        
        user_id = profile.get("user_id")
        if not user_id:
            logger.error("Profile missing user_id - cannot save")
            return False
        
        # Update timestamp
        profile["updated_at"] = datetime.utcnow()
        
        # Upsert operation
        result = mongo_client.db[COLLECTION_NAME].update_one(
            {"user_id": user_id},
            {"$set": profile},
            upsert=True
        )
        
        if result.upserted_id:
            logger.info(f"✅ Created new cognitive profile for user={user_id}")
        else:
            logger.info(f"✅ Updated cognitive profile for user={user_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to save cognitive profile: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# APPLY MIM DECISION (Delta Update)
# ═══════════════════════════════════════════════════════════════════════════════

def apply_mim_decision_to_profile(
    profile: Dict[str, Any],
    mim_decision: Any,
    verdict: str = "Wrong Answer"
) -> Dict[str, Any]:
    """
    Apply MIM decision deltas to cognitive profile.
    
    INCREMENTS counters, doesn't replace:
    - mistake_counts[root_cause] += 1
    - weak_topics[topic] += 1 (for user_weak_topics)
    - patterns[pattern_name] += recurrence_count
    
    Args:
        profile: Current cognitive profile dict
        mim_decision: MIMDecision object with predictions
        verdict: Submission verdict
        
    Returns:
        Updated profile dict (NOT saved yet - caller should save)
    """
    if mim_decision is None:
        return profile
    
    try:
        # Track MIM decision
        mim_id = getattr(mim_decision, 'decision_id', None)
        if mim_id:
            profile["last_mim_id"] = mim_id
        
        # Extract root cause
        root_cause = getattr(mim_decision, 'root_cause', None)
        if root_cause:
            profile["last_mim_root_cause"] = root_cause
            
            # Increment mistake count for this root cause
            if "mistake_counts" not in profile:
                profile["mistake_counts"] = {}
            profile["mistake_counts"][root_cause] = profile["mistake_counts"].get(root_cause, 0) + 1
            
            logger.info(f"📊 Mistake count for '{root_cause}': {profile['mistake_counts'][root_cause]}")
        
        # Extract confidence
        confidence = getattr(mim_decision, 'root_cause_confidence', None)
        if confidence is not None:
            profile["last_mim_confidence"] = confidence
        
        # Update weak topics from MIM
        weak_topics = getattr(mim_decision, 'user_weak_topics', []) or []
        if weak_topics:
            if "weak_topics" not in profile:
                profile["weak_topics"] = {}
            for topic in weak_topics:
                profile["weak_topics"][topic] = profile["weak_topics"].get(topic, 0) + 1
        
        # Update patterns from MIM
        pattern = getattr(mim_decision, 'pattern', None)
        if pattern:
            pattern_name = getattr(pattern, 'pattern_name', None)
            recurrence_count = getattr(pattern, 'recurrence_count', 0) or 0
            is_recurring = getattr(pattern, 'is_recurring', False)
            
            if pattern_name and is_recurring:
                if "patterns" not in profile:
                    profile["patterns"] = {}
                # Store the actual recurrence count, not just increment
                profile["patterns"][pattern_name] = max(
                    profile["patterns"].get(pattern_name, 0),
                    recurrence_count
                )
        
        # Update skill level from MIM
        skill_level = getattr(mim_decision, 'user_skill_level', None)
        if skill_level:
            profile["current_skill_level"] = skill_level
        
        # Update learning velocity from MIM
        velocity = getattr(mim_decision, 'learning_velocity', None)
        if velocity:
            profile["learning_velocity"] = velocity
        
        # Update readiness from difficulty action
        diff_action = getattr(mim_decision, 'difficulty_action', None)
        if diff_action:
            target_diff = getattr(diff_action, 'target_difficulty', None)
            success_prob = getattr(diff_action, 'success_probability', None)
            
            if target_diff and success_prob is not None:
                if "readiness_scores" not in profile:
                    profile["readiness_scores"] = {}
                # Blend with existing score (weighted average)
                existing = profile["readiness_scores"].get(target_diff, 0.5)
                profile["readiness_scores"][target_diff] = round(
                    (existing * 0.7 + success_prob * 0.3), 2
                )
        
        # Update focus areas from learning instruction
        learning_inst = getattr(mim_decision, 'learning_instruction', None)
        if learning_inst:
            focus_areas = getattr(learning_inst, 'focus_areas', []) or []
            if focus_areas:
                profile["focus_areas"] = focus_areas[:5]  # Keep top 5
        
        # Update submission counts
        profile["total_submissions_processed"] = profile.get("total_submissions_processed", 0) + 1
        
        if verdict.lower() == "accepted":
            profile["total_correct"] = profile.get("total_correct", 0) + 1
        else:
            profile["total_incorrect"] = profile.get("total_incorrect", 0) + 1
        
        logger.info(
            f"✅ Applied MIM decision to profile | "
            f"root_cause={root_cause} | "
            f"total_processed={profile['total_submissions_processed']}"
        )
        
    except Exception as e:
        logger.error(f"❌ Error applying MIM decision to profile: {e}")
    
    return profile


# ═══════════════════════════════════════════════════════════════════════════════
# APPLY LEARNING RECOMMENDATION (Delta Update)
# ═══════════════════════════════════════════════════════════════════════════════

def apply_learning_to_profile(
    profile: Dict[str, Any],
    learning_recommendation: Any
) -> Dict[str, Any]:
    """
    Apply learning agent output to cognitive profile.
    
    Stores recent learning recommendations for UI display.
    """
    if learning_recommendation is None:
        return profile
    
    try:
        # Extract learning data
        focus_areas = getattr(learning_recommendation, 'focus_areas', []) or []
        skill_gap = getattr(learning_recommendation, 'skill_gap', None)
        summary = getattr(learning_recommendation, 'summary', None)
        exercises = getattr(learning_recommendation, 'exercises', []) or []
        
        # Store as recent recommendation
        rec_entry = {
            "focus_areas": focus_areas[:3],
            "skill_gap": skill_gap,
            "summary": summary[:200] if summary else None,
            "exercises": exercises[:3],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if "recent_learning_recs" not in profile:
            profile["recent_learning_recs"] = []
        
        # Keep only last 3 recommendations
        profile["recent_learning_recs"].insert(0, rec_entry)
        profile["recent_learning_recs"] = profile["recent_learning_recs"][:3]
        
        # Update focus areas if provided
        if focus_areas:
            profile["focus_areas"] = focus_areas[:5]
        
        logger.info(f"✅ Applied learning recommendation | focus={focus_areas}")
        
    except Exception as e:
        logger.error(f"❌ Error applying learning to profile: {e}")
    
    return profile


# ═══════════════════════════════════════════════════════════════════════════════
# APPLY DIFFICULTY ADJUSTMENT (Delta Update)
# ═══════════════════════════════════════════════════════════════════════════════

def apply_difficulty_to_profile(
    profile: Dict[str, Any],
    difficulty_adjustment: Any
) -> Dict[str, Any]:
    """
    Apply difficulty adjustment to cognitive profile.
    
    Stores recent difficulty actions for trend analysis.
    """
    if difficulty_adjustment is None:
        return profile
    
    try:
        action = getattr(difficulty_adjustment, 'action', None)
        rationale = getattr(difficulty_adjustment, 'rationale', None)
        
        if action:
            # Store as recent difficulty action
            diff_entry = {
                "action": action,
                "rationale": rationale[:100] if rationale else None,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if "recent_difficulty_actions" not in profile:
                profile["recent_difficulty_actions"] = []
            
            # Keep only last 3 actions
            profile["recent_difficulty_actions"].insert(0, diff_entry)
            profile["recent_difficulty_actions"] = profile["recent_difficulty_actions"][:3]
            
            logger.info(f"✅ Applied difficulty adjustment | action={action}")
        
    except Exception as e:
        logger.error(f"❌ Error applying difficulty to profile: {e}")
    
    return profile


# ═══════════════════════════════════════════════════════════════════════════════
# APPLY CORRECT SUBMISSION (Increment Strong Topics)
# ═══════════════════════════════════════════════════════════════════════════════

def apply_correct_submission(
    profile: Dict[str, Any],
    category: str,
    difficulty: str
) -> Dict[str, Any]:
    """
    Apply a correct submission to the profile.
    
    Increments strong topics and adjusts readiness upward.
    """
    try:
        # Increment strong topics
        if category:
            if "strong_topics" not in profile:
                profile["strong_topics"] = {}
            profile["strong_topics"][category] = profile["strong_topics"].get(category, 0) + 1
        
        # Boost readiness for this difficulty
        if difficulty:
            if "readiness_scores" not in profile:
                profile["readiness_scores"] = {}
            existing = profile["readiness_scores"].get(difficulty, 0.5)
            # Boost by 5% on success, cap at 0.95
            profile["readiness_scores"][difficulty] = min(0.95, round(existing + 0.05, 2))
        
        # Update counts
        profile["total_submissions_processed"] = profile.get("total_submissions_processed", 0) + 1
        profile["total_correct"] = profile.get("total_correct", 0) + 1
        
        logger.info(f"✅ Applied correct submission | category={category} | difficulty={difficulty}")
        
    except Exception as e:
        logger.error(f"❌ Error applying correct submission: {e}")
    
    return profile


# ═══════════════════════════════════════════════════════════════════════════════
# PERSIST PROFILE (Main Entry Point for ASYNC Workflow)
# ═══════════════════════════════════════════════════════════════════════════════

def persist_cognitive_profile(
    user_id: str,
    mim_decision: Any = None,
    learning_recommendation: Any = None,
    difficulty_adjustment: Any = None,
    verdict: str = "Wrong Answer",
    category: str = None,
    difficulty: str = None
) -> bool:
    """
    Main entry point: Load profile, apply all deltas, save.
    
    Called from ASYNC workflow after learning/difficulty agents complete.
    
    Args:
        user_id: User identifier
        mim_decision: MIMDecision object (optional)
        learning_recommendation: LearningRecommendation object (optional)
        difficulty_adjustment: DifficultyAdjustment object (optional)
        verdict: Submission verdict
        category: Problem category (for correct submissions)
        difficulty: Problem difficulty (for correct submissions)
        
    Returns:
        True if profile was persisted successfully
    """
    logger.info(f"🔄 [PERSIST] Starting cognitive profile update for user={user_id}")
    
    # 1. Load existing profile
    profile = load_cognitive_profile(user_id)
    
    # 2. Apply all deltas
    if verdict.lower() == "accepted" and category:
        profile = apply_correct_submission(profile, category, difficulty)
    else:
        profile = apply_mim_decision_to_profile(profile, mim_decision, verdict)
    
    profile = apply_learning_to_profile(profile, learning_recommendation)
    profile = apply_difficulty_to_profile(profile, difficulty_adjustment)
    
    # 3. Save updated profile
    success = save_cognitive_profile(profile)
    
    if success:
        logger.info(
            f"✅ [PERSIST] Cognitive profile updated | "
            f"user={user_id} | "
            f"mistakes={sum(profile.get('mistake_counts', {}).values())} | "
            f"weak_topics={len(profile.get('weak_topics', {}))} | "
            f"patterns={len(profile.get('patterns', {}))}"
        )
    else:
        logger.error(f"❌ [PERSIST] Failed to persist cognitive profile for user={user_id}")
    
    return success


# ═══════════════════════════════════════════════════════════════════════════════
# GET PROFILE SUMMARY (For API Responses)
# ═══════════════════════════════════════════════════════════════════════════════

def get_profile_summary(user_id: str) -> Dict[str, Any]:
    """
    Get a clean summary of user's cognitive profile for API responses.
    
    This is what /ai/mim/profile should return.
    """
    profile = load_cognitive_profile(user_id)
    
    # Calculate derived values
    mistake_counts = profile.get("mistake_counts", {})
    total_mistakes = sum(mistake_counts.values())
    
    # Sort weak topics by count
    weak_topics = profile.get("weak_topics", {})
    sorted_weak = sorted(weak_topics.items(), key=lambda x: x[1], reverse=True)
    
    # Sort strong topics by count
    strong_topics = profile.get("strong_topics", {})
    sorted_strong = sorted(strong_topics.items(), key=lambda x: x[1], reverse=True)
    
    # Sort patterns by count
    patterns = profile.get("patterns", {})
    sorted_patterns = sorted(patterns.items(), key=lambda x: x[1], reverse=True)
    
    # Calculate success rate
    total_processed = profile.get("total_submissions_processed", 0)
    total_correct = profile.get("total_correct", 0)
    success_rate = (total_correct / total_processed * 100) if total_processed > 0 else 0
    
    # Get top mistake types
    sorted_mistakes = sorted(mistake_counts.items(), key=lambda x: x[1], reverse=True)
    
    return {
        # Core profile data
        "user_id": user_id,
        "skill_level": profile.get("current_skill_level", "Beginner"),
        "learning_velocity": profile.get("learning_velocity", "stable"),
        
        # Strengths and weaknesses (for CognitiveProfile.jsx)
        "strengths": [topic for topic, _ in sorted_strong[:5]],
        "weaknesses": [topic for topic, _ in sorted_weak[:5]],
        
        # Readiness scores (for difficulty display)
        "readiness_scores": profile.get("readiness_scores", {
            "Easy": 0.5, "Medium": 0.3, "Hard": 0.1
        }),
        
        # Learning trajectory (for trend display)
        "learning_trajectory": {
            "trend": _get_trend_from_velocity(profile.get("learning_velocity", "stable")),
            "total_submissions": total_processed,
            "success_rate": round(success_rate, 2),
            "total_correct": total_correct
        },
        
        # Detailed mistake analysis
        "mistake_analysis": {
            "total_mistakes": total_mistakes,
            "top_mistakes": [
                {"cause": cause, "count": count}
                for cause, count in sorted_mistakes[:5]
            ],
            "recurring_patterns": [
                {"pattern": pattern, "count": count}
                for pattern, count in sorted_patterns[:5]
            ]
        },
        
        # Focus areas (from learning agent)
        "focus_areas": profile.get("focus_areas", []),
        
        # Recent recommendations (for dynamic updates)
        "recent_learning": profile.get("recent_learning_recs", [])[:2],
        "recent_difficulty_actions": profile.get("recent_difficulty_actions", [])[:2],
        
        # Last MIM decision info
        "last_mim": {
            "id": profile.get("last_mim_id"),
            "root_cause": profile.get("last_mim_root_cause"),
            "confidence": profile.get("last_mim_confidence")
        },
        
        # Timestamps
        "profile_updated_at": profile.get("updated_at"),
        "is_persisted": True  # Flag to indicate this is from persistent store
    }


def _get_trend_from_velocity(velocity: str) -> str:
    """Convert learning velocity to user-friendly trend"""
    mapping = {
        "accelerating": "Improving",
        "stable": "Stable",
        "decelerating": "Needs attention",
        "stalled": "Stalled"
    }
    return mapping.get(velocity, "Building profile...")
