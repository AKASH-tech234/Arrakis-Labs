export {
  default as CognitiveProfile,
  emitProfileRefresh,
} from "./CognitiveProfile";
export {
  default as ProblemRecommendations,
  emitRecommendationsRefresh,
} from "./ProblemRecommendations";
export { default as MIMInsights } from "./MIMInsights";
export { default as MIMInsightsV3 } from "./MIMInsightsV3";
export {
  default as LearningRoadmap,
  emitRoadmapRefresh,
} from "./LearningRoadmap";
export { default as SkillRadarChart } from "./SkillRadarChart";

export function refreshAllMIMComponents() {
  console.log("[MIM] Refreshing all profile components...");

  import("./CognitiveProfile").then((m) => m.emitProfileRefresh?.());
  import("./ProblemRecommendations").then((m) =>
    m.emitRecommendationsRefresh?.(),
  );
  import("./LearningRoadmap").then((m) => m.emitRoadmapRefresh?.());

  import("../profile/InsightsPatterns").then((m) => m.emitInsightsRefresh?.());

  import("../profile/AdvancedProfileWidgets").then((m) => m.emitAdvancedWidgetsRefresh?.());
}
