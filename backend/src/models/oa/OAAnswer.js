import mongoose from "mongoose";

/**
 * OA Answer Schema
 * Stores user's answers with autosave support and time tracking
 */
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

    // === QUESTION REFERENCE ===
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    questionIndex: {
      type: Number,
      required: true,
    },

    // === ANSWER DATA (Coding) ===
    answer: {
      code: { type: String, default: "" },
      language: {
        type: String,
        default: "python",
        enum: ["python", "cpp", "java", "javascript", "c", "go", "rust"],
      },
    },

    // === SUBMISSION STATE ===
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

    // === TIME TRACKING ===
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

    // === AUTOSAVE META ===
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

    // === SCORING ===
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

// Unique constraint: one answer per question per session
oaAnswerSchema.index({ sessionId: 1, refId: 1 }, { unique: true });
oaAnswerSchema.index({ sessionId: 1, serverUpdatedAt: -1 });
oaAnswerSchema.index({ sessionId: 1, questionIndex: 1 });

// Calculate score based on test case results
oaAnswerSchema.methods.calculateScore = function () {
  if (!this.submission.isSubmitted || this.submission.totalCount === 0) {
    return 0;
  }
  const percentage = this.submission.passedCount / this.submission.totalCount;
  return Math.round(this.maxPoints * percentage);
};

// Update time tracking
oaAnswerSchema.methods.updateTimeSpent = function (additionalSeconds) {
  this.timeSpentSeconds += additionalSeconds;
  this.lastFocusedAt = new Date();
  return this;
};

// Mark as first seen
oaAnswerSchema.methods.markFirstSeen = function () {
  if (!this.firstSeenAt) {
    this.firstSeenAt = new Date();
  }
  return this;
};

export default mongoose.model("OAAnswer", oaAnswerSchema);
