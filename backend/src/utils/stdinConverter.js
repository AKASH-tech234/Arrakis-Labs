/**
 * Standard Input/Output Converter Utilities
 * Handles conversion between JSON test cases and stdin/stdout formats
 * Enhanced with robust output comparison for LeetCode-style judging
 */

/**
 * Convert JSON test case input to stdin format
 * @param {Object} input - JSON input object
 * @param {string} [inputFormat] - Expected format (json, array, etc.)
 * @returns {string} - Stdin formatted string
 */
export function jsonToStdin(input, inputFormat = null) {
  if (typeof input === "string") {
    return input;
  }

  if (Array.isArray(input)) {
    // For arrays, join elements with newlines
    return input
      .map((item) => {
        if (typeof item === "object") {
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join("\n");
  }

  if (typeof input === "object" && input !== null) {
    // For objects, either use JSON or specific format
    if (inputFormat === "json") {
      return JSON.stringify(input);
    }

    // Default: join values with newlines
    return Object.values(input)
      .map((val) => {
        if (typeof val === "object") {
          return JSON.stringify(val);
        }
        return String(val);
      })
      .join("\n");
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
 * Format test case input for display
 * Converts stdin format to readable format
 * @param {string} stdin - Raw stdin string
 * @returns {string} - Formatted input for display
 */
export function formatInputForDisplay(stdin) {
  if (!stdin) return "";
  
  const lines = stdin.split("\n").filter(Boolean);
  const formatted = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    try {
      // Try to parse as JSON for nicer formatting
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        formatted.push(`[${parsed.join(", ")}]`);
      } else if (typeof parsed === "object" && parsed !== null) {
        formatted.push(JSON.stringify(parsed));
      } else {
        formatted.push(String(parsed));
      }
    } catch {
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
