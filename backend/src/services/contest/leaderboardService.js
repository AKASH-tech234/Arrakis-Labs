import Redis from "ioredis";

class LeaderboardService {
  constructor() {
    this.redis = null;
    this.subscriber = null;
    this.isConnected = false;
  }

  async connect() {
    const redisUrl = process.env.REDIS_URL;

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

  isAvailable() {
    return this.isConnected && this.redis?.status === "ready";
  }

  getLeaderboardKey(contestId) {
    return `contest:${contestId}:leaderboard`;
  }

  getUserDataKey(contestId, userId) {
    return `contest:${contestId}:user:${userId}`;
  }

  getContestChannelKey(contestId) {
    return `contest:${contestId}:updates`;
  }

  calculateCompositeScore(problemsSolved, totalTimeSeconds, penaltyMinutes = 0) {

    const MAX_TIME = 1000000; 

    const totalTime = totalTimeSeconds + (penaltyMinutes * 60);

    const timeComponent = MAX_TIME - Math.min(totalTime, MAX_TIME - 1);

    const score = (problemsSolved * 10000000) + timeComponent;
    
    return score;
  }

  decodeCompositeScore(compositeScore) {
    const MAX_TIME = 1000000;
    const problemsSolved = Math.floor(compositeScore / 10000000);
    const timeComponent = compositeScore % 10000000;
    const totalTimeSeconds = MAX_TIME - timeComponent;
    
    return { problemsSolved, totalTimeSeconds };
  }

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
      
      const pipeline = this.redis.pipeline();

      pipeline.zadd(leaderboardKey, score, userId);

      pipeline.hset(userDataKey, {
        problemsSolved: problemsSolved.toString(),
        totalTimeSeconds: totalTimeSeconds.toString(),
        penaltyMinutes: penaltyMinutes.toString(),
        score: score.toString(),
        updatedAt: Date.now().toString(),
      });

      pipeline.expire(leaderboardKey, 86400);
      pipeline.expire(userDataKey, 86400);

      await pipeline.exec();

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

  async getUserRank(contestId, userId) {
    if (!this.isAvailable()) return null;

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      
      const rank = await this.redis.zrevrank(leaderboardKey, userId);
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      console.error("[Leaderboard] Get rank error:", error.message);
      return null;
    }
  }

  async getLeaderboard(contestId, page = 1, pageSize = 50) {
    if (!this.isAvailable()) {
      return { entries: [], total: 0, page, pageSize };
    }

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      const results = await this.redis.zrevrange(
        leaderboardKey,
        start,
        end,
        "WITHSCORES"
      );

      const total = await this.redis.zcard(leaderboardKey);

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

  async getTopN(contestId, n = 10) {
    return this.getLeaderboard(contestId, 1, n);
  }

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

  async recordSolve(contestId, userId, problemId, solveTimeSeconds) {
    if (!this.isAvailable()) return false;

    try {
      const problemKey = `contest:${contestId}:problem:${problemId}:solves`;

      await this.redis.zadd(problemKey, solveTimeSeconds, userId);
      await this.redis.expire(problemKey, 86400);

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

  async getProblemSolveCount(contestId, problemId) {
    if (!this.isAvailable()) return 0;

    try {
      const problemKey = `contest:${contestId}:problem:${problemId}:solves`;
      return await this.redis.zcard(problemKey);
    } catch (error) {
      return 0;
    }
  }

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

    return () => {
      this.subscriber.unsubscribe(channel);
      this.subscriber.off("message", messageHandler);
    };
  }

  async initializeContest(contestId, durationMinutes) {
    if (!this.isAvailable()) return false;

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      const expireSeconds = (durationMinutes + 1440) * 60; 
      
      await this.redis.expire(leaderboardKey, expireSeconds);
      
      console.log(`[Leaderboard] Initialized contest ${contestId}`);
      return true;
    } catch (error) {
      console.error("[Leaderboard] Initialize error:", error.message);
      return false;
    }
  }

  async freezeLeaderboard(contestId) {
    if (!this.isAvailable()) return false;

    try {
      const leaderboardKey = this.getLeaderboardKey(contestId);
      const frozenKey = `${leaderboardKey}:frozen`;

      await this.redis.copy(leaderboardKey, frozenKey, "REPLACE");
      await this.redis.expire(frozenKey, 86400 * 7); 
      
      console.log(`[Leaderboard] Frozen contest ${contestId}`);
      return true;
    } catch (error) {
      console.error("[Leaderboard] Freeze error:", error.message);
      return false;
    }
  }

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

const leaderboardService = new LeaderboardService();

export default leaderboardService;
