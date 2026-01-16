import express from "express";
import {
  signup,
  signin,
  logout,
  googleAuth,
  githubAuth,
  getMe,
  updateProfile,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/signin", signin);
router.post("/google", googleAuth);
router.post("/github", githubAuth);

// Protected routes
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
