

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TIMELINE_EVENT_TYPES } from "../../hooks/profile/useLearningTimeline";

function EventIcon({ type }) {
  const icons = {
    [TIMELINE_EVENT_TYPES.SUBMISSION]: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    [TIMELINE_EVENT_TYPES.FEEDBACK]: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    ),
    [TIMELINE_EVENT_TYPES.PATTERN]: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    [TIMELINE_EVENT_TYPES.DIFFICULTY]: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  };

  return icons[type] || icons[TIMELINE_EVENT_TYPES.SUBMISSION];
}

function getEventColor(event) {
  const { type, metadata } = event;

  switch (type) {
    case TIMELINE_EVENT_TYPES.SUBMISSION:
      return metadata?.isAccepted ? "#22C55E" : "#EF4444";
    case TIMELINE_EVENT_TYPES.FEEDBACK:
      return "#D97706";
    case TIMELINE_EVENT_TYPES.PATTERN:
      return "#F59E0B";
    case TIMELINE_EVENT_TYPES.DIFFICULTY:
      return "#3B82F6";
    default:
      return "#78716C";
  }
}

function formatTimestamp(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TimelineEvent({ event, isLast = false }) {
  const color = getEventColor(event);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-4"
    >
      {}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <EventIcon type={event.type} />
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 min-h-[40px]"
            style={{ backgroundColor: "#1A1814" }}
          />
        )}
      </div>

      {}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <h4
            className="text-sm font-medium"
            style={{
              fontFamily: "'Rajdhani', system-ui, sans-serif",
              color,
            }}
          >
            {event.title}
          </h4>
          <span
            className="text-[10px] text-[#3D3D3D] whitespace-nowrap"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {formatTimestamp(event.timestamp)}
          </span>
        </div>
        <p
          className="text-[#A8A29E] text-xs mt-1 leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {event.description}
        </p>

        {}
        {event.metadata?.language && (
          <span
            className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase tracking-wider bg-[#1A1814] text-[#78716C] rounded"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {event.metadata.language}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TimelineStats({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="text-center">
        <div className="text-lg font-semibold text-[#E8E4D9]">
          {stats.totalSubmissions}
        </div>
        <div
          className="text-[10px] text-[#78716C] uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Submissions
        </div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-[#22C55E]">
          {stats.accepted}
        </div>
        <div
          className="text-[10px] text-[#78716C] uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Accepted
        </div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-[#D97706]">
          {stats.acceptanceRate}%
        </div>
        <div
          className="text-[10px] text-[#78716C] uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Rate
        </div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-[#F59E0B]">
          {stats.patternsDetected}
        </div>
        <div
          className="text-[10px] text-[#78716C] uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Patterns
        </div>
      </div>
    </div>
  );
}

export default function LearningTimeline({
  timeline = [],
  stats = null,
  limit = 10,
  showStats = true,
  emptyMessage = "No activity yet. Start solving problems!",
  className = "",
}) {
  
  const displayedEvents = useMemo(
    () => timeline.slice(0, limit),
    [timeline, limit],
  );

  return (
    <div className={`${className}`}>
      {}
      {showStats && stats && <TimelineStats stats={stats} />}

      {}
      {displayedEvents.length > 0 ? (
        <div className="space-y-0">
          {displayedEvents.map((event, index) => (
            <TimelineEvent
              key={event.id}
              event={event}
              isLast={index === displayedEvents.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <svg
            className="w-12 h-12 text-[#3D3D3D] mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p
            className="text-[#78716C] text-sm"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {emptyMessage}
          </p>
        </div>
      )}

      {}
      {timeline.length > limit && (
        <div className="text-center mt-4">
          <span
            className="text-[#78716C] text-xs"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            +{timeline.length - limit} more events
          </span>
        </div>
      )}
    </div>
  );
}

export function CompactTimeline({ timeline = [], limit = 5 }) {
  const events = timeline.slice(0, limit);

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const color = getEventColor(event);
        return (
          <div key={event.id} className="flex items-center gap-2 py-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span
              className="text-[#E8E4D9] text-xs truncate flex-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {event.title}
            </span>
            <span
              className="text-[#3D3D3D] text-[10px]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
