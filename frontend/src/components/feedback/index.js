// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK COMPONENTS EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Main feedback panels
export { default as AIFeedbackPanel } from "./AIFeedbackPanel";
export { default as AIFeedbackPanelV2 } from "./AIFeedbackPanelV2";
export {
  default as AIFeedbackModal,
  ProgressiveHintDisclosure,
} from "./AIFeedbackModal";

// Confidence components (Phase 2.1)
export {
  default as ConfidenceBadge,
  ConfidenceIndicator,
  ConfidenceStatsCard,
  DiagnosisConfidenceBadge,
} from "./ConfidenceBadge";

// Pattern components (Phase 2.2)
export {
  default as PatternInsightPanel,
  PatternInsightBadge,
} from "./PatternInsightPanel";

// Difficulty components (Phase 2.3)
export {
  default as DifficultyStatusPanel,
  DifficultyStatusBadge,
  DifficultyStatusText,
} from "./DifficultyStatusPanel";

// RAG/Memory components
export {
  default as MemoryIndicator,
  MemoryDot,
  MemoryIcon,
} from "./MemoryIndicator";

// Report & Timeline components
export {
  default as WeeklyReportUI,
  WeeklyReportButton,
  WeeklyReportContent,
} from "./WeeklyReportUI";
export {
  default as LearningTimeline,
  CompactTimeline,
} from "./LearningTimeline";

// Integration helpers
export {
  default as AIFeedbackIntegration,
  useAIFeedbackFlow,
} from "./AIFeedbackIntegration";
