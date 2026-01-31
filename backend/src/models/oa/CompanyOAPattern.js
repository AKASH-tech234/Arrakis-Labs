import mongoose from "mongoose";

/**
 * Company OA Pattern Schema
 * Stores company-specific OA configurations and patterns
 */
const companyOAPatternSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    companySlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    logo: {
      type: String,
      default: null,
    },

    // === OA STRUCTURE ===
    oaStructure: {
      totalDurationMinutes: { type: Number, default: 90 },
      sections: [
        {
          type: { type: String, enum: ["coding"], required: true },
          count: { type: Number, required: true },
          durationMinutes: { type: Number, required: true },
          allowSectionSwitch: { type: Boolean, default: true },
        },
      ],
    },

    // === DIFFICULTY DISTRIBUTION ===
    difficultyDistribution: {
      coding: {
        easy: { type: Number, default: 20 }, // percentage
        medium: { type: Number, default: 50 },
        hard: { type: Number, default: 30 },
      },
    },

    // === TOPIC WEIGHTS (frequency of topics in OAs) ===
    topicWeights: {
      type: Map,
      of: Number, // topic -> weight (1-10)
      default: new Map([
        ["Array", 8],
        ["String", 7],
        ["DynamicProgramming", 6],
        ["Tree", 5],
        ["Graph", 5],
        ["BinarySearch", 6],
        ["TwoPointers", 5],
        ["Sorting", 4],
        ["Greedy", 4],
        ["Backtracking", 3],
      ]),
    },

    // === OA SETTINGS ===
    settings: {
      partialScoringCoding: { type: Boolean, default: true },
      allowLanguages: {
        type: [String],
        default: ["cpp", "java", "python", "javascript"],
      },
      tabSwitchWarnings: { type: Number, default: 3 },
    },

    // === STATS ===
    stats: {
      totalAttempts: { type: Number, default: 0 },
      avgScore: { type: Number, default: 0 },
      avgCompletionTime: { type: Number, default: 0 },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
companyOAPatternSchema.index({ companySlug: 1, isActive: 1 });

// Static method to get or create default companies
companyOAPatternSchema.statics.seedDefaults = async function () {
  const defaults = [
    {
      companyName: "Google",
      companySlug: "google",
      oaStructure: {
        totalDurationMinutes: 90,
        sections: [{ type: "coding", count: 2, durationMinutes: 90 }],
      },
    },
    {
      companyName: "Amazon",
      companySlug: "amazon",
      oaStructure: {
        totalDurationMinutes: 120,
        sections: [{ type: "coding", count: 2, durationMinutes: 120 }],
      },
    },
    {
      companyName: "Microsoft",
      companySlug: "microsoft",
      oaStructure: {
        totalDurationMinutes: 90,
        sections: [{ type: "coding", count: 3, durationMinutes: 90 }],
      },
    },
    {
      companyName: "Meta",
      companySlug: "meta",
      oaStructure: {
        totalDurationMinutes: 60,
        sections: [{ type: "coding", count: 2, durationMinutes: 60 }],
      },
    },
    {
      companyName: "Apple",
      companySlug: "apple",
      oaStructure: {
        totalDurationMinutes: 90,
        sections: [{ type: "coding", count: 2, durationMinutes: 90 }],
      },
    },
  ];

  for (const company of defaults) {
    await this.findOneAndUpdate(
      { companySlug: company.companySlug },
      { $setOnInsert: company },
      { upsert: true, new: true }
    );
  }
};

export default mongoose.model("CompanyOAPattern", companyOAPatternSchema);
