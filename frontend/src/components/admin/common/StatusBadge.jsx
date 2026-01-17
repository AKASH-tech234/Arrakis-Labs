// src/components/admin/common/StatusBadge.jsx
// Colored status indicator badges - Arrakis Labs Dune theme

const statusStyles = {
  // Problem/Contest statuses
  draft: { bg: "bg-[#1A1814]", text: "text-[#78716C]", label: "Draft" },
  review: { bg: "bg-[#92400E]/20", text: "text-[#D97706]", label: "Review" },
  published: {
    bg: "bg-green-900/20",
    text: "text-green-500",
    label: "Published",
  },
  hidden: { bg: "bg-[#1A1814]", text: "text-[#3D3D3D]", label: "Hidden" },

  // Contest lifecycle
  scheduled: {
    bg: "bg-blue-900/20",
    text: "text-blue-400",
    label: "Scheduled",
  },
  live: { bg: "bg-[#F59E0B]/20", text: "text-[#F59E0B]", label: "Live" },
  ended: { bg: "bg-[#1A1814]", text: "text-[#78716C]", label: "Ended" },
  archived: { bg: "bg-[#1A1814]", text: "text-[#3D3D3D]", label: "Archived" },
  cancelled: { bg: "bg-red-900/20", text: "text-red-400", label: "Cancelled" },

  // Submission verdicts
  accepted: {
    bg: "bg-green-900/20",
    text: "text-green-500",
    label: "Accepted",
  },
  wrong_answer: {
    bg: "bg-red-900/20",
    text: "text-red-400",
    label: "Wrong Answer",
  },
  time_limit: { bg: "bg-[#D97706]/20", text: "text-[#D97706]", label: "TLE" },
  memory_limit: {
    bg: "bg-purple-900/20",
    text: "text-purple-400",
    label: "MLE",
  },
  runtime_error: {
    bg: "bg-red-900/20",
    text: "text-red-400",
    label: "Runtime Error",
  },
  compilation_error: {
    bg: "bg-[#92400E]/20",
    text: "text-[#92400E]",
    label: "CE",
  },
  pending: { bg: "bg-[#1A1814]", text: "text-[#78716C]", label: "Pending" },
  running: { bg: "bg-blue-900/20", text: "text-blue-400", label: "Running" },

  // User statuses
  active: { bg: "bg-green-900/20", text: "text-green-500", label: "Active" },
  warned: { bg: "bg-[#D97706]/20", text: "text-[#D97706]", label: "Warned" },
  suspended: {
    bg: "bg-[#92400E]/20",
    text: "text-[#92400E]",
    label: "Suspended",
  },
  banned: { bg: "bg-red-900/20", text: "text-red-400", label: "Banned" },

  // Plagiarism statuses
  cleared: { bg: "bg-green-900/20", text: "text-green-500", label: "Cleared" },
  flagged: { bg: "bg-red-900/20", text: "text-red-400", label: "Flagged" },
  reviewing: {
    bg: "bg-[#D97706]/20",
    text: "text-[#D97706]",
    label: "Reviewing",
  },
  escalated: {
    bg: "bg-purple-900/20",
    text: "text-purple-400",
    label: "Escalated",
  },

  // Difficulty
  easy: { bg: "bg-green-900/20", text: "text-green-500", label: "Easy" },
  medium: { bg: "bg-[#D97706]/20", text: "text-[#D97706]", label: "Medium" },
  hard: { bg: "bg-red-900/20", text: "text-red-400", label: "Hard" },

  // System statuses
  healthy: { bg: "bg-green-900/20", text: "text-green-500", label: "Healthy" },
  degraded: {
    bg: "bg-[#D97706]/20",
    text: "text-[#D97706]",
    label: "Degraded",
  },
  down: { bg: "bg-red-900/20", text: "text-red-400", label: "Down" },
};

export default function StatusBadge({
  status,
  size = "md",
  showDot = false,
  customLabel,
}) {
  const normalizedStatus = status?.toLowerCase().replace(/\s+/g, "_");
  const style = statusStyles[normalizedStatus] || statusStyles.pending;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${style.bg} ${style.text} ${sizeClasses[size]} 
                  uppercase tracking-wider`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${style.text.replace("text-", "bg-")}`}
        />
      )}
      {customLabel || style.label}
    </span>
  );
}

// Verdict badge with icon
export function VerdictBadge({ verdict, showIcon = true }) {
  const icons = {
    accepted: "✓",
    wrong_answer: "✗",
    time_limit: "⏱",
    memory_limit: "▤",
    runtime_error: "⚠",
    compilation_error: "⊘",
    pending: "◷",
    running: "◌",
  };

  const normalizedVerdict = verdict?.toLowerCase().replace(/\s+/g, "_");
  const icon = icons[normalizedVerdict] || "•";

  return (
    <StatusBadge
      status={verdict}
      customLabel={
        <span className="flex items-center gap-1">
          {showIcon && <span>{icon}</span>}
          <span>{statusStyles[normalizedVerdict]?.label || verdict}</span>
        </span>
      }
    />
  );
}

// Difficulty badge with specific styling
export function DifficultyBadge({ difficulty }) {
  return <StatusBadge status={difficulty} />;
}
