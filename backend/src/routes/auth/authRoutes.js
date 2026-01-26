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
} from "../../controllers/auth/authController.js";
import { protect } from "../../middleware/auth/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/google", googleAuth);
router.post("/github", githubAuth);

router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
