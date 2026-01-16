// src/components/charts/CategoryChart.jsx
// Simple bar chart showing performance by category

const mockCategoryData = [
  { name: "Arrays", solved: 15, total: 30 },
  { name: "Strings", solved: 12, total: 25 },
  { name: "Math", solved: 8, total: 20 },
  { name: "Linked List", solved: 5, total: 15 },
  { name: "Binary Search", solved: 4, total: 12 },
  { name: "Recursion", solved: 3, total: 18 },
];

export default function CategoryChart() {
  const maxTotal = Math.max(...mockCategoryData.map((d) => d.total));

  return (
    <div className="space-y-4">
      {mockCategoryData.map((category) => {
        const percentage = (category.solved / category.total) * 100;
        const barWidth = (category.total / maxTotal) * 100;

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
                {category.solved}/{category.total}
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
