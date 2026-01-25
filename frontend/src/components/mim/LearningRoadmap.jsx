// src/components/mim/LearningRoadmap.jsx
// Displays user's personalized learning roadmap from MIM V2.1
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getMIMRoadmap } from "../../services/ai/aiApi";

// Phase icons and colors
const PHASE_CONFIG = {
  foundation: {
    icon: "🏗️",
    label: "Foundation",
    color: "#10B981",
    description: "Building core fundamentals",
  },
  skill_building: {
    icon: "⚡",
    label: "Skill Building",
    color: "#F59E0B",
    description: "Developing problem-solving skills",
  },
  consolidation: {
    icon: "🔄",
    label: "Consolidation",
    color: "#6366F1",
    description: "Reinforcing learned concepts",
  },
  advancement: {
    icon: "🚀",
    label: "Advancement",
    color: "#EC4899",
    description: "Tackling harder challenges",
  },
  mastery: {
    icon: "👑",
    label: "Mastery",
    color: "#D97706",
    description: "Expert-level performance",
  },
};

// Step status styling
const STEP_STATUS_CONFIG = {
  completed: {
    bg: "bg-[#10B981]/20",
    border: "border-[#10B981]/40",
    text: "text-[#10B981]",
    icon: "✓",
  },
  in_progress: {
    bg: "bg-[#F59E0B]/20",
    border: "border-[#F59E0B]/40",
    text: "text-[#F59E0B]",
    icon: "◉",
  },
  pending: {
    bg: "bg-[#1A1814]",
    border: "border-[#78716C]/30",
    text: "text-[#78716C]",
    icon: "○",
  },
};

// Difficulty badge component
const DifficultyBadge = ({ difficulty }) => {
  const config = {
    Easy: { bg: "bg-[#10B981]/20", text: "text-[#10B981]" },
    Medium: { bg: "bg-[#F59E0B]/20", text: "text-[#F59E0B]" },
    Hard: { bg: "bg-[#EF4444]/20", text: "text-[#EF4444]" },
  };
  const { bg, text } = config[difficulty] || config.Medium;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs uppercase tracking-wider ${bg} ${text}`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {difficulty}
    </span>
  );
};

// Roadmap step component
const RoadmapStep = ({ step, index, isLast }) => {
  const statusConfig =
    STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending;
  const progress =
    step.targetProblems > 0
      ? Math.round((step.completedProblems / step.targetProblems) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative"
    >
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-linear-to-b from-[#D97706]/30 to-transparent" />
      )}

      <div className={`flex gap-4 pb-6`}>
        {/* Step indicator */}
        <div
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${statusConfig.bg} ${statusConfig.border} border-2`}
        >
          <span className={`text-sm ${statusConfig.text}`}>
            {statusConfig.icon}
          </span>
        </div>

        {/* Step content */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h4
                className={`text-sm font-medium ${step.status === "pending" ? "text-[#78716C]" : "text-[#E8E4D9]"}`}
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Step {step.stepNumber}: {step.goal}
              </h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {step.focusTopics?.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs text-[#A8A29E] bg-[#1A1814] px-2 py-0.5 rounded"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <DifficultyBadge difficulty={step.targetDifficulty} />
          </div>

          {/* Progress bar */}
          {step.status !== "pending" && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#78716C]">
                  {step.completedProblems} / {step.targetProblems} problems
                </span>
                <span className={statusConfig.text}>{progress}%</span>
              </div>
              <div className="h-1.5 bg-[#1A1814] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                  className={`h-full rounded-full ${step.status === "completed" ? "bg-[#10B981]" : "bg-[#F59E0B]"}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Milestone badge component
const MilestoneBadge = ({ milestone, index }) => {
  const isAchieved = milestone.achieved;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`relative group ${isAchieved ? "" : "opacity-50"}`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          isAchieved
            ? "bg-[#D97706]/10 border-[#D97706]/40"
            : "bg-[#1A1814] border-[#78716C]/20"
        }`}
      >
        <span className="text-lg">{milestone.icon || "🏆"}</span>
        <div>
          <p
            className={`text-xs font-medium ${isAchieved ? "text-[#E8E4D9]" : "text-[#78716C]"}`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {milestone.name}
          </p>
          {milestone.achievedAt && (
            <p className="text-[10px] text-[#78716C]">
              {new Date(milestone.achievedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {isAchieved && (
          <span className="text-[#10B981] text-xs ml-auto">✓</span>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
        <div className="bg-[#1A1814] border border-[#D97706]/30 rounded-lg px-3 py-2 text-xs text-[#A8A29E] whitespace-nowrap">
          {milestone.description || milestone.name}
        </div>
      </div>
    </motion.div>
  );
};

// Phase indicator component
const PhaseIndicator = ({ currentPhase }) => {
  const phases = [
    "foundation",
    "skill_building",
    "consolidation",
    "advancement",
    "mastery",
  ];
  const currentIndex = phases.indexOf(currentPhase);

  return (
    <div className="flex items-center justify-between mb-6">
      {phases.map((phase, index) => {
        const config = PHASE_CONFIG[phase];
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div key={phase} className="flex items-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex flex-col items-center ${index > 0 ? "ml-1" : ""}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive
                    ? `bg-[${config.color}]/20 border-[${config.color}]`
                    : isCompleted
                      ? "bg-[#10B981]/20 border-[#10B981]"
                      : "bg-[#1A1814] border-[#78716C]/30"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: config.color,
                        backgroundColor: `${config.color}20`,
                      }
                    : {}
                }
              >
                <span className="text-lg">
                  {isCompleted ? "✓" : config.icon}
                </span>
              </div>
              <span
                className={`text-[10px] mt-1 ${isActive ? "text-[#E8E4D9]" : "text-[#78716C]"}`}
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {config.label}
              </span>
            </motion.div>
            {index < phases.length - 1 && (
              <div
                className={`h-0.5 w-8 mx-1 ${
                  index < currentIndex ? "bg-[#10B981]" : "bg-[#78716C]/30"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function LearningRoadmap({ userId, compact = false }) {
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllSteps, setShowAllSteps] = useState(false);

  const fetchRoadmap = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getMIMRoadmap({ userId });
      setRoadmapData(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    fetchRoadmap();
  }, [fetchRoadmap]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 p-6">
        <div className="flex items-center justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-[#D97706] border-t-transparent rounded-full"
          />
          <span className="ml-3 text-[#78716C] text-sm">
            Building your roadmap...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#92400E]/30 bg-[#92400E]/5 p-6">
        <p className="text-[#D97706] text-sm">{error}</p>
      </div>
    );
  }

  if (!roadmapData || !roadmapData.roadmap) {
    return (
      <div className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 p-6">
        <p className="text-[#78716C] text-sm text-center">
          Solve a few problems to unlock your personalized learning roadmap!
        </p>
      </div>
    );
  }

  const { roadmap, profile_summary, status, difficultyAdjustment } =
    roadmapData;
  const steps = roadmap.steps || [];
  const milestones = roadmap.milestones || [];
  const currentPhase = roadmap.currentPhase || "foundation";
  const topicDependencies = roadmap.topicDependencies || [];
  const displaySteps = showAllSteps ? steps : steps.slice(0, compact ? 2 : 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-[#D97706]/20 bg-linear-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#D97706]/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#D97706]">🗺️</span>
            <h3
              className="text-[#E8E4D9] text-sm uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Learning Roadmap
            </h3>
          </div>
          {roadmap.estimatedWeeksToTarget && (
            <span className="text-xs text-[#78716C]">
              ~{roadmap.estimatedWeeksToTarget} weeks to{" "}
              <span className="text-[#D97706]">{roadmap.targetLevel}</span>
            </span>
          )}
        </div>
        {status === "cold_start" && (
          <p className="text-[#78716C] text-xs mt-1">
            ⚡ Starter roadmap - personalizes as you solve more
          </p>
        )}
      </div>

      <div className="p-6">
        {/* Phase indicator */}
        {!compact && <PhaseIndicator currentPhase={currentPhase} />}

        {/* Current phase info */}
        <div className="mb-6 p-3 rounded-lg bg-[#1A1814]/50 border border-[#D97706]/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">
              {PHASE_CONFIG[currentPhase]?.icon || "📚"}
            </span>
            <span
              className="text-[#E8E4D9] text-sm font-medium"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {PHASE_CONFIG[currentPhase]?.label || "Learning"}
            </span>
          </div>
          <p className="text-[#78716C] text-xs">
            {PHASE_CONFIG[currentPhase]?.description || "Keep solving!"}
          </p>
        </div>

        {/* Roadmap steps */}
        <div className="mb-6">
          <h4
            className="text-[#78716C] text-xs uppercase tracking-wider mb-4"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Your Next Steps
          </h4>
          {displaySteps.map((step, index) => (
            <RoadmapStep
              key={step.stepNumber}
              step={step}
              index={index}
              isLast={index === displaySteps.length - 1}
            />
          ))}
          {steps.length > displaySteps.length && (
            <button
              onClick={() => setShowAllSteps(!showAllSteps)}
              className="text-xs text-[#D97706] hover:text-[#F59E0B] transition-colors ml-12"
            >
              {showAllSteps
                ? "Show less"
                : `Show ${steps.length - displaySteps.length} more steps`}
            </button>
          )}
        </div>

        {/* Milestones */}
        {!compact && milestones.length > 0 && (
          <div>
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Milestones
            </h4>
            <div className="flex flex-wrap gap-2">
              {milestones.map((milestone, index) => (
                <MilestoneBadge
                  key={milestone.name}
                  milestone={milestone}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Profile summary */}
        {!compact && profile_summary && (
          <div className="mt-6 pt-4 border-t border-[#D97706]/10">
            <div className="flex items-center justify-between text-xs text-[#78716C]">
              <span>
                Solved:{" "}
                <span className="text-[#E8E4D9]">
                  {profile_summary.totalSolved}
                </span>
              </span>
              <span>
                Success rate:{" "}
                <span className="text-[#E8E4D9]">
                  {Math.round(profile_summary.successRate * 100)}%
                </span>
              </span>
            </div>
            {/* Weak and Strong Topics */}
            {(profile_summary.weakTopics?.length > 0 ||
              profile_summary.strongTopics?.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile_summary.strongTopics?.map((topic) => (
                  <span
                    key={`strong-${topic}`}
                    className="text-[10px] px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded"
                  >
                    ✓ {topic}
                  </span>
                ))}
                {profile_summary.weakTopics?.map((topic) => (
                  <span
                    key={`weak-${topic}`}
                    className="text-[10px] px-2 py-1 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded"
                  >
                    ⚠ {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Difficulty Adjustment Insight */}
        {!compact && difficultyAdjustment && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-6 pt-4 border-t border-[#D97706]/10"
          >
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Adaptive Difficulty
            </h4>
            <div className="bg-[#1A1814]/50 rounded-lg p-4 border border-[#D97706]/10">
              {/* Next Difficulty */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#A8A29E] text-xs">Recommended Next</span>
                <span
                  className={`text-sm font-medium ${
                    difficultyAdjustment.next_difficulty === "Easy"
                      ? "text-[#10B981]"
                      : difficultyAdjustment.next_difficulty === "Medium"
                        ? "text-[#F59E0B]"
                        : "text-[#EF4444]"
                  }`}
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {difficultyAdjustment.next_difficulty}
                </span>
              </div>

              {/* Adjustment Reason */}
              {difficultyAdjustment.reason && (
                <p className="text-[#78716C] text-xs mb-3 italic">
                  "{difficultyAdjustment.reason}"
                </p>
              )}

              {/* Frustration & Boredom Indices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#A8A29E] text-[10px] uppercase">
                      Frustration
                    </span>
                    <span className="text-[#E8E4D9] text-[10px]">
                      {Math.round(
                        (difficultyAdjustment.frustration_index || 0) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#1A1814] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(difficultyAdjustment.frustration_index || 0) * 100}%`,
                      }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full bg-[#EF4444]"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#A8A29E] text-[10px] uppercase">
                      Boredom
                    </span>
                    <span className="text-[#E8E4D9] text-[10px]">
                      {Math.round(
                        (difficultyAdjustment.boredom_index || 0) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#1A1814] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(difficultyAdjustment.boredom_index || 0) * 100}%`,
                      }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full bg-[#6366F1]"
                    />
                  </div>
                </div>
              </div>

              {/* Confidence */}
              {difficultyAdjustment.confidence !== undefined && (
                <div className="mt-3 text-center">
                  <span className="text-[#78716C] text-[10px]">
                    Confidence:{" "}
                    <span className="text-[#D97706]">
                      {Math.round(difficultyAdjustment.confidence * 100)}%
                    </span>
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Topic Dependencies */}
        {!compact && topicDependencies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-6 pt-4 border-t border-[#D97706]/10"
          >
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Learning Dependencies
            </h4>
            <div className="space-y-2">
              {topicDependencies.map((dep, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <span className="text-[#D97706] bg-[#D97706]/10 px-2 py-1 rounded">
                    {dep.topic}
                  </span>
                  <span className="text-[#78716C]">→</span>
                  <span className="text-[#A8A29E]">
                    {dep.prerequisite || "Foundation"}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
