// ═══════════════════════════════════════════════════════════════════════════════
// AI FEEDBACK RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════
// 
// These types mirror backend/src/types/AIFeedbackResponse.js
// Frontend should treat diagnosis, confidence, pattern, difficulty as FACTS from MIM
//
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2.x CANONICAL TYPES (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Root cause classification from MIM (deterministic, ML-based)
 * @typedef {"correctness" | "efficiency" | "implementation" | "understanding_gap"} RootCause
 */

/**
 * Diagnosis information from MIM - THIS IS A FACT, NOT A GUESS
 * @typedef {Object} DiagnosisDTO
 * @property {RootCause} rootCause - Primary failure category
 * @property {string} subtype - Granular failure classification (e.g., "off_by_one", "wrong_complexity")
 * @property {string} failureMechanism - Human-readable explanation of what went wrong
 */

/**
 * Confidence level tier
 * @typedef {"high" | "medium" | "low"} ConfidenceLevel
 */

/**
 * Calibrated confidence metadata from MIM (Phase 2.1)
 * 
 * UI RULES:
 * - HIGH (>=0.80): Green badge, direct language
 * - MEDIUM (>=0.65): Yellow badge, cautious language  
 * - LOW (<0.65): Grey badge, hedging language ("may", "possibly")
 * 
 * @typedef {Object} ConfidenceDTO
 * @property {number} combinedConfidence - Combined calibrated confidence (0.0 - 1.0)
 * @property {ConfidenceLevel} confidenceLevel - Confidence tier for decision-making
 * @property {boolean} conservativeMode - True if confidence too low for aggressive decisions
 * @property {boolean} calibrationApplied - Whether isotonic calibration was applied
 */

/**
 * Pattern state from state machine (Phase 2.2)
 * 
 * UI RULES:
 * - "none": Don't show pattern UI
 * - "suspected": "This may be a recurring pattern"
 * - "confirmed": "This is a confirmed recurring issue" (show evidence_count)
 * - "stable": "You've encountered this pattern before and improved"
 * 
 * IMPORTANT: Never show "recurring" unless state === "confirmed"
 * 
 * @typedef {"none" | "suspected" | "confirmed" | "stable"} PatternState
 */

/**
 * Pattern detection information
 * @typedef {Object} PatternDTO
 * @property {PatternState} state - Current pattern state
 * @property {number} evidenceCount - Number of supporting evidence instances
 * @property {ConfidenceLevel} confidenceSupport - Confidence level of pattern detection
 */

/**
 * Difficulty adjustment action (Phase 2.3)
 * @typedef {"increase" | "maintain" | "decrease"} DifficultyAction
 */

/**
 * Difficulty adjustment decision
 * 
 * UI RULES:
 * - Never say "you should try harder problems"
 * - Only explain system decisions:
 *   - maintain + pattern_unresolved: "Difficulty maintained to reinforce correctness"
 *   - maintain + low_confidence: "Difficulty maintained (diagnosis uncertain)"
 *   - increase: "Difficulty increased due to consistent success"
 *   - decrease: "Difficulty adjusted to strengthen fundamentals"
 * 
 * @typedef {Object} DifficultyDTO
 * @property {DifficultyAction} action - What difficulty change (if any) is recommended
 * @property {string} reason - Why this decision was made
 * @property {string} confidenceTier - Confidence tier that influenced this decision
 */

/**
 * RAG (Retrieval-Augmented Generation) usage metadata
 * 
 * UI RULES:
 * - Only show indicator if used === true
 * - Display subtle text: "Based on your past attempts"
 * - Never show raw memory text or relevance score
 * 
 * @typedef {Object} RAGMetadataDTO
 * @property {boolean} used - Whether RAG was used for this response
 * @property {number} relevance - Relevance score of retrieved content (0.0 - 1.0)
 */

/**
 * LLM-generated feedback content
 * @typedef {Object} FeedbackContentDTO
 * @property {string|null} explanation - Detailed explanation of the issue
 * @property {string|null} correctCode - Example of corrected code
 * @property {string[]|null} edgeCases - Edge cases to consider
 */

/**
 * Hint from hint agent
 * @typedef {Object} HintDTO
 * @property {string} text - Hint text content
 */

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY MIM TYPES (V3.0 - Backward Compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} MIMCorrectnessDTO
 * @property {string} rootCause - correctness, implementation, understanding_gap
 * @property {string} subtype - specific failure subtype
 * @property {string} failureMechanism - deterministic rule output
 * @property {number} confidence - 0.0 - 1.0
 * @property {string} explanation - personalized explanation
 * @property {string} fixDirection - strategy to fix
 * @property {string} exampleFix - code example
 * @property {boolean} isRecurring - repeated mistake?
 * @property {number} recurrenceCount - how many times
 * @property {string[]} relatedProblems - similar past problems
 */

/**
 * @typedef {Object} MIMPerformanceDTO
 * @property {string} rootCause - always "efficiency"
 * @property {string} subtype - efficiency-related subtype
 * @property {string} failureMechanism
 * @property {string} expectedComplexity - Big-O expected
 * @property {string} observedComplexity - Big-O observed
 * @property {string} optimizationDirection - what algorithmic shift needed
 */

/**
 * @typedef {Object} MIMReinforcementDTO
 * @property {string} category - problem category
 * @property {string} technique - technique demonstrated
 * @property {string} difficulty - easy/medium/hard
 * @property {number} confidenceBoost - 0.0 - 1.0
 * @property {string} strengthSignal - what skill this reinforces
 */

/**
 * @typedef {Object} MIMInsightsV3
 * @property {string|null} feedbackType - correctness, efficiency, implementation, understanding_gap, reinforcement
 * @property {MIMCorrectnessDTO|null} correctnessFeedback - For failed submissions
 * @property {MIMPerformanceDTO|null} performanceFeedback - For TLE/MLE
 * @property {MIMReinforcementDTO|null} reinforcementFeedback - For accepted
 * @property {DiagnosisDTO|null} diagnosis - NEW: Phase 2.x diagnosis
 * @property {ConfidenceDTO|null} confidence - NEW: Phase 2.1 calibrated confidence
 * @property {PatternDTO|null} pattern - NEW: Phase 2.2 pattern state
 * @property {DifficultyDTO|null} difficulty - NEW: Phase 2.3 difficulty decision
 * @property {Object|null} rootCause - Legacy: failure_cause, confidence
 * @property {Object|null} readiness - Legacy: currentLevel, recommendation
 * @property {Object|null} performanceForecast - Legacy: predicted outcome
 * @property {boolean} isColdStart - Limited data warning
 * @property {string|null} modelVersion - MIM model version
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RESPONSE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Progressive hint structure
 * @typedef {Object} HintLevel
 * @property {number} level - Hint level (1 = most vague, higher = more specific)
 * @property {string} content - Hint content
 * @property {string} hint_type - Type: "conceptual", "specific", "approach", "solution", "optimization", "pattern"
 */

/**
 * Canonical AI Feedback Response
 * 
 * IMPORTANT: The following fields are FACTS from MIM (treat as authoritative):
 * - diagnosis: Root cause classification
 * - confidence: Calibrated confidence metadata
 * - pattern: Pattern state machine output
 * - difficulty: Difficulty policy decision
 * 
 * LLM-generated content lives in:
 * - feedback: Explanations and code examples
 * - hint: Hint agent output
 * 
 * @typedef {Object} AIFeedbackResponse
 * @property {boolean} success
 * @property {string} verdict
 * @property {string} submissionId
 * @property {string} feedbackType - error_feedback, success_feedback, optimization
 * 
 * @property {DiagnosisDTO|null} diagnosis - NEW: MIM diagnosis (FACT)
 * @property {ConfidenceDTO|null} confidence - NEW: Calibrated confidence (Phase 2.1)
 * @property {PatternDTO|null} pattern - NEW: Pattern state (Phase 2.2)
 * @property {DifficultyDTO|null} difficulty - NEW: Difficulty decision (Phase 2.3)
 * @property {FeedbackContentDTO|null} feedback - NEW: LLM feedback content
 * @property {HintDTO|null} hint - NEW: Hint from agent
 * @property {RAGMetadataDTO|null} rag - NEW: RAG usage metadata
 * 
 * @property {HintLevel[]} hints - Progressive hints array
 * @property {string|null} explanation - Full explanation (legacy)
 * @property {string|null} detectedPattern - Detected pattern name (legacy)
 * @property {string[]|null} optimizationTips - Optimization suggestions
 * @property {string|null} complexityAnalysis - Complexity analysis
 * @property {string[]|null} edgeCases - Edge cases to consider
 * @property {MIMInsightsV3|null} mimInsights - Legacy MIM insights
 */

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Confidence level colors for UI
 */
export const CONFIDENCE_COLORS = {
  high: "#22C55E",   // Green
  medium: "#F59E0B", // Yellow/Amber
  low: "#78716C",    // Grey
};

/**
 * Confidence level labels for UI
 */
export const CONFIDENCE_LABELS = {
  high: "High confidence diagnosis",
  medium: "Likely issue",
  low: "Exploratory feedback",
};

/**
 * Pattern state messages for UI
 */
export const PATTERN_STATE_MESSAGES = {
  none: null, // Don't show anything
  suspected: "This may be a recurring pattern",
  confirmed: "This is a confirmed recurring issue",
  stable: "You've encountered this pattern before and improved",
};

/**
 * Difficulty action messages for UI
 * Key format: "{action}_{reason}" or just "{action}" for default
 */
export const DIFFICULTY_MESSAGES = {
  maintain_pattern_unresolved: "Difficulty maintained to reinforce correctness",
  maintain_low_confidence: "Difficulty maintained (diagnosis uncertain)",
  maintain_default: "Difficulty maintained",
  increase_consistent_success: "Difficulty increased due to consistent success",
  increase_default: "Difficulty increased based on your progress",
  decrease_struggling: "Difficulty adjusted to strengthen fundamentals",
  decrease_default: "Difficulty adjusted to support your learning",
};

/**
 * Get the appropriate difficulty message
 * @param {DifficultyAction} action 
 * @param {string} reason 
 * @returns {string}
 */
export function getDifficultyMessage(action, reason) {
  const key = `${action}_${reason}`;
  return DIFFICULTY_MESSAGES[key] || DIFFICULTY_MESSAGES[`${action}_default`] || "Difficulty unchanged";
}

/**
 * Check if confidence level should use hedging language
 * @param {ConfidenceLevel} level 
 * @returns {boolean}
 */
export function shouldUseHedgingLanguage(level) {
  return level === "low";
}

/**
 * Check if pattern should be shown in UI
 * @param {PatternState} state 
 * @returns {boolean}
 */
export function shouldShowPattern(state) {
  return state && state !== "none";
}

/**
 * Check if pattern is confirmed (safe to show "recurring")
 * @param {PatternState} state 
 * @returns {boolean}
 */
export function isPatternConfirmed(state) {
  return state === "confirmed" || state === "stable";
}

export default {};
