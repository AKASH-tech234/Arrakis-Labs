import { OAReport, OASession } from "../../models/oa/index.js";
import { reportGenerator } from "../../services/oa/index.js";

export const getReport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OASession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    if (!["submitted", "terminated", "expired"].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: "Report not available - session not completed",
        status: session.status,
      });
    }

    let report = await OAReport.findOne({ sessionId });

    if (!report) {

      try {
        report = await reportGenerator.generateReport(sessionId);
      } catch (err) {
        console.error("Error generating report:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to generate report",
        });
      }
    }

    res.json({
      success: true,
      data: {
        reportId: report._id,
        sessionId: report.sessionId,
        startedAt: report.startedAt,
        submittedAt: report.submittedAt,
        totalTimeSeconds: report.totalTimeSeconds,
        score: report.score,
        codingPerformance: report.codingPerformance,
        topicWise: report.topicWise,
        difficultyWise: report.difficultyWise,
        timeAnalysis: report.timeAnalysis,
        integrity: report.integrity,
        insights: report.insights,
      },
    });
  } catch (error) {
    console.error("Error getting report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get report",
      message: error.message,
    });
  }
};

export const getReportAnswers = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OASession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    if (!["submitted", "terminated", "expired"].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: "Answers not available - session not completed",
      });
    }

    const report = await OAReport.findOne({ sessionId }).select("rawAnswers");

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    res.json({
      success: true,
      data: {
        answers: report.rawAnswers,
      },
    });
  } catch (error) {
    console.error("Error getting report answers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get report answers",
      message: error.message,
    });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const reports = await OAReport.find({ userId }).lean();

    if (reports.length === 0) {
      return res.json({
        success: true,
        data: {
          totalOAs: 0,
          avgScore: 0,
          practiceLevel: "beginner",
          strongTopics: [],
          weakTopics: [],
          recentTrend: "neutral",
        },
      });
    }

    const totalOAs = reports.length;
    const avgScore =
      reports.reduce((sum, r) => sum + (r.score?.percentage || 0), 0) / totalOAs;

    const recent = reports
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5);

    let trend = "neutral";
    if (recent.length >= 3) {
      const recentAvg =
        recent.slice(0, 3).reduce((sum, r) => sum + (r.score?.percentage || 0), 0) / 3;
      const olderAvg =
        reports.length > 3
          ? reports.slice(3).reduce((sum, r) => sum + (r.score?.percentage || 0), 0) /
            Math.max(1, reports.length - 3)
          : recentAvg;

      if (recentAvg > olderAvg + 5) trend = "improving";
      else if (recentAvg < olderAvg - 5) trend = "declining";
    }

    const topicAgg = {};
    for (const report of reports) {
      for (const topic of report.topicWise || []) {
        if (!topicAgg[topic.topic]) {
          topicAgg[topic.topic] = {
            topic: topic.topic,
            attempted: 0,
            fullySolved: 0,
            totalPassRate: 0,
            count: 0,
          };
        }
        topicAgg[topic.topic].attempted += topic.attempted;
        topicAgg[topic.topic].fullySolved += topic.fullySolved;
        topicAgg[topic.topic].totalPassRate += topic.avgTestCasePass;
        topicAgg[topic.topic].count++;
      }
    }

    const topicStats = Object.values(topicAgg)
      .map((t) => ({
        topic: t.topic,
        attempted: t.attempted,
        fullySolved: t.fullySolved,
        avgPassRate: t.count > 0 ? t.totalPassRate / t.count : 0,
      }))
      .sort((a, b) => b.attempted - a.attempted);

    const strongTopics = topicStats
      .filter((t) => t.avgPassRate >= 0.7 && t.attempted >= 2)
      .slice(0, 3)
      .map((t) => t.topic);

    const weakTopics = topicStats
      .filter((t) => t.avgPassRate < 0.5 && t.attempted >= 2)
      .sort((a, b) => a.avgPassRate - b.avgPassRate)
      .slice(0, 3)
      .map((t) => t.topic);

    let practiceLevel = "beginner";
    if (totalOAs >= 10 && avgScore >= 80) practiceLevel = "advanced";
    else if (totalOAs >= 5 && avgScore >= 70) practiceLevel = "intermediate";
    else if (totalOAs >= 3 && avgScore >= 50) practiceLevel = "developing";

    res.json({
      success: true,
      data: {
        totalOAs,
        avgScore: Math.round(avgScore * 10) / 10,
        practiceLevel,
        strongTopics,
        weakTopics,
        recentTrend: trend,
        topicStats,
        recentReports: recent.map((r) => ({
          sessionId: r.sessionId,
          submittedAt: r.submittedAt,
          score: r.score?.percentage || 0,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user stats",
      message: error.message,
    });
  }
};
