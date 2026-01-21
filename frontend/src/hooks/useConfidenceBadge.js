// src/hooks/useConfidenceBadge.js
// Computes confidence level purely from frontend submission history
// ❌ No new backend calls | Uses existing submission data

import { useMemo } from "react";

/**
 * Badge level configuration
 */
const BADGE_CONFIG = {
  high: {
    level: "high",
    label: "High Confidence",
    color: "#22C55E", // Green
    emoji: "🟢",
    description: "Consecutive accepted submissions",
  },
  medium: {
    level: "medium",
    label: "Medium Confidence",
    color: "#F59E0B", // Yellow/Amber
    emoji: "🟡",
    description: "Mixed results pattern",
  },
  low: {
    level: "low",
    label: "Low Confidence",
    color: "#EF4444", // Red
    emoji: "🔴",
    description: "Frequent wrong answers",
  },
};

/**
 * Thresholds for confidence calculation
 */
const THRESHOLDS = {
  HIGH_STREAK: 3, // Consecutive accepted for high confidence
  LOW_FAIL_RATE: 0.6, // >60% failures for low confidence
  RECENT_WINDOW: 10, // Consider last 10 submissions
};

/**
 * Calculate confidence level from submission history
 *
 * Logic:
 * - 🟢 High: 3+ consecutive accepted submissions
 * - 🟡 Medium: Mixed results (neither streak nor high fail rate)
 * - 🔴 Low: >60% failures in recent window
 *
 * @param {Array<{verdict: string, submittedAt: Date|string}>} submissions - Submission history
 * @returns {Object} Confidence badge data
 */
function calculateConfidence(submissions) {
  if (!submissions || submissions.length === 0) {
    return {
      ...BADGE_CONFIG.medium,
      streak: 0,
      recentStats: { accepted: 0, failed: 0, total: 0 },
    };
  }

  // Sort by date (most recent first)
  const sorted = [...submissions].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
  );

  // Get recent submissions window
  const recent = sorted.slice(0, THRESHOLDS.RECENT_WINDOW);

  // Calculate current streak (consecutive accepted from most recent)
  let streak = 0;
  for (const sub of sorted) {
    if (sub.verdict === "accepted" || sub.verdict === "Accepted") {
      streak++;
    } else {
      break;
    }
  }

  // Calculate recent stats
  const recentStats = recent.reduce(
    (acc, sub) => {
      const isAccepted =
        sub.verdict === "accepted" || sub.verdict === "Accepted";
      return {
        accepted: acc.accepted + (isAccepted ? 1 : 0),
        failed: acc.failed + (isAccepted ? 0 : 1),
        total: acc.total + 1,
      };
    },
    { accepted: 0, failed: 0, total: 0 },
  );

  // Determine confidence level
  let badge;

  if (streak >= THRESHOLDS.HIGH_STREAK) {
    // High confidence: consecutive accepted
    badge = BADGE_CONFIG.high;
  } else if (
    recentStats.total > 0 &&
    recentStats.failed / recentStats.total > THRESHOLDS.LOW_FAIL_RATE
  ) {
    // Low confidence: high failure rate
    badge = BADGE_CONFIG.low;
  } else {
    // Medium confidence: mixed results
    badge = BADGE_CONFIG.medium;
  }

  return {
    ...badge,
    streak,
    recentStats,
  };
}

/**
 * Custom hook for computing confidence badge from submission history
 *
 * RULES:
 * - ❌ No new backend calls
 * - Uses existing submission history (already available in frontend state)
 * - Computed purely on frontend
 *
 * @param {Array<{verdict: string, submittedAt: Date|string}>} submissions - Submission history
 * @returns {Object} Confidence badge with level, label, color, streak
 */
export function useConfidenceBadge(submissions) {
  const badge = useMemo(() => calculateConfidence(submissions), [submissions]);
  return badge;
}

/**
 * Calculate confidence for a specific problem
 * @param {Array} submissions - All submissions
 * @param {string} problemId - Problem to filter by
 * @returns {Object} Problem-specific confidence badge
 */
export function useProblemConfidence(submissions, problemId) {
  const badge = useMemo(() => {
    if (!problemId) return calculateConfidence([]);
    const filtered = (submissions || []).filter(
      (s) => s.questionId === problemId || s.problemId === problemId,
    );
    return calculateConfidence(filtered);
  }, [submissions, problemId]);
  return badge;
}

/**
 * Standalone function to calculate confidence (for use outside hooks)
 */
export { calculateConfidence };

export default useConfidenceBadge;
