// src/components/charts/ActivityHeatmap.jsx
// GitHub/LeetCode-style activity heatmap with sand-toned colors
import { motion } from "framer-motion";

const WEEKS = 52;
const DAYS_PER_WEEK = 7;

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toIsoDate(d) {
  return d.toISOString().split("T")[0];
}

function computeLevel(count, maxCount) {
  if (!count) return 0;
  if (!maxCount) return 0;

  const t1 = Math.max(1, Math.ceil(maxCount * 0.25));
  const t2 = Math.max(t1 + 1, Math.ceil(maxCount * 0.5));
  const t3 = Math.max(t2 + 1, Math.ceil(maxCount * 0.75));

  if (count <= t1) return 1;
  if (count <= t2) return 2;
  if (count <= t3) return 3;
  return 4;
}

function buildHeatmapData(activity = []) {
  const map = new Map((activity || []).map((d) => [d.date, Number(d.count) || 0]));
  const maxCount = Math.max(0, ...Array.from(map.values()));

  const data = [];
  const today = startOfUtcDay(new Date());

  for (let week = WEEKS - 1; week >= 0; week--) {
    const weekData = [];
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - (week * 7 + (6 - day)));
      const key = toIsoDate(date);
      const count = map.get(key) || 0;
      weekData.push({
        date: key,
        level: computeLevel(count, maxCount),
        count,
      });
    }
    data.push(weekData);
  }

  return data;
}

// Sand-toned color scale
const levelColors = {
  0: "#121210",
  1: "#1A1814",
  2: "#92400E40",
  3: "#92400E80",
  4: "#D97706",
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

export default function ActivityHeatmap({ activity }) {
  const activityData = buildHeatmapData(activity);

  // Month label positioning
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
  const CELL_SIZE = 12;

  // 🔥 NEW: detect month change for spacing (LeetCode-style)
  const isNewMonth = (weekIndex) => {
    if (weekIndex === 0) return false;

    const prevDate = new Date(activityData[weekIndex - 1][0].date);
    const currDate = new Date(activityData[weekIndex][0].date);

    return prevDate.getMonth() !== currDate.getMonth();
  };

  return (
    <div className="w-full overflow-x-auto">
      {/* Month Labels */}
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
              style={{ width: monthWidth }}
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

        {/* Heatmap Grid */}
        <div className="flex relative">
  {activityData.map((week, weekIndex) => {
    const isMonthStart =
      weekIndex !== 0 &&
      new Date(activityData[weekIndex][0].date).getMonth() !==
        new Date(activityData[weekIndex - 1][0].date).getMonth();

    return (
      <div key={weekIndex} className="flex">
        {/* Month separator */}
        {isMonthStart && <div className="w-[8px]" />}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: weekIndex * 0.01 }}
          className="flex flex-col gap-[2px]"
        >
          {week.map((day, dayIndex) => (
            <motion.div
              key={dayIndex}
              className="w-[10px] h-[10px] rounded-sm cursor-pointer transition-all duration-200
                         hover:ring-2 hover:ring-[#F59E0B]
                         hover:ring-offset-1 hover:ring-offset-[#0A0A08]"
              style={{ backgroundColor: levelColors[day.level] }}
              title={`${day.date}: ${day.count} submissions`}
              whileHover={{ scale: 1.3 }}
            />
          ))}
        </motion.div>
      </div>
    );
  })}
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
              className="w-[10px] h-[10px] rounded-sm hover:ring-2 hover:ring-[#F59E0B]"
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
