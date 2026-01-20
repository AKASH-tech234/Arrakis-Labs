import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import { getPublicProfile } from "../services/profileDashboardApi";
import CombinedStatsCard from "../components/profileDashboard/CombinedStatsCard";
import DifficultySplitChart from "../components/profileDashboard/DifficultySplitChart";
import SkillBreakdownGrid from "../components/profileDashboard/SkillBreakdownGrid";

export default function PublicProfilePage() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPublicProfile(username)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        document.title = `${d?.user?.publicUsername || username} | Coding Profile`;
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Profile not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />
      <main className="pt-20">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12 space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[#E8E4D9] text-2xl font-bold">@{username}</div>
              {data?.user?.name && <div className="text-[#78716C] mt-1">{data.user.name}</div>}
            </div>
            <Link className="text-[#D97706] hover:text-[#F59E0B]" to="/">
              Home
            </Link>
          </div>

          {loading ? (
            <div className="text-[#E8E4D9]/70">Loading…</div>
          ) : error ? (
            <div className="text-red-300">{error}</div>
          ) : (
            <>
              <CombinedStatsCard combined={data?.aggregated} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DifficultySplitChart difficulty={data?.aggregated?.difficulty} />
                <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-5">
                  <div className="text-[#E8E4D9] font-semibold mb-2">Platforms</div>
                  <div className="text-[#78716C] text-sm">
                    {data?.platforms?.length || 0} platforms synced
                  </div>
                </div>
              </div>
              <SkillBreakdownGrid skills={data?.aggregated?.skills || {}} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
