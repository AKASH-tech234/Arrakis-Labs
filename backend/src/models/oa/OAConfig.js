import mongoose from "mongoose";

const oaConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    companyMode: {
      type: String,
      enum: ["all", "selected", "quick_fight"],
      default: "all",
    },
    selectedCompanies: {
      type: [String],
      default: [],
    },

    selectedTopics: {
      type: [String],
      default: [],
      enum: [
        "",
        "Array",
        "String",
        "LinkedList",
        "Stack",
        "Queue",
        "Tree",
        "Graph",
        "DynamicProgramming",
        "Greedy",
        "Backtracking",
        "BinarySearch",
        "Sorting",
        "Hashing",
        "Heap",
        "Trie",
        "BitManipulation",
        "TwoPointers",
        "SlidingWindow",
        "Recursion",
        "Math",
      ],
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "adaptive", "mixed"],
      default: "mixed",
    },

    questionCounts: {
      coding: { type: Number, default: 2, min: 1, max: 5 },
    },

    timingMode: {
      type: String,
      enum: ["fixed", "company_specific"],
      default: "fixed",
    },
    fixedDurationMinutes: {
      type: Number,
      default: 90,
      min: 15,
      max: 180,
    },

    preferredLanguages: {
      type: [String],
      default: ["python", "cpp", "java"],
      enum: ["python", "cpp", "java", "javascript", "c", "go", "rust"],
    },

    startMode: {
      type: String,
      enum: ["now", "scheduled"],
      default: "now",
    },
    scheduledStartAt: {
      type: Date,
      default: null,
    },

    proctoring: {
      enableTabSwitchDetection: { type: Boolean, default: true },
      warningsAllowed: { type: Number, default: 3, min: 1, max: 10 },
      actionOnExceed: {
        type: String,
        enum: ["auto_submit", "terminate"],
        default: "auto_submit",
      },
      enableFullscreen: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

oaConfigSchema.index({ userId: 1, createdAt: -1 });

oaConfigSchema.virtual("effectiveDuration").get(function () {
  return this.fixedDurationMinutes;
});

export default mongoose.model("OAConfig", oaConfigSchema);
