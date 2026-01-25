

import { useState, useCallback, useRef, useMemo } from "react";
import { getAIFeedback, getWeeklyReport } from "../../services/ai/aiApi";
import { useConfidenceBadge } from "../common/useConfidenceBadge";
import { useLearningTimeline } from "../profile/useLearningTimeline";

export function useAIFeedbackEnhanced({ userId, submissions = [] }) {
  
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);

  const [showHint, setShowHint] = useState(false);
  const [showPattern, setShowPattern] = useState(false);

  const [weeklyReport, setWeeklyReport] = useState(null);
  const [loadingWeeklyReport, setLoadingWeeklyReport] = useState(false);
  const [weeklyReportError, setWeeklyReportError] = useState(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  const [feedbackCache, setFeedbackCache] = useState({});

  const feedbackAbortRef = useRef(null);
  const reportAbortRef = useRef(null);

  const confidenceBadge = useConfidenceBadge(submissions);

  const { timeline, stats, getRecentEvents } = useLearningTimeline({
    submissions,
    feedbackCache,
    weeklyReport,
  });

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
      
      if (feedbackAbortRef.current) {
        feedbackAbortRef.current.abort();
      }

      feedbackAbortRef.current = new AbortController();

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
        
        console.error("AI feedback error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const fetchWeeklyReport = useCallback(async () => {
    if (!userId) {
      setWeeklyReportError("User ID is required");
      return null;
    }

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

  const openFeedbackModal = useCallback(
    (submissionData = null) => {
      setShowModal(true);
      if (submissionData) {
        fetchFeedback(submissionData);
      }
    },
    [fetchFeedback],
  );

  const closeFeedbackModal = useCallback(() => {
    setShowModal(false);
    setShowHint(false);
    setShowPattern(false);
    
  }, []);

  const openWeeklyReport = useCallback(() => {
    setShowWeeklyReport(true);
    
    if (!weeklyReport) {
      fetchWeeklyReport();
    }
  }, [weeklyReport, fetchWeeklyReport]);

  const closeWeeklyReport = useCallback(() => {
    setShowWeeklyReport(false);
  }, []);

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

  const state = useMemo(
    () => ({
      
      isSubmitting: loading,
      aiFeedback: feedback,
      showAIModal: showModal,
      showHint,
      showPattern,
      feedbackError: error,

      weeklyReport,
      loadingWeeklyReport,
      weeklyReportError,
      showWeeklyReport,

      confidenceBadge,

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
    
    ...state,

    fetchFeedback,
    openFeedbackModal,
    closeFeedbackModal,

    revealHint: () => setShowHint(true),
    revealPattern: () => setShowPattern(true),

    fetchWeeklyReport,
    openWeeklyReport,
    closeWeeklyReport,

    reset,
    cancelAll,
  };
}

export default useAIFeedbackEnhanced;
