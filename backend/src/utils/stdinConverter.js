/**
 * jsonToStdin Utility
 * Converts JSON input objects to Piston-compatible stdin format
 * 
 * Rules:
 * - Arrays → length on first line, then space-separated values
 * - Nested arrays → each array on new line
 * - Scalars → value on new line
 * - Objects → process each key in order
 * - Strings → as-is (no quotes)
 * - Booleans → "true" or "false"
 * - Null → "null"
 */

/**
 * Convert a single value to stdin format
 * @param {any} value - The value to convert
 * @returns {string} - stdin formatted string
 */
function valueToStdin(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return arrayToStdin(value);
  }

  if (typeof value === "object") {
    return objectToStdin(value);
  }

  return String(value);
}

/**
 * Convert array to stdin format
 * Format: length\nspace-separated values (or nested processing)
 * @param {Array} arr - The array to convert
 * @returns {string} - stdin formatted string
 */
function arrayToStdin(arr) {
  const lines = [];
  
  // Add array length
  lines.push(String(arr.length));
  
  // Check if it's a 2D array (array of arrays)
  if (arr.length > 0 && Array.isArray(arr[0])) {
    // 2D array: each sub-array on its own line
    for (const subArr of arr) {
      if (Array.isArray(subArr)) {
        lines.push(subArr.map(v => valueToStdin(v)).join(" "));
      } else {
        lines.push(valueToStdin(subArr));
      }
    }
  } else {
    // 1D array: space-separated on one line
    if (arr.length > 0) {
      lines.push(arr.map(v => valueToStdin(v)).join(" "));
    }
  }
  
  return lines.join("\n");
}

/**
 * Convert object to stdin format
 * Process each key in order
 * @param {Object} obj - The object to convert
 * @returns {string} - stdin formatted string
 */
function objectToStdin(obj) {
  const lines = [];
  
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    lines.push(valueToStdin(value));
  }
  
  return lines.join("\n");
}

/**
 * Main conversion function
 * @param {Object|Array|any} input - The input to convert
 * @returns {string} - Piston-compatible stdin string
 * 
 * @example
 * // Single array
 * jsonToStdin({ nums: [1, 2, 3] })
 * // Output: "3\n1 2 3"
 * 
 * @example
 * // Multiple values
 * jsonToStdin({ nums: [2, 7, 11, 15], target: 9 })
 * // Output: "4\n2 7 11 15\n9"
 * 
 * @example
 * // 2D array (matrix)
 * jsonToStdin({ matrix: [[1, 2], [3, 4]] })
 * // Output: "2\n1 2\n3 4"
 * 
 * @example
 * // String input
 * jsonToStdin({ s: "hello", k: 2 })
 * // Output: "hello\n2"
 */
export function jsonToStdin(input) {
  if (input === null || input === undefined) {
    return "";
  }
  
  const result = valueToStdin(input);
  return result.trim();
}

/**
 * Convert expected output to comparable stdout format
 * @param {any} expectedOutput - The expected output value
 * @returns {string} - Normalized stdout string
 * 
 * @example
 * outputToStdout([0, 1]) // "0 1"
 * outputToStdout(6) // "6"
 * outputToStdout("hello") // "hello"
 * outputToStdout([[1,2],[3,4]]) // "1 2\n3 4"
 */
export function outputToStdout(expectedOutput) {
  if (expectedOutput === null || expectedOutput === undefined) {
    return "";
  }

  if (typeof expectedOutput === "boolean") {
    return expectedOutput ? "true" : "false";
  }

  if (typeof expectedOutput === "number") {
    return String(expectedOutput);
  }

  if (typeof expectedOutput === "string") {
    return expectedOutput.trim();
  }

  if (Array.isArray(expectedOutput)) {
    // Check if 2D array
    if (expectedOutput.length > 0 && Array.isArray(expectedOutput[0])) {
      return expectedOutput
        .map(row => row.map(v => valueToStdin(v)).join(" "))
        .join("\n");
    }
    // 1D array - space separated
    return expectedOutput.map(v => valueToStdin(v)).join(" ");
  }

  if (typeof expectedOutput === "object") {
    // For complex objects, use JSON representation
    return JSON.stringify(expectedOutput);
  }

  return String(expectedOutput).trim();
}

/**
 * Compare actual output with expected output
 * Handles whitespace normalization
 * @param {string} actual - Actual stdout from execution
 * @param {string} expected - Expected stdout
 * @returns {boolean} - Whether outputs match
 */
export function compareOutputs(actual, expected) {
  // Normalize: trim, lowercase for case-insensitive, normalize whitespace
  const normalizeOutput = (str) => {
    return str
      .trim()
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join("\n");
  };

  return normalizeOutput(actual) === normalizeOutput(expected);
}

/**
 * Parse test case from CSV JSON format
 * @param {Object} testCase - Test case object from CSV
 * @returns {{ stdin: string, expectedStdout: string }}
 */
export function parseTestCase(testCase) {
  const { input, expected_output } = testCase;
  
  return {
    stdin: jsonToStdin(input),
    expectedStdout: outputToStdout(expected_output),
  };
}

export default {
  jsonToStdin,
  outputToStdout,
  compareOutputs,
  parseTestCase,
};
