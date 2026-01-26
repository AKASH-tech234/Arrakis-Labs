import mongoose from "mongoose";

const discussionThreadSchema = new mongoose.Schema(
  {
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["solution", "general"],
      default: "solution",
      index: true,
    },
    title: {
      type: String,
      default: "",
      maxlength: 200,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    solutionPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SolutionPost",
      default: null,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

discussionThreadSchema.index({ problemId: 1, type: 1, createdAt: -1 });

discussionThreadSchema.methods.toPublicResponse = function () {
  return {
    id: this._id,
    problemId: this.problemId,
    type: this.type,
    title: this.title,
    createdBy: this.createdBy,
    solutionPostId: this.solutionPostId,
    messageCount: this.messageCount,
    lastMessageAt: this.lastMessageAt,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("DiscussionThread", discussionThreadSchema);
