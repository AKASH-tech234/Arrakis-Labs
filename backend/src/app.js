import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import contestRoutes from "./routes/contestRoutes.js";
import adminContestRoutes from "./routes/adminContestRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import potdRoutes from "./routes/potdRoutes.js";
import adminPOTDRoutes from "./routes/adminPOTDRoutes.js";

import {
  runCode,
  submitCode,
  getSubmissions,
  getPublicQuestions,
  getPublicQuestion,
} from "./controllers/judgeController.js";

import {
  requestAIFeedback,
  getAILearningSummary,
  getAIHealth,
} from "./controllers/aiController.js";

import { protect } from "./middleware/authMiddleware.js";
import leaderboardService from "./services/leaderboardService.js";
import wsServer from "./services/websocketServer.js";
import contestScheduler from "./services/contestScheduler.js";
import potdScheduler from "./services/potdScheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const server = createServer(app);

/* ======================================================
   CORS CONFIG (DEFINED ONCE)
====================================================== */

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

const normalizeOrigin = (origin) =>
  origin?.endsWith("/") ? origin.slice(0, -1) : origin;

const isLocalDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizeOrigin(origin));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalized) || isLocalDevOrigin(normalized)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ======================================================
   SECURITY & MIDDLEWARE
====================================================== */

app.use(helmet());
app.use(mongoSanitize());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

/* ======================================================
   RATE LIMITERS
====================================================== */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV !== "production", // Skip in development
});
app.use("/api", apiLimiter);

// Skip auth rate limiting entirely in development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV !== "production", // Skip in development
  message: {
    status: "error",
    message: "Too many authentication attempts. Please try again later.",
  },
});
app.use("/api/auth/signin", authLimiter);
app.use("/api/auth/signup", authLimiter);

const codeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV !== "production", // Skip in development
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

/* ======================================================
   DATABASE
====================================================== */

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");

  console.log("\n" + "=".repeat(80));
  console.log("🔌 Connecting to MongoDB...");
  console.log("   URI:", uri.substring(0, 50) + "...");

  await mongoose.connect(uri);

  console.log("✅ MongoDB Connected Successfully");
  console.log("   Database:", mongoose.connection.db.databaseName);
  console.log("   Host:", mongoose.connection.host);
  console.log("=".repeat(80) + "\n");
};

/* ======================================================
   HEALTH
====================================================== */

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

/* ======================================================
   ROUTES
====================================================== */

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/contests", adminContestRoutes);
app.use("/api/admin/potd", adminPOTDRoutes);
app.use("/api/contests", contestRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/potd", potdRoutes);

// Serve generated exports (PDFs)
app.use(
  "/exports",
  express.static(path.resolve(__dirname, "../public/exports")),
);

app.get("/api/questions", getPublicQuestions);
app.get("/api/questions/:id", getPublicQuestion);

app.post("/api/run", codeLimiter, runCode);
app.post("/api/submit", protect, codeLimiter, submitCode);
app.get("/api/submissions", protect, getSubmissions);

// AI Feedback routes
app.get("/api/ai/health", getAIHealth);
app.post("/api/ai/feedback", protect, requestAIFeedback);
app.post("/api/ai/summary", protect, getAILearningSummary);

/* ======================================================
   ERRORS
====================================================== */

app.use((req, res) =>
  res.status(404).json({ status: "error", message: "Route not found" }),
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

/* ======================================================
   SERVER START
====================================================== */

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });

  wsServer.initialize(server);
  await contestScheduler.initialize();
  await potdScheduler.initialize();

  const shutdown = async () => {
    contestScheduler.shutdown();
    potdScheduler.shutdown();
    wsServer.close();
    await leaderboardService.disconnect();
    server.close(() => mongoose.connection.close());
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();

export default app;
