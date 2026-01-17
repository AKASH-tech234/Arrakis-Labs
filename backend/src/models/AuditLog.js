import mongoose from "mongoose";

/**
 * AuditLog Schema
 * Tracks all admin actions for security and debugging
 */
const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "LOGOUT",
        "CREATE_QUESTION",
        "UPDATE_QUESTION",
        "DELETE_QUESTION",
        "CREATE_TEST_CASE",
        "UPDATE_TEST_CASE",
        "DELETE_TEST_CASE",
        "UPLOAD_CSV",
        "TOGGLE_HIDDEN",
      ],
    },
    resourceType: {
      type: String,
      enum: ["Question", "TestCase", "Admin", "CSV"],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    // Store relevant details (but NEVER hidden test case content)
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Request metadata
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Static method to log admin action
auditLogSchema.statics.log = async function (data) {
  try {
    await this.create(data);
  } catch (error) {
    console.error("[AuditLog] Failed to log action:", error.message);
    // Don't throw - audit logging should not break main flow
  }
};

export default mongoose.model("AuditLog", auditLogSchema);
