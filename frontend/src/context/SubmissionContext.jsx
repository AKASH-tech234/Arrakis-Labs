// src/context/SubmissionContext.jsx
// Single source of truth for submission state, AI feedback, and workflow management
// Implements EXPLICIT AI triggering - never automatic

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useMemo,
} from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE SHAPE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // Submission data
  currentSubmission: null,
  submissionHistory: [],

  // Execution state
  executionStatus: "idle", // idle | running | success | error
  executionOutput: null,
  executionError: null,

  // AI state - EXPLICIT trigger only
  aiStatus: "idle", // idle | loading | success | error
  aiFeedback: null,
  aiError: null,
  aiRequestedForSubmissionId: null, // Track which submission AI was requested for

  // Progressive disclosure
  revealedHintLevel: 1,
  showFullExplanation: false,

  // UI state
  showAIPanel: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const ActionTypes = {
  // Execution
  EXECUTION_START: "EXECUTION_START",
  EXECUTION_SUCCESS: "EXECUTION_SUCCESS",
  EXECUTION_ERROR: "EXECUTION_ERROR",
  EXECUTION_RESET: "EXECUTION_RESET",

  // Submission
  SUBMISSION_COMPLETE: "SUBMISSION_COMPLETE",
  SUBMISSION_CLEAR: "SUBMISSION_CLEAR",

  // AI Feedback - EXPLICIT only
  AI_REQUEST_START: "AI_REQUEST_START",
  AI_REQUEST_SUCCESS: "AI_REQUEST_SUCCESS",
  AI_REQUEST_ERROR: "AI_REQUEST_ERROR",
  AI_RESET: "AI_RESET",

  // Progressive disclosure
  REVEAL_NEXT_HINT: "REVEAL_NEXT_HINT",
  TOGGLE_EXPLANATION: "TOGGLE_EXPLANATION",

  // UI
  SHOW_AI_PANEL: "SHOW_AI_PANEL",
  HIDE_AI_PANEL: "HIDE_AI_PANEL",
};

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════════

function submissionReducer(state, action) {
  switch (action.type) {
    // Execution actions
    case ActionTypes.EXECUTION_START:
      return {
        ...state,
        executionStatus: "running",
        executionOutput: null,
        executionError: null,
      };

    case ActionTypes.EXECUTION_SUCCESS:
      return {
        ...state,
        executionStatus: action.payload.isAccepted ? "success" : "error",
        executionOutput: action.payload.output,
      };

    case ActionTypes.EXECUTION_ERROR:
      return {
        ...state,
        executionStatus: "error",
        executionError: action.payload.error,
      };

    case ActionTypes.EXECUTION_RESET:
      return {
        ...state,
        executionStatus: "idle",
        executionOutput: null,
        executionError: null,
      };

    // Submission actions
    case ActionTypes.SUBMISSION_COMPLETE:
      return {
        ...state,
        currentSubmission: action.payload.submission,
        submissionHistory: [
          action.payload.submission,
          ...state.submissionHistory.slice(0, 9), // Keep last 10
        ],
        // Reset AI state for new submission
        aiStatus: "idle",
        aiFeedback: null,
        aiError: null,
        aiRequestedForSubmissionId: null,
        revealedHintLevel: 1,
        showFullExplanation: false,
      };

    case ActionTypes.SUBMISSION_CLEAR:
      return {
        ...state,
        currentSubmission: null,
        executionStatus: "idle",
        executionOutput: null,
        executionError: null,
      };

    // AI Feedback actions - EXPLICIT trigger only
    case ActionTypes.AI_REQUEST_START:
      return {
        ...state,
        aiStatus: "loading",
        aiError: null,
        aiRequestedForSubmissionId: action.payload.submissionId,
      };

    case ActionTypes.AI_REQUEST_SUCCESS:
      return {
        ...state,
        aiStatus: "success",
        aiFeedback: action.payload.feedback,
        aiError: null,
      };

    case ActionTypes.AI_REQUEST_ERROR:
      return {
        ...state,
        aiStatus: "error",
        aiError: action.payload.error,
      };

    case ActionTypes.AI_RESET:
      return {
        ...state,
        aiStatus: "idle",
        aiFeedback: null,
        aiError: null,
        aiRequestedForSubmissionId: null,
        revealedHintLevel: 1,
        showFullExplanation: false,
      };

    // Progressive disclosure
    case ActionTypes.REVEAL_NEXT_HINT:
      return {
        ...state,
        revealedHintLevel: state.revealedHintLevel + 1,
      };

    case ActionTypes.TOGGLE_EXPLANATION:
      return {
        ...state,
        showFullExplanation: !state.showFullExplanation,
      };

    // UI actions - NEVER trigger backend calls
    case ActionTypes.SHOW_AI_PANEL:
      return { ...state, showAIPanel: true };

    case ActionTypes.HIDE_AI_PANEL:
      return { ...state, showAIPanel: false };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const SubmissionContext = createContext(null);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getNextHintLabel(hints, currentLevel) {
  if (!hints || currentLevel >= hints.length) return null;

  const nextHint = hints[currentLevel];
  const typeLabels = {
    conceptual: "Show conceptual hint",
    specific: "Show specific hint",
    approach: "Show approach",
    solution: "Show solution",
    optimization: "Show optimization tip",
  };

  return typeLabels[nextHint?.hint_type] || "Show next hint";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function SubmissionProvider({ children }) {
  const [state, dispatch] = useReducer(submissionReducer, initialState);
  const abortControllerRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMISSION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a completed submission
   * DOES NOT trigger AI automatically - user must explicitly request
   */
  const recordSubmission = useCallback((submissionData) => {
    const submission = {
      id:
        submissionData.id ||
        `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...submissionData,
    };

    dispatch({
      type: ActionTypes.SUBMISSION_COMPLETE,
      payload: { submission },
    });

    return submission;
  }, []);

  /**
   * Clear current submission
   */
  const clearSubmission = useCallback(() => {
    dispatch({ type: ActionTypes.SUBMISSION_CLEAR });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // AI FEEDBACK - EXPLICIT TRIGGER ONLY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * EXPLICITLY request AI feedback
   * This is the ONLY way to trigger AI - never automatic
   *
   * @param {Object} submissionData - The submission to analyze (optional, uses currentSubmission if not provided)
   * @returns {Promise<Object|null>} The AI feedback or null on error
   */
  const requestAIFeedback = useCallback(
    async (submissionData = null) => {
      const submission = submissionData || state.currentSubmission;

      if (!submission) {
        console.error("[SubmissionContext] No submission to analyze");
        return null;
      }

      // Prevent duplicate requests for same submission
      if (
        state.aiRequestedForSubmissionId === submission.id &&
        state.aiStatus === "loading"
      ) {
        console.log(
          "[SubmissionContext] AI request already in progress for this submission",
        );
        return null;
      }

      // If we already have feedback for this submission, return it
      if (
        state.aiRequestedForSubmissionId === submission.id &&
        state.aiFeedback
      ) {
        console.log("[SubmissionContext] Returning cached AI feedback");
        return state.aiFeedback;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      dispatch({
        type: ActionTypes.AI_REQUEST_START,
        payload: { submissionId: submission.id },
      });

      try {
        const response = await fetch(`${API_URL}/ai/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            questionId: submission.questionId,
            code: submission.code,
            language: submission.language,
            verdict: submission.verdict,
            errorType: submission.errorType,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Request failed (${response.status})`,
          );
        }

        const data = await response.json();

        if (data.success && data.data) {
          // Process the feedback to normalize structure
          const processedFeedback = {
            success: true,
            verdict: data.data.verdict,
            submissionId: data.data.submissionId,
            feedbackType: data.data.feedbackType,
            hints: data.data.hints || [],
            allHintsCount: data.data.hints?.length || 0,
            explanation: data.data.explanation,
            hasExplanation: !!data.data.explanation,
            detectedPattern: data.data.detectedPattern,
            optimizationTips: data.data.optimizationTips || [],
            complexityAnalysis: data.data.complexityAnalysis,
            edgeCases: data.data.edgeCases || [],
            improvementHint: data.data.improvementHint,
          };

          dispatch({
            type: ActionTypes.AI_REQUEST_SUCCESS,
            payload: { feedback: processedFeedback },
          });
          return processedFeedback;
        } else {
          throw new Error(data.message || "Invalid response from AI service");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          console.log("[SubmissionContext] AI request aborted");
          return null;
        }

        console.error("[SubmissionContext] AI request failed:", err.message);
        dispatch({
          type: ActionTypes.AI_REQUEST_ERROR,
          payload: { error: err.message },
        });
        return null;
      }
    },
    [
      state.currentSubmission,
      state.aiRequestedForSubmissionId,
      state.aiStatus,
      state.aiFeedback,
    ],
  );

  /**
   * Reset AI state (for retry or new submission)
   */
  const resetAI = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch({ type: ActionTypes.AI_RESET });
  }, []);

  /**
   * Retry AI feedback request
   */
  const retryAIFeedback = useCallback(async () => {
    resetAI();
    // Small delay to ensure state is cleared
    await new Promise((resolve) => setTimeout(resolve, 100));
    return requestAIFeedback();
  }, [resetAI, requestAIFeedback]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRESSIVE DISCLOSURE
  // ═══════════════════════════════════════════════════════════════════════════

  const revealNextHint = useCallback(() => {
    dispatch({ type: ActionTypes.REVEAL_NEXT_HINT });
  }, []);

  const toggleExplanation = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_EXPLANATION });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // UI HANDLERS - NEVER trigger backend calls
  // ═══════════════════════════════════════════════════════════════════════════

  const showAIPanel = useCallback(() => {
    // CRITICAL: Opening panel NEVER triggers AI request
    dispatch({ type: ActionTypes.SHOW_AI_PANEL });
  }, []);

  const hideAIPanel = useCallback(() => {
    dispatch({ type: ActionTypes.HIDE_AI_PANEL });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════

  const value = useMemo(() => {
    const visibleHints =
      state.aiFeedback?.hints?.slice(0, state.revealedHintLevel) || [];
    const hasMoreHints =
      (state.aiFeedback?.hints?.length || 0) > state.revealedHintLevel;
    const nextHintLabel = getNextHintLabel(
      state.aiFeedback?.hints,
      state.revealedHintLevel,
    );

    return {
      // State
      ...state,

      // Computed
      visibleHints,
      hasMoreHints,
      nextHintLabel,
      isAILoading: state.aiStatus === "loading",
      hasAIFeedback: state.aiStatus === "success" && !!state.aiFeedback,
      hasAIError: state.aiStatus === "error",

      // Actions
      recordSubmission,
      clearSubmission,
      requestAIFeedback,
      resetAI,
      retryAIFeedback,
      revealNextHint,
      toggleExplanation,
      showAIPanel,
      hideAIPanel,
    };
  }, [
    state,
    recordSubmission,
    clearSubmission,
    requestAIFeedback,
    resetAI,
    retryAIFeedback,
    revealNextHint,
    toggleExplanation,
    showAIPanel,
    hideAIPanel,
  ]);

  return (
    <SubmissionContext.Provider value={value}>
      {children}
    </SubmissionContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useSubmission() {
  const context = useContext(SubmissionContext);
  if (!context) {
    throw new Error("useSubmission must be used within a SubmissionProvider");
  }
  return context;
}

export default SubmissionContext;
