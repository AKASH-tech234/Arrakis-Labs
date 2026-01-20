import { useState } from "react";
import { updatePublicSettings } from "../../services/profileDashboardApi";

export default function PublicProfileSettingsPanel({ initial, onClose, onSaved }) {
  const [isPublic, setIsPublic] = useState(Boolean(initial?.isPublic));
  const [publicUsername, setPublicUsername] = useState(initial?.publicUsername || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const doc = await updatePublicSettings({ isPublic, publicUsername });
      onSaved?.(doc);
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally {
      setBusy(false);
    }
  };

  const publicUrl = publicUsername ? `${window.location.origin}/u/${publicUsername}` : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0A0A08] border border-[#D97706]/20 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#E8E4D9] font-semibold text-lg">Public Profile</div>
            <div className="text-[#78716C] text-sm mt-1">Shareable URL and visibility</div>
          </div>
          <button className="text-[#78716C] hover:text-[#E8E4D9]" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex items-center gap-3 text-[#E8E4D9]">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Make my profile public
          </label>

          <div>
            <div className="text-[#78716C] text-xs uppercase tracking-wider mb-2">Public Username</div>
            <input
              value={publicUsername}
              onChange={(e) => setPublicUsername(e.target.value)}
              placeholder="e.g. johndoe"
              className="w-full bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
            />
            <div className="text-[#78716C] text-xs mt-2">
              Allowed: a-z, 0-9, _ and - (3-30 chars)
            </div>
          </div>

          {publicUrl && (
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <div className="text-[#78716C] text-xs">Public URL</div>
              <a className="text-[#D97706] text-sm hover:underline" href={publicUrl}>
                {publicUrl}
              </a>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-[#E8E4D9] border border-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
