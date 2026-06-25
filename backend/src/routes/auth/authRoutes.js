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
  refreshToken,
} from "../../controllers/auth/authController.js";
import { protect } from "../../middleware/auth/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/google", googleAuth);
router.post("/github", githubAuth);

// Refresh token endpoint (public — uses refresh token cookie for auth)
router.post("/refresh-token", refreshToken);

router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
