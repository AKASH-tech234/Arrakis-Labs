import { useEffect, useMemo, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AppHeader from "../../components/layout/AppHeader";
import contestApi from "../../services/contest/contestApi";
import apiClient from "../../services/common/api";
import useProfileAnalytics from "../../hooks/profile/useProfileAnalytics";
import logger from "../../utils/logger";
import { ErrorBoundary, SectionLoading } from "../../components/ui/shared";
import {
  OverviewSection,
  AnalyticsSection,
  InsightsSection,
  LearningSection,
  PROFILE_SECTIONS,
  DEFAULT_SECTION,
} from "./sections";

function SectionNav({ activeSection, onSectionChange }) {
  const sections = Object.values(PROFILE_SECTIONS);

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0F0F0D] border border-[#1A1814]">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionChange(section.id)}
          className={`
            px-4 py-2 text-xs font-medium rounded-md transition-all duration-200
            ${
              activeSection === section.id
                ? "bg-[#D97706] text-[#0A0A08]"
                : "text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]"
            }
          `}
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

function SectionRenderer({
  activeSection,
  analytics,
  userId,
  readOnly,

  onCopyLink,
  onExportPdf,
  exportingPdf,
  actionMessage,

  contests,
  contestsLoading,
  contestsError,
  formatDate,
  onRegister,
  busy,
}) {
  switch (activeSection) {
    case "overview":
      return (
        <ErrorBoundary sectionName="Overview">
          <Suspense fallback={<SectionLoading sectionName="Overview" />}>
            <OverviewSection
              analytics={analytics}
              readOnly={readOnly}
              onCopyLink={onCopyLink}
              onExportPdf={onExportPdf}
              exportingPdf={exportingPdf}
              actionMessage={actionMessage}
            />
          </Suspense>
        </ErrorBoundary>
      );

    case "analytics":
      return (
        <ErrorBoundary sectionName="Analytics">
          <Suspense fallback={<SectionLoading sectionName="Analytics" />}>
            <AnalyticsSection
              analytics={analytics}
              contests={contests}
              contestsLoading={contestsLoading}
              contestsError={contestsError}
              formatDate={formatDate}
              onRegister={onRegister}
              busy={busy}
              readOnly={readOnly}
            />
          </Suspense>
        </ErrorBoundary>
      );

    case "insights":
      return (
        <ErrorBoundary sectionName="AI Insights">
          <Suspense fallback={<SectionLoading sectionName="AI Insights" />}>
            <InsightsSection userId={userId} />
          </Suspense>
        </ErrorBoundary>
      );

    case "learning":
      return (
        <ErrorBoundary sectionName="Learning">
          <Suspense fallback={<SectionLoading sectionName="Learning" />}>
            <LearningSection userId={userId} />
          </Suspense>
        </ErrorBoundary>
      );

    default:
      return null;
  }
}

export default function Profile({ username, readOnly = false } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get("section") || DEFAULT_SECTION;

  const [contests, setContests] = useState({ live: [], upcoming: [] });
  const [contestsLoading, setContestsLoading] = useState(true);
  const [contestsError, setContestsError] = useState(null);
  const [busy, setBusy] = useState({});

  const [actionMessage, setActionMessage] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: analytics } = useProfileAnalytics({ username });
  const userId = analytics?.user?._id;

  const handleSectionChange = useCallback(
    (sectionId) => {
      setSearchParams({ section: sectionId });
    },
    [setSearchParams],
  );

  const clearActionMessageSoon = useCallback(() => {
    window.setTimeout(() => setActionMessage(null), 2000);
  }, []);

  const handleCopyProfileLink = useCallback(async () => {
    const publicUsername =
      analytics?.publicSettings?.publicUsername || analytics?.user?.username;
    const url =
      readOnly || !publicUsername
        ? window.location.href
        : `${window.location.origin}/u/${encodeURIComponent(publicUsername)}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copy profile link:", url);
      }
      setActionMessage("Link copied");
      clearActionMessageSoon();
    } catch {
      window.prompt("Copy profile link:", url);
    }
  }, [analytics, readOnly, clearActionMessageSoon]);

  const handleExportPdf = useCallback(async () => {
    if (readOnly) return;
    try {
      setExportingPdf(true);

      const response = await apiClient.post(
        "/export/pdf",
        {
          format: "two_page",
          includeQr: true,
        },
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `arrakis_profile_${analytics?.user?.name || "user"}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setActionMessage("PDF downloaded");
      clearActionMessageSoon();
    } catch (err) {
      logger.error("PDF export error:", err);
      alert(
        err?.response?.data?.message || err?.message || "Failed to export PDF",
      );
    } finally {
      setExportingPdf(false);
    }
  }, [readOnly, analytics, clearActionMessageSoon]);

  const setContestBusy = useCallback((contestId, value) => {
    setBusy((prev) => ({ ...prev, [contestId]: value }));
  }, []);

  const handleRegister = useCallback(
    async (contest) => {
      if (readOnly) return;

      const contestId = contest?._id;
      if (!contestId) return;

      try {
        setContestBusy(contestId, true);
        await contestApi.registerForContest(contestId);

        setContests((prev) => {
          const patchList = (list) =>
            list.map((c) =>
              c._id === contestId
                ? {
                    ...c,
                    registration: {
                      status: "registered",
                      registeredAt: new Date().toISOString(),
                    },
                  }
                : c,
            );

          return {
            live: patchList(prev.live),
            upcoming: patchList(prev.upcoming),
          };
        });
      } catch (err) {
        alert(
          err?.response?.data?.message || err?.message || "Failed to register",
        );
      } finally {
        setContestBusy(contestId, false);
      }
    },
    [readOnly, setContestBusy],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardContests = async () => {
      try {
        setContestsLoading(true);
        setContestsError(null);

        const [liveRes, upcomingRes] = await Promise.all([
          contestApi.getContests({ status: "live", limit: 3 }),
          contestApi.getContests({ status: "upcoming", limit: 5 }),
        ]);

        if (cancelled) return;
        setContests({
          live: liveRes?.data || [],
          upcoming: upcomingRes?.data || [],
        });
      } catch (err) {
        if (cancelled) return;
        setContestsError(err?.message || "Failed to load contests");
      } finally {
        if (!cancelled) setContestsLoading(false);
      }
    };

    fetchDashboardContests();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = useMemo(
    () => (date) =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(date)),
    [],
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
          {}
          <div className="mb-6 flex justify-center">
            <SectionNav
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />
          </div>

          {}
          <div className="space-y-6">
            <SectionRenderer
              activeSection={activeSection}
              analytics={analytics}
              userId={userId}
              readOnly={readOnly}
              onCopyLink={handleCopyProfileLink}
              onExportPdf={handleExportPdf}
              exportingPdf={exportingPdf}
              actionMessage={actionMessage}
              contests={contests}
              contestsLoading={contestsLoading}
              contestsError={contestsError}
              formatDate={formatDate}
              onRegister={handleRegister}
              busy={busy}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
