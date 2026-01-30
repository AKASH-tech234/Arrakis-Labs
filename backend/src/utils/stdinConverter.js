/**
 * Standard Input/Output Converter Utilities
 * 
 * 🚨 CRITICAL: STRICT CP-STYLE INPUT FORMAT ONLY
 * 
 * This module handles conversion between data structures and stdin/stdout formats.
 * ALL inputs MUST be in Competitive Programming (CP) style format.
 * 
 * MANDATORY RULES:
 * - NO JSON brackets [ ], { } in stdin
 * - NO commas or quoted strings
 * - Only numeric, space-separated input
 * - Arrays: n on first line, space-separated elements on second
 * - 2D Arrays: k arrays format with length before each row
 * 
 * Enhanced with robust output comparison for LeetCode-style judging
 */

import {
  arrayToCPFormat,
  kArraysToCPFormat,
  validateCPFormat,
} from "./cpInputFormat.js";

/**
 * Convert a single value to stdin-friendly format (CP-STYLE ONLY)
 * @param {any} val - Value to convert
 * @returns {string} - Stdin formatted string in CP format
 */
function valueToStdin(val) {
  if (val === null || val === undefined) {
    return "";
  }
  
  if (Array.isArray(val)) {
    // Convert array to CP format: length on first line, space-separated elements on second line
    // For 2D arrays: k-arrays format
    if (val.length > 0 && Array.isArray(val[0])) {
      // 2D array: k-arrays CP format
      // k
      // len1
      // arr1 elements
      // len2
      // arr2 elements
      const lines = [String(val.length)];
      for (const row of val) {
        lines.push(String(row.length));
        lines.push(row.join(" "));
      }
      return lines.join("\n");
    }
    // 1D array: length then space-separated elements
    return `${val.length}\n${val.join(" ")}`;
  }
  
  if (typeof val === "object") {
    // For objects like trees/graphs, convert to CP edge list format
    // This is a fallback - specific structures should use dedicated converters
    console.warn("[stdinConverter] ⚠️ Object type detected - converting to CP format");
    
    // Try to extract arrays from common object patterns
    const keys = Object.keys(val);
    const lines = [];
    
    for (const key of keys) {
      const v = val[key];
      if (Array.isArray(v)) {
        lines.push(String(v.length));
        lines.push(v.join(" "));
      } else {
        lines.push(String(v));
      }
    }
    
    return lines.join("\n");
  }
  
  return String(val);
}

/**
 * Convert JSON test case input to stdin format (CP-STYLE ONLY)
 * 
 * CRITICAL: This function MUST output CP format, NEVER JSON
 * 
 * Input patterns converted to CP format:
 * - { nums: [1,2,3], target: 5 } -> "3\n1 2 3\n5"
 * - { arr: [1,2,3], k: 2 } -> "3\n1 2 3\n2"
 * - [1,2,3] -> "3\n1 2 3"
 * - [[1,2],[3,4]] -> "2\n2\n1 2\n2\n3 4"
 * - { n: 5 } -> "5"
 * 
 * @param {Object} input - JSON input object
 * @param {string} [inputFormat] - Expected format (IGNORED - always outputs CP)
 * @returns {string} - Stdin formatted string in CP format
 */
export function jsonToStdin(input, inputFormat = null) {
  if (typeof input === "string") {
    // If already a string, validate it's in CP format
    const validation = validateCPFormat(input);
    if (!validation.valid) {
      console.warn(`[stdinConverter] ⚠️ Input string contains non-CP format: ${validation.error}`);
      // Attempt to convert if it looks like JSON
      if (input.trim().startsWith("[") || input.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(input.trim());
          return jsonToStdin(parsed); // Recursive call to convert
        } catch (e) {
          // Not valid JSON, return as-is
        }
      }
    }
    return input;
  }

  // DEPRECATED: Never output JSON format anymore
  // if (inputFormat === "json") { ... }

  if (Array.isArray(input)) {
    // Top-level array - convert to CP format
    return valueToStdin(input);
  }

  if (typeof input === "object" && input !== null) {
    const keys = Object.keys(input);
    const lines = [];
    
    // Check for common patterns and convert appropriately to CP format
    for (const key of keys) {
      const val = input[key];
      
      if (Array.isArray(val)) {
        // For arrays: add length, then space-separated elements
        if (val.length > 0 && Array.isArray(val[0])) {
          // 2D array -> k-arrays CP format
          lines.push(String(val.length));
          for (const row of val) {
            lines.push(String(row.length));
            lines.push(row.join(" "));
          }
        } else {
          // 1D array -> length + elements
          lines.push(String(val.length));
          lines.push(val.join(" "));
        }
      } else if (typeof val === "object" && val !== null) {
        // Nested objects: convert recursively
        console.warn(`[stdinConverter] ⚠️ Nested object in input - converting to CP format`);
        const nestedCP = jsonToStdin(val);
        lines.push(nestedCP);
      } else {
        // Primitive value (number, string, boolean)
        lines.push(String(val));
      }
    }
    
    return lines.join("\n");
  }

  return String(input || "");
}

/**
 * Convert stdout to structured output format
 * @param {string} stdout - Raw stdout string
 * @param {string} [outputFormat] - Expected format (json, string, number, etc.)
 * @returns {*} - Parsed output
 */
export function outputToStdout(stdout, outputFormat = null) {
  if (!stdout) return "";

  const trimmed = stdout.trim();

  if (outputFormat === "json") {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  if (outputFormat === "number") {
    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
  }

  if (outputFormat === "boolean") {
    return trimmed.toLowerCase() === "true";
  }

  if (outputFormat === "array") {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Try parsing as newline-separated values
      return trimmed
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  return trimmed;
}

/**
 * Normalize a string for comparison
 * Handles common whitespace, formatting, and encoding issues
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
function normalizeForComparison(str) {
  if (str === null || str === undefined) return "";
  
  return String(str)
    // Normalize line endings (CRLF -> LF)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Trim each line
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    // Remove trailing newlines
    .trim()
    // Collapse multiple spaces to single space
    .replace(/[ \t]+/g, " ")
    // Normalize unicode whitespace
    .replace(/[\u00A0\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/g, " ");
}

/**
 * Try to parse a value as a number
 * @param {string} str - String to parse
 * @returns {{ isNumber: boolean, value: number }} - Parse result
 */
function tryParseNumber(str) {
  const trimmed = String(str).trim();
  
  // Handle special cases
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
    return { isNumber: false, value: NaN };
  }
  
  // Try parsing as number
  const num = Number(trimmed);
  
  // Check if it's a valid number (not NaN and finite)
  if (!isNaN(num) && isFinite(num)) {
    return { isNumber: true, value: num };
  }
  
  return { isNumber: false, value: NaN };
}

/**
 * Try to parse a value as JSON
 * @param {string} str - String to parse
 * @returns {{ isJSON: boolean, value: any }} - Parse result
 */
function tryParseJSON(str) {
  const trimmed = String(str).trim();
  
  // Quick check: must start with [ or {
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return { isJSON: false, value: null };
  }
  
  try {
    const parsed = JSON.parse(trimmed);
    return { isJSON: true, value: parsed };
  } catch {
    return { isJSON: false, value: null };
  }
}

/**
 * Deep compare two values for equality
 * Handles arrays, objects, and primitives
 * @param {any} a - First value
 * @param {any} b - Second value
 * @returns {boolean} - True if equal
 */
function deepEqual(a, b) {
  // Same reference or both null/undefined
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  
  // Different types
  if (typeof a !== typeof b) return false;
  
  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }
  
  // Objects
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  
  // Primitives
  return a === b;
}

/**
 * Compare two outputs for equality with enhanced normalization
 * Handles whitespace, type coercion, JSON comparison, and float tolerance
 * 
 * CRITICAL: This function determines if a solution is correct.
 * It must handle:
 * - Trailing/leading whitespace
 * - Different line endings (CRLF vs LF)
 * - Integer vs string number outputs
 * - Array/object JSON comparison (order-sensitive)
 * - Float precision tolerance
 * - Multi-line outputs
 * - Empty outputs
 * 
 * @param {*} actual - Actual output from code execution
 * @param {*} expected - Expected output from test case
 * @param {Object} [options] - Comparison options
 * @returns {boolean} - True if outputs match
 */
export function compareOutputs(actual, expected, options = {}) {
  const {
    ignoreWhitespace = true,
    ignoreCase = false,
    floatTolerance = 1e-6,  // Default float tolerance for precision issues
    trimLines = true,
    allowNumericStringMatch = true, // "42" matches 42
  } = options;

  // Handle null/undefined
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) {
    // One is null, check if the other is empty
    const actualStr = normalizeForComparison(actual);
    const expectedStr = normalizeForComparison(expected);
    return actualStr === "" && expectedStr === "" || actualStr === expectedStr;
  }

  // Normalize to strings
  let actualStr = normalizeForComparison(actual);
  let expectedStr = normalizeForComparison(expected);

  // Quick exact match (after normalization)
  if (actualStr === expectedStr) {
    return true;
  }

  // Handle case sensitivity
  if (ignoreCase) {
    if (actualStr.toLowerCase() === expectedStr.toLowerCase()) {
      return true;
    }
  }

  // Try numeric comparison (handles "5" == 5, 5.0 == 5, etc.)
  if (allowNumericStringMatch) {
    const actualNum = tryParseNumber(actualStr);
    const expectedNum = tryParseNumber(expectedStr);
    
    if (actualNum.isNumber && expectedNum.isNumber) {
      // Integer comparison (no tolerance needed)
      if (Number.isInteger(actualNum.value) && Number.isInteger(expectedNum.value)) {
        if (actualNum.value === expectedNum.value) {
          return true;
        }
      }
      
      // Float comparison with tolerance
      if (Math.abs(actualNum.value - expectedNum.value) <= floatTolerance) {
        return true;
      }
      
      // Relative tolerance for large numbers
      const maxVal = Math.max(Math.abs(actualNum.value), Math.abs(expectedNum.value));
      if (maxVal > 1 && Math.abs(actualNum.value - expectedNum.value) / maxVal <= floatTolerance) {
        return true;
      }
    }
  }

  // Try JSON comparison (for arrays/objects)
  const actualJSON = tryParseJSON(actualStr);
  const expectedJSON = tryParseJSON(expectedStr);
  
  if (actualJSON.isJSON && expectedJSON.isJSON) {
    if (deepEqual(actualJSON.value, expectedJSON.value)) {
      return true;
    }
  }

  // Line-by-line comparison for multi-line outputs
  const actualLines = actualStr.split("\n").filter(line => line.trim() !== "");
  const expectedLines = expectedStr.split("\n").filter(line => line.trim() !== "");

  if (actualLines.length !== expectedLines.length) {
    return false;
  }

  // Compare each line
  for (let i = 0; i < actualLines.length; i++) {
    const actualLine = actualLines[i].trim();
    const expectedLine = expectedLines[i].trim();
    
    // Exact match
    if (actualLine === expectedLine) {
      continue;
    }
    
    // Case-insensitive match
    if (ignoreCase && actualLine.toLowerCase() === expectedLine.toLowerCase()) {
      continue;
    }
    
    // Numeric match for this line
    const actualLineNum = tryParseNumber(actualLine);
    const expectedLineNum = tryParseNumber(expectedLine);
    
    if (actualLineNum.isNumber && expectedLineNum.isNumber) {
      if (Math.abs(actualLineNum.value - expectedLineNum.value) <= floatTolerance) {
        continue;
      }
    }
    
    // JSON match for this line
    const actualLineJSON = tryParseJSON(actualLine);
    const expectedLineJSON = tryParseJSON(expectedLine);
    
    if (actualLineJSON.isJSON && expectedLineJSON.isJSON) {
      if (deepEqual(actualLineJSON.value, expectedLineJSON.value)) {
        continue;
      }
    }
    
    // No match found
    return false;
  }

  return true;
}

/**
 * Format test case input for display (CP FORMAT)
 * Displays stdin in a clean, readable CP format
 * @param {string} stdin - Raw stdin string in CP format
 * @returns {string} - Formatted input for display
 */
export function formatInputForDisplay(stdin) {
  if (!stdin) return "";
  
  const lines = stdin.split("\n").filter(Boolean);
  const formatted = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // CP format is already human-readable - just clean up whitespace
    // Check if it's a space-separated array line
    if (trimmed.includes(" ") && /^-?\d+(\s+-?\d+)+$/.test(trimmed)) {
      // It's an array line - display with clean spacing
      const nums = trimmed.split(/\s+/);
      formatted.push(`[${nums.join(", ")}]`); // Display as array for readability
    } else {
      // Single value or other format - keep as-is
      formatted.push(trimmed);
    }
  }
  
  return formatted.join("\n");
}

/**
 * Format test case output for display
 * @param {string} output - Raw output string
 * @returns {string} - Formatted output for display
 */
export function formatOutputForDisplay(output) {
  if (!output) return "";
  return normalizeForComparison(output);
}

export default {
  jsonToStdin,
  outputToStdout,
  compareOutputs,
  formatInputForDisplay,
  formatOutputForDisplay,
};
