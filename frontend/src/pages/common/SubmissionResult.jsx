// src/pages/SubmissionResult.jsx
// Submission Results Page - Arrakis Theme
// Flow: Wrong Answer → Hints → Summary | Accepted → Direct to Summary

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSubmission } from "../../context/SubmissionContext";
import AppHeader from "../../components/layout/AppHeader";

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

// ═══════════════════════════════════════════════════════════════════════════════
// VERDICT BADGE
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SCREEN - ARRAKIS THEME
// ═══════════════════════════════════════════════════════════════════════════════

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
      {/* Spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-2 rounded-full mb-8"
        style={{
          borderColor: `${COLORS.accent}30`,
          borderTopColor: COLORS.accent,
        }}
      />

      {/* Phase text */}
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

      {/* Progress dots */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// HINT CARD - ARRAKIS THEME
// ═══════════════════════════════════════════════════════════════════════════════

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
      {/* Hint Header */}
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

      {/* Hint Content */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// HINTS VIEW - First step for wrong answers
// ═══════════════════════════════════════════════════════════════════════════════

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
      {/* Header */}
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

      {/* Hints List */}
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

      {/* Actions */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY VIEW - Full analysis (shown after hints or directly for accepted)
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryView({ feedback, submission, onBackToHints }) {
  const [expandedSections, setExpandedSections] = useState({
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
      {/* Header */}
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

      {/* Detected Pattern */}
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

      {/* Explanation */}
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

      {/* Optimization Tips */}
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

      {/* Complexity Analysis */}
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

      {/* Edge Cases */}
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

      {/* Back to hints (only for wrong answer) */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SubmissionResult() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("initial"); // initial | hints | summary

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

  // Auto-request AI feedback when page loads
  useEffect(() => {
    if (hasSubmission && aiStatus === "idle") {
      requestAIFeedback();
    }
  }, [hasSubmission, aiStatus, requestAIFeedback]);

  // Set initial view based on verdict once feedback is loaded
  useEffect(() => {
    if (hasAIFeedback && currentView === "initial") {
      // Accepted → Direct to summary | Wrong Answer → Show hints first
      setCurrentView(isAccepted ? "summary" : "hints");
    }
  }, [hasAIFeedback, isAccepted, currentView]);

  // No submission found
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
