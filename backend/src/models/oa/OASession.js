import mongoose from "mongoose";
import crypto from "crypto";

const oaSessionSchema = new mongoose.Schema(
  {

    sessionCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    configId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OAConfig",
      required: true,
    },

    status: {
      type: String,
      enum: ["scheduled", "live", "paused", "submitted", "terminated", "expired"],
      default: "scheduled",
      index: true,
    },

    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    actualStartedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      required: true,
    },

    questions: [
      {
        order: { type: Number, required: true },
        refId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },

        titleSnapshot: String,
        topicSnapshot: String,
        difficultySnapshot: String,
        companyTagsSnapshot: [String],
        points: { type: Number, default: 100 },
      },
    ],

    proctoring: {
      warningsAllowed: { type: Number, default: 3 },
      warningCount: { type: Number, default: 0 },
      violationCount: { type: Number, default: 0 },
      isFullscreen: { type: Boolean, default: false },
      actionOnExceed: { type: String, default: "auto_submit" },
    },

    terminatedReason: {
      type: String,
      enum: ["warnings_exceeded", "time_expired", "manual", "system", null],
      default: null,
    },

    companyContext: {
      type: String,
      default: null,
    },
    difficulty: String,
    totalPoints: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

oaSessionSchema.index({ status: 1, startAt: 1 });
oaSessionSchema.index({ status: 1, endAt: 1 });
oaSessionSchema.index({ userId: 1, status: 1 });
oaSessionSchema.index({ userId: 1, createdAt: -1 });

oaSessionSchema.statics.generateSessionCode = function () {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `OA-${timestamp}-${random}`;
};

oaSessionSchema.methods.isWithinTimeWindow = function () {
  const now = new Date();
  return now >= this.startAt && now <= this.endAt;
};

oaSessionSchema.methods.getRemainingSeconds = function () {
  const now = new Date();
  if (now >= this.endAt) return 0;
  if (now < this.startAt) return Math.floor((this.endAt - this.startAt) / 1000);
  return Math.floor((this.endAt - now) / 1000);
};

oaSessionSchema.methods.transitionToLive = async function () {
  if (this.status !== "scheduled") {
    throw new Error(`Cannot transition from ${this.status} to live`);
  }
  this.status = "live";
  this.actualStartedAt = new Date();
  return this.save();
};

oaSessionSchema.methods.submit = async function (reason = null) {
  if (this.status !== "live") {
    throw new Error(`Cannot submit session in ${this.status} status`);
  }
  this.status = "submitted";
  this.submittedAt = new Date();
  if (reason) {
    this.terminatedReason = reason;
  }
  return this.save();
};

oaSessionSchema.methods.terminate = async function (reason) {
  if (!["scheduled", "live"].includes(this.status)) {
    throw new Error(`Cannot terminate session in ${this.status} status`);
  }
  this.status = "terminated";
  this.terminatedReason = reason;
  this.submittedAt = new Date();
  return this.save();
};

export default mongoose.model("OASession", oaSessionSchema);
