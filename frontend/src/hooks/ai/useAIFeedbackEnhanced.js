import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { getAIFeedback, getWeeklyReport } from "../../services/ai/aiApi";
import { useConfidenceBadge } from "../common/useConfidenceBadge";
import { useLearningTimeline } from "../profile/useLearningTimeline";

// ═══════════════════════════════════════════════════════════════════════════════
// v3.1: REAL-TIME SUBMISSION EVENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// Global event emitter for cross-component updates
const submissionEventListeners = new Set();

export function emitSubmissionUpdate(data) {
  submissionEventListeners.forEach((listener) => {
    try {
      listener(data);
    } catch (e) {
      console.error("[SubmissionEvent] Listener error:", e);
    }
  });
}

function useSubmissionEvents(onUpdate) {
  useEffect(() => {
    if (onUpdate) {
      submissionEventListeners.add(onUpdate);
      return () => submissionEventListeners.delete(onUpdate);
    }
  }, [onUpdate]);
}

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

  // v3.1: Track submission history for real-time updates
  const [submissionHistory, setSubmissionHistory] = useState([]);

  const feedbackAbortRef = useRef(null);
  const reportAbortRef = useRef(null);

  // v3.2: Request deduplication - prevent duplicate API calls
  const lastRequestKeyRef = useRef(null);
  const pendingRequestRef = useRef(null);

  const confidenceBadge = useConfidenceBadge(submissions);

  const { timeline, stats, getRecentEvents } = useLearningTimeline({
    submissions,
    feedbackCache,
    weeklyReport,
  });

  // v3.1: Listen for real-time submission updates
  const handleSubmissionUpdate = useCallback(
    (data) => {
      console.log("[AIFeedback] Real-time submission update:", data);

      // Add to history
      setSubmissionHistory((prev) => [data, ...prev].slice(0, 20));

      // Update feedback cache if we have new feedback
      if (data.feedback && data.questionId) {
        setFeedbackCache((prev) => ({
          ...prev,
          [data.questionId]: data.feedback,
        }));
      }

      // Auto-update current feedback if matching
      if (data.feedback && feedback?.submission_id === data.submissionId) {
        setFeedback(data.feedback);
      }
    },
    [feedback],
  );

  useSubmissionEvents(handleSubmissionUpdate);

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
      // v3.2: Generate unique request key for deduplication
      const requestKey = `${questionId}-${code?.substring(0, 50)}-${verdict}`;

      // Skip if identical request is already pending
      if (
        lastRequestKeyRef.current === requestKey &&
        pendingRequestRef.current
      ) {
        console.log("[AIFeedback] Deduped identical request:", questionId);
        return pendingRequestRef.current;
      }

      // Check cache first - return cached feedback if available and recent
      const cachedFeedback = feedbackCache[questionId];
      if (
        cachedFeedback &&
        cachedFeedback.code_hash === code?.substring(0, 50)
      ) {
        console.log("[AIFeedback] Returning cached feedback:", questionId);
        setFeedback(cachedFeedback);
        return cachedFeedback;
      }

      if (feedbackAbortRef.current) {
        feedbackAbortRef.current.abort();
      }

      feedbackAbortRef.current = new AbortController();
      lastRequestKeyRef.current = requestKey;

      setShowHint(false);
      setShowPattern(false);
      setLoading(true);
      setError(null);
      setFeedback(null);

      // v3.2: Store promise for deduplication
      pendingRequestRef.current = (async () => {
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

          // Add code hash for cache validation
          data.code_hash = code?.substring(0, 50);
          setFeedback(data);

          setFeedbackCache((prev) => ({
            ...prev,
            [questionId]: data,
          }));

          // v3.1: Emit real-time update event for other components
          emitSubmissionUpdate({
            type: "feedback_received",
            questionId,
            submissionId: data.submission_id,
            verdict,
            feedback: data,
            timestamp: Date.now(),
          });

          return data;
        } catch (err) {
          if (err.name === "AbortError") {
            return null;
          }
          const message = err.message || "Failed to fetch AI feedback";
          setError(message);

          // v3.1: Emit error event
          emitSubmissionUpdate({
            type: "feedback_error",
            questionId,
            error: message,
            timestamp: Date.now(),
          });

          console.error("AI feedback error:", err);
          return null;
        } finally {
          setLoading(false);
          pendingRequestRef.current = null;
        }
      })();

      return pendingRequestRef.current;
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

      // v3.1: Real-time submission history
      submissionHistory,
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
      submissionHistory,
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
