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
import authRoutes from "./routes/authRoutes.js";
import devRoutes from "./routes/devRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();

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

// ============================================
// CODE EXECUTION (Piston Proxy)
// ============================================

// Map frontend language identifiers to Piston runtime + file extension
const pistonLanguageMap = {
  python: { language: "python", version: "3", filename: "main.py" },
  javascript: { language: "javascript", version: "*", filename: "main.js" },
  java: { language: "java", version: "*", filename: "Main.java" },
  cpp: { language: "cpp", version: "*", filename: "main.cpp" },
};

app.post("/api/execute", async (req, res) => {
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

    // Call Piston API
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
        }),
      },
    );

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
      stdout: run.stdout || "",
      stderr: run.stderr || "",
      output: run.output || "",
      exitCode: run.code ?? -1,
    });
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

app.use("/api/auth", authRoutes);
app.use("/api/dev", devRoutes);

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

    app.listen(PORT, () => {
      console.log(
        `✓ Server running on ${
          process.env.NODE_ENV || "development"
        } mode at http://localhost:${PORT}`,
      );
      console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error(`✗ Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export default app;
