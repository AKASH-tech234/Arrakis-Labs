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

    isPublic: { type: Boolean, default: false },

    // Used for /u/:username
    publicUsername: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_-]{3,30}$/, "Invalid public username"],
    },

    showPlatforms: { type: Boolean, default: true },
    showDifficulty: { type: Boolean, default: true },
    showSkills: { type: Boolean, default: true },
    showTrends: { type: Boolean, default: true },

    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("PublicProfileSettings", publicProfileSettingsSchema);
