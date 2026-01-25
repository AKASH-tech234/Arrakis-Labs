import express from "express";
import { verifyAdmin, requireSuperAdmin, auditLog } from "../../middleware/admin/adminMiddleware.js";
import {
  getAllContests,
  getContestById,
  createContest,
  updateContest,
  deleteContest,
  publishContest,
  cancelContest,
  startContest,
  endContest,
  getRegistrations,
  disqualifyParticipant,
  getContestSubmissions,
  getSubmissionCode,
  sendAnnouncement,
} from "../../controllers/admin/adminContestController.js";

const router = express.Router();

// All routes require admin authentication
router.use(verifyAdmin);

// ==========================================
// CONTEST CRUD
// ==========================================

// Get all contests
router.get("/", getAllContests);

// Get single contest
router.get("/:id", getContestById);

// Create contest
router.post("/", auditLog("CREATE_CONTEST"), createContest);

// Update contest
router.put("/:id", auditLog("UPDATE_CONTEST"), updateContest);

// Delete contest (soft delete)
router.delete("/:id", auditLog("DELETE_CONTEST"), deleteContest);

// ==========================================
// CONTEST LIFECYCLE
// ==========================================

// Publish contest (draft -> scheduled)
router.post("/:id/publish", auditLog("PUBLISH_CONTEST"), publishContest);

// Cancel contest
router.post("/:id/cancel", auditLog("CANCEL_CONTEST"), cancelContest);

// Manually start contest
router.post("/:id/start", auditLog("START_CONTEST"), startContest);

// Manually end contest
router.post("/:id/end", auditLog("END_CONTEST"), endContest);

// ==========================================
// PARTICIPANT MANAGEMENT
// ==========================================

// Get registrations
router.get("/:id/registrations", getRegistrations);

// Disqualify participant
router.post(
  "/:id/disqualify/:userId",
  auditLog("DISQUALIFY_PARTICIPANT"),
  disqualifyParticipant
);

// ==========================================
// SUBMISSIONS
// ==========================================

// Get all submissions for contest
router.get("/:id/submissions", getContestSubmissions);

// Get submission code (admin only)
router.get("/:id/submissions/:submissionId/code", getSubmissionCode);

// ==========================================
// ANNOUNCEMENTS
// ==========================================

// Send announcement
router.post("/:id/announce", auditLog("CONTEST_ANNOUNCEMENT"), sendAnnouncement);

export default router;
