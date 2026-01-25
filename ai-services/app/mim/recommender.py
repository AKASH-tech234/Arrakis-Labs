"""
MIM Problem Recommender - Learning-to-Rank for Next Problem
============================================================

Uses LightGBM ranker to predict:
1. next_problem_success_probability
2. Relevance to user's weak areas
3. Optimal problem sequencing

This is a KEY DIFFERENTIATOR vs LeetCode/Codeforces.
"""

import numpy as np
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import os

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
    
from sklearn.ensemble import GradientBoostingClassifier
import joblib

logger = logging.getLogger("mim.recommender")


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS (imported later to avoid circular imports)
# ═══════════════════════════════════════════════════════════════════════════════

# Forward references - actual imports done in methods


class MIMRecommender:
    """
    Problem Recommendation Engine using Learning-to-Rank.
    
    Features for ranking:
    - User skill level vs problem difficulty
    - Topic alignment with weak areas
    - Historical success rate on similar problems
    - Time since last attempt on topic
    - Problem popularity/quality score
    
    Output:
    - Ranked list of next best problems
    - Success probability per problem
    - Reasoning for each recommendation
    """
    
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "recommender.joblib")
    
    def __init__(self):
        self.ranker: Optional[Any] = None
        self.success_predictor: Optional[GradientBoostingClassifier] = None
        self.is_trained = False
        self.feature_names = [
            # User features (from MIM profile)
            "user_skill_level",           # 0-7 (Beginner to Expert)
            "user_success_rate",          # 0-1
            "user_topic_success",         # Success rate on this topic
            "days_since_topic",           # Days since last attempt
            "user_streak",                # Current success streak
            "user_velocity",              # Learning velocity score
            # Problem features
            "problem_difficulty",         # 0-2 (Easy/Medium/Hard)
            "problem_popularity",         # Normalized attempt count
            "problem_ac_rate",            # Accept rate
            "problem_avg_attempts",       # Avg attempts to solve
            # Match features
            "skill_difficulty_gap",       # User skill - problem difficulty
            "topic_weakness_score",       # How weak user is on this topic
            "recency_bonus",              # Bonus for recently failed topic
        ]
        
        logger.info(f"MIMRecommender initialized | LightGBM available: {HAS_LIGHTGBM}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FEATURE EXTRACTION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def extract_features(
        self,
        user_profile: Dict[str, Any],
        problem: Dict[str, Any],
        user_history: List[Dict[str, Any]]
    ) -> np.ndarray:
        """Extract features for a (user, problem) pair."""
        features = np.zeros(len(self.feature_names), dtype=np.float32)
        
        # User features
        level_map = {
            "Beginner": 0, "Easy": 1, "Easy+": 2, "Medium": 3, 
            "Medium+": 4, "Hard": 5, "Hard+": 6, "Expert": 7
        }
        features[0] = level_map.get(user_profile.get("current_level", "Medium"), 3) / 7.0
        features[1] = user_profile.get("success_rate", 0.5)
        
        # Topic-specific success
        problem_tags = problem.get("tags", [])
        topic_successes = []
        topic_rates = user_profile.get("topic_success_rates", {})
        for tag in problem_tags:
            tag_rate = topic_rates.get(tag, topic_rates.get(tag.lower(), 0.5))
            topic_successes.append(tag_rate)
        features[2] = np.mean(topic_successes) if topic_successes else 0.5
        
        # Days since topic
        last_topic_attempt = self._get_last_topic_attempt(user_history, problem_tags)
        features[3] = min(last_topic_attempt / 30.0, 1.0)  # Normalize to 30 days
        
        features[4] = min(user_profile.get("current_streak", 0) / 10.0, 1.0)
        
        velocity_map = {"accelerating": 1.0, "stable": 0.5, "decelerating": 0.25, "stalled": 0.0}
        features[5] = velocity_map.get(user_profile.get("learning_velocity", "stable"), 0.5)
        
        # Problem features
        diff_map = {"easy": 0, "medium": 1, "hard": 2}
        prob_diff = problem.get("difficulty", "medium")
        if isinstance(prob_diff, str):
            prob_diff = prob_diff.lower()
        features[6] = diff_map.get(prob_diff, 1) / 2.0
        features[7] = min(problem.get("attempt_count", 100) / 10000, 1.0)
        features[8] = problem.get("acceptance_rate", problem.get("ac_rate", 0.5))
        features[9] = min(problem.get("avg_attempts", 3) / 10.0, 1.0)
        
        # Match features
        features[10] = features[0] - features[6]  # Skill-difficulty gap
        features[11] = 1.0 - features[2]  # Topic weakness (inverse of success)
        features[12] = 1.0 if features[3] < 0.2 else 0.0  # Recent failure bonus
        
        return features
    
    def _get_last_topic_attempt(self, history: List[Dict], tags: List[str]) -> int:
        """Get days since last attempt on any of the given topics."""
        if not history or not tags:
            return 30  # Default to 30 days
        
        tags_set = set(t.lower() for t in tags)
        for sub in history:
            sub_tags = sub.get("tags", [])
            if isinstance(sub_tags, str):
                sub_tags = [sub_tags]
            sub_tags_lower = set(t.lower() for t in sub_tags)
            
            if tags_set & sub_tags_lower:  # Intersection
                created = sub.get("created_at", sub.get("createdAt"))
                if created:
                    try:
                        if isinstance(created, str):
                            from dateutil.parser import parse
                            created = parse(created)
                        days = (datetime.now() - created).days
                        return max(0, days)
                    except:
                        pass
        return 30
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TRAINING
    # ═══════════════════════════════════════════════════════════════════════════
    
    def train(
        self,
        training_data: List[Dict[str, Any]],
        validation_split: float = 0.2
    ) -> Dict[str, float]:
        """
        Train the recommender model.
        
        training_data format:
        [
            {
                "user_profile": {...},
                "problem": {...},
                "user_history": [...],
                "label": 1/0 (solved within 5 attempts)
            },
            ...
        ]
        """
        if len(training_data) < 50:
            logger.warning(f"Insufficient training data: {len(training_data)} samples")
            return {"error": "insufficient_data", "samples": len(training_data)}
        
        logger.info(f"Training recommender with {len(training_data)} samples...")
        
        # Extract features
        X = []
        y = []
        for sample in training_data:
            features = self.extract_features(
                sample["user_profile"],
                sample["problem"],
                sample.get("user_history", [])
            )
            X.append(features)
            y.append(sample.get("label", 0))
        
        X = np.array(X)
        y = np.array(y)
        
        # Shuffle
        indices = np.random.permutation(len(X))
        X, y = X[indices], y[indices]
        
        # Split
        split_idx = int(len(X) * (1 - validation_split))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # Train success predictor (primary model)
        self.success_predictor = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.success_predictor.fit(X_train, y_train)
        
        # Train LightGBM ranker if available
        if HAS_LIGHTGBM:
            try:
                self.ranker = lgb.LGBMRanker(
                    objective="lambdarank",
                    n_estimators=100,
                    num_leaves=31,
                    learning_rate=0.1,
                    random_state=42,
                )
                # For ranking, we need query groups
                # Simplified: treat each sample as own group
                group_train = [1] * len(X_train)
                group_val = [1] * len(X_val)
                self.ranker.fit(
                    X_train, y_train,
                    group=group_train,
                    eval_set=[(X_val, y_val)],
                    eval_group=[group_val],
                )
                logger.info("✅ LightGBM ranker trained successfully")
            except Exception as e:
                logger.warning(f"LightGBM ranker failed, using GradientBoosting fallback: {e}")
                self.ranker = None
        
        self.is_trained = True
        
        # Evaluate
        from sklearn.metrics import accuracy_score, roc_auc_score
        y_pred = self.success_predictor.predict(X_val)
        y_proba = self.success_predictor.predict_proba(X_val)[:, 1]
        
        metrics = {
            "accuracy": float(accuracy_score(y_val, y_pred)),
            "roc_auc": float(roc_auc_score(y_val, y_proba)) if len(np.unique(y_val)) > 1 else 0.0,
            "training_samples": len(X_train),
            "validation_samples": len(X_val),
            "has_ranker": self.ranker is not None,
        }
        
        # Save model
        self.save()
        
        logger.info(f"✅ Recommender trained | acc={metrics['accuracy']:.3f} | auc={metrics['roc_auc']:.3f}")
        return metrics
    
    # ═══════════════════════════════════════════════════════════════════════════
    # RECOMMENDATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def recommend(
        self,
        user_profile: Dict[str, Any],
        candidate_problems: List[Dict[str, Any]],
        user_history: List[Dict[str, Any]],
        top_k: int = 10
    ) -> "MIMRecommendations":
        """
        Generate ranked problem recommendations.
        """
        from app.mim.schemas import MIMProblemRecommendation, MIMRecommendations
        
        if not candidate_problems:
            return MIMRecommendations(
                user_id=user_profile.get("user_id", ""),
                recommendations=[],
                model_version="v2.0-empty",
            )
        
        if not self.is_trained:
            return self._fallback_recommendations(user_profile, candidate_problems, top_k)
        
        # Filter out already solved problems
        solved_ids = set()
        for h in user_history:
            if h.get("status") == "accepted":
                solved_ids.add(h.get("problem_id", h.get("problemId", "")))
        
        candidate_problems = [p for p in candidate_problems 
                            if p.get("id", p.get("problem_id", "")) not in solved_ids]
        
        if not candidate_problems:
            return MIMRecommendations(
                user_id=user_profile.get("user_id", ""),
                recommendations=[],
                focus_topics=user_profile.get("weak_topics", [])[:5],
                model_version="v2.0-all-solved",
            )
        
        # Score all candidates
        scored_problems = []
        for problem in candidate_problems:
            features = self.extract_features(user_profile, problem, user_history)
            
            # Predict success probability
            if self.success_predictor:
                try:
                    success_prob = float(self.success_predictor.predict_proba(features.reshape(1, -1))[0, 1])
                except:
                    success_prob = 0.5
            else:
                success_prob = 0.5
            
            # Calculate relevance (alignment with weak areas)
            weak_topics = set(t.lower() for t in user_profile.get("weak_topics", []))
            problem_tags = set(t.lower() for t in problem.get("tags", []))
            topic_overlap = len(weak_topics & problem_tags) / max(len(weak_topics), 1)
            relevance = topic_overlap * 0.6 + (1 - features[2]) * 0.4  # Topic weakness
            
            # Combined score: balance success probability with learning value
            # Sweet spot: 50-70% success probability for optimal learning
            learning_optimal = 1.0 - abs(success_prob - 0.6) * 2  # Peak at 60%
            score = learning_optimal * 0.4 + relevance * 0.4 + success_prob * 0.2
            
            scored_problems.append({
                "problem": problem,
                "success_probability": success_prob,
                "relevance_score": float(relevance),
                "combined_score": float(score),
            })
        
        # Sort by combined score
        scored_problems.sort(key=lambda x: x["combined_score"], reverse=True)
        
        # Build recommendations
        recommendations = []
        for rank, item in enumerate(scored_problems[:top_k], 1):
            prob = item["problem"]
            reasoning = self._generate_reasoning(
                user_profile, prob, item["success_probability"], item["relevance_score"]
            )
            recommendations.append(MIMProblemRecommendation(
                problem_id=prob.get("id", prob.get("problem_id", "")),
                title=prob.get("title", prob.get("name", "Unknown")),
                difficulty=prob.get("difficulty", "Medium"),
                tags=prob.get("tags", []),
                success_probability=item["success_probability"],
                relevance_score=item["relevance_score"],
                rank=rank,
                reasoning=reasoning,
            ))
        
        # Determine focus topics
        weak_topics = user_profile.get("weak_topics", [])[:5]
        strong_topics = user_profile.get("strengths", [])[:3]
        
        return MIMRecommendations(
            user_id=user_profile.get("user_id", ""),
            recommendations=recommendations,
            focus_topics=weak_topics,
            avoid_topics=strong_topics,
            model_version="v2.0",
        )
    
    def _fallback_recommendations(
        self,
        user_profile: Dict[str, Any],
        problems: List[Dict[str, Any]],
        top_k: int
    ) -> "MIMRecommendations":
        """Fallback when model not trained."""
        from app.mim.schemas import MIMProblemRecommendation, MIMRecommendations
        
        # Simple heuristic: match difficulty, prioritize weak topics
        level = user_profile.get("current_level", "Medium")
        level_to_diff = {
            "Beginner": "easy", "Easy": "easy", "Easy+": "easy",
            "Medium": "medium", "Medium+": "medium",
            "Hard": "hard", "Hard+": "hard", "Expert": "hard"
        }
        target_diff = level_to_diff.get(level, "medium")
        
        # Filter and score
        weak_topics = set(t.lower() for t in user_profile.get("weak_topics", []))
        scored = []
        for prob in problems:
            prob_diff = prob.get("difficulty", "medium")
            if isinstance(prob_diff, str):
                prob_diff = prob_diff.lower()
            diff_match = 1.0 if prob_diff == target_diff else 0.5
            
            prob_tags = set(t.lower() for t in prob.get("tags", []))
            topic_match = len(weak_topics & prob_tags) / max(len(weak_topics), 1)
            score = diff_match * 0.6 + topic_match * 0.4
            scored.append((prob, score))
        
        scored.sort(key=lambda x: x[1], reverse=True)
        
        recommendations = []
        for rank, (prob, score) in enumerate(scored[:top_k], 1):
            recommendations.append(MIMProblemRecommendation(
                problem_id=prob.get("id", prob.get("problem_id", "")),
                title=prob.get("title", prob.get("name", "Unknown")),
                difficulty=prob.get("difficulty", "Medium"),
                tags=prob.get("tags", []),
                success_probability=0.5,  # Unknown
                relevance_score=score,
                rank=rank,
                reasoning="Matched by difficulty and topic alignment (fallback mode)",
            ))
        
        return MIMRecommendations(
            user_id=user_profile.get("user_id", ""),
            recommendations=recommendations,
            focus_topics=list(weak_topics)[:5],
            avoid_topics=[],
            model_version="v2.0-fallback",
        )
    
    def _generate_reasoning(
        self,
        user_profile: Dict,
        problem: Dict,
        success_prob: float,
        relevance: float
    ) -> str:
        """Generate human-readable reasoning for recommendation."""
        reasons = []
        
        if 0.5 <= success_prob <= 0.7:
            reasons.append("Optimal challenge level for learning")
        elif success_prob > 0.7:
            reasons.append("High confidence - good for building momentum")
        elif success_prob > 0.3:
            reasons.append("Stretching problem for growth")
        else:
            reasons.append("Challenging - consider prerequisites first")
        
        weak_topics = set(t.lower() for t in user_profile.get("weak_topics", []))
        prob_tags = set(t.lower() for t in problem.get("tags", []))
        matching_weak = weak_topics & prob_tags
        if matching_weak:
            reasons.append(f"Targets weak area: {', '.join(list(matching_weak)[:2])}")
        
        if relevance > 0.7:
            reasons.append("Highly relevant to learning goals")
        
        return "; ".join(reasons) if reasons else "General recommendation"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ENHANCED MULTI-FACTOR SCORING (V2.1)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def compute_enhanced_score(
        self,
        user_profile: Dict[str, Any],
        problem: Dict[str, Any],
        user_history: List[Dict[str, Any]],
        recently_solved_problems: set = None,
    ) -> Dict[str, Any]:
        """
        Compute enhanced multi-factor recommendation score.
        
        Score = (Concept Relevance × 0.35)
              + (Difficulty Fit × 0.30)
              + (Learning Gap Coverage × 0.20)
              + (Recency/Spacing × 0.10)
              + (Exploration Bonus × 0.05)
        
        Returns dict with total_score, breakdown, why, and expected_outcome.
        """
        if recently_solved_problems is None:
            recently_solved_problems = set()
            for h in user_history[:20]:
                if h.get("verdict", h.get("status", "")).lower() == "accepted":
                    recently_solved_problems.add(h.get("problem_id", ""))
        
        # 1. Concept Relevance (0.35)
        weak_topics = set(t.lower() for t in user_profile.get("weak_topics", user_profile.get("weakTopics", [])))
        strong_topics = set(t.lower() for t in user_profile.get("strong_topics", user_profile.get("strongTopics", [])))
        problem_tags = set(t.lower() for t in problem.get("tags", []))
        
        # Score higher for weak topics, lower for already mastered topics
        weak_overlap = len(weak_topics & problem_tags) / max(len(weak_topics), 1)
        strong_overlap = len(strong_topics & problem_tags) / max(len(strong_topics), 1)
        concept_relevance = weak_overlap * 0.8 + (1 - strong_overlap) * 0.2
        concept_relevance = min(1.0, concept_relevance)
        
        # 2. Difficulty Fit (0.30)
        user_readiness = user_profile.get("difficultyReadiness", user_profile.get("difficulty_readiness", {}))
        if isinstance(user_readiness, dict):
            easy_ready = user_readiness.get("easy", 1.0)
            medium_ready = user_readiness.get("medium", 0.5)
            hard_ready = user_readiness.get("hard", 0.2)
        else:
            easy_ready, medium_ready, hard_ready = 1.0, 0.5, 0.2
        
        problem_diff = problem.get("difficulty", "Medium").lower()
        readiness_map = {"easy": easy_ready, "medium": medium_ready, "hard": hard_ready}
        user_readiness_for_diff = readiness_map.get(problem_diff, 0.5)
        
        # Optimal zone: 40-70% readiness (not too easy, not too hard)
        if 0.4 <= user_readiness_for_diff <= 0.7:
            difficulty_fit = 1.0
        elif user_readiness_for_diff > 0.7:
            difficulty_fit = 0.7 + (1.0 - user_readiness_for_diff)  # Slightly penalize too easy
        else:
            difficulty_fit = user_readiness_for_diff / 0.4  # Scale up from 0
        
        # 3. Learning Gap Coverage (0.20)
        # Check if problem covers a topic user hasn't practiced recently
        recent_categories = set(
            (h.get("category", h.get("problemCategory", "")).lower())
            for h in user_history[:10]
        )
        problem_topic = problem.get("topic", problem_tags.pop() if problem_tags else "general").lower()
        
        gap_coverage = 0.0
        if problem_topic not in recent_categories:
            gap_coverage = 0.8  # High value for unexplored topic
        if problem_topic in weak_topics:
            gap_coverage = 1.0  # Maximum for weak + not recent
        
        # 4. Recency/Spacing (0.10)
        # Apply spaced repetition: problems not seen for a while get bonus
        problem_id = problem.get("id", problem.get("problem_id", ""))
        days_since_attempt = self._get_days_since_problem(user_history, problem_id)
        
        if days_since_attempt is None:
            spacing_score = 0.5  # Never attempted - neutral
        elif days_since_attempt < 1:
            spacing_score = 0.0  # Just attempted - skip
        elif days_since_attempt < 7:
            spacing_score = 0.3
        elif days_since_attempt < 30:
            spacing_score = 0.7
        else:
            spacing_score = 1.0  # Long time - good for review
        
        # 5. Exploration Bonus (0.05)
        # Bonus for trying new topics/patterns
        all_attempted_tags = set()
        for h in user_history:
            all_attempted_tags.update(t.lower() for t in h.get("tags", h.get("problemTags", [])))
        
        new_tags = problem_tags - all_attempted_tags
        exploration_bonus = min(len(new_tags) / 3, 1.0)  # Max at 3 new tags
        
        # Weighted total
        total_score = (
            concept_relevance * 0.35 +
            difficulty_fit * 0.30 +
            gap_coverage * 0.20 +
            spacing_score * 0.10 +
            exploration_bonus * 0.05
        )
        
        # Determine fit assessment
        if 0.85 <= difficulty_fit <= 1.0:
            difficulty_fit_label = "perfect"
        elif difficulty_fit > 0.7:
            difficulty_fit_label = "slightly_easy" if user_readiness_for_diff > 0.7 else "slightly_hard"
        else:
            difficulty_fit_label = "challenging"
        
        # Generate explanation
        why_parts = []
        if concept_relevance > 0.6:
            matching = weak_topics & problem_tags
            if matching:
                why_parts.append(f"Reinforces weak area: {', '.join(list(matching)[:2])}")
        if difficulty_fit >= 0.8:
            why_parts.append(f"Optimal {problem_diff} challenge for your level")
        if gap_coverage > 0.5:
            why_parts.append("Covers learning gap")
        if exploration_bonus > 0.3:
            why_parts.append("Introduces new concepts")
        
        why = "; ".join(why_parts) if why_parts else "Balanced recommendation"
        
        # Expected outcome
        if concept_relevance > 0.6 and difficulty_fit > 0.6:
            expected = f"Improve {', '.join(list(weak_topics & problem_tags)[:2]) or problem_diff} skills"
        elif exploration_bonus > 0.5:
            expected = "Expand problem-solving repertoire"
        else:
            expected = "Maintain momentum and practice consistency"
        
        return {
            "total_score": round(total_score, 3),
            "score_breakdown": {
                "concept_relevance": round(concept_relevance, 3),
                "difficulty_fit": round(difficulty_fit, 3),
                "learning_gap": round(gap_coverage, 3),
                "spacing": round(spacing_score, 3),
                "exploration": round(exploration_bonus, 3),
            },
            "why": why,
            "expected_outcome": expected,
            "difficulty_fit_label": difficulty_fit_label,
        }
    
    def _get_days_since_problem(self, history: List[Dict], problem_id: str) -> Optional[int]:
        """Get days since user last attempted this specific problem."""
        if not problem_id:
            return None
        
        for sub in history:
            sub_problem_id = sub.get("problem_id", sub.get("problemId", ""))
            if sub_problem_id == problem_id:
                created = sub.get("created_at", sub.get("createdAt"))
                if created:
                    try:
                        if isinstance(created, str):
                            from dateutil.parser import parse
                            created = parse(created)
                        return max(0, (datetime.now() - created).days)
                    except:
                        pass
        return None  # Never attempted
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PERSISTENCE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def save(self):
        """Save model to disk."""
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        joblib.dump({
            "success_predictor": self.success_predictor,
            "ranker": self.ranker,
            "is_trained": self.is_trained,
            "feature_names": self.feature_names,
            "saved_at": datetime.now().isoformat(),
        }, self.MODEL_PATH)
        logger.info(f"💾 Recommender saved to {self.MODEL_PATH}")
    
    def load(self) -> bool:
        """Load model from disk."""
        if not os.path.exists(self.MODEL_PATH):
            logger.info("No saved recommender found - will use fallback mode")
            return False
        
        try:
            data = joblib.load(self.MODEL_PATH)
            self.success_predictor = data.get("success_predictor")
            self.ranker = data.get("ranker")
            self.is_trained = data.get("is_trained", False)
            logger.info(f"✅ Recommender loaded | trained={self.is_trained}")
            return True
        except Exception as e:
            logger.error(f"Failed to load recommender: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════════════════════

_recommender_instance: Optional[MIMRecommender] = None


def get_recommender() -> MIMRecommender:
    """Get singleton recommender instance."""
    global _recommender_instance
    if _recommender_instance is None:
        _recommender_instance = MIMRecommender()
        _recommender_instance.load()
    return _recommender_instance
