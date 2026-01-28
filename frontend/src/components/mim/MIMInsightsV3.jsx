// src/components/mim/MIMInsightsV3.jsx
// MIM V3.0 - Polymorphic Feedback Display Component
// Handles: correctness, performance, and reinforcement feedback types
//
// Phase 2.x Upgrade: Now displays canonical fields:
// - diagnosis: Root cause classification (FACT from MIM)
// - confidence: Calibrated confidence metadata (Phase 2.1)
// - pattern: Pattern state machine output (Phase 2.2)
// - difficulty: Difficulty policy decision (Phase 2.3)

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  CONFIDENCE_COLORS,
  CONFIDENCE_LABELS,
  PATTERN_STATE_MESSAGES,
  getDifficultyMessage,
  shouldShowPattern,
} from "../../types/ai.types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// V3.0 ROOT CAUSE LABELS
// ═══════════════════════════════════════════════════════════════════════════════

const ROOT_CAUSE_CONFIG = {
  correctness: {
    label: "Correctness Issue",
    icon: "❌",
    color: "#EF4444",
    description: "Your logic produces incorrect output",
  },
  efficiency: {
    label: "Performance Issue",
    icon: "⏱️",
    color: "#F59E0B",
    description: "Your solution is too slow or uses too much memory",
  },
  implementation: {
    label: "Implementation Issue",
    icon: "🔧",
    color: "#8B5CF6",
    description: "Correct approach but implementation has bugs",
  },
  understanding_gap: {
    label: "Understanding Gap",
    icon: "📚",
    color: "#3B82F6",
    description: "Fundamental concept needs review",
  },
  problem_misinterpretation: {
    label: "Problem Misinterpretation",
    icon: "🤔",
    color: "#EC4899",
    description: "Your code doesn't match the problem's requirements",
  },
  reinforcement: {
    label: "Skill Reinforced",
    icon: "✅",
    color: "#22C55E",
    description: "Great job! This success strengthens your skills",
  },
};

const SUBTYPE_LABELS = {
  // Correctness subtypes
  logic_error: "Logic Error",
  edge_case_handling: "Edge Case Handling",
  off_by_one: "Off-by-One Error",
  boundary_condition: "Boundary Condition",
  comparison_error: "Comparison Error",
  wrong_invariant: "Wrong Invariant",
  incorrect_boundary: "Incorrect Boundary",
  partial_case_handling: "Partial Case Handling",
  // Implementation subtypes
  syntax_error: "Syntax Error",
  type_error: "Type Error",
  null_handling: "Null Handling",
  state_loss: "State Loss",
  // Understanding subtypes
  concept_confusion: "Concept Confusion",
  algorithm_misapplication: "Wrong Algorithm",
  misread_constraint: "Misread Constraint",
  // Efficiency subtypes
  time_complexity: "Time Complexity",
  space_complexity: "Space Complexity",
  redundant_operations: "Redundant Operations",
  brute_force_under_constraints: "Brute Force Under Constraints",
  premature_optimization: "Premature Optimization",
  // Problem misinterpretation subtypes (V3.1 NEW)
  wrong_input_format: "Wrong Input Format",
  wrong_problem_entirely: "Wrong Problem Entirely",
  misread_constraints: "Misread Constraints",
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE BADGE COMPONENT (Updated for Phase 2.1)
// ═══════════════════════════════════════════════════════════════════════════════

function ConfidenceBadge({ confidence, confidenceLevel }) {
  // Use API-provided confidence level if available (Phase 2.1)
  let level = confidenceLevel;
  let percentage = null;

  if (typeof confidence === "number") {
    percentage = Math.round(confidence * 100);
    // Derive level from score if not provided
    if (!level) {
      level = confidence >= 0.8 ? "high" : confidence >= 0.65 ? "medium" : "low";
    }
  }

  const color = CONFIDENCE_COLORS[level] || CONFIDENCE_COLORS.medium;
  const label = CONFIDENCE_LABELS[level] || CONFIDENCE_LABELS.medium;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider"
      style={{
        fontFamily: "'Rajdhani', system-ui, sans-serif",
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {percentage !== null ? `${percentage}% ` : ""}{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2.x CANONICAL DISPLAY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Displays Phase 2.1 confidence metadata
 */
function ConfidenceMetadataSection({ confidence }) {
  if (!confidence) return null;

  const { confidenceLevel, combinedConfidence, conservativeMode, calibrationApplied } = confidence;
  const color = CONFIDENCE_COLORS[confidenceLevel] || CONFIDENCE_COLORS.medium;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ConfidenceBadge
        confidence={combinedConfidence}
        confidenceLevel={confidenceLevel}
      />
      {calibrationApplied && (
        <span className="text-[#78716C] text-[10px]" title="Calibrated confidence">
          ✓ calibrated
        </span>
      )}
      {conservativeMode && (
        <span className="text-[#F59E0B] text-[10px]">
          (conservative mode)
        </span>
      )}
    </div>
  );
}

/**
 * Displays Phase 2.2 pattern state
 */
function PatternStateSection({ pattern }) {
  if (!pattern || !shouldShowPattern(pattern.state)) return null;

  const { state, evidenceCount } = pattern;
  const message = PATTERN_STATE_MESSAGES[state];

  if (!message) return null;

  const stateColors = {
    suspected: "#F59E0B",
    confirmed: "#EF4444",
    stable: "#22C55E",
  };
  const color = stateColors[state] || "#78716C";

  return (
    <div
      className="mt-3 p-2 rounded border"
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      <p
        className="text-xs"
        style={{
          color: color,
          fontFamily: "'Rajdhani', system-ui, sans-serif",
        }}
      >
        {state === "confirmed" || state === "stable" ? "⚠️ " : "🔍 "}
        {message}
        {(state === "confirmed" || state === "stable") && evidenceCount > 0 && (
          <span className="ml-1 opacity-75">({evidenceCount}x)</span>
        )}
      </p>
    </div>
  );
}

/**
 * Displays Phase 2.3 difficulty decision
 */
function DifficultyDecisionSection({ difficulty }) {
  if (!difficulty || difficulty.action === "maintain") return null;

  const { action, reason } = difficulty;
  const message = getDifficultyMessage(action, reason);

  const actionColors = {
    increase: "#22C55E",
    decrease: "#3B82F6",
  };
  const color = actionColors[action] || "#78716C";
  const icon = action === "increase" ? "📈" : "📉";

  return (
    <div
      className="mt-3 p-2 rounded border"
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      <p
        className="text-xs"
        style={{
          color: color,
          fontFamily: "'Rajdhani', system-ui, sans-serif",
        }}
      >
        {icon} {message}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECURRING WARNING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function RecurringWarning({ count, relatedProblems = [] }) {
  if (count <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 p-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/5"
    >
      <div className="flex items-start gap-2">
        <span className="text-[#F59E0B]">⚠️</span>
        <div>
          <p
            className="text-[#F59E0B] text-xs font-semibold"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Recurring Pattern Detected
          </p>
          <p
            className="text-[#E8E4D9] text-xs mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            You've made this type of mistake <strong>{count}</strong> times.
            Focus on this pattern to improve faster!
          </p>
          {relatedProblems.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {relatedProblems.slice(0, 3).map((problemId, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-[#F59E0B]/10 rounded text-[10px] text-[#F59E0B]"
                >
                  {problemId}
                </span>
              ))}
              {relatedProblems.length > 3 && (
                <span className="text-[#78716C] text-[10px]">
                  +{relatedProblems.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRECTNESS FEEDBACK SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function CorrectnessFeedbackSection({ feedback }) {
  const [showFix, setShowFix] = useState(false);

  if (!feedback) return null;

  // Handle both snake_case and camelCase from backend
  const rootCause = feedback.rootCause || feedback.root_cause;
  const subtype = feedback.subtype;
  const confidence = feedback.confidence;
  const failureMechanism =
    feedback.failureMechanism || feedback.failure_mechanism;
  const explanation = feedback.explanation;
  const fixDirection = feedback.fixDirection || feedback.fix_direction;
  const exampleFix = feedback.exampleFix || feedback.example_fix;
  const isRecurring = feedback.isRecurring || feedback.is_recurring;
  const recurrenceCount =
    feedback.recurrenceCount || feedback.recurrence_count || 0;
  const relatedProblems =
    feedback.relatedProblems || feedback.related_problems || [];

  const config = ROOT_CAUSE_CONFIG[rootCause] || ROOT_CAUSE_CONFIG.correctness;
  const subtypeLabel = SUBTYPE_LABELS[subtype] || subtype;

  return (
    <div className="space-y-4">
      {/* Root Cause Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold"
              style={{
                color: config.color,
                fontFamily: "'Rajdhani', system-ui, sans-serif",
              }}
            >
              {config.label}
            </span>
            {confidence && <ConfidenceBadge confidence={confidence} />}
          </div>
          <p
            className="text-[#78716C] text-xs mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {config.description}
          </p>
        </div>
      </div>

      {/* Subtype Badge */}
      {subtype && (
        <div className="flex items-center gap-2">
          <span className="text-[#78716C] text-[10px] uppercase tracking-wider">
            Type:
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: `${config.color}20`,
              color: config.color,
              fontFamily: "'Rajdhani', system-ui, sans-serif",
            }}
          >
            {subtypeLabel}
          </span>
        </div>
      )}

      {/* Failure Mechanism */}
      {failureMechanism && (
        <div className="p-3 rounded-lg bg-[#1A1814] border border-[#3D3D3D]/30">
          <p
            className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            What Went Wrong
          </p>
          <p
            className="text-[#E8E4D9] text-sm"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {failureMechanism}
          </p>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div
          className="p-3 rounded-lg bg-[#1A1814]/50 border-l-2"
          style={{ borderColor: config.color }}
        >
          <p
            className="text-[#E8E4D9] text-sm leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {explanation}
          </p>
        </div>
      )}

      {/* Fix Direction */}
      {fixDirection && (
        <div className="mt-3">
          <button
            onClick={() => setShowFix(!showFix)}
            className="w-full py-2 px-3 border border-[#22C55E]/30 rounded-lg text-[#22C55E] text-xs uppercase tracking-wider flex items-center justify-between hover:bg-[#22C55E]/5 transition-colors"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <span>💡 How to Fix</span>
            <span>{showFix ? "−" : "+"}</span>
          </button>
          <AnimatePresence>
            {showFix && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 mt-2 rounded-lg bg-[#22C55E]/5 border border-[#22C55E]/20">
                  <p
                    className="text-[#E8E4D9] text-sm"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {fixDirection}
                  </p>
                  {/* Example Fix Code */}
                  {exampleFix && (
                    <pre className="mt-2 p-2 rounded bg-[#0A0A08] text-[#22C55E] text-xs overflow-x-auto">
                      <code>{exampleFix}</code>
                    </pre>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recurring Warning */}
      <RecurringWarning
        count={recurrenceCount}
        relatedProblems={relatedProblems}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE FEEDBACK SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function PerformanceFeedbackSection({ feedback }) {
  if (!feedback) return null;

  // Handle both snake_case and camelCase
  const subtype = feedback.subtype;
  const failureMechanism =
    feedback.failureMechanism || feedback.failure_mechanism;
  const observedComplexity =
    feedback.observedComplexity || feedback.observed_complexity;
  const expectedComplexity =
    feedback.expectedComplexity || feedback.expected_complexity;
  const optimizationDirection =
    feedback.optimizationDirection || feedback.optimization_direction;

  const config = ROOT_CAUSE_CONFIG.efficiency;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <span
            className="text-sm font-semibold"
            style={{
              color: config.color,
              fontFamily: "'Rajdhani', system-ui, sans-serif",
            }}
          >
            {config.label}
          </span>
          <p
            className="text-[#78716C] text-xs mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {config.description}
          </p>
        </div>
      </div>

      {/* Subtype if present */}
      {subtype && (
        <div className="flex items-center gap-2">
          <span className="text-[#78716C] text-[10px] uppercase tracking-wider">
            Issue Type:
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: `${config.color}20`,
              color: config.color,
              fontFamily: "'Rajdhani', system-ui, sans-serif",
            }}
          >
            {SUBTYPE_LABELS[subtype] || subtype}
          </span>
        </div>
      )}

      {/* Failure Mechanism */}
      {failureMechanism && (
        <div className="p-3 rounded-lg bg-[#1A1814] border border-[#3D3D3D]/30">
          <p
            className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            What Happened
          </p>
          <p
            className="text-[#E8E4D9] text-sm"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {failureMechanism}
          </p>
        </div>
      )}

      {/* Complexity Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20">
          <p className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1">
            Your Complexity
          </p>
          <p className="text-[#EF4444] text-lg font-mono">
            {observedComplexity || "O(n²)"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[#22C55E]/5 border border-[#22C55E]/20">
          <p className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1">
            Expected
          </p>
          <p className="text-[#22C55E] text-lg font-mono">
            {expectedComplexity || "O(n log n)"}
          </p>
        </div>
      </div>

      {/* Optimization Direction */}
      {optimizationDirection && (
        <div className="p-3 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/20">
          <p className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2">
            Optimization Strategy
          </p>
          <p
            className="text-[#E8E4D9] text-sm leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {optimizationDirection}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REINFORCEMENT FEEDBACK SECTION (ACCEPTED SUBMISSIONS)
// ═══════════════════════════════════════════════════════════════════════════════

function ReinforcementFeedbackSection({ feedback }) {
  if (!feedback) return null;

  // Handle both snake_case and camelCase
  const category = feedback.category;
  const technique = feedback.technique;
  const difficulty = feedback.difficulty;
  const confidenceBoost = feedback.confidenceBoost || feedback.confidence_boost;
  const strengthSignal = feedback.strengthSignal || feedback.strength_signal;

  const config = ROOT_CAUSE_CONFIG.reinforcement;

  return (
    <div className="space-y-4">
      {/* Success Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <span
            className="text-sm font-semibold"
            style={{
              color: config.color,
              fontFamily: "'Rajdhani', system-ui, sans-serif",
            }}
          >
            {config.label}
          </span>
          <p
            className="text-[#78716C] text-xs mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {config.description}
          </p>
        </div>
      </div>

      {/* Skill Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-[#22C55E]/5 border border-[#22C55E]/20">
          <p className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1">
            Category
          </p>
          <p className="text-[#E8E4D9] text-sm capitalize">
            {category || "Problem Solving"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[#3B82F6]/5 border border-[#3B82F6]/20">
          <p className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1">
            Technique
          </p>
          <p className="text-[#E8E4D9] text-sm capitalize">
            {technique || "Algorithmic Thinking"}
          </p>
        </div>
      </div>

      {/* Difficulty Badge */}
      {difficulty && (
        <div className="flex items-center gap-2">
          <span className="text-[#78716C] text-[10px] uppercase tracking-wider">
            Difficulty Solved:
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs capitalize"
            style={{
              backgroundColor:
                difficulty === "hard"
                  ? "#EF444420"
                  : difficulty === "medium"
                    ? "#F59E0B20"
                    : "#22C55E20",
              color:
                difficulty === "hard"
                  ? "#EF4444"
                  : difficulty === "medium"
                    ? "#F59E0B"
                    : "#22C55E",
              fontFamily: "'Rajdhani', system-ui, sans-serif",
            }}
          >
            {difficulty}
          </span>
        </div>
      )}

      {/* Confidence Boost */}
      {confidenceBoost && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#22C55E]/5 border border-[#22C55E]/20">
          <span className="text-[#22C55E] text-2xl">📈</span>
          <div>
            <p className="text-[#78716C] text-[10px] uppercase tracking-wider">
              Skill Boost
            </p>
            <p className="text-[#22C55E] text-lg font-semibold">
              +{Math.round(confidenceBoost * 100)}%
            </p>
          </div>
          {strengthSignal && (
            <p className="flex-1 text-[#E8E4D9] text-xs text-right">
              {strengthSignal}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - MIMInsightsV3
// ═══════════════════════════════════════════════════════════════════════════════

export default function MIMInsightsV3({ insights, expanded = true }) {
  if (!insights) return null;

  const {
    feedbackType,
    correctnessFeedback,
    performanceFeedback,
    reinforcementFeedback,
    // Phase 2.x canonical fields
    diagnosis,
    confidence,
    pattern,
    difficulty,
    // Legacy fields
    rootCause,
    readiness,
    isColdStart,
    modelVersion,
  } = insights;

  // Determine which section to show based on feedbackType
  const renderFeedbackSection = () => {
    switch (feedbackType) {
      case "reinforcement":
        return (
          <ReinforcementFeedbackSection feedback={reinforcementFeedback} />
        );
      case "efficiency":
        return <PerformanceFeedbackSection feedback={performanceFeedback} />;
      case "correctness":
      case "implementation":
      case "understanding_gap":
        return <CorrectnessFeedbackSection feedback={correctnessFeedback} />;
      default:
        // Fallback to legacy display if no V3 data
        if (rootCause?.failure_cause || rootCause?.failureCause) {
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[#F59E0B]">🎯</span>
                <span className="text-[#E8E4D9] text-sm">
                  {rootCause.failure_cause || rootCause.failureCause}
                </span>
                {(rootCause.confidence || rootCause.confidence === 0) && (
                  <ConfidenceBadge confidence={rootCause.confidence} />
                )}
              </div>
            </div>
          );
        }
        return (
          <p className="text-[#78716C] text-xs">
            No detailed analysis available
          </p>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#D97706]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#D97706]">🧠</span>
          <span
            className="text-[#E8E4D9] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            MIM V3.0 Analysis
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isColdStart && (
            <span
              className="px-2 py-0.5 rounded text-[10px] bg-[#3B82F6]/20 text-[#3B82F6]"
              title="Limited data - predictions may improve with more submissions"
            >
              Cold Start
            </span>
          )}
          {modelVersion && (
            <span className="text-[#78716C] text-[10px]">{modelVersion}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {renderFeedbackSection()}

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* Phase 2.x Canonical Sections */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        
        {/* Phase 2.1: Confidence Metadata */}
        {confidence && expanded && (
          <div className="mt-4 pt-4 border-t border-[#3D3D3D]/30">
            <p
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Diagnosis Confidence
            </p>
            <ConfidenceMetadataSection confidence={confidence} />
          </div>
        )}

        {/* Phase 2.2: Pattern State */}
        {pattern && expanded && (
          <PatternStateSection pattern={pattern} />
        )}

        {/* Phase 2.3: Difficulty Decision */}
        {difficulty && expanded && (
          <DifficultyDecisionSection difficulty={difficulty} />
        )}

        {/* Readiness Section (Legacy) */}
        {readiness && expanded && (
          <div className="mt-4 pt-4 border-t border-[#3D3D3D]/30">
            <p
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Your Readiness
            </p>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-[#E8E4D9] text-sm font-semibold">
                  {readiness.currentLevel || readiness.current_level || "N/A"}
                </div>
                <div className="text-[#78716C] text-[10px]">Current Level</div>
              </div>
              {readiness.recommendation && (
                <div className="flex-1 text-[#78716C] text-xs">
                  {readiness.recommendation}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
