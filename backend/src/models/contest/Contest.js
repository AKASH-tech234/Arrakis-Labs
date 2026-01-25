import mongoose from "mongoose";

/**
 * Contest Schema
 * LeetCode-style coding contest with precise timing control
 */

// Scoring configuration sub-schema
const scoringRuleSchema = new mongoose.Schema(
  {
    // Points assigned per problem based on order/difficulty
    problemPoints: {
      type: Map,
      of: Number,
      default: new Map(), // { problemId: points }
    },
    // Default points if not specified per problem
    defaultPoints: {
      type: Number,
      default: 100,
    },
    // Partial scoring (percentage of test cases passed)
    partialScoring: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// Penalty configuration sub-schema
const penaltyRuleSchema = new mongoose.Schema(
  {
    // Time penalty per wrong submission (minutes)
    wrongSubmissionPenalty: {
      type: Number,
      default: 5, // 5 minutes penalty per wrong answer
    },
    // Whether to apply penalty only after AC
    penaltyOnlyAfterAC: {
      type: Boolean,
      default: true, // LeetCode style: penalty counts only if solved
    },
    // Maximum penalty per problem (0 = unlimited)
    maxPenaltyPerProblem: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// Problem in contest (with order and points)
const contestProblemSchema = new mongoose.Schema(
  {
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    // Display order (A, B, C... or 1, 2, 3...)
    order: {
      type: Number,
      required: true,
    },
    // Problem label (A, B, C, D...)
    label: {
      type: String,
      required: true,
    },
    // Points for this problem
    points: {
      type: Number,
      default: 100,
    },
  },
  { _id: false }
);

const contestSchema = new mongoose.Schema(
  {
    // Basic Info
    name: {
      type: String,
      required: [true, "Contest name is required"],
      trim: true,
      maxlength: [200, "Contest name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },

    // Timing (ALL IN UTC)
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
      index: true,
    },
    duration: {
      type: Number, // Duration in minutes
      required: [true, "Duration is required"],
      min: [5, "Duration must be at least 5 minutes"],
      max: [720, "Duration cannot exceed 12 hours"],
    },
    // Computed end time (for queries)
    endTime: {
      type: Date,
      index: true,
    },

    // Contest State
    status: {
      type: String,
      enum: ["draft", "scheduled", "live", "ended", "cancelled"],
      default: "draft",
      index: true,
    },

    // Problems
    problems: {
      type: [contestProblemSchema],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 10; // Max 10 problems per contest
        },
        message: "Contest cannot have more than 10 problems",
      },
    },

    // Scoring & Penalty Rules
    scoringRules: {
      type: scoringRuleSchema,
      default: () => ({}),
    },
    penaltyRules: {
      type: penaltyRuleSchema,
      default: () => ({}),
    },

    // Ranking type
    rankingType: {
      type: String,
      enum: ["lcb", "icpc", "ioi"], // LeetCode Biweekly, ICPC, IOI
      default: "lcb",
    },

    // Visibility & Access
    isPublic: {
      type: Boolean,
      default: true,
    },
    requiresRegistration: {
      type: Boolean,
      default: true,
    },
    maxParticipants: {
      type: Number,
      default: 0, // 0 = unlimited
    },

    // Registration window
    registrationStart: {
      type: Date,
      default: null, // null = registration opens immediately
    },
    registrationEnd: {
      type: Date,
      default: null, // null = can register until contest starts
    },

    // Late join settings
    allowLateJoin: {
      type: Boolean,
      default: true, // LeetCode allows joining late
    },
    lateJoinDeadline: {
      type: Number,
      default: 30, // Allow joining up to 30 minutes after start
    },

    // Post-contest settings
    showLeaderboardDuringContest: {
      type: Boolean,
      default: true,
    },
    freezeLeaderboardMinutes: {
      type: Number,
      default: 0, // 0 = no freeze (ICPC style would use 60)
    },
    releaseEditorialsAfter: {
      type: Number,
      default: 0, // Minutes after end (0 = immediately)
    },
    allowDiscussionAfter: {
      type: Number,
      default: 0, // Minutes after end
    },

    // Editorial content
    editorial: {
      type: String,
      default: "",
    },
    editorialVisible: {
      type: Boolean,
      default: false,
    },

    // Statistics (updated post-contest)
    stats: {
      registeredCount: { type: Number, default: 0 },
      participatedCount: { type: Number, default: 0 },
      submissionCount: { type: Number, default: 0 },
      avgScore: { type: Number, default: 0 },
    },

    // Admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save: Calculate endTime and generate slug
contestSchema.pre("save", function (next) {
  // Calculate endTime
  if (this.startTime && this.duration) {
    this.endTime = new Date(this.startTime.getTime() + this.duration * 60 * 1000);
  }

  // Generate slug if not provided
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36);
  }

  next();
});

// Indexes for efficient queries
contestSchema.index({ status: 1, startTime: 1 });
contestSchema.index({ status: 1, endTime: 1 });
contestSchema.index({ isPublic: 1, status: 1 });
contestSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual: Check if contest is upcoming
contestSchema.virtual("isUpcoming").get(function () {
  return this.status === "scheduled" && new Date() < this.startTime;
});

// Virtual: Check if contest is live
contestSchema.virtual("isLive").get(function () {
  const now = new Date();
  return this.status === "live" || 
    (this.status === "scheduled" && now >= this.startTime && now < this.endTime);
});

// Virtual: Check if contest has ended
contestSchema.virtual("hasEnded").get(function () {
  return this.status === "ended" || new Date() >= this.endTime;
});

// Virtual: Remaining time in seconds
contestSchema.virtual("remainingTime").get(function () {
  if (this.hasEnded) return 0;
  const now = new Date();
  if (now < this.startTime) {
    return Math.floor((this.endTime - this.startTime) / 1000);
  }
  return Math.max(0, Math.floor((this.endTime - now) / 1000));
});

// Virtual: Time until start in seconds
contestSchema.virtual("timeUntilStart").get(function () {
  const now = new Date();
  if (now >= this.startTime) return 0;
  return Math.floor((this.startTime - now) / 1000);
});

// Method: Check if user can join
contestSchema.methods.canUserJoin = function (currentTime = new Date()) {
  if (this.status === "cancelled" || !this.isActive) return false;
  if (this.status === "ended") return false;
  
  // Before contest
  if (currentTime < this.startTime) {
    return this.requiresRegistration ? true : false; // Can register if required
  }
  
  // During contest
  if (currentTime < this.endTime) {
    if (!this.allowLateJoin) return currentTime <= this.startTime;
    const lateDeadline = new Date(this.startTime.getTime() + this.lateJoinDeadline * 60 * 1000);
    return currentTime <= lateDeadline;
  }
  
  return false;
};

// Method: Get user's remaining time
contestSchema.methods.getUserRemainingTime = function (userJoinTime, currentTime = new Date()) {
  if (this.hasEnded || currentTime >= this.endTime) return 0;
  
  // User's effective start time
  const effectiveStart = new Date(Math.max(userJoinTime.getTime(), this.startTime.getTime()));
  const effectiveEnd = this.endTime;
  
  return Math.max(0, Math.floor((effectiveEnd - currentTime) / 1000));
};

// Static: Get active contests
contestSchema.statics.getActiveContests = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    isPublic: true,
    $or: [
      { status: "scheduled", startTime: { $gt: now } },
      { status: "live" },
      { status: "scheduled", startTime: { $lte: now }, endTime: { $gt: now } },
    ],
  }).sort({ startTime: 1 });
};

// Static: Update contest statuses (cron job)
contestSchema.statics.updateStatuses = async function () {
  const now = new Date();
  
  // Scheduled -> Live
  await this.updateMany(
    {
      status: "scheduled",
      startTime: { $lte: now },
      endTime: { $gt: now },
    },
    { $set: { status: "live" } }
  );
  
  // Live -> Ended
  await this.updateMany(
    {
      status: "live",
      endTime: { $lte: now },
    },
    { $set: { status: "ended" } }
  );
};

contestSchema.set("toJSON", { virtuals: true });
contestSchema.set("toObject", { virtuals: true });

export default mongoose.model("Contest", contestSchema);
