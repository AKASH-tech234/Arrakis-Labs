import { useEffect, useMemo, useState } from "react";
import apiClient from "../services/api";

export default function useProfileAnalytics({ username } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    apiClient
      .get("/profile/analytics", {
        params: username ? { username } : undefined,
        signal: controller.signal,
      })
      .then((res) => {
        if (cancelled) return;
        setData(res.data?.data || null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === "CanceledError") return;
        setError(e?.response?.data?.message || e?.message || "Failed to load profile analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [username]);

  return useMemo(() => ({ data, loading, error }), [data, loading, error]);
}
