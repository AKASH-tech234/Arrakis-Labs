import mongoose from "mongoose";

const userStreakSchema = new mongoose.Schema(
  {
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
      index: true,
    },
    
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    maxStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    lastSolvedDate: {
      type: Date,
      default: null,
    },
    
    streakStartDate: {
      type: Date,
      default: null,
    },
    
    totalPOTDsSolved: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    totalPOTDsAttempted: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    streakFreezes: {
      type: Number,
      default: 0,
    },
    
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

userStreakSchema.index({ currentStreak: -1 });
userStreakSchema.index({ maxStreak: -1 });
userStreakSchema.index({ totalPOTDsSolved: -1 });

userStreakSchema.statics.updateStreak = async function (userId, solvedDate) {
  const today = new Date(solvedDate);
  today.setUTCHours(0, 0, 0, 0);

  let streakDoc = await this.findOne({ userId });

  if (!streakDoc) {
    
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
    
    streakDoc.currentStreak += 1;
    streakIncreased = true;
  } else if (
    !streakDoc.lastSolvedDate ||
    streakDoc.lastSolvedDate.getTime() < yesterday.getTime()
  ) {
    
    streakDoc.currentStreak = 1;
    streakDoc.streakStartDate = today;
    streakIncreased = true; 
  }

  if (streakDoc.currentStreak > streakDoc.maxStreak) {
    streakDoc.maxStreak = streakDoc.currentStreak;
    isNewRecord = true;

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

userStreakSchema.statics.getLeaderboard = async function (limit = 10) {
  return this.find({ currentStreak: { $gt: 0 } })
    .populate("userId", "name email profileImage")
    .sort({ currentStreak: -1, maxStreak: -1 })
    .limit(limit);
};

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
