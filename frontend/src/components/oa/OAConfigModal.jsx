import { useState, useEffect } from "react";
import { X, Building2, Gauge, Clock, Shield, Play } from "lucide-react";
import oaService from "../../services/oaService";

/**
 * OA Configuration Modal - Configure OA settings before starting
 */
export default function OAConfigModal({ onClose, onStart }) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  // Config state
  const [config, setConfig] = useState({
    companyMode: "all", // "all" or "selected"
    selectedCompanies: [],
    selectedTopics: [], // Keep for API compatibility but not used in UI
    difficulty: "mixed",
    durationMinutes: 60,
    questionCounts: { coding: 2 },
    proctoring: {
      detectTabSwitch: true,
      warningsAllowed: 3,
    },
  });

  // Load metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const response = await oaService.getMetadata();
        if (response.success) {
          setMetadata(response.data);
          // Set defaults from metadata
          setConfig((prev) => ({
            ...prev,
            durationMinutes: response.data.defaults?.duration || 60,
            difficulty: response.data.defaults?.difficulty || "mixed",
            questionCounts: response.data.defaults?.questionCounts || { coding: 2 },
            proctoring: response.data.defaults?.proctoring || prev.proctoring,
          }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, []);

  // Handle company selection - includes all case variations for accurate matching
  const toggleCompany = (companyName) => {
    // Find the company object to get variations
    const companyObj = metadata?.companies?.find(c => c.name === companyName);
    const variations = companyObj?.variations || [companyName];

    setConfig((prev) => {
      const isCurrentlySelected = prev.selectedCompanies.includes(companyName);
      
      let newSelected;
      if (isCurrentlySelected) {
        // Remove all variations of this company
        newSelected = prev.selectedCompanies.filter(c => !variations.includes(c));
      } else {
        // Add all variations of this company
        newSelected = [...new Set([...prev.selectedCompanies, ...variations])];
      }

      return {
        ...prev,
        selectedCompanies: newSelected,
        companyMode: newSelected.length > 0 ? "selected" : "all",
      };
    });
  };

  // Handle start
  const handleStart = async () => {
    try {
      setStarting(true);
      setError(null);
      await onStart(config);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-[#0F0F0D] rounded-xl p-8 border border-[#1A1814]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D97706] mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="bg-[#0F0F0D] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[#1A1814]"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1A1814]">
          <div>
            <h2 className="text-xl font-semibold text-[#E8E4D9] uppercase tracking-wider">Configure Your OA</h2>
            <p className="text-xs text-[#78716C] uppercase tracking-widest mt-1">Set up your practice OA run</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1A1814] rounded-lg transition-colors text-[#78716C] hover:text-[#E8E4D9]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Companies */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-[#D97706]" />
              <h3 className="font-semibold text-[#E8E4D9] uppercase tracking-wider">Target Companies (Optional)</h3>
            </div>
            <p className="text-sm text-[#78716C] mb-3">
              Select companies to get questions from their interview pool. Leave
              empty for general practice.
            </p>
            <div className="flex flex-wrap gap-2">
              {metadata?.companies?.map((company) => {
                // Check if any variation of this company is selected
                const isSelected = company.variations?.some(v => config.selectedCompanies.includes(v)) 
                  || config.selectedCompanies.includes(company.name);
                return (
                  <button
                    key={company.name}
                    onClick={() => toggleCompany(company.name)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      isSelected
                        ? "bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/40"
                        : "bg-[#0A0A08] text-[#78716C] hover:text-[#E8E4D9] border border-[#1A1814] hover:border-[#D97706]/30"
                    }`}
                  >
                    {company.name}
                    {company.count && (
                      <span className="ml-1.5 text-xs opacity-70">({company.count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-5 h-5 text-[#F59E0B]" />
              <h3 className="font-semibold text-[#E8E4D9] uppercase tracking-wider">Difficulty</h3>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {["easy", "medium", "hard", "mixed", "adaptive"].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setConfig((prev) => ({ ...prev, difficulty: diff }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    config.difficulty === diff
                      ? diff === "easy"
                        ? "bg-[#78716C]/15 text-[#E8E4D9] border border-[#78716C]/30"
                        : diff === "medium"
                        ? "bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/40"
                        : diff === "hard"
                        ? "bg-[#92400E]/20 text-[#D97706] border border-[#92400E]/40"
                        : "bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/40"
                      : "bg-[#0A0A08] text-[#78716C] hover:text-[#E8E4D9] border border-[#1A1814] hover:border-[#D97706]/30"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
            {config.difficulty === "adaptive" && (
              <p className="text-sm text-[#D97706] mt-2">
                Adaptive mode adjusts difficulty based on your past performance.
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-[#D97706]" />
              <h3 className="font-semibold text-[#E8E4D9] uppercase tracking-wider">Duration</h3>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {metadata?.durationOptions?.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, durationMinutes: opt.value }))
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    config.durationMinutes === opt.value
                      ? "bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/40"
                      : "bg-[#0A0A08] text-[#78716C] hover:text-[#E8E4D9] border border-[#1A1814] hover:border-[#D97706]/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#E8E4D9] uppercase tracking-wider">Number of Questions</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      questionCounts: {
                        coding: Math.max(1, prev.questionCounts.coding - 1),
                      },
                    }))
                  }
                  disabled={config.questionCounts.coding <= 1}
                  className="w-8 h-8 rounded bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span className="text-xl font-bold w-8 text-center">
                  {config.questionCounts.coding}
                </span>
                <button
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      questionCounts: {
                        coding: Math.min(5, prev.questionCounts.coding + 1),
                      },
                    }))
                  }
                  disabled={config.questionCounts.coding >= 5}
                  className="w-8 h-8 rounded bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-sm text-[#78716C]">
              Real OAs typically have 2-4 coding questions.
            </p>
          </div>

          {/* Proctoring */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-[#92400E]" />
              <h3 className="font-semibold text-[#E8E4D9] uppercase tracking-wider">Proctoring</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.proctoring.detectTabSwitch}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      proctoring: {
                        ...prev.proctoring,
                        detectTabSwitch: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 rounded border-[#1A1814] bg-[#0A0A08] text-[#D97706] focus:ring-[#D97706]/50"
                />
                <span className="text-[#E8E4D9]">Detect tab switches (warnings on leaving)</span>
              </label>

              {config.proctoring.detectTabSwitch && (
                <div className="ml-7">
                  <label className="text-sm text-[#78716C] block mb-1">
                    Warnings before termination:
                  </label>
                  <select
                    value={config.proctoring.warningsAllowed}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        proctoring: {
                          ...prev.proctoring,
                          warningsAllowed: parseInt(e.target.value),
                        },
                      }))
                    }
                    className="bg-[#0A0A08] border border-[#1A1814] rounded px-3 py-1.5 text-sm text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50"
                  >
                    <option value={1}>1 warning</option>
                    <option value={2}>2 warnings</option>
                    <option value={3}>3 warnings</option>
                    <option value={5}>5 warnings</option>
                    <option value={10}>10 warnings (lenient)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1A1814] flex items-center justify-between bg-[#0A0A08]">
          <div className="text-sm text-[#78716C]">
            {config.questionCounts.coding} question{config.questionCounts.coding > 1 ? "s" : ""} •{" "}
            {config.durationMinutes} minutes •{" "}
            <span className="capitalize">{config.difficulty}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] font-medium border border-[#1A1814] hover:border-[#78716C]/30"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={starting}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-[#D97706]/20"
            >
              <Play className="w-4 h-4" />
              {starting ? "Starting..." : "Start OA"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
