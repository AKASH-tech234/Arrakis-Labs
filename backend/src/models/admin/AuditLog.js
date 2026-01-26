import mongoose from "mongoose";

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
        "CREATE_CONTEST",
        "UPDATE_CONTEST",
        "DELETE_CONTEST",
        "PUBLISH_CONTEST",
        "CANCEL_CONTEST",
        "START_CONTEST",
        "END_CONTEST",
      ],
    },
    resourceType: {
      type: String,
      enum: ["Question", "TestCase", "Admin", "CSV", "Contest"],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    
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

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

auditLogSchema.statics.log = async function (data) {
  try {
    await this.create(data);
  } catch (error) {
    console.error("[AuditLog] Failed to log action:", error.message);
    
  }
};

export default mongoose.model("AuditLog", auditLogSchema);
