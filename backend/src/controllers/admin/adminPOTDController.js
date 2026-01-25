import POTDCalendar from "../../models/potd/POTDCalendar.js";
import PublishedPOTD from "../../models/potd/PublishedPOTD.js";
import Question from "../../models/question/Question.js";
import potdScheduler from "../../services/potd/potdScheduler.js";

export const schedulePOTD = async (req, res) => {
  try {
    const { problemId, scheduledDate, notes } = req.body;

    if (!problemId || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: "Problem ID and scheduled date are required",
      });
    }

    const date = new Date(scheduledDate);
    date.setUTCHours(0, 0, 0, 0);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (date < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot schedule POTD for past dates",
      });
    }

    const problem = await Question.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: "Problem not found",
      });
    }

    if (!problem.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot schedule inactive problem as POTD",
      });
    }

    const existingSchedule = await POTDCalendar.findOne({ scheduledDate: date });

    if (existingSchedule) {
      
      if (existingSchedule.isPublished) {
        return res.status(400).json({
          success: false,
          message: "This date already has a published POTD and cannot be modified",
        });
      }

      if (date.getTime() === today.getTime()) {
        return res.status(400).json({
          success: false,
          message: "Cannot modify today's POTD schedule",
        });
      }

      existingSchedule.problemId = problemId;
      existingSchedule.scheduledBy = req.admin._id;
      existingSchedule.notes = notes || "";
      await existingSchedule.save();

      return res.json({
        success: true,
        message: "POTD schedule updated successfully",
        data: existingSchedule,
      });
    }

    const newSchedule = await POTDCalendar.create({
      scheduledDate: date,
      problemId,
      scheduledBy: req.admin._id,
      notes: notes || "",
    });

    if (date.getTime() === today.getTime()) {
      
      await potdScheduler.checkAndPublishTodaysPOTD();
    }

    res.status(201).json({
      success: true,
      message: date.getTime() === today.getTime() 
        ? "POTD scheduled and published successfully for today"
        : "POTD scheduled successfully",
      data: newSchedule,
    });
  } catch (error) {
    console.error("Error scheduling POTD:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule POTD",
      error: error.message,
    });
  }
};

export const getScheduledPOTDs = async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;

    let start, end;

    if (month && year) {
      
      start = new Date(Date.UTC(year, month - 1, 1));
      end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      
      const now = new Date();
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
      );
    }

    const schedules = await POTDCalendar.getScheduleRange(start, end);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const formattedSchedules = schedules.map((schedule) => {
      const scheduleDate = new Date(schedule.scheduledDate);
      scheduleDate.setUTCHours(0, 0, 0, 0);

      let status;
      if (schedule.isPublished) {
        status = "published";
      } else if (scheduleDate < today) {
        status = "missed"; 
      } else if (scheduleDate.getTime() === today.getTime()) {
        status = "today";
      } else {
        status = "scheduled";
      }

      return {
        _id: schedule._id,
        scheduledDate: schedule.scheduledDate,
        problem: schedule.problemId,
        scheduledBy: schedule.scheduledBy,
        isPublished: schedule.isPublished,
        publishedAt: schedule.publishedAt,
        notes: schedule.notes,
        status,
        isLocked: scheduleDate <= today || schedule.isPublished,
      };
    });

    res.json({
      success: true,
      data: {
        schedules: formattedSchedules,
        dateRange: {
          start,
          end,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching POTD schedules:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch POTD schedules",
      error: error.message,
    });
  }
};

export const deleteScheduledPOTD = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await POTDCalendar.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const scheduleDate = new Date(schedule.scheduledDate);
    scheduleDate.setUTCHours(0, 0, 0, 0);

    if (schedule.isPublished || scheduleDate <= today) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete locked or published POTD schedule",
      });
    }

    await POTDCalendar.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "POTD schedule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting POTD schedule:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete schedule",
      error: error.message,
    });
  }
};

export const getAvailableProblems = async (req, res) => {
  try {
    const { search, difficulty, tags, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (tags) {
      const tagArray = tags.split(",").map((t) => t.trim());
      query.tags = { $in: tagArray };
    }

    const problems = await Question.find(query)
      .select("title difficulty tags totalSubmissions acceptedSubmissions")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Question.countDocuments(query);

    const problemIds = problems.map((p) => p._id);
    const usageHistory = await POTDCalendar.find({
      problemId: { $in: problemIds },
    }).select("problemId scheduledDate");

    const usageMap = {};
    usageHistory.forEach((u) => {
      const pid = u.problemId.toString();
      if (!usageMap[pid]) {
        usageMap[pid] = [];
      }
      usageMap[pid].push(u.scheduledDate);
    });

    const problemsWithUsage = problems.map((p) => ({
      ...p.toObject(),
      potdHistory: usageMap[p._id.toString()] || [],
      lastUsedAsPOTD: usageMap[p._id.toString()]
        ? Math.max(...usageMap[p._id.toString()].map((d) => new Date(d).getTime()))
        : null,
    }));

    res.json({
      success: true,
      data: {
        problems: problemsWithUsage,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching available problems:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch problems",
      error: error.message,
    });
  }
};

export const forcePublishPOTD = async (req, res) => {
  try {
    const result = await potdScheduler.forcePublishToday();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No POTD scheduled for today to publish",
      });
    }

    res.json({
      success: true,
      message: "POTD published successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error force publishing POTD:", error);
    res.status(500).json({
      success: false,
      message: "Failed to force publish POTD",
      error: error.message,
    });
  }
};

export const getPOTDAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const potds = await PublishedPOTD.find({
      activeDate: { $gte: start, $lte: end },
    })
      .populate("problemId", "title difficulty")
      .sort({ activeDate: -1 });

    const totalPOTDs = potds.length;
    const totalAttempts = potds.reduce((sum, p) => sum + p.stats.totalAttempts, 0);
    const totalSolved = potds.reduce((sum, p) => sum + p.stats.totalSolved, 0);

    const averageSolveRate =
      totalAttempts > 0 ? ((totalSolved / totalAttempts) * 100).toFixed(2) : 0;

    const difficultyStats = {
      Easy: { count: 0, solved: 0, attempts: 0 },
      Medium: { count: 0, solved: 0, attempts: 0 },
      Hard: { count: 0, solved: 0, attempts: 0 },
    };

    potds.forEach((p) => {
      if (p.problemId && difficultyStats[p.problemId.difficulty]) {
        difficultyStats[p.problemId.difficulty].count++;
        difficultyStats[p.problemId.difficulty].solved += p.stats.totalSolved;
        difficultyStats[p.problemId.difficulty].attempts += p.stats.totalAttempts;
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalPOTDs,
          totalAttempts,
          totalSolved,
          averageSolveRate,
        },
        difficultyStats,
        dailyStats: potds.map((p) => ({
          date: p.activeDate,
          problem: p.problemId?.title || "Unknown",
          difficulty: p.problemId?.difficulty || "Unknown",
          attempts: p.stats.totalAttempts,
          solved: p.stats.totalSolved,
          solveRate:
            p.stats.totalAttempts > 0
              ? ((p.stats.totalSolved / p.stats.totalAttempts) * 100).toFixed(2)
              : 0,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching POTD analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: error.message,
    });
  }
};

export const getSchedulerStatus = async (req, res) => {
  try {
    const status = potdScheduler.getStatus();
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get scheduler status",
      error: error.message,
    });
  }
};
