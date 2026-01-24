// src/components/mim/MIMInsights.jsx
// Displays MIM root cause prediction and insights in feedback view
import { motion, AnimatePresence } from "framer-motion";

const rootCauseLabels = {
  boundary_condition_blindness: "Boundary Condition Issue",
  off_by_one_error: "Off-by-One Error",
  integer_overflow: "Integer Overflow",
  wrong_data_structure: "Wrong Data Structure",
  logic_error: "Logic Error",
  time_complexity_issue: "Time Complexity Issue",
  recursion_issue: "Recursion Issue",
  comparison_error: "Comparison Error",
  algorithm_choice: "Algorithm Choice",
  edge_case_handling: "Edge Case Handling",
  input_parsing: "Input Parsing Error",
  misread_problem: "Misread Problem",
  partial_solution: "Partial Solution",
  type_error: "Type Error",
  unknown: "Unknown Issue",
};

const ConfidenceBadge = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  let bgColor = "bg-[#78716C]/20";
  let textColor = "text-[#78716C]";
  let label = "Low";

  if (percentage >= 70) {
    bgColor = "bg-[#22C55E]/20";
    textColor = "text-[#22C55E]";
    label = "High";
  } else if (percentage >= 40) {
    bgColor = "bg-[#D97706]/20";
    textColor = "text-[#D97706]";
    label = "Medium";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${bgColor} ${textColor}`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {percentage}% {label}
    </span>
  );
};

const SimilarMistake = ({ mistake, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.1 }}
    className="flex items-start gap-3 py-2 border-b border-[#D97706]/10 last:border-0"
  >
    <span className="text-[#D97706] text-xs mt-0.5">#{index + 1}</span>
    <div className="flex-1">
      <p className="text-[#E8E4D9] text-xs">
        {mistake.problem_title || mistake.problem_id}
      </p>
      <p className="text-[#78716C] text-[10px] mt-0.5">
        {mistake.root_cause || "Similar pattern"}
      </p>
    </div>
    <span className="text-[#78716C] text-[10px]">
      {mistake.days_ago || "Recently"}
    </span>
  </motion.div>
);

export default function MIMInsights({ insights, expanded = false }) {
  if (!insights) return null;

  const {
    root_cause = {},
    readiness_scores = {},
    similar_mistakes = [],
    recommended_focus = [],
  } = insights;

  const { failure_cause, confidence = 0 } = root_cause;
  const causeLabel =
    rootCauseLabels[failure_cause] || failure_cause || "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#D97706]/10 flex items-center gap-2">
        <span className="text-[#D97706]">🧠</span>
        <span
          className="text-[#E8E4D9] text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          MIM Analysis
        </span>
      </div>

      <div className="p-4">
        {/* Root Cause */}
        {failure_cause && (
          <div className="mb-4">
            <p
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Predicted Root Cause
            </p>
            <div className="flex items-center gap-3">
              <span
                className="text-[#F59E0B] text-sm font-semibold"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {causeLabel}
              </span>
              <ConfidenceBadge confidence={confidence} />
            </div>
          </div>
        )}

        {/* Readiness Scores (compact) */}
        {Object.keys(readiness_scores).length > 0 && expanded && (
          <div className="mb-4">
            <p
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Your Readiness
            </p>
            <div className="flex gap-4">
              {Object.entries(readiness_scores).map(([level, score]) => (
                <div key={level} className="text-center">
                  <div className="text-[#E8E4D9] text-sm font-semibold">
                    {Math.round(score * 100)}%
                  </div>
                  <div className="text-[#78716C] text-[10px] uppercase">
                    {level}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Mistakes */}
        {similar_mistakes.length > 0 && expanded && (
          <div className="mb-4">
            <p
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Similar Past Mistakes
            </p>
            <div className="bg-[#1A1814]/40 rounded p-3">
              {similar_mistakes.slice(0, 3).map((mistake, i) => (
                <SimilarMistake key={i} mistake={mistake} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended Focus */}
        {recommended_focus.length > 0 && expanded && (
          <div>
            <p
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Focus Areas
            </p>
            <div className="flex flex-wrap gap-2">
              {recommended_focus.map((focus, i) => (
                <motion.span
                  key={focus}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="inline-flex items-center px-2 py-1 rounded bg-[#D97706]/10 border border-[#D97706]/20 text-[#D97706] text-[10px] uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {focus}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {/* Confidence note */}
        {confidence < 0.5 && (
          <p className="text-[#78716C] text-[10px] mt-3 italic">
            ⚠ Low confidence prediction. Complete more problems for better
            analysis.
          </p>
        )}
      </div>
    </motion.div>
  );
}
