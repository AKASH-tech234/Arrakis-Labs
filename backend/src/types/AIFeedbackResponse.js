/**
 * AI Feedback Response Types
 * ==========================
 * 
 * Canonical response contract for AI feedback API.
 * These types define the contract between backend and frontend.
 * 
 * IMPORTANT: This is the source of truth for AI feedback response structure.
 * Frontend should mirror these types in frontend/src/types/ai.types.js
 * 
 * @fileoverview JSDoc type definitions for AI feedback responses
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSIS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Root cause classification from MIM
 * @typedef {"correctness" | "efficiency" | "implementation" | "understanding_gap"} RootCause
 */

/**
 * Diagnosis information from MIM (deterministic, ML-based)
 * @typedef {Object} DiagnosisDTO
 * @property {RootCause} root_cause - Primary failure category
 * @property {string} subtype - Granular failure classification (e.g., "off_by_one", "wrong_complexity")
 * @property {string} failure_mechanism - Human-readable explanation of what went wrong
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE TYPES (Phase 2.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Confidence level tier
 * @typedef {"high" | "medium" | "low"} ConfidenceLevel
 */

/**
 * Calibrated confidence metadata from MIM
 * @typedef {Object} ConfidenceDTO
 * @property {number} combined_confidence - Combined calibrated confidence (0.0 - 1.0)
 * @property {ConfidenceLevel} confidence_level - Confidence tier for decision-making
 * @property {boolean} conservative_mode - True if confidence too low for aggressive decisions
 * @property {boolean} calibration_applied - Whether isotonic calibration was applied
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN TYPES (Phase 2.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pattern state from state machine
 * @typedef {"none" | "suspected" | "confirmed" | "stable"} PatternState
 */

/**
 * Pattern detection information
 * @typedef {Object} PatternDTO
 * @property {PatternState} state - Current pattern state
 * @property {number} evidence_count - Number of supporting evidence instances
 * @property {ConfidenceLevel} confidence_support - Confidence level of pattern detection
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DIFFICULTY TYPES (Phase 2.3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Difficulty adjustment action
 * @typedef {"increase" | "maintain" | "decrease"} DifficultyAction
 */

/**
 * Difficulty adjustment decision
 * @typedef {Object} DifficultyDTO
 * @property {DifficultyAction} action - What difficulty change (if any) is recommended
 * @property {string} reason - Why this decision was made (e.g., "pattern_unresolved", "consistent_success")
 * @property {string} confidence_tier - Confidence tier that influenced this decision
 */

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK CONTENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLM-generated feedback content
 * @typedef {Object} FeedbackContentDTO
 * @property {string} explanation - Detailed explanation of the issue
 * @property {string} [correct_code] - Example of corrected code (optional)
 * @property {string[]} [edge_cases] - Edge cases to consider (optional)
 */

/**
 * Hint from hint agent
 * @typedef {Object} HintDTO
 * @property {string} text - Hint text content
 */

// ═══════════════════════════════════════════════════════════════════════════════
// RAG TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RAG (Retrieval-Augmented Generation) usage metadata
 * @typedef {Object} RAGMetadataDTO
 * @property {boolean} used - Whether RAG was used for this response
 * @property {number} relevance - Relevance score of retrieved content (0.0 - 1.0)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RESPONSE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Feedback type discriminator
 * @typedef {"error_feedback" | "success_feedback" | "optimization"} FeedbackType
 */

/**
 * Progressive hint structure
 * @typedef {Object} HintLevel
 * @property {number} level - Hint level (1 = most vague, higher = more specific)
 * @property {string} content - Hint content
 * @property {string} hint_type - Type of hint ("conceptual", "specific", "approach", "solution", "optimization", "pattern")
 */

/**
 * Canonical AI Feedback Response
 * 
 * This is the NEW canonical response format that includes:
 * - diagnosis: MIM-determined root cause (FACT, not LLM guess)
 * - confidence: Calibrated confidence metadata (Phase 2.1)
 * - pattern: Pattern state machine output (Phase 2.2)
 * - difficulty: Difficulty policy decision (Phase 2.3)
 * - feedback: LLM-generated explanations
 * - hint: Hint agent output
 * - rag: RAG usage metadata
 * 
 * BACKWARD COMPATIBILITY: The old mimInsights field is preserved for existing frontend code.
 * 
 * @typedef {Object} AIFeedbackResponse
 * @property {FeedbackType} feedback_type - Type discriminator for feedback
 * 
 * @property {DiagnosisDTO} [diagnosis] - MIM diagnosis (root cause analysis)
 * @property {ConfidenceDTO} [confidence] - Calibrated confidence metadata
 * @property {PatternDTO} [pattern] - Pattern state information
 * @property {DifficultyDTO} [difficulty] - Difficulty adjustment decision
 * 
 * @property {FeedbackContentDTO} [feedback] - LLM-generated feedback content
 * @property {HintDTO} [hint] - Hint from hint agent
 * @property {RAGMetadataDTO} [rag] - RAG usage metadata
 * 
 * @property {HintLevel[]} hints - Progressive hints array
 * @property {string} [explanation] - Full explanation (legacy field)
 * @property {string} [detected_pattern] - Detected pattern name (legacy field)
 * @property {string[]} [optimization_tips] - Optimization suggestions
 * @property {string} [complexity_analysis] - Complexity analysis
 * @property {string[]} [edge_cases] - Edge cases to consider
 * 
 * @property {Object} [mimInsights] - Legacy MIM insights (backward compatibility)
 * 
 * @property {string} verdict - Submission verdict
 * @property {string} submission_id - Submission identifier
 */

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract diagnosis DTO from MIM insights
 * @param {Object} mimInsights - Raw MIM insights from AI service
 * @returns {DiagnosisDTO|null}
 */
export function extractDiagnosis(mimInsights) {
  if (!mimInsights) return null;

  // Try V3.0 polymorphic structure first
  const correctnessFeedback = mimInsights.correctness_feedback;
  const performanceFeedback = mimInsights.performance_feedback;

  if (correctnessFeedback) {
    return {
      root_cause: correctnessFeedback.root_cause || "correctness",
      subtype: correctnessFeedback.subtype || "unknown",
      failure_mechanism: correctnessFeedback.failure_mechanism || "",
    };
  }

  if (performanceFeedback) {
    return {
      root_cause: performanceFeedback.root_cause || "efficiency",
      subtype: performanceFeedback.subtype || "unknown",
      failure_mechanism: performanceFeedback.failure_mechanism || "",
    };
  }

  // Fall back to legacy root_cause structure
  const rootCause = mimInsights.root_cause;
  if (rootCause) {
    return {
      root_cause:
        typeof rootCause === "object"
          ? rootCause.failure_cause || "unknown"
          : rootCause,
      subtype: mimInsights.subtype || "unknown",
      failure_mechanism: mimInsights.failure_mechanism || "",
    };
  }

  return null;
}

/**
 * Extract confidence DTO from MIM insights
 * @param {Object} mimInsights - Raw MIM insights from AI service
 * @returns {ConfidenceDTO|null}
 */
export function extractConfidence(mimInsights) {
  if (!mimInsights) return null;

  // Check for confidence_metadata (Phase 2.1)
  const confidenceMetadata = mimInsights.confidence_metadata;
  if (confidenceMetadata) {
    return {
      combined_confidence: confidenceMetadata.combined_confidence ?? 0.5,
      confidence_level: confidenceMetadata.confidence_level || "medium",
      conservative_mode: confidenceMetadata.conservative_mode ?? false,
      calibration_applied: confidenceMetadata.calibration_applied ?? false,
    };
  }

  // Fall back to legacy confidence from correctness_feedback
  const correctnessFeedback = mimInsights.correctness_feedback;
  if (correctnessFeedback?.confidence !== undefined) {
    const conf = correctnessFeedback.confidence;
    return {
      combined_confidence: conf,
      confidence_level: conf >= 0.8 ? "high" : conf >= 0.65 ? "medium" : "low",
      conservative_mode: conf < 0.65,
      calibration_applied: false,
    };
  }

  // Fall back to legacy root_cause.confidence
  const rootCause = mimInsights.root_cause;
  if (typeof rootCause === "object" && rootCause?.confidence !== undefined) {
    const conf = rootCause.confidence;
    return {
      combined_confidence: conf,
      confidence_level: conf >= 0.8 ? "high" : conf >= 0.65 ? "medium" : "low",
      conservative_mode: conf < 0.65,
      calibration_applied: false,
    };
  }

  return null;
}

/**
 * Extract pattern DTO from MIM insights
 * @param {Object} mimInsights - Raw MIM insights from AI service
 * @returns {PatternDTO|null}
 */
export function extractPattern(mimInsights) {
  if (!mimInsights) return null;

  // Check for pattern_state (Phase 2.2)
  const patternState = mimInsights.pattern_state;
  if (patternState) {
    return {
      state: patternState.state || "none",
      evidence_count: patternState.evidence_count ?? 0,
      confidence_support: patternState.confidence_support || "low",
    };
  }

  // Fall back to legacy is_recurring from correctness_feedback
  const correctnessFeedback = mimInsights.correctness_feedback;
  if (correctnessFeedback) {
    const isRecurring = correctnessFeedback.is_recurring;
    const recurrenceCount = correctnessFeedback.recurrence_count ?? 0;

    if (isRecurring && recurrenceCount >= 3) {
      return {
        state: "confirmed",
        evidence_count: recurrenceCount,
        confidence_support: "high",
      };
    } else if (isRecurring || recurrenceCount >= 2) {
      return {
        state: "suspected",
        evidence_count: recurrenceCount,
        confidence_support: "medium",
      };
    }
  }

  return {
    state: "none",
    evidence_count: 0,
    confidence_support: "low",
  };
}

/**
 * Extract difficulty DTO from MIM insights
 * @param {Object} mimInsights - Raw MIM insights from AI service
 * @returns {DifficultyDTO|null}
 */
export function extractDifficulty(mimInsights) {
  if (!mimInsights) return null;

  // Check for difficulty_decision (Phase 2.3)
  const difficultyDecision = mimInsights.difficulty_decision;
  if (difficultyDecision) {
    return {
      action: difficultyDecision.action || "maintain",
      reason: difficultyDecision.reason || "default",
      confidence_tier: difficultyDecision.confidence_tier || "medium",
    };
  }

  // Default to maintain if no decision available
  return {
    action: "maintain",
    reason: "no_decision_available",
    confidence_tier: "medium",
  };
}

/**
 * Extract RAG metadata from AI response
 * @param {Object} aiResponse - Full AI service response
 * @returns {RAGMetadataDTO}
 */
export function extractRAGMetadata(aiResponse) {
  if (!aiResponse) {
    return { used: false, relevance: 0 };
  }

  // Check for explicit rag_metadata
  const ragMetadata = aiResponse.rag_metadata;
  if (ragMetadata) {
    return {
      used: ragMetadata.used ?? false,
      relevance: ragMetadata.relevance ?? 0,
    };
  }

  // Infer from rag_context presence
  const hasRagContext = !!aiResponse.rag_context;
  return {
    used: hasRagContext,
    relevance: hasRagContext ? 0.5 : 0, // Default relevance if context present
  };
}

/**
 * Build canonical AI feedback response from raw AI service response
 * 
 * @param {Object} aiResponse - Raw response from AI service
 * @param {Object} options - Additional options
 * @param {string} options.verdict - Submission verdict
 * @param {string} options.submissionId - Submission ID
 * @returns {AIFeedbackResponse}
 */
export function buildCanonicalResponse(aiResponse, { verdict, submissionId }) {
  const mimInsights = aiResponse?.mim_insights;

  return {
    // Type discriminator
    feedback_type: aiResponse?.feedback_type || "error_feedback",

    // NEW: Canonical fields from MIM (Phase 2.x)
    diagnosis: extractDiagnosis(mimInsights),
    confidence: extractConfidence(mimInsights),
    pattern: extractPattern(mimInsights),
    difficulty: extractDifficulty(mimInsights),

    // Feedback content
    feedback: {
      explanation: aiResponse?.explanation || null,
      correct_code: aiResponse?.correct_code || null,
      edge_cases: aiResponse?.edge_cases || null,
    },

    // Hint
    hint: aiResponse?.improvement_hint
      ? { text: aiResponse.improvement_hint }
      : null,

    // RAG metadata
    rag: extractRAGMetadata(aiResponse),

    // Progressive hints
    hints: aiResponse?.hints || [],

    // Legacy fields (backward compatibility)
    explanation: aiResponse?.explanation || null,
    detected_pattern: aiResponse?.detected_pattern || null,
    optimization_tips: aiResponse?.optimization_tips || null,
    complexity_analysis: aiResponse?.complexity_analysis || null,
    edge_cases: aiResponse?.edge_cases || null,

    // Legacy MIM insights (backward compatibility)
    mimInsights: aiResponse?.mim_insights || null,

    // Metadata
    verdict: verdict,
    submission_id: submissionId,
  };
}

export default {
  extractDiagnosis,
  extractConfidence,
  extractPattern,
  extractDifficulty,
  extractRAGMetadata,
  buildCanonicalResponse,
};
