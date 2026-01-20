import { useState } from "react";
import { addPlatformProfile } from "../../services/profileDashboardApi";

const PLATFORMS = [
  { value: "leetcode", label: "LeetCode" },
  { value: "codeforces", label: "Codeforces" },
  { value: "codechef", label: "CodeChef" },
  { value: "atcoder", label: "AtCoder" },
  { value: "hackerrank", label: "HackerRank" },
  { value: "custom", label: "Custom" },
];

export default function PlatformConnect({ onSuccess }) {
  const [platform, setPlatform] = useState("leetcode");
  const [handle, setHandle] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addPlatformProfile({ platform, handle, profileUrl });
      setHandle("");
      setProfileUrl("");
      await onSuccess?.();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to add platform");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-black/20 border border-white/10 rounded-xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Handle / Username"
          className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
        />

        <input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="Profile URL"
          className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
        />

        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add Platform"}
        </button>
      </div>
      <div className="text-[#78716C] text-xs mt-2">
        Note: LeetCode + Codeforces auto-sync; others start as manual.
      </div>
    </form>
  );
}
