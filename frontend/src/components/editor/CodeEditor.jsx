// src/components/editor/CodeEditor.jsx
import { useState, useEffect, useRef, useCallback } from "react";

const languageOptions = ["Python", "JavaScript", "Java", "C++"];

const defaultCode = {
  Python: `# cook your dish here`,
  
  JavaScript: `// cook your dish here`,
  
  Java: `/* package codechef; */

import java.util.*;
import java.lang.*;
import java.io.*;

class CodeChef
{
    public static void main (String[] args) throws java.lang.Exception
    {
        // your code goes here
    }
}`,
  
  "C++": `#include <bits/stdc++.h>
using namespace std;

int main() {
    // your code goes here
    return 0;
}`,
};

// Icons for toolbar buttons
const Icons = {
  Format: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10H7" />
      <path d="M21 6H3" />
      <path d="M21 14H3" />
      <path d="M21 18H7" />
    </svg>
  ),
  Maximize: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  Restore: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Play: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
};

// Simple code formatter for different languages
const formatCode = (code, language) => {
  const lines = code.split("\n");
  let indentLevel = 0;
  const indentSize = 4;
  const indent = () => " ".repeat(indentLevel * indentSize);
  
  // Characters that increase indent
  const openBrackets = ["{", "(", "["];
  const closeBrackets = ["}", ")", "]"];
  
  const formattedLines = lines.map((line) => {
    let trimmed = line.trim();
    if (!trimmed) return "";
    
    // Check if line starts with closing bracket
    const startsWithClose = closeBrackets.some(b => trimmed.startsWith(b));
    if (startsWithClose && indentLevel > 0) {
      indentLevel--;
    }
    
    const formattedLine = indent() + trimmed;
    
    // Check if line ends with opening bracket (excluding strings/comments)
    const endsWithOpen = openBrackets.some(b => trimmed.endsWith(b));
    // Also check for Python-style colons
    const endsWithColon = language === "Python" && trimmed.endsWith(":");
    
    if (endsWithOpen || endsWithColon) {
      indentLevel++;
    }
    
    return formattedLine;
  });
  
  return formattedLines.join("\n");
};

export default function CodeEditor({ 
  onRun, 
  onSubmit, 
  isFullscreen = false, 
  onToggleFullscreen,
  onRestore 
}) {
  const [language, setLanguage] = useState("Python");
  const [code, setCode] = useState(defaultCode[language]);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Store code for each language to preserve content when switching
  const [codeByLang, setCodeByLang] = useState(() => ({ ...defaultCode }));

  const handleLanguageChange = (newLang) => {
    // Save current code before switching
    setCodeByLang(prev => ({ ...prev, [language]: code }));
    setLanguage(newLang);
    setCode(codeByLang[newLang] || defaultCode[newLang]);
    setShowLangDropdown(false);
  };

  const handleCodeChange = useCallback((e) => {
    const newCode = e.target.value;
    setCode(newCode);
    setCodeByLang(prev => ({ ...prev, [language]: newCode }));
  }, [language]);

  // Format code handler
  const handleFormat = useCallback(() => {
    const formatted = formatCode(code, language);
    setCode(formatted);
    setCodeByLang(prev => ({ ...prev, [language]: formatted }));
  }, [code, language]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Tab key for indentation and Ctrl+Enter for submit
  const handleKeyDown = useCallback((e) => {
    // Ctrl + Enter to submit
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit?.(code, language);
      return;
    }
    
    // Tab for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + "    " + code.substring(end);
      setCode(newCode);
      setCodeByLang(prev => ({ ...prev, [language]: newCode }));
      // Set cursor position after indent
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    }
  }, [code, language, onSubmit]);

  return (
    <div className="arrakis-editor flex flex-col h-full bg-[#0A0A08] overflow-hidden">
      {/* Sticky Top Bar */}
      <div className="arrakis-editor-header flex items-center justify-between px-3 py-2 bg-[#121210] border-b border-[#1A1814] flex-shrink-0">
        {/* Left side - Language selector */}
        <div className="flex items-center gap-3">
          {/* Language Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1814] hover:bg-[#92400E]/20 border border-[#1A1814] hover:border-[#92400E]/50 text-[#E8E4D9] text-xs font-medium transition-colors duration-150"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif", letterSpacing: "0.05em" }}
            >
              <span className="uppercase">{language}</span>
              <Icons.ChevronDown />
            </button>
            
            {showLangDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[#121210] border border-[#1A1814] shadow-lg z-50 min-w-[140px] py-1">
                {languageOptions.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`w-full text-left px-3 py-2 text-xs uppercase tracking-wider transition-colors duration-150 ${
                      language === lang
                        ? "bg-[#92400E]/30 text-[#F59E0B]"
                        : "text-[#E8E4D9] hover:bg-[#1A1814]"
                    }`}
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Controls and Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Format Button */}
          <button
            onClick={handleFormat}
            className="p-1.5 text-[#78716C] hover:text-[#F59E0B] hover:bg-[#1A1814] transition-colors duration-150"
            title="Format Code"
          >
            <Icons.Format />
          </button>

          {/* Window controls */}
          <div className="flex items-center gap-1 mr-2 border-l border-[#1A1814] pl-2">
            {isFullscreen ? (
              <button
                onClick={onRestore}
                className="p-1.5 text-[#78716C] hover:text-[#F59E0B] hover:bg-[#1A1814] transition-colors duration-150"
                title="Restore (Esc)"
              >
                <Icons.Restore />
              </button>
            ) : (
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 text-[#78716C] hover:text-[#F59E0B] hover:bg-[#1A1814] transition-colors duration-150"
                title="Maximize Editor"
              >
                <Icons.Maximize />
              </button>
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={() => onRun?.(code, language)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] hover:border-[#78716C] transition-colors duration-150 text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <Icons.Play />
            <span>Run</span>
          </button>

          {/* Submit Button */}
          <button
            onClick={() => onSubmit?.(code, language)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#92400E] hover:bg-[#D97706] text-[#E8E4D9] transition-colors duration-150 text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <span>Submit</span>
          </button>
        </div>
      </div>

      {/* Code Area with Line Numbers */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex">
          {/* Line Numbers */}
          <div 
            className="line-numbers flex-shrink-0 bg-[#0A0A08] text-[#3D3D3D] text-right pr-3 pl-3 pt-4 select-none overflow-hidden border-r border-[#1A1814]"
            style={{ 
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "13px",
              lineHeight: "1.6",
              minWidth: "50px"
            }}
          >
            {code.split("\n").map((_, i) => (
              <div key={i} className="leading-relaxed">{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="flex-1 bg-[#0A0A08] text-[#E8E4D9] p-4 pl-3 resize-none focus:outline-none overflow-auto"
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "13px",
              lineHeight: "1.6",
              tabSize: 4,
              caretColor: "#F59E0B",
            }}
          />
        </div>
      </div>
    </div>
  );
}