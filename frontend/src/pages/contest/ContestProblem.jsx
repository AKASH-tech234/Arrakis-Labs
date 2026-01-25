import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import contestApi from '../../services/contest/contestApi';
import { useAuth } from '../../context/AuthContext';
import { useContestTimer } from '../../hooks/contest/useContestTimer';
import useContestWebSocket from '../../hooks/contest/useContestWebSocket';

/**
 * Contest Problem Page
 * - Problem description
 * - Code editor (Monaco)
 * - Run/Submit with results
 * - Submission history
 */

const LANGUAGES = [
  { id: 'python', name: 'Python 3', extension: 'py' },
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'cpp', name: 'C++', extension: 'cpp' },
  { id: 'java', name: 'Java', extension: 'java' },
];

const DEFAULT_CODE = {
  python: `# Write your solution here
def solve():
    pass

if __name__ == "__main__":
    solve()
`,
  javascript: `// Write your solution here
function solve() {
  
}

solve();
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    
    return 0;
}
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
        
    }
}
`,
};

function TestCasePanel({ testCases, results, isRunning }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!testCases || testCases.length === 0) {
    return (
      <div className="p-4 text-gray-400 text-center">
        No sample test cases available
      </div>
    );
  }

  const activeResult = results?.[activeTab];

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {testCases.map((tc, idx) => {
          const result = results?.[idx];
          let statusColor = 'text-gray-400';
          if (result?.passed) statusColor = 'text-green-400';
          else if (result && !result.passed) statusColor = 'text-red-400';
          
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === idx
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className={statusColor}>
                {tc.label || `Case ${idx + 1}`}
                {result?.passed && ' ✓'}
                {result && !result.passed && ' ✗'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isRunning ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Input</label>
              <pre className="bg-gray-900 rounded p-3 text-sm text-gray-300 font-mono overflow-x-auto">
                {testCases[activeTab]?.input || '(empty)'}
              </pre>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Expected Output</label>
              <pre className="bg-gray-900 rounded p-3 text-sm text-gray-300 font-mono overflow-x-auto">
                {testCases[activeTab]?.expectedOutput || '(empty)'}
              </pre>
            </div>

            {activeResult && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Your Output</label>
                <pre className={`rounded p-3 text-sm font-mono overflow-x-auto ${
                  activeResult.passed ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'
                }`}>
                  {activeResult.actualOutput || '(empty)'}
                </pre>
              </div>
            )}

            {activeResult?.stderr && (
              <div>
                <label className="text-xs text-red-500 uppercase mb-1 block">Error</label>
                <pre className="bg-red-900/20 rounded p-3 text-sm text-red-300 font-mono overflow-x-auto">
                  {activeResult.stderr}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SubmissionResult({ result }) {
  if (!result) return null;

  const getVerdictColor = (verdict) => {
    switch (verdict) {
      case 'accepted': return 'text-green-400 bg-green-500/20';
      case 'wrong_answer': return 'text-red-400 bg-red-500/20';
      case 'time_limit_exceeded': return 'text-yellow-400 bg-yellow-500/20';
      case 'runtime_error': return 'text-orange-400 bg-orange-500/20';
      case 'compile_error': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getVerdictText = (verdict) => {
    return verdict?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="p-4 border-t border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getVerdictColor(result.verdict)}`}>
          {getVerdictText(result.verdict)}
        </span>
        <span className="text-gray-500 text-sm">
          {result.testsPassed}/{result.testsTotal} tests passed
        </span>
      </div>

      {result.verdict === 'accepted' && (
        <div className="text-green-400 text-center py-4">
          🎉 All test cases passed!
        </div>
      )}

      {result.firstFailedTest && result.verdict !== 'accepted' && (
        <p className="text-gray-400 text-sm">
          Failed on test case #{result.firstFailedTest}
        </p>
      )}

      {result.errorMessage && (
        <pre className="mt-2 bg-red-900/20 rounded p-3 text-sm text-red-300 font-mono overflow-x-auto">
          {result.errorMessage}
        </pre>
      )}
    </div>
  );
}

function SubmissionHistory({ submissions, onSelect }) {
  if (!submissions || submissions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No submissions yet
      </div>
    );
  }

  const getVerdictBadge = (verdict) => {
    const colors = {
      accepted: 'bg-green-500/20 text-green-400',
      wrong_answer: 'bg-red-500/20 text-red-400',
      time_limit_exceeded: 'bg-yellow-500/20 text-yellow-400',
      runtime_error: 'bg-orange-500/20 text-orange-400',
      compile_error: 'bg-purple-500/20 text-purple-400',
    };
    return colors[verdict] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="max-h-64 overflow-y-auto">
      {submissions.map((sub, idx) => (
        <div
          key={sub._id || idx}
          onClick={() => onSelect?.(sub)}
          className="p-3 border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className={`px-2 py-1 rounded text-xs ${getVerdictBadge(sub.verdict)}`}>
              {sub.verdict?.replace(/_/g, ' ')}
            </span>
            <span className="text-gray-500 text-xs">
              {sub.testsPassed}/{sub.testsTotal}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{sub.language}</span>
            <span>{new Date(sub.submittedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContestProblem() {
  const { contestId, problemId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [problem, setProblem] = useState(null);
  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [activePanel, setActivePanel] = useState('testcases'); // testcases | result | submissions

  const editorRef = useRef(null);

  // WebSocket for real-time updates (use real contest id, not slug)
  const { serverTime } = useContestWebSocket(contest?.id || null, {
    token,
    onSubmissionResult: (result) => {
      if (result.submissionId) {
        fetchSubmissions();
      }
    },
  });

  // Timer
  const { timeLeft, isEnded, formattedTime } = useContestTimer(
    contest?.endTime,
    {
      serverTime,
      onEnd: () => {
        // Contest ended - disable submissions
        setError('Contest has ended. Submissions are no longer accepted.');
      },
    }
  );

  const fetchProblem = useCallback(async () => {
    try {
      setLoading(true);
      const [problemRes, contestRes] = await Promise.all([
        contestApi.getContestProblem(contestId, problemId),
        contestApi.getContest(contestId),
      ]);
      setProblem(problemRes.data);
      setContest(contestRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load problem');
    } finally {
      setLoading(false);
    }
  }, [contestId, problemId]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await contestApi.getSubmissions(contestId, problemId);
      setSubmissions(response.data || []);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    }
  }, [contestId, problemId]);

  useEffect(() => {
    fetchProblem();
    fetchSubmissions();
  }, [fetchProblem, fetchSubmissions]);

  // Set default code when language changes
  useEffect(() => {
    if (!code || code === DEFAULT_CODE[Object.keys(DEFAULT_CODE).find(k => k !== language)]) {
      setCode(DEFAULT_CODE[language] || '');
    }
  }, [language]);

  const handleRun = async () => {
    if (!code.trim()) {
      setError('Please write some code first');
      return;
    }

    try {
      setIsRunning(true);
      setRunResults(null);
      setSubmitResult(null);
      setActivePanel('testcases');

      const response = await contestApi.runCode(contestId, {
        problemId,
        code,
        language,
      });

      setRunResults(response.data.results);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to run code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please write some code first');
      return;
    }

    if (isEnded) {
      setError('Contest has ended. Submissions are no longer accepted.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitResult(null);
      setActivePanel('result');

      const response = await contestApi.submitCode(contestId, {
        problemId,
        code,
        language,
      });

      setSubmitResult(response.data);
      fetchSubmissions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !problem) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-medium text-white mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
          <Link to={`/contests/${contestId}`} className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to contest
          </Link>
        </div>
      </div>
    );
  }

  const getTimerColor = () => {
    if (timeLeft <= 300) return 'text-red-400'; // 5 min
    if (timeLeft <= 900) return 'text-yellow-400'; // 15 min
    return 'text-white';
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/contests/${contestId}`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <div>
            <span className="text-gray-500 text-sm">Problem {problem?.label}</span>
            <h1 className="text-white font-medium">{problem?.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Timer */}
          <div className="text-center">
            <span className="text-gray-500 text-xs">Time Left</span>
            <p className={`font-mono font-bold ${getTimerColor()}`}>
              {formattedTime}
            </p>
          </div>

          {/* Problem navigation */}
          {contest?.problems && (
            <div className="flex gap-1">
              {contest.problems.map((p) => {
                const isCurrent = p.id === problemId;
                const isSolved = problem?.attemptInfo?.solved;
                return (
                  <Link
                    key={p.id}
                    to={`/contests/${contestId}/problems/${p.id}`}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-mono ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isSolved
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Problem Description */}
        <div className="w-1/2 border-r border-gray-700 overflow-y-auto">
          <div className="p-6">
            {/* Difficulty & Points */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-2 py-1 rounded text-sm ${
                problem?.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                problem?.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {problem?.difficulty}
              </span>
              <span className="text-gray-400">{problem?.points} points</span>
            </div>

            {/* Description */}
            <div className="prose prose-invert max-w-none">
              <div className="text-gray-300 whitespace-pre-wrap">
                {problem?.description}
              </div>

              {problem?.constraints && (
                <div className="mt-6">
                  <h3 className="text-white font-medium mb-2">Constraints</h3>
                  <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300">
                    {problem.constraints}
                  </pre>
                </div>
              )}

              {problem?.examples?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-white font-medium mb-2">Examples</h3>
                  {problem.examples.map((ex, idx) => (
                    <div key={idx} className="mb-4 bg-gray-800 rounded p-4">
                      <div className="mb-2">
                        <span className="text-gray-500 text-sm">Input:</span>
                        <pre className="text-gray-300 mt-1">{ex.input}</pre>
                      </div>
                      <div className="mb-2">
                        <span className="text-gray-500 text-sm">Output:</span>
                        <pre className="text-gray-300 mt-1">{ex.output}</pre>
                      </div>
                      {ex.explanation && (
                        <div>
                          <span className="text-gray-500 text-sm">Explanation:</span>
                          <p className="text-gray-400 mt-1">{ex.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor & Results */}
        <div className="w-1/2 flex flex-col">
          {/* Editor Header */}
          <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleRun}
                disabled={isRunning || isSubmitting}
                className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isRunning || isSubmitting || isEnded}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                readOnly: isEnded,
              }}
            />
          </div>

          {/* Results Panel */}
          <div className="h-64 border-t border-gray-700 bg-gray-800 flex flex-col">
            {/* Panel Tabs */}
            <div className="flex border-b border-gray-700">
              {['testcases', 'result', 'submissions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActivePanel(tab)}
                  className={`px-4 py-2 text-sm capitalize ${
                    activePanel === tab
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab === 'testcases' ? 'Test Cases' : tab}
                </button>
              ))}
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {activePanel === 'testcases' && (
                <TestCasePanel
                  testCases={problem?.sampleTestCases}
                  results={runResults}
                  isRunning={isRunning}
                />
              )}

              {activePanel === 'result' && (
                isSubmitting ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-gray-400">Judging...</p>
                    </div>
                  </div>
                ) : (
                  <SubmissionResult result={submitResult} />
                )
              )}

              {activePanel === 'submissions' && (
                <SubmissionHistory
                  submissions={submissions}
                  onSelect={(sub) => {
                    // Could load submission code here
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center justify-between">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="ml-4 text-white/80 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
