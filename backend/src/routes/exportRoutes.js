import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { exportProfilePdf } from "../controllers/exportController.js";

const router = express.Router();

router.post("/pdf", protect, exportProfilePdf);

export default router;
