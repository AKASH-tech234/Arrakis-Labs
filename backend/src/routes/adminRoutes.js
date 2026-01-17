import express from "express";
import { verifyAdmin, requireSuperAdmin, auditLog } from "../middleware/adminMiddleware.js";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  getDashboardStats,
} from "../controllers/adminController.js";
import {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionController.js";
import {
  getTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  toggleHidden,
} from "../controllers/testCaseController.js";
import {
  uploadCSV,
  processCSVUpload,
  previewCSV,
} from "../controllers/csvController.js";

const router = express.Router();

// ==========================================
// PUBLIC ADMIN AUTH ROUTES (no middleware)
// ==========================================
router.post("/login", adminLogin);

// ==========================================
// PROTECTED ADMIN ROUTES (require verifyAdmin)
// ==========================================
router.use(verifyAdmin);

// Admin Profile
router.get("/profile", getAdminProfile);
router.post("/logout", adminLogout);

// Dashboard
router.get("/dashboard", getDashboardStats);

// ==========================================
// QUESTIONS CRUD
// ==========================================
router.get("/questions", getAllQuestions);
router.get("/questions/:id", getQuestionById);
router.post(
  "/questions",
  auditLog("CREATE_QUESTION"),
  createQuestion
);
router.put(
  "/questions/:id",
  auditLog("UPDATE_QUESTION"),
  updateQuestion
);
router.delete(
  "/questions/:id",
  auditLog("DELETE_QUESTION"),
  deleteQuestion
);

// ==========================================
// TEST CASES CRUD
// ==========================================
router.get("/questions/:id/test-cases", getTestCases);
router.post(
  "/questions/:id/test-cases",
  auditLog("CREATE_TEST_CASE"),
  createTestCase
);
router.put(
  "/test-cases/:id",
  auditLog("UPDATE_TEST_CASE"),
  updateTestCase
);
router.delete(
  "/test-cases/:id",
  auditLog("DELETE_TEST_CASE"),
  deleteTestCase
);
router.patch(
  "/test-cases/:id/toggle-hidden",
  auditLog("TOGGLE_HIDDEN"),
  toggleHidden
);

// ==========================================
// CSV UPLOAD (multer middleware inline)
// ==========================================
router.post(
  "/upload-csv",
  uploadCSV,
  auditLog("UPLOAD_CSV"),
  processCSVUpload
);
router.post(
  "/preview-csv",
  uploadCSV,
  previewCSV
);

// ==========================================
// SUPER ADMIN ONLY ROUTES
// ==========================================
// Audit logs are restricted to super admins
router.get(
  "/audit-logs",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const AuditLog = (await import("../models/AuditLog.js")).default;
      
      const {
        page = 1,
        limit = 50,
        action,
        adminId,
        startDate,
        endDate,
      } = req.query;

      const query = {};
      if (action) query.action = action;
      if (adminId) query.adminId = adminId;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate("adminId", "email role")
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("[Audit Logs Error]:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch audit logs",
      });
    }
  }
);

export default router;
