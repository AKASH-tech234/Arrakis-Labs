import { useState, useEffect, useMemo } from "react";
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
        return "text-green-400 bg-green-400/10 border-green-400/30";
      case "Medium":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
      case "Hard":
        return "text-red-400 bg-red-400/10 border-red-400/30";
      default:
        return "text-gray-400 bg-gray-400/10 border-gray-400/30";
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

    let bgColor = "bg-gray-800/30 hover:bg-gray-700/50 cursor-pointer";
    let statusIcon = null;

    if (schedule) {
      if (schedule.status === "published") {
        bgColor = "bg-green-500/20 border-green-500/50";
        statusIcon = <CheckCircle className="w-4 h-4 text-green-400" />;
      } else if (schedule.status === "today") {
        bgColor = "bg-orange-500/20 border-orange-500/50";
        statusIcon = <Clock className="w-4 h-4 text-orange-400" />;
      } else if (schedule.status === "scheduled") {
        bgColor = "bg-blue-500/20 border-blue-500/50";
        statusIcon = <Calendar className="w-4 h-4 text-blue-400" />;
      } else if (schedule.status === "missed") {
        bgColor = "bg-red-500/20 border-red-500/50";
        statusIcon = <AlertCircle className="w-4 h-4 text-red-400" />;
      }
    }

    if (isPast && !schedule) {
      bgColor = "bg-gray-900/50 cursor-not-allowed opacity-50";
    }

    if (isLocked) {
      bgColor += " cursor-not-allowed";
    }

    return (
      <div
        key={day}
        onClick={() => handleDayClick(day)}
        className={`min-h-[100px] p-2 rounded-lg border ${bgColor} ${
          isToday ? "ring-2 ring-orange-500" : "border-gray-700"
        } transition-all duration-200`}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-sm font-medium ${
              isToday ? "text-orange-400" : "text-gray-400"
            }`}
          >
            {day}
          </span>
          <div className="flex items-center gap-1">
            {isLocked && <Lock className="w-3 h-3 text-gray-500" />}
            {statusIcon}
          </div>
        </div>

        {schedule && (
          <div className="mt-1">
            <p className="text-xs text-white truncate font-medium">
              {schedule.problem?.title || "Unknown"}
            </p>
            <span
              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] ${getDifficultyColor(
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
                className="mt-1 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-6">
      {}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-orange-500" />
            POTD Scheduler
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Schedule Problem of the Day for upcoming dates
          </p>
        </div>

        {}
        <div className="flex items-center gap-4">
          {schedulerStatus && (
            <div className="text-sm text-gray-400">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                  schedulerStatus.cronJobActive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    schedulerStatus.cronJobActive ? "bg-green-400" : "bg-red-400"
                  }`}
                ></span>
                Cron {schedulerStatus.cronJobActive ? "Active" : "Inactive"}
              </span>
            </div>
          )}
          <button
            onClick={handleForcePublish}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Force Publish Today
          </button>
        </div>
      </div>

      {}
      <div className="flex items-center gap-6 mb-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50"></div>
          <span className="text-gray-400">Published</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500/30 border border-orange-500/50"></div>
          <span className="text-gray-400">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500/50"></div>
          <span className="text-gray-400">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50"></div>
          <span className="text-gray-400">Missed</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400">Locked</span>
        </div>
      </div>

      {}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <span className="text-xl font-semibold text-white">
          {monthNames[month]} {year}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {}
      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-gray-500 py-2"
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
        </>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                Schedule POTD for{" "}
                {selectedDate?.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                />
              </div>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {problemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : problems.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No problems found
                </div>
              ) : (
                problems.map((problem) => (
                  <div
                    key={problem._id}
                    onClick={() => setSelectedProblem(problem)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedProblem?._id === problem._id
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-gray-700 bg-gray-700/30 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{problem.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(
                              problem.difficulty
                            )}`}
                          >
                            {problem.difficulty}
                          </span>
                          {problem.tags?.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {problem.lastUsedAsPOTD && (
                        <span className="text-xs text-gray-400">
                          Last used:{" "}
                          {new Date(problem.lastUsedAsPOTD).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                placeholder="Add notes about why this problem was selected..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 resize-none"
                rows={2}
              />
            </div>

            {}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={!selectedProblem || saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Schedule POTD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
