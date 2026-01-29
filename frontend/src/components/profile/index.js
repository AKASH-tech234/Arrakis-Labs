// src/components/profile/index.js
// Export all profile components

export {
  DifficultyProgressBars,
} from "./ProfileWidgets";

export { default as InsightsPatterns, emitInsightsRefresh } from "./InsightsPatterns";
export { default as CodingProfileModal } from "./CodingProfileModal";

// Advanced dynamic widgets
export {
  TopicMasteryGrid,
  NextProblemCard,
  WeakAreaFocus,
  emitAdvancedWidgetsRefresh,
} from "./AdvancedProfileWidgets";

// New AI Insight Components (Phase 2.x)
export { default as MistakeAnalysisCard } from "./MistakeAnalysisCard";
export { default as LearningVelocityIndicator, LearningVelocityBadge } from "./LearningVelocityIndicator";
export { default as FocusAreasWidget } from "./FocusAreasWidget";
export { default as AIInsightsSummary } from "./AIInsightsSummary";
