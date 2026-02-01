/**
 * Profile Sections - Orchestration Layer
 *
 * This module provides lazy-loaded section components for the Profile page.
 * Each section groups related components for better performance and organization.
 *
 * Sections:
 * - Overview: Identity, stats, activity (lightweight, loads first)
 * - Analytics: Charts, submissions, progress (data-heavy)
 * - Insights: AI-powered analysis, patterns, recommendations
 * - Learning: Roadmap, mastery, focus areas
 */

import { lazy } from "react";

// Lazy load all sections for performance
export const OverviewSection = lazy(() => import("./OverviewSection"));
export const AnalyticsSection = lazy(() => import("./AnalyticsSection"));
export const InsightsSection = lazy(() => import("./InsightsSection"));
export const LearningSection = lazy(() => import("./LearningSection"));

// Section metadata for navigation
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
