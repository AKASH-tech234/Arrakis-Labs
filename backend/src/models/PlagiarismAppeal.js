/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM APPEAL MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Schema for plagiarism appeal submissions from users.
 * Tracks appeal status and admin review process.
 */

import mongoose from "mongoose";

const plagiarismAppealSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlagiarismResult",
      required: true,
      index: true,
    },
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "common_solution",
        "known_algorithm",
        "coincidence",
        "template_code",
        "other",
      ],
    },
    explanation: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "under_review"],
      default: "pending",
      index: true,
    },
    decision: {
      type: String,
      enum: ["upheld", "overturned", "partially_overturned", null],
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewNotes: {
      type: String,
      maxlength: 2000,
    },
    penaltyAdjustment: {
      originalPenalty: {
        type: String,
        enum: ["none", "warning", "score_reduction", "disqualification"],
      },
      newPenalty: {
        type: String,
        enum: ["none", "warning", "score_reduction", "disqualification"],
      },
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    notifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
plagiarismAppealSchema.index({ userId: 1, resultId: 1 }, { unique: true });
plagiarismAppealSchema.index({ contestId: 1, status: 1 });

const PlagiarismAppeal = mongoose.model("PlagiarismAppeal", plagiarismAppealSchema);

export default PlagiarismAppeal;
