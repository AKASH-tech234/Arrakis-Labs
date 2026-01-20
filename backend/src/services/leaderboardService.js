import Redis from "ioredis";

/**
 * Redis Leaderboard Service
 * High-performance real-time leaderboard using Redis sorted sets
 * 
 * Architecture:
 * - Uses Redis Sorted Sets for O(log N) rank operations
 * - Composite score for multi-criteria ranking
 * - Pub/Sub for real-time updates
 */

class LeaderboardService {
  constructor() {
    this.redis = null;
    this.subscriber = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    const redisUrl = process.env.REDIS_URL;

    // Redis is optional. If not configured, don't attempt to connect/retry.
    if (!redisUrl) {
      this.isConnected = false;
      console.warn("⚠ Redis not configured (REDIS_URL missing) - leaderboard will use fallback");
      return false;
    }
    
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // IMPORTANT: attach error listeners BEFORE connecting.
      // ioredis will emit 'error' during connection attempts; without a listener,
      // Node treats it as an unhandled error event and crashes/spams logs.
      const onRedisError = (label) => (err) => {
        console.error(`[Redis:${label}] Error:`, err?.message || err);
        this.isConnected = false;
      };

      this.redis.on("error", onRedisError("client"));
      this.subscriber.on("error", onRedisError("subscriber"));

      this.redis.on("reconnecting", () => {
        console.log("[Redis] Reconnecting...");
      });

      await this.redis.connect();
      await this.subscriber.connect();
      
      this.isConnected = true;
      console.log("✓ Redis Leaderboard Service connected");

      return true;
    } catch (error) {
      console.error("✗ Redis connection failed:", error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable() {
    return this.isConnected && this.redis?.status === "ready";
  }

  // ==========================================
  // KEY GENERATORS
  // ==========================================
  
  getLeaderboardKey(contestId) {
    return `contest:${contestId}:leaderboard`;
  }

  getUserDataKey(contestId, userId) {
    return `contest:${contestId}:user:${userId}`;
  }

  getContestChannelKey(contestId) {
    return `contest:${contestId}:updates`;
  }

  // ==========================================
  // COMPOSITE SCORE CALCULATION
  // ==========================================
  
  /**
   * Calculate composite score for Redis sorted set
   * Format: PPPPPPTTTTTT (Problems * 10^6 + inverse time)
   * Higher problems = higher rank
   * Same problems = lower time wins
   * 
   * @param {number} problemsSolved - Number of problems solved
   * @param {number} totalTimeSeconds - Total time in seconds
   * @param {number} penaltyMinutes - Penalty minutes
   * @returns {number} Composite score
   */
  calculateCompositeScore(problemsSolved, totalTimeSeconds, penaltyMinutes = 0) {
    // Max contest duration: 12 hours = 43200 seconds
    // Max penalty: ~1000 minutes = 60000 seconds
    // Total max time component: ~100000 seconds
    const MAX_TIME = 1000000; // 1 million for safety
    
    // Total time including penalty
    const totalTime = totalTimeSeconds + (penaltyMinutes * 60);
    
    // Invert time so lower time = higher score
    const timeComponent = MAX_TIME - Math.min(totalTime, MAX_TIME - 1);
    
    // Problems solved is primary, time is secondary
    // Multiply problems by 10^7 to ensure it dominates
    const score = (problemsSolved * 10000000) + timeComponent;
    
    return score;
  }

  /**
   * Decode composite score back to components
   */
  decodeCompositeScore(compositeScore) {
    const MAX_TIME = 1000000;
    const problemsSolved = Math.floor(compositeScore / 10000000);
    const timeComponent = compositeScore % 10000000;
    const totalTimeSeconds = MAX_TIME - timeComponent;
    
    return { problemsSolved, totalTimeSeconds };
  }

  // ==========================================
  // LEADERBOARD OPERATIONS
  // ==========================================

  /**
   * Update user's score in leaderboard
   * @param {string} contestId 
   * @param {string} userId 
   * @param {object} data - { problemsSolved, totalTimeSeconds, penaltyMinutes }
   */
  async updateScore(contestId, userId, data) {
    if (!this.isAvailable()) {
      console.warn("[Leaderboard] Redis not available, skipping update");
      return false;
    }

    const { problemsSolved, totalTimeSeconds, penaltyMinutes = 0 } = data;
    const score = this.calculateCompositeScore(problemsSolved, totalTimeSeconds, penaltyMinutes);
    
    const leaderboardKey = this.getLeaderboardKey(contestId);
    const userDataKey = this.getUserDataKey(contestId, userId);

    try {
      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Update sorted set score
      pipeline.zadd(leaderboardKey, score, userId);
      
      // Store user metadata
      pipeline.hset(userDataKey, {
        problemsSolved: problemsSolved.toString(),
        totalTimeSeconds: totalTimeSeconds.toString(),
        penaltyMinutes: penaltyMinutes.toString(),
        score: score.toString(),
        updatedAt: Date.now().toString(),
      });

      // Set expiration (24 hours after contest)
      pipeline.expire(leaderboardKey, 86400);
      pipeline.expire(userDataKey, 86400);

      await pipeline.exec();

      // Publish update for real-time subscribers
      await this.publishUpdate(contestId, {
        type: "score_update",
        userId,
        problemsSolved,
        totalTimeSeconds,
        penaltyMinutes,
      });

      return true;
    } catch (error) {
      console.error("[Leaderboard] Update error:", error.message);
      return false;
    }
  }

  /**
   * Get user's current rank (1-indexed)
   */
  async getUserRank(contestId, userId) {
    if (!this.isAvailable()) return null;

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      // ZREVRANK returns 0-indexed rank (highest score = rank 0)
      const rank = await this.redis.zrevrank(leaderboardKey, userId);
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      console.error("[Leaderboard] Get rank error:", error.message);
      return null;
    }
  }

  /**
   * Get leaderboard page
   * @param {string} contestId 
   * @param {number} page - 1-indexed page number
   * @param {number} pageSize - Number of entries per page
   */
  async getLeaderboard(contestId, page = 1, pageSize = 50) {
    if (!this.isAvailable()) {
      return { entries: [], total: 0, page, pageSize };
    }

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      // Get entries with scores (highest first)
      const results = await this.redis.zrevrange(
        leaderboardKey,
        start,
        end,
        "WITHSCORES"
      );

      // Get total count
      const total = await this.redis.zcard(leaderboardKey);

      // Parse results (alternating userId, score)
      const entries = [];
      for (let i = 0; i < results.length; i += 2) {
        const userId = results[i];
        const score = parseFloat(results[i + 1]);
        const { problemsSolved, totalTimeSeconds } = this.decodeCompositeScore(score);
        
        entries.push({
          userId,
          rank: start + (i / 2) + 1,
          problemsSolved,
          totalTimeSeconds,
          score,
        });
      }

      return { entries, total, page, pageSize };
    } catch (error) {
      console.error("[Leaderboard] Get leaderboard error:", error.message);
      return { entries: [], total: 0, page, pageSize };
    }
  }

  /**
   * Get top N entries
   */
  async getTopN(contestId, n = 10) {
    return this.getLeaderboard(contestId, 1, n);
  }

  /**
   * Get user's position with surrounding entries
   */
  async getUserContext(contestId, userId, surrounding = 5) {
    if (!this.isAvailable()) return null;

    try {
      const rank = await this.getUserRank(contestId, userId);
      if (rank === null) return null;

      const leaderboardKey = this.getLeaderboardKey(contestId);
      const start = Math.max(0, rank - 1 - surrounding);
      const end = rank - 1 + surrounding;

      const results = await this.redis.zrevrange(
        leaderboardKey,
        start,
        end,
        "WITHSCORES"
      );

      const entries = [];
      for (let i = 0; i < results.length; i += 2) {
        const entryUserId = results[i];
        const score = parseFloat(results[i + 1]);
        const { problemsSolved, totalTimeSeconds } = this.decodeCompositeScore(score);
        
        entries.push({
          userId: entryUserId,
          rank: start + (i / 2) + 1,
          problemsSolved,
          totalTimeSeconds,
          isCurrentUser: entryUserId === userId,
        });
      }

      return { userRank: rank, entries };
    } catch (error) {
      console.error("[Leaderboard] Get user context error:", error.message);
      return null;
    }
  }

  // ==========================================
  // PROBLEM-SPECIFIC TRACKING
  // ==========================================

  /**
   * Record that a user solved a problem
   */
  async recordSolve(contestId, userId, problemId, solveTimeSeconds) {
    if (!this.isAvailable()) return false;

    try {
      const problemKey = `contest:${contestId}:problem:${problemId}:solves`;
      
      // Store solve with time as score
      await this.redis.zadd(problemKey, solveTimeSeconds, userId);
      await this.redis.expire(problemKey, 86400);

      // Publish solve event
      await this.publishUpdate(contestId, {
        type: "problem_solved",
        userId,
        problemId,
        solveTimeSeconds,
      });

      return true;
    } catch (error) {
      console.error("[Leaderboard] Record solve error:", error.message);
      return false;
    }
  }

  /**
   * Get solve count for a problem
   */
  async getProblemSolveCount(contestId, problemId) {
    if (!this.isAvailable()) return 0;

    try {
      const problemKey = `contest:${contestId}:problem:${problemId}:solves`;
      return await this.redis.zcard(problemKey);
    } catch (error) {
      return 0;
    }
  }

  // ==========================================
  // REAL-TIME UPDATES (Pub/Sub)
  // ==========================================

  /**
   * Publish update to contest channel
   */
  async publishUpdate(contestId, data) {
    if (!this.isAvailable()) return false;

    try {
      const channel = this.getContestChannelKey(contestId);
      await this.redis.publish(channel, JSON.stringify({
        ...data,
        timestamp: Date.now(),
      }));
      return true;
    } catch (error) {
      console.error("[Leaderboard] Publish error:", error.message);
      return false;
    }
  }

  /**
   * Subscribe to contest updates
   * @param {string} contestId 
   * @param {function} callback - Called with parsed message
   * @returns {function} Unsubscribe function
   */
  subscribeToContest(contestId, callback) {
    if (!this.subscriber) {
      console.warn("[Leaderboard] Subscriber not available");
      return () => {};
    }

    const channel = this.getContestChannelKey(contestId);
    
    const messageHandler = (ch, message) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch (e) {
          console.error("[Leaderboard] Message parse error:", e.message);
        }
      }
    };

    this.subscriber.subscribe(channel);
    this.subscriber.on("message", messageHandler);

    // Return unsubscribe function
    return () => {
      this.subscriber.unsubscribe(channel);
      this.subscriber.off("message", messageHandler);
    };
  }

  // ==========================================
  // CONTEST LIFECYCLE
  // ==========================================

  /**
   * Initialize leaderboard for a contest
   */
  async initializeContest(contestId, durationMinutes) {
    if (!this.isAvailable()) return false;

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      const expireSeconds = (durationMinutes + 1440) * 60; // Duration + 24 hours
      
      await this.redis.expire(leaderboardKey, expireSeconds);
      
      console.log(`[Leaderboard] Initialized contest ${contestId}`);
      return true;
    } catch (error) {
      console.error("[Leaderboard] Initialize error:", error.message);
      return false;
    }
  }

  /**
   * Freeze leaderboard (copy to frozen key)
   */
  async freezeLeaderboard(contestId) {
    if (!this.isAvailable()) return false;

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      const frozenKey = `${leaderboardKey}:frozen`;
      
      // Copy current leaderboard
      await this.redis.copy(leaderboardKey, frozenKey, "REPLACE");
      await this.redis.expire(frozenKey, 86400 * 7); // Keep for 7 days
      
      console.log(`[Leaderboard] Frozen contest ${contestId}`);
      return true;
    } catch (error) {
      console.error("[Leaderboard] Freeze error:", error.message);
      return false;
    }
  }

  /**
   * Get final leaderboard (for export/display)
   */
  async getFinalLeaderboard(contestId) {
    if (!this.isAvailable()) return [];

    try {
      const frozenKey = `${this.getLeaderboardKey(contestId)}:frozen`;
      const results = await this.redis.zrevrange(frozenKey, 0, -1, "WITHSCORES");

      const entries = [];
      for (let i = 0; i < results.length; i += 2) {
        const userId = results[i];
        const score = parseFloat(results[i + 1]);
        const { problemsSolved, totalTimeSeconds } = this.decodeCompositeScore(score);
        
        entries.push({
          userId,
          rank: (i / 2) + 1,
          problemsSolved,
          totalTimeSeconds,
        });
      }

      return entries;
    } catch (error) {
      console.error("[Leaderboard] Get final error:", error.message);
      return [];
    }
  }

  /**
   * Clean up contest data
   */
  async cleanupContest(contestId) {
    if (!this.isAvailable()) return false;

    try {
      const pattern = `contest:${contestId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      console.log(`[Leaderboard] Cleaned up contest ${contestId}`);
      return true;
    } catch (error) {
      console.error("[Leaderboard] Cleanup error:", error.message);
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.redis) {
        await this.redis.quit();
      }
      this.isConnected = false;
      console.log("✓ Redis Leaderboard Service disconnected");
    } catch (error) {
      console.error("[Leaderboard] Disconnect error:", error.message);
    }
  }
}

// Singleton instance
const leaderboardService = new LeaderboardService();

export default leaderboardService;
