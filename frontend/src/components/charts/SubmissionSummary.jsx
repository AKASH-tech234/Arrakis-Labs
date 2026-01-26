

function formatTimeAgo(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  if (diffHr > 0) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffMin > 0) return `${diffMin} min ago`;
  return "just now";
}

const statusStyles = {
  Accepted: "text-[#78716C]",
  "Wrong Answer": "text-[#92400E]",
  "Time Limit": "text-[#D97706]",
};

export default function SubmissionSummary({ submissions }) {
  const items = Array.isArray(submissions) ? submissions : [];

  return (
    <div className="divide-y divide-[#1A1814]">
      {}
      <div className="flex items-center justify-between py-2 px-1">
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Problem
        </span>
        <div className="flex items-center gap-8">
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider w-24 text-right"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Status
          </span>
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider w-20 text-right hidden sm:block"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Time
          </span>
        </div>
      </div>

      {}
      {items.map((submission) => (
        <div
          key={submission.id}
          className="flex items-center justify-between py-3 px-1"
        >
          <span
            className="text-[#E8E4D9] text-sm truncate max-w-[200px]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {submission.problem}
          </span>
          <div className="flex items-center gap-8">
            <span
              className={`text-xs uppercase tracking-wider w-24 text-right ${
                statusStyles[submission.status] || "text-[#78716C]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {submission.status}
            </span>
            <span
              className="text-[#3D3D3D] text-xs w-20 text-right hidden sm:block"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {formatTimeAgo(submission.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
