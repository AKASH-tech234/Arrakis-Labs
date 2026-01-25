import express from "express";
import { protect } from "../../middleware/auth/authMiddleware.js";
import { exportProfilePdf } from "../../controllers/profile/exportController.js";

const router = express.Router();

router.post("/pdf", protect, exportProfilePdf);

export default router;
