

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSubmission } from "../../context/SubmissionContext";
import AppHeader from "../../components/layout/AppHeader";

const COLORS = {
  bg: "#0A0A08",
  bgCard: "#0F0F0D",
  border: "#1A1814",
  borderLight: "#2A2A24",
  textPrimary: "#E8E4D9",
  textSecondary: "#A29A8C",
  textMuted: "#78716C",
  textDark: "#3D3D3D",
  accent: "#D97706",
  accentHover: "#F59E0B",
  success: "#22C55E",
  error: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
};

const HINT_COLORS = {
  conceptual: { bg: "#3B82F6", label: "Conceptual" },
  specific: { bg: "#F59E0B", label: "Specific" },
  approach: { bg: "#8B5CF6", label: "Approach" },
  solution: { bg: "#22C55E", label: "Solution" },
  optimization: { bg: "#06B6D4", label: "Optimization" },
  pattern: { bg: "#EC4899", label: "Pattern" },
};

const fontFamily = "'Rajdhani', 'Orbitron', system-ui, sans-serif";

function VerdictBadge({ verdict, size = "normal" }) {
  const configs = {
    accepted: { bg: COLORS.success, text: "Accepted", icon: "✓" },
    wrong_answer: { bg: COLORS.error, text: "Wrong Answer", icon: "✗" },
    time_limit_exceeded: {
      bg: COLORS.warning,
      text: "Time Limit Exceeded",
      icon: "⏱",
    },
    tle: { bg: COLORS.warning, text: "Time Limit Exceeded", icon: "⏱" },
    runtime_error: { bg: "#DC2626", text: "Runtime Error", icon: "⚠" },
    compile_error: { bg: "#9333EA", text: "Compile Error", icon: "⚙" },
  };

  const config = configs[verdict] || {
    bg: "#6B7280",
    text: verdict || "Unknown",
    icon: "?",
  };
  const sizeClasses =
    size === "large" ? "px-4 py-2 text-sm" : "px-2 py-1 text-xs";

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 ${sizeClasses} rounded uppercase tracking-wider`}
      style={{
        backgroundColor: `${config.bg}20`,
        color: config.bg,
        fontFamily,
      }}
    >
      <span>{config.icon}</span>
      <span className="font-semibold">{config.text}</span>
    </motion.div>
  );
}

function LoadingScreen() {
  const [phase, setPhase] = useState(0);
  const phases = [
    { text: "Analyzing your approach...", icon: "⟡" },
    { text: "Identifying patterns...", icon: "◈" },
    { text: "Evaluating code quality...", icon: "◇" },
    { text: "Building your learning plan...", icon: "✦" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % phases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [phases.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-16"
    >
      {}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-2 rounded-full mb-8"
        style={{
          borderColor: `${COLORS.accent}30`,
          borderTopColor: COLORS.accent,
        }}
      />

      {}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-3"
        >
          <span style={{ color: COLORS.accent }} className="text-xl">
            {phases[phase].icon}
          </span>
          <span
            className="text-sm uppercase tracking-wider"
            style={{ color: COLORS.textSecondary, fontFamily }}
          >
            {phases[phase].text}
          </span>
        </motion.div>
      </AnimatePresence>

      {}
      <div className="flex gap-2 mt-8">
        {phases.map((_, idx) => (
          <motion.div
            key={idx}
            animate={{
              scale: idx === phase ? 1.3 : 1,
              backgroundColor: idx === phase ? COLORS.accent : COLORS.textDark,
            }}
            className="w-1.5 h-1.5 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
}

function HintCard({ hint, index, isLatest }) {
  const colors = HINT_COLORS[hint.hint_type] || HINT_COLORS.conceptual;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: isLatest ? 0.2 : 0, duration: 0.3 }}
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: `${colors.bg}40`, backgroundColor: COLORS.bgCard }}
    >
      {}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ backgroundColor: `${colors.bg}10` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: colors.bg, color: "#fff" }}
          >
            {index + 1}
          </span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: colors.bg, fontFamily }}
          >
            {colors.label} Hint
          </span>
        </div>
      </div>

      {}
      <div className="px-4 py-4">
        <p
          className="text-sm leading-relaxed"
          style={{ color: COLORS.textPrimary, fontFamily }}
        >
          {hint.content}
        </p>
      </div>
    </motion.div>
  );
}

function HintsView({
  hints,
  revealedLevel,
  onRevealNext,
  hasMore,
  nextLabel,
  onContinueToSummary,
}) {
  const visibleHints = hints?.slice(0, revealedLevel) || [];

  return (
    <div className="space-y-6">
      {}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <span style={{ color: COLORS.accent }} className="text-2xl">
            ◈
          </span>
          <h2
            className="text-xl uppercase tracking-[0.2em]"
            style={{ color: COLORS.textPrimary, fontFamily }}
          >
            Guided Hints
          </h2>
          <span style={{ color: COLORS.accent }} className="text-2xl">
            ◈
          </span>
        </div>
        <p
          className="text-sm"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          Reveal hints progressively to guide your thinking
        </p>
      </div>

      {}
      <div className="space-y-4">
        {visibleHints.map((hint, idx) => (
          <HintCard
            key={idx}
            hint={hint}
            index={idx}
            isLatest={idx === visibleHints.length - 1}
          />
        ))}
      </div>

      {}
      <div className="flex flex-col gap-3 mt-8">
        {hasMore && (
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: `${COLORS.accent}10` }}
            whileTap={{ scale: 0.98 }}
            onClick={onRevealNext}
            className="w-full py-3 border rounded-lg transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            style={{
              borderColor: `${COLORS.accent}50`,
              color: COLORS.accent,
              fontFamily,
            }}
          >
            <span>▼</span>
            {nextLabel || "Reveal Next Hint"}
          </motion.button>
        )}

        <motion.button
          whileHover={{
            scale: 1.02,
            backgroundColor: `${COLORS.borderLight}50`,
          }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinueToSummary}
          className="w-full py-3 border rounded-lg transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          style={{
            borderColor: COLORS.borderLight,
            color: COLORS.textSecondary,
            fontFamily,
          }}
        >
          Continue to Full Analysis →
        </motion.button>
      </div>
    </div>
  );
}

function SummaryView({ feedback, submission, onBackToHints }) {
  const [expandedSections, setExpandedSections] = useState({
    mimInsights: true,
    pattern: true,
    explanation: false,
    optimization: false,
    complexity: false,
    edgeCases: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isAccepted = submission?.verdict === "accepted";

  return (
    <div className="space-y-6">
      {}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <span
            style={{ color: isAccepted ? COLORS.success : COLORS.accent }}
            className="text-2xl"
          >
            {isAccepted ? "✦" : "◇"}
          </span>
          <h2
            className="text-xl uppercase tracking-[0.2em]"
            style={{ color: COLORS.textPrimary, fontFamily }}
          >
            {isAccepted ? "Solution Analysis" : "Full Analysis"}
          </h2>
          <span
            style={{ color: isAccepted ? COLORS.success : COLORS.accent }}
            className="text-2xl"
          >
            {isAccepted ? "✦" : "◇"}
          </span>
        </div>
        <VerdictBadge verdict={submission?.verdict} size="large" />
      </div>

<<<<<<< HEAD:frontend/src/pages/common/SubmissionResult.jsx
      {}
=======
      {/* MIM Insights Panel - NEW */}
      {feedback?.mimInsights && (
        <MIMInsightsPanel mimInsights={feedback.mimInsights} />
      )}

      {/* Detected Pattern */}
>>>>>>> model:frontend/src/pages/SubmissionResult.jsx
      {feedback?.detectedPattern && (
        <CollapsibleSection
          title="Detected Pattern"
          icon="◈"
          expanded={expandedSections.pattern}
          onToggle={() => toggleSection("pattern")}
          accentColor={COLORS.info}
        >
          <p
            style={{ color: COLORS.textPrimary, fontFamily }}
            className="text-sm leading-relaxed"
          >
            {feedback.detectedPattern}
          </p>
        </CollapsibleSection>
      )}

      {}
      {feedback?.explanation && (
        <CollapsibleSection
          title="Detailed Explanation"
          icon="✧"
          expanded={expandedSections.explanation}
          onToggle={() => toggleSection("explanation")}
          accentColor={COLORS.accent}
        >
          <p
            style={{ color: COLORS.textPrimary, fontFamily }}
            className="text-sm leading-relaxed whitespace-pre-wrap"
          >
            {feedback.explanation}
          </p>
        </CollapsibleSection>
      )}

      {}
      {feedback?.optimizationTips?.length > 0 && (
        <CollapsibleSection
          title="Optimization Tips"
          icon="⚡"
          expanded={expandedSections.optimization}
          onToggle={() => toggleSection("optimization")}
          accentColor={COLORS.success}
        >
          <ul className="space-y-2">
            {feedback.optimizationTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span style={{ color: COLORS.success }}>•</span>
                <span
                  style={{ color: COLORS.textPrimary, fontFamily }}
                  className="text-sm"
                >
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {}
      {feedback?.complexityAnalysis && (
        <CollapsibleSection
          title="Complexity Analysis"
          icon="📊"
          expanded={expandedSections.complexity}
          onToggle={() => toggleSection("complexity")}
          accentColor="#8B5CF6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${COLORS.border}50` }}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: COLORS.textMuted, fontFamily }}
              >
                Time
              </span>
              <p
                className="text-lg font-mono mt-1"
                style={{ color: COLORS.textPrimary }}
              >
                {feedback.complexityAnalysis.time || "N/A"}
              </p>
            </div>
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${COLORS.border}50` }}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: COLORS.textMuted, fontFamily }}
              >
                Space
              </span>
              <p
                className="text-lg font-mono mt-1"
                style={{ color: COLORS.textPrimary }}
              >
                {feedback.complexityAnalysis.space || "N/A"}
              </p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {}
      {feedback?.edgeCases?.length > 0 && (
        <CollapsibleSection
          title="Edge Cases to Consider"
          icon="⚠"
          expanded={expandedSections.edgeCases}
          onToggle={() => toggleSection("edgeCases")}
          accentColor={COLORS.warning}
        >
          <ul className="space-y-2">
            {feedback.edgeCases.map((edge, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span style={{ color: COLORS.warning }}>→</span>
                <span
                  style={{ color: COLORS.textPrimary, fontFamily }}
                  className="text-sm"
                >
                  {edge}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {}
      {!isAccepted && onBackToHints && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBackToHints}
          className="w-full py-3 border rounded-lg transition-all duration-200 text-xs uppercase tracking-wider"
          style={{
            borderColor: COLORS.borderLight,
            color: COLORS.textMuted,
            fontFamily,
          }}
        >
          ← Back to Hints
        </motion.button>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  accentColor,
  children,
}) {
  return (
    <motion.div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgCard }}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors"
        style={{
          backgroundColor: expanded ? `${accentColor}10` : "transparent",
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: accentColor }}>{icon}</span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: COLORS.textPrimary, fontFamily }}
          >
            {title}
          </span>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          style={{ color: COLORS.textMuted }}
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

<<<<<<< HEAD:frontend/src/pages/common/SubmissionResult.jsx
=======
// ═══════════════════════════════════════════════════════════════════════════════
// MIM INSIGHTS PANEL - AI Intelligence Display
// ═══════════════════════════════════════════════════════════════════════════════

function MIMInsightsPanel({ mimInsights }) {
  if (!mimInsights) return null;

  const rootCause = mimInsights.root_cause || mimInsights.rootCause;
  const confidence =
    mimInsights.root_cause_confidence || mimInsights.confidence || 0;
  const pattern = mimInsights.pattern || {};
  const difficultyAction =
    mimInsights.difficulty_action || mimInsights.difficultyAction || {};
  const focusAreas = mimInsights.focus_areas || mimInsights.focusAreas || [];
  const isColdStart =
    mimInsights.is_cold_start || mimInsights.isColdStart || false;
  const isRecurring = pattern.is_recurring || pattern.isRecurring || false;
  const recurrenceCount =
    pattern.recurrence_count || pattern.recurrenceCount || 0;

  // Confidence color based on level
  const getConfidenceColor = (conf) => {
    if (conf >= 0.7) return COLORS.success;
    if (conf >= 0.4) return COLORS.warning;
    return COLORS.error;
  };

  // Difficulty action badge colors
  const getDifficultyActionStyle = (action) => {
    const styles = {
      increase: { bg: "#22C55E20", color: "#22C55E", icon: "↑" },
      decrease: { bg: "#EF444420", color: "#EF4444", icon: "↓" },
      maintain: { bg: "#3B82F620", color: "#3B82F6", icon: "→" },
      stretch: { bg: "#F59E0B20", color: "#F59E0B", icon: "⚡" },
    };
    return styles[action] || styles.maintain;
  };

  const actionStyle = getDifficultyActionStyle(difficultyAction.action);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-lg overflow-hidden mb-6"
      style={{
        borderColor: `${COLORS.accent}40`,
        backgroundColor: `${COLORS.accent}05`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: `${COLORS.accent}10`,
          borderBottom: `1px solid ${COLORS.accent}20`,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: COLORS.accent }}>🧠</span>
          <span
            className="text-xs uppercase tracking-[0.15em] font-semibold"
            style={{ color: COLORS.accent, fontFamily }}
          >
            MIM Intelligence
          </span>
          {isColdStart && (
            <span
              className="px-2 py-0.5 rounded text-[10px] uppercase"
              style={{
                backgroundColor: `${COLORS.info}20`,
                color: COLORS.info,
              }}
            >
              New User
            </span>
          )}
        </div>
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: COLORS.textMuted }}
        >
          v3.0
        </span>
      </div>

      {/* Content Grid */}
      <div className="p-4 space-y-4">
        {/* Root Cause + Confidence */}
        {rootCause && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <span
                className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: COLORS.textMuted, fontFamily }}
              >
                Root Cause
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: COLORS.textPrimary, fontFamily }}
              >
                {rootCause
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            <div className="text-right">
              <span
                className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: COLORS.textMuted, fontFamily }}
              >
                Confidence
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: getConfidenceColor(confidence), fontFamily }}
              >
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Pattern Detection */}
        {pattern.pattern_name && (
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${COLORS.border}30` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: COLORS.textMuted, fontFamily }}
              >
                Detected Pattern
              </span>
              {isRecurring && (
                <motion.span
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold flex items-center gap-1"
                  style={{
                    backgroundColor: `${COLORS.error}20`,
                    color: COLORS.error,
                  }}
                >
                  <span>⚠</span>
                  Recurring ({recurrenceCount}x)
                </motion.span>
              )}
            </div>
            <span
              className="text-sm"
              style={{ color: COLORS.textPrimary, fontFamily }}
            >
              {pattern.pattern_name || pattern.patternName}
            </span>
          </div>
        )}

        {/* Difficulty Recommendation */}
        {difficultyAction.action && (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: actionStyle.bg }}
            >
              <span style={{ color: actionStyle.color }}>
                {actionStyle.icon}
              </span>
              <span
                className="text-xs uppercase tracking-wider font-semibold"
                style={{ color: actionStyle.color, fontFamily }}
              >
                {difficultyAction.action}
              </span>
            </div>
            {difficultyAction.target_difficulty && (
              <span
                className="text-xs"
                style={{ color: COLORS.textSecondary, fontFamily }}
              >
                → {difficultyAction.target_difficulty} problems recommended
              </span>
            )}
          </div>
        )}

        {/* Focus Areas */}
        {focusAreas.length > 0 && (
          <div>
            <span
              className="text-[10px] uppercase tracking-wider block mb-2"
              style={{ color: COLORS.textMuted, fontFamily }}
            >
              Focus Areas
            </span>
            <div className="flex flex-wrap gap-2">
              {focusAreas.map((area, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: `${COLORS.info}15`,
                    color: COLORS.info,
                    fontFamily,
                  }}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rationale (if available) */}
        {difficultyAction.rationale && (
          <p
            className="text-xs italic pt-2"
            style={{
              color: COLORS.textSecondary,
              fontFamily,
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            💡 {difficultyAction.rationale}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

>>>>>>> model:frontend/src/pages/SubmissionResult.jsx
export default function SubmissionResult() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("initial"); 

  const {
    currentSubmission,
    aiFeedback,
    aiStatus,
    aiError,
    isAILoading,
    hasAIFeedback,
    hasAIError,
    requestAIFeedback,
    retryAIFeedback,
    revealNextHint,
    hasMoreHints,
    nextHintLabel,
    revealedHintLevel,
  } = useSubmission();

  const submission = currentSubmission;
  const hasSubmission = !!submission;
  const isAccepted = submission?.verdict === "accepted";

<<<<<<< HEAD:frontend/src/pages/common/SubmissionResult.jsx
=======
  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 DEBUG LOGGING - FRONTEND DATA FLOW TRACE
  // ═══════════════════════════════════════════════════════════════════════════════
>>>>>>> model:frontend/src/pages/SubmissionResult.jsx
  useEffect(() => {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("🎯 [SubmissionResult] STATE DEBUG");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 submission:", submission);
    console.log("🤖 aiFeedback:", aiFeedback);
    console.log("📊 aiStatus:", aiStatus);
    console.log("❌ aiError:", aiError);
    console.log("🔄 isAILoading:", isAILoading);
    console.log("✅ hasAIFeedback:", hasAIFeedback);
    console.log("👁️  currentView:", currentView);
    console.log("🏆 isAccepted:", isAccepted);
    if (aiFeedback) {
      console.log("─────────────────────────────────────────────────────────");
      console.log("📦 [aiFeedback CONTENTS]");
      console.log("   └─ hints:", aiFeedback.hints);
      console.log("   └─ hints count:", aiFeedback.hints?.length);
      console.log("   └─ explanation:", aiFeedback.explanation);
      console.log("   └─ detectedPattern:", aiFeedback.detectedPattern);
      console.log("   └─ complexityAnalysis:", aiFeedback.complexityAnalysis);
      console.log("   └─ optimizationTips:", aiFeedback.optimizationTips);
      console.log("   └─ edgeCases:", aiFeedback.edgeCases);
      console.log("   └─ improvementHint:", aiFeedback.improvementHint);
      console.log("   └─ mimInsights:", aiFeedback.mimInsights);
      console.log("   └─ feedbackType:", aiFeedback.feedbackType);
    }
    console.log("═══════════════════════════════════════════════════════════");
  }, [
    submission,
    aiFeedback,
    aiStatus,
    aiError,
    isAILoading,
    hasAIFeedback,
    currentView,
    isAccepted,
  ]);

  // Auto-request AI feedback ONLY if not already present
  // ✨ FIX: Skip if aiFeedback already came with submission (avoids duplicate calls)
  useEffect(() => {
    if (hasSubmission && aiStatus === "idle" && !hasAIFeedback) {
      // Only request if we don't already have feedback
      console.log(
        "[SubmissionResult] No aiFeedback from backend, requesting...",
      );
      requestAIFeedback();
    } else if (hasAIFeedback) {
      console.log(
        "[SubmissionResult] aiFeedback already present, skipping duplicate request",
      );
    }
  }, [hasSubmission, aiStatus, hasAIFeedback, requestAIFeedback]);

  useEffect(() => {
    console.log(
      `[SubmissionResult] View transition check: hasAIFeedback=${hasAIFeedback}, currentView=${currentView}, isAccepted=${isAccepted}`,
    );
    if (hasAIFeedback && currentView === "initial") {
<<<<<<< HEAD:frontend/src/pages/common/SubmissionResult.jsx
      
      setCurrentView(isAccepted ? "summary" : "hints");
=======
      // Accepted → Direct to summary | Wrong Answer → Show hints first
      const newView = isAccepted ? "summary" : "hints";
      console.log(
        `[SubmissionResult] 🔀 Transitioning view: ${currentView} → ${newView}`,
      );
      setCurrentView(newView);
>>>>>>> model:frontend/src/pages/SubmissionResult.jsx
    }
  }, [hasAIFeedback, isAccepted, currentView]);

  if (!hasSubmission) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
        <AppHeader />
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span
              className="text-5xl mb-6 block"
              style={{ color: COLORS.textDark }}
            >
              ◇
            </span>
            <h1
              className="text-2xl uppercase tracking-[0.15em] mb-4"
              style={{ color: COLORS.textPrimary, fontFamily }}
            >
              No Submission Found
            </h1>
            <p
              className="mb-8"
              style={{ color: COLORS.textSecondary, fontFamily }}
            >
              It looks like you haven't made a submission yet.
            </p>
            <Link
              to="/problems"
              className="inline-flex items-center gap-2 px-6 py-3 border rounded-lg transition-colors text-xs uppercase tracking-wider"
              style={{
                borderColor: COLORS.accent,
                color: COLORS.accent,
                fontFamily,
              }}
            >
              ← Back to Problems
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      <AppHeader />

      <main className="pt-14">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Back Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 transition-colors text-xs uppercase tracking-wider hover:opacity-80"
              style={{ color: COLORS.textMuted, fontFamily }}
            >
              <span>←</span>
              <span>Back to Problem</span>
            </button>
          </motion.div>

          {/* Submission Info Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-6 mb-8"
            style={{
              borderColor: COLORS.border,
              backgroundColor: COLORS.bgCard,
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1
                  className="text-2xl uppercase tracking-[0.1em] mb-2"
                  style={{ color: COLORS.textPrimary, fontFamily }}
                >
                  Submission Result
                </h1>
                <p
                  style={{ color: COLORS.textSecondary, fontFamily }}
                  className="text-sm"
                >
                  {submission.questionTitle ||
                    `Problem ${submission.questionId}`}
                </p>
              </div>
              <VerdictBadge verdict={submission.verdict} size="large" />
            </div>

            {/* Stats Row */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6"
              style={{ borderTop: `1px solid ${COLORS.border}` }}
            >
              {[
                {
                  label: "Language",
                  value: submission.language?.toUpperCase() || "N/A",
                },
                {
                  label: "Runtime",
                  value: submission.runtime ? `${submission.runtime}ms` : "—",
                },
                {
                  label: "Memory",
                  value: submission.memory ? `${submission.memory}MB` : "—",
                },
                {
                  label: "Submitted",
                  value: submission.timestamp
                    ? new Date(submission.timestamp).toLocaleTimeString()
                    : "Just now",
                },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: COLORS.textMuted, fontFamily }}
                  >
                    {stat.label}
                  </div>
                  <div
                    className="font-semibold"
                    style={{ color: COLORS.textPrimary, fontFamily }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Main Content Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border rounded-lg p-6"
            style={{
              borderColor: COLORS.border,
              backgroundColor: COLORS.bgCard,
            }}
          >
            <AnimatePresence mode="wait">
              {/* Loading State */}
              {isAILoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <LoadingScreen />
                </motion.div>
              )}

              {/* Error State */}
              {hasAIError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <span className="text-4xl mb-4 block">⚠</span>
                  <h3
                    className="text-lg uppercase tracking-wider mb-2"
                    style={{ color: COLORS.error, fontFamily }}
                  >
                    Analysis Failed
                  </h3>
                  <p
                    className="mb-6 text-sm"
                    style={{ color: COLORS.textSecondary, fontFamily }}
                  >
                    {aiError || "Something went wrong. Please try again."}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={retryAIFeedback}
                    className="px-6 py-3 border rounded-lg text-xs uppercase tracking-wider"
                    style={{
                      borderColor: COLORS.error,
                      color: COLORS.error,
                      fontFamily,
                    }}
                  >
                    ↻ Try Again
                  </motion.button>
                </motion.div>
              )}

              {/* Hints View (for wrong answer) */}
              {hasAIFeedback && currentView === "hints" && (
                <motion.div
                  key="hints"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <HintsView
                    hints={aiFeedback?.hints || []}
                    revealedLevel={revealedHintLevel}
                    onRevealNext={revealNextHint}
                    hasMore={hasMoreHints}
                    nextLabel={nextHintLabel}
                    onContinueToSummary={() => setCurrentView("summary")}
                  />
                </motion.div>
              )}

              {/* Summary View */}
              {hasAIFeedback && currentView === "summary" && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SummaryView
                    feedback={aiFeedback}
                    submission={submission}
                    onBackToHints={
                      !isAccepted ? () => setCurrentView("hints") : null
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-4 mt-8 justify-center"
          >
            <Link
              to={`/problems/${submission.questionId}`}
              className="px-6 py-3 border rounded-lg transition-colors text-xs uppercase tracking-wider hover:opacity-80"
              style={{
                borderColor: COLORS.borderLight,
                color: COLORS.textSecondary,
                fontFamily,
              }}
            >
              ← Try Again
            </Link>
            <Link
              to="/problems"
              className="px-6 py-3 border rounded-lg transition-colors text-xs uppercase tracking-wider hover:opacity-80"
              style={{
                borderColor: COLORS.accent,
                color: COLORS.accent,
                fontFamily,
              }}
            >
              Browse Problems →
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
