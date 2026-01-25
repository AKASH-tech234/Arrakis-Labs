import jwt from "jsonwebtoken";
import Admin from "../../models/admin/Admin.js";
import AuditLog from "../../models/admin/AuditLog.js";

/**
 * Generate Admin JWT Token
 */
const generateAdminToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      isAdmin: true, // Flag to distinguish from user tokens
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRY || "8h" } // Shorter expiry for admin
  );
};

/**
 * Admin Login
 * POST /api/admin/login
 */
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find admin by credentials
    const admin = await Admin.findByCredentials(email, password);

    if (!admin) {
      // Log failed attempt
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

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateAdminToken(admin);

    // Cookie options - use unique cookie name and path to avoid conflicts with userToken
    const cookieOptions = {
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    };

    // Log successful login
    await AuditLog.log({
      adminId: admin._id,
      action: "LOGIN",
      resourceType: "Admin",
      details: { success: true },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).cookie("adminToken", token, cookieOptions).json({
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

/**
 * Admin Logout
 * POST /api/admin/logout
 */
export const adminLogout = async (req, res) => {
  try {
    // Clear adminToken cookie with matching options
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // Log logout
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

/**
 * Get Current Admin
 * GET /api/admin/me
 */
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

/**
 * Get Dashboard Stats
 * GET /api/admin/dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Import models here to avoid circular dependencies
    const Question = (await import("../models/Question.js")).default;
    const TestCase = (await import("../models/TestCase.js")).default;
    const Submission = (await import("../models/Submission.js")).default;

    const [
      totalQuestions,
      totalTestCases,
      hiddenTestCases,
      totalSubmissions,
      recentQuestions,
    ] = await Promise.all([
      Question.countDocuments({ isActive: true }),
      TestCase.countDocuments({ isActive: true }),
      TestCase.countDocuments({ isActive: true, isHidden: true }),
      Submission.countDocuments(),
      Question.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title difficulty createdAt"),
    ]);

    // Difficulty distribution
    const difficultyStats = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalQuestions,
        totalTestCases,
        hiddenTestCases,
        visibleTestCases: totalTestCases - hiddenTestCases,
        totalSubmissions,
        difficultyDistribution: difficultyStats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      },
      recentQuestions,
    });
  } catch (error) {
    console.error("[Dashboard Stats Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
};
