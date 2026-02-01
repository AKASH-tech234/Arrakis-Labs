import mongoose from "mongoose";

const oaAnswerSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OASession",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    questionIndex: {
      type: Number,
      required: true,
    },

    answer: {
      code: { type: String, default: "" },
      language: {
        type: String,
        default: "python",
        enum: ["python", "cpp", "java", "javascript", "c", "go", "rust"],
      },
    },

    submission: {
      isSubmitted: { type: Boolean, default: false },
      submittedAt: { type: Date, default: null },
      passedCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 },
      verdict: {
        type: String,
        enum: [
          "pending",
          "accepted",
          "partial",
          "wrong_answer",
          "time_limit_exceeded",
          "memory_limit_exceeded",
          "runtime_error",
          "compile_error",
          null,
        ],
        default: null,
      },
      executionTime: { type: Number, default: 0 },
      memoryUsed: { type: Number, default: 0 },
      testResults: [
        {
          passed: Boolean,
          executionTime: Number,
          error: String,
        },
      ],
    },

    firstSeenAt: {
      type: Date,
      default: null,
    },
    lastFocusedAt: {
      type: Date,
      default: null,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },

    clientUpdatedAt: {
      type: Date,
      default: null,
    },
    serverUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    saveCount: {
      type: Number,
      default: 0,
    },

    pointsEarned: {
      type: Number,
      default: 0,
    },
    maxPoints: {
      type: Number,
      default: 100,
    },
  },
  { timestamps: true }
);

oaAnswerSchema.index({ sessionId: 1, refId: 1 }, { unique: true });
oaAnswerSchema.index({ sessionId: 1, serverUpdatedAt: -1 });
oaAnswerSchema.index({ sessionId: 1, questionIndex: 1 });

oaAnswerSchema.methods.calculateScore = function () {
  if (!this.submission.isSubmitted || this.submission.totalCount === 0) {
    return 0;
  }
  const percentage = this.submission.passedCount / this.submission.totalCount;
  return Math.round(this.maxPoints * percentage);
};

oaAnswerSchema.methods.updateTimeSpent = function (additionalSeconds) {
  this.timeSpentSeconds += additionalSeconds;
  this.lastFocusedAt = new Date();
  return this;
};

oaAnswerSchema.methods.markFirstSeen = function () {
  if (!this.firstSeenAt) {
    this.firstSeenAt = new Date();
  }
  return this;
};

export default mongoose.model("OAAnswer", oaAnswerSchema);
