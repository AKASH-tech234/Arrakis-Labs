export default function CombinedStatsCard({ combined }) {
  if (!combined) return null;

  const cards = [
    { label: "Total Solved", value: combined.totalSolved ?? 0 },
    { label: "Total Attempted", value: combined.totalAttempted ?? 0 },
    { label: "Avg / Day", value: combined.avgSolvedPerDay ?? 0 },
    { label: "Contests", value: combined.totalContests ?? 0 },
    { label: "Consistency", value: `${combined.consistencyScore ?? 0}%` },
    { label: "Best Platform", value: combined.bestPlatform ?? "-" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-4"
        >
          <div className="text-[#78716C] text-xs uppercase tracking-wider">{c.label}</div>
          <div className="text-[#E8E4D9] text-2xl font-bold mt-2">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
