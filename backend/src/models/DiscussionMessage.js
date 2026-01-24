import mongoose from "mongoose";

const discussionMessageSchema = new mongoose.Schema(
  {
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscussionThread",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscussionMessage",
      default: null,
      index: true,
    },
    bodyMd: {
      type: String,
      required: true,
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

discussionMessageSchema.index({ threadId: 1, createdAt: 1 });

discussionMessageSchema.methods.toPublicResponse = function () {
  return {
    id: this._id,
    problemId: this.problemId,
    threadId: this.threadId,
    userId: this.userId,
    parentMessageId: this.parentMessageId,
    bodyMd: this.bodyMd,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("DiscussionMessage", discussionMessageSchema);
