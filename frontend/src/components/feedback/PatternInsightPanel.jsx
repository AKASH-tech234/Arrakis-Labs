import { motion } from "framer-motion";
import {
  PATTERN_STATE_MESSAGES,
  shouldShowPattern,
  isPatternConfirmed,
} from "../../types/ai.types.js";

const PATTERN_CONFIG = {
  none: null,
  suspected: {
    icon: "🔍",
    color: "#F59E0B",
    bgClass: "bg-[#F59E0B]/5",
    borderClass: "border-[#F59E0B]/20",
  },
  confirmed: {
    icon: "⚠️",
    color: "#EF4444",
    bgClass: "bg-[#EF4444]/5",
    borderClass: "border-[#EF4444]/20",
  },
  stable: {
    icon: "✅",
    color: "#22C55E",
    bgClass: "bg-[#22C55E]/5",
    borderClass: "border-[#22C55E]/20",
  },
};

export default function PatternInsightPanel({
  pattern,
  patternName,
  className = "",
}) {

  if (!pattern || !shouldShowPattern(pattern.state)) {
    return null;
  }

  const { state, evidenceCount, confidenceSupport } = pattern;
  const config = PATTERN_CONFIG[state];
  const message = PATTERN_STATE_MESSAGES[state];

  if (!config || !message) {
    return null;
  }

  const isConfirmed = isPatternConfirmed(state);

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
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{
                color: config.color,
                fontFamily: "'Rajdhani', system-ui, sans-serif",
              }}
            >
              Pattern {state === "stable" ? "Resolved" : "Detected"}
            </span>

            {}
            {isConfirmed && evidenceCount > 0 && (
              <span
                className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider"
                style={{
                  backgroundColor: `${config.color}20`,
                  color: config.color,
                  fontFamily: "'Rajdhani', system-ui, sans-serif",
                }}
              >
                {evidenceCount} occurrence{evidenceCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {}
          <p
            className="text-[#E8E4D9] text-sm mt-1 leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {message}
          </p>

          {}
          {patternName && isConfirmed && (
            <p
              className="text-[#78716C] text-xs mt-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Pattern type:{" "}
              <span style={{ color: config.color }}>
                {patternName.replace(/_/g, " ")}
              </span>
            </p>
          )}

          {}
          {state === "suspected" && confidenceSupport && (
            <p
              className="text-[#78716C] text-[10px] mt-2 uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Confidence: {confidenceSupport}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function PatternInsightBadge({ pattern, className = "" }) {
  if (!pattern || !shouldShowPattern(pattern.state)) {
    return null;
  }

  const { state } = pattern;
  const config = PATTERN_CONFIG[state];

  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${className}`}
      style={{
        backgroundColor: `${config.color}10`,
        color: config.color,
        fontFamily: "'Rajdhani', system-ui, sans-serif",
      }}
    >
      <span>{config.icon}</span>
      <span>
        {state === "suspected" && "Possible pattern"}
        {state === "confirmed" && "Recurring pattern"}
        {state === "stable" && "Pattern improved"}
      </span>
    </span>
  );
}
