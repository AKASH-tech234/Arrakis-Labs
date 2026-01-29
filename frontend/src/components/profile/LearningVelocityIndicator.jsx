// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING VELOCITY INDICATOR
// Shows user's learning trajectory and progress trend
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getMIMProfile } from "../../services/ai/aiApi";

const COLORS = {
  bgCard: "#0F0F0D",
  border: "#1A1814",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// Velocity configurations
const VELOCITY_CONFIG = {
  accelerating: {
    icon: "🚀",
    label: "Accelerating",
    color: COLORS.success,
    description: "Your learning pace is increasing!",
    gradient: "from-[#22C55E]/20 to-transparent",
    animation: { y: [0, -5, 0], rotate: [0, 5, 0] }
  },
  stable: {
    icon: "📈",
    label: "Stable",
    color: COLORS.info,
    description: "Consistent progress - keep it up!",
    gradient: "from-[#3B82F6]/20 to-transparent",
    animation: { scale: [1, 1.05, 1] }
  },
  decelerating: {
    icon: "⚡",
    label: "Slowing",
    color: COLORS.warning,
    description: "Your pace is slowing - stay motivated!",
    gradient: "from-[#F59E0B]/20 to-transparent",
    animation: { rotate: [0, -5, 5, 0] }
  },
  stalled: {
    icon: "⏸️",
    label: "Paused",
    color: COLORS.textMuted,
    description: "Time to get back on track!",
    gradient: "from-[#78716C]/20 to-transparent",
    animation: { opacity: [1, 0.7, 1] }
  }
};

export default function LearningVelocityIndicator({ userId, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const profile = await getMIMProfile({ userId });
      setData(profile);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div 
        className="rounded-xl border p-4" 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <div className="flex items-center justify-center py-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-t-transparent rounded-full"
            style={{ borderColor: COLORS.accent, borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silent fail for this widget
  }

  const velocity = data?.learning_velocity || "stable";
  const trajectory = data?.learning_trajectory || {};
  const config = VELOCITY_CONFIG[velocity] || VELOCITY_CONFIG.stable;
  
  const totalSubmissions = trajectory.total_submissions || 0;
  const successRate = trajectory.success_rate || 0;
  const trend = trajectory.trend || "Building profile...";
  const skillLevel = data?.skill_level || "Beginner";

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border"
        style={{ 
          backgroundColor: `${config.color}10`,
          borderColor: `${config.color}30`
        }}
      >
        <span className="text-lg">{config.icon}</span>
        <div>
          <span 
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: config.color, fontFamily }}
          >
            {config.label}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-5 relative overflow-hidden bg-gradient-to-br ${config.gradient}`}
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          Learning Velocity
        </h3>
        <div 
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <span className="text-sm">{config.icon}</span>
          <span 
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: config.color, fontFamily }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Velocity Visualization */}
        <div className="flex items-center gap-4">
          <motion.div
            className="text-4xl"
            animate={config.animation}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            whileHover={{ scale: 1.2 }}
          >
            {config.icon}
          </motion.div>
          <div>
            <p 
              className="text-sm"
              style={{ color: COLORS.textPrimary, fontFamily }}
            >
              {config.description}
            </p>
            <p 
              className="text-xs mt-1"
              style={{ color: COLORS.textMuted }}
            >
              {trend}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div 
            className="text-center p-2 rounded-lg cursor-default"
            style={{ backgroundColor: COLORS.border }}
            whileHover={{ scale: 1.05, backgroundColor: `${COLORS.accent}20` }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="text-lg font-bold" 
              style={{ color: COLORS.accent, fontFamily }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              {skillLevel}
            </motion.div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
              Skill Level
            </div>
          </motion.div>
          <motion.div 
            className="text-center p-2 rounded-lg cursor-default"
            style={{ backgroundColor: COLORS.border }}
            whileHover={{ scale: 1.05, backgroundColor: `${COLORS.textPrimary}10` }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="text-lg font-bold" 
              style={{ color: COLORS.textPrimary, fontFamily }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              {totalSubmissions}
            </motion.div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
              Submissions
            </div>
          </motion.div>
          <motion.div 
            className="text-center p-2 rounded-lg cursor-default"
            style={{ backgroundColor: COLORS.border }}
            whileHover={{ scale: 1.05, backgroundColor: `${successRate >= 60 ? COLORS.success : COLORS.warning}20` }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="text-lg font-bold" 
              style={{ 
                color: successRate >= 60 ? COLORS.success : successRate >= 40 ? COLORS.warning : COLORS.error,
                fontFamily 
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              {Math.round(successRate)}%
            </motion.div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
              Success Rate
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Compact inline version for headers
export function LearningVelocityBadge({ userId }) {
  return <LearningVelocityIndicator userId={userId} compact />;
}
