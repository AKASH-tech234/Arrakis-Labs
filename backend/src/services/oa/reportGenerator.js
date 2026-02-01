import Question from "../../models/question/Question.js";
import {
  OASession,
  OAAnswer,
  OAViolation,
  OAReport,
  UserOAHistory,
} from "../../models/oa/index.js";

class ReportGenerator {

  async generateReport(sessionId) {
    console.log("[ReportGenerator] Generating report for session:", sessionId);

    const existingReport = await OAReport.findOne({ sessionId });
    if (existingReport) {
      console.log("[ReportGenerator] Report already exists");
      return existingReport;
    }

    const session = await OASession.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const answers = await OAAnswer.find({ sessionId });
    const violations = await OAViolation.find({ sessionId });

    const codingPerformance = this.calculateCodingPerformance(session, answers);
    const score = this.calculateTotalScore(codingPerformance, session);
    const topicWise = await this.calculateTopicBreakdown(session, answers);
    const difficultyWise = this.calculateDifficultyBreakdown(session, answers);
    const timeAnalysis = this.calculateTimeAnalysis(session, answers);
    const integrity = this.assessIntegrity(session, violations);
    const insights = await this.generateInsights({
      score,
      codingPerformance,
      topicWise,
      difficultyWise,
      timeAnalysis,
      integrity,
      session,
    });

    const rawAnswers = await this.buildRawAnswers(session, answers);

    const report = await OAReport.create({
      sessionId,
      userId: session.userId,
      startedAt: session.actualStartedAt || session.startAt,
      submittedAt: session.submittedAt || new Date(),
      totalTimeSeconds: this.calculateTotalTime(session),
      score,
      codingPerformance,
      topicWise,
      difficultyWise,
      timeAnalysis,
      integrity,
      insights,
      rawAnswers,
    });

    await this.updateUserHistory(session.userId, report, session, answers);

    console.log("[ReportGenerator] Report generated successfully");
    return report;
  }

  calculateCodingPerformance(session, answers) {
    const totalQuestions = session.questions.length;
    let attempted = 0;
    let fullySolved = 0;
    let partiallySolved = 0;
    let totalScore = 0;
    let maxScore = 0;
    let totalPassRate = 0;

    for (const q of session.questions) {
      const answer = answers.find(
        (a) => a.refId.toString() === q.refId.toString()
      );
      maxScore += q.points;

      if (answer?.submission?.isSubmitted) {
        attempted++;
        const passRate =
          answer.submission.totalCount > 0
            ? answer.submission.passedCount / answer.submission.totalCount
            : 0;

        totalPassRate += passRate;

        if (passRate === 1) {
          fullySolved++;
          totalScore += q.points;
        } else if (passRate > 0) {
          partiallySolved++;
          totalScore += Math.round(q.points * passRate);
        }
      } else if (answer?.answer?.code && answer.answer.code.trim()) {

        attempted++;
      }
    }

    return {
      attempted,
      fullySolved,
      partiallySolved,
      notSolved: totalQuestions - fullySolved - partiallySolved,
      totalQuestions,
      score: totalScore,
      maxScore,
      avgTestCasePass: attempted > 0 ? totalPassRate / attempted : 0,
    };
  }

  calculateTotalScore(codingPerformance, session) {
    const earned = codingPerformance.score;
    const total = codingPerformance.maxScore || session.totalPoints || 100;
    const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;

    return { earned, total, percentage };
  }

  async calculateTopicBreakdown(session, answers) {
    const topicMap = new Map();

    for (const q of session.questions) {
      const topic = q.topicSnapshot || "Unknown";
      const answer = answers.find(
        (a) => a.refId.toString() === q.refId.toString()
      );

      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          attempted: 0,
          fullySolved: 0,
          partiallySolved: 0,
          totalPassRate: 0,
          totalTime: 0,
          count: 0,
        });
      }

      const stats = topicMap.get(topic);
      stats.count++;

      if (answer?.submission?.isSubmitted) {
        stats.attempted++;
        const passRate =
          answer.submission.totalCount > 0
            ? answer.submission.passedCount / answer.submission.totalCount
            : 0;

        stats.totalPassRate += passRate;

        if (passRate === 1) {
          stats.fullySolved++;
        } else if (passRate > 0) {
          stats.partiallySolved++;
        }
      }

      if (answer?.timeSpentSeconds) {
        stats.totalTime += answer.timeSpentSeconds;
      }
    }

    const result = [];
    for (const [topic, stats] of topicMap.entries()) {
      const accuracy =
        stats.attempted > 0 ? stats.fullySolved / stats.attempted : 0;
      const avgPassRate =
        stats.attempted > 0 ? stats.totalPassRate / stats.attempted : 0;

      result.push({
        topic,
        attempted: stats.attempted,
        fullySolved: stats.fullySolved,
        partiallySolved: stats.partiallySolved,
        accuracy,
        avgTimeSeconds: stats.attempted > 0 ? stats.totalTime / stats.attempted : 0,
        avgTestCasePass: avgPassRate,
        status:
          avgPassRate >= 0.8 ? "strong" : avgPassRate >= 0.5 ? "moderate" : "weak",
      });
    }

    return result.sort((a, b) => b.attempted - a.attempted);
  }

  calculateDifficultyBreakdown(session, answers) {
    const result = {
      easy: { attempted: 0, fullySolved: 0, total: 0, accuracy: 0, avgTestCasePass: 0, totalPassRate: 0 },
      medium: { attempted: 0, fullySolved: 0, total: 0, accuracy: 0, avgTestCasePass: 0, totalPassRate: 0 },
      hard: { attempted: 0, fullySolved: 0, total: 0, accuracy: 0, avgTestCasePass: 0, totalPassRate: 0 },
    };

    for (const q of session.questions) {
      const diff = (q.difficultySnapshot || "Medium").toLowerCase();
      const key = diff === "easy" ? "easy" : diff === "hard" ? "hard" : "medium";
      const answer = answers.find(
        (a) => a.refId.toString() === q.refId.toString()
      );

      result[key].total++;

      if (answer?.submission?.isSubmitted) {
        result[key].attempted++;
        const passRate =
          answer.submission.totalCount > 0
            ? answer.submission.passedCount / answer.submission.totalCount
            : 0;

        result[key].totalPassRate += passRate;

        if (passRate === 1) {
          result[key].fullySolved++;
        }
      }
    }

    for (const key of ["easy", "medium", "hard"]) {
      const stats = result[key];
      stats.accuracy =
        stats.attempted > 0 ? stats.fullySolved / stats.attempted : 0;
      stats.avgTestCasePass =
        stats.attempted > 0 ? stats.totalPassRate / stats.attempted : 0;
      delete stats.totalPassRate;
    }

    return result;
  }

  calculateTimeAnalysis(session, answers) {
    const perQuestion = [];
    let totalTime = 0;
    let fastestQuestion = null;
    let slowestQuestion = null;

    for (const q of session.questions) {
      const answer = answers.find(
        (a) => a.refId.toString() === q.refId.toString()
      );
      const timeSpent = answer?.timeSpentSeconds || 0;
      const passRate =
        answer?.submission?.totalCount > 0
          ? answer.submission.passedCount / answer.submission.totalCount
          : 0;

      totalTime += timeSpent;

      const questionData = {
        refId: q.refId,
        title: q.titleSnapshot,
        topic: q.topicSnapshot,
        difficulty: q.difficultySnapshot,
        seconds: timeSpent,
        passRate,
        verdict: answer?.submission?.verdict || "not_attempted",
      };

      perQuestion.push(questionData);

      if (timeSpent > 0) {
        if (!fastestQuestion || timeSpent < fastestQuestion.seconds) {
          fastestQuestion = questionData;
        }
        if (!slowestQuestion || timeSpent > slowestQuestion.seconds) {
          slowestQuestion = questionData;
        }
      }
    }

    return {
      avgTimePerQuestion:
        perQuestion.length > 0 ? totalTime / perQuestion.length : 0,
      fastestQuestion: fastestQuestion
        ? {
            refId: fastestQuestion.refId,
            title: fastestQuestion.title,
            seconds: fastestQuestion.seconds,
          }
        : null,
      slowestQuestion: slowestQuestion
        ? {
            refId: slowestQuestion.refId,
            title: slowestQuestion.title,
            seconds: slowestQuestion.seconds,
          }
        : null,
      perQuestion,
    };
  }

  assessIntegrity(session, violations) {
    const tabSwitches = violations.filter(
      (v) => v.type === "tab_hidden" || v.type === "tab_blur"
    ).length;

    const warningsUsed = session.proctoring?.warningCount || 0;
    const warningsAllowed = session.proctoring?.warningsAllowed || 3;
    const wasTerminated =
      session.terminatedReason === "warnings_exceeded" ||
      session.status === "terminated";

    let status = "clean";
    if (wasTerminated) {
      status = "violated";
    } else if (warningsUsed > 0) {
      status = "warnings_used";
    }

    return {
      tabSwitches,
      warningsUsed,
      warningsAllowed,
      wasTerminated,
      terminatedReason: session.terminatedReason,
      status,
    };
  }

  async generateInsights(data) {
    const { score, codingPerformance, topicWise, difficultyWise, integrity } = data;

    const practiceLevel = OAReport.calculatePracticeLevel(
      score.percentage,
      difficultyWise
    );

    const weakTopics = topicWise
      .filter((t) => t.avgTestCasePass < 0.5 && t.attempted >= 1)
      .sort((a, b) => a.avgTestCasePass - b.avgTestCasePass)
      .slice(0, 3)
      .map((t) => t.topic);

    const strongTopics = topicWise
      .filter((t) => t.avgTestCasePass >= 0.7 && t.attempted >= 1)
      .sort((a, b) => b.avgTestCasePass - a.avgTestCasePass)
      .slice(0, 3)
      .map((t) => t.topic);

    const recommendations = [];

    if (codingPerformance.attempted === 0) {
      recommendations.push({
        type: "participation",
        message: "No questions were attempted in this OA",
        actionable: "Try to attempt at least one problem next time, even if partially",
      });
    } else if (codingPerformance.fullySolved === 0 && codingPerformance.partiallySolved === 0) {

      recommendations.push({
        type: "fundamentals",
        message: "Focus on understanding problem requirements before coding",
        actionable: "Practice reading problems carefully and testing with examples",
      });
    }

    if (weakTopics.length > 0) {
      recommendations.push({
        type: "topic",
        message: `Focus on improving: ${weakTopics.join(", ")}`,
        actionable: `Practice 5-10 problems from ${weakTopics[0]}`,
      });
    }

    if (codingPerformance.avgTestCasePass < 0.5 && codingPerformance.attempted > 0) {
      recommendations.push({
        type: "accuracy",
        message: "Focus on getting more test cases to pass",
        actionable: "Pay attention to edge cases and boundary conditions",
      });
    }

    if (
      difficultyWise.hard.avgTestCasePass < 0.3 &&
      difficultyWise.medium.avgTestCasePass > 0.7
    ) {
      recommendations.push({
        type: "difficulty",
        message: "Ready to tackle more hard problems",
        actionable: "Include 1-2 hard problems in daily practice",
      });
    }

    if (integrity.warningsUsed > 0) {
      recommendations.push({
        type: "focus",
        message: "Avoid switching tabs during OA",
        actionable: "Practice staying focused for longer durations",
      });
    }

    const recommendedProblems = await this.getRecommendedProblems(
      weakTopics,
      data.session.userId
    );

    return {
      practiceLevel,
      weakTopics,
      strongTopics,
      recommendations,
      recommendedProblems,
      comparisonToAvg: {
        score: score.percentage >= 70 ? "above" : score.percentage >= 50 ? "average" : "below",
        percentile: this.estimatePercentile(score.percentage),
      },
    };
  }

  async getRecommendedProblems(weakTopics, userId) {
    if (weakTopics.length === 0) return [];

    const userHistory = await UserOAHistory.findOne({ userId });
    const attemptedIds = new Set(
      userHistory?.attemptedCoding?.map((c) => c.questionId.toString()) || []
    );

    const problems = await Question.find({
      isActive: true,
      $or: [
        { topic: { $in: weakTopics } },
        { categoryType: { $in: weakTopics } },
        { tags: { $in: weakTopics } },
      ],
      _id: { $nin: Array.from(attemptedIds) },
    })
      .limit(5)
      .lean();

    return problems.map((p) => ({
      problemId: p._id,
      title: p.title,
      topic: p.topic || p.categoryType,
      difficulty: p.difficulty,
      reason: `Practice for ${p.topic || p.categoryType}`,
    }));
  }

  estimatePercentile(percentage) {
    if (percentage >= 90) return 95;
    if (percentage >= 80) return 85;
    if (percentage >= 70) return 70;
    if (percentage >= 60) return 55;
    if (percentage >= 50) return 40;
    return 25;
  }

  async buildRawAnswers(session, answers) {
    return session.questions.map((q) => {
      const answer = answers.find(
        (a) => a.refId.toString() === q.refId.toString()
      );

      return {
        refId: q.refId,
        title: q.titleSnapshot,
        topic: q.topicSnapshot,
        difficulty: q.difficultySnapshot,
        code: answer?.answer?.code || "",
        language: answer?.answer?.language || "python",
        passedCount: answer?.submission?.passedCount || 0,
        totalCount: answer?.submission?.totalCount || 0,
        verdict: answer?.submission?.verdict || "not_attempted",
        pointsEarned: answer?.pointsEarned || 0,
        maxPoints: q.points,
        timeSpent: answer?.timeSpentSeconds || 0,
      };
    });
  }

  calculateTotalTime(session) {
    const start = session.actualStartedAt || session.startAt;
    const end = session.submittedAt || session.endAt;
    return Math.floor((new Date(end) - new Date(start)) / 1000);
  }

  async updateUserHistory(userId, report, session, answers) {
    const history = await UserOAHistory.getOrCreate(userId);

    if (!history.topicProficiency || !(history.topicProficiency instanceof Map)) {
      history.topicProficiency = new Map();
    }
    if (!history.difficultyProficiency) {
      history.difficultyProficiency = {
        easy: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
        medium: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
        hard: { attempted: 0, fullySolved: 0, avgPassRate: 0 },
      };
    }

    const defaultDiffStats = { attempted: 0, fullySolved: 0, avgPassRate: 0 };
    if (!history.difficultyProficiency.easy) history.difficultyProficiency.easy = { ...defaultDiffStats };
    if (!history.difficultyProficiency.medium) history.difficultyProficiency.medium = { ...defaultDiffStats };
    if (!history.difficultyProficiency.hard) history.difficultyProficiency.hard = { ...defaultDiffStats };

    for (const q of session.questions) {
      const answer = answers.find(
        (a) => a.refId.toString() === q.refId.toString()
      );
      const passRate =
        answer?.submission?.totalCount > 0
          ? answer.submission.passedCount / answer.submission.totalCount
          : 0;

      const existingIdx = history.attemptedCoding.findIndex(
        (c) => c.questionId.toString() === q.refId.toString()
      );

      if (existingIdx >= 0) {
        const existing = history.attemptedCoding[existingIdx];
        existing.attemptCount += 1;
        existing.lastAttemptedAt = new Date();
        if (passRate > existing.bestPassRate) {
          existing.bestPassRate = passRate;
          existing.bestVerdict = answer?.submission?.verdict;
        }
      } else {
        history.attemptedCoding.push({
          questionId: q.refId,
          lastAttemptedAt: new Date(),
          bestPassRate: passRate,
          attemptCount: 1,
          bestVerdict: answer?.submission?.verdict,
        });
      }

      const topic = q.topicSnapshot;
      if (topic) {
        const topicStats = history.topicProficiency.get(topic) || {
          attempted: 0,
          fullySolved: 0,
          partiallySolved: 0,
          avgPassRate: 0,
          avgTime: 0,
        };

        const newAttempted = topicStats.attempted + 1;
        topicStats.avgPassRate =
          (topicStats.avgPassRate * topicStats.attempted + passRate) /
          newAttempted;
        topicStats.attempted = newAttempted;

        if (passRate === 1) topicStats.fullySolved++;
        else if (passRate > 0) topicStats.partiallySolved++;

        topicStats.lastAttempted = new Date();
        history.topicProficiency.set(topic, topicStats);
      }

      const diff = (q.difficultySnapshot || "Medium").toLowerCase();
      const diffKey =
        diff === "easy" ? "easy" : diff === "hard" ? "hard" : "medium";
      const diffStats = history.difficultyProficiency[diffKey];
      const newDiffAttempted = diffStats.attempted + 1;
      diffStats.avgPassRate =
        (diffStats.avgPassRate * diffStats.attempted + passRate) /
        newDiffAttempted;
      diffStats.attempted = newDiffAttempted;
      if (passRate === 1) diffStats.fullySolved++;
    }

    await history.updateAfterOA(report);
  }
}

export default new ReportGenerator();
