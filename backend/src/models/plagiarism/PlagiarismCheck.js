/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM CHECK MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Tracks plagiarism detection runs for contests.
 * Each contest gets one PlagiarismCheck document that tracks the overall
 * detection job status and results summary.
 */

import mongoose from "mongoose";

const PER_PROBLEM_STATUS_ENUM = new Set([
  "pending",
  "preprocessing",
  "vectorizing",
  "comparing",
  "completed",
  "failed",
]);

const OVERALL_STATUS_ENUM = new Set([
  "pending",
  "queued",
  "preprocessing",
  "vectorizing",
  "comparing",
  "clustering",
  "applying_penalties",
  "completed",
  "failed",
  "cancelled",
]);

function normalizeOverallStatus(status) {
  if (!status) return "pending";
  if (status === "vectorized") return "vectorizing";
  if (OVERALL_STATUS_ENUM.has(status)) return status;
  return "pending";
}

function normalizePerProblemStatus(status) {
  if (!status) return "pending";
  if (status === "vectorized") return "vectorizing";
  if (PER_PROBLEM_STATUS_ENUM.has(status)) return status;
  // Don’t allow overall job phases to leak into per-problem status.
  return "pending";
}

const problemCheckStatusSchema = new mongoose.Schema(
  {
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    problemLabel: {
      type: String,
      required: true,
    },
    submissionCount: {
      type: Number,
      default: 0,
    },
    comparisonCount: {
      type: Number,
      default: 0,
    },
    plagiarismCount: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    safeCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "preprocessing", "vectorizing", "comparing", "completed", "failed"],
      default: "pending",
    },
    startedAt: Date,
    completedAt: Date,
    error: String,
  },
  { _id: false }
);

const plagiarismCheckSchema = new mongoose.Schema(
  {
    // Reference to the contest
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      unique: true,
      index: true,
    },

    // Overall job status
    status: {
      type: String,
      enum: [
        "pending",      // Waiting to start
        "queued",       // In job queue
        "preprocessing", // Normalizing code
        "vectorizing",   // Creating TF-IDF vectors
        "comparing",     // Pairwise similarity
        "clustering",    // Building cheating groups
        "applying_penalties", // Applying penalties
        "completed",     // Done
        "failed",        // Error occurred
        "cancelled",     // Manually cancelled
      ],
      default: "pending",
      index: true,
    },

    // Job timing
    queuedAt: Date,
    startedAt: Date,
    completedAt: Date,

    // Job runner bookkeeping
    retryCount: {
      type: Number,
      default: 0,
    },
    // Convenience error field (in addition to the structured `errors[]` audit trail)
    error: String,

    // Progress tracking
    progress: {
      currentPhase: {
        type: String,
        default: "pending",
      },
      totalSubmissions: {
        type: Number,
        default: 0,
      },
      processedSubmissions: {
        type: Number,
        default: 0,
      },
      totalComparisons: {
        type: Number,
        default: 0,
      },
      completedComparisons: {
        type: Number,
        default: 0,
      },
      percentComplete: {
        type: Number,
        default: 0,
      },
    },

    // Per-problem status
    problemStatuses: [problemCheckStatusSchema],

    // Results summary
    results: {
      totalSubmissions: {
        type: Number,
        default: 0,
      },
      totalComparisons: {
        type: Number,
        default: 0,
      },
      plagiarismPairs: {
        type: Number,
        default: 0,
      },
      reviewPairs: {
        type: Number,
        default: 0,
      },
      safePairs: {
        type: Number,
        default: 0,
      },
      cheatingGroupsDetected: {
        type: Number,
        default: 0,
      },
      usersAffected: {
        type: Number,
        default: 0,
      },
      penaltiesApplied: {
        type: Number,
        default: 0,
      },
    },

    // Configuration used for this check
    config: {
      plagiarismThreshold: {
        type: Number,
        default: 0.80, // 80% similarity = plagiarism
      },
      reviewThreshold: {
        type: Number,
        default: 0.60, // 60-80% = needs review
      },
      minSubmissionLength: {
        type: Number,
        default: 50, // Ignore very short submissions
      },
      languagesChecked: {
        type: [String],
        default: ["python", "javascript", "java", "cpp", "c"],
      },
      autoPenalize: {
        type: Boolean,
        default: false, // Require manual review by default
      },
      penaltyAction: {
        type: String,
        enum: ["none", "zero_score", "disqualify"],
        default: "none",
      },
    },

    // Error tracking
    errors: [
      {
        phase: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
        problemId: mongoose.Schema.Types.ObjectId,
      },
    ],

    // Audit trail
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewedAt: Date,
    reviewNotes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
plagiarismCheckSchema.index({ status: 1, createdAt: -1 });
plagiarismCheckSchema.index({ "results.plagiarismPairs": -1 });

// Methods
plagiarismCheckSchema.methods.updateProgress = async function (updates) {
  const nextProgress = {
    ...(this.progress?.toObject?.() || this.progress || {}),
    ...updates,
  };
  nextProgress.percentComplete = Math.round(
    ((nextProgress.completedComparisons || 0) / Math.max(1, nextProgress.totalComparisons || 0)) * 100
  );

  await this.constructor.updateOne(
    { _id: this._id },
    { $set: { progress: nextProgress } }
  );
  this.progress = nextProgress;
  return this;
};

plagiarismCheckSchema.methods.markPhase = async function (phase, problemId = null) {
  const now = new Date();
  const $set = {
    status: phase,
    "progress.currentPhase": phase,
  };

  const update = { $set };

  if (problemId) {
    // Only update existing entries; creation is handled in the detection service.
    update.$set["problemStatuses.$.status"] = phase;
    if (phase !== "completed" && phase !== "failed") {
      update.$set["problemStatuses.$.startedAt"] = now;
    }

    await this.constructor.updateOne(
      { _id: this._id, "problemStatuses.problem": problemId },
      update
    );
  } else {
    await this.constructor.updateOne({ _id: this._id }, update);
  }

  this.status = phase;
  this.progress = { ...(this.progress?.toObject?.() || this.progress || {}), currentPhase: phase };
  return this;
};

// Accept optional results payload from the detection service
plagiarismCheckSchema.methods.markCompleted = async function (results = null) {
  const mergedResults = results && typeof results === "object"
    ? { ...(this.results?.toObject?.() || this.results || {}), ...results }
    : (this.results?.toObject?.() || this.results || {});

  await this.constructor.updateOne(
    { _id: this._id },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        "progress.percentComplete": 100,
        results: mergedResults,
        error: null,
      },
    }
  );

  this.status = "completed";
  this.completedAt = new Date();
  this.progress = { ...(this.progress?.toObject?.() || this.progress || {}), percentComplete: 100 };
  this.results = mergedResults;
  this.error = null;
  return this;
};

plagiarismCheckSchema.methods.markFailed = async function (error, phase = null) {
  const message = error?.message || error;
  const now = new Date();

  await this.constructor.updateOne(
    { _id: this._id },
    {
      $set: {
        status: "failed",
        completedAt: now,
        error: message,
      },
      $push: {
        errors: {
          phase: phase || this.progress?.currentPhase,
          message,
          timestamp: now,
        },
      },
    }
  );

  this.status = "failed";
  this.completedAt = now;
  this.error = message;
  return this;
};

// Static methods
plagiarismCheckSchema.statics.getOrCreateForContest = async function (contestId, adminId = null) {
  let check = await this.findOne({ contest: contestId });
  
  if (!check) {
    check = await this.create({
      contest: contestId,
      triggeredBy: adminId,
      triggeredAt: new Date(),
    });

    return check;
  }

  // Repair legacy/partially-written problemStatuses that can block any future `.save()`.
  // We do this via updateOne to avoid validators rejecting the existing bad state.
  const existing = Array.isArray(check.problemStatuses)
    ? check.problemStatuses.map((ps) => (ps?.toObject ? ps.toObject() : ps))
    : [];

  let needsRepair = false;
  const repaired = [];

  for (const ps of existing) {
    const problemId = ps?.problem ? String(ps.problem) : null;
    if (!problemId) {
      needsRepair = true;
      continue;
    }

    const normalizedStatus = normalizePerProblemStatus(ps?.status);
    const problemLabel =
      typeof ps?.problemLabel === "string" && ps.problemLabel.trim()
        ? ps.problemLabel
        : `Problem ${problemId.slice(-6)}`;

    if (normalizedStatus !== ps?.status) needsRepair = true;
    if (problemLabel !== ps?.problemLabel) needsRepair = true;

    repaired.push({
      problem: ps.problem,
      problemLabel,
      submissionCount: Number.isFinite(ps?.submissionCount) ? ps.submissionCount : 0,
      comparisonCount: Number.isFinite(ps?.comparisonCount) ? ps.comparisonCount : 0,
      plagiarismCount: Number.isFinite(ps?.plagiarismCount) ? ps.plagiarismCount : 0,
      reviewCount: Number.isFinite(ps?.reviewCount) ? ps.reviewCount : 0,
      safeCount: Number.isFinite(ps?.safeCount) ? ps.safeCount : 0,
      status: normalizedStatus,
      startedAt: ps?.startedAt || undefined,
      completedAt: ps?.completedAt || undefined,
      error: ps?.error || undefined,
    });
  }

  const normalizedOverallStatus = normalizeOverallStatus(check.status);
  const normalizedPhase = normalizeOverallStatus(check?.progress?.currentPhase);
  if (normalizedOverallStatus !== check.status) needsRepair = true;
  if (check?.progress?.currentPhase && normalizedPhase !== check.progress.currentPhase) needsRepair = true;

  if (needsRepair) {
    const $set = {
      problemStatuses: repaired,
    };

    if (normalizedOverallStatus !== check.status) {
      $set.status = normalizedOverallStatus;
    }
    if (check?.progress?.currentPhase && normalizedPhase !== check.progress.currentPhase) {
      $set["progress.currentPhase"] = normalizedPhase;
    }

    await this.updateOne({ _id: check._id }, { $set });
    check = await this.findById(check._id);
  }

  return check;
};

plagiarismCheckSchema.statics.getPendingJobs = function () {
  return this.find({
    status: { $in: ["pending", "queued"] },
  }).sort({ queuedAt: 1, createdAt: 1 });
};

export default mongoose.model("PlagiarismCheck", plagiarismCheckSchema);
