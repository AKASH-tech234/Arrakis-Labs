import mongoose from "mongoose";

const difficultySchema = new mongoose.Schema(
  {
    solved: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
  },
  { _id: false }
);

const aggregatedStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    totalSolved: { type: Number, default: 0 },
    totalAttempted: { type: Number, default: 0 },
    avgSolvedPerDay: { type: Number, default: 0 },
    totalContests: { type: Number, default: 0 },

    weightedAvgRating: { type: Number, default: null },
    bestPlatform: { type: String, default: null },

    consistencyScore: { type: Number, default: 0 }, // 0-100

    difficulty: {
      easy: { type: difficultySchema, default: () => ({}) },
      medium: { type: difficultySchema, default: () => ({}) },
      hard: { type: difficultySchema, default: () => ({}) },
    },

    // skill -> { solved, accuracy, strengthLevel }
    skills: {
      type: Map,
      of: new mongoose.Schema(
        {
          solved: { type: Number, default: 0 },
          accuracy: { type: Number, default: 0 },
          strengthLevel: {
            type: String,
            enum: ["Beginner", "Intermediate", "Strong"],
            default: "Beginner",
          },
          weak: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: () => new Map(),
    },

    weeklyTrend: {
      type: [
        new mongoose.Schema(
          {
            weekStart: { type: String, required: true }, // YYYY-MM-DD
            solved: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    monthlyTrend: {
      type: [
        new mongoose.Schema(
          {
            month: { type: String, required: true }, // YYYY-MM
            solved: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    computedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("AggregatedStats", aggregatedStatsSchema);
