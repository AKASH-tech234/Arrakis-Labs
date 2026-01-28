// ═══════════════════════════════════════════════════════════════════════════════
// DIFFICULTY STATUS PANEL (Phase 2.3)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Displays difficulty adjustment decisions from MIM difficulty policy.
//
// UI RULES:
// - NEVER say "you should try harder problems"
// - Only explain system decisions:
//   - maintain + pattern_unresolved: "Difficulty maintained to reinforce correctness"
//   - maintain + low_confidence: "Difficulty maintained (diagnosis uncertain)"
//   - increase: "Difficulty increased due to consistent success"
//   - decrease: "Difficulty adjusted to strengthen fundamentals"
//
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion";
import { getDifficultyMessage } from "../../types/ai.types.js";

// Difficulty action configuration
const DIFFICULTY_CONFIG = {
  increase: {
    icon: "📈",
    color: "#22C55E", // Green - progress
    bgClass: "bg-[#22C55E]/5",
    borderClass: "border-[#22C55E]/20",
    label: "Difficulty Increased",
  },
  maintain: {
    icon: "➡️",
    color: "#78716C", // Grey - neutral
    bgClass: "bg-[#78716C]/5",
    borderClass: "border-[#78716C]/20",
    label: "Difficulty Maintained",
  },
  decrease: {
    icon: "📉",
    color: "#3B82F6", // Blue - supportive
    bgClass: "bg-[#3B82F6]/5",
    borderClass: "border-[#3B82F6]/20",
    label: "Difficulty Adjusted",
  },
};

/**
 * DifficultyStatusPanel - Shows difficulty adjustment decision from MIM
 *
 * @param {Object} props
 * @param {Object} props.difficulty - Difficulty DTO from API
 * @param {string} props.difficulty.action - "increase" | "maintain" | "decrease"
 * @param {string} props.difficulty.reason - Reason code for the decision
 * @param {string} props.difficulty.confidenceTier - Confidence tier that influenced decision
 * @param {boolean} [props.showOnlyWhenChanged] - Only show if action !== "maintain"
 * @param {boolean} [props.compact] - Use compact display
 * @param {string} [props.className] - Additional CSS classes
 */
export default function DifficultyStatusPanel({
  difficulty,
  showOnlyWhenChanged = false,
  compact = false,
  className = "",
}) {
  // Don't render if no difficulty data
  if (!difficulty) {
    return null;
  }

  const { action, reason, confidenceTier } = difficulty;

  // Optionally hide if action is maintain
  if (showOnlyWhenChanged && action === "maintain") {
    return null;
  }

  const config = DIFFICULTY_CONFIG[action] || DIFFICULTY_CONFIG.maintain;
  const message = getDifficultyMessage(action, reason);

  // Compact version
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
        {/* Icon */}
        <span className="text-xl flex-shrink-0">{config.icon}</span>

        <div className="flex-1 min-w-0">
          {/* Header */}
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

          {/* Message - the ONLY thing shown to user about difficulty */}
          <p
            className="text-[#E8E4D9] text-sm mt-1 leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {message}
          </p>

          {/* Confidence tier indicator (subtle) */}
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

/**
 * Compact badge version for inline use
 */
export function DifficultyStatusBadge({ difficulty, className = "" }) {
  if (!difficulty) return null;

  const { action, reason } = difficulty;
  const config = DIFFICULTY_CONFIG[action] || DIFFICULTY_CONFIG.maintain;

  // Don't show badge for maintain (nothing changed)
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

/**
 * Inline text version for embedding in sentences
 */
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
