import mongoose from "mongoose";

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

    difficultyDistribution: {
      coding: {
        easy: { type: Number, default: 20 },
        medium: { type: Number, default: 50 },
        hard: { type: Number, default: 30 },
      },
    },

    topicWeights: {
      type: Map,
      of: Number,
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

    settings: {
      partialScoringCoding: { type: Boolean, default: true },
      allowLanguages: {
        type: [String],
        default: ["cpp", "java", "python", "javascript"],
      },
      tabSwitchWarnings: { type: Number, default: 3 },
    },

    stats: {
      totalAttempts: { type: Number, default: 0 },
      avgScore: { type: Number, default: 0 },
      avgCompletionTime: { type: Number, default: 0 },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companyOAPatternSchema.index({ companySlug: 1, isActive: 1 });

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
