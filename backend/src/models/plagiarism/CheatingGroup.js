/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CHEATING GROUP MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Represents a cluster/ring of users who have been detected as sharing code.
 * Built using Union-Find algorithm from pairwise similarity results.
 * 
 * Example: If User1↔User3 and User3↔User7 are both plagiarism pairs,
 * they form a cheating group {User1, User3, User7}.
 */

import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestRegistration",
    },
    // Number of plagiarism connections this user has within the group
    connectionCount: {
      type: Number,
      default: 1,
    },
    // Average similarity score with other group members
    avgSimilarity: {
      type: Number,
      default: 0,
    },
    // Max similarity score with any group member
    maxSimilarity: {
      type: Number,
      default: 0,
    },
    // Problems where plagiarism was detected for this user
    affectedProblems: [
      {
        problem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
        },
        problemLabel: String,
        similarityScore: Number,
      },
    ],
    // Penalty status for this user
    penaltyStatus: {
      type: String,
      enum: ["pending", "warned", "score_zeroed", "disqualified", "cleared"],
      default: "pending",
    },
    penaltyAppliedAt: Date,
  },
  { _id: false }
);

const cheatingGroupSchema = new mongoose.Schema(
  {
    // Parent references
    plagiarismCheck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlagiarismCheck",
      required: true,
      index: true,
    },
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },

    // Group identifier (auto-generated)
    groupId: {
      type: String,
      required: true,
      unique: true,
    },

    // Members of this cheating group
    members: [groupMemberSchema],

    // Group statistics
    memberCount: {
      type: Number,
      default: 0,
    },
    
    // Total unique plagiarism pairs within this group
    internalPairCount: {
      type: Number,
      default: 0,
    },

    // Average similarity across all pairs in the group
    avgGroupSimilarity: {
      type: Number,
      default: 0,
    },

    // Problems affected by this group
    affectedProblems: [
      {
        problem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
        },
        problemLabel: String,
        pairCount: Number,
        avgSimilarity: Number,
      },
    ],

    // Severity classification
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Review status
    status: {
      type: String,
      enum: ["detected", "under_review", "confirmed", "partially_confirmed", "cleared"],
      default: "detected",
      index: true,
    },

    // Admin actions
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewedAt: Date,
    reviewNotes: String,

    // Bulk penalty action
    penaltyAction: {
      type: String,
      enum: ["none", "warning", "zero_score", "disqualify"],
      default: "none",
    },
    penaltyAppliedAt: Date,
    penaltyAppliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // Evidence references
    plagiarismResults: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PlagiarismResult",
      },
    ],

    // Detection metadata
    detectedAt: {
      type: Date,
      default: Date.now,
    },
    algorithm: {
      type: String,
      default: "union_find",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
cheatingGroupSchema.index({ contest: 1, status: 1 });
cheatingGroupSchema.index({ contest: 1, severity: -1 });
cheatingGroupSchema.index({ "members.user": 1 });

// Pre-save: calculate severity based on group characteristics
cheatingGroupSchema.pre("save", function (next) {
  // Calculate severity
  if (this.memberCount >= 5 || this.avgGroupSimilarity >= 0.95) {
    this.severity = "critical";
  } else if (this.memberCount >= 3 || this.avgGroupSimilarity >= 0.85) {
    this.severity = "high";
  } else if (this.memberCount >= 2 && this.avgGroupSimilarity >= 0.70) {
    this.severity = "medium";
  } else {
    this.severity = "low";
  }
  
  this.memberCount = this.members.length;
  next();
});

// Methods
cheatingGroupSchema.methods.addMember = function (userId, details = {}) {
  const existingMember = this.members.find(
    m => m.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    // Update existing member
    existingMember.connectionCount += 1;
    if (details.similarity) {
      existingMember.maxSimilarity = Math.max(
        existingMember.maxSimilarity,
        details.similarity
      );
    }
  } else {
    // Add new member
    this.members.push({
      user: userId,
      registration: details.registrationId,
      connectionCount: 1,
      avgSimilarity: details.similarity || 0,
      maxSimilarity: details.similarity || 0,
      affectedProblems: details.problem
        ? [
            {
              problem: details.problem,
              problemLabel: details.problemLabel,
              similarityScore: details.similarity,
            },
          ]
        : [],
    });
  }
  
  this.memberCount = this.members.length;
};

cheatingGroupSchema.methods.applyPenalty = async function (action, adminId) {
  const ContestRegistration = mongoose.model("ContestRegistration");
  
  this.penaltyAction = action;
  this.penaltyAppliedAt = new Date();
  this.penaltyAppliedBy = adminId;
  
  for (const member of this.members) {
    if (action === "zero_score") {
      await ContestRegistration.findByIdAndUpdate(member.registration, {
        finalScore: 0,
        problemsSolved: 0,
        $set: { "disqualifiedReason": "Plagiarism detected" },
      });
      member.penaltyStatus = "score_zeroed";
    } else if (action === "disqualify") {
      await ContestRegistration.findByIdAndUpdate(member.registration, {
        status: "disqualified",
        disqualifiedReason: "Plagiarism - Cheating group detected",
        disqualifiedAt: new Date(),
        disqualifiedBy: adminId,
        finalScore: 0,
      });
      member.penaltyStatus = "disqualified";
    } else if (action === "warning") {
      member.penaltyStatus = "warned";
    }
    
    member.penaltyAppliedAt = new Date();
  }
  
  this.status = "confirmed";
  return this.save();
};

// Statics
cheatingGroupSchema.statics.findByContest = function (contestId, options = {}) {
  const query = { contest: contestId };
  
  if (options.status) {
    query.status = options.status;
  }
  if (options.severity) {
    query.severity = options.severity;
  }
  
  return this.find(query)
    .populate("members.user", "name email")
    .sort({ severity: -1, memberCount: -1, avgGroupSimilarity: -1 });
};

cheatingGroupSchema.statics.findGroupsContainingUser = function (contestId, userId) {
  return this.find({
    contest: contestId,
    "members.user": userId,
  })
    .populate("members.user", "name email")
    .sort({ severity: -1 });
};

cheatingGroupSchema.statics.generateGroupId = function (contestId, index) {
  const timestamp = Date.now().toString(36);
  return `CG-${contestId.toString().slice(-6)}-${timestamp}-${index}`;
};

export default mongoose.model("CheatingGroup", cheatingGroupSchema);
