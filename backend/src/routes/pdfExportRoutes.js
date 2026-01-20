import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { exportMyProfilePdf } from "../controllers/pdfExportController.js";

const router = express.Router();

router.post("/pdf", protect, exportMyProfilePdf);

export default router;
