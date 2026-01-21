// src/hooks/useWeeklyReport.js
// Hook for ON-DEMAND weekly report fetching
// ❌ No auto-fetch | ❌ No polling | ❌ No WebSockets

import { useState, useCallback, useRef } from "react";
import { getWeeklyReport } from "../services/aiApi";

/**
 * Custom hook for managing weekly report state
 *
 * RULES:
 * - Only fetches when user explicitly triggers it
 * - No automatic fetching on component mount
 * - No polling or background refresh
 * - Caches result until user manually refreshes
 *
 * @returns {Object} Hook state and methods
 */
export function useWeeklyReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const abortControllerRef = useRef(null);

  /**
   * Fetch weekly report ON-DEMAND
   * @param {string} userId - User identifier
   */
  const fetchReport = useCallback(async (userId) => {
    if (!userId) {
      setError("User ID is required");
      return null;
    }

    // Cancel any pending request
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

  /**
   * Clear cached report
   */
  const clearReport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setReport(null);
    setError(null);
    setLastFetchedAt(null);
  }, []);

  /**
   * Cancel pending request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  }, []);

  return {
    // State
    report,
    loading,
    error,
    lastFetchedAt,

    // Actions
    fetchReport,
    clearReport,
    cancel,

    // Computed
    hasReport: !!report,
  };
}

export default useWeeklyReport;
