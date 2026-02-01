import cron from "node-cron";
import POTDCalendar from "../../models/potd/POTDCalendar.js";
import PublishedPOTD from "../../models/potd/PublishedPOTD.js";
import UserStreak from "../../models/profile/UserStreak.js";

class POTDScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    this.lastRunDate = null;
  }

  async initialize() {
    console.log("🗓️  Initializing POTD Scheduler...");

    await this.checkAndPublishTodaysPOTD();

    this.cronJob = cron.schedule(
      "0 0 * * *",
      async () => {
        await this.runDailyJob();
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    console.log("✅ POTD Scheduler initialized - Cron job running at 00:00 UTC daily");
  }

  async runDailyJob() {

    if (this.isRunning) {
      console.log("⚠️ POTD job already running, skipping...");
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (
      this.lastRunDate &&
      this.lastRunDate.getTime() === today.getTime()
    ) {
      console.log("⚠️ POTD job already ran today, skipping...");
      return;
    }

    this.isRunning = true;
    console.log(`\n🔄 Running POTD daily job for ${today.toISOString()}`);

    try {

      await this.completePreviousPOTD();

      await this.checkAndPublishTodaysPOTD();

      this.lastRunDate = today;
      console.log("✅ POTD daily job completed successfully\n");
    } catch (error) {
      console.error("❌ POTD daily job failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  async completePreviousPOTD() {
    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const previousPOTD = await PublishedPOTD.findOne({
      activeDate: yesterday,
      status: "active",
    });

    if (previousPOTD) {
      previousPOTD.status = "completed";
      await previousPOTD.save();
      console.log(`📦 Completed previous POTD for ${yesterday.toDateString()}`);
    }
  }

  async checkAndPublishTodaysPOTD() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existingPOTD = await PublishedPOTD.findOne({ activeDate: today });

    if (existingPOTD) {
      console.log(
        `ℹ️  POTD already published for today: ${existingPOTD.problemId}`
      );
      return existingPOTD;
    }

    const scheduledPOTD = await POTDCalendar.getTodaySchedule();

    if (!scheduledPOTD) {
      console.log("⚠️ No POTD scheduled for today!");

      return null;
    }

    const publishedPOTD = await this.publishPOTD(scheduledPOTD);
    return publishedPOTD;
  }

  async publishPOTD(scheduledPOTD) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const endTime = new Date(today);
    endTime.setUTCHours(23, 59, 59, 999);

    try {

      const publishedPOTD = await PublishedPOTD.create({
        activeDate: today,
        problemId: scheduledPOTD.problemId._id || scheduledPOTD.problemId,
        calendarEntry: scheduledPOTD._id,
        startTime: today,
        endTime: endTime,
      });

      scheduledPOTD.isPublished = true;
      scheduledPOTD.publishedAt = new Date();
      await scheduledPOTD.save();

      console.log(
        `🎉 Published POTD for ${today.toDateString()}: Problem ID ${publishedPOTD.problemId}`
      );

      return publishedPOTD;
    } catch (error) {

      if (error?.code === 11000) {
        const existing = await PublishedPOTD.findOne({ activeDate: today });
        if (existing) {
          try {
            await POTDCalendar.updateOne(
              { _id: scheduledPOTD._id },
              { $set: { isPublished: true } }
            );
            await POTDCalendar.updateOne(
              { _id: scheduledPOTD._id, publishedAt: null },
              { $set: { publishedAt: new Date() } }
            );
          } catch {

          }
          return existing;
        }
      }
      console.error("❌ Failed to publish POTD:", error);
      throw error;
    }
  }

  async getTodaysPOTD() {
    return await PublishedPOTD.getToday();
  }

  async forcePublishToday() {
    console.log("🔧 Force publishing today's POTD...");
    return await this.checkAndPublishTodaysPOTD();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunDate: this.lastRunDate,
      cronJobActive: this.cronJob !== null,
      nextRun: this.getNextRunTime(),
    };
  }

  getNextRunTime() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(0, 0, 0, 0);

    if (now >= next) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    return next;
  }

  shutdown() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log("🛑 POTD Scheduler stopped");
    }
  }
}

const potdScheduler = new POTDScheduler();
export default potdScheduler;
