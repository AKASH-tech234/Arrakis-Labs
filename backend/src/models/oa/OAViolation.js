import mongoose from "mongoose";

/**
 * OA Violation Schema
 * Logs proctoring violations (tab switches, etc.)
 */
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

    // === VIOLATION TYPE ===
    type: {
      type: String,
      enum: [
        "tab_hidden", // document.visibilityState = 'hidden'
        "tab_blur", // window.blur
        "fullscreen_exit", // Exited fullscreen (if enabled)
        "window_resize", // Suspicious resize
        "devtools_open", // DevTools detected (optional)
      ],
      required: true,
    },

    // === TIMESTAMPS ===
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    clientOccurredAt: {
      type: Date,
      default: null,
    },

    // === CONTEXT ===
    meta: {
      visibilityState: String,
      focusedElement: String,
      windowWidth: Number,
      windowHeight: Number,
      userAgent: String,
    },

    // === OUTCOME ===
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

// Indexes
oaViolationSchema.index({ sessionId: 1, occurredAt: -1 });
oaViolationSchema.index({ userId: 1, createdAt: -1 });

// Get violations count for session
oaViolationSchema.statics.getCountForSession = async function (sessionId) {
  return this.countDocuments({ sessionId });
};

// Get recent violations
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
