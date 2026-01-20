import PdfExportLog from "../models/PdfExportLog.js";
import { requireBoolean, safeEnum } from "../utils/validation.js";
import { generateProfilePdf } from "../services/pdfExportService.js";

export async function exportMyProfilePdf(req, res) {
  const format = req.body?.format
    ? safeEnum(req.body.format, "format", ["one_page", "two_page"])
    : "one_page";
  const includeQr =
    req.body?.includeQr === undefined ? false : requireBoolean(req.body.includeQr, "includeQr");

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const publicBaseUrl = `${protocol}://${host}`;

  const log = await PdfExportLog.create({
    userId: req.user._id,
    format,
    includeQr,
    status: "processing",
  });

  try {
    const { fileName, fileUrl } = await generateProfilePdf({
      userId: req.user._id,
      format,
      includeQr,
      publicBaseUrl,
    });

    const absoluteFileUrl = `${publicBaseUrl}${fileUrl}`;

    log.status = "success";
    log.fileName = fileName;
    log.fileUrl = fileUrl;
    await log.save();

    return res.json({ success: true, data: { fileUrl: absoluteFileUrl, fileName } });
  } catch (err) {
    log.status = "failed";
    log.errorMessage = err?.message || "PDF export failed";
    await log.save();

    return res.status(500).json({ success: false, message: log.errorMessage });
  }
}
