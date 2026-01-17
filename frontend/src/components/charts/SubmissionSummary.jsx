// src/components/charts/SubmissionSummary.jsx
// Recent submissions list

const mockSubmissions = [
  {
    id: 1,
    problem: "Two Sum",
    status: "Accepted",
    time: "2 hours ago",
    runtime: "45ms",
  },
  {
    id: 2,
    problem: "Add Two Numbers",
    status: "Accepted",
    time: "1 day ago",
    runtime: "68ms",
  },
  {
    id: 3,
    problem: "Longest Substring",
    status: "Wrong Answer",
    time: "2 days ago",
    runtime: "—",
  },
  {
    id: 4,
    problem: "Palindrome Number",
    status: "Accepted",
    time: "3 days ago",
    runtime: "32ms",
  },
  {
    id: 5,
    problem: "Reverse Integer",
    status: "Accepted",
    time: "4 days ago",
    runtime: "41ms",
  },
];

const statusStyles = {
  Accepted: "text-[#78716C]",
  "Wrong Answer": "text-[#92400E]",
  "Time Limit": "text-[#D97706]",
};

export default function SubmissionSummary() {
  return (
    <div className="divide-y divide-[#1A1814]">
      {/* Header */}
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

      {/* Submissions */}
      {mockSubmissions.map((submission) => (
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
              {submission.time}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
