// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE BADGE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Phase 2.1 Upgrade: Now supports API-provided confidence levels
// 
// UI RULES:
// - HIGH (>=0.80): Green badge, "High confidence diagnosis"
// - MEDIUM (>=0.65): Yellow badge, "Likely issue"
// - LOW (<0.65): Grey badge, "Exploratory feedback"
//
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion";
import {
  CONFIDENCE_COLORS,
  CONFIDENCE_LABELS,
} from "../../types/ai.types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSIS CONFIDENCE BADGE (NEW - Phase 2.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DiagnosisConfidenceBadge - Shows MIM diagnosis confidence level
 * 
 * Use this for AI feedback panels to show confidence in the diagnosis.
 * 
 * @param {Object} props
 * @param {"high" | "medium" | "low"} props.confidenceLevel - Confidence tier from API
 * @param {number} [props.confidenceScore] - Optional raw score (0-1)
 * @param {"small" | "medium" | "large"} [props.size] - Badge size
 * @param {boolean} [props.showCalibrated] - Show calibration indicator
 * @param {string} [props.className] - Additional CSS classes
 */
export function DiagnosisConfidenceBadge({
  confidenceLevel = "medium",
  confidenceScore,
  size = "medium",
  showCalibrated = false,
  className = "",
}) {
  const color = CONFIDENCE_COLORS[confidenceLevel] || CONFIDENCE_COLORS.medium;
  const label = CONFIDENCE_LABELS[confidenceLevel] || CONFIDENCE_LABELS.medium;

  const sizeClasses = {
    small: "px-2 py-0.5 text-[10px]",
    medium: "px-3 py-1 text-xs",
    large: "px-4 py-2 text-sm",
  };

  const iconSizes = {
    small: "w-2 h-2",
    medium: "w-3 h-3",
    large: "w-4 h-4",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses[size]} uppercase tracking-wider`}
        style={{
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          backgroundColor: `${color}10`,
          borderColor: `${color}30`,
          color: color,
        }}
        title={confidenceScore ? `Confidence: ${Math.round(confidenceScore * 100)}%` : label}
      >
        {/* Confidence dot indicator */}
        <span
          className={`rounded-full ${iconSizes[size]}`}
          style={{ backgroundColor: color }}
        />

        {/* Label */}
        <span>{label}</span>

        {/* Calibration indicator */}
        {showCalibrated && (
          <span title="Calibrated confidence">
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY CONFIDENCE BADGE (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConfidenceBadge({
  badge,
  size = "medium",
  showStreak = false,
  showDescription = false,
  className = "",
}) {
  if (!badge) return null;

  const sizeClasses = {
    small: "px-2 py-0.5 text-[10px]",
    medium: "px-3 py-1 text-xs",
    large: "px-4 py-2 text-sm",
  };

  const iconSizes = {
    small: "w-2 h-2",
    medium: "w-3 h-3",
    large: "w-4 h-4",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      {/* Badge pill */}
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses[size]} uppercase tracking-wider`}
        style={{
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          backgroundColor: `${badge.color}10`,
          borderColor: `${badge.color}30`,
          color: badge.color,
        }}
      >
        {/* Confidence dot */}
        <span
          className={`rounded-full ${iconSizes[size]}`}
          style={{ backgroundColor: badge.color }}
        />

        {/* Label */}
        <span>{badge.label}</span>

        {/* Streak indicator */}
        {showStreak && badge.streak > 0 && (
          <span
            className="ml-1 px-1.5 rounded-full text-[10px]"
            style={{
              backgroundColor: `${badge.color}20`,
            }}
          >
            {badge.streak}🔥
          </span>
        )}
      </div>

      {/* Description */}
      {showDescription && (
        <span
          className="text-[#78716C] text-xs"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {badge.description}
        </span>
      )}
    </motion.div>
  );
}

export function ConfidenceIndicator({ badge, className = "" }) {
  if (!badge) return null;

  return (
    <span
      className={`inline-flex items-center ${className}`}
      title={`${badge.label} - ${badge.description}`}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: badge.color }}
      />
    </span>
  );
}

export function ConfidenceStatsCard({ badge, className = "" }) {
  if (!badge) return null;

  const { recentStats } = badge;

  return (
    <div
      className={`border rounded-lg p-4 ${className}`}
      style={{
        backgroundColor: "#0A0A08",
        borderColor: `${badge.color}30`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[#78716C] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Current Confidence
        </span>
        <ConfidenceBadge badge={badge} size="small" />
      </div>

      {recentStats && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div
              className="text-lg font-semibold"
              style={{ color: badge.color }}
            >
              {recentStats.accepted}
            </div>
            <div
              className="text-[10px] text-[#78716C] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Accepted
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[#EF4444]">
              {recentStats.failed}
            </div>
            <div
              className="text-[10px] text-[#78716C] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Failed
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[#E8E4D9]">
              {badge.streak}
            </div>
            <div
              className="text-[10px] text-[#78716C] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Streak
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
