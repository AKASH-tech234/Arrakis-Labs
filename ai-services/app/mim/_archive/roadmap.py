"""
MIM Roadmap Generator
=====================

Generates personalized learning roadmaps with:
- 5-step micro-roadmap for immediate action
- Topic dependency graph derived from co-occurrence
- Milestone tracking
- Long-term trajectory estimation

This is what makes Arrakis unique:
- LeetCode: Static difficulty buckets
- Codeforces: Elo-based rating
- Arrakis + MIM: Cognitive trajectory modeling
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class RoadmapStep:
    """Single step in the micro-roadmap."""
    step_number: int
    goal: str
    target_problems: int
    completed_problems: int = 0
    focus_topics: List[str] = field(default_factory=list)
    target_difficulty: str = "Medium"
    status: str = "pending"  # pending, in_progress, completed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        return {
            "stepNumber": self.step_number,
            "goal": self.goal,
            "targetProblems": self.target_problems,
            "completedProblems": self.completed_problems,
            "focusTopics": self.focus_topics,
            "targetDifficulty": self.target_difficulty,
            "status": self.status,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class Milestone:
    """Learning milestone achievement."""
    name: str
    description: str
    achieved_at: datetime
    evidence: str
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "description": self.description,
            "achievedAt": self.achieved_at.isoformat(),
            "evidence": self.evidence,
        }


@dataclass
class LearningRoadmap:
    """Complete learning roadmap for a user."""
    user_id: str
    current_phase: str  # foundation, skill_building, consolidation, advancement, mastery
    steps: List[RoadmapStep]
    topic_dependencies: Dict[str, List[str]]  # topic -> prerequisites
    milestones: List[Milestone]
    target_level: str
    estimated_weeks_to_target: Optional[int]
    difficulty_adjustment: Dict
    generated_at: datetime
    version: str = "v2.0"
    
    def to_dict(self) -> Dict:
        return {
            "userId": self.user_id,
            "currentPhase": self.current_phase,
            "steps": [s.to_dict() for s in self.steps],
            "topicDependencies": self.topic_dependencies,
            "milestones": [m.to_dict() for m in self.milestones],
            "targetLevel": self.target_level,
            "estimatedWeeksToTarget": self.estimated_weeks_to_target,
            "difficultyAdjustment": self.difficulty_adjustment,
            "generatedAt": self.generated_at.isoformat(),
            "version": self.version,
        }


class TopicDependencyGraph:
    """
    Builds topic dependencies from problem co-occurrence patterns.
    
    If users who solved topic A successfully tend to solve topic B,
    then A is likely a prerequisite for B.
    """
    
    # Hardcoded core dependencies (foundational CS topics)
    CORE_DEPENDENCIES = {
        "Dynamic Programming": ["Arrays", "Recursion", "Math"],
        "Graph": ["Arrays", "Trees", "BFS/DFS"],
        "Trees": ["Arrays", "Recursion"],
        "Binary Search": ["Arrays", "Sorting"],
        "Two Pointers": ["Arrays", "Sorting"],
        "Sliding Window": ["Arrays", "Two Pointers"],
        "Heap": ["Arrays", "Trees"],
        "Trie": ["Trees", "Strings"],
        "Backtracking": ["Recursion", "Arrays"],
        "Greedy": ["Arrays", "Sorting"],
        "Stack": ["Arrays"],
        "Queue": ["Arrays"],
        "Linked List": ["Arrays"],
        "Hash Table": ["Arrays"],
        "Bit Manipulation": ["Math"],
        "Math": [],
        "Strings": ["Arrays"],
        "Arrays": [],
        "Recursion": ["Arrays"],
        "Sorting": ["Arrays"],
        "BFS/DFS": ["Arrays", "Recursion", "Graph Basics"],
    }
    
    def __init__(self):
        self.co_occurrence = defaultdict(lambda: defaultdict(int))
        self.topic_success = defaultdict(lambda: {"success": 0, "total": 0})
        
    def update_from_submissions(self, submissions: List[Dict]) -> None:
        """
        Update co-occurrence patterns from user submissions.
        
        Track which topics are solved together and in what order.
        """
        # Sort by timestamp
        sorted_subs = sorted(
            submissions,
            key=lambda x: x.get("created_at", datetime.min)
        )
        
        # Track topics solved in order
        solved_topics = []
        for sub in sorted_subs:
            if sub.get("verdict", "").lower() == "accepted":
                topic = sub.get("category") or sub.get("problem_category")
                if topic and topic != "General":
                    # Update success
                    self.topic_success[topic]["success"] += 1
                    self.topic_success[topic]["total"] += 1
                    
                    # Update co-occurrence with previously solved topics
                    for prev_topic in solved_topics[-5:]:  # Last 5 solved
                        if prev_topic != topic:
                            self.co_occurrence[topic][prev_topic] += 1
                    
                    if topic not in solved_topics:
                        solved_topics.append(topic)
            else:
                topic = sub.get("category") or sub.get("problem_category")
                if topic:
                    self.topic_success[topic]["total"] += 1
    
    def get_dependencies(self, target_topic: str) -> List[str]:
        """
        Get prerequisite topics for a target topic.
        
        Combines hardcoded dependencies with learned co-occurrence.
        """
        # Start with core dependencies
        deps = list(self.CORE_DEPENDENCIES.get(target_topic, []))
        
        # Add learned dependencies (topics frequently solved before target)
        if target_topic in self.co_occurrence:
            co_occurring = self.co_occurrence[target_topic]
            # Topics that appear frequently before this topic
            learned_deps = sorted(
                co_occurring.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]  # Top 3 co-occurring
            
            for topic, count in learned_deps:
                if topic not in deps and count >= 2:  # At least 2 co-occurrences
                    deps.append(topic)
        
        return deps
    
    def build_full_graph(self, topics: List[str]) -> Dict[str, List[str]]:
        """Build complete dependency graph for given topics."""
        graph = {}
        for topic in topics:
            graph[topic] = self.get_dependencies(topic)
        return graph


class RoadmapGenerator:
    """
    Generates personalized learning roadmaps.
    
    Key features:
    - 5-step micro-roadmap for immediate action
    - Topic sequencing based on dependencies
    - Adaptive goals based on user state
    """
    
    # Learning phases
    PHASES = {
        "foundation": {"min_solved": 0, "target_difficulty": "Easy"},
        "skill_building": {"min_solved": 10, "target_difficulty": "Easy"},
        "consolidation": {"min_solved": 30, "target_difficulty": "Medium"},
        "advancement": {"min_solved": 75, "target_difficulty": "Medium"},
        "mastery": {"min_solved": 150, "target_difficulty": "Hard"},
    }
    
    # Goal templates for each phase
    GOAL_TEMPLATES = {
        "foundation": [
            ("Build problem-solving fundamentals", 3, ["Arrays", "Strings"]),
            ("Practice basic patterns", 2, ["Arrays", "Math"]),
            ("Strengthen core concepts", 2, ["Strings", "Hash Table"]),
            ("Introduce simple algorithms", 2, ["Sorting", "Searching"]),
            ("Consolidate basics", 1, None),  # Mixed
        ],
        "skill_building": [
            ("Master array techniques", 2, ["Arrays", "Two Pointers"]),
            ("Learn efficient searching", 2, ["Binary Search"]),
            ("Practice string manipulation", 2, ["Strings"]),
            ("Understand data structures", 2, ["Stack", "Queue"]),
            ("Mixed concept practice", 2, None),
        ],
        "consolidation": [
            ("Stabilize weak areas", 2, None),  # From weak_topics
            ("Speed optimization focus", 2, None),
            ("Edge case mastery", 2, None),
            ("Pattern recognition", 2, None),
            ("Difficulty increase prep", 2, None),
        ],
        "advancement": [
            ("Tackle intermediate algorithms", 2, ["Dynamic Programming", "Graph"]),
            ("Advanced data structures", 2, ["Trees", "Heap"]),
            ("Complex problem solving", 2, None),
            ("Optimization techniques", 2, None),
            ("Challenge mode", 2, None),
        ],
        "mastery": [
            ("Expert-level problems", 2, ["Dynamic Programming"]),
            ("Advanced graph algorithms", 2, ["Graph"]),
            ("System design thinking", 2, None),
            ("Competition preparation", 2, None),
            ("Mastery certification", 2, None),
        ],
    }
    
    def __init__(self):
        self.dependency_graph = TopicDependencyGraph()
    
    def generate_roadmap(
        self,
        user_id: str,
        submissions: List[Dict],
        user_profile: Dict,
        difficulty_adjustment: Dict,
        existing_roadmap: Optional[Dict] = None,
    ) -> LearningRoadmap:
        """
        Generate or update a learning roadmap for the user.
        
        Args:
            user_id: User identifier
            submissions: User's submission history
            user_profile: AI profile with weak_topics, strong_topics, etc.
            difficulty_adjustment: Output from difficulty engine
            existing_roadmap: Previous roadmap to update (if any)
            
        Returns:
            Complete LearningRoadmap
        """
        # Update dependency graph with user's submissions
        self.dependency_graph.update_from_submissions(submissions)
        
        # Determine current phase
        total_solved = sum(
            1 for s in submissions 
            if s.get("verdict", "").lower() == "accepted"
        )
        current_phase = self._determine_phase(total_solved)
        
        # Get weak and strong topics from profile
        weak_topics = user_profile.get("weakTopics", []) or user_profile.get("weak_topics", [])
        strong_topics = user_profile.get("strongTopics", []) or user_profile.get("strong_topics", [])
        
        # Generate or update steps
        if existing_roadmap and self._should_update_steps(existing_roadmap, submissions):
            steps = self._update_steps(existing_roadmap, submissions, weak_topics, difficulty_adjustment)
        else:
            steps = self._generate_steps(
                current_phase, weak_topics, strong_topics, difficulty_adjustment
            )
        
        # Build topic dependencies
        all_topics = set()
        for step in steps:
            all_topics.update(step.focus_topics)
        all_topics.update(weak_topics)
        topic_dependencies = self.dependency_graph.build_full_graph(list(all_topics))
        
        # Check for new milestones
        milestones = self._check_milestones(
            submissions, 
            existing_roadmap.get("milestones", []) if existing_roadmap else []
        )
        
        # Estimate time to target
        target_level = user_profile.get("targetLevel", "Medium")
        weeks_estimate = self._estimate_weeks_to_target(
            current_phase, target_level, user_profile.get("successRate", 0.5)
        )
        
        return LearningRoadmap(
            user_id=user_id,
            current_phase=current_phase,
            steps=steps,
            topic_dependencies=topic_dependencies,
            milestones=milestones,
            target_level=target_level,
            estimated_weeks_to_target=weeks_estimate,
            difficulty_adjustment=difficulty_adjustment,
            generated_at=datetime.now(),
        )
    
    def _determine_phase(self, total_solved: int) -> str:
        """Determine learning phase based on problems solved."""
        for phase, criteria in reversed(list(self.PHASES.items())):
            if total_solved >= criteria["min_solved"]:
                return phase
        return "foundation"
    
    def _generate_steps(
        self,
        phase: str,
        weak_topics: List[str],
        strong_topics: List[str],
        difficulty_adjustment: Dict,
    ) -> List[RoadmapStep]:
        """Generate fresh 5-step roadmap for current phase."""
        templates = self.GOAL_TEMPLATES.get(phase, self.GOAL_TEMPLATES["foundation"])
        target_difficulty = difficulty_adjustment.get("next_difficulty", "Easy")
        
        steps = []
        for i, (goal, problems, topics) in enumerate(templates, 1):
            # Customize topics based on weak areas
            if topics is None:
                # Use weak topics if available
                focus = weak_topics[:2] if weak_topics else ["General"]
            else:
                # Prefer weak topics that match template topics
                focus = []
                for t in topics:
                    if t in weak_topics:
                        focus.insert(0, t)  # Prioritize weak
                    else:
                        focus.append(t)
                focus = focus[:2]
            
            # Adjust difficulty for first steps if frustration high
            step_difficulty = target_difficulty
            if i <= 2 and difficulty_adjustment.get("frustration_index", 0) > 0.5:
                step_difficulty = self._lower_difficulty(target_difficulty)
            
            steps.append(RoadmapStep(
                step_number=i,
                goal=goal,
                target_problems=problems,
                focus_topics=focus,
                target_difficulty=step_difficulty,
                status="pending" if i > 1 else "in_progress",
                started_at=datetime.now() if i == 1 else None,
            ))
        
        return steps
    
    def _update_steps(
        self,
        existing_roadmap: Dict,
        submissions: List[Dict],
        weak_topics: List[str],
        difficulty_adjustment: Dict,
    ) -> List[RoadmapStep]:
        """Update existing steps based on new submissions."""
        existing_steps = existing_roadmap.get("steps", [])
        
        # Count recent successful submissions
        recent_accepts = sum(
            1 for s in submissions[:10]
            if s.get("verdict", "").lower() == "accepted"
        )
        
        updated_steps = []
        for step_data in existing_steps:
            step = RoadmapStep(
                step_number=step_data.get("stepNumber", 1),
                goal=step_data.get("goal", ""),
                target_problems=step_data.get("targetProblems", 2),
                completed_problems=step_data.get("completedProblems", 0),
                focus_topics=step_data.get("focusTopics", []),
                target_difficulty=step_data.get("targetDifficulty", "Easy"),
                status=step_data.get("status", "pending"),
            )
            
            # Update in-progress step
            if step.status == "in_progress":
                # Check if problems in focus topics were solved
                focus_accepts = sum(
                    1 for s in submissions[:5]
                    if s.get("verdict", "").lower() == "accepted"
                    and (s.get("category") in step.focus_topics or 
                         s.get("problem_category") in step.focus_topics or
                         not step.focus_topics)
                )
                
                step.completed_problems = min(
                    step.completed_problems + focus_accepts,
                    step.target_problems
                )
                
                if step.completed_problems >= step.target_problems:
                    step.status = "completed"
                    step.completed_at = datetime.now()
            
            updated_steps.append(step)
        
        # Activate next step if current completed
        for i, step in enumerate(updated_steps):
            if step.status == "completed" and i + 1 < len(updated_steps):
                if updated_steps[i + 1].status == "pending":
                    updated_steps[i + 1].status = "in_progress"
                    updated_steps[i + 1].started_at = datetime.now()
                    break
        
        return updated_steps
    
    def _should_update_steps(self, existing_roadmap: Dict, submissions: List[Dict]) -> bool:
        """Check if we should update steps or regenerate."""
        steps = existing_roadmap.get("steps", [])
        
        # Regenerate if all steps completed
        if all(s.get("status") == "completed" for s in steps):
            return False  # Regenerate
        
        # Regenerate if roadmap is old (>7 days)
        generated_at = existing_roadmap.get("generatedAt")
        if generated_at:
            try:
                gen_time = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
                if (datetime.now() - gen_time).days > 7:
                    return False  # Regenerate
            except:
                pass
        
        return True  # Update existing
    
    def _check_milestones(
        self,
        submissions: List[Dict],
        existing_milestones: List[Dict],
    ) -> List[Milestone]:
        """Check for new milestone achievements."""
        milestones = [
            Milestone(
                name=m.get("name", ""),
                description=m.get("description", ""),
                achieved_at=datetime.fromisoformat(m["achievedAt"].replace("Z", "+00:00")) 
                    if m.get("achievedAt") else datetime.now(),
                evidence=m.get("evidence", ""),
            )
            for m in existing_milestones
        ]
        
        achieved_names = {m.name for m in milestones}
        
        # Count stats
        total_solved = sum(1 for s in submissions if s.get("verdict", "").lower() == "accepted")
        easy_solved = sum(
            1 for s in submissions 
            if s.get("verdict", "").lower() == "accepted" 
            and s.get("difficulty", "").lower() == "easy"
        )
        medium_solved = sum(
            1 for s in submissions 
            if s.get("verdict", "").lower() == "accepted" 
            and s.get("difficulty", "").lower() == "medium"
        )
        hard_solved = sum(
            1 for s in submissions 
            if s.get("verdict", "").lower() == "accepted" 
            and s.get("difficulty", "").lower() == "hard"
        )
        
        # Check milestone thresholds
        milestone_checks = [
            ("First Steps", "Solved your first problem!", total_solved >= 1, f"Solved {total_solved} problems"),
            ("Getting Started", "Solved 5 problems", total_solved >= 5, f"Solved {total_solved} problems"),
            ("Building Momentum", "Solved 10 problems", total_solved >= 10, f"Solved {total_solved} problems"),
            ("Easy Master", "Solved 10 Easy problems", easy_solved >= 10, f"Solved {easy_solved} Easy problems"),
            ("Medium Challenger", "Solved 5 Medium problems", medium_solved >= 5, f"Solved {medium_solved} Medium problems"),
            ("Hard Warrior", "Solved first Hard problem", hard_solved >= 1, f"Solved {hard_solved} Hard problems"),
            ("Persistent", "Solved 25 problems total", total_solved >= 25, f"Solved {total_solved} problems"),
            ("Dedicated", "Solved 50 problems total", total_solved >= 50, f"Solved {total_solved} problems"),
            ("Expert Path", "Solved 100 problems total", total_solved >= 100, f"Solved {total_solved} problems"),
            ("Medium Master", "Solved 25 Medium problems", medium_solved >= 25, f"Solved {medium_solved} Medium problems"),
            ("Hard Master", "Solved 10 Hard problems", hard_solved >= 10, f"Solved {hard_solved} Hard problems"),
        ]
        
        for name, desc, achieved, evidence in milestone_checks:
            if achieved and name not in achieved_names:
                milestones.append(Milestone(
                    name=name,
                    description=desc,
                    achieved_at=datetime.now(),
                    evidence=evidence,
                ))
        
        return milestones
    
    def _estimate_weeks_to_target(
        self,
        current_phase: str,
        target_level: str,
        success_rate: float,
    ) -> Optional[int]:
        """Estimate weeks to reach target level."""
        phase_order = list(self.PHASES.keys())
        current_idx = phase_order.index(current_phase) if current_phase in phase_order else 0
        
        level_to_phase = {
            "Beginner": "foundation",
            "Easy": "skill_building",
            "Medium": "consolidation",
            "Hard": "advancement",
            "Expert": "mastery",
        }
        
        target_phase = level_to_phase.get(target_level, "consolidation")
        target_idx = phase_order.index(target_phase) if target_phase in phase_order else 2
        
        if target_idx <= current_idx:
            return 0  # Already at or past target
        
        phases_to_go = target_idx - current_idx
        
        # Estimate 2-4 weeks per phase based on success rate
        weeks_per_phase = 4 - (success_rate * 2)  # 2-4 weeks
        
        return int(phases_to_go * weeks_per_phase)
    
    def _lower_difficulty(self, difficulty: str) -> str:
        """Get one level lower difficulty."""
        order = ["Easy", "Medium", "Hard"]
        idx = order.index(difficulty) if difficulty in order else 1
        return order[max(0, idx - 1)]


# Singleton instance
_roadmap_generator = None


def get_roadmap_generator() -> RoadmapGenerator:
    """Get singleton roadmap generator instance."""
    global _roadmap_generator
    if _roadmap_generator is None:
        _roadmap_generator = RoadmapGenerator()
    return _roadmap_generator


def generate_learning_roadmap(
    user_id: str,
    submissions: List[Dict],
    user_profile: Dict,
    difficulty_adjustment: Dict,
    existing_roadmap: Optional[Dict] = None,
) -> Dict:
    """
    Convenience function to generate learning roadmap.
    
    Returns:
        Dict representation of LearningRoadmap
    """
    generator = get_roadmap_generator()
    roadmap = generator.generate_roadmap(
        user_id, submissions, user_profile, difficulty_adjustment, existing_roadmap
    )
    return roadmap.to_dict()
