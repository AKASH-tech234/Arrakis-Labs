

import { useMemo } from "react";

const BADGE_CONFIG = {
  high: {
    level: "high",
    label: "High Confidence",
    color: "#22C55E", 
    emoji: "🟢",
    description: "Consecutive accepted submissions",
  },
  medium: {
    level: "medium",
    label: "Medium Confidence",
    color: "#F59E0B", 
    emoji: "🟡",
    description: "Mixed results pattern",
  },
  low: {
    level: "low",
    label: "Low Confidence",
    color: "#EF4444", 
    emoji: "🔴",
    description: "Frequent wrong answers",
  },
};

const THRESHOLDS = {
  HIGH_STREAK: 3, 
  LOW_FAIL_RATE: 0.6, 
  RECENT_WINDOW: 10, 
};

function calculateConfidence(submissions) {
  if (!submissions || submissions.length === 0) {
    return {
      ...BADGE_CONFIG.medium,
      streak: 0,
      recentStats: { accepted: 0, failed: 0, total: 0 },
    };
  }

  const sorted = [...submissions].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
  );

  const recent = sorted.slice(0, THRESHOLDS.RECENT_WINDOW);

  let streak = 0;
  for (const sub of sorted) {
    if (sub.verdict === "accepted" || sub.verdict === "Accepted") {
      streak++;
    } else {
      break;
    }
  }

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

  let badge;

  if (streak >= THRESHOLDS.HIGH_STREAK) {
    
    badge = BADGE_CONFIG.high;
  } else if (
    recentStats.total > 0 &&
    recentStats.failed / recentStats.total > THRESHOLDS.LOW_FAIL_RATE
  ) {
    
    badge = BADGE_CONFIG.low;
  } else {
    
    badge = BADGE_CONFIG.medium;
  }

  return {
    ...badge,
    streak,
    recentStats,
  };
}

export function useConfidenceBadge(submissions) {
  const badge = useMemo(() => calculateConfidence(submissions), [submissions]);
  return badge;
}

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

export { calculateConfidence };

export default useConfidenceBadge;
