const levelColor = {
  Beginner: "text-red-300",
  Intermediate: "text-yellow-300",
  Strong: "text-green-300",
};

export default function SkillBreakdownGrid({ skills }) {
  const entries = Object.entries(skills || {}).map(([name, data]) => ({ name, ...data }));
  entries.sort((a, b) => (b.solved || 0) - (a.solved || 0));

  return (
    <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[#E8E4D9] font-semibold">Skill Breakdown</div>
        <div className="text-[#78716C] text-xs">weak skills are flagged</div>
      </div>

      {entries.length === 0 ? (
        <div className="text-[#78716C] text-sm">No skill data yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entries.map((s) => (
            <div
              key={s.name}
              className={`rounded-lg border p-4 ${s.weak ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-black/20"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[#E8E4D9] font-medium">{s.name}</div>
                  <div className={`text-xs ${levelColor[s.strengthLevel] || "text-[#78716C]"}`}>
                    {s.strengthLevel || "Beginner"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#E8E4D9] font-semibold">{s.solved ?? 0}</div>
                  <div className="text-[#78716C] text-xs">solved</div>
                </div>
              </div>
              <div className="mt-3 text-[#78716C] text-xs">
                Accuracy: <span className="text-[#D97706]">{Number(s.accuracy ?? 0).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
