import mongoose from "mongoose";

const userOAHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    attemptedCoding: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        lastAttemptedAt: Date,
        bestPassRate: { type: Number, default: 0 },
        attemptCount: { type: Number, default: 1 },
        bestVerdict: String,
      },
    ],

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

    totalOAs: { type: Number, default: 0 },
    completedOAs: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 },
    totalQuestionsAttempted: { type: Number, default: 0 },
    totalQuestionsSolved: { type: Number, default: 0 },

    recentSessions: [
      {
        sessionId: mongoose.Schema.Types.ObjectId,
        score: Number,
        maxScore: Number,
        completedAt: Date,
        practiceLevel: String,
      },
    ],

    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastOADate: Date,
    },
  },
  { timestamps: true }
);

userOAHistorySchema.index({ userId: 1 });

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

userOAHistorySchema.methods.wasQuestionAttempted = function (questionId) {
  return this.attemptedCoding.some(
    (q) => q.questionId.toString() === questionId.toString()
  );
};

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

userOAHistorySchema.methods.updateAfterOA = async function (report) {

  this.totalOAs += 1;
  if (report.score.percentage > 0) {
    this.completedOAs += 1;
  }

  const totalScore = this.avgScore * (this.totalOAs - 1) + report.score.percentage;
  this.avgScore = totalScore / this.totalOAs;

  if (report.score.percentage > this.bestScore) {
    this.bestScore = report.score.percentage;
  }

  this.totalTimeSpent += report.totalTimeSeconds || 0;

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
