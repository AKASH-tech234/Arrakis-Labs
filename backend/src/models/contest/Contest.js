import mongoose from "mongoose";

const scoringRuleSchema = new mongoose.Schema(
  {
    
    problemPoints: {
      type: Map,
      of: Number,
      default: new Map(), 
    },
    
    defaultPoints: {
      type: Number,
      default: 100,
    },
    
    partialScoring: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const penaltyRuleSchema = new mongoose.Schema(
  {
    
    wrongSubmissionPenalty: {
      type: Number,
      default: 5, 
    },
    
    penaltyOnlyAfterAC: {
      type: Boolean,
      default: true, 
    },
    
    maxPenaltyPerProblem: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const contestProblemSchema = new mongoose.Schema(
  {
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    
    order: {
      type: Number,
      required: true,
    },
    
    label: {
      type: String,
      required: true,
    },
    
    points: {
      type: Number,
      default: 100,
    },
  },
  { _id: false }
);

const contestSchema = new mongoose.Schema(
  {
    
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

    startTime: {
      type: Date,
      required: [true, "Start time is required"],
      index: true,
    },
    duration: {
      type: Number, 
      required: [true, "Duration is required"],
      min: [5, "Duration must be at least 5 minutes"],
      max: [720, "Duration cannot exceed 12 hours"],
    },
    
    endTime: {
      type: Date,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "scheduled", "live", "ended", "cancelled"],
      default: "draft",
      index: true,
    },

    problems: {
      type: [contestProblemSchema],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 10; 
        },
        message: "Contest cannot have more than 10 problems",
      },
    },

    scoringRules: {
      type: scoringRuleSchema,
      default: () => ({}),
    },
    penaltyRules: {
      type: penaltyRuleSchema,
      default: () => ({}),
    },

    rankingType: {
      type: String,
      enum: ["lcb", "icpc", "ioi"], 
      default: "lcb",
    },

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
      default: 0, 
    },

    registrationStart: {
      type: Date,
      default: null, 
    },
    registrationEnd: {
      type: Date,
      default: null, 
    },

    allowLateJoin: {
      type: Boolean,
      default: true, 
    },
    lateJoinDeadline: {
      type: Number,
      default: 30, 
    },

    showLeaderboardDuringContest: {
      type: Boolean,
      default: true,
    },
    freezeLeaderboardMinutes: {
      type: Number,
      default: 0, 
    },
    releaseEditorialsAfter: {
      type: Number,
      default: 0, 
    },
    allowDiscussionAfter: {
      type: Number,
      default: 0, 
    },

    editorial: {
      type: String,
      default: "",
    },
    editorialVisible: {
      type: Boolean,
      default: false,
    },

    stats: {
      registeredCount: { type: Number, default: 0 },
      participatedCount: { type: Number, default: 0 },
      submissionCount: { type: Number, default: 0 },
      avgScore: { type: Number, default: 0 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

contestSchema.pre("save", function (next) {
  
  if (this.startTime && this.duration) {
    this.endTime = new Date(this.startTime.getTime() + this.duration * 60 * 1000);
  }

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

contestSchema.index({ status: 1, startTime: 1 });
contestSchema.index({ status: 1, endTime: 1 });
contestSchema.index({ isPublic: 1, status: 1 });
contestSchema.index({ createdBy: 1, createdAt: -1 });

contestSchema.virtual("isUpcoming").get(function () {
  return this.status === "scheduled" && new Date() < this.startTime;
});

contestSchema.virtual("isLive").get(function () {
  const now = new Date();
  return this.status === "live" || 
    (this.status === "scheduled" && now >= this.startTime && now < this.endTime);
});

contestSchema.virtual("hasEnded").get(function () {
  return this.status === "ended" || new Date() >= this.endTime;
});

contestSchema.virtual("remainingTime").get(function () {
  if (this.hasEnded) return 0;
  const now = new Date();
  if (now < this.startTime) {
    return Math.floor((this.endTime - this.startTime) / 1000);
  }
  return Math.max(0, Math.floor((this.endTime - now) / 1000));
});

contestSchema.virtual("timeUntilStart").get(function () {
  const now = new Date();
  if (now >= this.startTime) return 0;
  return Math.floor((this.startTime - now) / 1000);
});

contestSchema.methods.canUserJoin = function (currentTime = new Date()) {
  if (this.status === "cancelled" || !this.isActive) return false;
  if (this.status === "ended") return false;

  if (currentTime < this.startTime) {
    return this.requiresRegistration ? true : false; 
  }

  if (currentTime < this.endTime) {
    if (!this.allowLateJoin) return currentTime <= this.startTime;
    const lateDeadline = new Date(this.startTime.getTime() + this.lateJoinDeadline * 60 * 1000);
    return currentTime <= lateDeadline;
  }
  
  return false;
};

contestSchema.methods.getUserRemainingTime = function (userJoinTime, currentTime = new Date()) {
  if (this.hasEnded || currentTime >= this.endTime) return 0;

  const effectiveStart = new Date(Math.max(userJoinTime.getTime(), this.startTime.getTime()));
  const effectiveEnd = this.endTime;
  
  return Math.max(0, Math.floor((effectiveEnd - currentTime) / 1000));
};

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

contestSchema.statics.updateStatuses = async function () {
  const now = new Date();

  await this.updateMany(
    {
      status: "scheduled",
      startTime: { $lte: now },
      endTime: { $gt: now },
    },
    { $set: { status: "live" } }
  );

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
