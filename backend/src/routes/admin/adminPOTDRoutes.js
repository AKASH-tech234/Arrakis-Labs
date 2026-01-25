import express from "express";
import { verifyAdmin, requireSuperAdmin, auditLog } from "../../middleware/admin/adminMiddleware.js";
import {
  schedulePOTD,
  getScheduledPOTDs,
  deleteScheduledPOTD,
  getAvailableProblems,
  forcePublishPOTD,
  getPOTDAnalytics,
  getSchedulerStatus,
} from "../../controllers/admin/adminPOTDController.js";

const router = express.Router();

router.use(verifyAdmin);

router.get("/schedule", getScheduledPOTDs);

router.post(
  "/schedule",
  auditLog("SCHEDULE_POTD"),
  schedulePOTD
);

router.delete(
  "/schedule/:id",
  auditLog("DELETE_POTD_SCHEDULE"),
  deleteScheduledPOTD
);

router.get("/available-problems", getAvailableProblems);

router.get("/analytics", getPOTDAnalytics);

router.get("/scheduler-status", getSchedulerStatus);

router.post(
  "/force-publish",
  requireSuperAdmin,
  auditLog("FORCE_PUBLISH_POTD"),
  forcePublishPOTD
);

export default router;
