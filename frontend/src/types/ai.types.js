// src/types/ai.types.js
// Type definitions for AI-related data structures (JSDoc for TypeScript-like hints)

/**
 * @typedef {Object} AIFeedbackResponse
 * @property {string} explanation - Main explanation from feedback agent
 * @property {string} improvement_hint - Actionable improvement hint
 * @property {string|null} detected_pattern - Detected coding pattern (if any)
 * @property {string|null} hint - Compressed hint from hint agent
 */

/**
 * @typedef {Object} WeeklyReportResponse
 * @property {string} summary - Weekly progress summary
 * @property {string[]} strengths - List of identified strengths
 * @property {string[]} improvement_areas - Areas needing improvement
 * @property {string[]|null} recurring_patterns - Recurring mistake patterns
 */

/**
 * @typedef {Object} SubmissionRecord
 * @property {string} id - Submission ID
 * @property {string} questionId - Associated question ID
 * @property {string} verdict - Submission verdict (accepted, wrong_answer, etc.)
 * @property {string} language - Programming language used
 * @property {Date|string} submittedAt - Timestamp of submission
 * @property {string|null} errorType - Type of error (if any)
 * @property {AIFeedbackResponse|null} aiFeedback - AI feedback received (if any)
 */

/**
 * @typedef {'high'|'medium'|'low'} ConfidenceLevel
 */

/**
 * @typedef {Object} ConfidenceBadge
 * @property {ConfidenceLevel} level - Confidence level
 * @property {number} streak - Current streak count
 * @property {string} label - Display label
 * @property {string} color - Badge color
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {string} id - Event ID
 * @property {'submission'|'feedback'|'pattern'|'difficulty'} type - Event type
 * @property {string} title - Event title
 * @property {string} description - Event description
 * @property {Date|string} timestamp - Event timestamp
 * @property {Object} metadata - Additional event data
 */

/**
 * @typedef {Object} AIFeedbackState
 * @property {boolean} isSubmitting - Whether a submission is in progress
 * @property {AIFeedbackResponse|null} aiFeedback - Current AI feedback
 * @property {boolean} showAIModal - Whether AI modal is visible
 * @property {boolean} showHint - Whether hint is revealed
 * @property {boolean} showPattern - Whether pattern is revealed
 * @property {WeeklyReportResponse|null} weeklyReport - Cached weekly report
 * @property {boolean} loadingWeeklyReport - Whether weekly report is loading
 */

export default {};
