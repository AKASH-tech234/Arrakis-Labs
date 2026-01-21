// src/components/feedback/ConfidenceBadge.jsx
// Confidence Badge Component - Computed from frontend submission history
// ❌ No new backend calls | Uses existing submission data

import { motion } from "framer-motion";

/**
 * Confidence Badge Display Component
 *
 * Badge Levels:
 * - 🟢 High Confidence → consecutive Accepted
 * - 🟡 Medium Confidence → mixed results
 * - 🔴 Low Confidence → frequent wrong answers
 *
 * Display Locations:
 * - Near problem title
 * - In weekly report header
 * - In learning timeline
 *
 * @param {Object} props
 * @param {Object} props.badge - Badge data from useConfidenceBadge
 * @param {'small'|'medium'|'large'} props.size - Badge size variant
 * @param {boolean} props.showStreak - Whether to show streak count
 * @param {boolean} props.showDescription - Whether to show description
 * @param {string} props.className - Additional CSS classes
 */
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
      {/* Badge Pill */}
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses[size]} uppercase tracking-wider`}
        style={{
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          backgroundColor: `${badge.color}10`,
          borderColor: `${badge.color}30`,
          color: badge.color,
        }}
      >
        {/* Indicator Dot */}
        <span
          className={`rounded-full ${iconSizes[size]}`}
          style={{ backgroundColor: badge.color }}
        />

        {/* Label */}
        <span>{badge.label}</span>

        {/* Streak Badge (optional) */}
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

      {/* Description (optional) */}
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

/**
 * Inline Confidence Indicator (minimal version)
 * For use in tight spaces like problem titles
 */
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

/**
 * Confidence Stats Card (expanded version)
 * For use in profile/dashboard views
 */
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
