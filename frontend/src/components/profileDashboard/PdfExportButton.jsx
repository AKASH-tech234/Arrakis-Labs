import { useState } from "react";
import { exportProfilePdf } from "../../services/profileDashboardApi";

export default function PdfExportButton() {
  const [busy, setBusy] = useState(false);

  const exportPdf = async () => {
    setBusy(true);
    try {
      const data = await exportProfilePdf({ format: "one_page", includeQr: false });
      if (data?.fileUrl) {
        window.open(data.fileUrl, "_blank");
      } else {
        alert("PDF generated but no URL returned");
      }
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "PDF export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={exportPdf}
      className="px-4 py-2 text-sm rounded-md bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/20 disabled:opacity-60"
    >
      {busy ? "Exporting…" : "Export PDF"}
    </button>
  );
}
