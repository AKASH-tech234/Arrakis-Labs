import jwt from "jsonwebtoken";
import crypto from "crypto";
import Admin from "../../models/admin/Admin.js";
import AuditLog from "../../models/admin/AuditLog.js";

// ─── Token Helpers ───────────────────────────────────────────────────────────

const generateAdminAccessToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      isAdmin: true,
    },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRY || "8h" },
  );
};

const generateAdminRefreshToken = (id) => {
  return jwt.sign({ id, isAdmin: true }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// ─── Cookie Options ──────────────────────────────────────────────────────────

const getAdminAccessCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  };
};

const getAdminRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(
      Date.now() +
        (process.env.REFRESH_TOKEN_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  };
};

// ─── Admin Login ─────────────────────────────────────────────────────────────

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const admin = await Admin.findByCredentials(email, password);

    if (!admin) {
      await AuditLog.log({
        action: "LOGIN",
        resourceType: "Admin",
        details: { email, success: false },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    admin.lastLogin = new Date();

    // Generate tokens
    const accessToken = generateAdminAccessToken(admin);
    const refreshTokenValue = generateAdminRefreshToken(admin._id);

    // Store hashed refresh token (token rotation)
    admin.refreshToken = hashToken(refreshTokenValue);
    await admin.save();

    await AuditLog.log({
      adminId: admin._id,
      action: "LOGIN",
      resourceType: "Admin",
      details: { success: true },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res
      .status(200)
      .cookie("adminToken", accessToken, getAdminAccessCookieOptions())
      .cookie("adminRefreshToken", refreshTokenValue, getAdminRefreshCookieOptions())
      .json({
        success: true,
        message: "Login successful",
        admin: {
          id: admin._id,
          email: admin.email,
          role: admin.role,
          lastLogin: admin.lastLogin,
        },
      });
  } catch (error) {
    console.error("[Admin Login Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

// ─── Admin Refresh Token (Token Rotation) ────────────────────────────────────

export const adminRefreshToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies.adminRefreshToken;

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // Find admin and include the refreshToken field
    const admin = await Admin.findById(decoded.id).select("+refreshToken");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account not found",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      res.clearCookie("adminToken", getAdminAccessCookieOptions());
      res.clearCookie("adminRefreshToken", getAdminRefreshCookieOptions());
      return res.status(403).json({
        success: false,
        message: "Admin account has been deactivated",
      });
    }

    // Verify stored hash matches incoming token (token rotation check)
    const hashedIncoming = hashToken(incomingRefreshToken);
    if (admin.refreshToken !== hashedIncoming) {
      // Possible token reuse attack — invalidate all tokens
      admin.refreshToken = null;
      await admin.save({ validateBeforeSave: false });

      res.clearCookie("adminToken", getAdminAccessCookieOptions());
      res.clearCookie("adminRefreshToken", getAdminRefreshCookieOptions());

      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked. Please login again.",
      });
    }

    // Issue new tokens (rotation)
    const newAccessToken = generateAdminAccessToken(admin);
    const newRefreshToken = generateAdminRefreshToken(admin._id);

    // Store the new hashed refresh token
    admin.refreshToken = hashToken(newRefreshToken);
    await admin.save({ validateBeforeSave: false });

    res
      .status(200)
      .cookie("adminToken", newAccessToken, getAdminAccessCookieOptions())
      .cookie("adminRefreshToken", newRefreshToken, getAdminRefreshCookieOptions())
      .json({
        success: true,
        message: "Token refreshed successfully",
      });
  } catch (error) {
    console.error("[Admin RefreshToken Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
    });
  }
};

// ─── Admin Logout ────────────────────────────────────────────────────────────

export const adminLogout = async (req, res) => {
  try {
    // Clear refresh token from DB
    if (req.admin) {
      await Admin.findByIdAndUpdate(req.admin._id, { refreshToken: null });
    }

    // Clear both cookies
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    res.clearCookie("adminRefreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    await AuditLog.log({
      adminId: req.admin?._id,
      action: "LOGOUT",
      resourceType: "Admin",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("[Admin Logout Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// ─── Get Admin Profile ───────────────────────────────────────────────────────

export const getAdminProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      admin: {
        id: req.admin._id,
        email: req.admin.email,
        role: req.admin.role,
        lastLogin: req.admin.lastLogin,
        createdAt: req.admin.createdAt,
      },
    });
  } catch (error) {
    console.error("[Get Admin Profile Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    });
  }
};

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export const getDashboardStats = async (req, res) => {
  try {

    const Question = (await import("../../models/question/Question.js"))
      .default;
    const TestCase = (await import("../../models/question/TestCase.js"))
      .default;
    const Submission = (await import("../../models/profile/Submission.js"))
      .default;
    const User = (await import("../../models/auth/User.js")).default;

    const [
      totalQuestions,
      totalTestCases,
      hiddenTestCases,
      totalSubmissions,
      totalUsers,
      difficultyStats,
      submissionStatusStats,
    ] = await Promise.all([
      Question.countDocuments({ isActive: true }),
      TestCase.countDocuments({ isActive: true }),
      TestCase.countDocuments({ isActive: true, isHidden: true }),
      Submission.countDocuments(),
      User.countDocuments(),
      Question.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$difficulty", count: { $sum: 1 } } },
      ]),
      Submission.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const byDifficulty = difficultyStats.reduce((acc, curr) => {
      if (curr._id) {
        acc[curr._id] = curr.count;
      }
      return acc;
    }, { Easy: 0, Medium: 0, Hard: 0 });

    const byStatus = submissionStatusStats.reduce((acc, curr) => {
      if (curr._id) {
        acc[curr._id] = curr.count;
      }
      return acc;
    }, {
      accepted: 0,
      wrong_answer: 0,
      time_limit_exceeded: 0,
      memory_limit_exceeded: 0,
      runtime_error: 0,
      compile_error: 0,
      pending: 0,
      running: 0,
      internal_error: 0
    });

    res.status(200).json({
      success: true,
      data: {
        questions: {
          total: totalQuestions,
          byDifficulty,
        },
        testCases: {
          total: totalTestCases,
          hidden: hiddenTestCases,
          visible: totalTestCases - hiddenTestCases,
        },
        submissions: {
          total: totalSubmissions,
          byStatus,
        },
        users: totalUsers,
      },
    });
  } catch (error) {
    console.error("[Dashboard Stats Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
};
