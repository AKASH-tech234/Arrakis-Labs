import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Flame,
  Calendar as CalendarIcon,
} from "lucide-react";
import { getUserPOTDCalendar } from "../../services/potdApi";

/**
 * POTD Calendar Component
 * Shows user's solved/missed POTD history in a calendar view
 */
export default function POTDCalendar() {
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
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0).toISOString();

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
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(year, month, 1).getDay();
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
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    let bgColor = "bg-gray-800/30";
    let icon = null;
    let textColor = "text-gray-400";

    if (status === "solved") {
      bgColor = "bg-green-500/20 border border-green-500/50";
      icon = <Check className="w-3 h-3 text-green-400" />;
      textColor = "text-green-400";
    } else if (status === "missed") {
      bgColor = "bg-red-500/10 border border-red-500/30";
      icon = <X className="w-3 h-3 text-red-400" />;
      textColor = "text-red-400";
    } else if (status === "active") {
      bgColor = "bg-orange-500/20 border-2 border-orange-500";
      icon = <Flame className="w-3 h-3 text-orange-400" />;
      textColor = "text-orange-400";
    }

    if (isToday && status !== "active") {
      bgColor += " ring-2 ring-blue-500/50";
    }

    return (
      <div
        key={day}
        className={`aspect-square flex flex-col items-center justify-center rounded-lg ${bgColor} transition-all duration-200 hover:scale-105 cursor-pointer`}
        title={status ? `${status.charAt(0).toUpperCase() + status.slice(1)}` : "No POTD"}
      >
        <span className={`text-sm font-medium ${textColor}`}>{day}</span>
        {icon && <div className="mt-1">{icon}</div>}
      </div>
    );
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">POTD Calendar</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <span className="text-white font-medium min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500/50"></div>
          <span className="text-gray-400">Solved</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500/30"></div>
          <span className="text-gray-400">Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500/50"></div>
          <span className="text-gray-400">Active</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before the first of the month */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square"></div>
            ))}

            {/* Actual days */}
            {Array.from({ length: daysInMonth }).map((_, index) => renderDay(index + 1))}
          </div>
        </>
      )}

      {/* Summary */}
      {summary && (
        <div className="mt-6 pt-4 border-t border-gray-700 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">{summary.solvedDays}</div>
            <div className="text-xs text-gray-400">Solved</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{summary.missedDays}</div>
            <div className="text-xs text-gray-400">Missed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{summary.totalDays}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
        </div>
      )}
    </div>
  );
}
