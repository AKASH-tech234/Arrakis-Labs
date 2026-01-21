// src/hooks/useLearningTimeline.js
// Builds learning timeline from local data without blocking UI
// Async results are eventually consistent

import { useMemo, useCallback } from "react";

/**
 * Timeline event types
 */
export const TIMELINE_EVENT_TYPES = {
  SUBMISSION: "submission",
  FEEDBACK: "feedback",
  PATTERN: "pattern",
  DIFFICULTY: "difficulty",
};

/**
 * Create a timeline event object
 */
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

/**
 * Build timeline from submission history and AI feedback
 *
 * Data Sources:
 * - Local submission history
 * - AI feedback summaries already received (sync)
 * - Weekly report (when user opens it)
 *
 * Timeline Events:
 * - Submission (Accepted / Wrong)
 * - Feedback received
 * - Pattern detected (if present)
 * - Difficulty adjustment (label only)
 *
 * @param {Object} params
 * @param {Array} params.submissions - Submission history
 * @param {Object} params.feedbackCache - Map of questionId -> feedback
 * @param {Object} params.weeklyReport - Weekly report (if loaded)
 * @returns {Array} Sorted timeline events
 */
function buildTimeline({
  submissions = [],
  feedbackCache = {},
  weeklyReport = null,
}) {
  const events = [];

  // Process submissions
  submissions.forEach((submission) => {
    const isAccepted =
      submission.verdict === "accepted" || submission.verdict === "Accepted";
    const timestamp =
      submission.submittedAt || submission.createdAt || new Date();

    // Submission event
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

    // Check for associated feedback
    const feedback =
      feedbackCache[submission.questionId] || submission.aiFeedback;
    if (feedback) {
      // Feedback received event
      events.push(
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPES.FEEDBACK,
          title: "AI Feedback Received",
          description:
            feedback.explanation?.slice(0, 100) + "..." || "Feedback available",
          timestamp: new Date(new Date(timestamp).getTime() + 1000), // Slightly after submission
          metadata: {
            questionId: submission.questionId,
            hasHint: !!feedback.improvement_hint,
          },
        }),
      );

      // Pattern detected event (if present)
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

  // Add weekly report events if available
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

  // Sort by timestamp (most recent first)
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Custom hook for building and managing learning timeline
 *
 * RULES:
 * - Timeline updates immediately after sync feedback
 * - Async results are eventually consistent
 * - No blocking UI
 *
 * @param {Object} params
 * @param {Array} params.submissions - Submission history
 * @param {Object} params.feedbackCache - Cached feedback responses
 * @param {Object} params.weeklyReport - Weekly report (optional)
 * @returns {Object} Timeline data and utilities
 */
export function useLearningTimeline({
  submissions = [],
  feedbackCache = {},
  weeklyReport = null,
}) {
  // Build timeline from available data
  const timeline = useMemo(
    () => buildTimeline({ submissions, feedbackCache, weeklyReport }),
    [submissions, feedbackCache, weeklyReport],
  );

  // Filter by event type
  const filterByType = useCallback(
    (type) => timeline.filter((e) => e.type === type),
    [timeline],
  );

  // Get events for a specific problem
  const getEventsForProblem = useCallback(
    (questionId) =>
      timeline.filter((e) => e.metadata?.questionId === questionId),
    [timeline],
  );

  // Get recent events (last N)
  const getRecentEvents = useCallback(
    (count = 10) => timeline.slice(0, count),
    [timeline],
  );

  // Summary stats
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
    // Data
    timeline,
    stats,

    // Utilities
    filterByType,
    getEventsForProblem,
    getRecentEvents,

    // Computed
    hasEvents: timeline.length > 0,
    eventCount: timeline.length,
  };
}

export { buildTimeline };
export default useLearningTimeline;
