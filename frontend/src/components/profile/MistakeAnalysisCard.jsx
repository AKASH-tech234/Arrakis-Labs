// ═══════════════════════════════════════════════════════════════════════════════
// MISTAKE ANALYSIS CARD
// Shows top mistakes and recurring patterns from MIM profile
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMIMProfile } from "../../services/ai/aiApi";

const COLORS = {
  bgCard: "#0F0F0D",
  border: "#1A1814",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  error: "#EF4444",
  warning: "#F59E0B",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// Mistake type icons - mapped to actual MIM root causes
const MISTAKE_ICONS = {
  // Correctness subtypes
  off_by_one: "🔢",
  boundary_condition: "⚠️",
  boundary_condition_blindness: "⚠️",
  wrong_invariant: "🔄",
  comparison_error: "⚖️",
  partial_case_handling: "📋",
  missing_edge_case: "🔲",
  
  // Implementation subtypes
  state_loss: "💾",
  state_mutation: "💾",
  null_reference: "🚫",
  type_mismatch: "🔀",
  resource_leak: "💧",
  
  // Efficiency subtypes  
  wrong_complexity: "⏱️",
  time_complexity: "⏱️",
  suboptimal_data_structure: "📊",
  redundant_operations: "🔁",
  missing_memoization: "🧮",
  
  // Understanding gap subtypes
  misread_constraints: "📖",
  wrong_problem_entirely: "❓",
  missing_requirements: "📝",
  
  // Algorithm-related
  algorithm_choice: "🎯",
  logic_error: "🧠",
  
  // Default
  default: "❌",
};

function getMistakeIcon(mistakeType) {
  if (!mistakeType) return MISTAKE_ICONS.default;
  const key = mistakeType.toLowerCase().replace(/[\s-]+/g, "_");
  return MISTAKE_ICONS[key] || MISTAKE_ICONS.default;
}

// Format mistake name for display
function formatMistakeName(name) {
  if (!name) return "Unknown";
  return name
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function MistakeAnalysisCard({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

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
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <div className="flex items-center justify-center py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-t-transparent rounded-full"
            style={{ borderColor: COLORS.accent, borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>
          Unable to load mistake analysis
        </p>
      </div>
    );
  }

  const mistakeAnalysis = data?.mistake_analysis || {};
  
  // Parse top_mistakes - can be [{cause, count}] or legacy [string]
  const rawTopMistakes = mistakeAnalysis.top_mistakes || [];
  const topMistakes = rawTopMistakes.map(m => {
    if (typeof m === 'string') {
      return { cause: m, count: 1 };
    }
    return { cause: m.cause || m.type || m.name || 'Unknown', count: m.count || 1 };
  }).filter(m => m.cause && m.cause !== 'Unknown');
  
  // Parse recurring_patterns - can be [{pattern, count}] or legacy [string]
  const rawPatterns = mistakeAnalysis.recurring_patterns || [];
  const recurringPatterns = rawPatterns.map(p => {
    if (typeof p === 'string') {
      return { pattern: p, count: 1 };
    }
    return { pattern: p.pattern || p.name || p.type || 'Unknown', count: p.count || 1 };
  }).filter(p => p.pattern && p.pattern !== 'Unknown');
  
  // Get patterns from profile.patterns if recurring_patterns is empty
  const profilePatterns = data?.patterns || {};
  const additionalPatterns = Object.entries(profilePatterns).map(([pattern, count]) => ({
    pattern,
    count: typeof count === 'number' ? count : 1
  }));
  
  // Combine patterns (avoiding duplicates)
  const allPatterns = [...recurringPatterns];
  additionalPatterns.forEach(ap => {
    if (!allPatterns.some(p => p.pattern === ap.pattern)) {
      allPatterns.push(ap);
    }
  });
  
  const totalMistakes = mistakeAnalysis.total_mistakes || 0;

  const hasData = topMistakes.length > 0 || allPatterns.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-xs font-medium uppercase tracking-widest flex items-center gap-2"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          <span>🔍</span>
          Mistake Analysis
        </h3>
        {totalMistakes > 0 && (
          <span 
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: `${COLORS.error}20`, color: COLORS.error }}
          >
            {totalMistakes} tracked
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            No recurring mistakes detected yet.
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Keep practicing to build your mistake profile.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Mistakes */}
          {topMistakes.length > 0 && (
            <div>
              <h4 
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: COLORS.textMuted }}
              >
                Top Mistakes
              </h4>
              <div className="space-y-2">
                {topMistakes.slice(0, expanded ? 10 : 3).map((mistake, index) => (
                  <motion.div
                    key={mistake.cause + index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    className="flex items-center justify-between p-2.5 rounded-lg cursor-default group"
                    style={{ backgroundColor: `${COLORS.error}10` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <motion.span 
                        className="text-lg"
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        {getMistakeIcon(mistake.cause)}
                      </motion.span>
                      <span className="text-sm font-medium" style={{ color: COLORS.textPrimary, fontFamily }}>
                        {formatMistakeName(mistake.cause)}
                      </span>
                    </div>
                    <motion.span 
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${COLORS.error}20`, color: COLORS.error }}
                      whileHover={{ scale: 1.1 }}
                    >
                      {mistake.count}×
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring Patterns */}
          {allPatterns.length > 0 && (
            <div>
              <h4 
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: COLORS.textMuted }}
              >
                Recurring Patterns
              </h4>
              <div className="flex flex-wrap gap-2">
                {allPatterns.slice(0, expanded ? 10 : 4).map((patternObj, index) => (
                  <motion.span
                    key={patternObj.pattern + index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="text-xs px-2.5 py-1.5 rounded-lg border cursor-default inline-flex items-center gap-1.5"
                    style={{ 
                      backgroundColor: `${COLORS.warning}10`,
                      borderColor: `${COLORS.warning}30`,
                      color: COLORS.warning,
                      fontFamily 
                    }}
                  >
                    <span>{formatMistakeName(patternObj.pattern)}</span>
                    {patternObj.count > 1 && (
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${COLORS.warning}20` }}
                      >
                        {patternObj.count}×
                      </span>
                    )}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {/* Expand/Collapse */}
          {(topMistakes.length > 3 || allPatterns.length > 4) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center text-xs py-2 rounded-lg transition-colors"
              style={{ 
                color: COLORS.accent,
                backgroundColor: `${COLORS.accent}10`
              }}
            >
              {expanded ? "Show Less" : "Show More"}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
