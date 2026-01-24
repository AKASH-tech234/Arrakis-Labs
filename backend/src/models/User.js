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

// Hash password before saving
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

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate JWT token
userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "7d",
  });
};

export default mongoose.model("User", userSchema);
