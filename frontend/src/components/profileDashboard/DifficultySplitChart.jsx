export default function DifficultySplitChart({ difficulty }) {
  const easy = difficulty?.easy?.solved ?? 0;
  const medium = difficulty?.medium?.solved ?? 0;
  const hard = difficulty?.hard?.solved ?? 0;
  const total = easy + medium + hard;

  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-5">
      <div className="text-[#E8E4D9] font-semibold mb-4">Difficulty Split</div>

      <Row label="Easy" value={easy} percent={pct(easy)} color="bg-green-500" />
      <Row label="Medium" value={medium} percent={pct(medium)} color="bg-yellow-500" />
      <Row label="Hard" value={hard} percent={pct(hard)} color="bg-red-500" />
    </div>
  );
}

function Row({ label, value, percent, color }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <div className="text-[#78716C] text-xs uppercase tracking-wider">{label}</div>
        <div className="text-[#E8E4D9] text-sm font-semibold">
          {value} <span className="text-[#78716C] font-normal">({percent}%)</span>
        </div>
      </div>
      <div className="h-2 bg-[#121210] rounded overflow-hidden mt-2">
        <div className={`h-2 ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
