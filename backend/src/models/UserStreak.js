import mongoose from "mongoose";

/**
 * User Streak Schema
 * Dedicated collection for tracking user POTD streaks
 * Separated for performance and easier streak calculations
 */
const userStreakSchema = new mongoose.Schema(
  {
    // Reference to the user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
      index: true,
    },
    // Current active streak count
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Maximum streak ever achieved
    maxStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Last date the user solved a POTD (for streak calculation)
    lastSolvedDate: {
      type: Date,
      default: null,
    },
    // Date when current streak started
    streakStartDate: {
      type: Date,
      default: null,
    },
    // Total POTDs solved all time
    totalPOTDsSolved: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Total POTDs attempted (started but not necessarily solved)
    totalPOTDsAttempted: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Streak freeze count (optional feature for future)
    streakFreezes: {
      type: Number,
      default: 0,
    },
    // History of streak milestones
    milestones: [
      {
        streak: Number,
        achievedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for leaderboard queries
userStreakSchema.index({ currentStreak: -1 });
userStreakSchema.index({ maxStreak: -1 });
userStreakSchema.index({ totalPOTDsSolved: -1 });

/**
 * Update streak when user solves POTD
 * @param {ObjectId} userId - User's ID
 * @param {Date} solvedDate - Date the POTD was solved
 * @returns {Object} Updated streak info
 */
userStreakSchema.statics.updateStreak = async function (userId, solvedDate) {
  const today = new Date(solvedDate);
  today.setUTCHours(0, 0, 0, 0);

  let streakDoc = await this.findOne({ userId });

  if (!streakDoc) {
    // Create new streak document for user
    streakDoc = new this({
      userId,
      currentStreak: 1,
      maxStreak: 1,
      lastSolvedDate: today,
      streakStartDate: today,
      totalPOTDsSolved: 1,
      totalPOTDsAttempted: 1,
      milestones: [{ streak: 1, achievedAt: today }],
    });
    await streakDoc.save();
    return {
      currentStreak: 1,
      maxStreak: 1,
      streakIncreased: true,
      isNewRecord: true,
    };
  }

  // Check if already solved today (duplicate call protection)
  if (
    streakDoc.lastSolvedDate &&
    streakDoc.lastSolvedDate.getTime() === today.getTime()
  ) {
    return {
      currentStreak: streakDoc.currentStreak,
      maxStreak: streakDoc.maxStreak,
      streakIncreased: false,
      isNewRecord: false,
      message: "Already solved today",
    };
  }

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  let streakIncreased = false;
  let isNewRecord = false;

  if (
    streakDoc.lastSolvedDate &&
    streakDoc.lastSolvedDate.getTime() === yesterday.getTime()
  ) {
    // Consecutive day - increase streak
    streakDoc.currentStreak += 1;
    streakIncreased = true;
  } else if (
    !streakDoc.lastSolvedDate ||
    streakDoc.lastSolvedDate.getTime() < yesterday.getTime()
  ) {
    // Streak broken - reset to 1
    streakDoc.currentStreak = 1;
    streakDoc.streakStartDate = today;
    streakIncreased = true; // New streak started
  }

  // Update max streak if current exceeds it
  if (streakDoc.currentStreak > streakDoc.maxStreak) {
    streakDoc.maxStreak = streakDoc.currentStreak;
    isNewRecord = true;

    // Add milestone for significant streaks
    const milestones = [7, 14, 30, 50, 100, 150, 200, 365];
    if (milestones.includes(streakDoc.currentStreak)) {
      streakDoc.milestones.push({
        streak: streakDoc.currentStreak,
        achievedAt: today,
      });
    }
  }

  streakDoc.lastSolvedDate = today;
  streakDoc.totalPOTDsSolved += 1;
  await streakDoc.save();

  return {
    currentStreak: streakDoc.currentStreak,
    maxStreak: streakDoc.maxStreak,
    streakIncreased,
    isNewRecord,
  };
};

/**
 * Check and reset streak if user missed yesterday
 * Called when fetching user's streak status
 */
userStreakSchema.statics.checkAndUpdateStreak = async function (userId) {
  const streakDoc = await this.findOne({ userId });

  if (!streakDoc) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      lastSolvedDate: null,
      totalPOTDsSolved: 0,
    };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // If last solved date is before yesterday, streak is broken
  if (
    streakDoc.lastSolvedDate &&
    streakDoc.lastSolvedDate.getTime() < yesterday.getTime() &&
    streakDoc.currentStreak > 0
  ) {
    streakDoc.currentStreak = 0;
    streakDoc.streakStartDate = null;
    await streakDoc.save();
  }

  return {
    currentStreak: streakDoc.currentStreak,
    maxStreak: streakDoc.maxStreak,
    lastSolvedDate: streakDoc.lastSolvedDate,
    totalPOTDsSolved: streakDoc.totalPOTDsSolved,
    streakStartDate: streakDoc.streakStartDate,
  };
};

/**
 * Get streak leaderboard
 */
userStreakSchema.statics.getLeaderboard = async function (limit = 10) {
  return this.find({ currentStreak: { $gt: 0 } })
    .populate("userId", "name email profileImage")
    .sort({ currentStreak: -1, maxStreak: -1 })
    .limit(limit);
};

/**
 * Record an attempt (for totalPOTDsAttempted)
 */
userStreakSchema.statics.recordAttempt = async function (userId) {
  await this.findOneAndUpdate(
    { userId },
    {
      $inc: { totalPOTDsAttempted: 1 },
      $setOnInsert: {
        currentStreak: 0,
        maxStreak: 0,
        totalPOTDsSolved: 0,
      },
    },
    { upsert: true }
  );
};

export default mongoose.model("UserStreak", userStreakSchema);
