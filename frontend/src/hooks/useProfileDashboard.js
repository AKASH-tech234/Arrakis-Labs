import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCombinedStats,
  getPlatformsWithStats,
  getPublicSettings,
} from "../services/profileDashboardApi";

export default function useProfileDashboard() {
  const [combined, setCombined] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [publicSettings, setPublicSettings] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [combinedRes, platformsRes, publicRes] = await Promise.all([
        getCombinedStats(),
        getPlatformsWithStats(),
        getPublicSettings(),
      ]);

      setCombined(combinedRes);
      setPlatforms(platformsRes);
      setPublicSettings(publicRes);
    } catch (e) {
      setError(e?.message || "Failed to load profile dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return useMemo(
    () => ({ combined, platforms, publicSettings, loading, error, refetch }),
    [combined, platforms, publicSettings, loading, error, refetch]
  );
}
