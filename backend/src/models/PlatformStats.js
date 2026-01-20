import mongoose from "mongoose";

const difficultySchema = new mongoose.Schema(
  {
    solved: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
  },
  { _id: false }
);

const platformStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: [
        "arrakis",
        "leetcode",
        "codeforces",
        "codechef",
        "atcoder",
        "hackerrank",
        "custom",
      ],
      index: true,
    },

    totalSolved: { type: Number, default: 0 },
    totalAttempted: { type: Number, default: 0 },
    last30DaysSolved: { type: Number, default: 0 },
    avgSolvedPerDay: { type: Number, default: 0 },

    contestsParticipated: { type: Number, default: 0 },

    currentRating: { type: Number, default: null },
    highestRating: { type: Number, default: null },

    difficulty: {
      easy: { type: difficultySchema, default: () => ({}) },
      medium: { type: difficultySchema, default: () => ({}) },
      hard: { type: difficultySchema, default: () => ({}) },
    },

    // skill -> { solved, attempted, accuracy, strengthLevel }
    skills: {
      type: Map,
      of: new mongoose.Schema(
        {
          solved: { type: Number, default: 0 },
          attempted: { type: Number, default: 0 },
          accuracy: { type: Number, default: 0 },
          strengthLevel: {
            type: String,
            enum: ["Beginner", "Intermediate", "Strong"],
            default: "Beginner",
          },
        },
        { _id: false }
      ),
      default: () => new Map(),
    },

    // For trend charts
    daily: {
      type: [
        new mongoose.Schema(
          {
            date: { type: String, required: true }, // YYYY-MM-DD
            solved: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    dataSource: {
      type: String,
      enum: ["internal", "api", "scrape", "manual"],
      default: "internal",
    },

    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

platformStatsSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default mongoose.model("PlatformStats", platformStatsSchema);
