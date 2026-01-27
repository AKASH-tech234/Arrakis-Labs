/**
 * Reusable PlatformCard component for displaying coding platform stats
 * Used in Coding Profile page
 */
import { ExternalLink } from "lucide-react";

const platformLogos = {
  leetcode: "🟧",
  codeforces: "🔵",
  codechef: "⭐",
  atcoder: "🔷",
  hackerrank: "🟢",
  arrakis: "🏛️",
  custom: "🔗"
};

export default function PlatformCard({ 
  platform, 
  handle, 
  profileUrl, 
  stats = {}, 
  syncStatus,
  lastSyncError,
  onEdit, 
  onSync, 
  onDelete 
}) {
  const logo = platformLogos[platform?.toLowerCase()] || platformLogos.custom;
  
  return (
    <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{logo}</span>
          <div>
            <p 
              className="text-sm font-semibold text-[#E8E4D9]" 
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {platform}
            </p>
            {handle && (
              <p className="text-xs text-[#78716C]">{handle}</p>
            )}
          </div>
        </div>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#78716C] hover:text-[#D97706] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#0A0A08] rounded-lg p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-[#78716C]">Solved</p>
          <p className="text-sm font-bold text-[#E8E4D9]">{stats?.totalSolved ?? "—"}</p>
        </div>
        <div className="bg-[#0A0A08] rounded-lg p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-[#78716C]">Rating</p>
          <p className="text-sm font-bold text-[#E8E4D9]">{stats?.rating ?? "—"}</p>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className={`w-1.5 h-1.5 rounded-full ${
            syncStatus === 'synced' ? 'bg-green-400' : 
            syncStatus === 'pending' ? 'bg-yellow-400' : 
            lastSyncError ? 'bg-red-400' : 'bg-[#78716C]'
          }`}></div>
          <span className="text-[10px] text-[#78716C]">
            {syncStatus}{lastSyncError && ` • ${lastSyncError}`}
          </span>
        </div>
      )}

      {/* Actions */}
      {(onEdit || onSync || onDelete) && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-[#1A1814]">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 px-2 py-1.5 text-[10px] rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
            >
              Edit
            </button>
          )}
          {onSync && (
            <button
              type="button"
              onClick={onSync}
              className="flex-1 px-2 py-1.5 text-[10px] rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
            >
              Sync
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 px-2 py-1.5 text-[10px] rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
