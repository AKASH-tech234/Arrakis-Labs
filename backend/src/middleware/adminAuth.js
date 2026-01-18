// backend/src/middleware/adminAuth.js
// Admin authentication and authorization middleware

import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Permission definitions
export const PERMISSIONS = {
  PROBLEMS: {
    CREATE: "problems:create",
    READ: "problems:read",
    UPDATE: "problems:update",
    DELETE: "problems:delete",
    PUBLISH: "problems:publish",
  },
  CONTESTS: {
    CREATE: "contests:create",
    READ: "contests:read",
    UPDATE: "contests:update",
    DELETE: "contests:delete",
    PUBLISH: "contests:publish",
    MANAGE_LIVE: "contests:manage_live",
  },
  USERS: {
    READ: "users:read",
    UPDATE: "users:update",
    BAN: "users:ban",
    MANAGE_ROLES: "users:manage_roles",
  },
  SUBMISSIONS: {
    READ: "submissions:read",
    REJUDGE: "submissions:rejudge",
  },
  PLAGIARISM: {
    READ: "plagiarism:read",
    REVIEW: "plagiarism:review",
    DECIDE: "plagiarism:decide",
  },
  LEADERBOARD: {
    READ: "leaderboard:read",
    FREEZE: "leaderboard:freeze",
    ADJUST: "leaderboard:adjust",
  },
  SYSTEM: {
    READ: "system:read",
    CONFIGURE: "system:configure",
    AUDIT: "system:audit",
  },
};

// Pre-defined role permissions
export const ROLE_PERMISSIONS = {
  super_admin: ["*"], // All permissions
  admin: [
    "problems:*",
    "contests:*",
    "users:read",
    "users:update",
    "submissions:*",
    "plagiarism:*",
    "leaderboard:*",
    "system:read",
  ],
  problem_setter: [
    "problems:create",
    "problems:read",
    "problems:update",
    "submissions:read",
  ],
  moderator: [
    "users:read",
    "users:update",
    "submissions:read",
    "plagiarism:read",
    "plagiarism:review",
  ],
  contest_manager: [
    "contests:*",
    "problems:read",
    "leaderboard:*",
    "submissions:read",
  ],
};

/**
 * Get all permissions for a role
 */
const getPermissionsForRole = (roleName) => {
  const permissions = ROLE_PERMISSIONS[roleName] || [];

  // Expand wildcards
  const expandedPermissions = [];
  for (const perm of permissions) {
    if (perm === "*") {
      // All permissions
      return ["*"];
    }
    if (perm.endsWith(":*")) {
      // All actions for a resource
      const resource = perm.split(":")[0];
      const resourcePerms = PERMISSIONS[resource.toUpperCase()];
      if (resourcePerms) {
        expandedPermissions.push(...Object.values(resourcePerms));
      }
    } else {
      expandedPermissions.push(perm);
    }
  }

  return [...new Set(expandedPermissions)];
};

/**
 * Middleware to verify user is an admin
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user is admin
    if (user.role === "user") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Attach user and permissions to request
    req.adminUser = user;
    req.permissions = getPermissionsForRole(user.role);

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    console.error("Admin auth error:", error);
    res.status(500).json({ message: "Authorization error" });
  }
};

/**
 * Middleware to check specific permissions
 * Usage: requirePermission('problems:create', 'problems:update')
 */
export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.permissions || [];

    // Super admin bypass
    if (userPermissions.includes("*")) {
      return next();
    }

    const hasAllPermissions = requiredPermissions.every((perm) => {
      // Check exact match
      if (userPermissions.includes(perm)) return true;

      // Check wildcard (e.g., 'problems:*' matches 'problems:create')
      const [resource] = perm.split(":");
      return userPermissions.includes(`${resource}:*`);
    });

    if (!hasAllPermissions) {
      return res.status(403).json({
        message: "Insufficient permissions",
        required: requiredPermissions,
        your_permissions: userPermissions,
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has any of the specified permissions
 */
export const requireAnyPermission = (...anyPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.permissions || [];

    // Super admin bypass
    if (userPermissions.includes("*")) {
      return next();
    }

    const hasAnyPermission = anyPermissions.some((perm) => {
      if (userPermissions.includes(perm)) return true;
      const [resource] = perm.split(":");
      return userPermissions.includes(`${resource}:*`);
    });

    if (!hasAnyPermission) {
      return res.status(403).json({
        message: "Insufficient permissions",
        required_any: anyPermissions,
      });
    }

    next();
  };
};

export default {
  requireAdmin,
  requirePermission,
  requireAnyPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};
