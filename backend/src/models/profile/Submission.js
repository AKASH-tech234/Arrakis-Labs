import mongoose from "mongoose";

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
      type: Number, 
      default: 0,
    },
    memoryUsed: {
      type: Number, 
      default: 0,
    },
    
    actualOutput: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { _id: false },
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
    
    passedCount: {
      type: Number,
      default: 0,
    },
    totalCount: {
      type: Number,
      default: 0,
    },
    
    testResults: {
      type: [testResultSchema],
      default: [],
    },
    
    totalExecutionTime: {
      type: Number,
      default: 0,
    },
    maxMemoryUsed: {
      type: Number,
      default: 0,
    },
    
    compileError: {
      type: String,
      default: null,
    },
    
    isRun: {
      type: Boolean,
      default: false, 
    },
    // AI tracking fields
    timeSpent: {
      type: Number, // seconds spent on problem before submission
      default: null,
    },
    hintsUsed: {
      type: Number,
      default: 0,
    },
    attemptNumber: {
      type: Number,
      default: 1, // Which attempt this is for user+problem
    },
    aiFeedbackReceived: {
      type: Boolean,
      default: false,
    },
    // Denormalized problem fields (immutable historical data)
    problemCategory: {
      type: String,
      default: null,
    },
    problemDifficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", null],
      default: null,
    },
    problemTags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

submissionSchema.index({ userId: 1, questionId: 1, createdAt: -1 });
submissionSchema.index({ questionId: 1, status: 1 });
submissionSchema.index({ createdAt: -1 });

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
    
  };
};

export default mongoose.model("Submission", submissionSchema);
