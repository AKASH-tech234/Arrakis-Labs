import mongoose from "mongoose";

const pdfExportLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ["one_page", "two_page"],
      default: "one_page",
    },
    includeQr: { type: Boolean, default: false },
    fileName: { type: String, default: null },
    fileUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "generating", "success", "error"],
      default: "pending",
    },
    errorMessage: { type: String, default: null, maxlength: 2000 },
    generatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pdfExportLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("PdfExportLog", pdfExportLogSchema);
