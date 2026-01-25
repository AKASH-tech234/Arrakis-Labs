import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";

// v3.2: Import event system for cross-component updates
import { emitSubmissionUpdate } from "../hooks/ai/useAIFeedbackEnhanced";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const initialState = {
  currentSubmission: null,
  submissionHistory: [],

  executionStatus: "idle",
  executionOutput: null,
  executionError: null,

  aiStatus: "idle",
  aiFeedback: null,
  aiError: null,
  aiRequestedForSubmissionId: null,

  revealedHintLevel: 1,
  showFullExplanation: false,

  showAIPanel: false,
};

const ActionTypes = {
  EXECUTION_START: "EXECUTION_START",
  EXECUTION_SUCCESS: "EXECUTION_SUCCESS",
  EXECUTION_ERROR: "EXECUTION_ERROR",
  EXECUTION_RESET: "EXECUTION_RESET",

  SUBMISSION_COMPLETE: "SUBMISSION_COMPLETE",
  SUBMISSION_CLEAR: "SUBMISSION_CLEAR",

  AI_REQUEST_START: "AI_REQUEST_START",
  AI_REQUEST_SUCCESS: "AI_REQUEST_SUCCESS",
  AI_REQUEST_ERROR: "AI_REQUEST_ERROR",
  AI_RESET: "AI_RESET",

  REVEAL_NEXT_HINT: "REVEAL_NEXT_HINT",
  TOGGLE_EXPLANATION: "TOGGLE_EXPLANATION",

  SHOW_AI_PANEL: "SHOW_AI_PANEL",
  HIDE_AI_PANEL: "HIDE_AI_PANEL",
};

function submissionReducer(state, action) {
  switch (action.type) {
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

    case ActionTypes.SUBMISSION_COMPLETE:
      return {
        ...state,
        currentSubmission: action.payload.submission,
        submissionHistory: [
          action.payload.submission,
          ...state.submissionHistory.slice(0, 9),
        ],
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

    case ActionTypes.SHOW_AI_PANEL:
      return { ...state, showAIPanel: true };

    case ActionTypes.HIDE_AI_PANEL:
      return { ...state, showAIPanel: false };

    default:
      return state;
  }
}

const SubmissionContext = createContext(null);

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

export function SubmissionProvider({ children }) {
  const [state, dispatch] = useReducer(submissionReducer, initialState);
  const abortControllerRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMISSION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a completed submission
   * If aiFeedback is included (from backend response), it will be set directly
   * This avoids duplicate AI calls when backend already provides feedback
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

    // ✨ NEW: If aiFeedback came with submission, set it immediately
    // This avoids duplicate API calls - backend already provided feedback!
    if (submissionData.aiFeedback) {
      console.log(
        "[SubmissionContext] AI feedback already included from backend - skipping duplicate call",
      );
      const processedFeedback = {
        success: true,
        verdict: submission.verdict,
        submissionId: submission.id,
        feedbackType:
          submissionData.aiFeedback.feedbackType || "error_feedback",
        hints: submissionData.aiFeedback.hints || [],
        allHintsCount: submissionData.aiFeedback.hints?.length || 0,
        explanation: submissionData.aiFeedback.explanation,
        hasExplanation: !!submissionData.aiFeedback.explanation,
        detectedPattern: submissionData.aiFeedback.detectedPattern,
        optimizationTips: submissionData.aiFeedback.optimizationTips || [],
        complexityAnalysis: submissionData.aiFeedback.complexityAnalysis,
        edgeCases: submissionData.aiFeedback.edgeCases || [],
        improvementHint: submissionData.aiFeedback.improvementHint,
        // ✨ NEW: Include MIM insights from backend
        mimInsights:
          submissionData.aiFeedback.mimInsights ||
          submissionData.aiFeedback.mim_insights ||
          null,
      };

      dispatch({
        type: ActionTypes.AI_REQUEST_SUCCESS,
        payload: { feedback: processedFeedback },
      });

      // v3.2: Emit event for cross-component updates (MIM, profile, etc.)
      emitSubmissionUpdate({
        type: "submission_with_feedback",
        questionId: submission.questionId,
        submissionId: submission.id,
        verdict: submission.verdict,
        feedback: processedFeedback,
        mimInsights: processedFeedback.mimInsights,
        timestamp: Date.now(),
      });
    }

    return submission;
  }, []);

  const clearSubmission = useCallback(() => {
    dispatch({ type: ActionTypes.SUBMISSION_CLEAR });
  }, []);

  const requestAIFeedback = useCallback(
    async (submissionData = null) => {
      const submission = submissionData || state.currentSubmission;

      if (!submission) {
        console.error("[SubmissionContext] No submission to analyze");
        return null;
      }

      if (
        state.aiRequestedForSubmissionId === submission.id &&
        state.aiStatus === "loading"
      ) {
        console.log(
          "[SubmissionContext] AI request already in progress for this submission",
        );
        return null;
      }

      if (
        state.aiRequestedForSubmissionId === submission.id &&
        state.aiFeedback
      ) {
        console.log("[SubmissionContext] Returning cached AI feedback");
        return state.aiFeedback;
      }

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
            // ✨ NEW: Include MIM insights from API response
            mimInsights:
              data.data.mimInsights || data.data.mim_insights || null,
          };

          dispatch({
            type: ActionTypes.AI_REQUEST_SUCCESS,
            payload: { feedback: processedFeedback },
          });

          // v3.2: Emit event for cross-component updates (MIM, profile, etc.)
          emitSubmissionUpdate({
            type: "feedback_received",
            questionId: submission.questionId,
            submissionId: submission.id,
            verdict: submission.verdict,
            feedback: processedFeedback,
            mimInsights: processedFeedback.mimInsights,
            timestamp: Date.now(),
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

  const resetAI = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch({ type: ActionTypes.AI_RESET });
  }, []);

  const retryAIFeedback = useCallback(async () => {
    resetAI();

    await new Promise((resolve) => setTimeout(resolve, 100));
    return requestAIFeedback();
  }, [resetAI, requestAIFeedback]);

  const revealNextHint = useCallback(() => {
    dispatch({ type: ActionTypes.REVEAL_NEXT_HINT });
  }, []);

  const toggleExplanation = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_EXPLANATION });
  }, []);

  const showAIPanel = useCallback(() => {
    dispatch({ type: ActionTypes.SHOW_AI_PANEL });
  }, []);

  const hideAIPanel = useCallback(() => {
    dispatch({ type: ActionTypes.HIDE_AI_PANEL });
  }, []);

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
      ...state,

      visibleHints,
      hasMoreHints,
      nextHintLabel,
      isAILoading: state.aiStatus === "loading",
      hasAIFeedback: state.aiStatus === "success" && !!state.aiFeedback,
      hasAIError: state.aiStatus === "error",

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

export function useSubmission() {
  const context = useContext(SubmissionContext);
  if (!context) {
    throw new Error("useSubmission must be used within a SubmissionProvider");
  }
  return context;
}

export default SubmissionContext;
