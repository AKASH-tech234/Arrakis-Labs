import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import axios from "axios";

import PublicProfileSettings from "../../models/profile/PublicProfileSettings.js";
import PlatformStats from "../../models/profile/PlatformStats.js";
import Submission from "../../models/profile/Submission.js";
import User from "../../models/auth/User.js";
import { computeAggregatedStats } from "../../services/profile/profileAggregationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

function safeFilenamePart(s) {
  return String(s || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

// Theme colors matching Arrakis
const COLORS = {
  primary: "#D97706",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  dark: "#111111",
  muted: "#666666",
  light: "#999999",
};

function drawSectionHeader(doc, title, y = null) {
  if (y !== null) {
    doc.y = y;
  }
  doc.fontSize(14).fillColor(COLORS.primary).text(title, { underline: false });
  doc.moveDown(0.4);
  // Draw a subtle line
  const startX = 48;
  const endX = doc.page.width - 48;
  doc.strokeColor(COLORS.primary).lineWidth(0.5).moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawKeyValue(doc, label, value, { x = 48, indent = 0 } = {}) {
  doc.fontSize(10).fillColor(COLORS.muted).text(label, x + indent, doc.y, { continued: true });
  doc.fontSize(10).fillColor(COLORS.dark).text(` ${value ?? "-"}`);
}

function drawProgressBar(doc, label, value, max, color, { x = 48, width = 200 } = {}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barHeight = 8;
  const labelWidth = 80;
  
  // Label
  doc.fontSize(9).fillColor(COLORS.dark).text(label, x, doc.y);
  
  // Progress bar background
  const barX = x + labelWidth;
  const barY = doc.y - 10;
  doc.rect(barX, barY, width, barHeight).fillColor("#E5E5E5").fill();
  
  // Progress bar fill
  const fillWidth = (percentage / 100) * width;
  if (fillWidth > 0) {
    doc.rect(barX, barY, fillWidth, barHeight).fillColor(color).fill();
  }
  
  // Percentage text
  doc.fontSize(9).fillColor(COLORS.dark).text(`${value}/${max} (${Math.round(percentage)}%)`, barX + width + 10, barY + 1);
  doc.moveDown(0.3);
}

async function fetchAIProfile(userId) {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/ai/mim/profile/${userId}`, {
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    console.error("[PDF Export] Failed to fetch AI profile:", err.message);
    return null;
  }
}

export async function exportProfilePdf(req, res) {
  try {
    const userId = req.user._id;
    const format = req.body?.format === "two_page" ? "two_page" : "one_page";
    const includeQr = !!req.body?.includeQr;

    // Fetch all data in parallel
    const [settings, combined, platformStats, user, aiProfile, recentSubmissions] = await Promise.all([
      PublicProfileSettings.findOne({ userId }).lean(),
      computeAggregatedStats(userId),
      PlatformStats.find({ userId }).lean(),
      User.findById(userId).select("name email createdAt stats aiProfile").lean(),
      fetchAIProfile(userId.toString()),
      Submission.find({ userId, isRun: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const publicUsername = settings?.publicUsername || null;
    const publicProfilePath = publicUsername ? `/u/${encodeURIComponent(publicUsername)}` : null;

    // Use path relative to project root to match static middleware in app.js
    const projectRoot = path.resolve(__dirname, "../../../");
    const exportsDir = path.join(projectRoot, "public/exports");
    await fs.promises.mkdir(exportsDir, { recursive: true });

    const baseName = `profile_${safeFilenamePart(userId)}_${Date.now()}.pdf`;
    const filePath = path.join(exportsDir, baseName);
    
    console.log("[PDF Export] Saving to:", filePath);

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ═══════════════════════════════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════════════════════════════
    doc.fontSize(24).fillColor(COLORS.primary).text("ARRAKIS", { align: "left" });
    doc.fontSize(12).fillColor(COLORS.muted).text("Comprehensive Learning Report", { align: "left" });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor(COLORS.light).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown(0.5);

    // User info
    doc.fontSize(16).fillColor(COLORS.dark).text(user?.name || "User");
    if (user?.email) {
      doc.fontSize(10).fillColor(COLORS.muted).text(user.email);
    }
    doc.fontSize(9).fillColor(COLORS.light).text(`Member since: ${user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}`);
    doc.moveDown(1);

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY STATISTICS
    // ═══════════════════════════════════════════════════════════════════════
    drawSectionHeader(doc, "SUMMARY STATISTICS");

    const totalSolved = combined?.totalSolved || 0;
    const totalAttempted = combined?.totalAttempted || 0;
    const acceptanceRate = totalAttempted > 0 ? Math.round((totalSolved / totalAttempted) * 100) : 0;

    drawKeyValue(doc, "Total Problems Solved:", totalSolved);
    drawKeyValue(doc, "Total Attempted:", totalAttempted);
    drawKeyValue(doc, "Acceptance Rate:", `${acceptanceRate}%`);
    drawKeyValue(doc, "Current Streak:", user?.stats?.currentStreak || 0);
    drawKeyValue(doc, "Best Streak:", user?.stats?.bestStreak || 0);
    drawKeyValue(doc, "Contests Participated:", combined?.totalContests || 0);
    doc.moveDown(1);

    // ═══════════════════════════════════════════════════════════════════════
    // DIFFICULTY BREAKDOWN
    // ═══════════════════════════════════════════════════════════════════════
    drawSectionHeader(doc, "DIFFICULTY BREAKDOWN");

    const diff = combined?.difficulty || {};
    const easySolved = diff.easy?.solved ?? 0;
    const mediumSolved = diff.medium?.solved ?? 0;
    const hardSolved = diff.hard?.solved ?? 0;

    drawProgressBar(doc, "Easy", easySolved, 100, COLORS.success);
    drawProgressBar(doc, "Medium", mediumSolved, 200, COLORS.warning);
    drawProgressBar(doc, "Hard", hardSolved, 100, COLORS.error);
    doc.moveDown(1);

    // ═══════════════════════════════════════════════════════════════════════
    // AI COGNITIVE PROFILE
    // ═══════════════════════════════════════════════════════════════════════
    if (aiProfile) {
      drawSectionHeader(doc, "AI COGNITIVE PROFILE");

      const skillLevel = aiProfile.skill_level || aiProfile.current_skill_level || "Beginner";
      const learningTrend = aiProfile.learning_trajectory?.trend || "Stable";
      const successRate = aiProfile.learning_trajectory?.success_rate || 0;

      drawKeyValue(doc, "Skill Level:", skillLevel);
      drawKeyValue(doc, "Learning Trend:", learningTrend);
      drawKeyValue(doc, "Success Rate:", `${Math.round(successRate)}%`);
      doc.moveDown(0.5);

      // Readiness Scores
      const readiness = aiProfile.readiness_scores || {};
      if (Object.keys(readiness).length > 0) {
        doc.fontSize(11).fillColor(COLORS.dark).text("Difficulty Readiness:");
        doc.moveDown(0.3);
        Object.entries(readiness).forEach(([diff, score]) => {
          const percentage = Math.round((typeof score === "number" ? score : 0) * 100);
          drawKeyValue(doc, `  ${diff}:`, `${percentage}% ready`, { indent: 10 });
        });
        doc.moveDown(0.5);
      }

      // Strengths
      const strengths = aiProfile.strengths || [];
      if (strengths.length > 0) {
        doc.fontSize(11).fillColor(COLORS.success).text("[+] Strengths:");
        doc.fontSize(10).fillColor(COLORS.dark).text(`  ${strengths.slice(0, 5).join(", ")}`);
        doc.moveDown(0.3);
      }

      // Weaknesses / Areas to Improve
      const weaknesses = aiProfile.weaknesses || aiProfile.focus_areas || [];
      if (weaknesses.length > 0) {
        doc.fontSize(11).fillColor(COLORS.error).text("[!] Areas to Improve:");
        doc.fontSize(10).fillColor(COLORS.dark).text(`  ${weaknesses.slice(0, 5).join(", ")}`);
        doc.moveDown(0.3);
      }

      // Mistake Patterns
      const mistakeAnalysis = aiProfile.mistake_analysis || {};
      const topMistakes = mistakeAnalysis.top_mistakes || [];
      if (topMistakes.length > 0) {
        doc.fontSize(11).fillColor(COLORS.warning).text("[*] Common Mistake Patterns:");
        const mistakeNames = topMistakes.map(m => typeof m === "string" ? m : m.cause || m.name).slice(0, 5);
        doc.fontSize(10).fillColor(COLORS.dark).text(`  ${mistakeNames.join(", ")}`);
        doc.moveDown(0.3);
      }

      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RECENT ACTIVITY
    // ═══════════════════════════════════════════════════════════════════════
    drawSectionHeader(doc, "RECENT SUBMISSIONS");

    if (recentSubmissions && recentSubmissions.length > 0) {
      const displaySubmissions = recentSubmissions.slice(0, 10);
      
      // Table header
      doc.fontSize(9).fillColor(COLORS.muted);
      const tableY = doc.y;
      doc.text("Date", 48, tableY);
      doc.text("Status", 140, tableY);
      doc.text("Category", 220, tableY);
      doc.text("Difficulty", 320, tableY);
      doc.moveDown(0.5);
      
      // Draw a line under header
      doc.strokeColor(COLORS.light).lineWidth(0.3).moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
      doc.moveDown(0.3);

      displaySubmissions.forEach((sub) => {
        const date = sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "N/A";
        const status = sub.status || "unknown";
        const category = sub.problemCategory || "General";
        const difficulty = sub.problemDifficulty || "Medium";
        
        const statusColor = status === "accepted" ? COLORS.success : 
                           status === "wrong_answer" ? COLORS.error : COLORS.warning;

        doc.fontSize(9);
        const rowY = doc.y;
        doc.fillColor(COLORS.dark).text(date, 48, rowY);
        doc.fillColor(statusColor).text(status.replace(/_/g, " "), 140, rowY);
        doc.fillColor(COLORS.dark).text(category, 220, rowY);
        doc.fillColor(COLORS.dark).text(difficulty, 320, rowY);
        doc.moveDown(0.4);
      });
    } else {
      doc.fontSize(10).fillColor(COLORS.muted).text("No recent submissions.");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 2 - DETAILED STATS (if two_page format)
    // ═══════════════════════════════════════════════════════════════════════
    if (format === "two_page") {
      doc.addPage();

      // Platform Statistics
      drawSectionHeader(doc, "PLATFORM-WISE STATISTICS");

      const rows = (platformStats || []).sort((a, b) => String(a.platform).localeCompare(String(b.platform)));
      if (!rows.length) {
        doc.fontSize(10).fillColor(COLORS.muted).text("No connected platforms yet.");
      } else {
        for (const p of rows) {
          doc.fontSize(12).fillColor(COLORS.primary).text(String(p.platform).toUpperCase());
          doc.fontSize(10).fillColor(COLORS.muted);
          doc.text(`Solved: ${p.totalSolved ?? 0} | Attempted: ${p.totalAttempted ?? 0} | Last 30d: ${p.last30DaysSolved ?? 0}`);
          doc.text(`Contests: ${p.contestsParticipated ?? 0} | Rating: ${p.currentRating ?? "-"} | Highest: ${p.highestRating ?? "-"}`);
          
          const pd = p.difficulty || {};
          doc.text(`Difficulty (E/M/H): ${pd.easy?.solved ?? 0}/${pd.medium?.solved ?? 0}/${pd.hard?.solved ?? 0}`);
          doc.moveDown(0.75);
        }
      }

      doc.moveDown(1);

      // Activity Trends
      drawSectionHeader(doc, "ACTIVITY TRENDS");

      const weekly = combined?.weeklyTrend || [];
      const monthly = combined?.monthlyTrend || [];

      if (weekly.length > 0) {
        doc.fontSize(11).fillColor(COLORS.dark).text("Weekly Activity (last 12 weeks):");
        doc.fontSize(9).fillColor(COLORS.muted);
        const weeklyData = weekly.slice(-12).map(w => `${w.weekStart}: ${w.solved ?? 0}`).join(" | ");
        doc.text(weeklyData);
        doc.moveDown(0.5);
      }

      if (monthly.length > 0) {
        doc.fontSize(11).fillColor(COLORS.dark).text("Monthly Activity (last 12 months):");
        doc.fontSize(9).fillColor(COLORS.muted);
        const monthlyData = monthly.slice(-12).map(m => `${m.month}: ${m.solved ?? 0}`).join(" | ");
        doc.text(monthlyData);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════════════════
    doc.moveDown(2);
    if (includeQr && publicProfilePath) {
      doc.fontSize(10).fillColor(COLORS.dark).text("Public Profile:", { continued: true });
      doc.fillColor(COLORS.primary).text(` ${publicProfilePath}`);
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor(COLORS.light).text("Generated by Arrakis - AI-Powered Learning Platform", { align: "center" });

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // Read the file and send it directly as a download
    const fileBuffer = await fs.promises.readFile(filePath);
    
    // Set headers for file download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`);
    res.setHeader("Content-Length", fileBuffer.length);
    
    // Send the file
    res.send(fileBuffer);
    
    // Optionally clean up the file after sending (uncomment if you don't need to keep files)
    // await fs.promises.unlink(filePath);
    
  } catch (err) {
    console.error("[PDF Export] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "PDF export failed" });
  }
}
