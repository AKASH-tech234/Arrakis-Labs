import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { fileURLToPath } from "url";

import AggregatedStats from "../models/AggregatedStats.js";
import PlatformStats from "../models/PlatformStats.js";
import PublicProfileSettings from "../models/PublicProfileSettings.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function maybeQrPngBuffer(url, includeQr) {
  if (!includeQr || !url) return null;
  try {
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 200 });
    const base64 = dataUrl.split(",")[1];
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

export async function generateProfilePdf({
  userId,
  format = "one_page",
  includeQr = false,
  publicBaseUrl,
}) {
  const user = await User.findById(userId).select("name email profileImage createdAt").lean();
  if (!user) throw new Error("User not found");

  const settings = await PublicProfileSettings.findOne({ userId }).lean();
  const agg = await AggregatedStats.findOne({ userId }).lean();
  const platforms = await PlatformStats.find({ userId }).lean();

  const publicUrl =
    settings?.isPublic && settings?.publicUsername && publicBaseUrl
      ? `${publicBaseUrl.replace(/\/$/, "")}/u/${settings.publicUsername}`
      : null;

  const exportsDir = path.resolve(__dirname, "../../public/exports");
  ensureDir(exportsDir);

  const fileName = `profile_${userId}_${Date.now()}.pdf`;
  const filePath = path.join(exportsDir, fileName);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const title = "Coding Profile";

  doc.fontSize(22).font("Helvetica-Bold").text(title, { align: "left" });
  doc.moveDown(0.2);

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor("#333333")
    .text(`${user.name || "User"} • ${user.email || ""}`);

  doc.moveDown(0.8);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#DDDDDD").stroke();
  doc.moveDown(0.8);

  const combined = {
    solved: agg?.totalSolved ?? 0,
    attempted: agg?.totalAttempted ?? 0,
    contests: agg?.totalContests ?? 0,
    avgPerDay: agg?.avgSolvedPerDay ?? 0,
    rating: agg?.weightedAvgRating ?? "N/A",
    bestPlatform: agg?.bestPlatform ?? "-",
  };

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111").text("Summary");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).fillColor("#333333");

  const lines = [
    `Total solved: ${combined.solved}`,
    `Total attempted: ${combined.attempted}`,
    `Total contests: ${combined.contests}`,
    `Avg solved/day: ${combined.avgPerDay}`,
    `Weighted rating: ${combined.rating}`,
    `Best platform: ${combined.bestPlatform}`,
  ];
  lines.forEach((l) => doc.text(`• ${l}`));

  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(12).text("Difficulty Split");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10);

  const diff = agg?.difficulty || {};
  const easy = diff?.easy?.solved ?? 0;
  const med = diff?.medium?.solved ?? 0;
  const hard = diff?.hard?.solved ?? 0;
  doc.text(`Easy: ${easy}`);
  doc.text(`Medium: ${med}`);
  doc.text(`Hard: ${hard}`);

  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(12).text("Top Skills");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10);

  const skills = Object.entries(agg?.skills || {})
    .map(([name, v]) => ({ name, solved: v.solved || 0, acc: v.accuracy || 0 }))
    .sort((a, b) => b.solved - a.solved)
    .slice(0, 10);

  if (!skills.length) {
    doc.text("No skill data yet.");
  } else {
    skills.forEach((s) => {
      doc.text(`• ${s.name}: ${s.solved} solved (${Number(s.acc).toFixed(1)}% acc)`);
    });
  }

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(12).text("Platforms");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10);

  const platformLines = (platforms || [])
    .filter((p) => p.platform)
    .sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0))
    .slice(0, 8)
    .map((p) => `${p.platform}: solved ${p.totalSolved || 0}, rating ${p.currentRating ?? "-"}`);

  if (!platformLines.length) {
    doc.text("No platform stats yet.");
  } else {
    platformLines.forEach((l) => doc.text(`• ${l}`));
  }

  if (format === "two_page") {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(14).text("Trends (internal)");
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10).text("This page is reserved for charts/trends in a future iteration.");
  }

  // Optional QR
  if (publicUrl) {
    const qrBuf = await maybeQrPngBuffer(publicUrl, includeQr);
    doc.moveDown(1.0);
    doc.font("Helvetica-Bold").fontSize(11).text("Public Profile");
    doc.font("Helvetica").fontSize(10).text(publicUrl);
    if (qrBuf) {
      doc.image(qrBuf, { width: 90, align: "left" });
    }
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return {
    fileName,
    fileUrl: `/exports/${fileName}`,
  };
}
