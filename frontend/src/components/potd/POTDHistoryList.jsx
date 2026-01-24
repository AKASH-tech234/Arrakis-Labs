import React from "react";
import { Link } from "react-router-dom";
import { Calendar, CheckCircle, XCircle } from "lucide-react";

function badgeClass(difficulty) {
  switch (difficulty) {
    case "Easy":
      return "text-green-400 bg-green-400/10 border-green-400/30";
    case "Medium":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "Hard":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

export default function POTDHistoryList({ items = [], emptyText = "No POTD history yet." }) {
  if (!items.length) {
    return (
      <p
        className="text-[#A29A8C] text-sm tracking-wide"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((row) => {
        const date = row.activeDate ? new Date(row.activeDate) : null;
        const label = date ? date.toISOString().slice(0, 10) : "-";
        const problem = row.problem;

        return (
          <div
            key={row._id}
            className="group flex items-center justify-between gap-4 p-4 rounded-lg border border-[#1A1814] bg-[#0A0A08] hover:bg-[#0D0D0B] transition-colors"
          >
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 text-[#78716C] text-xs tracking-wider uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <Calendar className="w-4 h-4" />
                <span className="font-mono">{label}</span>
                {row.solved ? (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-4 h-4" /> solved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[#78716C]">
                    <XCircle className="w-4 h-4" /> not solved
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <h4 className="text-white font-semibold truncate max-w-[540px]">
                  {problem?.title || "Unknown problem"}
                </h4>
                {problem?.difficulty ? (
                  <span
                    className={`text-xs px-2 py-1 rounded border ${badgeClass(problem.difficulty)}`}
                  >
                    {problem.difficulty}
                  </span>
                ) : null}
              </div>
            </div>

            {problem?._id ? (
              <Link
                to={`/problems/${problem._id}?potd=true`}
                className="shrink-0 px-4 py-2 rounded border border-[#2A2A24] bg-[#0F0F0D] text-[#E8E4D9] hover:border-[#D97706]/50 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.25)] transition-all text-xs tracking-[0.2em] uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                View
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
