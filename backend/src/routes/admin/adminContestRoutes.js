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

router.use(verifyAdmin);

router.get("/", getAllContests);

router.get("/:id", getContestById);

router.post("/", auditLog("CREATE_CONTEST"), createContest);

router.put("/:id", auditLog("UPDATE_CONTEST"), updateContest);

router.delete("/:id", auditLog("DELETE_CONTEST"), deleteContest);

router.post("/:id/publish", auditLog("PUBLISH_CONTEST"), publishContest);

router.post("/:id/cancel", auditLog("CANCEL_CONTEST"), cancelContest);

router.post("/:id/start", auditLog("START_CONTEST"), startContest);

router.post("/:id/end", auditLog("END_CONTEST"), endContest);

router.get("/:id/registrations", getRegistrations);

router.post(
  "/:id/disqualify/:userId",
  auditLog("DISQUALIFY_PARTICIPANT"),
  disqualifyParticipant
);

router.get("/:id/submissions", getContestSubmissions);

router.get("/:id/submissions/:submissionId/code", getSubmissionCode);

router.post("/:id/announce", auditLog("CONTEST_ANNOUNCEMENT"), sendAnnouncement);

export default router;
