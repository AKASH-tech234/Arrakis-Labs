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

    let bgColor = "bg-[#1A1814]";
    let dotColor = "";
    let textColor = "text-[#78716C]";

    if (status === "solved") {
      bgColor = "bg-green-500/10 border border-green-500/30";
      dotColor = "bg-green-400";
      textColor = "text-green-400";
    } else if (status === "missed") {
      bgColor = "bg-red-500/10 border border-red-500/30";
      dotColor = "bg-red-400";
      textColor = "text-red-400";
    } else if (status === "active") {
      bgColor = "bg-[#D97706]/20 border border-[#D97706]";
      dotColor = "bg-[#D97706]";
      textColor = "text-[#D97706]";
    }

    if (isToday && status !== "active") {
      bgColor += " ring-1 ring-[#D97706]/50";
    }

    const cellSize = compact ? "w-6 h-6" : "aspect-square";
    const fontSize = compact ? "text-[10px]" : "text-xs";

    return (
      <div
        key={day}
        className={`${cellSize} flex flex-col items-center justify-center rounded-md ${bgColor} transition-all duration-200 hover:scale-105 cursor-pointer`}
        title={status ? `${status.charAt(0).toUpperCase() + status.slice(1)}` : "No POTD"}
      >
        <span className={`${fontSize} font-medium ${textColor}`}>{day}</span>
        {dotColor && <div className={`w-1 h-1 rounded-full ${dotColor} mt-0.5`}></div>}
      </div>
    );
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const dayNames = compact 
    ? ["S", "M", "T", "W", "T", "F", "S"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const containerPadding = compact ? "p-3" : "p-4";
  const headerSpacing = compact ? "mb-3" : "mb-4";
  const gridGap = compact ? "gap-1" : "gap-1.5";

  return (
    <div className={`rounded-xl border border-[#1A1814] bg-[#0F0F0D] ${containerPadding}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${headerSpacing}`}>
        <div className="flex items-center gap-2">
          <CalendarIcon className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-[#D97706]`} />
          <h3 
            className={`${compact ? "text-sm" : "text-base"} font-semibold text-[#E8E4D9]`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            POTD Calendar
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-[#1A1814] rounded transition-colors"
          >
            <ChevronLeft className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-[#78716C]`} />
          </button>
          <span className={`text-[#E8E4D9] font-medium ${compact ? "text-xs min-w-[90px]" : "text-sm min-w-[120px]"} text-center`}>
            {compact ? `${monthNames[month].slice(0, 3)} ${year}` : `${monthNames[month]} ${year}`}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-[#1A1814] rounded transition-colors"
          >
            <ChevronRight className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-[#78716C]`} />
          </button>
        </div>
      </div>

      {/* Legend - hide in compact mode */}
      {!compact && (
        <div className="flex items-center gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-[#78716C]">Solved</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400"></div>
            <span className="text-[#78716C]">Missed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#D97706]"></div>
            <span className="text-[#78716C]">Active</span>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {loading ? (
        <div className={`${compact ? "h-32" : "h-48"} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D97706]"></div>
        </div>
      ) : (
        <>
          {/* Day Headers */}
          <div className={`grid grid-cols-7 ${gridGap} mb-1`}>
            {dayNames.map((day, i) => (
              <div
                key={i}
                className={`text-center ${compact ? "text-[9px]" : "text-[10px]"} font-medium text-[#78716C] py-1`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className={`grid grid-cols-7 ${gridGap}`}>
            {/* Empty cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className={compact ? "w-6 h-6" : "aspect-square"}></div>
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, index) => renderDay(index + 1))}
          </div>
        </>
      )}

      {/* Summary - hide in compact mode */}
      {summary && !compact && (
        <div className="mt-4 pt-3 border-t border-[#1A1814] grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-green-400">{summary.solvedDays}</div>
            <div className="text-[10px] text-[#78716C]">Solved</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">{summary.missedDays}</div>
            <div className="text-[10px] text-[#78716C]">Missed</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#E8E4D9]">{summary.totalDays}</div>
            <div className="text-[10px] text-[#78716C]">Total</div>
          </div>
        </div>
      )}
    </div>
  );
}
