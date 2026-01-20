import { useState } from "react";
import { syncPlatformProfile } from "../../services/profileDashboardApi";

const PLATFORM_LABELS = {
  arrakis: "Arrakis",
  leetcode: "LeetCode",
  codeforces: "Codeforces",
  codechef: "CodeChef",
  atcoder: "AtCoder",
  hackerrank: "HackerRank",
  custom: "Custom",
};

export default function PlatformStatsCard({ platformItem, onSynced }) {
  const [syncing, setSyncing] = useState(false);

  const profile = platformItem?.handle ? platformItem : null;
  const stats = platformItem?.stats || null;

  const platformName = PLATFORM_LABELS[platformItem?.platform] || platformItem?.platform;

  const handleSync = async () => {
    if (!platformItem?._id) return;
    setSyncing(true);
    try {
      await syncPlatformProfile(platformItem._id);
      await onSynced?.();
    } catch (e) {
      alert(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[#E8E4D9] font-semibold">{platformName}</div>
          {profile?.handle && (
            <div className="text-[#D97706] text-sm">@{profile.handle}</div>
          )}
          {profile?.profileUrl && (
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#78716C] text-xs hover:text-[#E8E4D9]"
            >
              {profile.profileUrl}
            </a>
          )}
        </div>

        {platformItem?.platform !== "arrakis" && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || platformItem?.isEnabled === false}
            className="px-3 py-2 text-xs rounded-md bg-[#D97706]/10 hover:bg-[#D97706]/20 text-[#D97706] border border-[#D97706]/20 disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Stat label="Solved" value={stats?.totalSolved ?? 0} />
        <Stat label="Attempted" value={stats?.totalAttempted ?? 0} />
        <Stat label="30d" value={stats?.last30DaysSolved ?? 0} />
        <Stat label="Rating" value={stats?.currentRating ?? "-"} />
      </div>

      {platformItem?.lastSyncAt && (
        <div className="text-[#78716C] text-xs mt-3">
          Last sync: {new Date(platformItem.lastSyncAt).toLocaleString()}
        </div>
      )}
      {platformItem?.syncStatus === "error" && platformItem?.lastSyncError && (
        <div className="text-red-300 text-xs mt-2">{platformItem.lastSyncError}</div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[#78716C] text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-[#E8E4D9] font-semibold mt-1">{value}</div>
    </div>
  );
}
