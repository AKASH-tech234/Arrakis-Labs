import mongoose from "mongoose";

const publicProfileSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Master public/private toggle
    isPublic: { type: Boolean, default: false },

    // Public URL slug: /u/{publicUsername}
    publicUsername: {
      type: String,
      default: null,
      trim: true,
      maxlength: 30,
      index: true,
    },

    // Feature visibility toggles (UI can reuse existing sections)
    showPlatforms: { type: Boolean, default: true },
    showDifficulty: { type: Boolean, default: true },
    showSkills: { type: Boolean, default: true },
    showTrends: { type: Boolean, default: true },
  },
  { timestamps: true }
);

publicProfileSettingsSchema.index(
  { publicUsername: 1 },
  {
    unique: true,
    partialFilterExpression: { publicUsername: { $type: "string" } },
  }
);

export default mongoose.model("PublicProfileSettings", publicProfileSettingsSchema);
