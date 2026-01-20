// src/hooks/useAIFeedback.js
// Hook for managing AI feedback state and API calls

import { useState, useCallback, useRef } from "react";
import { getAIFeedback, getAILearningSummary } from "../services/api";

/**
 * Custom hook for fetching and managing AI feedback
 * @returns {Object} Hook state and methods
 */
export function useAIFeedback() {
  const [feedback, setFeedback] = useState(null);
  const [learningSummary, setLearningSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track abort controllers for cleanup
  const abortControllerRef = useRef(null);

  /**
   * Fetch AI feedback for a failed submission
   */
  const fetchFeedback = useCallback(
    async ({ questionId, code, language, verdict, errorType }) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setFeedback(null);

      try {
        const data = await getAIFeedback({
          questionId,
          code,
          language,
          verdict,
          errorType,
          signal: abortControllerRef.current.signal,
        });

        setFeedback(data);
        return data;
      } catch (err) {
        if (err.name === "AbortError") {
          // Request was cancelled, don't set error
          return null;
        }
        const message = err.message || "Failed to fetch AI feedback";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Fetch AI learning summary for an accepted submission
   */
  const fetchLearningSummary = useCallback(
    async ({ questionId, code, language }) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setLearningSummary(null);

      try {
        const data = await getAILearningSummary({
          questionId,
          code,
          language,
          signal: abortControllerRef.current.signal,
        });

        setLearningSummary(data);
        return data;
      } catch (err) {
        if (err.name === "AbortError") {
          return null;
        }
        const message = err.message || "Failed to fetch learning summary";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setFeedback(null);
    setLearningSummary(null);
    setLoading(false);
    setError(null);
  }, []);

  /**
   * Cancel any pending request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  }, []);

  return {
    // State
    feedback,
    learningSummary,
    loading,
    error,

    // Actions
    fetchFeedback,
    fetchLearningSummary,
    reset,
    cancel,

    // Computed
    hasFeedback: !!feedback,
    hasLearningSummary: !!learningSummary,
  };
}

export default useAIFeedback;
