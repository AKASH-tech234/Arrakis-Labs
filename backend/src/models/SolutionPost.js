import mongoose from "mongoose";

const solutionPostSchema = new mongoose.Schema(
  {
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
      index: true,
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscussionThread",
      default: null,
      index: true,
    },

    language: {
      type: String,
      required: true,
      enum: ["python", "javascript", "java", "cpp"],
      index: true,
    },
    code: {
      type: String,
      required: true,
      maxlength: 65536,
    },

    explanationMd: {
      type: String,
      default: "",
      maxlength: 20000,
    },
    timeComplexity: {
      type: String,
      default: "",
      maxlength: 256,
    },
    spaceComplexity: {
      type: String,
      default: "",
      maxlength: 256,
    },
    approachTags: {
      type: [String],
      default: [],
    },

    isVerified: {
      type: Boolean,
      default: true,
      index: true,
    },

    votersUp: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    votersDown: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    upvoteCount: {
      type: Number,
      default: 0,
      index: true,
    },
    downvoteCount: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
      index: true,
    },

    commentCount: {
      type: Number,
      default: 0,
      index: true,
    },

    badges: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

solutionPostSchema.index({ problemId: 1, score: -1, createdAt: -1 });
solutionPostSchema.index({ problemId: 1, language: 1, score: -1, createdAt: -1 });
solutionPostSchema.index({ userId: 1, problemId: 1, createdAt: -1 });

solutionPostSchema.methods.toPublicResponse = function ({ viewerUserId } = {}) {
  const viewer = viewerUserId ? viewerUserId.toString() : null;
  const votersUp = Array.isArray(this.votersUp) ? this.votersUp : [];
  const votersDown = Array.isArray(this.votersDown) ? this.votersDown : [];

  const viewerVote = !viewer
    ? 0
    : votersUp.some((id) => id.toString() === viewer)
      ? 1
      : votersDown.some((id) => id.toString() === viewer)
        ? -1
        : 0;

  return {
    id: this._id,
    problemId: this.problemId,
    userId: this.userId,
    threadId: this.threadId,
    submissionId: this.submissionId,
    language: this.language,
    code: this.code,
    explanationMd: this.explanationMd,
    timeComplexity: this.timeComplexity,
    spaceComplexity: this.spaceComplexity,
    approachTags: this.approachTags,
    isVerified: this.isVerified,
    upvoteCount: this.upvoteCount,
    downvoteCount: this.downvoteCount,
    score: this.score,
    commentCount: this.commentCount,
    badges: this.badges,
    viewerVote,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("SolutionPost", solutionPostSchema);
