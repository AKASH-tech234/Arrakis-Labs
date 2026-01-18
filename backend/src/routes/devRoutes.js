// backend/src/routes/devRoutes.js
// Admin authentication with env credentials
import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// Admin login with .env credentials
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get admin credentials from env
    const adminEmail = process.env.ADMIN_MAIL;
    const adminPassword = process.env.ADMIN_PASS;

    if (!adminEmail || !adminPassword) {
      return res
        .status(500)
        .json({ message: "Admin credentials not configured" });
    }

    // Validate credentials
    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    // Generate admin token
    const token = jwt.sign(
      {
        id: "admin_001",
        email: adminEmail,
        name: "Administrator",
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || "7d" },
    );

    res.json({
      status: "success",
      message: "Admin login successful",
      token,
      user: {
        id: "admin_001",
        name: "Administrator",
        email: adminEmail,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify admin token
router.get("/admin-verify", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Not an admin" });
    }

    res.json({
      status: "success",
      user: {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;
