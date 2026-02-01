export const CONFIDENCE_COLORS = {
  high: "#22C55E",
  medium: "#F59E0B",
  low: "#78716C",
};

export const CONFIDENCE_LABELS = {
  high: "High confidence diagnosis",
  medium: "Likely issue",
  low: "Exploratory feedback",
};

export const PATTERN_STATE_MESSAGES = {
  none: null,
  suspected: "This may be a recurring pattern",
  confirmed: "This is a confirmed recurring issue",
  stable: "You've encountered this pattern before and improved",
};

export const DIFFICULTY_MESSAGES = {
  maintain_pattern_unresolved: "Difficulty maintained to reinforce correctness",
  maintain_low_confidence: "Difficulty maintained (diagnosis uncertain)",
  maintain_default: "Difficulty maintained",
  increase_consistent_success: "Difficulty increased due to consistent success",
  increase_default: "Difficulty increased based on your progress",
  decrease_struggling: "Difficulty adjusted to strengthen fundamentals",
  decrease_default: "Difficulty adjusted to support your learning",
};

export function getDifficultyMessage(action, reason) {
  const key = `${action}_${reason}`;
  return DIFFICULTY_MESSAGES[key] || DIFFICULTY_MESSAGES[`${action}_default`] || "Difficulty unchanged";
}

export function shouldUseHedgingLanguage(level) {
  return level === "low";
}

export function shouldShowPattern(state) {
  return state && state !== "none";
}

export function isPatternConfirmed(state) {
  return state === "confirmed" || state === "stable";
}

export default {};
