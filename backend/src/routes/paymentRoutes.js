import express from "express";
import { protect } from "../middleware/auth/authMiddleware.js";
import { createOAOrder, verifyOAPayment } from "../controllers/payments/oaPaymentController.js";

const router = express.Router();

router.post("/oa/order", protect, createOAOrder);
router.post("/oa/verify", protect, verifyOAPayment);

export default router;
