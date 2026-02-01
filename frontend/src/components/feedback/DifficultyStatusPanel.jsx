import { motion } from "framer-motion";
import { getDifficultyMessage } from "../../types/ai.types.js";

const DIFFICULTY_CONFIG = {
  increase: {
    icon: "📈",
    color: "#22C55E",
    bgClass: "bg-[#22C55E]/5",
    borderClass: "border-[#22C55E]/20",
    label: "Difficulty Increased",
  },
  maintain: {
    icon: "➡️",
    color: "#78716C",
    bgClass: "bg-[#78716C]/5",
    borderClass: "border-[#78716C]/20",
    label: "Difficulty Maintained",
  },
  decrease: {
    icon: "📉",
    color: "#3B82F6",
    bgClass: "bg-[#3B82F6]/5",
    borderClass: "border-[#3B82F6]/20",
    label: "Difficulty Adjusted",
  },
};

export default function DifficultyStatusPanel({
  difficulty,
  showOnlyWhenChanged = false,
  compact = false,
  className = "",
}) {

  if (!difficulty) {
    return null;
  }

  const { action, reason, confidenceTier } = difficulty;

  if (showOnlyWhenChanged && action === "maintain") {
    return null;
  }

  const config = DIFFICULTY_CONFIG[action] || DIFFICULTY_CONFIG.maintain;
  const message = getDifficultyMessage(action, reason);

  if (compact) {
    return (
      <DifficultyStatusBadge difficulty={difficulty} className={className} />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border p-3 ${config.bgClass} ${config.borderClass} ${className}`}
    >
      <div className="flex items-start gap-3">
        {}
        <span className="text-xl flex-shrink-0">{config.icon}</span>

        <div className="flex-1 min-w-0">
          {}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{
                color: config.color,
                fontFamily: "'Rajdhani', system-ui, sans-serif",
              }}
            >
              {config.label}
            </span>
          </div>

          {}
          <p
            className="text-[#E8E4D9] text-sm mt-1 leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {message}
          </p>

          {}
          {confidenceTier && action !== "maintain" && (
            <p
              className="text-[#78716C] text-[10px] mt-2 uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Based on {confidenceTier} confidence analysis
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function DifficultyStatusBadge({ difficulty, className = "" }) {
  if (!difficulty) return null;

  const { action, reason } = difficulty;
  const config = DIFFICULTY_CONFIG[action] || DIFFICULTY_CONFIG.maintain;

  if (action === "maintain") {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${className}`}
      style={{
        backgroundColor: `${config.color}10`,
        color: config.color,
        fontFamily: "'Rajdhani', system-ui, sans-serif",
      }}
      title={getDifficultyMessage(action, reason)}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export function DifficultyStatusText({ difficulty, className = "" }) {
  if (!difficulty) return null;

  const { action, reason } = difficulty;
  const message = getDifficultyMessage(action, reason);

  return (
    <span
      className={`text-[#78716C] text-sm ${className}`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {message}
    </span>
  );
}
