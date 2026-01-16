// src/components/charts/StatsOverview.jsx
// Stats cards showing problems solved, acceptance rate, and streak

const mockStats = {
  problemsSolved: 47,
  totalProblems: 150,
  acceptanceRate: 68.5,
  currentStreak: 12,
  maxStreak: 28,
  easyCount: 22,
  mediumCount: 18,
  hardCount: 7,
};

export default function StatsOverview() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Problems Solved */}
      <div className="border border-[#1A1814] p-4">
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider mb-2"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Solved
        </p>
        <p
          className="text-[#E8E4D9] text-2xl font-light"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockStats.problemsSolved}
          <span className="text-[#3D3D3D] text-sm">
            /{mockStats.totalProblems}
          </span>
        </p>
      </div>

      {/* Acceptance Rate */}
      <div className="border border-[#1A1814] p-4">
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider mb-2"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Acceptance
        </p>
        <p
          className="text-[#E8E4D9] text-2xl font-light"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockStats.acceptanceRate}
          <span className="text-[#3D3D3D] text-sm">%</span>
        </p>
      </div>

      {/* Current Streak */}
      <div className="border border-[#1A1814] p-4">
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider mb-2"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Streak
        </p>
        <p
          className="text-[#D97706] text-2xl font-light"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockStats.currentStreak}
          <span className="text-[#3D3D3D] text-sm"> days</span>
        </p>
      </div>

      {/* Max Streak */}
      <div className="border border-[#1A1814] p-4">
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider mb-2"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Best Streak
        </p>
        <p
          className="text-[#E8E4D9] text-2xl font-light"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockStats.maxStreak}
          <span className="text-[#3D3D3D] text-sm"> days</span>
        </p>
      </div>

      {/* Difficulty Breakdown - spans 2 columns on mobile, full row on desktop */}
      <div className="col-span-2 md:col-span-4 border border-[#1A1814] p-4">
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider mb-4"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          By Difficulty
        </p>
        <div className="flex items-center gap-8">
          {/* Easy */}
          <div className="flex items-center gap-3">
            <span
              className="text-[#78716C] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Easy
            </span>
            <span
              className="text-[#E8E4D9] text-lg"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {mockStats.easyCount}
            </span>
          </div>

          {/* Medium */}
          <div className="flex items-center gap-3">
            <span
              className="text-[#D97706] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Medium
            </span>
            <span
              className="text-[#E8E4D9] text-lg"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {mockStats.mediumCount}
            </span>
          </div>

          {/* Hard */}
          <div className="flex items-center gap-3">
            <span
              className="text-[#92400E] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Hard
            </span>
            <span
              className="text-[#E8E4D9] text-lg"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {mockStats.hardCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
