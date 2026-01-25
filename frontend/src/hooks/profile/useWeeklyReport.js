

import { useState, useCallback, useRef } from "react";
import { getWeeklyReport } from "../../services/ai/aiApi";

export function useWeeklyReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const abortControllerRef = useRef(null);

  const fetchReport = useCallback(async (userId) => {
    if (!userId) {
      setError("User ID is required");
      return null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const data = await getWeeklyReport({
        userId,
        signal: abortControllerRef.current.signal,
      });

      setReport(data);
      setLastFetchedAt(new Date());
      return data;
    } catch (err) {
      if (err.name === "AbortError") {
        return null;
      }
      const message = err.message || "Failed to fetch weekly report";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearReport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setReport(null);
    setError(null);
    setLastFetchedAt(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  }, []);

  return {
    
    report,
    loading,
    error,
    lastFetchedAt,

    fetchReport,
    clearReport,
    cancel,

    hasReport: !!report,
  };
}

export default useWeeklyReport;
