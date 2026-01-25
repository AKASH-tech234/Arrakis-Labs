

import { useMemo, useCallback } from "react";

export const TIMELINE_EVENT_TYPES = {
  SUBMISSION: "submission",
  FEEDBACK: "feedback",
  PATTERN: "pattern",
  DIFFICULTY: "difficulty",
};

function createTimelineEvent({
  type,
  title,
  description,
  timestamp,
  metadata = {},
}) {
  return {
    id: `${type}-${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title,
    description,
    timestamp: new Date(timestamp),
    metadata,
  };
}

function buildTimeline({
  submissions = [],
  feedbackCache = {},
  weeklyReport = null,
}) {
  const events = [];

  submissions.forEach((submission) => {
    const isAccepted =
      submission.verdict === "accepted" || submission.verdict === "Accepted";
    const timestamp =
      submission.submittedAt || submission.createdAt || new Date();

    events.push(
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPES.SUBMISSION,
        title: isAccepted ? "Solution Accepted ✓" : "Submission Failed",
        description: isAccepted
          ? `Solved ${submission.problemTitle || submission.questionId}`
          : `${submission.verdict?.replace(/_/g, " ")} on ${submission.problemTitle || submission.questionId}`,
        timestamp,
        metadata: {
          questionId: submission.questionId,
          verdict: submission.verdict,
          language: submission.language,
          isAccepted,
        },
      }),
    );

    const feedback =
      feedbackCache[submission.questionId] || submission.aiFeedback;
    if (feedback) {
      
      events.push(
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPES.FEEDBACK,
          title: "AI Feedback Received",
          description:
            feedback.explanation?.slice(0, 100) + "..." || "Feedback available",
          timestamp: new Date(new Date(timestamp).getTime() + 1000), 
          metadata: {
            questionId: submission.questionId,
            hasHint: !!feedback.improvement_hint,
          },
        }),
      );

      if (feedback.detected_pattern) {
        events.push(
          createTimelineEvent({
            type: TIMELINE_EVENT_TYPES.PATTERN,
            title: "Pattern Detected",
            description: feedback.detected_pattern,
            timestamp: new Date(new Date(timestamp).getTime() + 2000),
            metadata: {
              questionId: submission.questionId,
              pattern: feedback.detected_pattern,
            },
          }),
        );
      }
    }
  });

  if (weeklyReport?.recurring_patterns?.length > 0) {
    events.push(
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPES.PATTERN,
        title: "Weekly Patterns Identified",
        description: `${weeklyReport.recurring_patterns.length} recurring patterns found`,
        timestamp: weeklyReport.generatedAt || new Date(),
        metadata: {
          patterns: weeklyReport.recurring_patterns,
          isWeeklyReport: true,
        },
      }),
    );
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export function useLearningTimeline({
  submissions = [],
  feedbackCache = {},
  weeklyReport = null,
}) {
  
  const timeline = useMemo(
    () => buildTimeline({ submissions, feedbackCache, weeklyReport }),
    [submissions, feedbackCache, weeklyReport],
  );

  const filterByType = useCallback(
    (type) => timeline.filter((e) => e.type === type),
    [timeline],
  );

  const getEventsForProblem = useCallback(
    (questionId) =>
      timeline.filter((e) => e.metadata?.questionId === questionId),
    [timeline],
  );

  const getRecentEvents = useCallback(
    (count = 10) => timeline.slice(0, count),
    [timeline],
  );

  const stats = useMemo(() => {
    const submissionEvents = timeline.filter(
      (e) => e.type === TIMELINE_EVENT_TYPES.SUBMISSION,
    );
    const accepted = submissionEvents.filter(
      (e) => e.metadata?.isAccepted,
    ).length;
    const failed = submissionEvents.length - accepted;
    const patternsDetected = timeline.filter(
      (e) => e.type === TIMELINE_EVENT_TYPES.PATTERN,
    ).length;

    return {
      totalSubmissions: submissionEvents.length,
      accepted,
      failed,
      acceptanceRate:
        submissionEvents.length > 0
          ? Math.round((accepted / submissionEvents.length) * 100)
          : 0,
      patternsDetected,
      feedbackReceived: timeline.filter(
        (e) => e.type === TIMELINE_EVENT_TYPES.FEEDBACK,
      ).length,
    };
  }, [timeline]);

  return {
    
    timeline,
    stats,

    filterByType,
    getEventsForProblem,
    getRecentEvents,

    hasEvents: timeline.length > 0,
    eventCount: timeline.length,
  };
}

export { buildTimeline };
export default useLearningTimeline;
