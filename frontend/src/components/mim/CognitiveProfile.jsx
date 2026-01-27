// src/components/mim/CognitiveProfile.jsx
// Displays user's MIM cognitive profile with strengths and weaknesses
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMIMProfile } from "../../services/ai/aiApi";

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE REFRESH EVENT SYSTEM
// Allows profile components to refresh after submissions
// ═══════════════════════════════════════════════════════════════════════════════
const profileRefreshListeners = new Set();

export function emitProfileRefresh() {
  console.log("[CognitiveProfile] Emitting profile refresh event");
  profileRefreshListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("[CognitiveProfile] Refresh listener error:", e);
    }
  });
}

function useProfileRefresh(onRefresh) {
  useEffect(() => {
    if (onRefresh) {
      profileRefreshListeners.add(onRefresh);
      return () => profileRefreshListeners.delete(onRefresh);
    }
  }, [onRefresh]);
}

const SkillBar = ({
  label,
  value,
  maxValue = 100,
  color = "#D97706",
  delay = 0,
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="mb-3"
    >
      <div className="flex justify-between mb-1">
        <span
          className="text-[#A8A29E] text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {label}
        </span>
        <span
          className="text-[#E8E4D9] text-xs"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {value}%
        </span>
      </div>
      <div className="h-2 bg-[#1A1814] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );
};

const CategoryBadge = ({ category, type, delay = 0 }) => {
  const isStrength = type === "strength";
  const bgColor = isStrength ? "bg-[#D97706]/15" : "bg-[#92400E]/15";
  const textColor = isStrength ? "text-[#F59E0B]" : "text-[#D97706]";
  const borderColor = isStrength
    ? "border-[#D97706]/30"
    : "border-[#92400E]/30";

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={`inline-flex items-center px-3 py-1.5 rounded-lg border ${bgColor} ${borderColor} ${textColor} text-xs uppercase tracking-wider mr-2 mb-2`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {isStrength ? "✓ " : "⚠ "}
      {category}
    </motion.span>
  );
};

export default function CognitiveProfile({ userId, compact = false }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch profile function - reusable for initial load and refresh
  const fetchProfile = useCallback(async () => {
    if (!userId) {
      console.log("[CognitiveProfile] No userId, skipping fetch");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[CognitiveProfile] Fetching MIM profile for:", userId);
      const data = await getMIMProfile({ userId });
      console.log("[CognitiveProfile] Received data:", data);
      setProfile(data);
    } catch (err) {
      console.error("[CognitiveProfile] Error:", err);
      setError(err.message || "Failed to load cognitive profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, refreshKey]);

  // Listen for profile refresh events (triggered after submissions)
  const handleRefresh = useCallback(() => {
    console.log("[CognitiveProfile] Refresh triggered - reloading profile");
    setRefreshKey((k) => k + 1);
  }, []);

  useProfileRefresh(handleRefresh);

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
            Loading profile...
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

  if (!profile) {
    return (
      <div className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 p-6">
        <p className="text-[#78716C] text-sm text-center">
          No cognitive profile available yet. Complete more problems to build
          your profile.
        </p>
      </div>
    );
  }

  const {
    strengths = [],
    weaknesses = [],
    readiness_scores = {},
    learning_trajectory = {},
    // v3.2: NEW fields from persisted profile
    skill_level = null,
    learning_velocity = null,
    mistake_analysis = {},
    focus_areas = [],
    recent_learning = [],
    last_mim = {},
    is_persisted = false,
  } = profile;

  // Helper to format mistake cause for display
  const formatMistakeCause = (cause) => {
    return cause.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-[#D97706]/20 bg-gradient-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#D97706]/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#D97706]">🧠</span>
            <h3
              className="text-[#E8E4D9] text-sm uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Cognitive Profile
            </h3>
            {is_persisted && (
              <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full">
                LIVE
              </span>
            )}
          </div>
          {skill_level && (
            <span className="text-[#D97706] text-xs uppercase tracking-wider px-2 py-1 bg-[#D97706]/10 rounded">
              {skill_level}
            </span>
          )}
        </div>
        {learning_trajectory?.trend && (
          <p className="text-[#78716C] text-xs mt-1">
            Trend:{" "}
            <span
              className={`${
                learning_trajectory.trend === "Improving"
                  ? "text-[#10B981]"
                  : learning_trajectory.trend === "Needs attention"
                    ? "text-[#EF4444]"
                    : "text-[#D97706]"
              }`}
            >
              {learning_trajectory.trend}
            </span>
            {learning_velocity && learning_velocity !== "stable" && (
              <span className="ml-2 text-[#78716C]">({learning_velocity})</span>
            )}
          </p>
        )}
      </div>

      <div className="p-6">
        {/* Focus Areas (v3.2) - Show prominently */}
        {!compact && focus_areas.length > 0 && (
          <div className="mb-6 p-4 bg-[#D97706]/5 rounded-lg border border-[#D97706]/20">
            <h4
              className="text-[#D97706] text-xs uppercase tracking-wider mb-2 flex items-center gap-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <span>🎯</span> Current Focus Areas
            </h4>
            <div className="flex flex-wrap gap-2">
              {focus_areas.slice(0, 3).map((area, i) => (
                <span
                  key={area}
                  className="text-[#E8E4D9] text-xs px-3 py-1 bg-[#D97706]/20 rounded-full"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths & Weaknesses */}
        {!compact && (
          <>
            {/* Strengths */}
            {strengths.length > 0 && (
              <div className="mb-6">
                <h4
                  className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Strengths
                </h4>
                <div className="flex flex-wrap">
                  {strengths.map((s, i) => (
                    <CategoryBadge
                      key={s}
                      category={s}
                      type="strength"
                      delay={i * 0.1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {weaknesses.length > 0 && (
              <div className="mb-6">
                <h4
                  className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Areas to Improve
                </h4>
                <div className="flex flex-wrap">
                  {weaknesses.map((w, i) => (
                    <CategoryBadge
                      key={w}
                      category={w}
                      type="weakness"
                      delay={i * 0.1}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Mistake Analysis (v3.2) */}
        {!compact && mistake_analysis?.top_mistakes?.length > 0 && (
          <div className="mb-6">
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3 flex items-center gap-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <span>📊</span> Common Mistake Patterns
            </h4>
            <div className="space-y-2">
              {mistake_analysis.top_mistakes.slice(0, 3).map((mistake, i) => (
                <motion.div
                  key={mistake.cause}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-2 bg-[#1A1814]/50 rounded border border-[#92400E]/20"
                >
                  <span className="text-[#E8E4D9] text-xs">
                    {formatMistakeCause(mistake.cause)}
                  </span>
                  <span className="text-[#D97706] text-xs font-bold px-2 py-0.5 bg-[#D97706]/20 rounded">
                    ×{mistake.count}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Trajectory Stats */}
        {!compact && learning_trajectory && (
          <div className="mb-6">
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Learning Progress
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {/* Total Submissions */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-[#1A1814]/50 rounded-lg p-3 text-center border border-[#D97706]/10"
              >
                <p
                  className="text-[#D97706] text-2xl font-bold"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {learning_trajectory.total_submissions || 0}
                </p>
                <p className="text-[#78716C] text-[10px] uppercase tracking-wider">
                  Submissions
                </p>
              </motion.div>

              {/* Success Rate */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-[#1A1814]/50 rounded-lg p-3 text-center border border-[#D97706]/10"
              >
                <p
                  className="text-[#10B981] text-2xl font-bold"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {Math.round(learning_trajectory.success_rate || 0)}%
                </p>
                <p className="text-[#78716C] text-[10px] uppercase tracking-wider">
                  Success Rate
                </p>
              </motion.div>

              {/* Total Correct */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-[#1A1814]/50 rounded-lg p-3 text-center border border-[#D97706]/10"
              >
                <p
                  className="text-[#10B981] text-2xl font-bold"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {learning_trajectory.total_correct || 0}
                </p>
                <p className="text-[#78716C] text-[10px] uppercase tracking-wider">
                  Solved
                </p>
              </motion.div>
            </div>
          </div>
        )}

        {/* Recent Learning Recommendations (v3.2) */}
        {!compact && recent_learning?.length > 0 && (
          <div className="mb-6">
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3 flex items-center gap-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <span>💡</span> Recent Recommendations
            </h4>
            {recent_learning.slice(0, 1).map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-[#1A1814]/50 rounded-lg border border-[#D97706]/10"
              >
                {rec.summary && (
                  <p className="text-[#E8E4D9] text-xs mb-2">{rec.summary}</p>
                )}
                {rec.focus_areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.focus_areas.map((area) => (
                      <span
                        key={area}
                        className="text-[10px] text-[#D97706] px-2 py-0.5 bg-[#D97706]/10 rounded"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Readiness Scores */}
        {Object.keys(readiness_scores).length > 0 && (
          <div>
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Readiness by Difficulty
            </h4>
            {Object.entries(readiness_scores).map(([level, score], i) => (
              <SkillBar
                key={level}
                label={level}
                value={Math.round(score * 100)}
                color={
                  level === "Easy"
                    ? "#10B981"
                    : level === "Medium"
                      ? "#D97706"
                      : "#EF4444"
                }
                delay={i * 0.1}
              />
            ))}
          </div>
        )}

        {/* Last MIM Analysis (v3.2) */}
        {!compact && last_mim?.root_cause && (
          <div className="mt-4 pt-4 border-t border-[#D97706]/10">
            <p className="text-[#78716C] text-[10px] uppercase tracking-wider">
              Last Analysis:{" "}
              <span className="text-[#D97706]">
                {formatMistakeCause(last_mim.root_cause)}
              </span>
              {last_mim.confidence && (
                <span className="ml-2 text-[#78716C]">
                  ({Math.round(last_mim.confidence * 100)}% confidence)
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
