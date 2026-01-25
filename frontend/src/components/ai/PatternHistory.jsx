// src/components/ai/PatternHistory.jsx
// Pattern History Component - Shows recurring mistake patterns over time
// Part of MIM v3.0 Frontend Integration

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  bg: "#0A0A08",
  bgCard: "#0F0F0D",
  border: "#1A1814",
  borderLight: "#2A2A24",
  textPrimary: "#E8E4D9",
  textSecondary: "#A29A8C",
  textMuted: "#78716C",
  accent: "#D97706",
  success: "#22C55E",
  error: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
};

const fontFamily = "'Rajdhani', 'Orbitron', system-ui, sans-serif";

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN CATEGORY CONFIGS
// ═══════════════════════════════════════════════════════════════════════════════

const PATTERN_CATEGORIES = {
  boundary_condition_blindness: {
    name: "Boundary Blindness",
    icon: "◇",
    color: "#EF4444",
    description: "Missing edge cases like empty input or single elements",
    resources: ["Edge Case Analysis", "Input Validation Patterns"],
  },
  off_by_one_error: {
    name: "Off-by-One",
    icon: "±",
    color: "#F59E0B",
    description: "Loop bounds and array index errors",
    resources: ["Loop Invariant Analysis", "Index Boundary Practice"],
  },
  time_complexity_issue: {
    name: "Time Complexity",
    icon: "⏱",
    color: "#8B5CF6",
    description: "Inefficient algorithm causing TLE",
    resources: ["Algorithm Complexity", "Optimization Techniques"],
  },
  logic_error: {
    name: "Logic Error",
    icon: "⚡",
    color: "#3B82F6",
    description: "Incorrect algorithm implementation",
    resources: ["Algorithm Verification", "Dry Run Technique"],
  },
  integer_overflow: {
    name: "Integer Overflow",
    icon: "∞",
    color: "#EC4899",
    description: "Large number handling issues",
    resources: ["Large Number Handling", "Modular Arithmetic"],
  },
  recursion_issue: {
    name: "Recursion Issue",
    icon: "↻",
    color: "#06B6D4",
    description: "Missing base case or stack overflow",
    resources: ["Recursion Fundamentals", "Base Case Design"],
  },
  wrong_data_structure: {
    name: "Wrong Data Structure",
    icon: "⬡",
    color: "#10B981",
    description: "Suboptimal data structure choice",
    resources: ["Data Structure Selection", "Container Operation Costs"],
  },
  comparison_error: {
    name: "Comparison Error",
    icon: "≠",
    color: "#F472B6",
    description: "Wrong comparison operators",
    resources: ["Operator Semantics", "Boolean Logic"],
  },
  edge_case_handling: {
    name: "Edge Cases",
    icon: "⚠",
    color: "#FBBF24",
    description: "Special input not handled",
    resources: ["Edge Case Enumeration", "Test Case Generation"],
  },
  partial_solution: {
    name: "Incomplete",
    icon: "◐",
    color: "#94A3B8",
    description: "Solution doesn't cover all cases",
    resources: ["Completeness Checking", "Coverage Analysis"],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN HISTORY CARD
// ═══════════════════════════════════════════════════════════════════════════════

function PatternCard({ pattern, count, lastOccurrence, isExpanded, onToggle }) {
  const config = PATTERN_CATEGORIES[pattern] || {
    name: pattern.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: "◈",
    color: COLORS.textMuted,
    description: "Unknown pattern",
    resources: [],
  };

  const severity = count >= 5 ? "critical" : count >= 3 ? "warning" : "info";
  const severityColors = {
    critical: COLORS.error,
    warning: COLORS.warning,
    info: COLORS.info,
  };

  return (
    <motion.div
      layout
      className="border rounded-lg overflow-hidden"
      style={{
        borderColor: `${config.color}30`,
        backgroundColor: COLORS.bgCard,
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors hover:bg-opacity-50"
        style={{ backgroundColor: `${config.color}08` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{
              backgroundColor: `${config.color}20`,
              color: config.color,
            }}
          >
            {config.icon}
          </span>
          <div className="text-left">
            <span
              className="text-sm font-semibold block"
              style={{ color: COLORS.textPrimary, fontFamily }}
            >
              {config.name}
            </span>
            <span
              className="text-xs"
              style={{ color: COLORS.textSecondary, fontFamily }}
            >
              {count} occurrence{count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Severity Badge */}
          <span
            className="px-2 py-1 rounded text-[10px] uppercase font-semibold"
            style={{
              backgroundColor: `${severityColors[severity]}20`,
              color: severityColors[severity],
            }}
          >
            {severity === "critical"
              ? "⚠ Frequent"
              : severity === "warning"
                ? "Watch"
                : "Rare"}
          </span>

          {/* Expand Arrow */}
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            style={{ color: COLORS.textMuted }}
          >
            ▼
          </motion.span>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            {/* Description */}
            <p
              className="text-sm mb-4 pt-2"
              style={{ color: COLORS.textSecondary, fontFamily }}
            >
              {config.description}
            </p>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: COLORS.textMuted }}>Frequency</span>
                <span style={{ color: config.color }}>{count}/10</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(count * 10, 100)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: config.color }}
                />
              </div>
            </div>

            {/* Resources */}
            {config.resources.length > 0 && (
              <div>
                <span
                  className="text-[10px] uppercase tracking-wider block mb-2"
                  style={{ color: COLORS.textMuted, fontFamily }}
                >
                  Recommended Focus
                </span>
                <div className="flex flex-wrap gap-2">
                  {config.resources.map((resource, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: `${config.color}15`,
                        color: config.color,
                        fontFamily,
                      }}
                    >
                      {resource}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Last Occurrence */}
            {lastOccurrence && (
              <div
                className="mt-4 pt-3 text-xs"
                style={{
                  borderTop: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted,
                }}
              >
                Last seen: {new Date(lastOccurrence).toLocaleDateString()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PATTERN HISTORY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PatternHistory({
  patterns = [],
  title = "Your Pattern History",
}) {
  const [expandedPattern, setExpandedPattern] = useState(null);

  // Sort patterns by count (most frequent first)
  const sortedPatterns = [...patterns].sort((a, b) => b.count - a.count);

  if (patterns.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-8 border rounded-lg"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgCard }}
      >
        <span
          className="text-3xl mb-3 block"
          style={{ color: COLORS.textDark }}
        >
          ◇
        </span>
        <p className="text-sm" style={{ color: COLORS.textMuted, fontFamily }}>
          No patterns detected yet. Keep solving problems!
        </p>
      </motion.div>
    );
  }

  // Calculate stats
  const totalOccurrences = patterns.reduce((sum, p) => sum + p.count, 0);
  const mostCommon = sortedPatterns[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span style={{ color: COLORS.accent }}>📊</span>
          <h3
            className="text-sm uppercase tracking-[0.15em]"
            style={{ color: COLORS.textPrimary, fontFamily }}
          >
            {title}
          </h3>
        </div>
        <span
          className="text-xs"
          style={{ color: COLORS.textMuted, fontFamily }}
        >
          {patterns.length} patterns • {totalOccurrences} total
        </span>
      </div>

      {/* Quick Stats */}
      <div
        className="grid grid-cols-2 gap-3 p-4 rounded-lg mb-4"
        style={{
          backgroundColor: `${COLORS.accent}08`,
          borderColor: `${COLORS.accent}20`,
        }}
      >
        <div>
          <span
            className="text-[10px] uppercase tracking-wider block mb-1"
            style={{ color: COLORS.textMuted }}
          >
            Most Common
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: COLORS.textPrimary, fontFamily }}
          >
            {PATTERN_CATEGORIES[mostCommon.pattern]?.name || mostCommon.pattern}
          </span>
        </div>
        <div className="text-right">
          <span
            className="text-[10px] uppercase tracking-wider block mb-1"
            style={{ color: COLORS.textMuted }}
          >
            Frequency
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: COLORS.warning, fontFamily }}
          >
            {mostCommon.count}x
          </span>
        </div>
      </div>

      {/* Pattern List */}
      <div className="space-y-3">
        {sortedPatterns.map((item) => (
          <PatternCard
            key={item.pattern}
            pattern={item.pattern}
            count={item.count}
            lastOccurrence={item.lastOccurrence}
            isExpanded={expandedPattern === item.pattern}
            onToggle={() =>
              setExpandedPattern(
                expandedPattern === item.pattern ? null : item.pattern,
              )
            }
          />
        ))}
      </div>

      {/* Improvement Tip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-lg mt-6"
        style={{
          backgroundColor: `${COLORS.success}08`,
          borderLeft: `3px solid ${COLORS.success}`,
        }}
      >
        <span
          className="text-[10px] uppercase tracking-wider block mb-1"
          style={{ color: COLORS.success }}
        >
          💡 Improvement Tip
        </span>
        <p
          className="text-sm"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          Focus on eliminating{" "}
          <strong style={{ color: COLORS.textPrimary }}>
            {PATTERN_CATEGORIES[mostCommon.pattern]?.name || mostCommon.pattern}
          </strong>{" "}
          patterns first. Practice with targeted problems to build muscle
          memory.
        </p>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI PATTERN BADGE (for inline use)
// ═══════════════════════════════════════════════════════════════════════════════

export function PatternBadge({ pattern, count, size = "normal" }) {
  const config = PATTERN_CATEGORIES[pattern] || {
    name: pattern,
    icon: "◈",
    color: COLORS.textMuted,
  };

  const sizeClasses =
    size === "small" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses}`}
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
        fontFamily,
      }}
    >
      <span>{config.icon}</span>
      <span>{config.name}</span>
      {count && <span className="font-bold">({count})</span>}
    </span>
  );
}
