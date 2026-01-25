import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import leaderboardService from "./leaderboardService.js";

class ContestWebSocketServer {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); 
    this.clientData = new WeakMap(); 
    this.heartbeatInterval = null;
    this.redisContestSubscriptions = new Map(); 
  }

  ensureRedisSubscription(contestId) {
    if (this.redisContestSubscriptions.has(contestId)) return;

    const unsubscribe = leaderboardService.subscribeToContest(
      contestId,
      async (event) => {
        try {
          
          const leaderboard = await leaderboardService.getTopN(contestId, 50);
          this.notifyLeaderboardUpdate(contestId, {
            entries: leaderboard.entries,
            event,
          });
        } catch (error) {
          console.error(
            `[WS] Failed to broadcast leaderboard update for ${contestId}:`,
            error?.message || error
          );
        }
      }
    );

    this.redisContestSubscriptions.set(contestId, unsubscribe);
  }

  cleanupRedisSubscription(contestId) {
    const unsubscribe = this.redisContestSubscriptions.get(contestId);
    if (!unsubscribe) return;

    try {
      unsubscribe();
    } catch (error) {
      console.error(
        `[WS] Failed to unsubscribe Redis updates for ${contestId}:`,
        error?.message || error
      );
    }

    this.redisContestSubscriptions.delete(contestId);
  }

  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/contest",
      
      verifyClient: ({ origin, req }, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          "http://localhost:5173",
          "http://localhost:5174",
        ].filter(Boolean);

        if (!origin) {
          callback(true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(true);
        } else {
          console.warn(`[WS] Rejected connection from origin: ${origin}`);
          callback(false, 403, "Forbidden");
        }
      },
    });

    this.wss.on("error", (error) => {
      console.error("[WS] Server error:", error?.message || error);
    });

    this.wss.on("connection", this.handleConnection.bind(this));

    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const data = this.clientData.get(ws);
        if (data?.isAlive === false) {
          this.removeFromRoom(ws);
          return ws.terminate();
        }
        data.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log("✓ Contest WebSocket Server initialized");
  }

  handleConnection(ws, req) {
    
    this.clientData.set(ws, {
      isAlive: true,
      userId: null,
      contestId: null,
      authenticated: false,
      connectedAt: Date.now(),
    });

    this.tryAuthFromCookie(ws, req);

    ws.on("pong", () => {
      const data = this.clientData.get(ws);
      if (data) data.isAlive = true;
    });

    ws.on("message", (message) => {
      this.handleMessage(ws, message);
    });

    ws.on("close", () => {
      this.removeFromRoom(ws);
      this.clientData.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("[WS] Client error:", error.message);
      this.removeFromRoom(ws);
    });

    this.send(ws, {
      type: "connected",
      message: "Connected to contest server",
      timestamp: Date.now(),
    });
  }

  async handleMessage(ws, rawMessage) {
    try {
      const message = JSON.parse(rawMessage.toString());
      const { type, payload } = message;

      switch (type) {
        case "authenticate":
          await this.handleAuthenticate(ws, payload);
          break;
        case "join_contest":
          await this.handleJoinContest(ws, payload);
          break;
        case "leave_contest":
          this.handleLeaveContest(ws);
          break;
        case "get_leaderboard":
          await this.handleGetLeaderboard(ws, payload);
          break;
        case "get_time":
          this.handleGetTime(ws);
          break;
        case "ping":
          this.send(ws, { type: "pong", timestamp: Date.now() });
          break;
        default:
          this.send(ws, { type: "error", message: `Unknown message type: ${type}` });
      }
    } catch (error) {
      console.error("[WS] Message handling error:", error.message);
      this.send(ws, { type: "error", message: "Invalid message format" });
    }
  }

  async handleAuthenticate(ws, payload) {
    const { token } = payload || {};
    
    if (!token) {
      this.send(ws, { type: "auth_error", message: "Token required" });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const data = this.clientData.get(ws);
      
      data.userId = decoded.id;
      data.authenticated = true;
      
      this.send(ws, {
        type: "authenticated",
        userId: decoded.id,
      });
    } catch (error) {
      this.send(ws, { type: "auth_error", message: "Invalid token" });
    }
  }

  tryAuthFromCookie(ws, req) {
    try {
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) return false;

      const cookies = cookie.parse(cookieHeader);
      
      const token = cookies.userToken || cookies.token;
      if (!token) return false;

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const data = this.clientData.get(ws);

      data.userId = decoded.id;
      data.authenticated = true;

      this.send(ws, {
        type: "authenticated",
        userId: decoded.id,
        method: "cookie",
      });

      return true;
    } catch {
      return false;
    }
  }

  async handleJoinContest(ws, payload) {
    const { contestId } = payload || {};
    const data = this.clientData.get(ws);

    if (!contestId) {
      this.send(ws, { type: "error", message: "Contest ID required" });
      return;
    }

    if (data.contestId) {
      this.removeFromRoom(ws);
    }

    if (!this.rooms.has(contestId)) {
      this.rooms.set(contestId, new Set());
    }
    this.rooms.get(contestId).add(ws);
    data.contestId = contestId;

    this.ensureRedisSubscription(contestId);

    const leaderboard = await leaderboardService.getTopN(contestId, 20);
    
    this.send(ws, {
      type: "joined_contest",
      contestId,
      participantCount: this.rooms.get(contestId).size,
      leaderboard: leaderboard.entries,
    });

    this.broadcastToContest(contestId, {
      type: "participant_count",
      count: this.rooms.get(contestId).size,
    }, ws);
  }

  handleLeaveContest(ws) {
    this.removeFromRoom(ws);
    this.send(ws, { type: "left_contest" });
  }

  async handleGetLeaderboard(ws, payload) {
    const data = this.clientData.get(ws);
    const { page = 1, pageSize = 50 } = payload || {};

    if (!data.contestId) {
      this.send(ws, { type: "error", message: "Not in a contest" });
      return;
    }

    const leaderboard = await leaderboardService.getLeaderboard(
      data.contestId,
      page,
      pageSize
    );

    this.send(ws, {
      type: "leaderboard",
      ...leaderboard,
    });
  }

  handleGetTime(ws) {
    this.send(ws, {
      type: "server_time",
      timestamp: Date.now(),
    });
  }

  removeFromRoom(ws) {
    const data = this.clientData.get(ws);
    if (!data?.contestId) return;

    const contestId = data.contestId;

    const room = this.rooms.get(contestId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(contestId);
        this.cleanupRedisSubscription(contestId);
      } else {
        
        this.broadcastToContest(contestId, {
          type: "participant_count",
          count: room.size,
        });
      }
    }
    data.contestId = null;
  }

  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  broadcastToContest(contestId, data, exclude = null) {
    const room = this.rooms.get(contestId);
    if (!room) return;

    const message = JSON.stringify(data);
    room.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  notifyLeaderboardUpdate(contestId, update) {
    this.broadcastToContest(contestId, {
      type: "leaderboard_update",
      ...update,
      timestamp: Date.now(),
    });
  }

  notifySubmissionResult(contestId, userId, result) {
    const room = this.rooms.get(contestId);
    if (!room) return;

    room.forEach((client) => {
      const data = this.clientData.get(client);
      if (data?.userId === userId) {
        this.send(client, {
          type: "submission_result",
          ...result,
          timestamp: Date.now(),
        });
      }
    });

    if (result.verdict === "accepted") {
      this.broadcastToContest(contestId, {
        type: "solve_notification",
        problemLabel: result.problemLabel,
        solveCount: result.solveCount,
        timestamp: Date.now(),
      });
    }
  }

  notifyContestStatus(contestId, status, data = {}) {
    this.broadcastToContest(contestId, {
      type: "contest_status",
      status,
      ...data,
      timestamp: Date.now(),
    });
  }

  notifyContestStart(contestId, endTime) {
    this.broadcastToContest(contestId, {
      type: "contest_started",
      endTime: endTime.toISOString(),
      serverTime: Date.now(),
    });
  }

  notifyContestEnd(contestId) {
    this.broadcastToContest(contestId, {
      type: "contest_ended",
      serverTime: Date.now(),
    });
  }

  sendAnnouncement(contestId, message, priority = "normal") {
    this.broadcastToContest(contestId, {
      type: "announcement",
      message,
      priority,
      timestamp: Date.now(),
    });
  }

  getOnlineCount(contestId) {
    const room = this.rooms.get(contestId);
    return room ? room.size : 0;
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
    console.log("✓ Contest WebSocket Server closed");
  }
}

const wsServer = new ContestWebSocketServer();

export default wsServer;
