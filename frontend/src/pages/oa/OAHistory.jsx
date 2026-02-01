import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Target, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import oaService from "../../services/oaService";
import AppHeader from "../../components/layout/AppHeader";
import { Badge, Button, Card, SectionTitle } from "../../components/ui/ds";

export default function OAHistory() {
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const response = await oaService.getSessionHistory(
          pagination.page,
          10,
          statusFilter || undefined
        );

        if (response.success) {
          setSessions(response.data.sessions);
          setPagination(response.data.pagination);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [pagination.page, statusFilter]);

  const getStatusBadge = (status) => {
    const variant =
      status === "submitted"
        ? "success"
        : status === "terminated"
          ? "danger"
          : status === "expired"
            ? "warning"
            : status === "live"
              ? "live"
              : status === "scheduled"
                ? "upcoming"
                : "neutral";

    return <Badge variant={variant}>{status}</Badge>;
  };

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
            <SectionTitle title="OA History" subtitle="Review your past OA sessions" />
          </div>

        {}
        <div className="mb-8 flex items-center gap-4">
          <span
            className="text-[#A29A8C]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Filter by status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-[#121210] border border-[#1A1814] rounded-none px-3 py-2 text-sm text-[#E8E4D9]"
          >
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#F59E0B]"></div>
          </div>
        ) : sessions.length === 0 ? (
          <Card className="text-center py-12 px-6">
            <Target className="w-12 h-12 mx-auto text-[#3D3D3D] mb-4" />
            <h3
              className="text-lg font-semibold mb-2 tracking-wider uppercase text-[#E8E4D9]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              No sessions found
            </h3>
            <p className="text-[#A29A8C] mb-6" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              {statusFilter
                ? `No ${statusFilter} sessions found.`
                : "Start your first OA to see your history."}
            </p>
            <Button as={Link} to="/oa" variant="primary" size="lg">
              Start an OA
            </Button>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#1A1814]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Configuration
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">
                      Duration
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
                  {sessions.map((session) => (
                    <tr key={session.sessionId} className="hover:bg-[#1A1814]/40">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#78716C]" />
                          <div>
                            <div className="text-sm font-semibold text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                              {new Date(session.startAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-[#78716C]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                              {new Date(session.startAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          {session.configSnapshot?.selectedCompanies?.length > 0 ? (
                            <span>
                              {session.configSnapshot.selectedCompanies.slice(0, 2).join(", ")}
                              {session.configSnapshot.selectedCompanies.length > 2 &&
                                ` +${session.configSnapshot.selectedCompanies.length - 2}`}
                            </span>
                          ) : session.configSnapshot?.difficulty ? (
                            <span className="capitalize">
                              {session.configSnapshot.difficulty} difficulty
                            </span>
                          ) : (
                            <span className="text-[#78716C]">Custom</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-[#78716C]" />
                          <span className="text-sm text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                            {session.questionCount} questions
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#78716C]" />
                          <span className="text-sm text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                            {Math.round(
                              (new Date(session.endAt) - new Date(session.startAt)) /
                                60000
                            )}{" "}
                            min
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(session.status)}</td>
                      <td className="px-4 py-4">
                        {["submitted", "terminated", "expired"].includes(
                          session.status
                        ) ? (
                          <Button as={Link} to={`/oa/report/${session.sessionId}`} variant="ghost" size="sm">
                            View Report →
                          </Button>
                        ) : session.status === "live" ? (
                          <Button as={Link} to={`/oa/session/${session.sessionId}`} variant="primary" size="sm">
                            Resume →
                          </Button>
                        ) : (
                          <span className="text-[#78716C] text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {}
            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  disabled={pagination.page === 1}
                  variant="secondary"
                  size="sm"
                >
                  Previous
                </Button>

                <span className="text-[#A29A8C] px-4" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                  Page {pagination.page} of {pagination.pages}
                </span>

                <Button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.pages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page === pagination.pages}
                  variant="secondary"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}
