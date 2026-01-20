import PlatformProfile from "../models/PlatformProfile.js";
import { syncPlatformProfile } from "./platformSyncService.js";

class ProfileSyncScheduler {
  constructor() {
    this.timer = null;
    this.isRunning = false;
  }

  start({ intervalMs = 15 * 60 * 1000 } = {}) {
    if (this.timer) return;

    this.timer = setInterval(() => {
      if (this.isRunning) return;
      this.runOnce().catch(() => {
        // errors already logged per profile
      });
    }, intervalMs);

    // kick once on boot
    this.runOnce().catch(() => {
      // ignore
    });

    console.log(`✓ Profile sync scheduler started (every ${Math.round(intervalMs / 60000)}m)`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce() {
    this.isRunning = true;

    try {
      const now = new Date();
      const candidates = await PlatformProfile.find({
        isEnabled: true,
        platform: { $in: ["leetcode", "codeforces", "codechef", "atcoder", "hackerrank", "custom"] },
      })
        .select("_id lastSyncAt syncStatus")
        .lean();

      // naive scheduling: sync anything never synced or older than 24h
      const due = candidates
        .filter((p) => {
          if (!p.lastSyncAt) return true;
          const ageMs = now.getTime() - new Date(p.lastSyncAt).getTime();
          return ageMs >= 24 * 60 * 60 * 1000;
        })
        .slice(0, 10); // throttle

      for (const p of due) {
        try {
          await syncPlatformProfile(p._id);
        } catch (e) {
          // keep going
          console.warn(`[ProfileSync] Failed for ${p._id}:`, e?.message || e);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}

const profileSyncScheduler = new ProfileSyncScheduler();

export default profileSyncScheduler;
