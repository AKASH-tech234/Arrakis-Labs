import express from "express";
import { verifyAdmin, requireSuperAdmin, auditLog } from "../../middleware/admin/adminMiddleware.js";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  getDashboardStats,
} from "../../controllers/admin/adminController.js";
import {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../../controllers/question/questionController.js";
import {
  getTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  toggleHidden,
} from "../../controllers/question/testCaseController.js";
import {
  uploadCSV,
  processCSVUpload,
  previewCSV,
} from "../../controllers/csv/csvController.js";
import {
  listPlatformStats,
  getPlatformStats,
  updatePlatformStats,
  upsertPlatformStats,
  bulkUpsertPlatformStats,
  deletePlatformStats,
} from "../../controllers/admin/adminPlatformStatsController.js";

const router = express.Router();

router.post("/login", adminLogin);

router.use(verifyAdmin);

router.get("/profile", getAdminProfile);
router.post("/logout", adminLogout);

router.get("/dashboard", getDashboardStats);

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

router.get("/platform-stats", listPlatformStats);
router.get("/platform-stats/:id", getPlatformStats);
router.put(
  "/platform-stats/:id",
  auditLog("UPDATE_PLATFORM_STATS"),
  updatePlatformStats
);
router.post(
  "/platform-stats/upsert",
  auditLog("UPSERT_PLATFORM_STATS"),
  upsertPlatformStats
);
router.post(
  "/platform-stats/bulk-upsert",
  auditLog("BULK_UPSERT_PLATFORM_STATS"),
  bulkUpsertPlatformStats
);
router.delete(
  "/platform-stats/:id",
  auditLog("DELETE_PLATFORM_STATS"),
  deletePlatformStats
);

router.get(
  "/audit-logs",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const AuditLog = (await import("../../models/admin/AuditLog.js")).default;
      
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
