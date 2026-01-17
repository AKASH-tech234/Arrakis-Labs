// src/components/editor/CodeEditor.jsx
import { useState } from "react";

const languageOptions = ["Python", "JavaScript", "Java", "C++"];

const defaultCode = {
  Python: `def solution(nums, target):
    # Write your solution here
    pass`,
  JavaScript: `function solution(nums, target) {
    // Write your solution here
    
}`,
  Java: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}`,
  "C++": `class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};`,
};

export default function CodeEditor({ onRun, onSubmit }) {
  const [language, setLanguage] = useState("Python");
  const [code, setCode] = useState(defaultCode[language]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(defaultCode[newLang]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-[#1A1814] px-4 py-2">
        <div className="flex items-center gap-1">
          {languageOptions.map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors duration-200 ${
                language === lang
                  ? "text-[#E8E4D9] bg-[#1A1814]"
                  : "text-[#78716C] hover:text-[#E8E4D9]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 relative">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-full bg-[#0A0A08] text-[#E8E4D9] p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            tabSize: 4,
          }}
        />
        {/* Line numbers overlay hint */}
        <div className="absolute top-4 left-4 pointer-events-none select-none">
          {/* Could add line numbers here if needed */}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-end gap-3 border-t border-[#1A1814] px-4 py-3">
        <button
          onClick={() => onRun?.(code, language)}
          className="px-4 py-2 border border-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] hover:border-[#78716C] transition-colors duration-200 text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Run
        </button>
        <button
          onClick={() => onSubmit?.(code, language)}
          className="px-4 py-2 bg-[#1A1814] text-[#E8E4D9] hover:bg-[#92400E]/30 transition-colors duration-200 text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
