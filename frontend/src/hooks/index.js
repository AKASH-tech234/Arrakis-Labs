// src/hooks/index.js
// Centralized exports for all hooks

export { default as useAIFeedback } from "./ai/useAIFeedback";
export { default as useAIFeedbackEnhanced } from "./ai/useAIFeedbackEnhanced";
export { default as useWeeklyReport } from "./profile/useWeeklyReport";
export {
  default as useConfidenceBadge,
  useProblemConfidence,
  calculateConfidence,
} from "./common/useConfidenceBadge";
export {
  default as useLearningTimeline,
  TIMELINE_EVENT_TYPES,
  buildTimeline,
} from "./profile/useLearningTimeline";
export { default as useContestTimer } from "./contest/useContestTimer";
export { default as useContestWebSocket } from "./contest/useContestWebSocket";
