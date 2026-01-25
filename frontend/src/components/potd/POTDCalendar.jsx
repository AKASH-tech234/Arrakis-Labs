import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { getUserPOTDCalendar } from "../../services/potd/potdApi";

export default function POTDCalendar({ compact = false }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchCalendarData();
  }, [year, month]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
      const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();

      const response = await getUserPOTDCalendar(startDate, endDate);
      if (response.success) {
        setCalendarData(response.data.calendar);
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch calendar:", err);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = useMemo(() => {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }, [year, month]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
  }, [year, month]);

  const calendarMap = useMemo(() => {
    const map = {};
    calendarData.forEach((item) => {
      const date = new Date(item.date);
      const day = date.getUTCDate();
      map[day] = item;
    });
    return map;
  }, [calendarData]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getDayStatus = (day) => {
    const dayData = calendarMap[day];
    if (!dayData) return null;
    return dayData.status;
  };

  const renderDay = (day) => {
    const status = getDayStatus(day);
    const today = new Date();
    const isToday =
      day === today.getUTCDate() &&
      month === today.getUTCMonth() &&
      year === today.getUTCFullYear();

    // Base styles
    let cellBg = "bg-[#0A0A08]";
    let textColor = "text-[#4A4A45]";
    let indicator = null;

    if (status === "solved") {
      cellBg = "bg-green-500/15";
      textColor = "text-green-400";
      indicator = <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400"></div>;
    } else if (status === "missed") {
      cellBg = "bg-red-500/10";
      textColor = "text-red-400/70";
      indicator = <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400"></div>;
    } else if (status === "active") {
      cellBg = "bg-[#D97706]/20";
      textColor = "text-[#D97706]";
      indicator = <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse"></div>;
    }

    const todayRing = isToday ? "ring-1 ring-[#D97706]" : "";
    const cellSize = compact ? "w-7 h-7" : "w-8 h-8";
    const fontSize = compact ? "text-[11px]" : "text-xs";

    return (
      <div
        key={day}
        className={`relative ${cellSize} flex items-center justify-center rounded-lg ${cellBg} ${todayRing} hover:bg-[#1A1814] transition-colors cursor-pointer`}
        title={status ? `${status.charAt(0).toUpperCase() + status.slice(1)}` : "No POTD"}
      >
        <span className={`${fontSize} font-medium ${textColor}`}>{day}</span>
        {indicator}
      </div>
    );
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#D97706]" />
          <h3 
            className="text-sm font-semibold text-[#E8E4D9] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {compact ? "Calendar" : "POTD Calendar"}
          </h3>
        </div>
        <div className="flex items-center gap-0.5 bg-[#0A0A08] rounded-lg p-0.5">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-[#1A1814] rounded-md transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[#78716C]" />
          </button>
          <span className="text-[#E8E4D9] font-medium text-xs min-w-[80px] text-center px-1">
            {monthNames[month].slice(0, 3)} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-[#1A1814] rounded-md transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#1A1814] border-t-[#D97706]"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1">
            {dayNames.map((day, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-medium text-[#4A4A45] py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className={compact ? "w-7 h-7" : "w-8 h-8"}></div>
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, index) => renderDay(index + 1))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[#1A1814]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-[10px] text-[#78716C]">Solved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <span className="text-[10px] text-[#78716C]">Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#D97706]"></div>
          <span className="text-[10px] text-[#78716C]">Today</span>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && !compact && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-[#0A0A08] rounded-lg p-2 text-center">
            <div className="text-base font-bold text-green-400">{summary.solvedDays}</div>
            <div className="text-[9px] text-[#78716C] uppercase">Solved</div>
          </div>
          <div className="bg-[#0A0A08] rounded-lg p-2 text-center">
            <div className="text-base font-bold text-red-400">{summary.missedDays}</div>
            <div className="text-[9px] text-[#78716C] uppercase">Missed</div>
          </div>
          <div className="bg-[#0A0A08] rounded-lg p-2 text-center">
            <div className="text-base font-bold text-[#E8E4D9]">{summary.totalDays}</div>
            <div className="text-[9px] text-[#78716C] uppercase">Total</div>
          </div>
        </div>
      )}
    </div>
  );
}
