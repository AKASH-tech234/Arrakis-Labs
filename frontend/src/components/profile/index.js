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
