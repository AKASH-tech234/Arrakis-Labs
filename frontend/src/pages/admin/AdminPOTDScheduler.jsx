import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  Clock,
  Lock,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  getScheduledPOTDs,
  getAvailableProblems,
  schedulePOTD,
  deleteScheduledPOTD,
  forcePublishPOTD,
  getSchedulerStatus,
} from "../../services/potd/potdApi";

export default function AdminPOTDScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchSchedules();
    fetchSchedulerStatus();
  }, [year, month]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await getScheduledPOTDs({ month: month + 1, year });
      if (response.success) {
        setSchedules(response.data.schedules);
      }
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await getSchedulerStatus();
      if (response.success) {
        setSchedulerStatus(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch scheduler status:", err);
    }
  };

  const fetchProblems = async () => {
    try {
      setProblemsLoading(true);
      const response = await getAvailableProblems({
        search: searchQuery,
        difficulty: difficultyFilter,
        limit: 50,
      });
      if (response.success) {
        setProblems(response.data.problems);
      }
    } catch (err) {
      console.error("Failed to fetch problems:", err);
    } finally {
      setProblemsLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      fetchProblems();
    }
  }, [showModal, searchQuery, difficultyFilter]);

  const daysInMonth = useMemo(() => {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }, [year, month]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
  }, [year, month]);

  const scheduleMap = useMemo(() => {
    const map = {};
    schedules.forEach((schedule) => {
      const date = new Date(schedule.scheduledDate);
      const day = date.getUTCDate();
      map[day] = schedule;
    });
    return map;
  }, [schedules]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day) => {
    const clickedDate = new Date(Date.UTC(year, month, day));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (clickedDate < today) {
      return; 
    }

    const existingSchedule = scheduleMap[day];
    if (existingSchedule?.isLocked) {
      return; 
    }

    setSelectedDate(clickedDate);
    setSelectedProblem(existingSchedule?.problem || null);
    setScheduleNotes(existingSchedule?.notes || "");
    setShowModal(true);
  };

  const handleSchedule = async () => {
    if (!selectedProblem || !selectedDate) return;

    try {
      setSaving(true);
      const response = await schedulePOTD(
        selectedProblem._id,
        selectedDate.toISOString(),
        scheduleNotes
      );

      if (response.success) {
        setShowModal(false);
        fetchSchedules();

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const schedDate = new Date(selectedDate);
        schedDate.setUTCHours(0, 0, 0, 0);
        
        if (schedDate.getTime() === today.getTime()) {
          alert("✅ POTD scheduled and published for today! It's now visible on the problems page.");
        } else {
          alert("✅ POTD scheduled successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to schedule POTD:", err);
      alert(err.response?.data?.message || "Failed to schedule POTD");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!confirm("Are you sure you want to remove this scheduled POTD?")) {
      return;
    }

    try {
      await deleteScheduledPOTD(scheduleId);
      fetchSchedules();
    } catch (err) {
      console.error("Failed to delete schedule:", err);
      alert(err.response?.data?.message || "Failed to delete schedule");
    }
  };

  const handleForcePublish = async () => {
    if (
      !confirm(
        "Are you sure you want to force publish today's POTD? This should only be used if the automatic cron job failed."
      )
    ) {
      return;
    }

    try {
      await forcePublishPOTD();
      alert("POTD published successfully!");
      fetchSchedules();
      fetchSchedulerStatus();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to force publish");
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "Easy":
        return "text-[#78716C] bg-[#78716C]/10 border border-[#78716C]/30";
      case "Medium":
        return "text-[#D97706] bg-[#D97706]/10 border border-[#D97706]/30";
      case "Hard":
        return "text-[#92400E] bg-[#92400E]/10 border border-[#92400E]/30";
      default:
        return "text-[#78716C] bg-[#78716C]/10 border border-[#78716C]/30";
    }
  };

  const renderDay = (day) => {
    const schedule = scheduleMap[day];
    const today = new Date();
    const cellDate = new Date(Date.UTC(year, month, day));
    today.setUTCHours(0, 0, 0, 0);

    const isToday = cellDate.getTime() === today.getTime();
    const isPast = cellDate < today;
    const isLocked = schedule?.isLocked;

    let bgColor = "bg-[#0F0F0D] hover:bg-[#1A1814]/70 cursor-pointer border-[#1A1814]";
    let statusIcon = null;

    if (schedule) {
      if (schedule.status === "published") {
        bgColor = "bg-emerald-500/10 border-emerald-500/40";
        statusIcon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
      } else if (schedule.status === "today") {
        bgColor = "bg-[#D97706]/10 border-[#D97706]/40";
        statusIcon = <Clock className="w-4 h-4 text-[#D97706]" />;
      } else if (schedule.status === "scheduled") {
        bgColor = "bg-blue-500/10 border-blue-500/40";
        statusIcon = <Calendar className="w-4 h-4 text-blue-400" />;
      } else if (schedule.status === "missed") {
        bgColor = "bg-red-500/10 border-red-500/40";
        statusIcon = <AlertCircle className="w-4 h-4 text-red-400" />;
      }
    }

    if (isPast && !schedule) {
      bgColor = "bg-[#0A0A08] cursor-not-allowed opacity-40 border-[#1A1814]";
    }

    if (isLocked) {
      bgColor += " cursor-not-allowed";
    }

    return (
      <motion.div
        key={day}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: day * 0.01 }}
        onClick={() => handleDayClick(day)}
        className={`min-h-[100px] p-2 rounded-xl border ${bgColor} ${
          isToday ? "ring-2 ring-[#D97706] ring-offset-1 ring-offset-[#0A0A08]" : ""
        } transition-all duration-200`}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-sm font-semibold ${
              isToday ? "text-[#D97706]" : "text-[#78716C]"
            }`}
          >
            {day}
          </span>
          <div className="flex items-center gap-1">
            {isLocked && <Lock className="w-3 h-3 text-[#78716C]" />}
            {statusIcon}
          </div>
        </div>

        {schedule && (
          <div className="mt-1">
            <p className="text-xs text-[#E8E4D9] truncate font-medium">
              {schedule.problem?.title || "Unknown"}
            </p>
            <span
              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getDifficultyColor(
                schedule.problem?.difficulty
              )}`}
            >
              {schedule.problem?.difficulty}
            </span>
            {!isLocked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(schedule._id);
                }}
                className="mt-1 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-8" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-[#D97706] to-[#D97706]/20 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-[#E8E4D9] uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#D97706]" />
              POTD Scheduler
            </h1>
            <p className="text-sm text-[#78716C]">
              Schedule Problem of the Day for upcoming dates
            </p>
          </div>
        </div>

        {}
        <div className="flex items-center gap-4">
          {schedulerStatus && (
            <div className="text-sm">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium ${
                  schedulerStatus.cronJobActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    schedulerStatus.cronJobActive ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                  }`}
                ></span>
                Cron {schedulerStatus.cronJobActive ? "Active" : "Inactive"}
              </span>
            </div>
          )}
          <button
            onClick={handleForcePublish}
            className="flex items-center gap-2 px-4 py-2 bg-[#D97706]/10 text-[#D97706] hover:bg-[#D97706]/20 rounded-lg text-sm transition-colors border border-[#D97706]/30 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Force Publish Today
          </button>
        </div>
      </div>

      {}
      <div className="flex items-center gap-6 mb-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
          <span className="text-[#78716C]">Published</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#D97706]/20 border border-[#D97706]/40"></div>
          <span className="text-[#78716C]">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/40"></div>
          <span className="text-[#78716C]">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/40"></div>
          <span className="text-[#78716C]">Missed</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#78716C]" />
          <span className="text-[#78716C]">Locked</span>
        </div>
      </div>

      {}
      <div className="flex items-center justify-between mb-6 bg-[#0F0F0D] rounded-xl border border-[#1A1814] p-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-[#1A1814] rounded-lg transition-colors text-[#78716C] hover:text-[#E8E4D9]"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xl font-bold text-[#E8E4D9] uppercase tracking-wider">
          {monthNames[month]} {year}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-[#1A1814] rounded-lg transition-colors text-[#78716C] hover:text-[#E8E4D9]"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-[#0F0F0D] rounded-xl border border-[#1A1814]">
          <Loader2 className="w-10 h-10 animate-spin text-[#D97706]" />
          <p className="text-[#78716C] mt-4">Loading schedule...</p>
        </div>
      ) : (
        <div className="bg-[#0F0F0D] rounded-xl border border-[#1A1814] p-4">
          {}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-[#78716C] py-2 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[100px]"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) =>
              renderDay(index + 1)
            )}
          </div>
        </div>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0F0F0D] rounded-xl border border-[#1A1814] p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
          >
            {}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#E8E4D9] uppercase tracking-wide">
                Schedule POTD for{" "}
                <span className="text-[#D97706]">
                  {selectedDate?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A08] border border-[#1A1814] rounded-lg text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-1 focus:ring-[#D97706]/30 transition-all"
                />
              </div>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="px-4 py-2.5 bg-[#0A0A08] border border-[#1A1814] rounded-lg text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50"
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-[300px]">
              {problemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D97706]" />
                </div>
              ) : problems.length === 0 ? (
                <div className="text-center text-[#78716C] py-8">
                  No problems found
                </div>
              ) : (
                problems.map((problem) => (
                  <motion.div
                    key={problem._id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedProblem(problem)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedProblem?._id === problem._id
                        ? "border-[#D97706] bg-[#D97706]/10"
                        : "border-[#1A1814] bg-[#0A0A08] hover:border-[#D97706]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#E8E4D9] font-medium">{problem.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getDifficultyColor(
                              problem.difficulty
                            )}`}
                          >
                            {problem.difficulty}
                          </span>
                          {problem.tags?.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-lg text-xs bg-[#1A1814] text-[#78716C]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {problem.lastUsedAsPOTD && (
                        <span className="text-xs text-[#78716C]">
                          Last used:{" "}
                          {new Date(problem.lastUsedAsPOTD).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {}
            <div className="mb-4">
              <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">
                Notes (optional)
              </label>
              <textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                placeholder="Add notes about why this problem was selected..."
                className="w-full px-3 py-2.5 bg-[#0A0A08] border border-[#1A1814] rounded-lg text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 resize-none"
                rows={2}
              />
            </div>

            {}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#1A1814]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-[#78716C] hover:text-[#E8E4D9] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={!selectedProblem || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 disabled:from-[#1A1814] disabled:to-[#1A1814] disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium shadow-lg shadow-[#D97706]/20 disabled:shadow-none"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Schedule POTD
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
