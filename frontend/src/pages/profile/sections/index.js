import { lazy } from "react";

export const OverviewSection = lazy(() => import("./OverviewSection"));
export const AnalyticsSection = lazy(() => import("./AnalyticsSection"));
export const InsightsSection = lazy(() => import("./InsightsSection"));
export const LearningSection = lazy(() => import("./LearningSection"));

export const PROFILE_SECTIONS = {
  overview: {
    id: "overview",
    label: "Overview",
    description: "Profile summary and quick stats",
  },
  analytics: {
    id: "analytics",
    label: "Analytics",
    description: "Detailed performance analytics",
  },
  insights: {
    id: "insights",
    label: "AI Insights",
    description: "AI-powered analysis and recommendations",
  },
  learning: {
    id: "learning",
    label: "Learning",
    description: "Learning roadmap and progress",
  },
};

export const DEFAULT_SECTION = "overview";
