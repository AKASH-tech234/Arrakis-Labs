

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMySubmissions } from "../../services/common/api";
import { useAIFeedbackEnhanced } from "../../hooks/ai/useAIFeedbackEnhanced";
import AIFeedbackModal from "./AIFeedbackModal";
import WeeklyReportUI, { WeeklyReportButton } from "./WeeklyReportUI";
import ConfidenceBadge from "./ConfidenceBadge";
import LearningTimeline from "./LearningTimeline";

export default function AIFeedbackIntegration({
  questionId,
  problemCategory = "General",
  problemConstraints = "",
}) {
  const { user } = useAuth() || {};
  const userId = user?.id || user?._id;

  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

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

  const ai = useAIFeedbackEnhanced({
    userId,
    submissions,
  });

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

  const handleViewWeeklyReport = useCallback(() => {
    ai.openWeeklyReport();
  }, [ai]);

  return (
    <>
      {}
      {!loadingSubmissions && ai.confidenceBadge && (
        <ConfidenceBadge badge={ai.confidenceBadge} size="small" showStreak />
      )}

      {}
      <WeeklyReportButton
        onClick={handleViewWeeklyReport}
        loading={ai.loadingWeeklyReport}
        variant="secondary"
      />

      {}
      <AIFeedbackModal
        isOpen={ai.showAIModal}
        onClose={ai.closeFeedbackModal}
        loading={ai.isSubmitting}
        error={ai.feedbackError}
        feedback={ai.aiFeedback}
        confidenceBadge={ai.confidenceBadge}
        onViewWeeklyReport={handleViewWeeklyReport}
      />

      {}
      <WeeklyReportUI
        isOpen={ai.showWeeklyReport}
        onClose={ai.closeWeeklyReport}
        loading={ai.loadingWeeklyReport}
        error={ai.weeklyReportError}
        report={ai.weeklyReport}
        confidenceBadge={ai.confidenceBadge}
        lastFetchedAt={ai.weeklyReport?.generatedAt}
      />

      {}
      {ai.timeline.length > 0 && (
        <LearningTimeline
          timeline={ai.timeline}
          stats={ai.timelineStats}
          limit={10}
          showStats
        />
      )}

      {}
      {}
    </>
  );
}

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
    
    triggerAIFeedback,

    AIComponents,

    ai,
  };
}
