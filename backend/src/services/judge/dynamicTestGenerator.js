/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DYNAMIC TEST CASE GENERATOR - STRICT CP-STYLE INPUT FORMAT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Generates test cases dynamically at submission time by:
 * 1. Analyzing existing test cases from the database
 * 2. Parsing constraints from the problem description
 * 3. Generating new inputs based on the learned structure
 * 4. Using the user's solution (if it passes visible tests) to compute expected outputs
 * 
 * These test cases are NEVER stored in the database - they exist only during
 * submission evaluation.
 * 
 * 🚨 CRITICAL: ALL INPUTS MUST BE IN CP-STYLE FORMAT ONLY
 * 
 * MANDATORY INPUT RULES (NO EXCEPTIONS):
 * - ALL inputs are strictly in Competitive Programming (CP) format
 * - JSON-style parsing is STRICTLY FORBIDDEN
 * - NO brackets [ ], { }, commas, or quoted strings
 * - Only numeric, space-separated input is allowed
 * 
 * CP FORMAT SPECIFICATIONS:
 * - 1D Array:    n\n a1 a2 a3 ... an
 * - 2D Array:    r\n c1\n row1...\n c2\n row2...
 * - K Arrays:    k\n len1\n arr1...\n len2\n arr2...
 * - Linked List: n\n values...\n pos
 * 
 * SECURITY:
 * - Generated inputs/outputs are never exposed to the frontend
 * - Only pass/fail status is returned
 */

import { SeededRandom } from "./testCaseGenerator.js";
import {
  arrayToCPFormat,
  kArraysToCPFormat,
  linkedListToCPFormat,
  matrix2DToCPFormat,
  validateCPFormat,
} from "../../utils/cpInputFormat.js";

/**
 * Analyze existing test cases to understand the input structure
 * @param {Array} testCases - Existing test cases from DB
 * @returns {Object} Analysis of input structure
 */
function analyzeTestCaseStructure(testCases) {
  if (!testCases || testCases.length === 0) {
    return { type: "unknown", structure: null };
  }

  const analysis = {
    type: "unknown",
    structure: {},
    inputFields: [],
    valueRanges: {},
    arrayLengths: {},
    stringLengths: {},
    patterns: [],
  };

  // Try to parse each test case's stdin to understand structure
  for (const tc of testCases) {
    try {
      const stdin = tc.stdin || "";
      const lines = stdin.split("\n").filter(l => l.trim());
      
      // Try to detect input pattern
      const pattern = detectInputPattern(lines);
      analysis.patterns.push(pattern);
      
      // Analyze value ranges
      analyzeValues(lines, analysis);
    } catch (e) {
      // Continue with other test cases
    }
  }

  // Determine the most common pattern
  analysis.type = getMostCommonPattern(analysis.patterns);
  
  return analysis;
}

/**
 * Detect the input pattern from stdin lines
 */
function detectInputPattern(lines) {
  if (lines.length === 0) return "empty";
  
  const firstLine = lines[0].trim();
  
  // Check if first line is a single integer (likely array size or n)
  if (/^-?\d+$/.test(firstLine)) {
    if (lines.length === 1) return "single_int";
    if (lines.length === 2) {
      // Second line could be array or another value
      const secondLine = lines[1].trim();
      // DEPRECATED: JSON format - convert to k_arrays_cp for backward compatibility
      if (secondLine.startsWith("[") || secondLine.startsWith("{")) return "k_arrays_cp";
      if (secondLine.includes(" ")) return "n_then_array";
      if (/^-?\d+$/.test(secondLine)) return "two_ints";
      return "n_then_value";
    }
    // Check for k-arrays CP format: k, then alternating lengths and arrays
    if (lines.length >= 3) {
      const k = parseInt(firstLine);
      // Check if it follows the pattern: k, len1, arr1, len2, arr2...
      if (lines.length === 2 * k + 1) {
        let isKArrays = true;
        for (let i = 1; i < lines.length && isKArrays; i += 2) {
          // Every odd index (1, 3, 5...) should be a single number (length)
          if (!/^\d+$/.test(lines[i].trim())) {
            isKArrays = false;
          }
        }
        if (isKArrays) return "k_arrays_cp";
      }
      return "n_then_multiline";
    }
  }
  
  // Check if first line contains spaces (array on first line)
  if (firstLine.includes(" ")) {
    const parts = firstLine.split(/\s+/);
    if (parts.every(p => /^-?\d+$/.test(p))) {
      // First line is a space-separated array
      if (lines.length === 1) return "array_first_line";
      if (lines.length === 2) {
        const secondLine = lines[1].trim();
        // Array followed by single int (common for linked list + position, or target)
        if (/^-?\d+$/.test(secondLine)) return "array_then_int";
        // Two arrays
        if (secondLine.includes(" ")) return "two_arrays";
      }
      // Check for linked list CP format: n on first line, values, then pos
      if (lines.length === 3 && parts.length === 2) {
        const [n, _] = parts.map(Number);
        if (lines[2].trim().match(/^-?\d+$/)) {
          return "linked_list_cp";
        }
      }
      return "array_first_line";
    }
    return "space_separated_values";
  }
  
  // FORBIDDEN: JSON format - log warning and convert to CP equivalent
  if (firstLine.startsWith("{") || firstLine.startsWith("[")) {
    console.warn("[DynamicTestGen] ⚠️ JSON format detected - will convert to CP format");
    // Attempt to infer structure and treat as CP equivalent
    try {
      const parsed = JSON.parse(firstLine);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && Array.isArray(parsed[0])) {
          return "k_arrays_cp"; // 2D array -> k arrays
        }
        return "n_then_array"; // 1D array
      }
    } catch (e) {
      // Ignore parse errors
    }
    return "n_then_array"; // Default fallback
  }
  
  // Check for tree/graph structure
  if (lines.some(l => l.includes("null") || l.includes("None"))) {
    return "tree_cp";
  }
  
  return "multiline";
}

/**
 * Analyze value ranges from test case inputs
 */
function analyzeValues(lines, analysis) {
  const allNumbers = [];
  const allArrayLengths = [];
  const allStrings = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Extract numbers
    const numbers = trimmed.match(/-?\d+/g);
    if (numbers) {
      allNumbers.push(...numbers.map(Number));
    }
    
    // Track array lengths
    const spaceParts = trimmed.split(/\s+/);
    if (spaceParts.length > 1 && spaceParts.every(p => /^-?\d+$/.test(p))) {
      allArrayLengths.push(spaceParts.length);
    }
    
    // Track strings
    if (!/^\d/.test(trimmed) && !trimmed.includes(" ")) {
      allStrings.push(trimmed);
    }
  }
  
  if (allNumbers.length > 0) {
    analysis.valueRanges = {
      min: Math.min(...allNumbers),
      max: Math.max(...allNumbers),
      hasNegatives: allNumbers.some(n => n < 0),
    };
  }
  
  if (allArrayLengths.length > 0) {
    analysis.arrayLengths = {
      min: Math.min(...allArrayLengths),
      max: Math.max(...allArrayLengths),
      avg: Math.round(allArrayLengths.reduce((a, b) => a + b, 0) / allArrayLengths.length),
    };
  }
  
  if (allStrings.length > 0) {
    analysis.stringLengths = {
      min: Math.min(...allStrings.map(s => s.length)),
      max: Math.max(...allStrings.map(s => s.length)),
    };
  }
}

/**
 * Get the most common pattern from analyzed patterns
 */
function getMostCommonPattern(patterns) {
  if (patterns.length === 0) return "unknown";
  
  const counts = {};
  for (const p of patterns) {
    counts[p] = (counts[p] || 0) + 1;
  }
  
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Infer JSON structure from existing test cases
 * @param {Array} testCases - Existing test cases
 * @returns {string} JSON structure type: "2d_array", "1d_array", "object", etc.
 */
function inferJsonStructure(testCases) {
  if (!testCases || testCases.length === 0) return "1d_array";
  
  for (const tc of testCases) {
    const stdin = tc.stdin || "";
    const lines = stdin.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && Array.isArray(parsed[0])) {
              return "2d_array";
            }
            return "1d_array";
          }
        } catch (e) {
          // Continue checking
        }
      }
      if (trimmed.startsWith("{")) {
        return "object";
      }
    }
  }
  
  return "1d_array";
}

/**
 * Parse constraints from problem description
 * @param {string} description - Problem description
 * @param {string} constraints - Constraints string
 * @returns {Object} Parsed constraints
 */
function parseConstraints(description, constraints) {
  const parsed = {
    n: { min: 1, max: 1000 },
    values: { min: -10000, max: 10000 },
    strings: { minLen: 1, maxLen: 100 },
    k: null,
    target: null,
  };
  
  const text = `${description || ""} ${constraints || ""}`;
  
  // Parse array/string length constraints - improved patterns
  const lengthPatterns = [
    // "1 <= n <= 10^5" or "1 ≤ n ≤ 10^5"
    /1\s*[<≤]=?\s*(?:n|length|size|nums\.length|arr\.length|s\.length)\s*[<≤]=?\s*10\^(\d+)/gi,
    /1\s*[<≤]=?\s*(?:n|length|size)\s*[<≤]=?\s*(\d+)/gi,
    // "n <= 10^5" or "length <= 1000"
    /(?:n|length|size|nums\.length|arr\.length)\s*[<≤]=?\s*10\^(\d+)/gi,
    /(?:n|length|size|nums\.length|arr\.length)\s*[<≤]=?\s*(\d+)/gi,
  ];
  
  for (const pattern of lengthPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        const matchStr = match[0];
        let val;
        if (matchStr.includes("^")) {
          val = Math.pow(10, parseInt(match[1]));
        } else {
          val = parseInt(match[1]);
        }
        // Cap at 10000 for performance
        parsed.n.max = Math.min(val, 10000);
        break;
      }
    }
  }
  
  // Parse value constraints
  const valuePatterns = [
    // "-10^9 <= nums[i] <= 10^9"
    /-?10\^(\d+)\s*[<≤]=?\s*(?:nums\[i\]|arr\[i\]|val|value|element)/gi,
    /(?:nums\[i\]|arr\[i\]|val|value|element)\s*[<≤]=?\s*-?10\^(\d+)/gi,
    // "-1000 <= nums[i] <= 1000"
    /-?(\d+)\s*[<≤]=?\s*(?:nums\[i\]|arr\[i\])/gi,
  ];
  
  for (const pattern of valuePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        const exp = parseInt(match[1]);
        if (exp <= 9) {
          const val = Math.pow(10, exp);
          parsed.values.max = val;
          parsed.values.min = -val;
        }
      }
    }
  }
  
  // Check for non-negative constraint
  if (/non-negative|>= 0|≥ 0/i.test(text)) {
    parsed.values.min = 0;
  }
  
  // Check for positive only
  if (/positive integer|> 0|>= 1/i.test(text)) {
    parsed.values.min = 1;
  }
  
  return parsed;
}

/**
 * Generate test inputs based on analysis
 * @param {Object} analysis - Structure analysis from existing tests
 * @param {Object} constraints - Parsed constraints
 * @param {string} seed - Seed for deterministic generation
 * @param {number} count - Number of test cases to generate
 * @param {Array} existingTestCases - Original test cases to use for pattern mimicking
 * @returns {Array} Generated test inputs
 */
function generateTestInputs(analysis, constraints, seed, count = 10, existingTestCases = []) {
  const rng = new SeededRandom(seed);
  const inputs = [];
  
  const type = analysis.type;
  const valueRange = analysis.valueRanges || constraints.values;
  const arrayLengthRange = analysis.arrayLengths || { min: 1, max: Math.min(constraints.n.max, 100) };
  
  // Generate edge cases first (2-3)
  inputs.push(...generateEdgeCases(type, valueRange, arrayLengthRange, rng, existingTestCases));
  
  // Generate random cases
  const randomCount = Math.max(0, count - inputs.length);
  for (let i = 0; i < randomCount; i++) {
    const input = generateSingleInput(type, valueRange, arrayLengthRange, rng, i < 2 ? "small" : i < 5 ? "medium" : "large", existingTestCases);
    if (input) inputs.push(input);
  }
  
  return inputs;
}

/**
 * Generate edge case inputs
 */
function generateEdgeCases(type, valueRange, arrayRange, rng, existingTestCases = []) {
  const cases = [];
  const min = valueRange.min ?? -1000;
  const max = valueRange.max ?? 1000;
  
  switch (type) {
    case "n_then_array":
    case "array_first_line":
      // Single element
      cases.push(formatArrayInput(type, [rng.randInt(min, max)]));
      // Two elements
      cases.push(formatArrayInput(type, [rng.randInt(min, max), rng.randInt(min, max)]));
      // All same elements
      const val = rng.randInt(min, max);
      cases.push(formatArrayInput(type, Array(5).fill(val)));
      break;
      
    case "single_int":
      cases.push({ stdin: "0", category: "edge", label: "Zero" });
      cases.push({ stdin: "1", category: "edge", label: "One" });
      cases.push({ stdin: String(Math.min(max, 100)), category: "edge", label: "Upper bound" });
      break;
      
    case "two_ints":
      cases.push({ stdin: "0\n0", category: "edge", label: "Both zero" });
      cases.push({ stdin: "1\n1", category: "edge", label: "Both one" });
      break;
      
    case "n_then_multiline":
      cases.push({ stdin: "1\n" + rng.randInt(min, max), category: "edge", label: "Single line" });
      break;
    
    case "n_then_value":
      cases.push({ stdin: "1\n" + rng.randInt(min, max), category: "edge", label: "n=1" });
      cases.push({ stdin: "5\n" + rng.randInt(min, max), category: "edge", label: "n=5" });
      break;
    
    case "array_then_int":
      // Single element array with position -1 (no cycle)
      cases.push({ stdin: `${rng.randInt(min, max)}\n-1`, category: "edge", label: "Single element, no cycle" });
      // Single element with position 0 (self-cycle)
      cases.push({ stdin: `${rng.randInt(min, max)}\n0`, category: "edge", label: "Self cycle" });
      // Two elements with cycle to head
      cases.push({ stdin: `${rng.randInt(min, max)} ${rng.randInt(min, max)}\n0`, category: "edge", label: "Two elements, cycle to head" });
      break;
    
    case "two_arrays":
      // Single element arrays
      cases.push({ stdin: `${rng.randInt(min, max)}\n${rng.randInt(min, max)}`, category: "edge", label: "Single elements" });
      break;
    
    case "k_arrays_cp": {
      // k=1 with single element array (CP format)
      const singleVal = rng.randInt(min, max);
      cases.push({ 
        stdin: `1\n1\n${singleVal}`, 
        category: "edge", 
        label: "k=1, single element" 
      });
      // k=2 with single-element arrays (CP format)
      const val1 = rng.randInt(min, max);
      const val2 = rng.randInt(min, max);
      cases.push({ 
        stdin: `2\n1\n${val1}\n1\n${val2}`, 
        category: "edge", 
        label: "k=2, single elements" 
      });
      // k=1 with two elements
      const twoVals = [rng.randInt(min, max), rng.randInt(min, max)].sort((a, b) => a - b);
      cases.push({ 
        stdin: `1\n2\n${twoVals.join(" ")}`, 
        category: "edge", 
        label: "k=1, two elements" 
      });
      break;
    }
    
    case "linked_list_cp": {
      // Single node, no cycle
      cases.push({ 
        stdin: `1\n${rng.randInt(min, max)}\n-1`, 
        category: "edge", 
        label: "Single node, no cycle" 
      });
      // Single node with self-cycle
      cases.push({ 
        stdin: `1\n${rng.randInt(min, max)}\n0`, 
        category: "edge", 
        label: "Self cycle" 
      });
      // Two nodes with cycle to head
      cases.push({ 
        stdin: `2\n${rng.randInt(min, max)} ${rng.randInt(min, max)}\n0`, 
        category: "edge", 
        label: "Two nodes, cycle to head" 
      });
      break;
    }
      
    case "multiline":
    case "space_separated_values":
    case "tree":
    case "unknown":
    default:
      // For unknown patterns, generate edge cases from existing test cases
      if (existingTestCases && existingTestCases.length > 0) {
        const edgeCase = generateFromExistingPattern(existingTestCases, rng, "edge");
        if (edgeCase) {
          edgeCase.category = "edge";
          edgeCase.label = "Variant edge";
          cases.push(edgeCase);
        }
      }
      break;
  }
  
  return cases.slice(0, 3);
}

/**
 * Generate a single test input
 */
function generateSingleInput(type, valueRange, arrayRange, rng, size, existingTestCases = []) {
  const min = valueRange.min ?? -1000;
  const max = valueRange.max ?? 1000;
  
  const sizes = { small: 5, medium: 20, large: 100 };
  const len = Math.min(sizes[size] || 20, arrayRange.max || 100);
  
  switch (type) {
    case "n_then_array": {
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }
      return formatArrayInput(type, arr);
    }
    
    case "array_first_line": {
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }
      return formatArrayInput(type, arr);
    }
    
    case "single_int":
      return {
        stdin: String(rng.randInt(Math.max(min, 0), Math.min(max, 1000))),
        category: "random",
        label: `Random ${size}`,
      };
    
    case "two_ints":
      return {
        stdin: `${rng.randInt(min, max)}\n${rng.randInt(min, max)}`,
        category: "random",
        label: `Random ${size}`,
      };
    
    case "n_then_value": {
      // Pattern: first line is n, second line is a single value
      const n = rng.randInt(1, Math.min(len, 50));
      const val = rng.randInt(min, max);
      return {
        stdin: `${n}\n${val}`,
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    case "n_then_multiline": {
      const lines = [String(len)];
      for (let i = 0; i < len; i++) {
        lines.push(String(rng.randInt(min, max)));
      }
      return {
        stdin: lines.join("\n"),
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    // DEPRECATED: JSON format - now generates CP format instead
    case "json": {
      // Generate CP-style array instead of JSON
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }
      return {
        stdin: `${arr.length}\n${arr.join(" ")}`,
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    // CP format for k sorted arrays
    case "k_arrays_cp": {
      // Generate k sorted arrays in CP format:
      // k
      // len1
      // arr1 elements
      // len2
      // arr2 elements
      // ...
      const numArrays = rng.randInt(2, Math.min(5, Math.max(2, len)));
      const lines = [String(numArrays)];
      
      for (let i = 0; i < numArrays; i++) {
        const innerLen = rng.randInt(1, Math.min(10, len));
        const inner = [];
        for (let j = 0; j < innerLen; j++) {
          inner.push(rng.randInt(min, max));
        }
        // Sort inner arrays for problems like kth largest
        inner.sort((a, b) => a - b);
        lines.push(String(innerLen));
        lines.push(inner.join(" "));
      }
      
      return {
        stdin: lines.join("\n"),
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    // CP format for linked list with cycle detection
    case "linked_list_cp": {
      // Format: n\nvalues...\npos
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }
      // Cycle position: -1 (no cycle), or valid index
      const pos = rng.randBool(0.3) ? -1 : rng.randInt(0, len - 1);
      return {
        stdin: `${len}\n${arr.join(" ")}\n${pos}`,
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    case "array_then_int": {
      // Pattern: first line is array, second line is single int (e.g., linked list + position)
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }
      // The second int is often an index, so make it valid for the array or -1
      const secondInt = rng.randBool(0.3) ? -1 : rng.randInt(0, len - 1);
      return {
        stdin: `${arr.join(" ")}\n${secondInt}`,
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    case "two_arrays": {
      // Pattern: two space-separated arrays
      const arr1 = [];
      const arr2 = [];
      for (let i = 0; i < len; i++) {
        arr1.push(rng.randInt(min, max));
        arr2.push(rng.randInt(min, max));
      }
      return {
        stdin: `${arr1.join(" ")}\n${arr2.join(" ")}`,
        category: "random",
        label: `Random ${size}`,
      };
    }
    
    case "multiline":
    case "space_separated_values":
    default:
      // Fallback: Try to mimic existing test case structure with modified values
      return generateFromExistingPattern(existingTestCases, rng, size);
  }
}

/**
 * Generate test input by modifying existing test case patterns
 * Converts any JSON patterns to CP format
 */
function generateFromExistingPattern(existingTestCases, rng, size) {
  if (!existingTestCases || existingTestCases.length === 0) {
    return null;
  }
  
  // Pick a random existing test case as a template
  const template = existingTestCases[rng.randInt(0, existingTestCases.length - 1)];
  const stdin = template.stdin || "";
  const lines = stdin.split("\n");
  
  if (lines.length === 0) return null;
  
  // Modify numeric values in the template, converting JSON to CP format
  const modifiedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // If line is a single number, modify it
    if (/^-?\d+$/.test(trimmed)) {
      const original = parseInt(trimmed);
      const delta = rng.randInt(-10, 10);
      modifiedLines.push(String(original + delta));
      continue;
    }
    
    // If line is space-separated numbers, modify some
    if (/^-?\d+(\s+-?\d+)*$/.test(trimmed)) {
      const nums = trimmed.split(/\s+/).map(Number);
      const modified = nums.map(n => {
        if (rng.randBool(0.3)) { // 30% chance to modify each number
          return n + rng.randInt(-5, 5);
        }
        return n;
      });
      modifiedLines.push(modified.join(" "));
      continue;
    }
    
    // CRITICAL: Convert JSON array to CP format
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          // Check if 2D array
          if (parsed.length > 0 && Array.isArray(parsed[0])) {
            // 2D array: convert to k-arrays CP format
            modifiedLines.push(String(parsed.length));
            for (const inner of parsed) {
              const modified = inner.map(item => {
                if (typeof item === "number" && rng.randBool(0.3)) {
                  return item + rng.randInt(-5, 5);
                }
                return item;
              });
              modifiedLines.push(String(modified.length));
              modifiedLines.push(modified.join(" "));
            }
          } else {
            // 1D array: convert to n + elements format
            const modified = parsed.map(item => {
              if (typeof item === "number" && rng.randBool(0.3)) {
                return item + rng.randInt(-5, 5);
              }
              return item;
            });
            modifiedLines.push(String(modified.length));
            modifiedLines.push(modified.join(" "));
          }
          continue;
        }
      } catch (e) {
        // Keep original if parse fails
      }
    }
    
    // Default: keep the line as-is (already CP format or string)
    modifiedLines.push(trimmed);
  }
  
  return {
    stdin: modifiedLines.join("\n"),
    category: "random",
    label: `Variant ${size}`,
  };
}

/**
 * Format array input based on type - STRICT CP FORMAT ONLY
 */
function formatArrayInput(type, arr) {
  if (type === "n_then_array") {
    // CP format: n on first line, space-separated elements on second
    return {
      stdin: `${arr.length}\n${arr.join(" ")}`,
      category: "generated",
      label: `Array (n=${arr.length})`,
    };
  }
  
  if (type === "array_first_line") {
    // CP format: just space-separated elements (n is implicit)
    return {
      stdin: arr.join(" "),
      category: "generated",
      label: `Array (n=${arr.length})`,
    };
  }
  
  // Default: CP format with length prefix
  // NEVER return JSON format
  return {
    stdin: `${arr.length}\n${arr.join(" ")}`,
    category: "generated",
    label: `Array (n=${arr.length})`,
  };
}

/**
 * Main function: Generate dynamic test cases for a submission
 * 
 * @param {Object} question - Question document from DB
 * @param {Array} existingTestCases - Test cases from DB
 * @param {string} seed - Unique seed for deterministic generation (e.g., `${userId}-${questionId}-${timestamp}`)
 * @param {Object} options - Generation options
 * @returns {Array} Generated test case inputs (without expected outputs)
 */
export function generateDynamicTestInputs(question, existingTestCases, seed, options = {}) {
  const {
    edgeCount = 3,
    randomCount = 5,
    stressCount = 2,
  } = options;
  
  const totalCount = edgeCount + randomCount + stressCount;
  
  console.log(`\n[DynamicTestGen] ═══════════════════════════════════════════════════`);
  console.log(`[DynamicTestGen] Generating tests for: "${question.title}"`);
  console.log(`[DynamicTestGen] Seed: ${seed}`);
  console.log(`[DynamicTestGen] Existing test cases: ${existingTestCases?.length || 0}`);
  
  // Step 1: Analyze existing test cases
  const analysis = analyzeTestCaseStructure(existingTestCases);
  console.log(`[DynamicTestGen] Detected pattern: ${analysis.type}`);
  console.log(`[DynamicTestGen] Value ranges:`, JSON.stringify(analysis.valueRanges));
  
  // Step 2: Parse constraints from problem
  const constraints = parseConstraints(question.description, question.constraints);
  console.log(`[DynamicTestGen] Parsed constraints:`, JSON.stringify(constraints));
  
  // Step 3: Generate test inputs (pass existing test cases for pattern mimicking fallback)
  const generatedInputs = generateTestInputs(analysis, constraints, seed, totalCount, existingTestCases);
  console.log(`[DynamicTestGen] Generated ${generatedInputs.length} test inputs`);
  console.log(`[DynamicTestGen] ═══════════════════════════════════════════════════\n`);
  
  return generatedInputs.filter(Boolean);
}

/**
 * Compute expected outputs by running the user's code against generated inputs
 * ONLY call this if the user's code has passed all visible test cases
 * 
 * @param {Array} generatedInputs - Generated test inputs
 * @param {Function} executeCode - Function to execute code (async)
 * @param {string} code - User's code
 * @param {string} language - Programming language
 * @returns {Array} Test cases with expected outputs
 */
export async function computeExpectedOutputs(generatedInputs, executeCode, code, language) {
  const testCasesWithOutputs = [];
  
  for (const input of generatedInputs) {
    try {
      const result = await executeCode(code, language, input.stdin, 3000);
      
      if (!result.compileError && !result.timedOut && result.exitCode === 0) {
        testCasesWithOutputs.push({
          stdin: input.stdin,
          expectedStdout: result.stdout.trim(),
          category: input.category,
          label: input.label,
          isHidden: true,
          generatedFromUserCode: true,
        });
      }
    } catch (error) {
      console.error(`[DynamicTestGen] Failed to compute output: ${error.message}`);
    }
  }
  
  return testCasesWithOutputs;
}

/**
 * Full dynamic test generation pipeline
 * Used when user's code passes visible tests - we generate hidden tests
 * and use their passing solution to compute expected outputs
 */
export async function generateAndValidateHiddenTests(
  question,
  existingTestCases,
  code,
  language,
  executeCode,
  seed,
  options = {}
) {
  // Generate test inputs based on problem structure
  const generatedInputs = generateDynamicTestInputs(question, existingTestCases, seed, options);
  
  if (generatedInputs.length === 0) {
    console.log(`[DynamicTestGen] No test inputs generated - using DB tests only`);
    return [];
  }
  
  // Compute expected outputs using user's solution
  console.log(`[DynamicTestGen] Computing expected outputs using user's solution...`);
  const hiddenTests = await computeExpectedOutputs(generatedInputs, executeCode, code, language);
  
  console.log(`[DynamicTestGen] Generated ${hiddenTests.length} complete hidden test cases`);
  
  return hiddenTests;
}

export {
  analyzeTestCaseStructure,
  parseConstraints,
  generateTestInputs,
};
