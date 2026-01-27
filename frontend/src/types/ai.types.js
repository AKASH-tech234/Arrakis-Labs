/**
 * @typedef {Object} MIMCorrectnessDTO
 * @property {string} rootCause - correctness, implementation, understanding_gap
 * @property {string} subtype - specific failure subtype
 * @property {string} failureMechanism - deterministic rule output
 * @property {number} confidence - 0.0 - 1.0
 * @property {string} explanation - personalized explanation
 * @property {string} fixDirection - strategy to fix
 * @property {string} exampleFix - code example
 * @property {boolean} isRecurring - repeated mistake?
 * @property {number} recurrenceCount - how many times
 * @property {string[]} relatedProblems - similar past problems
 */

/**
 * @typedef {Object} MIMPerformanceDTO
 * @property {string} rootCause - always "efficiency"
 * @property {string} subtype - efficiency-related subtype
 * @property {string} failureMechanism
 * @property {string} expectedComplexity - Big-O expected
 * @property {string} observedComplexity - Big-O observed
 * @property {string} optimizationDirection - what algorithmic shift needed
 */

/**
 * @typedef {Object} MIMReinforcementDTO
 * @property {string} category - problem category
 * @property {string} technique - technique demonstrated
 * @property {string} difficulty - easy/medium/hard
 * @property {number} confidenceBoost - 0.0 - 1.0
 * @property {string} strengthSignal - what skill this reinforces
 */

/**
 * @typedef {Object} MIMInsightsV3
 * @property {string|null} feedbackType - correctness, efficiency, implementation, understanding_gap, reinforcement
 * @property {MIMCorrectnessDTO|null} correctnessFeedback - For failed submissions
 * @property {MIMPerformanceDTO|null} performanceFeedback - For TLE/MLE
 * @property {MIMReinforcementDTO|null} reinforcementFeedback - For accepted
 * @property {Object|null} rootCause - Legacy: failure_cause, confidence
 * @property {Object|null} readiness - Legacy: currentLevel, recommendation
 * @property {Object|null} performanceForecast - Legacy: predicted outcome
 * @property {boolean} isColdStart - Limited data warning
 * @property {string|null} modelVersion - MIM model version
 */

/**
 * @typedef {Object} AIFeedbackResponse
 * @property {boolean} success
 * @property {string} verdict
 * @property {string} submissionId
 * @property {Array<{level: number, content: string, hint_type: string}>} hints
 * @property {string|null} explanation
 * @property {string|null} detectedPattern
 * @property {string[]|null} optimizationTips
 * @property {string|null} complexityAnalysis
 * @property {string[]|null} edgeCases
 * @property {MIMInsightsV3|null} mimInsights
 * @property {string} feedbackType - error_feedback, success_feedback, optimization
 */
export default {};
