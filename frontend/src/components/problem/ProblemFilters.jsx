
export default function ProblemFilters({
  selectedDifficulty,
  setSelectedDifficulty,
  selectedCategory,
  setSelectedCategory,
  categories,
}) {
  const difficulties = ["All", "Easy", "Medium", "Hard"];

  return (
    <div className="flex flex-wrap items-center gap-6 mb-8 p-5">
      {}
      <div className="flex items-center gap-4">
        <span
          className="text-[#A29A8C] text-xs uppercase tracking-wider font-semibold"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Difficulty
        </span>
        <div className="flex items-center gap-2">
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              className={`px-4 py-2 text-xs uppercase tracking-wider transition-all duration-200 rounded border ${
                selectedDifficulty === diff
                  ? "text-[#0A0A08] bg-[#D97706] border-[#D97706]"
                  : "text-[#A29A8C] hover:text-[#E8E4D9] border-[#666]/30 hover:border-[#D97706]/40"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="flex items-center gap-4">
        <span
          className="text-[#A29A8C] text-xs uppercase tracking-wider font-semibold"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Category
        </span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#0A0A08] border border-[#666]/30 text-[#E8E4D9] px-4 py-2 text-xs uppercase tracking-wider rounded
                   focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-colors duration-200 appearance-none cursor-pointer"
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
