// src/components/charts/ActivityHeatmap.jsx
// GitHub/LeetCode-style activity heatmap with sand-toned colors

const WEEKS = 52;
const DAYS_PER_WEEK = 7;

// Generate mock activity data for the past year
const generateMockData = () => {
  const data = [];
  const today = new Date();

  for (let week = WEEKS - 1; week >= 0; week--) {
    const weekData = [];
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (week * 7 + (6 - day)));

      // Random activity level (0-4)
      const level = Math.random() > 0.6 ? Math.floor(Math.random() * 5) : 0;

      weekData.push({
        date: date.toISOString().split("T")[0],
        level,
      });
    }
    data.push(weekData);
  }
  return data;
};

// Sand-toned color scale
const levelColors = {
  0: "#121210", // Empty - Obsidian
  1: "#1A1814", // Low - Burnt Sand
  2: "#92400E40", // Medium-Low - Ancient Bronze faded
  3: "#92400E80", // Medium-High - Ancient Bronze
  4: "#D97706", // High - Desert Gold
};

const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function ActivityHeatmap() {
  const activityData = generateMockData();

  // Get month positions for labels
  const getMonthPositions = () => {
    const positions = [];
    let currentMonth = -1;

    activityData.forEach((week, weekIndex) => {
      const date = new Date(week[0].date);
      const month = date.getMonth();

      if (month !== currentMonth) {
        positions.push({ month, weekIndex });
        currentMonth = month;
      }
    });

    return positions;
  };

  const monthPositions = getMonthPositions();

  return (
    <div className="w-full overflow-x-auto">
      {/* Month Labels */}
      <div className="flex mb-2 ml-8">
        {monthPositions.map(({ month, weekIndex }, index) => (
          <span
            key={index}
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
            style={{
              fontFamily: "'Rajdhani', system-ui, sans-serif",
              marginLeft:
                index === 0
                  ? `${weekIndex * 12}px`
                  : `${
                      (weekIndex - monthPositions[index - 1].weekIndex - 4) * 12
                    }px`,
            }}
          >
            {monthLabels[month]}
          </span>
        ))}
      </div>

      <div className="flex">
        {/* Day Labels */}
        <div className="flex flex-col gap-[2px] mr-2">
          {dayLabels.map((label, index) => (
            <span
              key={index}
              className="text-[#3D3D3D] text-[10px] uppercase tracking-wider h-[10px] leading-[10px]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Heatmap Grid */}
        <div className="flex gap-[2px]">
          {activityData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[2px]">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className="w-[10px] h-[10px]"
                  style={{ backgroundColor: levelColors[day.level] }}
                  title={`${day.date}: ${day.level} submissions`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Less
        </span>
        <div className="flex gap-[2px]">
          {Object.values(levelColors).map((color, index) => (
            <div
              key={index}
              className="w-[10px] h-[10px]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          More
        </span>
      </div>
    </div>
  );
}
