/**
 * Standard Input/Output Converter Utilities
 * Handles conversion between JSON test cases and stdin/stdout formats
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
 * Compare two outputs for equality
 * Handles whitespace normalization and type coercion
 * @param {*} actual - Actual output from execution
 * @param {*} expected - Expected output from test case
 * @param {Object} [options] - Comparison options
 * @returns {boolean} - True if outputs match
 */
export function compareOutputs(actual, expected, options = {}) {
  const {
    ignoreWhitespace = true,
    ignoreCase = false,
    floatTolerance = null,
    trimLines = true,
  } = options;

  // Normalize inputs to strings
  let actualStr = String(actual ?? "");
  let expectedStr = String(expected ?? "");

  // Trim lines if enabled
  if (trimLines) {
    actualStr = actualStr
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
    expectedStr = expectedStr
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  }

  // Handle whitespace normalization
  if (ignoreWhitespace) {
    actualStr = actualStr.replace(/\s+/g, " ").trim();
    expectedStr = expectedStr.replace(/\s+/g, " ").trim();
  }

  // Handle case sensitivity
  if (ignoreCase) {
    actualStr = actualStr.toLowerCase();
    expectedStr = expectedStr.toLowerCase();
  }

  // Direct string comparison first
  if (actualStr === expectedStr) {
    return true;
  }

  // Try numeric comparison with tolerance
  if (floatTolerance !== null) {
    const actualNum = parseFloat(actualStr);
    const expectedNum = parseFloat(expectedStr);

    if (!isNaN(actualNum) && !isNaN(expectedNum)) {
      return Math.abs(actualNum - expectedNum) <= floatTolerance;
    }
  }

  // Try JSON comparison for arrays/objects
  try {
    const actualJson = JSON.parse(actualStr);
    const expectedJson = JSON.parse(expectedStr);
    return JSON.stringify(actualJson) === JSON.stringify(expectedJson);
  } catch {
    // Not valid JSON, continue with string comparison
  }

  // Line-by-line comparison for multi-line outputs
  const actualLines = actualStr.split("\n");
  const expectedLines = expectedStr.split("\n");

  if (actualLines.length !== expectedLines.length) {
    return false;
  }

  for (let i = 0; i < actualLines.length; i++) {
    if (actualLines[i] !== expectedLines[i]) {
      // Try numeric comparison for each line
      if (floatTolerance !== null) {
        const actualNum = parseFloat(actualLines[i]);
        const expectedNum = parseFloat(expectedLines[i]);

        if (
          !isNaN(actualNum) &&
          !isNaN(expectedNum) &&
          Math.abs(actualNum - expectedNum) <= floatTolerance
        ) {
          continue;
        }
      }
      return false;
    }
  }

  return true;
}

export default {
  jsonToStdin,
  outputToStdout,
  compareOutputs,
};
