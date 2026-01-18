import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Verify Admin JWT Token
 * Middleware to protect admin-only routes
 */
export const verifyAdmin = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.adminToken) {
      token = req.cookies.adminToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's an admin token
    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    // Find admin
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account not found.",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account has been deactivated.",
      });
    }

    // Attach admin to request
    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    console.error("[Admin Auth Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Authentication error.",
    });
  }
};

/**
 * Require Super Admin role
 * Use after verifyAdmin middleware
 */
export const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Super admin privileges required.",
    });
  }
  next();
};

/**
 * Audit logging middleware
 * Logs admin actions for security
 */
export const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to log after successful response
    res.json = async function (data) {
      // Only log successful operations
      if (data?.success !== false && res.statusCode < 400) {
        try {
          await AuditLog.log({
            adminId: req.admin?._id,
            action,
            resourceType,
            resourceId: req.params?.id || data?.data?.id,
            details: {
              method: req.method,
              path: req.originalUrl,
              body: sanitizeLogData(req.body),
            },
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get("User-Agent"),
          });
        } catch (err) {
          console.error("[AuditLog Error]:", err.message);
        }
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Remove sensitive data from audit logs
 */
function sanitizeLogData(data) {
  if (!data) return {};
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = ["password", "token", "secret", "stdin", "expectedStdout"];
  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  });

  return sanitized;
}
