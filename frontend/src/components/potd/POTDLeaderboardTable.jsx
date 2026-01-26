import React from "react";
import { Trophy } from "lucide-react";

export default function POTDLeaderboardTable({ rows = [], emptyText = "No leaderboard data." }) {
  if (!rows.length) {
    return (
      <p
        className="text-[#A29A8C] text-sm tracking-wide"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {emptyText}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-[#78716C] text-xs tracking-[0.2em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <th className="text-left py-3">Rank</th>
            <th className="text-left py-3">User</th>
            <th className="text-right py-3">Current</th>
            <th className="text-right py-3">Best</th>
            <th className="text-right py-3">Solved</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.user?._id || r.user?.name || "user"}-${r.rank}`}
              className="border-t border-[#1A1814] hover:bg-[#0A0A08] transition-colors"
            >
              <td className="py-4 text-[#A29A8C] font-mono">#{r.rank}</td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  {r.rank === 1 ? <Trophy className="w-4 h-4 text-yellow-400" /> : null}
                  <span
                    className="text-[#E8E4D9] font-medium tracking-wide"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {r.user?.name || "Unknown"}
                  </span>
                </div>
              </td>
              <td className="py-3 text-right text-[#D97706] font-semibold font-mono">{r.currentStreak}</td>
              <td className="py-3 text-right text-[#E8E4D9] font-mono">{r.maxStreak}</td>
              <td className="py-3 text-right text-[#E8E4D9] font-mono">{r.totalPOTDsSolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
