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
import {
  runCode,
  submitCode,
  getSubmissions,
  getPublicQuestions,
  getPublicQuestion,
} from "./controllers/judgeController.js";
import { protect } from "./middleware/authMiddleware.js";
import leaderboardService from "./services/leaderboardService.js";
import wsServer from "./services/websocketServer.js";
import contestScheduler from "./services/contestScheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();

// CORS must run before anything that can short-circuit requests (e.g. rate limiters),
// otherwise browsers will fail preflight with missing Access-Control-Allow-Origin.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

const normalizeOrigin = (origin) => {
  if (!origin || typeof origin !== "string") return origin;
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
};

const isLocalDevOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin / non-browser clients (no Origin header)
    if (!origin) return callback(null, true);

    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized) || isLocalDevOrigin(normalized)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(helmet());

app.use(mongoSanitize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Stricter rate limit for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/signin", authLimiter);
app.use("/api/auth/signup", authLimiter);

// Stricter rate limit for admin login
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per window for admin
  message: "Too many admin login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/admin/login", adminAuthLimiter);

// Rate limiter for code execution (prevent abuse of Piston API)
const codeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // Max 20 executions per minute
  message: {
    status: "error",
    message: "Too many code executions. Please wait before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?._id?.toString() || req.ip;
  },
});

app.use(express.json({ limit: "10kb" }));

app.use(express.urlencoded({ limit: "10kb", extended: true }));

app.use(cookieParser());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin / non-browser clients (no Origin header)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// AI Service health check endpoint
app.get("/api/ai/health", async (req, res) => {
  try {
    const AI_SERVICE_URL =
      process.env.AI_SERVICE_URL || "http://localhost:8000";
    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      method: "GET",
      timeout: 5000,
    });
    const data = await response.json();

    res.status(200).json({
      status: "success",
      aiService: {
        status: data.status,
        url: AI_SERVICE_URL,
      },
    });
  } catch (error) {
    res.status(200).json({
      status: "success",
      aiService: {
        status: "unavailable",
        error: error.message,
      },
    });
  }
});

// ============================================
// CODE EXECUTION (Piston Proxy) - Direct editor testing
// ============================================

// Map frontend language identifiers to Piston runtime + file extension
const pistonLanguageMap = {
  python: { language: "python", version: "3", filename: "main.py" },
  javascript: { language: "javascript", version: "*", filename: "main.js" },
  java: { language: "java", version: "*", filename: "Main.java" },
  cpp: { language: "cpp", version: "*", filename: "main.cpp" },
};

// Direct Piston proxy for editor (rate limited)
app.post("/api/execute", codeLimiter, async (req, res) => {
  try {
    const { code, language, stdin = "" } = req.body;

    // Validate required fields
    if (!code || typeof code !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid 'code' field",
      });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid 'language' field",
      });
    }

    // Validate code size (limit to 64KB)
    if (code.length > 65536) {
      return res.status(400).json({
        status: "error",
        message: "Code exceeds maximum size (64KB)",
      });
    }

    const langConfig = pistonLanguageMap[language.toLowerCase()];
    if (!langConfig) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported language: ${language}. Supported: ${Object.keys(pistonLanguageMap).join(", ")}`,
      });
    }

    // Call Piston API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const pistonResponse = await fetch(
        "https://emkc.org/api/v2/piston/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: langConfig.language,
            version: langConfig.version,
            files: [{ name: langConfig.filename, content: code }],
            stdin: stdin || "",
            run_timeout: 10000, // 10s execution limit
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!pistonResponse.ok) {
        const errorText = await pistonResponse.text();
        console.error(
          `Piston API error: ${pistonResponse.status} - ${errorText}`,
        );
        return res.status(502).json({
          status: "error",
          message: "Code execution service unavailable",
        });
      }

      const pistonData = await pistonResponse.json();

      // Normalize response
      const run = pistonData.run || {};
      res.json({
        stdout: (run.stdout || "").slice(0, 100000), // Limit output to 100KB
        stderr: (run.stderr || "").slice(0, 10000),
        output: (run.output || "").slice(0, 100000),
        exitCode: run.code ?? -1,
        timedOut: run.signal === "SIGKILL",
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === "AbortError") {
        return res.status(504).json({
          status: "error",
          message: "Code execution timed out",
        });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Execute endpoint error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error during code execution",
    });
  }
});

// ============================================
// ROUTES
// ============================================

// Auth routes
app.use("/api/auth", authRoutes);

// Admin routes (separate admin panel)
app.use("/api/admin", adminRoutes);

// Admin contest routes
app.use("/api/admin/contests", adminContestRoutes);

// Contest routes (public + protected)
app.use("/api/contests", contestRoutes);

// Public question routes (for users)
app.get("/api/questions", getPublicQuestions);
app.get("/api/questions/:id", getPublicQuestion);

// Judge routes (run/submit code) - with rate limiting
app.post("/api/run", codeLimiter, runCode); // Run with visible test cases only + rate limited
app.post("/api/submit", protect, codeLimiter, submitCode); // Submit requires auth + rate limited
app.get("/api/submissions", protect, getSubmissions); // User submissions

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[ERROR] ${status} - ${message}`);

  res.status(status).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `✓ Server running on ${
          process.env.NODE_ENV || "development"
        } mode at http://localhost:${PORT}`
      );
      console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `✗ Port ${PORT} is already in use. Stop the other process or set PORT in backend/.env (e.g. PORT=5001).`,
        );
        process.exit(1);
      }

      console.error(`✗ Server listen error: ${err.message}`);
      process.exit(1);
    });

    // Initialize WebSocket server
    wsServer.initialize(server);

    // Initialize contest scheduler
    await contestScheduler.initialize();

    server.listen(PORT, () => {
      console.log(
        `✓ Server running on ${
          process.env.NODE_ENV || "development"
        } mode at http://localhost:${PORT}`
      );
      console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
      console.log(`✓ WebSocket: ws://localhost:${PORT}/ws/contest`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      
      contestScheduler.shutdown();
      wsServer.close();
      await leaderboardService.disconnect();
      
      server.close(() => {
        console.log("✓ HTTP server closed");
        mongoose.connection.close(false, () => {
          console.log("✓ MongoDB connection closed");
          process.exit(0);
        });
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  } catch (error) {
    console.error(`✗ Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export default app;
