import Contest from "../../models/contest/Contest.js";
import leaderboardService from "./leaderboardService.js";
import wsServer from "./websocketServer.js";

class ContestScheduler {
  constructor() {
    this.timers = new Map(); 
    this.checkInterval = null;
  }

  async initialize() {
    console.log("✓ Contest Scheduler initialized");

    await this.checkAndUpdateContests();

    this.checkInterval = setInterval(() => {
      this.checkAndUpdateContests();
    }, 30000);

    await this.scheduleUpcomingContests();
  }

  async checkAndUpdateContests() {
    try {
      const now = new Date();

      const shouldBeLive = await Contest.find({
        status: "scheduled",
        startTime: { $lte: now },
        endTime: { $gt: now },
        isActive: true,
      });

      for (const contest of shouldBeLive) {
        await this.startContest(contest);
      }

      const shouldBeEnded = await Contest.find({
        status: "live",
        endTime: { $lte: now },
        isActive: true,
      });

      for (const contest of shouldBeEnded) {
        await this.endContest(contest);
      }
    } catch (error) {
      console.error("[Scheduler] Check contests error:", error.message);
    }
  }

  async scheduleUpcomingContests() {
    try {
      const now = new Date();
      const oneHour = 60 * 60 * 1000;

      const upcoming = await Contest.find({
        status: "scheduled",
        startTime: { 
          $gt: now, 
          $lte: new Date(now.getTime() + oneHour) 
        },
        isActive: true,
      });

      for (const contest of upcoming) {
        this.scheduleContest(contest);
      }

      console.log(`[Scheduler] Scheduled ${upcoming.length} upcoming contests`);
    } catch (error) {
      console.error("[Scheduler] Schedule upcoming error:", error.message);
    }
  }

  scheduleContest(contest) {
    const contestId = contest._id.toString();
    const now = Date.now();

    this.clearTimers(contestId);

    const timers = {};

    const startDelay = Math.max(0, contest.startTime.getTime() - now);
    if (startDelay > 0 && startDelay < 24 * 60 * 60 * 1000) { 
      timers.startTimer = setTimeout(async () => {
        const freshContest = await Contest.findById(contestId);
        if (freshContest && freshContest.status === "scheduled") {
          await this.startContest(freshContest);
        }
      }, startDelay);

      console.log(`[Scheduler] Contest ${contest.name} starts in ${Math.round(startDelay / 1000)}s`);
    }

    const endDelay = Math.max(0, contest.endTime.getTime() - now);
    if (endDelay > 0 && endDelay < 24 * 60 * 60 * 1000) {
      timers.endTimer = setTimeout(async () => {
        const freshContest = await Contest.findById(contestId);
        if (freshContest && freshContest.status === "live") {
          await this.endContest(freshContest);
        }
      }, endDelay);

      console.log(`[Scheduler] Contest ${contest.name} ends in ${Math.round(endDelay / 1000)}s`);
    }

    this.timers.set(contestId, timers);
  }

  clearTimers(contestId) {
    const timers = this.timers.get(contestId);
    if (timers) {
      if (timers.startTimer) clearTimeout(timers.startTimer);
      if (timers.endTimer) clearTimeout(timers.endTimer);
      this.timers.delete(contestId);
    }
  }

  async startContest(contest) {
    try {
      contest.status = "live";
      await contest.save();

      await leaderboardService.initializeContest(
        contest._id.toString(),
        contest.duration
      );

      wsServer.notifyContestStart(contest._id.toString(), contest.endTime);

      console.log(`[Scheduler] Contest started: ${contest.name}`);
    } catch (error) {
      console.error(`[Scheduler] Start contest error (${contest.name}):`, error.message);
    }
  }

  async endContest(contest) {
    try {
      contest.status = "ended";
      await contest.save();

      await leaderboardService.freezeLeaderboard(contest._id.toString());

      wsServer.notifyContestEnd(contest._id.toString());

      this.calculateFinalRanks(contest._id);

      this.clearTimers(contest._id.toString());

      console.log(`[Scheduler] Contest ended: ${contest.name}`);
    } catch (error) {
      console.error(`[Scheduler] End contest error (${contest.name}):`, error.message);
    }
  }

  async calculateFinalRanks(contestId) {
    try {
      const ContestRegistration = (await import("../models/ContestRegistration.js")).default;

      const registrations = await ContestRegistration.find({
        contest: contestId,
        status: { $in: ["participating", "completed"] },
      }).sort({
        finalScore: -1,
        problemsSolved: -1,
        totalTime: 1,
        totalPenalty: 1,
      });

      let rank = 1;
      for (const reg of registrations) {
        reg.finalRank = rank++;
        reg.status = "completed";
        await reg.save();
      }

      const totalScore = registrations.reduce((sum, r) => sum + r.finalScore, 0);
      const avgScore = registrations.length > 0 ? totalScore / registrations.length : 0;

      await Contest.findByIdAndUpdate(contestId, {
        "stats.participatedCount": registrations.length,
        "stats.avgScore": Math.round(avgScore * 100) / 100,
      });

      console.log(`[Scheduler] Final ranks calculated for contest ${contestId}`);
    } catch (error) {
      console.error("[Scheduler] Calculate ranks error:", error.message);
    }
  }

  async addContest(contestId) {
    const contest = await Contest.findById(contestId);
    if (contest && contest.status === "scheduled") {
      this.scheduleContest(contest);
    }
  }

  removeContest(contestId) {
    this.clearTimers(contestId);
  }

  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    for (const [contestId] of this.timers) {
      this.clearTimers(contestId);
    }

    console.log("✓ Contest Scheduler shut down");
  }
}

const contestScheduler = new ContestScheduler();

export default contestScheduler;
