export function extractDiagnosis(mimInsights) {
  if (!mimInsights) return null;

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

export function extractConfidence(mimInsights) {
  if (!mimInsights) return null;

  const confidenceMetadata = mimInsights.confidence_metadata;
  if (confidenceMetadata) {
    return {
      combined_confidence: confidenceMetadata.combined_confidence ?? 0.5,
      confidence_level: confidenceMetadata.confidence_level || "medium",
      conservative_mode: confidenceMetadata.conservative_mode ?? false,
      calibration_applied: confidenceMetadata.calibration_applied ?? false,
    };
  }

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

export function extractPattern(mimInsights) {
  if (!mimInsights) return null;

  const patternState = mimInsights.pattern_state;
  if (patternState) {
    return {
      state: patternState.state || "none",
      evidence_count: patternState.evidence_count ?? 0,
      confidence_support: patternState.confidence_support || "low",
    };
  }

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

export function extractDifficulty(mimInsights) {
  if (!mimInsights) return null;

  const difficultyDecision = mimInsights.difficulty_decision;
  if (difficultyDecision) {
    return {
      action: difficultyDecision.action || "maintain",
      reason: difficultyDecision.reason || "default",
      confidence_tier: difficultyDecision.confidence_tier || "medium",
    };
  }

  return {
    action: "maintain",
    reason: "no_decision_available",
    confidence_tier: "medium",
  };
}

export function extractRAGMetadata(aiResponse) {
  if (!aiResponse) {
    return { used: false, relevance: 0 };
  }

  const ragMetadata = aiResponse.rag_metadata;
  if (ragMetadata) {
    return {
      used: ragMetadata.used ?? false,
      relevance: ragMetadata.relevance ?? 0,
    };
  }

  const hasRagContext = !!aiResponse.rag_context;
  return {
    used: hasRagContext,
    relevance: hasRagContext ? 0.5 : 0,
  };
}

export function buildCanonicalResponse(aiResponse, { verdict, submissionId }) {
  const mimInsights = aiResponse?.mim_insights;

  return {

    feedback_type: aiResponse?.feedback_type || "error_feedback",

    diagnosis: extractDiagnosis(mimInsights),
    confidence: extractConfidence(mimInsights),
    pattern: extractPattern(mimInsights),
    difficulty: extractDifficulty(mimInsights),

    feedback: {
      explanation: aiResponse?.explanation || null,
      correct_code: aiResponse?.correct_code || null,
      edge_cases: aiResponse?.edge_cases || null,
    },

    hint: aiResponse?.improvement_hint
      ? { text: aiResponse.improvement_hint }
      : null,

    rag: extractRAGMetadata(aiResponse),

    hints: aiResponse?.hints || [],

    explanation: aiResponse?.explanation || null,
    detected_pattern: aiResponse?.detected_pattern || null,
    optimization_tips: aiResponse?.optimization_tips || null,
    complexity_analysis: aiResponse?.complexity_analysis || null,
    edge_cases: aiResponse?.edge_cases || null,

    mimInsights: aiResponse?.mim_insights || null,

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
