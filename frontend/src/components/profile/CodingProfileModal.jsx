import { useEffect, useMemo, useState } from "react";

const PLATFORMS = [
  { value: "leetcode", label: "LeetCode" },
  { value: "codeforces", label: "Codeforces" },
  { value: "codechef", label: "CodeChef" },
  { value: "atcoder", label: "AtCoder" },
  { value: "hackerrank", label: "HackerRank" },
  { value: "custom", label: "Custom" },
];

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function validateAndExtract({ platform, profileUrl, handle }) {
  const u = safeUrl(profileUrl);
  if (!u) return { ok: false, message: "Enter a valid URL" };
  if (!/^https?:$/.test(u.protocol)) return { ok: false, message: "URL must be http(s)" };

  const host = String(u.hostname || "").toLowerCase();
  const path = String(u.pathname || "");
  const parts = path.split("/").filter(Boolean);

  const hostOk =
    (platform === "leetcode" && host.includes("leetcode.com")) ||
    (platform === "codeforces" && host.includes("codeforces.com")) ||
    (platform === "codechef" && host.includes("codechef.com")) ||
    (platform === "atcoder" && host.includes("atcoder.jp")) ||
    (platform === "hackerrank" && host.includes("hackerrank.com")) ||
    platform === "custom";

  if (!hostOk) return { ok: false, message: "URL does not match selected platform" };

  let inferred = null;
  if (platform === "leetcode") {
    if (parts[0] === "u" && parts[1]) inferred = parts[1];
    else inferred = parts[0] || null;
  } else if (platform === "codeforces") {
    const m = path.match(/^\/profile\/([^\/]+)\/?$/i);
    inferred = m?.[1] || null;
  } else if (platform === "codechef") {
    const m = path.match(/^\/users\/([^\/]+)\/?$/i);
    inferred = m?.[1] || null;
  } else if (platform === "atcoder") {
    const m = path.match(/^\/users\/([^\/]+)\/?$/i);
    inferred = m?.[1] || null;
  } else if (platform === "hackerrank") {
    if (parts[0] === "profile" && parts[1]) inferred = parts[1];
    else inferred = parts[0] || null;
  }

  const finalHandle = String(handle || inferred || "").trim();
  if (!finalHandle) {
    return { ok: false, message: "Could not infer handle from URL. Please enter it." };
  }

  return {
    ok: true,
    handle: finalHandle,
    profileUrl: u.toString(),
  };
}

export default function CodingProfileModal({
  open,
  mode,
  initial,
  existingPlatforms = [],
  onClose,
  onSubmit,
}) {
  const [platform, setPlatform] = useState("leetcode");
  const [profileUrl, setProfileUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);

    if (mode === "edit" && initial) {
      setPlatform(initial.platform);
      setProfileUrl(initial.profileUrl || "");
      setHandle(initial.handle || "");
    } else {
      setPlatform("leetcode");
      setProfileUrl("");
      setHandle("");
    }
  }, [open, mode, initial]);

  const platformOptions = useMemo(() => {
    return PLATFORMS.map((p) => {
      const disabled = mode === "add" && existingPlatforms.includes(p.value);
      return { ...p, disabled };
    });
  }, [existingPlatforms, mode]);

  const validation = useMemo(() => {
    if (!open) return null;
    if (!profileUrl.trim()) return null;
    return validateAndExtract({ platform, profileUrl, handle });
  }, [open, platform, profileUrl, handle]);

  if (!open) return null;

  const showHandle = platform === "custom" || (validation && !validation.ok);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const v = validateAndExtract({ platform, profileUrl, handle });
    if (!v.ok) {
      setError(v.message);
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        id: initial?.id,
        platform,
        profileUrl: v.profileUrl,
        handle: v.handle,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-gradient-to-br from-[#1A1814] to-[#0A0A08] border border-[#D97706]/20 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[#E8E4D9] text-lg font-bold" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              {mode === "edit" ? "Edit Profile" : "Add Profile"}
            </h3>
            <p className="text-sm text-[#78716C] mt-1">Enter a platform profile URL. Data shown comes only from DB.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#78716C] mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Platform
            </label>
            <select
              value={platform}
              disabled={mode === "edit"}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-[#E8E4D9]"
            >
              {platformOptions.map((p) => (
                <option key={p.value} value={p.value} disabled={p.disabled}>
                  {p.label}{p.disabled ? " (already added)" : ""}
                </option>
              ))}
            </select>
            {mode === "edit" ? (
              <p className="text-xs text-[#78716C] mt-1">Platform can’t be changed after adding.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-[#78716C] mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Profile URL
            </label>
            <input
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-[#E8E4D9] placeholder:text-[#78716C]"
            />
            {validation && validation.ok ? (
              <p className="text-xs text-[#78716C] mt-1">Handle: <span className="text-[#E8E4D9]">{validation.handle}</span></p>
            ) : null}
          </div>

          {showHandle ? (
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#78716C] mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                Handle
              </label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-[#E8E4D9] placeholder:text-[#78716C]"
              />
              <p className="text-xs text-[#78716C] mt-1">Required if it can’t be inferred from URL.</p>
            </div>
          ) : null}

          {error ? <div className="text-sm text-red-400">{error}</div> : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold transition-colors disabled:opacity-60"
            >
              {submitting ? "Saving…" : mode === "edit" ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
