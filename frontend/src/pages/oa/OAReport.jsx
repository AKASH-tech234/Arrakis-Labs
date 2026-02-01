import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronRight,
  Code,
  ArrowLeft,
} from "lucide-react";
import oaService from "../../services/oaService";
import AppHeader from "../../components/layout/AppHeader";
import { Badge, Button, Card, SectionTitle } from "../../components/ui/ds";

export default function OAReport() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAnswers, setExpandedAnswers] = useState({});

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);

        const reportRes = await oaService.getReport(sessionId);
        if (reportRes.success) {
          setReport(reportRes.data);
        } else {
          setError(reportRes.error || "Failed to load report");
          return;
        }

        const answersRes = await oaService.getReportAnswers(sessionId);
        if (answersRes.success) {
          setAnswers(answersRes.data.answers || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [sessionId]);

  const toggleAnswer = (refId) => {
    setExpandedAnswers((prev) => ({
      ...prev,
      [refId]: !prev[refId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A08" }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F59E0B]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A08" }}>
        <Card className="p-6 border-[#7F1D1D] bg-[#2A0F0F] text-[#FCA5A5] max-w-md">
          <h2
            className="text-xl font-semibold mb-2 tracking-wider uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Error
          </h2>
          <p style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{error}</p>
          <Button onClick={() => navigate("/oa")} variant="secondary" size="md" className="mt-6">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const { score, codingPerformance, topicWise, difficultyWise, timeAnalysis, integrity, insights } =
    report;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />
      <main className="pt-14">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
          <div className="mb-10">
            <Button as={Link} to="/oa" variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <SectionTitle
              title="OA Report"
              subtitle={`Completed on ${new Date(report.submittedAt).toLocaleString()}`}
            />
          </div>

        {}
        <Card className="p-6 mb-10 bg-gradient-to-r from-[#2A1F0F] to-[#121210]">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-semibold mb-2 tracking-wider uppercase text-[#E8E4D9]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Overall Score
              </h2>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-[#F59E0B]">{score.percentage}%</span>
                <span className="text-[#A29A8C]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                  ({score.earned}/{score.total} points)
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2">
                <Award className="w-5 h-5" />
                <Badge
                  variant={
                    insights?.practiceLevel === "advanced"
                      ? "neutral"
                      : insights?.practiceLevel === "intermediate"
                        ? "upcoming"
                        : "ended"
                  }
                >
                  {(insights?.practiceLevel || "beginner") + " level"}
                </Badge>
              </div>
            </div>
          </div>

          {}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <Card className="p-4 bg-[#121210]">
              <div className="text-2xl font-bold text-[#86EFAC]">
                {codingPerformance.fullySolved}
              </div>
              <div className="text-xs text-[#78716C] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Fully Solved</div>
            </Card>
            <Card className="p-4 bg-[#121210]">
              <div className="text-2xl font-bold text-[#FDE68A]">
                {codingPerformance.partiallySolved}
              </div>
              <div className="text-xs text-[#78716C] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Partial</div>
            </Card>
            <Card className="p-4 bg-[#121210]">
              <div className="text-2xl font-bold text-[#FCA5A5]">
                {codingPerformance.notSolved}
              </div>
              <div className="text-xs text-[#78716C] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Not Solved</div>
            </Card>
            <Card className="p-4 bg-[#121210]">
              <div className="text-2xl font-bold text-[#E8E4D9]">
                {Math.floor(report.totalTimeSeconds / 60)}m
              </div>
              <div className="text-xs text-[#78716C] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Time Taken</div>
            </Card>
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-8 mb-10">
          {}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Topic Performance
            </h3>
            {topicWise.length > 0 ? (
              <div className="space-y-3">
                {topicWise.map((topic) => (
                  <div key={topic.topic} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{topic.topic}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            topic.status === "strong"
                              ? "bg-green-900/50 text-green-400"
                              : topic.status === "moderate"
                              ? "bg-yellow-900/50 text-yellow-400"
                              : "bg-red-900/50 text-red-400"
                          }`}
                        >
                          {topic.status}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            topic.avgTestCasePass >= 0.7
                              ? "bg-green-500"
                              : topic.avgTestCasePass >= 0.5
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${topic.avgTestCasePass * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 w-12 text-right">
                      {Math.round(topic.avgTestCasePass * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[#78716C] text-center py-4" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>No topic data</div>
            )}
          </Card>

          {}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Difficulty Performance
            </h3>
            <div className="space-y-4">
              {["easy", "medium", "hard"].map((diff) => {
                const data = difficultyWise[diff];
                if (!data || data.total === 0) return null;

                return (
                  <div key={diff}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium capitalize ${
                          diff === "easy"
                            ? "text-green-400"
                            : diff === "medium"
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {diff}
                      </span>
                      <span className="text-sm text-gray-400">
                        {data.fullySolved}/{data.total} solved
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          diff === "easy"
                            ? "bg-green-500"
                            : diff === "medium"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${data.avgTestCasePass * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {}
        <Card className="p-6 mb-10">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Analysis
          </h3>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <Card className="p-4 bg-[#0A0A08]">
              <div className="text-xl font-bold">
                {Math.floor(timeAnalysis.avgTimePerQuestion / 60)}m{" "}
                {Math.round(timeAnalysis.avgTimePerQuestion % 60)}s
              </div>
              <div className="text-xs text-[#78716C] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Avg per Question</div>
            </Card>
            {timeAnalysis.fastestQuestion && (
              <Card className="p-4 bg-[#0A0A08]">
                <div className="text-xl font-bold text-green-400">
                  {Math.floor(timeAnalysis.fastestQuestion.seconds / 60)}m{" "}
                  {timeAnalysis.fastestQuestion.seconds % 60}s
                </div>
                <div className="text-sm text-gray-400">
                  Fastest: {timeAnalysis.fastestQuestion.title?.slice(0, 20)}...
                </div>
              </Card>
            )}
            {timeAnalysis.slowestQuestion && (
              <Card className="p-4 bg-[#0A0A08]">
                <div className="text-xl font-bold text-red-400">
                  {Math.floor(timeAnalysis.slowestQuestion.seconds / 60)}m{" "}
                  {timeAnalysis.slowestQuestion.seconds % 60}s
                </div>
                <div className="text-sm text-gray-400">
                  Slowest: {timeAnalysis.slowestQuestion.title?.slice(0, 20)}...
                </div>
              </Card>
            )}
          </div>
        </Card>

        {}
        {integrity && (
          <Card
            className={`p-6 mb-10 ${
              integrity.status === "clean"
                ? "bg-[#1A2A16] border-[#14532D]"
                : integrity.status === "violated"
                  ? "bg-[#2A0F0F] border-[#7F1D1D]"
                  : "bg-[#2A1F0F] border-[#92400E]"
            }`}
          >
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              {integrity.status === "clean" ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              )}
              Session Integrity
            </h3>
            <p className="text-gray-300">
              {integrity.status === "clean"
                ? "No issues detected during your session."
                : integrity.status === "violated"
                ? `Session was terminated due to ${integrity.terminatedReason?.replace("_", " ")}.`
                : `${integrity.warningsUsed} warning(s) recorded during your session.`}
            </p>
            {integrity.tabSwitches > 0 && (
              <p className="text-sm text-gray-400 mt-1">
                Tab switches detected: {integrity.tabSwitches}
              </p>
            )}
          </Card>
        )}

        {}
        {insights?.recommendations?.length > 0 && (
          <Card className="p-6 mb-10">
            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
            <div className="space-y-3">
              {insights.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-[#0A0A08] border border-[#1A1814] p-4 border-l-4 border-[#D97706]"
                >
                  <p className="font-medium mb-1">{rec.message}</p>
                  <p className="text-sm text-gray-400">{rec.actionable}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {}
        <Card>
          <h3 className="text-lg font-semibold p-6 border-b border-[#1A1814] flex items-center gap-2">
            <Code className="w-5 h-5" />
            Your Solutions
          </h3>
          <div className="divide-y divide-[#1A1814]">
            {answers.map((answer, idx) => (
              <div key={answer.refId} className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleAnswer(answer.refId)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        answer.verdict === "accepted"
                          ? "bg-[#14532D]"
                          : answer.verdict === "partial"
                            ? "bg-[#92400E]"
                            : "bg-[#7F1D1D]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-medium">{answer.title}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span
                          className={`${
                            answer.difficulty === "Easy"
                              ? "text-green-400"
                              : answer.difficulty === "Medium"
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {answer.difficulty}
                        </span>
                        <span>•</span>
                        <span>{answer.topic}</span>
                        <span>•</span>
                        <span>
                          {answer.passedCount}/{answer.totalCount} passed
                        </span>
                        <span>•</span>
                        <span>
                          {answer.pointsEarned}/{answer.maxPoints} pts
                        </span>
                      </div>
                    </div>
                  </div>
                  {expandedAnswers[answer.refId] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {expandedAnswers[answer.refId] && (
                  <div className="mt-4 ml-11">
                    <div className="text-sm text-gray-400 mb-2">
                      Language: {answer.language}
                    </div>
                    {answer.code ? (
                      <pre className="bg-[#0A0A08] border border-[#1A1814] p-4 rounded-none overflow-x-auto text-sm">
                        <code>{answer.code}</code>
                      </pre>
                    ) : (
                      <div className="text-gray-500 italic">No code submitted</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {}
        <div className="mt-10 flex justify-center gap-4">
          <Button onClick={() => navigate("/oa")} variant="primary" size="lg">
            Start Another OA
          </Button>
          <Button onClick={() => navigate("/oa/history")} variant="secondary" size="lg">
            View History
          </Button>
        </div>
        </div>
      </main>
    </div>
  );
}
