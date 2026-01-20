import mongoose from "mongoose";

const platformProfileSchema = new mongoose.Schema(
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
        "leetcode",
        "codeforces",
        "codechef",
        "atcoder",
        "hackerrank",
        "custom",
      ],
      index: true,
    },
    profileUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    handle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: ["pending", "syncing", "success", "error"],
      default: "pending",
    },
    lastSyncError: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    enabledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

platformProfileSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default mongoose.model("PlatformProfile", platformProfileSchema);
