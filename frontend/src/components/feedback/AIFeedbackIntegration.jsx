// src/components/feedback/AIFeedbackIntegration.jsx
// Example integration component showing how to wire up all AI features
// This demonstrates the recommended pattern for integrating AI feedback

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMySubmissions } from "../../services/api";
import { useAIFeedbackEnhanced } from "../../hooks/useAIFeedbackEnhanced";
import AIFeedbackModal from "./AIFeedbackModal";
import WeeklyReportUI, { WeeklyReportButton } from "./WeeklyReportUI";
import ConfidenceBadge from "./ConfidenceBadge";
import LearningTimeline from "./LearningTimeline";

/**
 * AI Feedback Integration Example
 *
 * This component demonstrates how to integrate all AI features:
 * 1. AI Feedback Modal with progressive disclosure
 * 2. Weekly Report (on-demand)
 * 3. Confidence Badge (frontend-computed)
 * 4. Learning Timeline
 *
 * Usage in a problem page:
 * ```jsx
 * <AIFeedbackIntegration
 *   questionId={problem.id}
 *   problemCategory={problem.category}
 *   problemConstraints={problem.constraints}
 *   onSubmissionComplete={(result) => {
 *     // Handle submission result
 *   }}
 * />
 * ```
 */
export default function AIFeedbackIntegration({
  questionId,
  problemCategory = "General",
  problemConstraints = "",
}) {
  const { user } = useAuth() || {};
  const userId = user?.id || user?._id;

  // Local submissions state
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  // Load user submissions for confidence calculation
  useEffect(() => {
    let cancelled = false;

    async function loadSubmissions() {
      if (!userId) {
        setSubmissions([]);
        setLoadingSubmissions(false);
        return;
      }

      try {
        setLoadingSubmissions(true);
        const data = await getMySubmissions({ questionId });
        if (!cancelled) {
          setSubmissions(data || []);
        }
      } catch (err) {
        console.error("Failed to load submissions:", err);
        if (!cancelled) {
          setSubmissions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSubmissions(false);
        }
      }
    }

    loadSubmissions();
    return () => {
      cancelled = true;
    };
  }, [userId, questionId]);

  // Initialize enhanced AI feedback hook
  const ai = useAIFeedbackEnhanced({
    userId,
    submissions,
  });

  /**
   * Handle failed submission - trigger AI feedback
   * Call this from your submit handler when verdict !== "accepted"
   */
  const handleFailedSubmission = useCallback(
    ({ code, language, verdict, errorType }) => {
      ai.openFeedbackModal({
        questionId,
        problemCategory,
        constraints: problemConstraints,
        code,
        language,
        verdict,
        errorType,
      });
    },
    [ai, questionId, problemCategory, problemConstraints],
  );

  /**
   * Handle viewing weekly report
   */
  const handleViewWeeklyReport = useCallback(() => {
    ai.openWeeklyReport();
  }, [ai]);

  return (
    <>
      {/* Confidence Badge - Display near problem title */}
      {!loadingSubmissions && ai.confidenceBadge && (
        <ConfidenceBadge badge={ai.confidenceBadge} size="small" showStreak />
      )}

      {/* Weekly Report Button */}
      <WeeklyReportButton
        onClick={handleViewWeeklyReport}
        loading={ai.loadingWeeklyReport}
        variant="secondary"
      />

      {/* AI Feedback Modal with Progressive Disclosure */}
      <AIFeedbackModal
        isOpen={ai.showAIModal}
        onClose={ai.closeFeedbackModal}
        loading={ai.isSubmitting}
        error={ai.feedbackError}
        feedback={ai.aiFeedback}
        confidenceBadge={ai.confidenceBadge}
        onViewWeeklyReport={handleViewWeeklyReport}
      />

      {/* Weekly Report Modal */}
      <WeeklyReportUI
        isOpen={ai.showWeeklyReport}
        onClose={ai.closeWeeklyReport}
        loading={ai.loadingWeeklyReport}
        error={ai.weeklyReportError}
        report={ai.weeklyReport}
        confidenceBadge={ai.confidenceBadge}
        lastFetchedAt={ai.weeklyReport?.generatedAt}
      />

      {/* Learning Timeline (for profile/dashboard) */}
      {ai.timeline.length > 0 && (
        <LearningTimeline
          timeline={ai.timeline}
          stats={ai.timelineStats}
          limit={10}
          showStats
        />
      )}

      {/* Export handler for parent component */}
      {/* Parent should call handleFailedSubmission after failed submissions */}
    </>
  );
}

/**
 * Hook for parent components to integrate AI feedback into submission flow
 *
 * Usage:
 * ```jsx
 * function ProblemPage() {
 *   const { triggerAIFeedback, AIComponents } = useAIFeedbackFlow({
 *     userId: user.id,
 *     questionId: problem.id,
 *     problemCategory: problem.category,
 *   });
 *
 *   const handleSubmit = async (code, language) => {
 *     const result = await submitQuestion({ questionId, code, language });
 *
 *     if (result.status !== 'accepted') {
 *       triggerAIFeedback({
 *         code,
 *         language,
 *         verdict: result.status,
 *         errorType: result.errorType,
 *       });
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {AIComponents}
 *       <button onClick={() => handleSubmit(code, language)}>Submit</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAIFeedbackFlow({
  userId,
  questionId,
  problemCategory,
  problemConstraints,
  submissions = [],
}) {
  const ai = useAIFeedbackEnhanced({ userId, submissions });

  const triggerAIFeedback = useCallback(
    ({ code, language, verdict, errorType }) => {
      ai.openFeedbackModal({
        questionId,
        problemCategory,
        constraints: problemConstraints,
        code,
        language,
        verdict,
        errorType,
      });
    },
    [ai, questionId, problemCategory, problemConstraints],
  );

  // Render function for AI components
  const AIComponents = (
    <>
      <AIFeedbackModal
        isOpen={ai.showAIModal}
        onClose={ai.closeFeedbackModal}
        loading={ai.isSubmitting}
        error={ai.feedbackError}
        feedback={ai.aiFeedback}
        confidenceBadge={ai.confidenceBadge}
        onViewWeeklyReport={ai.openWeeklyReport}
      />

      <WeeklyReportUI
        isOpen={ai.showWeeklyReport}
        onClose={ai.closeWeeklyReport}
        loading={ai.loadingWeeklyReport}
        error={ai.weeklyReportError}
        report={ai.weeklyReport}
        confidenceBadge={ai.confidenceBadge}
        lastFetchedAt={ai.weeklyReport?.generatedAt}
      />
    </>
  );

  return {
    // Trigger function
    triggerAIFeedback,

    // Components to render
    AIComponents,

    // Full AI state for advanced use
    ai,
  };
}
