import { useEffect, useMemo, useState } from "react";
import { getMySubmissions } from "../../services/api";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "accepted") return "border-green-500/30 text-green-400";
  if (s.includes("time")) return "border-red-500/30 text-red-400";
  if (s.includes("memory")) return "border-red-500/30 text-red-400";
  if (s.includes("runtime")) return "border-red-500/30 text-red-400";
  if (s.includes("wrong")) return "border-red-500/30 text-red-400";
  return "border-[#2A2A24] text-[#A29A8C]";
}

export default function ProblemSubmissionsPanel({ questionId, onAccepted }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await getMySubmissions({ questionId });
        if (!mounted) return;
        setSubmissions(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load submissions");
        setSubmissions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (questionId) load();

    return () => {
      mounted = false;
    };
  }, [questionId]);

  const mostRecentAccepted = useMemo(() => {
    if (!Array.isArray(submissions)) return null;
    return submissions.find((s) => String(s.status).toLowerCase() === "accepted") || null;
  }, [submissions]);

  useEffect(() => {
    if (mostRecentAccepted?._id) {
      onAccepted?.({ submissionId: mostRecentAccepted._id });
    }
  }, [mostRecentAccepted?._id, onAccepted]);

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-6">
        <span className="text-[#3D3D3D] text-[10px] uppercase tracking-wider">
          Your submissions
        </span>
        <h2 className="text-[#E8E4D9] text-lg mt-1">History</h2>
        <p className="text-[#78716C] text-sm mt-2">
          You can post a verified solution after an <span className="text-[#E8E4D9]">Accepted</span> submission.
        </p>
      </div>

      {loading ? (
        <div className="text-[#A29A8C]">Loading…</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : submissions.length === 0 ? (
        <div className="text-[#A29A8C]">No submissions yet.</div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s._id || `${s.createdAt}-${s.status}`}
              className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] px-2 py-1 rounded border tracking-wider uppercase ${statusTone(s.status)}`}
                    >
                      {String(s.status || "unknown").replaceAll("_", " ")}
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded border border-[#2A2A24] text-[#A29A8C] font-mono">
                      {s.language || "lang"}
                    </span>
                    {typeof s.passedCount === "number" && typeof s.totalCount === "number" ? (
                      <span className="text-[10px] px-2 py-1 rounded border border-[#2A2A24] text-[#A29A8C] font-mono">
                        {s.passedCount}/{s.totalCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[#78716C] text-xs">{formatDate(s.createdAt)}</div>
                </div>

                {String(s.status).toLowerCase() === "accepted" && s._id ? (
                  <button
                    type="button"
                    onClick={() => onAccepted?.({ submissionId: s._id })}
                    className="shrink-0 px-3 py-2 rounded border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/50 transition-all text-xs tracking-[0.2em] uppercase"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    title="Use this accepted submission for posting a verified solution"
                  >
                    Use
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
