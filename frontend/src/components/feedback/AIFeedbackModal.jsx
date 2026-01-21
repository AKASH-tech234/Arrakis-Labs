// src/components/feedback/AIFeedbackModal.jsx
// AI Feedback Modal with Progressive Hint Disclosure
// Anti-spoiler pattern: reveal information step-by-step

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ConfidenceBadge from "./ConfidenceBadge";

/**
 * Progressive Hint Disclosure Component
 *
 * UI Flow:
 * 1. Show: Explanation only
 * 2. User clicks "Show Hint" → Reveal: improvement_hint
 * 3. User clicks "Why?" → Reveal: detected_pattern (if present)
 *
 * RULES:
 * - Never reveal everything at once
 * - Maintain user agency
 * - No additional AI calls
 */
function ProgressiveHintDisclosure({
  feedback,
  showHint,
  showPattern,
  onShowHint,
  onShowPattern,
}) {
  if (!feedback) return null;

  return (
    <div className="space-y-4">
      {/* Level 1: Always visible - Explanation */}
      <div className="space-y-2">
        <h4
          className="text-[#78716C] text-[10px] uppercase tracking-wider flex items-center gap-2"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          <span className="w-2 h-2 rounded-full bg-[#D97706]"></span>
          Analysis
        </h4>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#E8E4D9] text-sm leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {feedback.explanation}
        </motion.p>
      </div>

      {/* Level 2: Improvement Hint (revealed on demand) */}
      {!showHint && feedback.improvement_hint && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onShowHint}
          className="w-full py-3 border border-[#92400E]/30 text-[#D97706] hover:bg-[#92400E]/10 transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
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
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Show Improvement Hint
        </motion.button>
      )}

      {showHint && feedback.improvement_hint && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <h4
            className="text-[#78716C] text-[10px] uppercase tracking-wider flex items-center gap-2"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
            Improvement Hint
          </h4>
          <div className="border-l-2 border-[#F59E0B]/40 pl-4 py-2">
            <p
              className="text-[#E8E4D9] text-sm leading-relaxed"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {feedback.improvement_hint}
            </p>
          </div>

          {/* Additional hint from hint_agent (if present) */}
          {feedback.hint && (
            <div className="border-l-2 border-[#78716C]/40 pl-4 py-2 mt-2">
              <p
                className="text-[#A8A29E] text-xs leading-relaxed italic"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                💡 {feedback.hint}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Level 3: Pattern Detection (revealed on demand) */}
      {showHint && !showPattern && feedback.detected_pattern && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onShowPattern}
          className="w-full py-3 border border-[#3D3D3D]/50 text-[#78716C] hover:border-[#92400E]/30 hover:text-[#D97706] transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
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
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Why am I making this mistake?
        </motion.button>
      )}

      {showPattern && feedback.detected_pattern && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <h4
            className="text-[#78716C] text-[10px] uppercase tracking-wider flex items-center gap-2"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
            Detected Pattern
          </h4>
          <div className="border border-[#92400E]/30 bg-[#92400E]/5 p-4 rounded">
            <p
              className="text-[#E8E4D9] text-sm leading-relaxed"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {feedback.detected_pattern}
            </p>
            <p
              className="text-[#78716C] text-xs mt-2 italic"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              This pattern has been recorded to help track your learning
              progress.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * AI Feedback Modal Component
 *
 * Features:
 * - Progressive hint disclosure (anti-spoiler)
 * - Confidence badge integration
 * - Loading/error states
 * - Graceful degradation on AI failures
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message
 * @param {Object} props.feedback - AI feedback response
 * @param {Object} props.confidenceBadge - Confidence badge data
 * @param {Function} props.onViewWeeklyReport - Handler to view weekly report
 */
export default function AIFeedbackModal({
  isOpen,
  onClose,
  loading = false,
  error = null,
  feedback = null,
  confidenceBadge = null,
  onViewWeeklyReport = null,
}) {
  // Progressive disclosure state
  const [showHint, setShowHint] = useState(false);
  const [showPattern, setShowPattern] = useState(false);

  // Reset disclosure state when feedback changes
  const handleClose = useCallback(() => {
    setShowHint(false);
    setShowPattern(false);
    onClose?.();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-lg border border-[#1A1814]"
          style={{ backgroundColor: "#0A0A08" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1814] sticky top-0 bg-[#0A0A08] z-10">
            <div className="flex items-center gap-3">
              <span
                className="text-[#E8E4D9] text-sm uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                AI Analysis
              </span>
              {confidenceBadge && (
                <ConfidenceBadge badge={confidenceBadge} size="small" />
              )}
            </div>
            <button
              onClick={handleClose}
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

          {/* Content */}
          <div className="p-6">
            {/* Loading State */}
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

            {/* Error State - Graceful Degradation */}
            {!loading && error && (
              <div className="py-8">
                <div className="border border-[#92400E]/30 bg-[#92400E]/5 p-4 rounded">
                  <h4
                    className="text-[#D97706] text-xs uppercase tracking-wider mb-2"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Analysis Unavailable
                  </h4>
                  <p
                    className="text-[#E8E4D9] text-sm leading-relaxed"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {error}
                  </p>
                  <p
                    className="text-[#78716C] text-xs mt-3"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Your submission was recorded. You can try again later or
                    continue practicing.
                  </p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && !feedback && (
              <div className="flex flex-col items-center justify-center py-12">
                <p
                  className="text-[#78716C] text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  No feedback available
                </p>
              </div>
            )}

            {/* Feedback Content with Progressive Disclosure */}
            {!loading && !error && feedback && (
              <div className="space-y-6">
                <ProgressiveHintDisclosure
                  feedback={feedback}
                  showHint={showHint}
                  showPattern={showPattern}
                  onShowHint={() => setShowHint(true)}
                  onShowPattern={() => setShowPattern(true)}
                />

                {/* Weekly Report CTA (optional) */}
                {onViewWeeklyReport && (
                  <div className="pt-4 border-t border-[#1A1814]">
                    <button
                      onClick={onViewWeeklyReport}
                      className="w-full py-3 border border-[#3D3D3D]/50 text-[#78716C] hover:border-[#D97706]/30 hover:text-[#D97706] transition-all duration-200 text-xs uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      View Weekly Progress Report
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export { ProgressiveHintDisclosure };
