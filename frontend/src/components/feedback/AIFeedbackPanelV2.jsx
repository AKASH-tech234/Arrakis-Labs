import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import MIMInsights from "../mim/MIMInsights"; // Legacy MIM insights component
import MIMInsightsV3 from "../mim/MIMInsightsV3"; // ✨ V3.0 MIM insights component

const HINT_COLORS = {
  conceptual: { bg: "#3B82F6", text: "#DBEAFE", label: "Conceptual" },
  specific: { bg: "#F59E0B", text: "#FEF3C7", label: "Specific" },
  approach: { bg: "#8B5CF6", text: "#EDE9FE", label: "Approach" },
  solution: { bg: "#22C55E", text: "#DCFCE7", label: "Solution" },
  optimization: { bg: "#06B6D4", text: "#CFFAFE", label: "Optimization" },
  pattern: { bg: "#EC4899", text: "#FCE7F3", label: "Pattern" },
};

// v3.3: Code block component for displaying correct code
function CodeBlock({ code, language, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onCopy) onCopy();
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className="relative border border-[#3D3D3D]/50 bg-[#0D0D0B] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3D3D3D]/30 bg-[#1A1814]">
        <span
          className="text-[#78716C] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {language || "Solution"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-[#78716C] hover:text-[#22C55E] transition-colors"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code
          className="text-[#E8E4D9] text-xs leading-relaxed"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const configs = {
    accepted: { bg: "#22C55E", text: "Accepted", icon: "✓" },
    wrong_answer: { bg: "#EF4444", text: "Wrong Answer", icon: "✗" },
    time_limit_exceeded: {
      bg: "#F59E0B",
      text: "Time Limit Exceeded",
      icon: "⏱",
    },
    tle: { bg: "#F59E0B", text: "Time Limit Exceeded", icon: "⏱" },
    runtime_error: { bg: "#DC2626", text: "Runtime Error", icon: "⚠" },
    compile_error: { bg: "#9333EA", text: "Compile Error", icon: "⚙" },
  };

  const config = configs[verdict] || {
    bg: "#6B7280",
    text: verdict,
    icon: "?",
  };

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs uppercase tracking-wider"
      style={{
        backgroundColor: `${config.bg}20`,
        color: config.bg,
        fontFamily: "'Rajdhani', system-ui, sans-serif",
      }}
    >
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </div>
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
      style={{ borderColor: `${colors.bg}40` }}
    >
      {}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ backgroundColor: `${colors.bg}10` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: colors.bg, color: "#fff" }}
          >
            {index + 1}
          </span>
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: colors.bg,
              fontFamily: "'Rajdhani', system-ui, sans-serif",
            }}
          >
            {colors.label}
          </span>
        </div>
      </div>

      {}
      <div className="px-4 py-3">
        <p
          className="text-[#E8E4D9] text-sm leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {hint.content}
        </p>
      </div>
    </motion.div>
  );
}

function RevealButton({ label, onClick, variant = "primary" }) {
  const variants = {
    primary: "border-[#D97706]/50 text-[#D97706] hover:bg-[#D97706]/10",
    secondary:
      "border-[#3D3D3D]/50 text-[#78716C] hover:border-[#D97706]/50 hover:text-[#D97706]",
    success: "border-[#22C55E]/50 text-[#22C55E] hover:bg-[#22C55E]/10",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full py-3 border rounded-lg transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2 ${variants[variant]}`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {label}
    </motion.button>
  );
}

export default function AIFeedbackPanelV2({
  isVisible,
  onClose,
  loading = false,
  error = null,
  feedback = null,

  onRevealNextHint,
  hasMoreHints = false,
  nextHintLabel = "Show next hint",
  onToggleExplanation,
  showFullExplanation = false,

  onRetry,
}) {
  const [showPattern, setShowPattern] = useState(false);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="border-l border-[#1A1814] h-full overflow-auto"
          style={{ backgroundColor: "#0A0A08" }}
        >
          {}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1814] sticky top-0 bg-[#0A0A08] z-10">
            <div className="flex items-center gap-3">
              <span
                className="text-[#E8E4D9] text-xs uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                AI Analysis
              </span>
              {feedback?.verdict && <VerdictBadge verdict={feedback.verdict} />}
            </div>
            <button
              onClick={onClose}
              className="text-[#3D3D3D] hover:text-[#78716C] transition-colors p-1"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {}
          <div className="p-4 space-y-4">
            {}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="w-10 h-10 border-2 border-[#D97706] border-t-transparent rounded-full mb-4"
                />
                <p
                  className="text-[#78716C] text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Analyzing your code...
                </p>
                <p
                  className="text-[#3D3D3D] text-[10px] mt-2"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  This typically takes 2-5 seconds
                </p>
              </div>
            )}

            {}
            {!loading && error && (
              <div className="py-6 space-y-4">
                <div className="border border-[#EF4444]/30 bg-[#EF4444]/5 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-[#EF4444] text-xl">⚠</span>
                    <div>
                      <h4
                        className="text-[#EF4444] text-xs uppercase tracking-wider mb-1"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        Analysis Failed
                      </h4>
                      <p
                        className="text-[#E8E4D9] text-sm leading-relaxed"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
                {onRetry && (
                  <RevealButton
                    label="Retry Analysis"
                    onClick={onRetry}
                    variant="secondary"
                  />
                )}
              </div>
            )}

            {}
            {!loading && !error && !feedback && (
              <div className="flex flex-col items-center justify-center py-12">
                <svg
                  className="w-12 h-12 text-[#3D3D3D] mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <p
                  className="text-[#78716C] text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  No feedback available
                </p>
              </div>
            )}

            {}
            {!loading && !error && feedback && (
              <div className="space-y-4">
                {}
                {feedback.feedbackType === "success_feedback" && (
                  <div className="border border-[#22C55E]/30 bg-[#22C55E]/5 p-3 rounded-lg">
                    <p
                      className="text-[#22C55E] text-sm"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      ✓ Great job! Here are some tips to improve further.
                    </p>
                  </div>
                )}

                {}
                <div className="space-y-3">
                  <h4
                    className="text-[#78716C] text-[10px] uppercase tracking-wider flex items-center gap-2"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
                    Hints ({feedback.hints?.length || 0} of{" "}
                    {feedback.allHintsCount})
                  </h4>

                  {feedback.hints?.map((hint, index) => (
                    <HintCard
                      key={`hint-${hint.level}`}
                      hint={hint}
                      index={index}
                      isLatest={index === feedback.hints.length - 1}
                    />
                  ))}
                </div>

                {}
                {hasMoreHints && (
                  <RevealButton
                    label={nextHintLabel}
                    onClick={onRevealNextHint}
                    variant="primary"
                  />
                )}

                {}
                {feedback.detectedPattern && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowPattern(!showPattern)}
                      className="w-full flex items-center justify-between py-2 text-[#78716C] hover:text-[#D97706] transition-colors"
                    >
                      <span
                        className="text-[10px] uppercase tracking-wider"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        Detected Pattern
                      </span>
                      <motion.svg
                        animate={{ rotate: showPattern ? 180 : 0 }}
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </motion.svg>
                    </button>

                    <AnimatePresence>
                      {showPattern && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border border-[#EC4899]/30 bg-[#EC4899]/5 p-3 rounded-lg mt-2">
                            <p
                              className="text-[#E8E4D9] text-sm"
                              style={{
                                fontFamily: "'Rajdhani', system-ui, sans-serif",
                              }}
                            >
                              {feedback.detectedPattern}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ✨ MIM V3.0 Insights - Machine Learning Predictions (NO LLM calls) */}
                {feedback.mimInsights && (
                  <div className="pt-4 border-t border-[#1A1814]">
                    {/* Use V3 component if feedbackType is available, otherwise fallback to legacy */}
                    {feedback.mimInsights.feedbackType ? (
                      <MIMInsightsV3
                        insights={feedback.mimInsights}
                        expanded={true}
                      />
                    ) : (
                      <MIMInsights
                        insights={{
                          root_cause:
                            feedback.mimInsights.root_cause ||
                            feedback.mimInsights.rootCause,
                          readiness_scores: feedback.mimInsights.readiness
                            ? {
                                easy: feedback.mimInsights.readiness
                                  .easy_readiness,
                                medium:
                                  feedback.mimInsights.readiness
                                    .medium_readiness,
                                hard: feedback.mimInsights.readiness
                                  .hard_readiness,
                              }
                            : {},
                          similar_mistakes: [],
                          recommended_focus: [],
                        }}
                        expanded={false}
                      />
                    )}
                  </div>
                )}

                {/* Full Explanation Toggle - v3.3 Enhanced with Correct Code */}
                {(feedback.hasExplanation || feedback.correctCode) &&
                  !hasMoreHints && (
                    <div className="pt-4 border-t border-[#1A1814]">
                      <RevealButton
                        label={
                          showFullExplanation
                            ? "Hide full explanation"
                            : "Show full explanation"
                        }
                        onClick={onToggleExplanation}
                        variant="secondary"
                      />

                      <AnimatePresence>
                        {showFullExplanation && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-4 space-y-4"
                          >
                            {/* Explanation Text */}
                            {feedback.explanation && (
                              <div className="border border-[#3D3D3D]/50 bg-[#0D0D0B] p-4 rounded-lg">
                                <h5
                                  className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  Full Explanation
                                </h5>
                                <p
                                  className="text-[#E8E4D9] text-sm leading-relaxed whitespace-pre-wrap"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  {feedback.explanation}
                                </p>
                              </div>
                            )}

                            {/* v3.3: Root Cause Analysis */}
                            {(feedback.rootCauseSubtype ||
                              feedback.failureMechanism) && (
                              <div className="border border-[#EF4444]/30 bg-[#EF4444]/5 p-4 rounded-lg">
                                <h5
                                  className="text-[#EF4444] text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
                                  Root Cause
                                </h5>
                                {feedback.rootCauseSubtype && (
                                  <p
                                    className="text-[#E8E4D9] text-sm mb-2"
                                    style={{
                                      fontFamily:
                                        "'Rajdhani', system-ui, sans-serif",
                                    }}
                                  >
                                    <span className="text-[#EF4444] font-semibold">
                                      {feedback.rootCauseSubtype
                                        .replace(/_/g, " ")
                                        .replace(/\b\w/g, (l) =>
                                          l.toUpperCase(),
                                        )}
                                    </span>
                                  </p>
                                )}
                                {feedback.failureMechanism && (
                                  <p
                                    className="text-[#E8E4D9]/80 text-sm leading-relaxed"
                                    style={{
                                      fontFamily:
                                        "'Rajdhani', system-ui, sans-serif",
                                    }}
                                  >
                                    {feedback.failureMechanism}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* v3.3: Correct Code Solution */}
                            {feedback.correctCode && (
                              <div className="space-y-2">
                                <h5
                                  className="text-[#22C55E] text-[10px] uppercase tracking-wider flex items-center gap-2"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                                  Correct Solution
                                </h5>
                                <CodeBlock
                                  code={feedback.correctCode}
                                  language={feedback.language || "Solution"}
                                />
                                {feedback.correctCodeExplanation && (
                                  <p
                                    className="text-[#78716C] text-xs leading-relaxed mt-2"
                                    style={{
                                      fontFamily:
                                        "'Rajdhani', system-ui, sans-serif",
                                    }}
                                  >
                                    {feedback.correctCodeExplanation}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* v3.3: Concept Reinforcement */}
                            {feedback.conceptReinforcement && (
                              <div className="border border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-4 rounded-lg">
                                <h5
                                  className="text-[#8B5CF6] text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"></span>
                                  Key Concept
                                </h5>
                                <p
                                  className="text-[#E8E4D9] text-sm leading-relaxed"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  {feedback.conceptReinforcement}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                {}
                {feedback.optimizationTips?.length > 0 && (
                  <div className="pt-4 border-t border-[#1A1814]">
                    <h4
                      className="text-[#78716C] text-[10px] uppercase tracking-wider mb-3 flex items-center gap-2"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]"></span>
                      Optimization Tips
                    </h4>
                    <ul className="space-y-2">
                      {feedback.optimizationTips.map((tip, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-[#E8E4D9] text-sm"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          <span className="text-[#06B6D4]">→</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
