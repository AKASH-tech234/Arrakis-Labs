import { useMemo, useState } from "react";
import AppHeader from "../layout/AppHeader";
import useProfileDashboard from "../../hooks/useProfileDashboard";
import CombinedStatsCard from "./CombinedStatsCard";
import DifficultySplitChart from "./DifficultySplitChart";
import SkillBreakdownGrid from "./SkillBreakdownGrid";
import PlatformStatsCard from "./PlatformStatsCard";
import PlatformConnect from "./PlatformConnect";
import PublicProfileSettingsPanel from "./PublicProfileSettingsPanel";
import PdfExportButton from "./PdfExportButton";
import ActivityHeatmap from "../charts/ActivityHeatmap";

export default function ProfileDashboard() {
  const { combined, platforms, publicSettings, loading, error, refetch } = useProfileDashboard();
  const [showPublicSettings, setShowPublicSettings] = useState(false);

  const difficulty = combined?.difficulty;
  const skills = combined?.skills || {};

  const externalPlatforms = useMemo(() => platforms || [], [platforms]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[#E8E4D9] text-2xl font-bold">Coding Profile Dashboard</h1>
              <p className="text-[#78716C] text-sm mt-1">All platforms + Arrakis combined analytics</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPublicSettings(true)}
                className="px-4 py-2 text-sm rounded-md bg-[#D97706]/10 hover:bg-[#D97706]/20 text-[#D97706] border border-[#D97706]/20"
              >
                Public Profile
              </button>
              <PdfExportButton />
            </div>
          </div>

          {loading ? (
            <div className="text-[#E8E4D9]/70">Loading dashboard…</div>
          ) : error ? (
            <div className="text-red-300">
              {error} <button className="underline" onClick={refetch}>Retry</button>
            </div>
          ) : (
            <>
              <CombinedStatsCard combined={combined} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DifficultySplitChart difficulty={difficulty} />
                <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-5">
                  <div className="text-[#E8E4D9] font-semibold mb-4">Activity</div>
                  <ActivityHeatmap />
                </div>
              </div>

              <SkillBreakdownGrid skills={skills} />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[#E8E4D9] font-semibold">Connected Platforms</div>
                  <button
                    type="button"
                    onClick={refetch}
                    className="text-sm text-[#D97706] hover:text-[#F59E0B]"
                  >
                    Refresh
                  </button>
                </div>

                <PlatformConnect onSuccess={refetch} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {externalPlatforms.map((p) => (
                    <PlatformStatsCard key={p._id} platformItem={p} onSynced={refetch} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {showPublicSettings && (
        <PublicProfileSettingsPanel
          initial={publicSettings}
          onClose={() => setShowPublicSettings(false)}
          onSaved={() => {
            setShowPublicSettings(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
