import mongoose from "mongoose";

/**
 * Submission Schema
 * Tracks user code submissions and results
 */
const testResultSchema = new mongoose.Schema(
  {
    testCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestCase",
    },
    passed: {
      type: Boolean,
      required: true,
    },
    executionTime: {
      type: Number, // milliseconds
      default: 0,
    },
    memoryUsed: {
      type: Number, // KB
      default: 0,
    },
    // Only store for visible test cases or debugging
    actualOutput: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Question ID is required"],
      index: true,
    },
    // Code submitted
    code: {
      type: String,
      required: [true, "Code is required"],
      maxlength: [65536, "Code cannot exceed 64KB"],
    },
    language: {
      type: String,
      required: [true, "Language is required"],
      enum: ["python", "javascript", "java", "cpp"],
    },
    // Overall result
    status: {
      type: String,
      enum: [
        "pending",
        "running",
        "accepted",
        "wrong_answer",
        "time_limit_exceeded",
        "memory_limit_exceeded",
        "runtime_error",
        "compile_error",
        "internal_error",
      ],
      default: "pending",
    },
    // Test results summary
    passedCount: {
      type: Number,
      default: 0,
    },
    totalCount: {
      type: Number,
      default: 0,
    },
    // Detailed results (visible tests only in response)
    testResults: {
      type: [testResultSchema],
      default: [],
    },
    // Execution metrics
    totalExecutionTime: {
      type: Number,
      default: 0,
    },
    maxMemoryUsed: {
      type: Number,
      default: 0,
    },
    // For compilation errors
    compileError: {
      type: String,
      default: null,
    },
    // Submission type
    isRun: {
      type: Boolean,
      default: false, // false = submit, true = run (examples only)
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
submissionSchema.index({ userId: 1, questionId: 1, createdAt: -1 });
submissionSchema.index({ questionId: 1, status: 1 });
submissionSchema.index({ createdAt: -1 });

// SECURITY: Safe response for users (no hidden test case details)
submissionSchema.methods.toUserResponse = function () {
  return {
    id: this._id,
    questionId: this.questionId,
    language: this.language,
    status: this.status,
    passed: this.passedCount,
    total: this.totalCount,
    executionTime: this.totalExecutionTime,
    memoryUsed: this.maxMemoryUsed,
    compileError: this.compileError,
    createdAt: this.createdAt,
    // DO NOT include code or detailed test results for hidden cases
  };
};

export default mongoose.model("Submission", submissionSchema);
