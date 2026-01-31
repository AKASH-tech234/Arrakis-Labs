import mongoose from "mongoose";

/**
 * User OA History Schema
 * Tracks user's OA history for analytics and adaptive question selection
 */
const userOAHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // === ATTEMPTED QUESTIONS (to avoid repeats) ===
    attemptedCoding: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        lastAttemptedAt: Date,
        bestPassRate: { type: Number, default: 0 }, // 0-1
        attemptCount: { type: Number, default: 1 },
        bestVerdict: String,
      },
    ],

    // === TOPIC PROFICIENCY (for adaptive difficulty) ===
    topicProficiency: {
      type: Map,
      of: {
        attempted: { type: Number, default: 0 },
        fullySolved: { type: Number, default: 0 },
        partiallySolved: { type: Number, default: 0 },
        avgPassRate: { type: Number, default: 0 },
        avgTime: { type: Number, default: 0 },
        lastAttempted: Date,
      },
      default: () => new Map(),
    },

    // === DIFFICULTY PROFICIENCY ===
    difficultyProficiency: {
      type: {
        easy: {
          attempted: { type: Number, default: 0 },
          fullySolved: { type: Number, default: 0 },
          avgPassRate: { type: Number, default: 0 },
        },
        medium: {
          attempted: { type: Number, default: 0 },
          fullySolved: { type: Number, default: 0 },
          avgPassRate: { type: Number, default: 0 },
        },
        hard: {
          attempted: { type: Number, default: 0 },
          fullySolved: { type: Number, default: 0 },
          avgPassRate: { type: Number, default: 0 },
        },
      },
      default: () => ({
        easy: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
        medium: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
        hard: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
      }),
    },

    // === OVERALL STATS ===
    totalOAs: { type: Number, default: 0 },
    completedOAs: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 }, // seconds
    totalQuestionsAttempted: { type: Number, default: 0 },
    totalQuestionsSolved: { type: Number, default: 0 },

    // === RECENT OA SESSIONS ===
    recentSessions: [
      {
        sessionId: mongoose.Schema.Types.ObjectId,
        score: Number,
        maxScore: Number,
        completedAt: Date,
        practiceLevel: String,
      },
    ],

    // === STREAK TRACKING ===
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastOADate: Date,
    },
  },
  { timestamps: true }
);

// Index
userOAHistorySchema.index({ userId: 1 });

// Get or create history for user
userOAHistorySchema.statics.getOrCreate = async function (userId) {
  let history = await this.findOne({ userId });
  if (!history) {
    history = await this.create({
      userId,
      topicProficiency: new Map(),
      difficultyProficiency: {
        easy: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
        medium: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
        hard: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
      },
    });
  }
  // Ensure maps and objects exist for existing records
  if (!history.topicProficiency) {
    history.topicProficiency = new Map();
  }
  if (!history.difficultyProficiency) {
    history.difficultyProficiency = {
      easy: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
      medium: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
      hard: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
    };
  }
  return history;
};

// Check if question was previously attempted
userOAHistorySchema.methods.wasQuestionAttempted = function (questionId) {
  return this.attemptedCoding.some(
    (q) => q.questionId.toString() === questionId.toString()
  );
};

// Get weak topics (for recommendations)
userOAHistorySchema.methods.getWeakTopics = function (threshold = 0.5) {
  const weak = [];
  if (this.topicProficiency) {
    for (const [topic, stats] of this.topicProficiency.entries()) {
      if (stats.avgPassRate < threshold && stats.attempted >= 2) {
        weak.push({
          topic,
          avgPassRate: stats.avgPassRate,
          attempted: stats.attempted,
        });
      }
    }
  }
  return weak.sort((a, b) => a.avgPassRate - b.avgPassRate);
};

// Get strong topics
userOAHistorySchema.methods.getStrongTopics = function (threshold = 0.7) {
  const strong = [];
  if (this.topicProficiency) {
    for (const [topic, stats] of this.topicProficiency.entries()) {
      if (stats.avgPassRate >= threshold && stats.attempted >= 2) {
        strong.push({
          topic,
          avgPassRate: stats.avgPassRate,
          attempted: stats.attempted,
        });
      }
    }
  }
  return strong.sort((a, b) => b.avgPassRate - a.avgPassRate);
};

// Update stats after OA completion
userOAHistorySchema.methods.updateAfterOA = async function (report) {
  // Update totals
  this.totalOAs += 1;
  if (report.score.percentage > 0) {
    this.completedOAs += 1;
  }

  // Update average score
  const totalScore = this.avgScore * (this.totalOAs - 1) + report.score.percentage;
  this.avgScore = totalScore / this.totalOAs;

  // Update best score
  if (report.score.percentage > this.bestScore) {
    this.bestScore = report.score.percentage;
  }

  // Update time spent
  this.totalTimeSpent += report.totalTimeSeconds || 0;

  // Add to recent sessions (keep last 20)
  this.recentSessions.unshift({
    sessionId: report.sessionId,
    score: report.score.earned,
    maxScore: report.score.total,
    completedAt: report.submittedAt,
    practiceLevel: report.insights?.practiceLevel,
  });
  if (this.recentSessions.length > 20) {
    this.recentSessions = this.recentSessions.slice(0, 20);
  }

  // Update streak
  const today = new Date().toDateString();
  const lastOADate = this.streak.lastOADate
    ? this.streak.lastOADate.toDateString()
    : null;
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (lastOADate === yesterday) {
    this.streak.current += 1;
  } else if (lastOADate !== today) {
    this.streak.current = 1;
  }
  this.streak.lastOADate = new Date();
  if (this.streak.current > this.streak.longest) {
    this.streak.longest = this.streak.current;
  }

  return this.save();
};

export default mongoose.model("UserOAHistory", userOAHistorySchema);
