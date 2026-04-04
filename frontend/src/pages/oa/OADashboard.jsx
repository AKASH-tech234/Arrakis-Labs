import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Clock, Target, History, Zap, TrendingUp, Award } from "lucide-react";
import oaService from "../../services/oaService";
import OAConfigModal from "../../components/oa/OAConfigModal";
import AppHeader from "../../components/layout/AppHeader";
import { Badge, Button, Card, SectionTitle } from "../../components/ui/ds";

export default function OADashboard() {
  const navigate = useNavigate();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getErrorMessage = (err) =>
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong";

  const ensureRazorpayLoaded = () => {
    if (window.Razorpay) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Failed to load Razorpay"));
      document.body.appendChild(script);
    });
  };

  const payForOA = async () => {
    let orderRes;
    try {
      orderRes = await oaService.createOAPaymentOrder();
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }

    if (!orderRes?.success) {
      throw new Error(orderRes?.error || "Failed to start payment");
    }

    if (orderRes?.data?.paymentRequired === false) {
      return;
    }

    const order = orderRes.data;

    await ensureRazorpayLoaded();

    await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: String(order.amountPaise),
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        handler: async (response) => {
          try {
            const verifyRes = await oaService.verifyOAPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });

            if (!verifyRes?.success) {
              reject(new Error(verifyRes?.error || "Payment verification failed"));
              return;
            }

            resolve(true);
          } catch (err) {
            reject(new Error(getErrorMessage(err)));
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancelled")),
        },
      });

      rzp.open();
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const activeRes = await oaService.getActiveSession();
        if (activeRes.success && activeRes.data) {
          setActiveSession(activeRes.data);
        }

        const statsRes = await oaService.getUserStats();
        if (statsRes.success) {
          setStats(statsRes.data);
        }

        const historyRes = await oaService.getSessionHistory(1, 5);
        if (historyRes.success) {
          setRecentSessions(historyRes.data.sessions);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStartOA = async (config) => {
    try {
      await payForOA();

      const response = await oaService.createSession({
        ...config,
        startImmediately: true,
      });

      if (response.success) {
        navigate(`/oa/session/${response.data.sessionId}`);
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  };

  const handleQuickFight = async () => {
    try {
      await payForOA();

      const response = await oaService.quickFight();
      if (response.success) {
        navigate(`/oa/session/${response.data.sessionId}`);
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleResume = () => {
    if (activeSession) {
      navigate(`/oa/session/${activeSession.sessionId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A08" }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F59E0B]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />
      <main className="pt-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
          <SectionTitle
            title="OA Practice"
            subtitle="Simulate real online assessment experiences"
            className="mb-10"
          />

        {}
          {error && (
            <Card className="mb-8 p-4 border-[#7F1D1D] bg-[#2A0F0F] text-[#FCA5A5]">
              <div className="flex items-start justify-between gap-4">
                <div style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{error}</div>
                <button
                  onClick={() => setError(null)}
                  className="text-[#FCA5A5] hover:text-[#E8E4D9]"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            </Card>
          )}

        {}
          {activeSession && (
            <Card className="mb-10 bg-gradient-to-r from-[#2A1F0F] to-[#121210]">
              <div className="p-6 flex items-center justify-between gap-6">
                <div>
                  <h2
                    className="text-lg font-semibold text-[#E8E4D9] tracking-wider uppercase"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Active Session
                  </h2>
                  <p
                    className="text-[#A29A8C] mt-2"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    You have an ongoing OA session. Resume to continue.
                  </p>
                  <div
                    className="flex items-center gap-6 mt-4 text-sm text-[#A29A8C]"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {Math.ceil(activeSession.remainingMs / 60000)} min remaining
                    </span>
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      {activeSession.questionCount} questions
                    </span>
                  </div>
                </div>
                <Button onClick={handleResume} variant="primary" size="lg">
                  <Play className="w-5 h-5" />
                  Resume OA
                </Button>
              </div>
            </Card>
          )}

        {}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
          {}
          <Card className="p-6 hover:border-[#92400E]/60 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#2A1F0F] border border-[#1A1814]">
                <Target className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <h3
                className="text-xl font-semibold text-[#E8E4D9] tracking-wider uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Custom OA
              </h3>
            </div>
            <p className="text-[#A29A8C] mb-6" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Configure your own OA with specific companies, topics, difficulty,
              and duration. Tailored practice for your target companies.
            </p>
            <Button
              onClick={() => setShowConfigModal(true)}
              disabled={!!activeSession}
              variant={activeSession ? "secondary" : "primary"}
              size="lg"
              className="w-full"
            >
              <Play className="w-5 h-5" />
              Configure & Start
            </Button>
          </Card>

          {}
          <Card className="p-6 hover:border-[#92400E]/60 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#2A1F0F] border border-[#1A1814]">
                <Zap className="w-6 h-6 text-[#D97706]" />
              </div>
              <h3
                className="text-xl font-semibold text-[#E8E4D9] tracking-wider uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Quick Fight
              </h3>
            </div>
            <p className="text-[#A29A8C] mb-6" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Jump into a randomized 45-minute OA with mixed difficulty. Perfect
              for quick practice when you're short on time.
            </p>
            <Button
              onClick={handleQuickFight}
              disabled={!!activeSession}
              variant={activeSession ? "secondary" : "primary"}
              size="lg"
              className="w-full"
            >
              <Zap className="w-5 h-5" />
              Start Quick Fight
            </Button>
          </Card>
        </div>

        {/* Stats Section */}
          {stats && stats.totalOAs > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-semibold text-[#E8E4D9] tracking-wider uppercase flex items-center gap-2"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  <TrendingUp className="w-5 h-5" />
                  Your Progress
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-3xl font-bold text-[#F59E0B]">{stats.totalOAs}</div>
                  <div className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>OAs Completed</div>
                </Card>
                <Card className="p-4">
                  <div className="text-3xl font-bold text-[#86EFAC]">{stats.avgScore}%</div>
                  <div className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Average Score</div>
                </Card>
                <Card className="p-4">
                  <div className="text-3xl font-bold text-[#E8E4D9] capitalize">{stats.practiceLevel}</div>
                  <div className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Practice Level</div>
                </Card>
                <Card className="p-4">
                  <div className="text-3xl font-bold">
                    {stats.recentTrend === "improving" ? (
                      <span className="text-[#86EFAC]">↑</span>
                    ) : stats.recentTrend === "declining" ? (
                      <span className="text-[#FCA5A5]">↓</span>
                    ) : (
                      <span className="text-[#A29A8C]">→</span>
                    )}
                  </div>
                  <div className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Recent Trend</div>
                </Card>
              </div>

            {/* Topics */}
              {(stats.strongTopics?.length > 0 || stats.weakTopics?.length > 0) && (
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  {stats.strongTopics?.length > 0 && (
                    <Card className="p-4 border-[#14532D] bg-[#1A2A16]">
                      <div className="text-xs text-[#86EFAC] font-semibold mb-3 uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                        Strong Topics
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {stats.strongTopics.map((topic) => (
                          <Badge key={topic} variant="success">{topic}</Badge>
                        ))}
                      </div>
                    </Card>
                  )}
                  {stats.weakTopics?.length > 0 && (
                    <Card className="p-4 border-[#7F1D1D] bg-[#2A0F0F]">
                      <div className="text-xs text-[#FCA5A5] font-semibold mb-3 uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                        Needs Practice
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {stats.weakTopics.map((topic) => (
                          <Badge key={topic} variant="danger">{topic}</Badge>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Recent Sessions */}
          {recentSessions.length > 0 && (
            <div>
              <h2
                className="text-lg font-semibold text-[#E8E4D9] tracking-wider uppercase mb-4 flex items-center gap-2"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <History className="w-5 h-5" />
                Recent Sessions
              </h2>
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#1A1814]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1814]">
                  {recentSessions.map((session) => (
                    <tr
                      key={session.sessionId}
                      className="hover:bg-[#1A1814]/40"
                    >
                      <td className="px-4 py-3 text-sm text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                        {new Date(session.startAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                        {session.questionCount} questions
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            session.status === "submitted"
                              ? "success"
                              : session.status === "terminated"
                                ? "danger"
                                : session.status === "expired"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {session.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          onClick={() => navigate(`/oa/report/${session.sessionId}`)}
                          variant="ghost"
                          size="sm"
                        >
                          View Report →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </Card>
            <div className="mt-4 text-center">
              <Button onClick={() => navigate("/oa/history")} variant="secondary" size="md">
                View All History →
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
          {!loading && stats?.totalOAs === 0 && (
            <Card className="text-center py-12 px-6">
              <Award className="w-16 h-16 mx-auto text-[#3D3D3D] mb-4" />
              <h3
                className="text-xl font-semibold mb-2 tracking-wider uppercase text-[#E8E4D9]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Start Your OA Journey
              </h3>
              <p className="text-[#A29A8C] mb-6" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                Practice with simulated online assessments to prepare for technical interviews.
              </p>
              <Button onClick={() => setShowConfigModal(true)} variant="primary" size="lg">
                Start Your First OA
              </Button>
            </Card>
          )}
        </div>
      </main>

      {/* Config Modal */}
      {showConfigModal && (
        <OAConfigModal
          onClose={() => setShowConfigModal(false)}
          onStart={handleStartOA}
        />
      )}
    </div>
  );
}
