import mongoose from "mongoose";

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

    registeredAt: {
      type: Date,
      default: Date.now,
    },

    joinedAt: {
      type: Date,
      default: null,
    },

    effectiveStartTime: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["registered", "participating", "completed", "disqualified"],
      default: "registered",
    },

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
      default: 0, 
    },
    totalTime: {
      type: Number,
      default: 0, 
    },

    problemAttempts: {
      type: Map,
      of: new mongoose.Schema(
        {
          attempts: { type: Number, default: 0 },
          solved: { type: Boolean, default: false },
          solvedAt: { type: Date, default: null },
          solveTime: { type: Number, default: 0 }, 
          penalty: { type: Number, default: 0 }, 
          score: { type: Number, default: 0 },
          bestSubmission: { type: mongoose.Schema.Types.ObjectId, ref: "ContestSubmission" },
        },
        { _id: false }
      ),
      default: new Map(),
    },

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

contestRegistrationSchema.index({ contest: 1, user: 1 }, { unique: true });

contestRegistrationSchema.index({ contest: 1, finalScore: -1, totalTime: 1 });
contestRegistrationSchema.index({ contest: 1, problemsSolved: -1, totalPenalty: 1 });

contestRegistrationSchema.methods.markJoined = async function (contestStartTime) {
  const now = new Date();
  this.joinedAt = now;
  this.effectiveStartTime = new Date(Math.max(now.getTime(), contestStartTime.getTime()));
  this.status = "participating";
  return this.save();
};

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

    const effectiveStart = this.effectiveStartTime || contestStartTime;
    attempt.solveTime = Math.floor((currentTime - effectiveStart) / 1000);

    attempt.penalty = (attempt.attempts - 1) * penaltyMinutes;
    attempt.score = pointsPerProblem;

    this.problemsSolved += 1;
    this.totalTime += attempt.solveTime;
    this.totalPenalty += attempt.penalty;
    this.finalScore += attempt.score;
  }

  this.problemAttempts.set(problemKey, attempt);
  return this.save();
};

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
      finalScore: -1,      
      problemsSolved: -1,  
      totalTime: 1,        
      totalPenalty: 1,     
    })
    .skip(skip)
    .limit(limit)
    .populate("user", "name email profileImage")
    .lean();

  return registrations.map((reg, index) => ({
    ...reg,
    rank: skip + index + 1,
  }));
};

contestRegistrationSchema.statics.getUserRegistration = function (contestId, userId) {
  return this.findOne({ contest: contestId, user: userId })
    .populate("user", "name email profileImage");
};

export default mongoose.model("ContestRegistration", contestRegistrationSchema);
