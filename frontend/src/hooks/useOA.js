import { useState, useEffect, useCallback, useRef } from "react";
import oaService from "../services/oaService";

export function useOASession(sessionId) {
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await oaService.getSession(sessionId);

      if (response.success) {
        setSession(response.data);
        setQuestions(response.data.questions || []);
        setCurrentQuestionIndex(response.data.currentQuestionIndex || 0);
        setError(null);
      } else {
        setError(response.error || "Failed to load session");
      }
    } catch (err) {
      setError(err.message || "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const goToQuestion = useCallback((index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  }, [questions.length]);

  const submitOA = useCallback(async () => {
    if (!sessionId) return null;

    try {
      setIsSubmitting(true);
      const response = await oaService.submitSession(sessionId);

      if (response.success) {
        setSession((prev) => ({
          ...prev,
          status: "submitted",
          submittedAt: response.data.submittedAt,
        }));
      }

      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId]);

  const terminateOA = useCallback(async (reason) => {
    if (!sessionId) return null;

    try {
      const response = await oaService.terminateSession(sessionId, reason);

      if (response.success) {
        setSession((prev) => ({
          ...prev,
          status: "terminated",
          terminatedReason: reason,
        }));
      }

      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [sessionId]);

  return {
    session,
    questions,
    currentQuestionIndex,
    currentQuestion: questions[currentQuestionIndex] || null,
    loading,
    error,
    isSubmitting,
    goToQuestion,
    submitOA,
    terminateOA,
    refetch: fetchSession,
  };
}

export function useOATimer(sessionId, endAt, onTimeUp) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const syncIntervalRef = useRef(null);
  const tickIntervalRef = useRef(null);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const calculateRemaining = useCallback(() => {
    if (!endAt) return 0;
    const remaining = new Date(endAt) - Date.now();
    return Math.max(0, remaining);
  }, [endAt]);

  const syncWithServer = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await oaService.syncTimer(sessionId);
      if (response.success) {
        const serverRemaining = response.data.remainingMs;
        setRemainingMs(serverRemaining);

        if (serverRemaining <= 0 && !isExpired) {
          setIsExpired(true);
          onTimeUpRef.current?.();
        }
      }
    } catch (err) {

      setRemainingMs(calculateRemaining());
    }
  }, [sessionId, isExpired, calculateRemaining]);

  useEffect(() => {
    if (!sessionId || !endAt) return;

    const initial = calculateRemaining();
    setRemainingMs(initial);

    if (initial <= 0) {
      setIsExpired(true);
      onTimeUpRef.current?.();
      return;
    }

    tickIntervalRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        const next = Math.max(0, prev - 1000);
        if (next <= 0 && !isExpired) {
          setIsExpired(true);
          setTimeout(() => onTimeUpRef.current?.(), 0);
        }
        return next;
      });
    }, 1000);

    syncIntervalRef.current = setInterval(syncWithServer, 30000);

    syncWithServer();

    return () => {
      clearInterval(tickIntervalRef.current);
      clearInterval(syncIntervalRef.current);
    };
  }, [sessionId, endAt, calculateRemaining, syncWithServer, isExpired]);

  const formatTime = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, []);

  return {
    remainingMs,
    formattedTime: formatTime(remainingMs),
    isExpired,
    isWarning: remainingMs > 0 && remainingMs <= 5 * 60 * 1000,
    isCritical: remainingMs > 0 && remainingMs <= 1 * 60 * 1000,
    syncNow: syncWithServer,
  };
}

export function useAutosave(sessionId, questionId, delay = 500) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const timeoutRef = useRef(null);
  const pendingRef = useRef(null);

  const save = useCallback(
    async (code, language, timeSpent = 0) => {
      if (!sessionId || !questionId) return;

      pendingRef.current = { code, language, timeSpent };

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        if (!pendingRef.current) return;

        const data = pendingRef.current;
        pendingRef.current = null;

        try {
          setIsSaving(true);
          setSaveError(null);

          const response = await oaService.saveAnswer(sessionId, questionId, {
            code: data.code,
            language: data.language,
            timeSpent: data.timeSpent,
          });

          if (response.success) {
            setLastSaved(new Date(response.data.savedAt));
          } else {
            setSaveError(response.error || "Save failed");
          }
        } catch (err) {
          setSaveError(err.message || "Save failed");
        } finally {
          setIsSaving(false);
        }
      }, delay);
    },
    [sessionId, questionId, delay]
  );

  const saveNow = useCallback(
    async (code, language, timeSpent = 0) => {
      if (!sessionId || !questionId) return;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pendingRef.current = null;

      try {
        setIsSaving(true);
        setSaveError(null);

        const response = await oaService.saveAnswer(sessionId, questionId, {
          code,
          language,
          timeSpent,
        });

        if (response.success) {
          setLastSaved(new Date(response.data.savedAt));
        }

        return response;
      } catch (err) {
        setSaveError(err.message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [sessionId, questionId]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    saveNow,
    isSaving,
    lastSaved,
    saveError,
  };
}

export function useBeforeUnload(isActive = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "You have an active OA session. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isActive]);
}

export function useTabVisibility(sessionId, enabled = true, onViolation) {
  const [violations, setViolations] = useState([]);
  const [warningsRemaining, setWarningsRemaining] = useState(3);
  const [isTerminated, setIsTerminated] = useState(false);
  const onViolationRef = useRef(onViolation);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    if (!sessionId || !enabled) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        try {
          const response = await oaService.recordViolation(
            sessionId,
            "tab_hidden",
            {
              url: window.location.href,
              timestamp: new Date().toISOString(),
            }
          );

          if (response.success && response.data.recorded) {
            const violation = {
              type: "tab_hidden",
              warningNumber: response.data.warningNumber,
              timestamp: new Date(),
            };

            setViolations((prev) => [...prev, violation]);
            setWarningsRemaining(response.data.warningsRemaining);

            if (response.data.terminated) {
              setIsTerminated(true);
            }

            onViolationRef.current?.(violation, response.data);
          }
        } catch (err) {
          console.error("Failed to record violation:", err);
        }
      }
    };

    const handleBlur = async () => {
      try {
        const response = await oaService.recordViolation(
          sessionId,
          "tab_blur",
          {
            timestamp: new Date().toISOString(),
          }
        );

        if (response.success && response.data.recorded) {
          const violation = {
            type: "tab_blur",
            warningNumber: response.data.warningNumber,
            timestamp: new Date(),
          };

          setViolations((prev) => [...prev, violation]);
          setWarningsRemaining(response.data.warningsRemaining);

          if (response.data.terminated) {
            setIsTerminated(true);
          }

          onViolationRef.current?.(violation, response.data);
        }
      } catch (err) {
        console.error("Failed to record blur violation:", err);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sessionId, enabled]);

  return {
    violations,
    warningsRemaining,
    isTerminated,
    totalViolations: violations.length,
  };
}

export default {
  useOASession,
  useOATimer,
  useAutosave,
  useTabVisibility,
  useBeforeUnload,
};
