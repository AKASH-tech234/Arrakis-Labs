import { useState, useCallback, useRef, useMemo } from "react";
import {
  CONFIDENCE_COLORS,
  CONFIDENCE_LABELS,
  PATTERN_STATE_MESSAGES,
  getDifficultyMessage,
  shouldUseHedgingLanguage,
  shouldShowPattern,
  isPatternConfirmed,
} from "../../types/ai.types.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function checkAIHealth() {
  try {
    const response = await fetch(`${API_URL}/ai/health`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.success && data.aiService === "ok";
  } catch {
    return false;
  }
}

async function fetchAIFeedbackAPI({
  questionId,
  code,
  language,
  verdict,
  errorType,
  signal,
}) {
  const response = await fetch(`${API_URL}/ai/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      questionId,
      code,
      language,
      verdict,
      errorType,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.message || `AI request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function useAIFeedback() {
  const [rawFeedback, setRawFeedback] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [revealedHintLevel, setRevealedHintLevel] = useState(1);
  const [showFullExplanation, setShowFullExplanation] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchFeedback = useCallback(
    async ({ questionId, code, language, verdict, errorType }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setRawFeedback(null);
      setRevealedHintLevel(1);
      setShowFullExplanation(false);

      try {
        const response = await fetchAIFeedbackAPI({
          questionId,
          code,
          language,
          verdict,
          errorType,
          signal: abortControllerRef.current.signal,
        });

        if (response.success && response.data) {
          setRawFeedback(response.data);
          return response.data;
        } else {
          throw new Error(response.message || "Invalid response from server");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return null;
        }
        const message = err.message || "Failed to fetch AI feedback";
        setError(message);
        console.error("AI Feedback Error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const revealNextHint = useCallback(() => {
    if (rawFeedback?.hints) {
      const maxLevel = rawFeedback.hints.length;
      setRevealedHintLevel((prev) => Math.min(prev + 1, maxLevel));
    }
  }, [rawFeedback]);

  const toggleExplanation = useCallback(() => {
    setShowFullExplanation((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setRawFeedback(null);
    setLoading(false);
    setError(null);
    setRevealedHintLevel(1);
    setShowFullExplanation(false);
  }, []);

  const retry = useCallback(() => {
    setError(null);
  }, []);

  const visibleHints = useMemo(() => {
    if (!rawFeedback?.hints) return [];
    return rawFeedback.hints.filter((h) => h.level <= revealedHintLevel);
  }, [rawFeedback, revealedHintLevel]);

  const hasMoreHints = useMemo(() => {
    if (!rawFeedback?.hints) return false;
    return revealedHintLevel < rawFeedback.hints.length;
  }, [rawFeedback, revealedHintLevel]);

  const nextHintLabel = useMemo(() => {
    if (!rawFeedback?.hints || !hasMoreHints) return null;
    const nextHint = rawFeedback.hints.find(
      (h) => h.level === revealedHintLevel + 1,
    );
    if (!nextHint) return "Show more";

    const labels = {
      conceptual: "Show next hint",
      specific: "Show specific hint",
      approach: "Show approach",
      solution: "Show solution",
      optimization: "Show optimization tips",
      pattern: "Show pattern",
    };
    return labels[nextHint.hint_type] || "Show more";
  }, [rawFeedback, revealedHintLevel, hasMoreHints]);

  const feedback = useMemo(() => {
    if (!rawFeedback) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2.x: Extract canonical fields (MIM FACTS)
    // ═══════════════════════════════════════════════════════════════════════════
    const diagnosis = rawFeedback.diagnosis || null;
    const confidence = rawFeedback.confidence || null;
    const pattern = rawFeedback.pattern || null;
    const difficulty = rawFeedback.difficulty || null;
    const rag = rawFeedback.rag || null;
    const feedbackContent = rawFeedback.feedback || null;
    const hint = rawFeedback.hint || null;

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPUTED PROPERTIES for UI convenience
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Confidence helpers
    const confidenceLevel = confidence?.confidenceLevel || "medium";
    const isHighConfidence = confidenceLevel === "high";
    const isLowConfidence = confidenceLevel === "low";
    const useHedgingLanguage = shouldUseHedgingLanguage(confidenceLevel);
    
    // Pattern helpers
    const patternState = pattern?.state || "none";
    const showPatternUI = shouldShowPattern(patternState);
    const hasConfirmedPattern = isPatternConfirmed(patternState);
    const patternMessage = PATTERN_STATE_MESSAGES[patternState] || null;
    
    // Difficulty helpers
    const difficultyAction = difficulty?.action || "maintain";
    const difficultyReason = difficulty?.reason || "default";
    const difficultyMessage = getDifficultyMessage(difficultyAction, difficultyReason);
    const difficultyChanged = difficultyAction !== "maintain";
    
    // RAG helpers
    const ragUsed = rag?.used || false;

    return {
      success: rawFeedback.success,
      verdict: rawFeedback.verdict,
      submissionId: rawFeedback.submission_id,
      feedbackType: rawFeedback.feedback_type,

      hints: visibleHints,
      allHintsCount: rawFeedback.hints?.length || 0,

      explanation: showFullExplanation ? rawFeedback.explanation : null,
      hasExplanation: !!rawFeedback.explanation,

      detectedPattern:
        rawFeedback.detected_pattern || rawFeedback.detectedPattern,

      optimizationTips:
        rawFeedback.optimization_tips || rawFeedback.optimizationTips,
      complexityAnalysis:
        rawFeedback.complexity_analysis || rawFeedback.complexityAnalysis,
      edgeCases: rawFeedback.edge_cases || rawFeedback.edgeCases,

      // ═══════════════════════════════════════════════════════════════════════════
      // NEW: Phase 2.x Canonical Fields (MIM FACTS - treat as authoritative)
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Diagnosis from MIM (deterministic classification)
      diagnosis,
      
      // Calibrated confidence (Phase 2.1)
      confidence,
      confidenceLevel,
      confidenceColor: CONFIDENCE_COLORS[confidenceLevel] || CONFIDENCE_COLORS.medium,
      confidenceLabel: CONFIDENCE_LABELS[confidenceLevel] || CONFIDENCE_LABELS.medium,
      isHighConfidence,
      isLowConfidence,
      useHedgingLanguage,
      
      // Pattern state (Phase 2.2)
      pattern,
      patternState,
      showPatternUI,
      hasConfirmedPattern,
      patternMessage,
      
      // Difficulty decision (Phase 2.3)
      difficulty,
      difficultyAction,
      difficultyReason,
      difficultyMessage,
      difficultyChanged,
      
      // RAG metadata
      rag,
      ragUsed,
      
      // Feedback content from LLM
      feedbackContent,
      
      // Hint from agent
      hint,

      // ═══════════════════════════════════════════════════════════════════════════
      // LEGACY: v3.3 fields (backward compatibility)
      // ═══════════════════════════════════════════════════════════════════════════
      rootCause: rawFeedback.root_cause || rawFeedback.rootCause,
      rootCauseSubtype:
        rawFeedback.root_cause_subtype || rawFeedback.rootCauseSubtype,
      failureMechanism:
        rawFeedback.failure_mechanism || rawFeedback.failureMechanism,
      correctCode: rawFeedback.correct_code || rawFeedback.correctCode,
      correctCodeExplanation:
        rawFeedback.correct_code_explanation ||
        rawFeedback.correctCodeExplanation,
      conceptReinforcement:
        rawFeedback.concept_reinforcement || rawFeedback.conceptReinforcement,

      // Legacy MIM insights
      mimInsights: rawFeedback.mim_insights || rawFeedback.mimInsights,
    };
  }, [rawFeedback, visibleHints, showFullExplanation]);

  return {
    feedback,
    loading,
    error,

    fetchFeedback,
    revealNextHint,
    toggleExplanation,
    reset,
    retry,

    hasFeedback: !!rawFeedback,
    hasMoreHints,
    nextHintLabel,
    revealedHintLevel,
    showFullExplanation,
  };
}

export default useAIFeedback;
