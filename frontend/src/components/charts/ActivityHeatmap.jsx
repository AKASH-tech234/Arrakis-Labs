// src/components/charts/ActivityHeatmap.jsx
// GitHub/LeetCode-style activity heatmap with sand-toned colors
import { motion } from "framer-motion";

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

// Sand-toned color scale with theme colors
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

  // Get month positions for labels - synced with heatmap grid
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
  const CELL_SIZE = 12; // 10px cell + 2px gap

  return (
    <div className="w-full overflow-x-auto">
      {/* Month Labels - Fixed positioning to align with grid */}
      <div className="flex gap-[2px] mb-3 ml-8 relative h-5">
        {monthPositions.map(({ month, weekIndex }, index) => {
          const nextWeekIndex = monthPositions[index + 1]?.weekIndex || WEEKS;
          const monthWidth = (nextWeekIndex - weekIndex) * CELL_SIZE;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              style={{
                width: monthWidth,
              }}
              className="relative"
            >
              <span
                className="text-[#D97706] text-[11px] font-medium uppercase tracking-wider absolute top-0 left-0"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {monthLabels[month]}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-[2px]">
        {/* Day Labels */}
        <div className="flex flex-col gap-[2px] mr-2 flex-shrink-0">
          {dayLabels.map((label, index) => (
            <span
              key={index}
              className="text-[#78716C] text-[10px] uppercase tracking-wider h-[10px] leading-[10px] font-medium"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Heatmap Grid with Month Separators */}
        <div className="flex gap-[2px] relative">
          {activityData.map((week, weekIndex) => (
            <motion.div
              key={weekIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: weekIndex * 0.01 }}
              className="flex flex-col gap-[2px]"
            >
              {week.map((day, dayIndex) => (
                <motion.div
                  key={dayIndex}
                  className="w-[10px] h-[10px] rounded-sm cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-[#F59E0B] hover:ring-offset-1 hover:ring-offset-[#0A0A08]"
                  style={{ backgroundColor: levelColors[day.level] }}
                  title={`${day.date}: ${day.level} submissions`}
                  whileHover={{ scale: 1.3 }}
                />
              ))}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#D97706]/20"
      >
        <span
          className="text-[#78716C] text-[10px] uppercase tracking-wider font-medium"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Less
        </span>
        <div className="flex gap-[2px]">
          {Object.values(levelColors).map((color, index) => (
            <motion.div
              key={index}
              className="w-[10px] h-[10px] rounded-sm hover:ring-2 hover:ring-[#F59E0B] transition-all"
              style={{ backgroundColor: color }}
              whileHover={{ scale: 1.2 }}
            />
          ))}
        </div>
        <span
          className="text-[#78716C] text-[10px] uppercase tracking-wider font-medium"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          More
        </span>
      </motion.div>
    </div>
  );
}
