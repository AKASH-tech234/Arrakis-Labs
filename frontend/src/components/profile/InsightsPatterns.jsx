// src/components/profile/InsightsPatterns.jsx
// Dynamic component that fetches user insights and patterns from AI service
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMIMProfile } from "../../services/ai/aiApi";

// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS REFRESH EVENT SYSTEM
// Allows insights to refresh after submissions
// ═══════════════════════════════════════════════════════════════════════════════
const insightsRefreshListeners = new Set();

export function emitInsightsRefresh() {
  console.log("[InsightsPatterns] Emitting refresh event");
  insightsRefreshListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("[InsightsPatterns] Refresh listener error:", e);
    }
  });
}

function useInsightsRefresh(onRefresh) {
  useEffect(() => {
    if (onRefresh) {
      insightsRefreshListeners.add(onRefresh);
      return () => insightsRefreshListeners.delete(onRefresh);
    }
  }, [onRefresh]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const COLORS = {
  bg: "#0A0A08",
  bgCard: "#0F0F0D",
  border: "#1A1814",
  borderHover: "#D97706",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  accentLight: "#F59E0B",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Mistake Pattern Cloud
const MistakePatternCloud = ({ patterns = [] }) => {
  const [hoveredPattern, setHoveredPattern] = useState(null);

  const maxCount = Math.max(...patterns.map(p => p.count || 1), 1);
  
  const getSize = (count) => {
    const normalized = count / maxCount;
    if (normalized > 0.7) return "lg";
    if (normalized > 0.4) return "md";
    return "sm";
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2 font-medium",
  };

  if (!patterns || patterns.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-2">✨</div>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          No recurring mistake patterns detected yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {patterns.map((pattern, index) => {
          const size = getSize(pattern.count || 1);
          const isHovered = hoveredPattern === pattern.name;

          return (
            <motion.span
              key={pattern.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              onMouseEnter={() => setHoveredPattern(pattern.name)}
              onMouseLeave={() => setHoveredPattern(null)}
              className={`rounded-lg cursor-pointer transition-colors ${sizeStyles[size]}`}
              style={{
                backgroundColor: isHovered ? `${COLORS.accent}30` : `${COLORS.error}15`,
                color: isHovered ? COLORS.accent : COLORS.error,
                borderWidth: 1,
                borderColor: isHovered ? COLORS.accent : `${COLORS.error}40`,
                fontFamily,
              }}
            >
              {pattern.name.replace(/_/g, " ")}
              {isHovered && (
                <span className="ml-1 text-xs opacity-70">
                  ({pattern.count}x)
                </span>
              )}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Accuracy By Time Chart
const AccuracyByTimeChart = ({ data = {} }) => {
  const timeSlots = [
    { key: "morning", label: "Morning", time: "6AM-12PM", icon: "🌅" },
    { key: "afternoon", label: "Afternoon", time: "12PM-6PM", icon: "☀️" },
    { key: "evening", label: "Evening", time: "6PM-12AM", icon: "🌙" },
    { key: "night", label: "Night", time: "12AM-6AM", icon: "🌃" },
  ];

  const hasData = Object.keys(data).length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-4">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          Solve more problems to see your peak performance times.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {timeSlots.map((slot, index) => {
        const accuracy = data[slot.key]?.accuracy || 0;
        const attempts = data[slot.key]?.attempts || 0;
        const isBest = data[slot.key]?.isBest || false;

        return (
          <motion.div
            key={slot.key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border text-center ${isBest ? "ring-1 ring-[#D97706]" : ""}`}
            style={{
              backgroundColor: isBest ? `${COLORS.accent}10` : COLORS.bg,
              borderColor: isBest ? COLORS.accent : COLORS.border,
            }}
          >
            <div className="text-xl mb-1">{slot.icon}</div>
            <div
              className="text-lg font-bold"
              style={{ color: isBest ? COLORS.accent : COLORS.textPrimary, fontFamily }}
            >
              {Math.round(accuracy)}%
            </div>
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              {slot.label}
            </div>
            <div className="text-[10px]" style={{ color: COLORS.textMuted }}>
              {attempts} attempts
            </div>
            {isBest && (
              <div className="text-[10px] mt-1" style={{ color: COLORS.accent }}>
                ⭐ Peak Time
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// Skill Evolution Timeline
const SkillEvolutionTimeline = ({ milestones = [] }) => {
  if (!milestones || milestones.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-2">🚀</div>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          Your milestones will appear here as you progress.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div
        className="absolute left-3 top-0 bottom-0 w-0.5"
        style={{ backgroundColor: COLORS.border }}
      />

      {/* Milestones */}
      <div className="space-y-4">
        {milestones.slice(0, 5).map((milestone, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative pl-8"
          >
            {/* Dot */}
            <div
              className="absolute left-1.5 w-3 h-3 rounded-full border-2"
              style={{
                backgroundColor: COLORS.bgCard,
                borderColor: milestone.achievedAt ? COLORS.success : COLORS.accent,
              }}
            />

            {/* Content */}
            <div
              className="p-3 rounded-lg border"
              style={{
                backgroundColor: `${milestone.achievedAt ? COLORS.success : COLORS.accent}10`,
                borderColor: `${milestone.achievedAt ? COLORS.success : COLORS.accent}30`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🏆</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: COLORS.textPrimary, fontFamily }}
                >
                  {milestone.name}
                </span>
              </div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                {milestone.description || milestone.evidence}
              </p>
              {milestone.achievedAt && (
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  {new Date(milestone.achievedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Focus Areas Component
const FocusAreas = ({ areas = [] }) => {
  if (!areas || areas.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          Complete more problems to get personalized focus areas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {areas.slice(0, 4).map((area, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center gap-3 p-2 rounded-lg"
          style={{ backgroundColor: `${COLORS.accent}10` }}
        >
          <span className="text-lg">🎯</span>
          <span className="text-sm" style={{ color: COLORS.textPrimary, fontFamily }}>
            {typeof area === 'string' ? area : area.topic || area.name}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function InsightsPatterns({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!userId) {
      console.log("[InsightsPatterns] No userId, skipping fetch");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[InsightsPatterns] Fetching data for:", userId);
      const profile = await getMIMProfile({ userId });
      console.log("[InsightsPatterns] Received data:", profile);
      setData(profile);
    } catch (err) {
      console.error("[InsightsPatterns] Error:", err);
      setError(err.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Listen for refresh events
  const handleRefresh = useCallback(() => {
    console.log("[InsightsPatterns] Refresh triggered");
    setRefreshKey((k) => k + 1);
  }, []);

  useInsightsRefresh(handleRefresh);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border p-6" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <div className="flex items-center justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-t-transparent rounded-full"
            style={{ borderColor: COLORS.accent, borderTopColor: 'transparent' }}
          />
          <span className="ml-3 text-sm" style={{ color: COLORS.textMuted }}>
            Loading insights...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border p-6" style={{ backgroundColor: `${COLORS.error}10`, borderColor: `${COLORS.error}30` }}>
        <p className="text-sm" style={{ color: COLORS.error }}>{error}</p>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="mt-2 text-xs px-3 py-1 rounded"
          style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Extract data from profile
  const mistakePatterns = data?.mistake_analysis?.top_mistakes?.map(m => ({
    name: typeof m === 'string' ? m : m.cause || m.name,
    count: typeof m === 'object' ? m.count || 1 : 1
  })) || [];

  const accuracyByTime = data?.accuracy_by_time || {};
  const milestones = data?.milestones || [];
  const focusAreas = data?.focus_areas || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Mistake Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border p-4"
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h4
          className="text-xs font-medium uppercase tracking-widest mb-3"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          Mistake Patterns
        </h4>
        <MistakePatternCloud patterns={mistakePatterns} />
      </motion.div>

      {/* Peak Performance Times */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border p-4"
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h4
          className="text-xs font-medium uppercase tracking-widest mb-3"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          Peak Performance Times
        </h4>
        <AccuracyByTimeChart data={accuracyByTime} />
      </motion.div>

      {/* Focus Areas or Milestones */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border p-4"
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h4
          className="text-xs font-medium uppercase tracking-widest mb-3"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          {focusAreas.length > 0 ? "Focus Areas" : "Milestones"}
        </h4>
        {focusAreas.length > 0 ? (
          <FocusAreas areas={focusAreas} />
        ) : (
          <SkillEvolutionTimeline milestones={milestones} />
        )}
      </motion.div>
    </div>
  );
}
