import mongoose from "mongoose";

/**
 * User POTD Tracking Schema
 * Tracks individual user's POTD attempts and completions
 */
const userPOTDTrackingSchema = new mongoose.Schema(
  {
    // Reference to the user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    // Reference to the published POTD
    potdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublishedPOTD",
      required: [true, "POTD ID is required"],
    },
    // Reference to the problem
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Problem ID is required"],
    },
    // The date of the POTD (for easy querying)
    potdDate: {
      type: Date,
      required: true,
      index: true,
    },
    // Whether the user solved this POTD
    solved: {
      type: Boolean,
      default: false,
    },
    // Time when the user first solved it
    solvedAt: {
      type: Date,
      default: null,
    },
    // Number of attempts made
    attempts: {
      type: Number,
      default: 0,
    },
    // Time spent (in seconds)
    timeSpent: {
      type: Number,
      default: 0,
    },
    // First attempt timestamp
    firstAttemptAt: {
      type: Date,
      default: null,
    },
    // Last attempt timestamp
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    // Best submission ID (if solved)
    bestSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      default: null,
    },
    // Language used in best submission
    language: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + date queries (most common query pattern)
userPOTDTrackingSchema.index({ userId: 1, potdDate: -1 });
userPOTDTrackingSchema.index({ userId: 1, potdId: 1 }, { unique: true });
userPOTDTrackingSchema.index({ userId: 1, solved: 1, potdDate: -1 });

// Static method to get user's POTD history for calendar
userPOTDTrackingSchema.statics.getUserCalendar = async function (
  userId,
  startDate,
  endDate
) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  return this.find({
    userId,
    potdDate: { $gte: start, $lte: end },
  })
    .populate("problemId", "title difficulty")
    .sort({ potdDate: -1 });
};

// Static method to check if user solved today's POTD
userPOTDTrackingSchema.statics.hasSolvedToday = async function (userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const tracking = await this.findOne({
    userId,
    potdDate: today,
    solved: true,
  });

  return !!tracking;
};

// Static method to get or create tracking entry
userPOTDTrackingSchema.statics.getOrCreate = async function (
  userId,
  potdId,
  problemId,
  potdDate
) {
  let tracking = await this.findOne({ userId, potdId });

  if (!tracking) {
    tracking = await this.create({
      userId,
      potdId,
      problemId,
      potdDate,
    });
  }

  return tracking;
};

export default mongoose.model("UserPOTDTracking", userPOTDTrackingSchema);
