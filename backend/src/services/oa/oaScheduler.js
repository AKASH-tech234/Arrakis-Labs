import { OASession } from "../../models/oa/index.js";
import reportGenerator from "./reportGenerator.js";

/**
 * OA Scheduler Service
 * Handles automatic session state transitions
 */
class OAScheduler {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  /**
   * Initialize the scheduler
   */
  async initialize() {
    if (this.isRunning) {
      console.log("[OA Scheduler] Already running");
      return;
    }

    console.log("✓ OA Scheduler initialized");
    this.isRunning = true;

    // Initial check
    await this.checkAndUpdateSessions();

    // Periodic check every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkAndUpdateSessions().catch((err) => {
        console.error("[OA Scheduler] Periodic check error:", err.message);
      });
    }, 10000);
  }

  /**
   * Check and update session statuses
   */
  async checkAndUpdateSessions() {
    const now = new Date();

    try {
      // 1. Start scheduled sessions that should be live
      const shouldBeLive = await OASession.find({
        status: "scheduled",
        startAt: { $lte: now },
        endAt: { $gt: now },
      });

      for (const session of shouldBeLive) {
        try {
          session.status = "live";
          session.actualStartedAt = now;
          await session.save();
          console.log(
            `[OA Scheduler] Session ${session.sessionCode} transitioned to LIVE`
          );
        } catch (err) {
          console.error(
            `[OA Scheduler] Error starting session ${session.sessionCode}:`,
            err.message
          );
        }
      }

      // 2. Expire sessions past their end time
      const shouldBeExpired = await OASession.find({
        status: "live",
        endAt: { $lte: now },
      });

      for (const session of shouldBeExpired) {
        try {
          await this.expireSession(session);
        } catch (err) {
          console.error(
            `[OA Scheduler] Error expiring session ${session.sessionCode}:`,
            err.message
          );
        }
      }

      // 3. Auto-expire very old scheduled sessions (> 24 hours past start time)
      const staleScheduled = await OASession.find({
        status: "scheduled",
        startAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      });

      for (const session of staleScheduled) {
        try {
          session.status = "expired";
          session.terminatedReason = "time_expired";
          await session.save();
          console.log(
            `[OA Scheduler] Stale session ${session.sessionCode} marked expired`
          );
        } catch (err) {
          console.error(
            `[OA Scheduler] Error expiring stale session:`,
            err.message
          );
        }
      }
    } catch (error) {
      console.error("[OA Scheduler] Check sessions error:", error.message);
    }
  }

  /**
   * Expire a session and generate report
   */
  async expireSession(session) {
    session.status = "expired";
    session.terminatedReason = "time_expired";
    session.submittedAt = new Date();
    await session.save();

    console.log(`[OA Scheduler] Session ${session.sessionCode} EXPIRED`);

    // Generate report asynchronously
    try {
      await reportGenerator.generateReport(session._id);
      console.log(
        `[OA Scheduler] Report generated for session ${session.sessionCode}`
      );
    } catch (err) {
      console.error(
        `[OA Scheduler] Report generation failed for ${session.sessionCode}:`,
        err.message
      );
    }
  }

  /**
   * Force check a specific session
   */
  async checkSession(sessionId) {
    const session = await OASession.findById(sessionId);
    if (!session) return null;

    const now = new Date();

    // Check if should transition to live
    if (
      session.status === "scheduled" &&
      now >= session.startAt &&
      now < session.endAt
    ) {
      session.status = "live";
      session.actualStartedAt = now;
      await session.save();
      return session;
    }

    // Check if should expire
    if (session.status === "live" && now >= session.endAt) {
      await this.expireSession(session);
      return session;
    }

    return session;
  }

  /**
   * Shutdown the scheduler
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("✓ OA Scheduler shut down");
  }
}

export default new OAScheduler();
