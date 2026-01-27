// Activity Heatmap - GitHub-style contribution calendar
// Fixed: responsive layout, auto-scroll to current week, seamless UI
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const WEEKS = 52;
const DAYS_PER_WEEK = 7;
const CELL_SIZE = 12;
const CELL_GAP = 3;

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
        isToday: key === toIsoDate(today),
      });
    }
    data.push(weekData);
  }

  return { data, maxCount };
}

const levelColors = {
  0: "#121210",
  1: "#1A1814",
  2: "#92400E40",
  3: "#92400E80",
  4: "#D97706",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function ActivityHeatmap({ activity }) {
  const scrollContainerRef = useRef(null);
  const { data: activityData, maxCount } = buildHeatmapData(activity);

  // Calculate total submissions
  const totalSubmissions = (activity || []).reduce((sum, d) => sum + (d.count || 0), 0);

  // Auto-scroll to the right (current week) on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Scroll to the end (current week)
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, []);

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
    <div className="w-full">
      {/* Stats Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-2xl font-bold text-[#D97706]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              {totalSubmissions}
            </span>
            <span className="text-xs text-[#78716C] ml-2">submissions in the last year</span>
          </div>
        </div>
        <div className="text-xs text-[#78716C]">
          {maxCount > 0 && `Max: ${maxCount} in a day`}
        </div>
      </div>

      {/* Scrollable Heatmap Container */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#D97706]/30 scrollbar-track-transparent"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="inline-block min-w-max">
          {/* Month Labels */}
          <div className="flex mb-2 ml-10">
            {monthPositions.map(({ month, weekIndex }, index) => {
              const nextWeekIndex = monthPositions[index + 1]?.weekIndex || WEEKS;
              const monthWidth = (nextWeekIndex - weekIndex) * (CELL_SIZE + CELL_GAP);

              return (
                <div
                  key={index}
                  style={{ width: monthWidth }}
                  className="relative"
                >
                  <span
                    className="text-[#A8A29E] text-[11px] font-medium uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {monthLabels[month]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Heatmap Grid */}
          <div className="flex">
            {/* Day Labels */}
            <div className="flex flex-col mr-2 flex-shrink-0" style={{ gap: `${CELL_GAP}px` }}>
              {dayLabels.map((label, index) => (
                <span
                  key={index}
                  className="text-[#78716C] text-[10px] tracking-wider font-medium flex items-center"
                  style={{ 
                    fontFamily: "'Rajdhani', system-ui, sans-serif",
                    height: `${CELL_SIZE}px`,
                    opacity: index % 2 === 1 ? 1 : 0.5
                  }}
                >
                  {index % 2 === 1 ? label : ''}
                </span>
              ))}
            </div>

            {/* Weeks Grid */}
            <div className="flex" style={{ gap: `${CELL_GAP}px` }}>
              {activityData.map((week, weekIndex) => (
                <motion.div
                  key={weekIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: weekIndex * 0.005 }}
                  className="flex flex-col"
                  style={{ gap: `${CELL_GAP}px` }}
                >
                  {week.map((day, dayIndex) => (
                    <motion.div
                      key={dayIndex}
                      className={`rounded-sm cursor-pointer transition-all duration-200 relative group
                        ${day.isToday ? 'ring-2 ring-[#D97706] ring-offset-1 ring-offset-[#0A0A08]' : ''}
                        hover:ring-2 hover:ring-[#F59E0B] hover:ring-offset-1 hover:ring-offset-[#0A0A08]`}
                      style={{ 
                        backgroundColor: levelColors[day.level],
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                      }}
                      whileHover={{ scale: 1.2 }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                        <div className="bg-[#1A1814] border border-[#D97706]/40 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                          <div className="text-[#E8E4D9] font-medium">
                            {day.count} submission{day.count !== 1 ? 's' : ''}
                          </div>
                          <div className="text-[#78716C]">
                            {new Date(day.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          {day.isToday && <div className="text-[#D97706] text-[10px] mt-1">Today</div>}
                        </div>
                        {/* Tooltip arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1A1814]" />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-center justify-between mt-4 pt-4 border-t border-[#D97706]/20"
      >
        {/* Scroll hint */}
        <span className="text-[#78716C] text-[10px]">
          ← Scroll to see older activity
        </span>

        {/* Legend */}
        <div className="flex items-center gap-2">
          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider font-medium"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Less
          </span>

          <div className="flex" style={{ gap: '3px' }}>
            {Object.values(levelColors).map((color, index) => (
              <motion.div
                key={index}
                className="rounded-sm hover:ring-1 hover:ring-[#F59E0B]"
                style={{ 
                  backgroundColor: color,
                  width: `${CELL_SIZE}px`,
                  height: `${CELL_SIZE}px`,
                }}
                whileHover={{ scale: 1.1 }}
              />
            ))}
          </div>

          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider font-medium"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            More
          </span>
        </div>
      </motion.div>
    </div>
  );
}
