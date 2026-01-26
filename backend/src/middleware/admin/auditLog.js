

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    target: {
      type: { type: String },
      id: mongoose.Schema.Types.ObjectId,
    },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    metadata: {
      ip: String,
      userAgent: String,
      reason: String,
    },
  },
  { timestamps: true },
);

auditLogSchema.index({ admin: 1, createdAt: -1 });
auditLogSchema.index({ "target.type": 1, "target.id": 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export const createAuditEntry = async ({
  adminId,
  action,
  targetType,
  targetId,
  before = null,
  after = null,
  reason = null,
  req = null,
}) => {
  try {
    await AuditLog.create({
      admin: adminId,
      action,
      target: {
        type: targetType,
        id: targetId,
      },
      before,
      after,
      metadata: {
        ip: req?.ip || req?.headers?.["x-forwarded-for"] || "unknown",
        userAgent: req?.headers?.["user-agent"] || "unknown",
        reason,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    
  }
};

export const auditLog = (action, getBeforeState = null) => {
  return async (req, res, next) => {
    
    const originalSend = res.send;
    const originalJson = res.json;

    let beforeState = null;
    if (getBeforeState) {
      try {
        beforeState = await getBeforeState(req);
        if (beforeState && beforeState.toObject) {
          beforeState = beforeState.toObject();
        }
      } catch (error) {
        console.error("Error getting before state for audit:", error);
      }
    }

    const targetType = req.baseUrl.split("/").pop() || "unknown";
    const targetId = req.params.id || null;

    const captureResponse = (method) =>
      function (body) {
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let afterState = null;
          try {
            afterState = typeof body === "string" ? JSON.parse(body) : body;
          } catch {
            
          }

          createAuditEntry({
            adminId: req.adminUser?._id,
            action,
            targetType,
            targetId,
            before: beforeState,
            after: afterState,
            reason: req.body?.reason || req.query?.reason,
            req,
          });
        }

        return method.call(this, body);
      };

    res.send = captureResponse(originalSend);
    res.json = captureResponse(originalJson);

    next();
  };
};

export const queryAuditLogs = async ({
  adminId,
  action,
  targetType,
  targetId,
  startDate,
  endDate,
  page = 1,
  limit = 50,
}) => {
  const query = {};

  if (adminId) query.admin = adminId;
  if (action) query.action = { $regex: action, $options: "i" };
  if (targetType) query["target.type"] = targetType;
  if (targetId) query["target.id"] = targetId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("admin", "name email")
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export { AuditLog };

export default {
  createAuditEntry,
  auditLog,
  queryAuditLogs,
  AuditLog,
};
