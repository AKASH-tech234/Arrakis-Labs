// src/components/profile/ProfileWidgets.jsx
// Dynamic, responsive profile widgets matching Arrakis theme
import { motion } from "framer-motion";

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const COLORS = {
  bg: "#0A0A08",
  bgCard: "#0F0F0D",
  border: "#1A1814",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  success: "#22C55E",
  error: "#EF4444",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// ═══════════════════════════════════════════════════════════════════════════════
// DIFFICULTY PROGRESS BARS
// Horizontal progress bars for Easy/Medium/Hard solve rates
// ═══════════════════════════════════════════════════════════════════════════════
export function DifficultyProgressBars({ stats = {} }) {
  const difficulties = [
    { 
      label: "Easy", 
      solved: stats.easySolved || 0, 
      total: stats.easyTotal || 0,
      color: "#22C55E" 
    },
    { 
      label: "Medium", 
      solved: stats.mediumSolved || 0, 
      total: stats.mediumTotal || 0,
      color: "#D97706" 
    },
    { 
      label: "Hard", 
      solved: stats.hardSolved || 0, 
      total: stats.hardTotal || 0,
      color: "#EF4444" 
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      <div className="space-y-4">
        {difficulties.map((diff, index) => {
          const percentage = diff.total > 0 ? (diff.solved / diff.total) * 100 : 0;
          
          return (
            <motion.div
              key={diff.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-sm font-medium"
                  style={{ color: diff.color, fontFamily }}
                >
                  {diff.label}
                </span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  {diff.solved}/{diff.total} ({Math.round(percentage)}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.border }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: diff.color }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: COLORS.border }}>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          Total Solved
        </span>
        <span className="text-sm font-bold" style={{ color: COLORS.accent, fontFamily }}>
          {difficulties.reduce((sum, d) => sum + d.solved, 0)} problems
        </span>
      </div>
    </motion.div>
  );
}

export default {
  DifficultyProgressBars,
};
