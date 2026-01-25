// src/hooks/useAIFeedback.js
// Hook for managing AI feedback state with progressive hint disclosure
// ALL requests go through Node.js backend (port 5000), NOT directly to AI service

import { useState, useCallback, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION - Routes through Backend, NOT AI service directly
// ═══════════════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * Check AI service health via backend proxy
 */
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

/**
 * Fetch AI feedback through the backend
 * Backend handles: auth, context enrichment, AI service communication
 */
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
    credentials: "include", // Send auth cookies
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

/**
 * Custom hook for fetching and managing AI feedback with progressive disclosure
 *
 * Features:
 * - Progressive hint reveal (hint 1 → hint 2 → approach → solution)
 * - Handles ALL verdict types
 * - Error recovery and retry
 * - Loading states
 *
 * @returns {Object} Hook state and methods
 */
export function useAIFeedback() {
  // Raw feedback from API
  const [rawFeedback, setRawFeedback] = useState(null);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Progressive disclosure state
  const [revealedHintLevel, setRevealedHintLevel] = useState(1);
  const [showFullExplanation, setShowFullExplanation] = useState(false);

  // Track abort controllers for cleanup
  const abortControllerRef = useRef(null);

  /**
   * Fetch AI feedback for ANY submission
   * Called for both accepted and failed submissions
   * Routes through backend which handles auth and context enrichment
   */
  const fetchFeedback = useCallback(
    async ({ questionId, code, language, verdict, errorType }) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Reset state
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

        // Backend returns { success, data, meta }
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

  /**
   * Reveal next hint level
   */
  const revealNextHint = useCallback(() => {
    if (rawFeedback?.hints) {
      const maxLevel = rawFeedback.hints.length;
      setRevealedHintLevel((prev) => Math.min(prev + 1, maxLevel));
    }
  }, [rawFeedback]);

  /**
   * Toggle full explanation visibility
   */
  const toggleExplanation = useCallback(() => {
    setShowFullExplanation((prev) => !prev);
  }, []);

  /**
   * Reset all state
   */
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

  /**
   * Retry last request
   */
  const retry = useCallback(() => {
    // This would need the last params stored - simplified for now
    setError(null);
  }, []);

  // Computed: Currently visible hints (up to revealedHintLevel)
  const visibleHints = useMemo(() => {
    if (!rawFeedback?.hints) return [];
    return rawFeedback.hints.filter((h) => h.level <= revealedHintLevel);
  }, [rawFeedback, revealedHintLevel]);

  // Computed: Has more hints to reveal
  const hasMoreHints = useMemo(() => {
    if (!rawFeedback?.hints) return false;
    return revealedHintLevel < rawFeedback.hints.length;
  }, [rawFeedback, revealedHintLevel]);

  // Computed: Next hint type label
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

  // Structured feedback for UI consumption
  const feedback = useMemo(() => {
    if (!rawFeedback) return null;

    return {
      // Core data
      success: rawFeedback.success,
      verdict: rawFeedback.verdict,
      submissionId: rawFeedback.submission_id,
      feedbackType: rawFeedback.feedback_type,

      // Progressive hints (filtered by revealed level)
      hints: visibleHints,
      allHintsCount: rawFeedback.hints?.length || 0,

      // Full explanation (hidden until requested)
      explanation: showFullExplanation ? rawFeedback.explanation : null,
      hasExplanation: !!rawFeedback.explanation,

      // Pattern
      detectedPattern: rawFeedback.detected_pattern,

      // For accepted submissions
      optimizationTips: rawFeedback.optimization_tips,
      complexityAnalysis: rawFeedback.complexity_analysis,
      edgeCases: rawFeedback.edge_cases,
    };
  }, [rawFeedback, visibleHints, showFullExplanation]);

  return {
    // State
    feedback,
    loading,
    error,

    // Actions
    fetchFeedback,
    revealNextHint,
    toggleExplanation,
    reset,
    retry,

    // Computed
    hasFeedback: !!rawFeedback,
    hasMoreHints,
    nextHintLabel,
    revealedHintLevel,
    showFullExplanation,
  };
}

export default useAIFeedback;
