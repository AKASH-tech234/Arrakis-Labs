// src/pages/codingPlatforms.jsx
import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/layout/AppHeader";
import {
  addPlatformProfile,
  getMyPlatformProfiles,
  updatePlatformProfile,
} from "../services/profileDashboardApi";

const PLATFORMS = [
  { key: "leetcode", label: "LeetCode", badge: "LC" },
  { key: "codeforces", label: "Codeforces", badge: "CF" },
  { key: "codechef", label: "CodeChef", badge: "CC" },
  { key: "atcoder", label: "AtCoder", badge: "AC" },
  { key: "hackerrank", label: "HackerRank", badge: "HR" },
  { key: "custom", label: "Custom", badge: "CU" },
];

function isValidHttpUrl(value) {
  if (!value) return true; // allow empty
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveHandleFromUrl(platform, url) {
  if (!url) return "";

  let pathname = "";
  try {
    pathname = new URL(url).pathname || "";
  } catch {
    return "";
  }

  const parts = pathname.split("/").filter(Boolean);

  const takeLast = () => (parts.length ? parts[parts.length - 1] : "");

  switch (platform) {
    case "leetcode": {
      const idxU = parts.indexOf("u");
      if (idxU >= 0 && parts[idxU + 1]) return parts[idxU + 1];
      return takeLast();
    }
    case "codeforces": {
      const idx = parts.indexOf("profile");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    case "codechef": {
      const idx = parts.indexOf("users");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    case "atcoder": {
      const idx = parts.indexOf("users");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    case "hackerrank": {
      const idx = parts.indexOf("profile");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    default:
      return "";
  }
}

function normalizeProfiles(profiles) {
  const byPlatform = new Map((profiles || []).map((p) => [p.platform, p]));

  return PLATFORMS.map((p) => {
    const existing = byPlatform.get(p.key);
    return {
      platform: p.key,
      label: p.label,
      badge: p.badge,
      id: existing?._id || null,
      profileUrl: existing?.profileUrl || "",
      handle: existing?.handle || "",
      isEnabled: existing?.isEnabled !== false,
    };
  });
}

export default function CodingPlatformsPage() {
  const [rows, setRows] = useState(() => normalizeProfiles([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const profiles = await getMyPlatformProfiles();
        if (cancelled) return;
        setRows(normalizeProfiles(profiles));
      } catch (e) {
        if (cancelled) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load platforms");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const validationErrors = useMemo(() => {
    const errs = new Map();

    for (const r of rows) {
      if (r.profileUrl && !isValidHttpUrl(r.profileUrl)) {
        errs.set(r.platform, "Invalid URL (must start with http/https)");
        continue;
      }

      if (r.profileUrl && !r.handle) {
        errs.set(
          r.platform,
          r.platform === "custom" ? "Name is required for Custom" : "Handle is required"
        );
      }
    }

    return errs;
  }, [rows]);

  const updateRow = (platform, patch) => {
    setRows((prev) =>
      prev.map((r) => (r.platform === platform ? { ...r, ...patch } : r))
    );
  };

  const handleUrlChange = (platform, value) => {
    const nextUrl = value;
    const current = rows.find((r) => r.platform === platform);

    if (!current) {
      updateRow(platform, { profileUrl: nextUrl });
      return;
    }

    if (platform !== "custom") {
      const derived = deriveHandleFromUrl(platform, nextUrl);
      updateRow(platform, {
        profileUrl: nextUrl,
        handle: derived || current.handle,
      });
    } else {
      updateRow(platform, { profileUrl: nextUrl });
    }
  };

  const handleRemove = (platform) => {
    updateRow(platform, { profileUrl: "", handle: "", isEnabled: false });
  };

  const save = async () => {
    if (validationErrors.size) {
      setError("Please fix validation errors before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      for (const r of rows) {
        const wantsConnected = Boolean(r.profileUrl);

        if (r.id) {
          // Update existing (supports clearing fields to "remove")
          await updatePlatformProfile(r.id, {
            profileUrl: wantsConnected ? r.profileUrl : "",
            handle: wantsConnected ? r.handle : "",
            isEnabled: wantsConnected ? r.isEnabled : false,
          });
          continue;
        }

        if (!wantsConnected) continue;

        // Create new
        const created = await addPlatformProfile({
          platform: r.platform,
          profileUrl: r.profileUrl,
          handle: r.handle,
        });

        // If user toggled disabled before saving, reflect that explicitly
        if (created?._id && r.isEnabled === false) {
          await updatePlatformProfile(created._id, { isEnabled: false });
        }
      }

      const profiles = await getMyPlatformProfiles();
      setRows(normalizeProfiles(profiles));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h1
              className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Coding Platforms
            </h1>

            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="px-4 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          {loading && <div className="text-[#78716C] text-sm">Loading…</div>}
          {!loading && error && <div className="text-red-300 text-sm mb-4">{error}</div>}

          <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl overflow-hidden">
            <div className="divide-y divide-white/10">
              {rows.map((r) => {
                const connected = Boolean(r.profileUrl) && r.isEnabled;
                const rowError = validationErrors.get(r.platform);

                return (
                  <div key={r.platform} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg border border-white/10 bg-black/20 flex items-center justify-center text-[#E8E4D9] text-xs">
                          {r.badge}
                        </div>
                        <div>
                          <div className="text-[#E8E4D9] font-semibold">{r.label}</div>
                          <div className="text-[#78716C] text-xs mt-0.5">
                            Status: {connected ? "Connected" : "Not connected"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateRow(r.platform, { isEnabled: !r.isEnabled })}
                          className="px-3 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                          disabled={!r.profileUrl && !r.id}
                          title={!r.profileUrl && !r.id ? "Add a URL first" : "Toggle enabled"}
                        >
                          {r.isEnabled ? "Enabled" : "Disabled"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(r.platform)}
                          className="px-3 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      {r.platform === "custom" ? (
                        <input
                          value={r.handle}
                          onChange={(e) => updateRow(r.platform, { handle: e.target.value })}
                          placeholder="Platform name"
                          className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
                        />
                      ) : (
                        <input
                          value={r.handle}
                          onChange={(e) => updateRow(r.platform, { handle: e.target.value })}
                          placeholder="Handle / Username"
                          className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
                        />
                      )}

                      <input
                        value={r.profileUrl}
                        onChange={(e) => handleUrlChange(r.platform, e.target.value)}
                        placeholder="Profile URL"
                        className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9] md:col-span-2"
                      />
                    </div>

                    {r.profileUrl && isValidHttpUrl(r.profileUrl) && (
                      <div className="mt-2">
                        <a
                          href={r.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#78716C] text-xs hover:text-[#E8E4D9]"
                        >
                          {r.profileUrl}
                        </a>
                      </div>
                    )}

                    {rowError && <div className="text-red-300 text-xs mt-2">{rowError}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
