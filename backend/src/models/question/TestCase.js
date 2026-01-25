import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Question ID is required"],
      index: true,
    },
    
    stdin: {
      type: String,
      default: "",
      
      trim: false,
    },
    
    expectedStdout: {
      type: String,
      default: "",
      
      trim: false,
    },
    
    isHidden: {
      type: Boolean,
      default: true, 
    },
    
    label: {
      type: String,
      default: "",
      maxlength: [100, "Label cannot exceed 100 characters"],
    },
    
    timeLimit: {
      type: Number,
      default: 2000, 
      min: [100, "Time limit must be at least 100ms"],
      max: [30000, "Time limit cannot exceed 30 seconds"],
    },
    memoryLimit: {
      type: Number,
      default: 256, 
      min: [16, "Memory limit must be at least 16MB"],
      max: [512, "Memory limit cannot exceed 512MB"],
    },
    
    order: {
      type: Number,
      default: 0,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

testCaseSchema.index({ questionId: 1, isHidden: 1, isActive: 1 });
testCaseSchema.index({ questionId: 1, order: 1 });

testCaseSchema.statics.getVisibleForQuestion = function (questionId) {
  return this.find({
    questionId,
    isHidden: false,
    isActive: true,
  }).sort({ order: 1 });
};

testCaseSchema.statics.getAllForQuestion = function (questionId) {
  return this.find({
    questionId,
    isActive: true,
  }).sort({ order: 1 });
};

testCaseSchema.methods.toSafeJSON = function () {
  if (this.isHidden) {
    return {
      id: this._id,
      isHidden: true,
      label: this.label || "Hidden Test Case",
      timeLimit: this.timeLimit,
      memoryLimit: this.memoryLimit,
      
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
