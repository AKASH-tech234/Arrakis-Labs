import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profileImage: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    githubId: {
      type: String,
      default: null,
      sparse: true,
    },
    preferences: {
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
      },
      language: {
        type: String,
        default: "javascript",
      },
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "dark",
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
    },
    stats: {
      totalSolved: {
        type: Number,
        default: 0,
      },
      totalAttempted: {
        type: Number,
        default: 0,
      },
      currentStreak: {
        type: Number,
        default: 0,
      },
      bestStreak: {
        type: Number,
        default: 0,
      },
      lastActivityDate: {
        type: Date,
        default: null,
      },
    },
    // AI-computed cognitive profile (pre-computed for fast access)
    aiProfile: {
      weakTopics: {
        type: [String],
        default: [],
      },
      strongTopics: {
        type: [String],
        default: [],
      },
      commonMistakes: {
        type: [String], // Recurring mistake patterns
        default: [],
      },
      recurringPatterns: {
        type: [String], // Abstract patterns (e.g., "off-by-one errors")
        default: [],
      },
      successRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
      },
      totalSubmissions: {
        type: Number,
        default: 0,
      },
      recentCategories: {
        type: [String], // Last N categories attempted
        default: [],
      },
      skillLevels: {
        type: Map,
        of: Number, // topic -> skill level (0-100)
        default: {},
      },
      learningStyle: {
        type: String,
        enum: ["visual", "hands-on", "theoretical", null],
        default: null,
      },
      difficultyReadiness: {
        easy: { type: Number, default: 1.0, min: 0, max: 1 },
        medium: { type: Number, default: 0.5, min: 0, max: 1 },
        hard: { type: Number, default: 0.2, min: 0, max: 1 },
      },
      lastUpdated: {
        type: Date,
        default: null,
      },
    },
    // MIM Learning Roadmap (persisted, updated after each submission)
    learningRoadmap: {
      // Current position in learning journey
      currentPhase: {
        type: String,
        enum: [
          "foundation",
          "skill_building",
          "consolidation",
          "advancement",
          "mastery",
        ],
        default: "foundation",
      },
      // 5-step micro roadmap
      steps: [
        {
          stepNumber: { type: Number, required: true },
          goal: { type: String, required: true },
          targetProblems: { type: Number, default: 2 },
          completedProblems: { type: Number, default: 0 },
          focusTopics: [{ type: String }],
          targetDifficulty: {
            type: String,
            enum: ["Easy", "Medium", "Hard"],
          },
          status: {
            type: String,
            enum: ["pending", "in_progress", "completed"],
            default: "pending",
          },
          startedAt: { type: Date },
          completedAt: { type: Date },
        },
      ],
      // Topic dependencies (derived from co-occurrence)
      topicDependencies: {
        type: Map,
        of: [String], // topic -> prerequisite topics
        default: {},
      },
      // Milestones achieved
      milestones: [
        {
          name: { type: String },
          description: { type: String },
          achievedAt: { type: Date },
          evidence: { type: String }, // e.g., "Solved 5 Medium DP problems"
        },
      ],
      // Long-term goals
      targetLevel: {
        type: String,
        enum: ["Beginner", "Easy", "Medium", "Hard", "Expert"],
        default: "Medium",
      },
      estimatedWeeksToTarget: { type: Number, default: null },
      // Difficulty adjustment state
      difficultyAdjustment: {
        currentDifficulty: {
          type: String,
          enum: ["Easy", "Medium", "Hard"],
          default: "Easy",
        },
        recommendation: {
          type: String,
          enum: ["increase", "decrease", "maintain"],
          default: "maintain",
        },
        confidence: { type: Number, default: 0.5, min: 0, max: 1 },
        frustrationIndex: { type: Number, default: 0, min: 0, max: 1 },
        boredomIndex: { type: Number, default: 0, min: 0, max: 1 },
        lastAdjusted: { type: Date },
      },
      // Roadmap metadata
      generatedAt: { type: Date },
      lastUpdated: { type: Date },
      version: { type: String, default: "v2.0" },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "7d",
  });
};

export default mongoose.model("User", userSchema);
