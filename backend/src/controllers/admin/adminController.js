import jwt from "jsonwebtoken";
import Admin from "../../models/admin/Admin.js";
import AuditLog from "../../models/admin/AuditLog.js";

const generateAdminToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      isAdmin: true,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRY || "8h" },
  );
};

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
    await admin.save();

    const token = generateAdminToken(admin);

    const cookieOptions = {
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    };

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
      .cookie("adminToken", token, cookieOptions)
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

export const adminLogout = async (req, res) => {
  try {
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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

export const getDashboardStats = async (req, res) => {
  try {
    // Import all required models
    const Question = (await import("../../models/question/Question.js"))
      .default;
    const TestCase = (await import("../../models/question/TestCase.js"))
      .default;
    const Submission = (await import("../../models/profile/Submission.js"))
      .default;
    const User = (await import("../../models/auth/User.js")).default;

    // Fetch all stats in parallel for performance
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

    // Transform difficulty stats to object
    const byDifficulty = difficultyStats.reduce((acc, curr) => {
      if (curr._id) {
        acc[curr._id] = curr.count;
      }
      return acc;
    }, { Easy: 0, Medium: 0, Hard: 0 });

    // Transform submission status stats to object
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

    // Return data in the format frontend expects
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
