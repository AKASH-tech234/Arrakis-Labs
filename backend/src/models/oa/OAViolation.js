import mongoose from "mongoose";

const oaViolationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OASession",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "tab_hidden",
        "tab_blur",
        "fullscreen_exit",
        "window_resize",
        "devtools_open",
      ],
      required: true,
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    clientOccurredAt: {
      type: Date,
      default: null,
    },

    meta: {
      visibilityState: String,
      focusedElement: String,
      windowWidth: Number,
      windowHeight: Number,
      userAgent: String,
    },

    wasWarning: {
      type: Boolean,
      default: true,
    },
    warningNumber: {
      type: Number,
      required: true,
    },
    triggeredAction: {
      type: String,
      enum: ["none", "warning_shown", "auto_submit", "terminate"],
      default: "warning_shown",
    },
  },
  { timestamps: true }
);

oaViolationSchema.index({ sessionId: 1, occurredAt: -1 });
oaViolationSchema.index({ userId: 1, createdAt: -1 });

oaViolationSchema.statics.getCountForSession = async function (sessionId) {
  return this.countDocuments({ sessionId });
};

oaViolationSchema.statics.getRecentForSession = async function (
  sessionId,
  limit = 10
) {
  return this.find({ sessionId })
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();
};

export default mongoose.model("OAViolation", oaViolationSchema);
