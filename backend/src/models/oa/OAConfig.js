import mongoose from "mongoose";

/**
 * OA Configuration Schema
 * Stores user's OA preferences before session creation
 */
const oaConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // === COMPANY SELECTION ===
    companyMode: {
      type: String,
      enum: ["all", "selected", "quick_fight"],
      default: "all",
    },
    selectedCompanies: {
      type: [String],
      default: [],
    },

    // === TOPIC SELECTION ===
    selectedTopics: {
      type: [String],
      default: [], // Empty = all topics
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

    // === DIFFICULTY ===
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "adaptive", "mixed"],
      default: "mixed",
    },

    // === QUESTION COUNTS ===
    questionCounts: {
      coding: { type: Number, default: 2, min: 1, max: 5 },
    },

    // === TIMING ===
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

    // === PREFERENCES ===
    preferredLanguages: {
      type: [String],
      default: ["python", "cpp", "java"],
      enum: ["python", "cpp", "java", "javascript", "c", "go", "rust"],
    },

    // === SCHEDULING ===
    startMode: {
      type: String,
      enum: ["now", "scheduled"],
      default: "now",
    },
    scheduledStartAt: {
      type: Date,
      default: null,
    },

    // === PROCTORING ===
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

// Indexes
oaConfigSchema.index({ userId: 1, createdAt: -1 });

// Virtual for duration based on mode
oaConfigSchema.virtual("effectiveDuration").get(function () {
  return this.fixedDurationMinutes;
});

export default mongoose.model("OAConfig", oaConfigSchema);
