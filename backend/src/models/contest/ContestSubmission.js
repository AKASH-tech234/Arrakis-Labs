import mongoose from "mongoose";

/**
 * Contest Submission Schema
 * Tracks submissions made during contests with enhanced security
 * Extends base submission with contest-specific fields
 */
const contestSubmissionSchema = new mongoose.Schema(
  {
    // Core references
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestRegistration",
      required: true,
    },

    // Problem label in contest (A, B, C...)
    problemLabel: {
      type: String,
      required: true,
    },

    // Code submitted (encrypted at rest in production)
    code: {
      type: String,
      required: [true, "Code is required"],
      maxlength: [65536, "Code cannot exceed 64KB"],
    },
    language: {
      type: String,
      required: [true, "Language is required"],
      enum: ["python", "javascript", "java", "cpp", "c", "typescript", "go", "rust"],
    },
    
    // Submission timing
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Time from user's effective start (seconds)
    timeFromStart: {
      type: Number,
      required: true,
    },

    // Verdict
    verdict: {
      type: String,
      enum: [
        "pending",
        "judging",
        "accepted",
        "wrong_answer",
        "time_limit_exceeded",
        "memory_limit_exceeded",
        "runtime_error",
        "compile_error",
        "internal_error",
      ],
      default: "pending",
      index: true,
    },

    // Test results (detailed for admin, summary for user)
    testsPassed: {
      type: Number,
      default: 0,
    },
    testsTotal: {
      type: Number,
      default: 0,
    },
    // For partial scoring
    score: {
      type: Number,
      default: 0,
    },
    maxScore: {
      type: Number,
      default: 100,
    },

    // Execution metrics
    executionTime: {
      type: Number, // Max execution time in ms
      default: 0,
    },
    memoryUsed: {
      type: Number, // Max memory in KB
      default: 0,
    },

    // Error information (sanitized - no test case data)
    errorType: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    // First failed test number (1-indexed, no details)
    firstFailedTest: {
      type: Number,
      default: null,
    },

    // Detailed test results (NEVER sent to frontend during contest)
    testResults: [
      {
        testIndex: Number,
        passed: Boolean,
        executionTime: Number,
        memoryUsed: Number,
        // NO input/output stored here - reference test case if needed
      },
    ],

    // Anti-cheat flags
    flags: {
      possiblePlagiarism: { type: Boolean, default: false },
      similarSubmissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "ContestSubmission" }],
      similarityScore: { type: Number, default: 0 },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      reviewNotes: { type: String, default: "" },
    },

    // IP and fingerprint for security
    clientIP: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
contestSubmissionSchema.index({ contest: 1, user: 1, problem: 1, submittedAt: -1 });
contestSubmissionSchema.index({ contest: 1, problem: 1, verdict: 1 });
contestSubmissionSchema.index({ contest: 1, verdict: 1, submittedAt: 1 });
contestSubmissionSchema.index({ user: 1, contest: 1, submittedAt: -1 });

// Virtual: Is this an accepted submission?
contestSubmissionSchema.virtual("isAccepted").get(function () {
  return this.verdict === "accepted";
});

// Method: Safe response for user (no hidden test data)
contestSubmissionSchema.methods.toUserResponse = function (isContestActive = true) {
  const response = {
    id: this._id,
    problemLabel: this.problemLabel,
    language: this.language,
    verdict: this.verdict,
    submittedAt: this.submittedAt,
    timeFromStart: this.timeFromStart,
    executionTime: this.executionTime,
    memoryUsed: this.memoryUsed,
  };

  // During contest: minimal info
  if (isContestActive) {
    if (this.verdict === "accepted") {
      response.testsPassed = this.testsTotal;
      response.testsTotal = this.testsTotal;
    } else if (this.verdict !== "pending" && this.verdict !== "judging") {
      // Show which test failed (number only)
      response.firstFailedTest = this.firstFailedTest;
      response.testsPassed = this.testsPassed;
      response.testsTotal = this.testsTotal;
    }
    if (this.verdict === "compile_error") {
      response.errorMessage = this.errorMessage;
    }
  } else {
    // After contest: can show more details
    response.testsPassed = this.testsPassed;
    response.testsTotal = this.testsTotal;
    response.code = this.code;
    response.errorMessage = this.errorMessage;
  }

  return response;
};

// Static: Get user's submissions for a contest problem
contestSubmissionSchema.statics.getUserSubmissionsForProblem = function (
  contestId,
  userId,
  problemId,
  limit = 20
) {
  return this.find({
    contest: contestId,
    user: userId,
    problem: problemId,
  })
    .sort({ submittedAt: -1 })
    .limit(limit)
    .select("-testResults -code -clientIP -userAgent -flags");
};

// Static: Get all submissions for a contest (admin)
contestSubmissionSchema.statics.getContestSubmissions = function (
  contestId,
  options = {}
) {
  const { verdict, problemId, userId, limit = 100, skip = 0 } = options;

  const query = { contest: contestId };
  if (verdict) query.verdict = verdict;
  if (problemId) query.problem = problemId;
  if (userId) query.user = userId;

  return this.find(query)
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "name email")
    .populate("problem", "title")
    .select("-testResults");
};

// Static: Count submissions per verdict for contest
contestSubmissionSchema.statics.getVerdictStats = async function (contestId) {
  return this.aggregate([
    { $match: { contest: new mongoose.Types.ObjectId(contestId) } },
    {
      $group: {
        _id: "$verdict",
        count: { $sum: 1 },
      },
    },
  ]);
};

export default mongoose.model("ContestSubmission", contestSubmissionSchema);
