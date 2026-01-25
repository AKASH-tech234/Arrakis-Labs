// src/hooks/useAIFeedbackEnhanced.js
// Enhanced AI Feedback Hook - Integrates all AI features
// Manages complete AI state flow with progressive disclosure

import { useState, useCallback, useRef, useMemo } from "react";
import { getAIFeedback, getWeeklyReport } from "../../services/ai/aiApi";
import { useConfidenceBadge } from "../common/useConfidenceBadge";
import { useLearningTimeline } from "../profile/useLearningTimeline";

/**
 * @typedef {Object} AIFeedbackState
 * @property {boolean} isSubmitting - Whether a submission is in progress
 * @property {Object|null} aiFeedback - Current AI feedback
 * @property {boolean} showAIModal - Whether AI modal is visible
 * @property {boolean} showHint - Whether hint is revealed
 * @property {boolean} showPattern - Whether pattern is revealed
 * @property {Object|null} weeklyReport - Cached weekly report
 * @property {boolean} loadingWeeklyReport - Whether weekly report is loading
 */

/**
 * Enhanced AI Feedback Hook
 *
 * Combines:
 * - AI feedback fetching
 * - Progressive hint disclosure state
 * - Weekly report (on-demand)
 * - Confidence badge computation
 * - Learning timeline
 *
 * RULES:
 * - Async workflow never blocks UI
 * - Errors degrade gracefully
 * - AI failures do NOT crash submission flow
 *
 * @param {Object} params
 * @param {string} params.userId - Current user ID
 * @param {Array} params.submissions - Submission history for confidence/timeline
 * @returns {Object} Complete AI feedback state and actions
 */
export function useAIFeedbackEnhanced({ userId, submissions = [] }) {
  // Core feedback state
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Progressive disclosure state
  const [showHint, setShowHint] = useState(false);
  const [showPattern, setShowPattern] = useState(false);

  // Weekly report state
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [loadingWeeklyReport, setLoadingWeeklyReport] = useState(false);
  const [weeklyReportError, setWeeklyReportError] = useState(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // Feedback cache for timeline
  const [feedbackCache, setFeedbackCache] = useState({});

  // Abort controllers
  const feedbackAbortRef = useRef(null);
  const reportAbortRef = useRef(null);

  // Computed: Confidence badge (no backend calls)
  const confidenceBadge = useConfidenceBadge(submissions);

  // Computed: Learning timeline
  const { timeline, stats, getRecentEvents } = useLearningTimeline({
    submissions,
    feedbackCache,
    weeklyReport,
  });

  /**
   * Fetch AI feedback for a submission
   *
   * @param {Object} params
   * @param {string} params.questionId - Problem ID
   * @param {string} params.problemCategory - Problem category
   * @param {string} params.constraints - Problem constraints
   * @param {string} params.code - Submitted code
   * @param {string} params.language - Programming language
   * @param {string} params.verdict - Submission verdict
   * @param {string} [params.errorType] - Error type (optional)
   */
  const fetchFeedback = useCallback(
    async ({
      questionId,
      problemCategory,
      constraints,
      code,
      language,
      verdict,
      errorType,
    }) => {
      // Cancel any pending request
      if (feedbackAbortRef.current) {
        feedbackAbortRef.current.abort();
      }

      feedbackAbortRef.current = new AbortController();

      // Reset disclosure state
      setShowHint(false);
      setShowPattern(false);
      setLoading(true);
      setError(null);
      setFeedback(null);

      try {
        const data = await getAIFeedback({
          userId,
          problemId: questionId,
          problemCategory: problemCategory || "General",
          constraints: constraints || "",
          code,
          language,
          verdict,
          errorType,
          signal: feedbackAbortRef.current.signal,
        });

        setFeedback(data);

        // Cache feedback for timeline
        setFeedbackCache((prev) => ({
          ...prev,
          [questionId]: data,
        }));

        return data;
      } catch (err) {
        if (err.name === "AbortError") {
          return null;
        }
        const message = err.message || "Failed to fetch AI feedback";
        setError(message);
        // Don't throw - graceful degradation
        console.error("AI feedback error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  /**
   * Fetch weekly report ON-DEMAND
   */
  const fetchWeeklyReport = useCallback(async () => {
    if (!userId) {
      setWeeklyReportError("User ID is required");
      return null;
    }

    // Cancel any pending request
    if (reportAbortRef.current) {
      reportAbortRef.current.abort();
    }

    reportAbortRef.current = new AbortController();

    setLoadingWeeklyReport(true);
    setWeeklyReportError(null);

    try {
      const data = await getWeeklyReport({
        userId,
        signal: reportAbortRef.current.signal,
      });

      setWeeklyReport({
        ...data,
        generatedAt: new Date(),
      });

      return data;
    } catch (err) {
      if (err.name === "AbortError") {
        return null;
      }
      const message = err.message || "Failed to fetch weekly report";
      setWeeklyReportError(message);
      console.error("Weekly report error:", err);
      return null;
    } finally {
      setLoadingWeeklyReport(false);
    }
  }, [userId]);

  /**
   * Open AI feedback modal and optionally fetch feedback
   */
  const openFeedbackModal = useCallback(
    (submissionData = null) => {
      setShowModal(true);
      if (submissionData) {
        fetchFeedback(submissionData);
      }
    },
    [fetchFeedback],
  );

  /**
   * Close AI feedback modal and reset state
   */
  const closeFeedbackModal = useCallback(() => {
    setShowModal(false);
    setShowHint(false);
    setShowPattern(false);
    // Keep feedback cached, don't reset
  }, []);

  /**
   * Open weekly report modal and fetch
   */
  const openWeeklyReport = useCallback(() => {
    setShowWeeklyReport(true);
    // Only fetch if not already loaded
    if (!weeklyReport) {
      fetchWeeklyReport();
    }
  }, [weeklyReport, fetchWeeklyReport]);

  /**
   * Close weekly report modal
   */
  const closeWeeklyReport = useCallback(() => {
    setShowWeeklyReport(false);
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    if (feedbackAbortRef.current) {
      feedbackAbortRef.current.abort();
    }
    if (reportAbortRef.current) {
      reportAbortRef.current.abort();
    }

    setFeedback(null);
    setLoading(false);
    setError(null);
    setShowModal(false);
    setShowHint(false);
    setShowPattern(false);
    setWeeklyReport(null);
    setLoadingWeeklyReport(false);
    setWeeklyReportError(null);
    setShowWeeklyReport(false);
  }, []);

  /**
   * Cancel all pending requests
   */
  const cancelAll = useCallback(() => {
    if (feedbackAbortRef.current) {
      feedbackAbortRef.current.abort();
    }
    if (reportAbortRef.current) {
      reportAbortRef.current.abort();
    }
    setLoading(false);
    setLoadingWeeklyReport(false);
  }, []);

  // Memoized state object for consumers
  const state = useMemo(
    () => ({
      // Feedback state
      isSubmitting: loading,
      aiFeedback: feedback,
      showAIModal: showModal,
      showHint,
      showPattern,
      feedbackError: error,

      // Weekly report state
      weeklyReport,
      loadingWeeklyReport,
      weeklyReportError,
      showWeeklyReport,

      // Computed from submissions (no backend calls)
      confidenceBadge,

      // Timeline data
      timeline,
      timelineStats: stats,
      recentEvents: getRecentEvents(5),
    }),
    [
      loading,
      feedback,
      showModal,
      showHint,
      showPattern,
      error,
      weeklyReport,
      loadingWeeklyReport,
      weeklyReportError,
      showWeeklyReport,
      confidenceBadge,
      timeline,
      stats,
      getRecentEvents,
    ],
  );

  return {
    // State
    ...state,

    // Feedback actions
    fetchFeedback,
    openFeedbackModal,
    closeFeedbackModal,

    // Progressive disclosure actions
    revealHint: () => setShowHint(true),
    revealPattern: () => setShowPattern(true),

    // Weekly report actions
    fetchWeeklyReport,
    openWeeklyReport,
    closeWeeklyReport,

    // Utility actions
    reset,
    cancelAll,
  };
}

export default useAIFeedbackEnhanced;
