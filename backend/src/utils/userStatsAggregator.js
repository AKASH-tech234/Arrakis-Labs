/**
 * User Stats Aggregator
 * Manages user AI profile aggregation and caching
 */

import User from "../models/auth/User.js";
import Submission from "../models/profile/Submission.js";

// Cache for recent profile updates to avoid excessive writes
const profileUpdateCache = new Map();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Get the attempt number for a user on a specific problem
 * @param {string} userId - User ID
 * @param {string} questionId - Question ID
 * @returns {Promise<number>} - Attempt number (1-indexed)
 */
export async function getAttemptNumber(userId, questionId) {
  try {
    const count = await Submission.countDocuments({
      userId,
      questionId,
    });
    return count + 1; // Next attempt number
  } catch (error) {
    console.error("[Stats] Error getting attempt number:", error.message);
    return 1; // Default to 1 if error
  }
}

/**
 * Get user's AI profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User AI profile
 */
export async function getUserAIProfile(userId) {
  try {
    const user = await User.findById(userId)
      .select("aiProfile learningRoadmap stats")
      .lean();

    if (!user) {
      console.log("[Stats] User not found:", userId);
      return getDefaultProfile();
    }

    // Build profile from stored data
    const profile = {
      // Basic stats
      totalSubmissions: user.aiProfile?.totalSubmissions || 0,
      successRate: user.aiProfile?.successRate || 0,

      // Cognitive profile
      weakTopics: user.aiProfile?.weakTopics || [],
      strongTopics: user.aiProfile?.strongTopics || [],
      commonMistakes: user.aiProfile?.commonMistakes || [],
      recurringPatterns: user.aiProfile?.recurringPatterns || [],

      // Skill levels per topic
      // Note: After .lean(), Mongoose Map becomes a plain object, not an iterable
      skillLevels: user.aiProfile?.skillLevels
        ? (user.aiProfile.skillLevels instanceof Map
            ? Object.fromEntries(user.aiProfile.skillLevels)
            : typeof user.aiProfile.skillLevels === 'object'
              ? { ...user.aiProfile.skillLevels }
              : {})
        : {},

      // Learning preferences
      learningStyle: user.aiProfile?.learningStyle || null,
      recentCategories: user.aiProfile?.recentCategories || [],

      // Difficulty readiness
      difficultyReadiness: user.aiProfile?.difficultyReadiness || {
        easy: 1.0,
        medium: 0.5,
        hard: 0.2,
      },

      // Learning roadmap
      learningRoadmap: user.learningRoadmap || null,

      // Timestamps
      lastUpdated: user.aiProfile?.lastUpdated || null,
    };

    return profile;
  } catch (error) {
    console.error("[Stats] Error getting user AI profile:", error.message);
    return getDefaultProfile();
  }
}

/**
 * Get default profile for new users
 */
function getDefaultProfile() {
  return {
    totalSubmissions: 0,
    successRate: 0,
    weakTopics: [],
    strongTopics: [],
    commonMistakes: [],
    recurringPatterns: [],
    skillLevels: {},
    learningStyle: null,
    recentCategories: [],
    difficultyReadiness: {
      easy: 1.0,
      medium: 0.5,
      hard: 0.2,
    },
    learningRoadmap: null,
    lastUpdated: null,
  };
}

/**
 * Update user's AI profile based on recent submissions
 * This is called asynchronously after each submission
 * @param {string} userId - User ID
 * @param {boolean} force - Force update even if recently updated
 * @returns {Promise<Object>} - Updated AI profile
 */
export async function updateUserAIProfile(userId, force = false) {
  try {
    // Check cache to avoid excessive updates
    const cacheKey = `profile:${userId}`;
    const lastUpdate = profileUpdateCache.get(cacheKey);

    if (!force && lastUpdate && Date.now() - lastUpdate < CACHE_TTL_MS) {
      console.log("[STATS-AGG] AI profile still fresh, skipping update");
      return await getUserAIProfile(userId);
    }

    console.log("[STATS-AGG] Aggregating user stats for:", userId);

    // Get user's recent submissions for analysis
    const submissions = await Submission.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select(
        "status problemCategory problemDifficulty problemTags createdAt code language",
      )
      .lean();

    if (submissions.length === 0) {
      console.log("[STATS-AGG] No submissions found for user");
      return getDefaultProfile();
    }

    // Calculate success rate
    const acceptedCount = submissions.filter(
      (s) => s.status === "accepted",
    ).length;
    const successRate =
      submissions.length > 0 ? acceptedCount / submissions.length : 0;

    // Track topic performance
    const topicStats = {};
    submissions.forEach((sub) => {
      const topics = sub.problemTags || [];
      const category = sub.problemCategory || "General";

      // Add category as a topic
      if (category && !topics.includes(category)) {
        topics.push(category);
      }

      topics.forEach((topic) => {
        if (!topicStats[topic]) {
          topicStats[topic] = { attempts: 0, accepted: 0 };
        }
        topicStats[topic].attempts++;
        if (sub.status === "accepted") {
          topicStats[topic].accepted++;
        }
      });
    });

    // Identify strong and weak topics
    const strongTopics = [];
    const weakTopics = [];
    const skillLevels = new Map();

    Object.entries(topicStats).forEach(([topic, stats]) => {
      if (stats.attempts >= 2) {
        const rate = stats.accepted / stats.attempts;
        skillLevels.set(topic, Math.round(rate * 100));

        if (rate >= 0.7 && stats.attempts >= 3) {
          strongTopics.push(topic);
        } else if (rate < 0.4) {
          weakTopics.push(topic);
        }
      }
    });

    // Identify common mistake patterns from failed submissions
    const failedSubmissions = submissions.filter(
      (s) =>
        s.status !== "accepted" &&
        s.status !== "pending" &&
        s.status !== "running",
    );

    const mistakePatterns = {};
    failedSubmissions.forEach((sub) => {
      // Track error types
      if (sub.status === "time_limit_exceeded") {
        mistakePatterns["Efficiency Issues"] =
          (mistakePatterns["Efficiency Issues"] || 0) + 1;
      } else if (sub.status === "runtime_error") {
        mistakePatterns["Runtime Errors"] =
          (mistakePatterns["Runtime Errors"] || 0) + 1;
      } else if (sub.status === "wrong_answer") {
        mistakePatterns["Logic Errors"] =
          (mistakePatterns["Logic Errors"] || 0) + 1;
      } else if (sub.status === "compile_error") {
        mistakePatterns["Syntax Errors"] =
          (mistakePatterns["Syntax Errors"] || 0) + 1;
      }
    });

    // Sort and get top mistakes
    const commonMistakes = Object.entries(mistakePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);

    // Get recent categories (last 10 unique)
    const recentCategories = [
      ...new Set(
        submissions.slice(0, 20).map((s) => s.problemCategory || "General"),
      ),
    ].slice(0, 10);

    // Calculate difficulty readiness
    const difficultyStats = {
      Easy: { total: 0, accepted: 0 },
      Medium: { total: 0, accepted: 0 },
      Hard: { total: 0, accepted: 0 },
    };

    submissions.forEach((sub) => {
      const diff = sub.problemDifficulty || "Easy";
      if (difficultyStats[diff]) {
        difficultyStats[diff].total++;
        if (sub.status === "accepted") {
          difficultyStats[diff].accepted++;
        }
      }
    });

    const difficultyReadiness = {
      easy:
        difficultyStats.Easy.total > 0
          ? difficultyStats.Easy.accepted / difficultyStats.Easy.total
          : 1.0,
      medium:
        difficultyStats.Medium.total > 0
          ? difficultyStats.Medium.accepted / difficultyStats.Medium.total
          : 0.5,
      hard:
        difficultyStats.Hard.total > 0
          ? difficultyStats.Hard.accepted / difficultyStats.Hard.total
          : 0.2,
    };

    // Build the update object
    const aiProfileUpdate = {
      "aiProfile.totalSubmissions": submissions.length,
      "aiProfile.successRate": successRate,
      "aiProfile.strongTopics": strongTopics,
      "aiProfile.weakTopics": weakTopics,
      "aiProfile.commonMistakes": commonMistakes,
      "aiProfile.recentCategories": recentCategories,
      "aiProfile.skillLevels": skillLevels,
      "aiProfile.difficultyReadiness": difficultyReadiness,
      "aiProfile.lastUpdated": new Date(),
    };

    // Update user's AI profile in database
    await User.findByIdAndUpdate(userId, { $set: aiProfileUpdate });

    // Update cache
    profileUpdateCache.set(cacheKey, Date.now());

    console.log("[STATS-AGG] Profile updated successfully for:", userId);

    return await getUserAIProfile(userId);
  } catch (error) {
    console.error("[STATS-AGG] Error updating AI profile:", error.message);
    return getDefaultProfile();
  }
}

/**
 * Invalidate profile cache for a user
 * @param {string} userId - User ID
 */
export function invalidateProfileCache(userId) {
  const cacheKey = `profile:${userId}`;
  profileUpdateCache.delete(cacheKey);
}

export default {
  getAttemptNumber,
  getUserAIProfile,
  updateUserAIProfile,
  invalidateProfileCache,
};
