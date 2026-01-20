// src/components/charts/CategoryChart.jsx
// Simple bar chart showing performance by category

export default function CategoryChart({ categories }) {
  const data = Array.isArray(categories) ? categories : [];
  const maxTotal = Math.max(1, ...data.map((d) => Number(d.total) || 0));

  return (
    <div className="space-y-4">
      {data.map((category) => {
        const solved = Number(category.solved) || 0;
        const total = Number(category.total) || 0;
        const percentage = total > 0 ? (solved / total) * 100 : 0;
        const barWidth = total > 0 ? (total / maxTotal) * 100 : 0;

        return (
          <div key={category.name} className="space-y-1">
            {/* Category Label */}
            <div className="flex items-center justify-between">
              <span
                className="text-[#78716C] text-xs uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {category.name}
              </span>
              <span
                className="text-[#3D3D3D] text-xs"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {solved}/{total}
              </span>
            </div>

            {/* Progress Bar */}
            <div
              className="h-1 bg-[#121210] relative"
              style={{ width: `${barWidth}%` }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#92400E]"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
