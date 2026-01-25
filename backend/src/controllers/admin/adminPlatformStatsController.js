import PlatformStats from "../../models/profile/PlatformStats.js";
import PlatformProfile from "../../models/profile/PlatformProfile.js";
import User from "../../models/auth/User.js";

export async function listPlatformStats(req, res) {
  try {
    const { userId, platform, page = 1, limit = 50 } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (platform) query.platform = platform;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [stats, total] = await Promise.all([
      PlatformStats.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "name email username")
        .lean(),
      PlatformStats.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("[Admin PlatformStats List Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getPlatformStats(req, res) {
  try {
    const stats = await PlatformStats.findById(req.params.id)
      .populate("userId", "name email username")
      .lean();

    if (!stats) {
      return res.status(404).json({ success: false, message: "PlatformStats not found" });
    }

    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error("[Admin PlatformStats Get Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updatePlatformStats(req, res) {
  try {
    const { id } = req.params;
    const {
      totalSolved,
      totalAttempted,
      last30DaysSolved,
      avgSolvedPerDay,
      contestsParticipated,
      currentRating,
      highestRating,
      difficulty,
      skills,
      daily,
      dataSource,
    } = req.body;

    const existing = await PlatformStats.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "PlatformStats not found" });
    }

    const update = {};

    if (totalSolved !== undefined) update.totalSolved = Number(totalSolved) || 0;
    if (totalAttempted !== undefined) update.totalAttempted = Number(totalAttempted) || 0;
    if (last30DaysSolved !== undefined) update.last30DaysSolved = Number(last30DaysSolved) || 0;
    if (avgSolvedPerDay !== undefined) update.avgSolvedPerDay = Number(avgSolvedPerDay) || 0;
    if (contestsParticipated !== undefined) update.contestsParticipated = Number(contestsParticipated) || 0;
    if (currentRating !== undefined) update.currentRating = currentRating === null ? null : Number(currentRating);
    if (highestRating !== undefined) update.highestRating = highestRating === null ? null : Number(highestRating);

    if (difficulty !== undefined) {
      update.difficulty = {
        easy: {
          solved: Number(difficulty?.easy?.solved) || 0,
          attempted: Number(difficulty?.easy?.attempted) || 0,
        },
        medium: {
          solved: Number(difficulty?.medium?.solved) || 0,
          attempted: Number(difficulty?.medium?.attempted) || 0,
        },
        hard: {
          solved: Number(difficulty?.hard?.solved) || 0,
          attempted: Number(difficulty?.hard?.attempted) || 0,
        },
      };
    }

    if (skills !== undefined) {
      update.skills = skills instanceof Map ? skills : new Map(Object.entries(skills || {}));
    }

    if (daily !== undefined && Array.isArray(daily)) {
      update.daily = daily.map((d) => ({
        date: String(d.date || ""),
        solved: Number(d.solved) || 0,
      })).filter((d) => d.date);
    }

    if (dataSource !== undefined) {
      const allowed = ["internal", "api", "scrape", "manual"];
      update.dataSource = allowed.includes(dataSource) ? dataSource : "manual";
    }

    update.lastSyncedAt = new Date();

    const updated = await PlatformStats.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).populate("userId", "name email username").lean();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("[Admin PlatformStats Update Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function upsertPlatformStats(req, res) {
  try {
    const {
      userId,
      platform,
      totalSolved,
      totalAttempted,
      last30DaysSolved,
      avgSolvedPerDay,
      contestsParticipated,
      currentRating,
      highestRating,
      difficulty,
      skills,
      daily,
      dataSource,
    } = req.body;

    if (!userId || !platform) {
      return res.status(400).json({ success: false, message: "userId and platform are required" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const update = {
      totalSolved: Number(totalSolved) || 0,
      totalAttempted: Number(totalAttempted) || 0,
      last30DaysSolved: Number(last30DaysSolved) || 0,
      avgSolvedPerDay: Number(avgSolvedPerDay) || 0,
      contestsParticipated: Number(contestsParticipated) || 0,
      currentRating: currentRating === null || currentRating === undefined ? null : Number(currentRating),
      highestRating: highestRating === null || highestRating === undefined ? null : Number(highestRating),
      difficulty: {
        easy: {
          solved: Number(difficulty?.easy?.solved) || 0,
          attempted: Number(difficulty?.easy?.attempted) || 0,
        },
        medium: {
          solved: Number(difficulty?.medium?.solved) || 0,
          attempted: Number(difficulty?.medium?.attempted) || 0,
        },
        hard: {
          solved: Number(difficulty?.hard?.solved) || 0,
          attempted: Number(difficulty?.hard?.attempted) || 0,
        },
      },
      skills: skills instanceof Map ? skills : new Map(Object.entries(skills || {})),
      daily: Array.isArray(daily)
        ? daily.map((d) => ({
            date: String(d.date || ""),
            solved: Number(d.solved) || 0,
          })).filter((d) => d.date)
        : [],
      dataSource: ["internal", "api", "scrape", "manual"].includes(dataSource) ? dataSource : "manual",
      lastSyncedAt: new Date(),
    };

    const stats = await PlatformStats.findOneAndUpdate(
      { userId, platform },
      { $set: update },
      { upsert: true, new: true }
    ).populate("userId", "name email username").lean();

    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("[Admin PlatformStats Upsert Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function bulkUpsertPlatformStats(req, res) {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "records array is required" });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const record of records) {
      try {
        const { userId, platform, ...rest } = record;

        if (!userId || !platform) {
          results.failed++;
          results.errors.push({ userId, platform, error: "userId and platform are required" });
          continue;
        }

        const update = {
          totalSolved: Number(rest.totalSolved) || 0,
          totalAttempted: Number(rest.totalAttempted) || 0,
          last30DaysSolved: Number(rest.last30DaysSolved) || 0,
          avgSolvedPerDay: Number(rest.avgSolvedPerDay) || 0,
          contestsParticipated: Number(rest.contestsParticipated) || 0,
          currentRating: rest.currentRating === null || rest.currentRating === undefined ? null : Number(rest.currentRating),
          highestRating: rest.highestRating === null || rest.highestRating === undefined ? null : Number(rest.highestRating),
          difficulty: {
            easy: {
              solved: Number(rest.difficulty?.easy?.solved) || 0,
              attempted: Number(rest.difficulty?.easy?.attempted) || 0,
            },
            medium: {
              solved: Number(rest.difficulty?.medium?.solved) || 0,
              attempted: Number(rest.difficulty?.medium?.attempted) || 0,
            },
            hard: {
              solved: Number(rest.difficulty?.hard?.solved) || 0,
              attempted: Number(rest.difficulty?.hard?.attempted) || 0,
            },
          },
          daily: Array.isArray(rest.daily)
            ? rest.daily.map((d) => ({
                date: String(d.date || ""),
                solved: Number(d.solved) || 0,
              })).filter((d) => d.date)
            : [],
          dataSource: ["internal", "api", "scrape", "manual"].includes(rest.dataSource) ? rest.dataSource : "manual",
          lastSyncedAt: new Date(),
        };

        await PlatformStats.findOneAndUpdate(
          { userId, platform },
          { $set: update },
          { upsert: true }
        );

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ userId: record.userId, platform: record.platform, error: err.message });
      }
    }

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error("[Admin PlatformStats Bulk Upsert Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deletePlatformStats(req, res) {
  try {
    const deleted = await PlatformStats.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "PlatformStats not found" });
    }

    return res.json({ success: true, message: "PlatformStats deleted" });
  } catch (err) {
    console.error("[Admin PlatformStats Delete Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
