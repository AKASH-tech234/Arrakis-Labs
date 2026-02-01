/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM RESULT MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Stores pairwise similarity results between submissions.
 * Each document represents a comparison between two submissions.
 */

import mongoose from "mongoose";

const plagiarismResultSchema = new mongoose.Schema(
  {
    // Parent check reference
    plagiarismCheck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlagiarismCheck",
      required: true,
      index: true,
    },

    // Contest and problem context
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    problemLabel: String,

    // The two submissions being compared
    submission1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestSubmission",
      required: true,
    },
    submission2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestSubmission",
      required: true,
    },

    // Users involved
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Similarity metrics
    similarityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      index: true,
    },
    
    // Different similarity measures (for transparency)
    similarityDetails: {
      cosineSimilarity: Number,
      jaccardSimilarity: Number,
      levenshteinRatio: Number,
      tokenOverlap: Number,
      structuralSimilarity: Number,
    },

    // Classification
    status: {
      type: String,
      enum: ["plagiarism", "review", "safe", "false_positive", "confirmed"],
      required: true,
      index: true,
    },

    // Languages of the submissions
    language1: String,
    language2: String,

    // Code snippets for quick reference (truncated for storage)
    codeSnippet1: {
      type: String,
      maxlength: 2000,
    },
    codeSnippet2: {
      type: String,
      maxlength: 2000,
    },

    // Matching sections for highlighting
    matchingSections: [
      {
        start1: Number,
        end1: Number,
        start2: Number,
        end2: Number,
        similarity: Number,
      },
    ],

    // Review tracking
    reviewStatus: {
      type: String,
      enum: ["pending", "in_review", "resolved"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewedAt: Date,
    reviewNotes: String,
    finalDecision: {
      type: String,
      enum: ["plagiarism", "coincidence", "template_code", "pending"],
      default: "pending",
    },

    // Penalty tracking
    penaltyApplied: {
      type: Boolean,
      default: false,
    },
    penaltyAppliedAt: Date,
    penaltyAppliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // Metadata
    comparedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
plagiarismResultSchema.index({ contest: 1, problem: 1, status: 1 });
plagiarismResultSchema.index({ contest: 1, similarityScore: -1 });
plagiarismResultSchema.index({ submission1: 1, submission2: 1 }, { unique: true });
plagiarismResultSchema.index({ user1: 1, user2: 1, contest: 1 });
plagiarismResultSchema.index({ plagiarismCheck: 1, status: 1 });

// Ensure we don't store duplicate comparisons (A-B = B-A)
plagiarismResultSchema.pre("save", function (next) {
  // Normalize submission order to prevent duplicates
  if (this.submission1.toString() > this.submission2.toString()) {
    [this.submission1, this.submission2] = [this.submission2, this.submission1];
    [this.user1, this.user2] = [this.user2, this.user1];
    [this.codeSnippet1, this.codeSnippet2] = [this.codeSnippet2, this.codeSnippet1];
    [this.language1, this.language2] = [this.language2, this.language1];
  }
  next();
});

// Virtual for percentage display
plagiarismResultSchema.virtual("similarityPercent").get(function () {
  return Math.round(this.similarityScore * 100);
});

// Methods
plagiarismResultSchema.methods.markAsReviewed = async function (adminId, decision, notes) {
  this.reviewStatus = "resolved";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.finalDecision = decision;
  
  if (decision === "plagiarism") {
    this.status = "confirmed";
  } else if (decision === "coincidence" || decision === "template_code") {
    this.status = "false_positive";
  }
  
  return this.save();
};

// Statics
plagiarismResultSchema.statics.findByContest = function (contestId, options = {}) {
  const query = { contest: contestId };
  
  if (options.status) {
    query.status = options.status;
  }
  if (options.problemId) {
    query.problem = options.problemId;
  }
  if (options.minSimilarity) {
    query.similarityScore = { $gte: options.minSimilarity };
  }
  
  return this.find(query)
    .populate("user1", "name email")
    .populate("user2", "name email")
    .populate("submission1", "code language submittedAt")
    .populate("submission2", "code language submittedAt")
    .sort({ similarityScore: -1 });
};

plagiarismResultSchema.statics.findPairsInvolvingUser = function (contestId, userId) {
  return this.find({
    contest: contestId,
    $or: [{ user1: userId }, { user2: userId }],
  })
    .populate("user1", "name email")
    .populate("user2", "name email")
    .sort({ similarityScore: -1 });
};

plagiarismResultSchema.statics.getContestSummary = async function (contestId) {
  let contestObjectId;
  try {
    contestObjectId = new mongoose.Types.ObjectId(contestId);
  } catch {
    return {
      plagiarism: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
      review: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
      safe: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
      confirmed: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
      false_positive: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
    };
  }

  const results = await this.aggregate([
    { $match: { contest: contestObjectId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        avgSimilarity: { $avg: "$similarityScore" },
        maxSimilarity: { $max: "$similarityScore" },
      },
    },
  ]);
  
  const summary = {
    plagiarism: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
    review: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
    safe: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
    confirmed: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
    false_positive: { count: 0, avgSimilarity: 0, maxSimilarity: 0 },
  };
  
  results.forEach(r => {
    if (summary[r._id]) {
      summary[r._id] = {
        count: r.count,
        avgSimilarity: Math.round(r.avgSimilarity * 100),
        maxSimilarity: Math.round(r.maxSimilarity * 100),
      };
    }
  });
  
  return summary;
};

export default mongoose.model("PlagiarismResult", plagiarismResultSchema);
