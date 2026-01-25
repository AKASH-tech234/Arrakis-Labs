import Submission from "../models/Submission.js";
import User from "../models/User.js";

/**
 * User Stats Aggregator
 * Computes AI profile metrics from submission history using MongoDB aggregation
 */

const LOG_PREFIX = "\x1b[36m[STATS-AGG]\x1b[0m";

/**
 * Compute user's AI profile from submission history
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Computed AI profile
 */
export async function computeUserAIProfile(userId) {
  console.log(`${LOG_PREFIX} Computing AI profile for user: ${userId}`);

  try {
    // Aggregation pipeline to compute stats
    const pipeline = [
      { $match: { userId: userId, isRun: false } },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          acceptedCount: {
            $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
          },
          // Group by category for weak/strong topic analysis
          categories: { $push: "$problemCategory" },
          difficulties: { $push: "$problemDifficulty" },
          statuses: { $push: "$status" },
          tags: { $push: "$problemTags" },
        },
      },
    ];

    const [stats] = await Submission.aggregate(pipeline);

    if (!stats || stats.totalSubmissions === 0) {
      console.log(`${LOG_PREFIX} No submissions found for user: ${userId}`);
      return getDefaultAIProfile();
    }

    // Compute success rate
    const successRate = stats.acceptedCount / stats.totalSubmissions;

    // Analyze category performance
    const categoryPerformance = await analyzeCategoryPerformance(userId);

    // Find weak topics (success rate < 40%)
    const weakTopics = Object.entries(categoryPerformance)
      .filter(([_, perf]) => perf.successRate < 0.4 && perf.total >= 2)
      .map(([cat]) => cat)
      .slice(0, 5);

    // Find strong topics (success rate > 70%)
    const strongTopics = Object.entries(categoryPerformance)
      .filter(([_, perf]) => perf.successRate > 0.7 && perf.total >= 3)
      .map(([cat]) => cat)
      .slice(0, 5);

    // Compute skill levels per topic (0-100 scale)
    const skillLevels = {};
    for (const [cat, perf] of Object.entries(categoryPerformance)) {
      skillLevels[cat] = Math.round(perf.successRate * 100);
    }

    // Get recent categories (last 10 submissions)
    const recentSubmissions = await Submission.find({ userId, isRun: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("problemCategory")
      .lean();

    const recentCategories = [
      ...new Set(
        recentSubmissions
          .map((s) => s.problemCategory)
          .filter((c) => c && c !== "General"),
      ),
    ].slice(0, 5);

    // Analyze common mistakes from failed submissions
    const commonMistakes = await analyzeCommonMistakes(userId);

    // Analyze recurring patterns
    const recurringPatterns = await analyzeRecurringPatterns(userId);

    // Compute difficulty readiness
    const difficultyReadiness = await computeDifficultyReadiness(userId);

    const aiProfile = {
      weakTopics,
      strongTopics,
      commonMistakes,
      recurringPatterns,
      successRate: Math.round(successRate * 100) / 100,
      totalSubmissions: stats.totalSubmissions,
      recentCategories,
      skillLevels,
      difficultyReadiness,
      lastUpdated: new Date(),
    };

    console.log(`${LOG_PREFIX} AI profile computed:`, {
      userId,
      successRate: aiProfile.successRate,
      weakTopics: aiProfile.weakTopics.length,
      strongTopics: aiProfile.strongTopics.length,
    });

    return aiProfile;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error computing AI profile:`, error.message);
    return getDefaultAIProfile();
  }
}

/**
 * Analyze category performance for a user
 */
async function analyzeCategoryPerformance(userId) {
  const pipeline = [
    {
      $match: { userId: userId, isRun: false, problemCategory: { $ne: null } },
    },
    {
      $group: {
        _id: "$problemCategory",
        total: { $sum: 1 },
        accepted: {
          $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
        },
      },
    },
  ];

  const results = await Submission.aggregate(pipeline);

  const performance = {};
  for (const r of results) {
    if (r._id) {
      performance[r._id] = {
        total: r.total,
        accepted: r.accepted,
        successRate: r.total > 0 ? r.accepted / r.total : 0,
      };
    }
  }

  return performance;
}

/**
 * Analyze common mistakes from failed submissions
 */
async function analyzeCommonMistakes(userId) {
  const pipeline = [
    {
      $match: {
        userId: userId,
        isRun: false,
        status: { $nin: ["accepted", "pending", "running"] },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ];

  const results = await Submission.aggregate(pipeline);

  const mistakeMap = {
    wrong_answer: "Logic errors in solution",
    time_limit_exceeded: "Inefficient algorithm complexity",
    runtime_error: "Edge case handling issues",
    memory_limit_exceeded: "Excessive memory usage",
    compile_error: "Syntax errors",
  };

  return results.map((r) => mistakeMap[r._id] || r._id).filter((m) => m);
}

/**
 * Analyze recurring patterns in user's mistakes
 */
async function analyzeRecurringPatterns(userId) {
  // Get recent failed submissions
  const failedSubmissions = await Submission.find({
    userId,
    isRun: false,
    status: { $nin: ["accepted", "pending", "running"] },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .select("status problemCategory problemDifficulty")
    .lean();

  const patterns = [];

  // Check for difficulty-specific struggles
  const difficultyFailures = {};
  for (const sub of failedSubmissions) {
    const diff = sub.problemDifficulty || "Unknown";
    difficultyFailures[diff] = (difficultyFailures[diff] || 0) + 1;
  }

  for (const [diff, count] of Object.entries(difficultyFailures)) {
    if (count >= 5) {
      patterns.push(`Struggles with ${diff} problems`);
    }
  }

  // Check for category-specific struggles
  const categoryFailures = {};
  for (const sub of failedSubmissions) {
    const cat = sub.problemCategory || "General";
    categoryFailures[cat] = (categoryFailures[cat] || 0) + 1;
  }

  for (const [cat, count] of Object.entries(categoryFailures)) {
    if (count >= 3 && cat !== "General") {
      patterns.push(`Needs practice in ${cat}`);
    }
  }

  // Check for status-specific patterns
  const statusCounts = {};
  for (const sub of failedSubmissions) {
    statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
  }

  if ((statusCounts.time_limit_exceeded || 0) >= 5) {
    patterns.push("Frequently hits time limits - focus on optimization");
  }
  if ((statusCounts.runtime_error || 0) >= 5) {
    patterns.push("Frequent runtime errors - check edge cases");
  }

  return patterns.slice(0, 5);
}

/**
 * Compute readiness scores for each difficulty level
 */
async function computeDifficultyReadiness(userId) {
  const pipeline = [
    {
      $match: {
        userId: userId,
        isRun: false,
        problemDifficulty: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$problemDifficulty",
        total: { $sum: 1 },
        accepted: {
          $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
        },
      },
    },
  ];

  const results = await Submission.aggregate(pipeline);

  const readiness = {
    easy: 1.0,
    medium: 0.5,
    hard: 0.2,
  };

  for (const r of results) {
    const diff = (r._id || "").toLowerCase();
    if (diff in readiness && r.total >= 3) {
      readiness[diff] = Math.round((r.accepted / r.total) * 100) / 100;
    }
  }

  return readiness;
}

/**
 * Get default AI profile for new users
 */
function getDefaultAIProfile() {
  return {
    weakTopics: [],
    strongTopics: [],
    commonMistakes: [],
    recurringPatterns: [],
    successRate: 0,
    totalSubmissions: 0,
    recentCategories: [],
    skillLevels: {},
    difficultyReadiness: {
      easy: 1.0,
      medium: 0.5,
      hard: 0.2,
    },
    lastUpdated: new Date(),
  };
}

/**
 * Update user's AI profile in database
 * @param {string} userId - User ID
 * @param {boolean} force - Force update even if recently updated
 */
export async function updateUserAIProfile(userId, force = false) {
  try {
    const user = await User.findById(userId).select("aiProfile").lean();

    // Check if update is needed (stale after 1 hour)
    if (!force && user?.aiProfile?.lastUpdated) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (user.aiProfile.lastUpdated > hourAgo) {
        console.log(`${LOG_PREFIX} AI profile still fresh, skipping update`);
        return user.aiProfile;
      }
    }

    // Compute new profile
    const aiProfile = await computeUserAIProfile(userId);

    // Update in database
    await User.findByIdAndUpdate(userId, { aiProfile });

    console.log(`${LOG_PREFIX} AI profile updated for user: ${userId}`);

    return aiProfile;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating AI profile:`, error.message);
    return getDefaultAIProfile();
  }
}

/**
 * Get user's AI profile (from cache or compute)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - AI profile
 */
export async function getUserAIProfile(userId) {
  try {
    const user = await User.findById(userId).select("aiProfile").lean();

    // If no profile or stale, update it
    if (!user?.aiProfile?.lastUpdated) {
      return await updateUserAIProfile(userId, true);
    }

    // Check staleness (1 hour)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user.aiProfile.lastUpdated < hourAgo) {
      // Update async, but return current data immediately
      updateUserAIProfile(userId).catch(console.error);
    }

    return user.aiProfile;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting AI profile:`, error.message);
    return getDefaultAIProfile();
  }
}

/**
 * Count previous attempts for user on a problem
 * @param {string} userId - User ID
 * @param {string} questionId - Question ID
 * @returns {Promise<number>} - Attempt number (1-based for new submission)
 */
export async function getAttemptNumber(userId, questionId) {
  try {
    const count = await Submission.countDocuments({
      userId,
      questionId,
      isRun: false,
    });
    return count + 1; // Next attempt number
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting attempt number:`, error.message);
    return 1;
  }
}

export default {
  computeUserAIProfile,
  updateUserAIProfile,
  getUserAIProfile,
  getAttemptNumber,
};
