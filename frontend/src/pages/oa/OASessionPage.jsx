import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Send,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import {
  useOASession,
  useOATimer,
  useAutosave,
  useTabVisibility,
  useBeforeUnload,
} from "../../hooks/useOA";
import logger from "../../utils/logger";
import oaService from "../../services/oaService";
import AppHeader from "../../components/layout/AppHeader";
import { Badge, Button, Card } from "../../components/ui/ds";
import {
  ARRAKIS_MONACO_THEME,
  defineArrakisMonacoTheme,
} from "../../components/editor/arrakisMonacoTheme";

export default function OASession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const {
    session,
    questions,
    currentQuestionIndex,
    currentQuestion,
    loading,
    error: sessionError,
    goToQuestion,
    submitOA,
    isSubmitting,
  } = useOASession(sessionId);

  const { formattedTime, remainingMs, isExpired, isWarning, isCritical } =
    useOATimer(
      sessionId,
      session?.endAt,
      useCallback(() => {
        handleSubmitOA();
      }, []),
    );

  const [questionDetail, setQuestionDetail] = useState(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [runResults, setRunResults] = useState(null);
  const [submitResults, setSubmitResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [violationWarning, setViolationWarning] = useState(null);

  const questionStartTime = useRef(Date.now());
  const timeSpentRef = useRef(0);

  const {
    save: autosave,
    isSaving,
    lastSaved,
  } = useAutosave(sessionId, currentQuestion?.refId, 500);

  const { violations, warningsRemaining, isTerminated } = useTabVisibility(
    sessionId,
    session?.proctoring?.warningsAllowed > 0,
    (violation, data) => {
      setViolationWarning({
        message: `Warning: Tab switch detected! ${data.warningsRemaining} warnings remaining.`,
        remaining: data.warningsRemaining,
        terminated: data.terminated,
      });

      setTimeout(() => setViolationWarning(null), 5000);

      if (data.terminated) {
        navigate(`/oa/report/${sessionId}`);
      }
    },
  );

  useBeforeUnload(session?.status === "live");

  useEffect(() => {
    if (!session || !currentQuestion) return;

    const loadQuestion = async () => {
      try {
        const response = await oaService.getQuestion(
          sessionId,
          currentQuestion.refId,
        );

        if (response.success) {
          setQuestionDetail(response.data);

          if (response.data.savedAnswer?.code) {
            setCode(response.data.savedAnswer.code);
            setLanguage(response.data.savedAnswer.language || "python");
          } else if (response.data.starterCode?.[language]) {
            setCode(response.data.starterCode[language]);
          } else {
            setCode("");
          }

          setRunResults(null);
          setSubmitResults(
            currentQuestion.answer?.isSubmitted
              ? {
                  verdict: currentQuestion.answer.verdict,
                  passed: currentQuestion.answer.passedCount,
                  total: currentQuestion.answer.totalCount,
                }
              : null,
          );

          questionStartTime.current = Date.now();
          timeSpentRef.current = currentQuestion.answer?.timeSpent || 0;
        }
      } catch (err) {
        logger.error("Failed to load question:", err);
      }
    };

    loadQuestion();
  }, [sessionId, currentQuestion?.refId, session]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);

    const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
    autosave(newCode, language, elapsed);
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);

    if (!code.trim() && questionDetail?.starterCode?.[newLang]) {
      setCode(questionDetail.starterCode[newLang]);
    }
  };

  const handleRun = async () => {
    if (!code.trim()) return;

    try {
      setIsRunning(true);
      setRunResults(null);

      const response = await oaService.runCode(
        sessionId,
        currentQuestion.refId,
        {
          code,
          language,
        },
      );

      if (response.success) {
        setRunResults(response.data);
      }
    } catch (err) {
      setRunResults({ error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!code.trim()) return;

    try {
      setIsSubmittingAnswer(true);

      const response = await oaService.submitAnswer(
        sessionId,
        currentQuestion.refId,
        { code, language },
      );

      if (response.success) {
        setSubmitResults(response.data);
      }
    } catch (err) {
      setSubmitResults({ error: err.message });
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleSubmitOA = async () => {
    try {
      const elapsed = Math.floor(
        (Date.now() - questionStartTime.current) / 1000,
      );
      await oaService.saveAnswer(sessionId, currentQuestion?.refId, {
        code,
        language,
        timeSpent: elapsed,
      });

      await submitOA();
      navigate(`/oa/report/${sessionId}`);
    } catch (err) {
      logger.error("Failed to submit OA:", err);
    }
  };

  const goToPrev = () => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0A0A08" }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F59E0B]"></div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0A0A08" }}
      >
        <Card className="px-6 py-5 max-w-md border-[#7F1D1D] bg-[#2A0F0F] text-[#FCA5A5]">
          <h2
            className="text-xl font-semibold mb-2 tracking-wider uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Error
          </h2>
          <p style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            {sessionError}
          </p>
          <div className="mt-6">
            <Button
              onClick={() => navigate("/oa")}
              variant="secondary"
              size="md"
            >
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (session?.status !== "live") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0A0A08" }}
      >
        <Card className="px-6 py-5 max-w-md text-center">
          <h2
            className="text-xl font-semibold mb-2 tracking-wider uppercase text-[#E8E4D9]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Session Not Active
          </h2>
          <p
            className="text-[#A29A8C] mb-6"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            This session is {session?.status}.
          </p>
          <Button
            onClick={() => navigate(`/oa/report/${sessionId}`)}
            variant="primary"
            size="md"
          >
            View Report
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />
      <main className="pt-14">
        <div className="h-[calc(100vh-56px)] text-white flex flex-col overflow-hidden">
          {}
          {violationWarning && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#2A0F0F]/95 border border-[#7F1D1D] text-[#FCA5A5] px-6 py-3 rounded-none flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
              <span>{violationWarning.message}</span>
            </div>
          )}

          {}
          <div className="bg-[#121210] border-b border-[#1A1814] px-6 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-[#92400E] to-[#D97706] flex items-center justify-center">
                  <span className="font-bold text-sm text-[#0A0A08]">OA</span>
                </div>
                <span
                  className="font-semibold text-lg tracking-wider uppercase text-[#E8E4D9]"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Practice Session
                </span>
              </div>
              <div className="h-6 w-px bg-[#1A1814]"></div>
              <Badge variant="neutral">
                Question {currentQuestionIndex + 1} of {questions.length}
              </Badge>
            </div>

            {}
            <div
              className={`flex items-center gap-2 px-5 py-2.5 font-mono text-lg font-semibold shadow-inner border rounded-none ${
                isCritical
                  ? "bg-[#2A0F0F] text-[#FCA5A5] animate-pulse border-[#7F1D1D]"
                  : isWarning
                    ? "bg-[#2A1F0F] text-[#FDE68A] border-[#92400E]"
                    : "bg-[#1A1814] text-[#E8E4D9] border-[#3D3D3D]"
              }`}
            >
              <Clock
                className={`w-5 h-5 ${isCritical ? "animate-bounce" : ""}`}
              />
              <span className="tabular-nums">{formattedTime}</span>
            </div>

            {}
            <div className="flex items-center gap-4">
              {isSaving && (
                <div
                  className="flex items-center gap-2 text-sm text-[#A29A8C]"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></div>
                  Saving...
                </div>
              )}
              {lastSaved && !isSaving && (
                <div
                  className="flex items-center gap-2 text-sm text-[#86EFAC]"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Saved
                </div>
              )}
              <Button
                onClick={() => setShowConfirmSubmit(true)}
                disabled={isSubmitting}
                variant="primary"
                size="md"
              >
                <Send className="w-4 h-4" />
                Submit OA
              </Button>
            </div>
          </div>

          {}
          <div className="flex-1 flex overflow-hidden">
            {}
            <div className="w-1/2 border-r border-[#1A1814] flex flex-col overflow-hidden bg-[#0A0A08]">
              {}
              <div className="bg-[#121210] px-5 py-4 border-b border-[#1A1814]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-xl text-white">
                    {questionDetail?.title || "Loading..."}
                  </h2>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        questionDetail?.difficulty === "Easy"
                          ? "success"
                          : questionDetail?.difficulty === "Medium"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {questionDetail?.difficulty}
                    </Badge>
                    <Badge
                      variant="neutral"
                      className="border-[#92400E] text-[#F59E0B]"
                    >
                      {currentQuestion?.points} pts
                    </Badge>
                  </div>
                </div>
                {questionDetail?.topic && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#A29A8C] bg-[#1A1814] px-2.5 py-1 border border-[#1A1814]">
                    <span className="w-1.5 h-1.5 bg-[#A29A8C]"></span>
                    {questionDetail.topic}
                  </span>
                )}
              </div>

              {}
              <div className="flex-1 overflow-y-auto p-4">
                {questionDetail ? (
                  <>
                    <div
                      className="prose prose-invert max-w-none mb-6"
                      dangerouslySetInnerHTML={{
                        __html: questionDetail.description,
                      }}
                    />

                    <div className="mb-6">
                      <h3
                        className="text-sm font-bold text-[#A29A8C] mb-3 flex items-center gap-2 uppercase tracking-wider"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        <span className="w-1 h-4 bg-[#D97706]"></span>
                        Input Format
                      </h3>
                      <pre className="bg-[#0A0A08] p-4 text-sm text-[#E8E4D9] whitespace-pre-wrap font-mono border border-[#1A1814]">
                        {questionDetail.inputFormat ||
                          "The input consists of one or more lines. Each line represents one input parameter."}
                      </pre>
                      <div
                        className="mt-2 text-xs text-[#78716C]"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        CP format required (Codeforces-style):
                        whitespace-separated values via stdin. No JSON, no
                        brackets, no commas.
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3
                        className="text-sm font-bold text-[#A29A8C] mb-3 flex items-center gap-2 uppercase tracking-wider"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        <span className="w-1 h-4 bg-[#D97706]"></span>
                        Output Format
                      </h3>
                      <pre className="bg-[#0A0A08] p-4 text-sm text-[#E8E4D9] whitespace-pre-wrap font-mono border border-[#1A1814]">
                        {questionDetail.outputFormat ||
                          "Print the required result to standard output."}
                      </pre>
                    </div>

                    {questionDetail.constraints && (
                      <div className="mb-6">
                        <h3
                          className="text-sm font-bold text-[#A29A8C] mb-3 flex items-center gap-2 uppercase tracking-wider"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          <span className="w-1 h-4 bg-[#D97706]"></span>
                          Constraints
                        </h3>
                        <div
                          className="text-sm text-[#E8E4D9] bg-[#121210] p-4 border border-[#1A1814] font-mono"
                          dangerouslySetInnerHTML={{
                            __html: questionDetail.constraints,
                          }}
                        />
                      </div>
                    )}

                    {}
                    {questionDetail.testCases?.length > 0 && (
                      <div>
                        <h3
                          className="text-sm font-bold text-[#A29A8C] mb-3 flex items-center gap-2 uppercase tracking-wider"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          <span className="w-1 h-4 bg-[#D97706]"></span>
                          Sample Test Cases
                        </h3>
                        {questionDetail.testCases.map((tc, idx) => (
                          <div
                            key={tc.id}
                            className="bg-[#121210] p-4 mb-3 border border-[#1A1814] hover:border-[#92400E]/60 transition-colors"
                          >
                            <div
                              className="text-xs font-semibold text-[#F59E0B] mb-3 uppercase tracking-wide"
                              style={{
                                fontFamily: "'Rajdhani', system-ui, sans-serif",
                              }}
                            >
                              {tc.label || `Test Case ${idx + 1}`}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div
                                  className="text-[#78716C] text-xs font-medium mb-2 uppercase tracking-wide"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  Input
                                </div>
                                <pre className="bg-[#0A0A08] p-3 text-[#E8E4D9] text-sm overflow-x-auto font-mono border border-[#1A1814]">
                                  {tc.stdin}
                                </pre>
                              </div>
                              <div>
                                <div
                                  className="text-[#78716C] text-xs font-medium mb-2 uppercase tracking-wide"
                                  style={{
                                    fontFamily:
                                      "'Rajdhani', system-ui, sans-serif",
                                  }}
                                >
                                  Expected Output
                                </div>
                                <pre className="bg-[#0A0A08] p-3 text-[#E8E4D9] text-sm overflow-x-auto font-mono border border-[#1A1814]">
                                  {tc.expectedOutput}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#F59E0B]"></div>
                  </div>
                )}
              </div>

              {}
              <div className="bg-[#121210] px-5 py-4 border-t border-[#1A1814] flex items-center justify-between">
                <Button
                  onClick={goToPrev}
                  disabled={currentQuestionIndex === 0}
                  variant="secondary"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                {}
                <div className="flex items-center gap-2">
                  {questions.map((q, idx) => (
                    <button
                      key={q.refId}
                      onClick={() => goToQuestion(idx)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                        idx === currentQuestionIndex
                          ? "bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] ring-2 ring-[#F59E0B] ring-offset-2 ring-offset-[#121210] scale-110"
                          : q.answer?.isSubmitted
                            ? q.answer?.verdict === "accepted"
                              ? "bg-green-600 hover:bg-green-500"
                              : q.answer?.verdict === "partial"
                                ? "bg-yellow-600 hover:bg-yellow-500"
                                : "bg-red-600 hover:bg-red-500"
                            : "bg-[#1A1814] hover:bg-[#2A1F0F] text-[#E8E4D9]"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={goToNext}
                  disabled={currentQuestionIndex === questions.length - 1}
                  variant="secondary"
                  size="sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {}
            <div className="w-1/2 flex flex-col overflow-hidden bg-[#121210]">
              {}
              <div className="bg-[#121210] px-5 py-3 border-b border-[#1A1814] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs text-[#A29A8C] uppercase tracking-wider font-semibold"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Language
                  </span>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-[#0A0A08] border border-[#1A1814] px-3 py-2 text-sm font-medium text-[#E8E4D9] hover:border-[#92400E]/60 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition-colors cursor-pointer"
                  >
                    {(
                      questionDetail?.languages || [
                        "python",
                        "javascript",
                        "java",
                        "cpp",
                      ]
                    ).map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleRun}
                    disabled={isRunning || !code.trim()}
                    variant="secondary"
                    size="sm"
                  >
                    <Play
                      className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`}
                    />
                    {isRunning ? "Running..." : "Run"}
                  </Button>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={isSubmittingAnswer || !code.trim()}
                    variant="primary"
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmittingAnswer ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </div>

              {}
              <div className="flex-1 overflow-hidden">
                <Editor
                  value={code}
                  onChange={(value) => handleCodeChange(value ?? "")}
                  language={language}
                  theme={ARRAKIS_MONACO_THEME}
                  beforeMount={defineArrakisMonacoTheme}
                  height="100%"
                  options={{
                    automaticLayout: true,
                    minimap: { enabled: false },
                    fontFamily:
                      "JetBrains Mono, Fira Code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    fontSize: 13,
                    lineHeight: 20,
                    tabSize: 4,
                    insertSpaces: true,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    wordWrap: "off",
                    renderWhitespace: "selection",
                    padding: { top: 12, bottom: 12 },
                  }}
                />
              </div>

              {}
              {(runResults || submitResults) && (
                <div className="bg-[#121210] border-t border-[#1A1814] max-h-64 overflow-y-auto">
                  <div className="p-4">
                    {submitResults && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          {submitResults.verdict === "accepted" ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : submitResults.verdict === "partial" ? (
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span
                            className={`font-semibold ${
                              submitResults.verdict === "accepted"
                                ? "text-green-500"
                                : submitResults.verdict === "partial"
                                  ? "text-yellow-500"
                                  : "text-red-500"
                            }`}
                          >
                            {submitResults.verdict
                              ?.replace("_", " ")
                              .toUpperCase()}
                          </span>
                          <span
                            className="text-[#A29A8C] text-sm"
                            style={{
                              fontFamily: "'Rajdhani', system-ui, sans-serif",
                            }}
                          >
                            ({submitResults.passed}/{submitResults.total} test
                            cases passed)
                          </span>
                        </div>
                        <div
                          className="text-sm text-[#A29A8C]"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          Points earned: {submitResults.pointsEarned}/
                          {submitResults.maxPoints}
                        </div>
                      </div>
                    )}

                    {runResults && !submitResults && (
                      <div>
                        <div
                          className="text-sm font-semibold text-[#A29A8C] mb-2"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          Run Results ({runResults.passedCount}/
                          {runResults.totalCount} passed)
                        </div>
                        {runResults.results?.map((r, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded mb-2 ${
                              r.passed
                                ? "bg-green-900/20 border border-green-800"
                                : "bg-red-900/20 border border-red-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {r.passed ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm font-medium">
                                {r.label}
                              </span>
                            </div>
                            {!r.passed && (
                              <div className="text-sm">
                                {r.compileError && (
                                  <div className="text-red-400">
                                    Compile Error: {r.stderr}
                                  </div>
                                )}
                                {r.runtimeError && (
                                  <div className="text-red-400">
                                    Runtime Error: {r.stderr}
                                  </div>
                                )}
                                {r.timedOut && (
                                  <div className="text-yellow-400">
                                    Time Limit Exceeded
                                  </div>
                                )}
                                {!r.compileError &&
                                  !r.runtimeError &&
                                  !r.timedOut && (
                                    <div>
                                      <div
                                        className="text-[#A29A8C]"
                                        style={{
                                          fontFamily:
                                            "'Rajdhani', system-ui, sans-serif",
                                        }}
                                      >
                                        Expected: {r.expectedOutput}
                                      </div>
                                      <div
                                        className="text-[#A29A8C]"
                                        style={{
                                          fontFamily:
                                            "'Rajdhani', system-ui, sans-serif",
                                        }}
                                      >
                                        Got: {r.actualOutput}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {}
          {showConfirmSubmit && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <Card className="p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-[#2A1F0F] border border-[#92400E] flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-[#F59E0B]" />
                  </div>
                  <h2
                    className="text-2xl font-bold mb-2 tracking-wider uppercase text-[#E8E4D9]"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Submit OA?
                  </h2>
                  <p
                    className="text-[#A29A8C]"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Are you sure you want to submit? You still have{" "}
                    <span className="text-[#E8E4D9] font-bold bg-[#1A1814] border border-[#1A1814] px-2 py-1">
                      {formattedTime}
                    </span>{" "}
                    remaining.
                  </p>
                </div>

                <div className="mb-6 bg-[#0A0A08] p-4 border border-[#1A1814]">
                  <div
                    className="text-sm text-[#A29A8C] mb-3 font-semibold"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Question Progress:
                  </div>
                  <div className="flex gap-3 justify-center">
                    {questions.map((q, idx) => (
                      <div
                        key={q.refId}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                          q.answer?.isSubmitted
                            ? q.answer?.verdict === "accepted"
                              ? "bg-green-600"
                              : q.answer?.verdict === "partial"
                                ? "bg-yellow-600"
                                : "bg-red-600"
                            : "bg-[#1A1814] border border-[#1A1814]"
                        }`}
                      >
                        {q.answer?.isSubmitted ? (
                          q.answer?.verdict === "accepted" ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            idx + 1
                          )
                        ) : (
                          idx + 1
                        )}
                      </div>
                    ))}
                  </div>
                  <div
                    className="flex justify-center gap-4 mt-4 text-xs text-[#78716C]"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-600 rounded"></span>{" "}
                      Solved
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-yellow-600 rounded"></span>{" "}
                      Partial
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-[#1A1814] rounded border border-[#1A1814]"></span>{" "}
                      Not submitted
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => setShowConfirmSubmit(false)}
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                  >
                    Continue Working
                  </Button>
                  <Button
                    onClick={handleSubmitOA}
                    disabled={isSubmitting}
                    variant="primary"
                    size="lg"
                    className="flex-1"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Now"}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
