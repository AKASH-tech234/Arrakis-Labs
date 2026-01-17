// src/components/problem/ProblemFilters.jsx
export default function ProblemFilters({
  selectedDifficulty,
  setSelectedDifficulty,
  selectedCategory,
  setSelectedCategory,
  categories,
}) {
  const difficulties = ["All", "Easy", "Medium", "Hard"];

  return (
    <div className="flex flex-wrap items-center gap-6 mb-8">
      {/* Difficulty Filter */}
      <div className="flex items-center gap-3">
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Difficulty
        </span>
        <div className="flex items-center gap-1">
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider transition-colors duration-200 ${
                selectedDifficulty === diff
                  ? "text-[#E8E4D9] bg-[#1A1814]"
                  : "text-[#78716C] hover:text-[#E8E4D9]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-3">
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Category
        </span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-3 py-1.5 text-xs uppercase tracking-wider
                   focus:outline-none focus:border-[#78716C] transition-colors duration-200 appearance-none cursor-pointer"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          <option value="All">All</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
