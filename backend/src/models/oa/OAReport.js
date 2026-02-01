import mongoose from "mongoose";

const oaReportSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OASession",
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    startedAt: Date,
    submittedAt: Date,
    totalTimeSeconds: Number,

    score: {
      earned: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
    },

    codingPerformance: {
      attempted: { type: Number, default: 0 },
      fullySolved: { type: Number, default: 0 },
      partiallySolved: { type: Number, default: 0 },
      notSolved: { type: Number, default: 0 },
      totalQuestions: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 0 },
      avgTestCasePass: { type: Number, default: 0 },
    },

    companyWise: [
      {
        company: String,
        questionsAttempted: Number,
        questionsTotal: Number,
        score: Number,
        maxScore: Number,
        accuracy: Number,
      },
    ],

    topicWise: [
      {
        topic: String,
        attempted: Number,
        fullySolved: Number,
        partiallySolved: Number,
        accuracy: Number,
        avgTimeSeconds: Number,
        avgTestCasePass: Number,
        status: {
          type: String,
          enum: ["strong", "moderate", "weak"],
        },
      },
    ],

    difficultyWise: {
      easy: {
        attempted: { type: Number, default: 0 },
        fullySolved: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        avgTestCasePass: { type: Number, default: 0 },
      },
      medium: {
        attempted: { type: Number, default: 0 },
        fullySolved: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        avgTestCasePass: { type: Number, default: 0 },
      },
      hard: {
        attempted: { type: Number, default: 0 },
        fullySolved: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        avgTestCasePass: { type: Number, default: 0 },
      },
    },

    timeAnalysis: {
      avgTimePerQuestion: Number,
      fastestQuestion: {
        refId: mongoose.Schema.Types.ObjectId,
        title: String,
        seconds: Number,
      },
      slowestQuestion: {
        refId: mongoose.Schema.Types.ObjectId,
        title: String,
        seconds: Number,
      },
      perQuestion: [
        {
          refId: mongoose.Schema.Types.ObjectId,
          title: String,
          topic: String,
          difficulty: String,
          seconds: Number,
          passRate: Number,
          verdict: String,
        },
      ],
    },

    integrity: {
      tabSwitches: { type: Number, default: 0 },
      warningsUsed: { type: Number, default: 0 },
      warningsAllowed: { type: Number, default: 3 },
      wasTerminated: { type: Boolean, default: false },
      terminatedReason: String,
      status: {
        type: String,
        enum: ["clean", "warnings_used", "violated"],
        default: "clean",
      },
    },

    insights: {
      practiceLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Advanced", "OA-Ready"],
        default: "Beginner",
      },
      weakTopics: [String],
      strongTopics: [String],
      recommendations: [
        {
          type: {
            type: String,
            enum: ["topic", "difficulty", "speed", "accuracy", "participation", "fundamentals", "focus"],
          },
          message: String,
          actionable: String,
        },
      ],
      recommendedProblems: [
        {
          problemId: mongoose.Schema.Types.ObjectId,
          title: String,
          topic: String,
          difficulty: String,
          reason: String,
        },
      ],
      comparisonToAvg: {
        score: String,
        percentile: Number,
      },
    },

    rawAnswers: [
      {
        refId: mongoose.Schema.Types.ObjectId,
        title: String,
        topic: String,
        difficulty: String,
        code: String,
        language: String,
        passedCount: Number,
        totalCount: Number,
        verdict: String,
        pointsEarned: Number,
        maxPoints: Number,
        timeSpent: Number,
      },
    ],
  },
  { timestamps: true }
);

oaReportSchema.index({ userId: 1, createdAt: -1 });
oaReportSchema.index({ userId: 1, "score.percentage": -1 });
oaReportSchema.index({ "insights.practiceLevel": 1 });

oaReportSchema.statics.calculatePracticeLevel = function (scorePercentage, difficultyPerf) {
  const hardAccuracy = difficultyPerf?.hard?.accuracy || 0;
  const mediumAccuracy = difficultyPerf?.medium?.accuracy || 0;

  if (scorePercentage >= 80 && hardAccuracy >= 0.5) {
    return "OA-Ready";
  } else if (scorePercentage >= 60 && mediumAccuracy >= 0.6) {
    return "Advanced";
  } else if (scorePercentage >= 40) {
    return "Intermediate";
  }
  return "Beginner";
};

export default mongoose.model("OAReport", oaReportSchema);
