import mongoose from "mongoose";

/**
 * TestCase Schema
 * Stores test cases in Piston-compatible format (stdin/stdout)
 * Hidden test cases are NEVER exposed to users
 */
const testCaseSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Question ID is required"],
      index: true,
    },
    // Piston-compatible stdin format
    stdin: {
      type: String,
      required: [true, "Test input (stdin) is required"],
      trim: true,
    },
    // Expected stdout (trimmed for comparison)
    expectedStdout: {
      type: String,
      required: [true, "Expected output is required"],
      trim: true,
    },
    // CRITICAL: Hidden test cases are never shown to users
    isHidden: {
      type: Boolean,
      default: true, // Default to hidden for security
    },
    // Optional label for admin reference
    label: {
      type: String,
      default: "",
      maxlength: [100, "Label cannot exceed 100 characters"],
    },
    // Execution constraints
    timeLimit: {
      type: Number,
      default: 2000, // milliseconds
      min: [100, "Time limit must be at least 100ms"],
      max: [30000, "Time limit cannot exceed 30 seconds"],
    },
    memoryLimit: {
      type: Number,
      default: 256, // MB
      min: [16, "Memory limit must be at least 16MB"],
      max: [512, "Memory limit cannot exceed 512MB"],
    },
    // Ordering
    order: {
      type: Number,
      default: 0,
    },
    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
testCaseSchema.index({ questionId: 1, isHidden: 1, isActive: 1 });
testCaseSchema.index({ questionId: 1, order: 1 });

// Static method to get visible test cases only
testCaseSchema.statics.getVisibleForQuestion = function (questionId) {
  return this.find({
    questionId,
    isHidden: false,
    isActive: true,
  }).sort({ order: 1 });
};

// Static method to get all active test cases (for submission judging)
testCaseSchema.statics.getAllForQuestion = function (questionId) {
  return this.find({
    questionId,
    isActive: true,
  }).sort({ order: 1 });
};

// SECURITY: Never expose hidden test case details
testCaseSchema.methods.toSafeJSON = function () {
  if (this.isHidden) {
    return {
      id: this._id,
      isHidden: true,
      label: this.label || "Hidden Test Case",
      timeLimit: this.timeLimit,
      memoryLimit: this.memoryLimit,
      // DO NOT include stdin or expectedStdout
    };
  }

  return {
    id: this._id,
    stdin: this.stdin,
    expectedStdout: this.expectedStdout,
    isHidden: false,
    label: this.label,
    timeLimit: this.timeLimit,
    memoryLimit: this.memoryLimit,
  };
};

export default mongoose.model("TestCase", testCaseSchema);
