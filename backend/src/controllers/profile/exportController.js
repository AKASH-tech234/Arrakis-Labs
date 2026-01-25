import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

import PublicProfileSettings from "../../models/profile/PublicProfileSettings.js";
import PlatformStats from "../../models/profile/PlatformStats.js";
import { computeAggregatedStats } from "../../services/profile/profileAggregationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeFilenamePart(s) {
  return String(s || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

function drawKeyValue(doc, label, value, { x, y }) {
  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(label, x, y, { continued: true });

  doc
    .fontSize(10)
    .fillColor("#111111")
    .text(` ${value ?? "-"}`);
}

export async function exportProfilePdf(req, res) {
  try {
    const userId = req.user._id;
    const format = req.body?.format === "two_page" ? "two_page" : "one_page";
    const includeQr = !!req.body?.includeQr;

    const [settings, combined, platformStats] = await Promise.all([
      PublicProfileSettings.findOne({ userId }).lean(),
      computeAggregatedStats(userId),
      PlatformStats.find({ userId }).lean(),
    ]);

    const publicUsername = settings?.publicUsername || null;
    const publicProfilePath = publicUsername ? `/u/${encodeURIComponent(publicUsername)}` : null;

    const exportsDir = path.resolve(__dirname, "../../public/exports");
    await fs.promises.mkdir(exportsDir, { recursive: true });

    const baseName = `profile_${safeFilenamePart(userId)}_${Date.now()}.pdf`;
    const filePath = path.join(exportsDir, baseName);

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#111111").text("Arrakis Profile", { align: "left" });
    doc.moveDown(0.25);
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text(`Generated: ${new Date().toLocaleString()}`);

    doc.moveDown(1);

    doc.fontSize(13).fillColor("#111111").text("Summary", { underline: false });
    doc.moveDown(0.5);

    drawKeyValue(doc, "Total solved:", combined?.totalSolved, { x: 48, y: doc.y });
    drawKeyValue(doc, "Total attempted:", combined?.totalAttempted, { x: 48, y: doc.y + 14 });
    drawKeyValue(doc, "Avg solved/day:", combined?.avgSolvedPerDay, { x: 48, y: doc.y + 28 });
    drawKeyValue(doc, "Contests participated:", combined?.totalContests, { x: 48, y: doc.y + 42 });
    drawKeyValue(doc, "Best platform:", combined?.bestPlatform, { x: 48, y: doc.y + 56 });
    drawKeyValue(doc, "Consistency score:", combined?.consistencyScore != null ? `${combined.consistencyScore}%` : null, {
      x: 48,
      y: doc.y + 70,
    });

    doc.moveDown(5);

    doc.fontSize(13).fillColor("#111111").text("Difficulty Split", { underline: false });
    doc.moveDown(0.5);

    const diff = combined?.difficulty || {};
    drawKeyValue(doc, "Easy solved:", diff.easy?.solved ?? 0, { x: 48, y: doc.y });
    drawKeyValue(doc, "Medium solved:", diff.medium?.solved ?? 0, { x: 48, y: doc.y + 14 });
    drawKeyValue(doc, "Hard solved:", diff.hard?.solved ?? 0, { x: 48, y: doc.y + 28 });

    doc.moveDown(4);

    doc.fontSize(13).fillColor("#111111").text("Platform-wise Statistics", { underline: false });
    doc.moveDown(0.5);

    const rows = (platformStats || []).sort((a, b) => String(a.platform).localeCompare(String(b.platform)));
    if (!rows.length) {
      doc.fontSize(10).fillColor("#666666").text("No connected platforms yet.");
    } else {
      for (const p of rows) {
        doc
          .fontSize(11)
          .fillColor("#111111")
          .text(String(p.platform).toUpperCase());

        doc.fontSize(10).fillColor("#666666");
        doc.text(
          `Solved: ${p.totalSolved ?? 0} | Attempted: ${p.totalAttempted ?? 0} | Last 30d: ${p.last30DaysSolved ?? 0} | Avg/day: ${p.avgSolvedPerDay ?? 0}`
        );
        doc.text(
          `Contests: ${p.contestsParticipated ?? 0} | Rating: ${p.currentRating ?? "-"} | Highest: ${p.highestRating ?? "-"} | Last sync: ${p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString() : "-"}`
        );

        const pd = p.difficulty || {};
        doc.text(
          `Difficulty solved (E/M/H): ${pd.easy?.solved ?? 0}/${pd.medium?.solved ?? 0}/${pd.hard?.solved ?? 0}`
        );

        doc.moveDown(0.75);
      }
    }

    if (includeQr && publicProfilePath) {
      doc.moveDown(1);
      doc
        .fontSize(11)
        .fillColor("#111111")
        .text("Public Profile", { underline: false });
      doc
        .fontSize(10)
        .fillColor("#666666")
        .text(`URL: ${publicProfilePath}`);
    }

    if (format === "two_page") {
      doc.addPage();
      doc.fontSize(13).fillColor("#111111").text("Activity Trends", { underline: false });
      doc.moveDown(0.5);

      const weekly = combined?.weeklyTrend || [];
      const monthly = combined?.monthlyTrend || [];

      doc.fontSize(10).fillColor("#666666").text("Weekly (last):");
      for (const w of weekly.slice(-12)) {
        doc.text(`${w.weekStart}: ${w.solved ?? 0}`);
      }

      doc.moveDown(1);
      doc.fontSize(10).fillColor("#666666").text("Monthly (last):");
      for (const m of monthly.slice(-12)) {
        doc.text(`${m.month}: ${m.solved ?? 0}`);
      }
    }

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return res.json({ success: true, data: { fileUrl: `/exports/${baseName}` } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "PDF export failed" });
  }
}
