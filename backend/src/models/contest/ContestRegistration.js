import mongoose from "mongoose";

/**
 * Contest Registration Schema
 * Tracks user registration and participation in contests
 */
const contestRegistrationSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Registration time
    registeredAt: {
      type: Date,
      default: Date.now,
    },

    // When user actually joined (started the contest)
    joinedAt: {
      type: Date,
      default: null,
    },

    // User's effective start time (max of joinedAt and contest startTime)
    effectiveStartTime: {
      type: Date,
      default: null,
    },

    // Participation status
    status: {
      type: String,
      enum: ["registered", "participating", "completed", "disqualified"],
      default: "registered",
    },

    // Final stats (computed at end)
    finalRank: {
      type: Number,
      default: null,
    },
    finalScore: {
      type: Number,
      default: 0,
    },
    problemsSolved: {
      type: Number,
      default: 0,
    },
    totalPenalty: {
      type: Number,
      default: 0, // Total penalty time in minutes
    },
    totalTime: {
      type: Number,
      default: 0, // Total solve time in seconds
    },

    // Per-problem tracking
    problemAttempts: {
      type: Map,
      of: new mongoose.Schema(
        {
          attempts: { type: Number, default: 0 },
          solved: { type: Boolean, default: false },
          solvedAt: { type: Date, default: null },
          solveTime: { type: Number, default: 0 }, // Seconds from start
          penalty: { type: Number, default: 0 }, // Wrong attempts before AC
          score: { type: Number, default: 0 },
          bestSubmission: { type: mongoose.Schema.Types.ObjectId, ref: "ContestSubmission" },
        },
        { _id: false }
      ),
      default: new Map(),
    },

    // Disqualification info
    disqualifiedReason: {
      type: String,
      default: null,
    },
    disqualifiedAt: {
      type: Date,
      default: null,
    },
    disqualifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // Rating change (post-contest)
    ratingBefore: {
      type: Number,
      default: null,
    },
    ratingAfter: {
      type: Number,
      default: null,
    },
    ratingChange: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: user can only register once per contest
contestRegistrationSchema.index({ contest: 1, user: 1 }, { unique: true });

// Index for leaderboard queries
contestRegistrationSchema.index({ contest: 1, finalScore: -1, totalTime: 1 });
contestRegistrationSchema.index({ contest: 1, problemsSolved: -1, totalPenalty: 1 });

// Method: Mark user as joined
contestRegistrationSchema.methods.markJoined = async function (contestStartTime) {
  const now = new Date();
  this.joinedAt = now;
  this.effectiveStartTime = new Date(Math.max(now.getTime(), contestStartTime.getTime()));
  this.status = "participating";
  return this.save();
};

// Method: Record a submission attempt
contestRegistrationSchema.methods.recordAttempt = async function (
  problemId,
  isAccepted,
  submissionId,
  contestStartTime,
  pointsPerProblem,
  penaltyMinutes
) {
  const problemKey = problemId.toString();
  const currentTime = new Date();
  
  // Get or create problem attempt record
  let attempt = this.problemAttempts.get(problemKey) || {
    attempts: 0,
    solved: false,
    solvedAt: null,
    solveTime: 0,
    penalty: 0,
    score: 0,
    bestSubmission: null,
  };

  attempt.attempts += 1;

  if (isAccepted && !attempt.solved) {
    attempt.solved = true;
    attempt.solvedAt = currentTime;
    attempt.bestSubmission = submissionId;
    
    // Calculate solve time from effective start
    const effectiveStart = this.effectiveStartTime || contestStartTime;
    attempt.solveTime = Math.floor((currentTime - effectiveStart) / 1000);
    
    // Penalty = (wrong attempts) * penalty minutes
    attempt.penalty = (attempt.attempts - 1) * penaltyMinutes;
    attempt.score = pointsPerProblem;

    // Update totals
    this.problemsSolved += 1;
    this.totalTime += attempt.solveTime;
    this.totalPenalty += attempt.penalty;
    this.finalScore += attempt.score;
  }

  this.problemAttempts.set(problemKey, attempt);
  return this.save();
};

// Static: Get leaderboard for contest (LeetCode style)
contestRegistrationSchema.statics.getLeaderboard = async function (
  contestId,
  options = {}
) {
  const { limit = 100, skip = 0, includeDisqualified = false } = options;

  const query = {
    contest: contestId,
    status: includeDisqualified 
      ? { $in: ["participating", "completed", "disqualified"] }
      : { $in: ["participating", "completed"] },
  };

  const registrations = await this.find(query)
    .sort({ 
      finalScore: -1,      // Higher score first
      problemsSolved: -1,  // More problems solved
      totalTime: 1,        // Less time first
      totalPenalty: 1,     // Less penalty first
    })
    .skip(skip)
    .limit(limit)
    .populate("user", "name email profileImage")
    .lean();

  // Assign ranks
  return registrations.map((reg, index) => ({
    ...reg,
    rank: skip + index + 1,
  }));
};

// Static: Get user's registration for a contest
contestRegistrationSchema.statics.getUserRegistration = function (contestId, userId) {
  return this.findOne({ contest: contestId, user: userId })
    .populate("user", "name email profileImage");
};

export default mongoose.model("ContestRegistration", contestRegistrationSchema);
