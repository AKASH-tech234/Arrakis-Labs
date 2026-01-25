import cron from "node-cron";
import POTDCalendar from "../../models/potd/POTDCalendar.js";
import PublishedPOTD from "../../models/potd/PublishedPOTD.js";
import UserStreak from "../../models/profile/UserStreak.js";

/**
 * POTD Scheduler Service
 * Handles the daily cron job for publishing Problem of the Day
 * Runs at 00:00 UTC every day
 */
class POTDScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    this.lastRunDate = null;
  }

  /**
   * Initialize the POTD scheduler
   */
  async initialize() {
    console.log("🗓️  Initializing POTD Scheduler...");

    // Run immediately on startup to catch any missed publications
    await this.checkAndPublishTodaysPOTD();

    // Schedule cron job to run every day at 00:00 UTC
    // Cron format: second minute hour day month weekday
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

  /**
   * Main daily job execution
   */
  async runDailyJob() {
    // Prevent concurrent execution
    if (this.isRunning) {
      console.log("⚠️ POTD job already running, skipping...");
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check if already ran today (duplicate execution protection)
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
      // Step 1: Mark previous day's POTD as completed
      await this.completePreviousPOTD();

      // Step 2: Check and publish today's POTD
      await this.checkAndPublishTodaysPOTD();

      this.lastRunDate = today;
      console.log("✅ POTD daily job completed successfully\n");
    } catch (error) {
      console.error("❌ POTD daily job failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Mark previous day's POTD as completed
   */
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

  /**
   * Check if POTD exists for today and publish if not
   */
  async checkAndPublishTodaysPOTD() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check if POTD already published for today
    const existingPOTD = await PublishedPOTD.findOne({ activeDate: today });

    if (existingPOTD) {
      console.log(
        `ℹ️  POTD already published for today: ${existingPOTD.problemId}`
      );
      return existingPOTD;
    }

    // Get scheduled POTD from calendar
    const scheduledPOTD = await POTDCalendar.getTodaySchedule();

    if (!scheduledPOTD) {
      console.log("⚠️ No POTD scheduled for today!");
      // Optionally: Send notification to admins
      return null;
    }

    // Publish the POTD
    const publishedPOTD = await this.publishPOTD(scheduledPOTD);
    return publishedPOTD;
  }

  /**
   * Publish a scheduled POTD
   */
  async publishPOTD(scheduledPOTD) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Set end time to 23:59:59.999 UTC of the same day
    const endTime = new Date(today);
    endTime.setUTCHours(23, 59, 59, 999);

    try {
      // Create published POTD record
      const publishedPOTD = await PublishedPOTD.create({
        activeDate: today,
        problemId: scheduledPOTD.problemId._id || scheduledPOTD.problemId,
        calendarEntry: scheduledPOTD._id,
        startTime: today,
        endTime: endTime,
      });

      // Mark calendar entry as published
      scheduledPOTD.isPublished = true;
      scheduledPOTD.publishedAt = new Date();
      await scheduledPOTD.save();

      console.log(
        `🎉 Published POTD for ${today.toDateString()}: Problem ID ${publishedPOTD.problemId}`
      );

      return publishedPOTD;
    } catch (error) {
      // If multiple instances race, the unique index on activeDate will throw.
      // Treat that as idempotent success and return the existing record.
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
            // Best-effort; published record is the source of truth.
          }
          return existing;
        }
      }
      console.error("❌ Failed to publish POTD:", error);
      throw error;
    }
  }

  /**
   * Get today's active POTD
   */
  async getTodaysPOTD() {
    return await PublishedPOTD.getToday();
  }

  /**
   * Force publish POTD (admin use only)
   * Use this if cron job failed and manual intervention is needed
   */
  async forcePublishToday() {
    console.log("🔧 Force publishing today's POTD...");
    return await this.checkAndPublishTodaysPOTD();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunDate: this.lastRunDate,
      cronJobActive: this.cronJob !== null,
      nextRun: this.getNextRunTime(),
    };
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(0, 0, 0, 0);

    if (now >= next) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    return next;
  }

  /**
   * Shutdown the scheduler
   */
  shutdown() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log("🛑 POTD Scheduler stopped");
    }
  }
}

// Export singleton instance
const potdScheduler = new POTDScheduler();
export default potdScheduler;
