

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ConfidenceBadge from "./ConfidenceBadge";

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {}
      <div className="space-y-2">
        <div className="h-3 w-24 bg-[#1A1814] rounded"></div>
        <div className="h-4 w-full bg-[#1A1814] rounded"></div>
        <div className="h-4 w-3/4 bg-[#1A1814] rounded"></div>
      </div>

      {}
      <div className="space-y-2">
        <div className="h-3 w-20 bg-[#1A1814] rounded"></div>
        <div className="h-4 w-5/6 bg-[#1A1814] rounded"></div>
        <div className="h-4 w-4/6 bg-[#1A1814] rounded"></div>
      </div>

      {}
      <div className="space-y-2">
        <div className="h-3 w-32 bg-[#1A1814] rounded"></div>
        <div className="h-4 w-full bg-[#1A1814] rounded"></div>
        <div className="h-4 w-2/3 bg-[#1A1814] rounded"></div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon, color = "#D97706" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <h4
        className="text-[10px] uppercase tracking-wider"
        style={{
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          color: "#78716C",
        }}
      >
        {title}
      </h4>
      {icon}
    </div>
  );
}

function ListItem({ children, icon = "→", color = "#E8E4D9" }) {
  return (
    <li
      className="text-sm leading-relaxed flex items-start gap-2"
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-[#E8E4D9]">{children}</span>
    </li>
  );
}

function WeeklyReportContent({ report }) {
  if (!report) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {}
      <div>
        <SectionHeader title="Weekly Summary" color="#D97706" />
        <p
          className="text-[#E8E4D9] text-sm leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {report.summary}
        </p>
      </div>

      {}
      {report.strengths?.length > 0 && (
        <div>
          <SectionHeader title="Strengths" color="#22C55E" />
          <ul className="space-y-2">
            {report.strengths.map((strength, idx) => (
              <ListItem key={idx} icon="✓" color="#22C55E">
                {strength}
              </ListItem>
            ))}
          </ul>
        </div>
      )}

      {}
      {report.improvement_areas?.length > 0 && (
        <div>
          <SectionHeader title="Areas for Improvement" color="#F59E0B" />
          <ul className="space-y-2">
            {report.improvement_areas.map((area, idx) => (
              <ListItem key={idx} icon="!" color="#F59E0B">
                {area}
              </ListItem>
            ))}
          </ul>
        </div>
      )}

      {}
      {report.recurring_patterns?.length > 0 && (
        <div>
          <SectionHeader title="Recurring Patterns" color="#EF4444" />
          <div className="border border-[#92400E]/30 bg-[#92400E]/5 p-4 rounded">
            <ul className="space-y-2">
              {report.recurring_patterns.map((pattern, idx) => (
                <ListItem key={idx} icon="⚠" color="#EF4444">
                  {pattern}
                </ListItem>
              ))}
            </ul>
            <p
              className="text-[#78716C] text-xs mt-3 italic"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Focus on these patterns to improve your problem-solving skills.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function WeeklyReportButton({
  onClick,
  loading = false,
  variant = "primary",
}) {
  const variants = {
    primary: "border-[#D97706]/30 text-[#D97706] hover:bg-[#D97706]/10",
    secondary:
      "border-[#3D3D3D]/50 text-[#78716C] hover:border-[#D97706]/30 hover:text-[#D97706]",
    text: "border-transparent text-[#78716C] hover:text-[#D97706]",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`py-3 px-6 border transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {loading ? (
        <>
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          />
          Generating Report...
        </>
      ) : (
        <>
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
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          View Weekly Report
        </>
      )}
    </button>
  );
}

export default function WeeklyReportUI({
  isOpen,
  onClose,
  loading = false,
  error = null,
  report = null,
  confidenceBadge = null,
  lastFetchedAt = null,
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-lg border border-[#1A1814]"
          style={{ backgroundColor: "#0A0A08" }}
          onClick={(e) => e.stopPropagation()}
        >
          {}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1814] sticky top-0 bg-[#0A0A08] z-10">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-[#D97706]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span
                className="text-[#E8E4D9] text-sm uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Weekly Progress Report
              </span>
              {confidenceBadge && (
                <ConfidenceBadge badge={confidenceBadge} size="small" />
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[#3D3D3D] hover:text-[#78716C] transition-colors p-1"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {}
          <div className="p-6">
            {}
            {loading && <ReportSkeleton />}

            {}
            {!loading && error && (
              <div className="py-8">
                <div className="border border-[#92400E]/30 bg-[#92400E]/5 p-4 rounded">
                  <h4
                    className="text-[#D97706] text-xs uppercase tracking-wider mb-2"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Report Unavailable
                  </h4>
                  <p
                    className="text-[#E8E4D9] text-sm leading-relaxed"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {error}
                  </p>
                </div>
              </div>
            )}

            {}
            {!loading && !error && report && (
              <>
                <WeeklyReportContent report={report} />

                {}
                {lastFetchedAt && (
                  <div className="mt-6 pt-4 border-t border-[#1A1814]">
                    <p
                      className="text-[#3D3D3D] text-[10px] uppercase tracking-wider text-center"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Generated {lastFetchedAt.toLocaleString()}
                    </p>
                  </div>
                )}
              </>
            )}

            {}
            {!loading && !error && !report && (
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
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p
                  className="text-[#78716C] text-sm"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Your weekly report will appear here once generated.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export { WeeklyReportContent };
