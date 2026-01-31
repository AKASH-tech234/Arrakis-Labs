/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COMPETITIVE PROGRAMMING (CP) INPUT FORMAT SPECIFICATION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * CRITICAL: This module enforces strict CP-style input format for ALL test cases.
 * 
 * 🚨 MANDATORY INPUT RULES (NO EXCEPTIONS)
 * 
 * 1. ALL inputs MUST be in CP-style format only
 * 2. JSON-style parsing is STRICTLY FORBIDDEN in solutions
 * 3. NO brackets [ ], { }, commas, or quoted strings in stdin
 * 4. Only numeric, space-separated input is allowed
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * INPUT FORMAT SPECIFICATIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * SINGLE VALUE:
 *   n
 * 
 * 1D ARRAY:
 *   n
 *   a1 a2 a3 ... an
 * 
 * 2D ARRAY / MATRIX:
 *   r c
 *   row1_elements (space-separated)
 *   row2_elements
 *   ...
 * 
 * ALTERNATIVE 2D (variable row lengths):
 *   r
 *   c1
 *   row1_elements
 *   c2
 *   row2_elements
 *   ...
 * 
 * K SORTED ARRAYS:
 *   k
 *   len1
 *   arr1_elements
 *   len2
 *   arr2_elements
 *   ...
 * 
 * TWO ARRAYS:
 *   n m
 *   arr1_elements (n elements)
 *   arr2_elements (m elements)
 * 
 * LINKED LIST:
 *   n
 *   node_values (space-separated)
 *   pos (for cycle position, -1 if no cycle)
 * 
 * GRAPH (Edge List):
 *   n e
 *   u1 v1 [w1]
 *   u2 v2 [w2]
 *   ...
 * 
 * TREE (Parent Array):
 *   n
 *   parent_of_node_1 parent_of_node_2 ... (root has -1)
 *   OR
 *   n
 *   u1 v1
 *   u2 v2
 *   ...
 * 
 * STRING INPUT:
 *   len
 *   string_content
 *   OR just:
 *   string_content
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * FORBIDDEN FORMATS (NEVER GENERATE OR SUPPORT)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ❌ JSON arrays:           [1, 2, 3, 4]
 * ❌ JSON 2D arrays:        [[1,2],[3,4]]
 * ❌ JSON objects:          {"nums": [1,2,3], "target": 5}
 * ❌ LeetCode-style:        nums = [1,2,3]
 * ❌ Brackets in any form:  [1 2 3] or (1, 2, 3)
 * ❌ Comma-separated:       1,2,3,4
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Convert a 1D array to CP-style input format
 * @param {number[]} arr - The array to convert
 * @returns {string} CP-formatted stdin string
 * 
 * Output format:
 *   n
 *   a1 a2 a3 ... an
 */
export function arrayToCPFormat(arr) {
  if (!arr || arr.length === 0) {
    return "0\n";
  }
  return `${arr.length}\n${arr.join(" ")}`;
}

/**
 * Convert a 2D array/matrix to CP-style input format
 * @param {number[][]} matrix - The 2D array to convert
 * @param {boolean} [variableRowLengths=false] - If true, outputs row length before each row
 * @returns {string} CP-formatted stdin string
 * 
 * Standard format (uniform row lengths):
 *   r c
 *   row1_elements
 *   row2_elements
 *   ...
 * 
 * Variable row lengths format:
 *   r
 *   c1
 *   row1_elements
 *   c2
 *   row2_elements
 *   ...
 */
export function matrix2DToCPFormat(matrix, variableRowLengths = false) {
  if (!matrix || matrix.length === 0) {
    return "0\n";
  }
  
  if (variableRowLengths) {
    const lines = [String(matrix.length)];
    for (const row of matrix) {
      lines.push(String(row.length));
      lines.push(row.join(" "));
    }
    return lines.join("\n");
  }
  
  // Standard format: assume uniform row lengths
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const lines = [`${rows} ${cols}`];
  for (const row of matrix) {
    lines.push(row.join(" "));
  }
  return lines.join("\n");
}

/**
 * Convert k sorted arrays to CP-style input format
 * @param {number[][]} arrays - Array of sorted arrays
 * @returns {string} CP-formatted stdin string
 * 
 * Output format:
 *   k
 *   len1
 *   arr1_elements
 *   len2
 *   arr2_elements
 *   ...
 */
export function kArraysToCPFormat(arrays) {
  if (!arrays || arrays.length === 0) {
    return "0\n";
  }
  
  const lines = [String(arrays.length)];
  for (const arr of arrays) {
    lines.push(String(arr.length));
    lines.push(arr.join(" "));
  }
  return lines.join("\n");
}

/**
 * Convert linked list data to CP-style input format
 * @param {number[]} values - Node values
 * @param {number} [cyclePos=-1] - Position where tail connects (-1 for no cycle)
 * @returns {string} CP-formatted stdin string
 * 
 * Output format:
 *   n
 *   val1 val2 val3 ... valn
 *   pos
 */
export function linkedListToCPFormat(values, cyclePos = -1) {
  if (!values || values.length === 0) {
    return "0\n\n-1";
  }
  return `${values.length}\n${values.join(" ")}\n${cyclePos}`;
}

/**
 * Convert graph edge list to CP-style input format
 * @param {number} nodes - Number of nodes
 * @param {Array<[number, number, number?]>} edges - Edges as [u, v, weight?]
 * @param {boolean} [weighted=false] - Whether edges have weights
 * @returns {string} CP-formatted stdin string
 * 
 * Output format:
 *   n e
 *   u1 v1 [w1]
 *   u2 v2 [w2]
 *   ...
 */
export function graphToCPFormat(nodes, edges, weighted = false) {
  const lines = [`${nodes} ${edges.length}`];
  for (const edge of edges) {
    if (weighted && edge.length >= 3) {
      lines.push(`${edge[0]} ${edge[1]} ${edge[2]}`);
    } else {
      lines.push(`${edge[0]} ${edge[1]}`);
    }
  }
  return lines.join("\n");
}

/**
 * Convert tree structure to CP-style input format (edge list)
 * @param {number} nodes - Number of nodes
 * @param {Array<[number, number]>} edges - Tree edges as [parent, child]
 * @returns {string} CP-formatted stdin string
 * 
 * Output format:
 *   n
 *   u1 v1
 *   u2 v2
 *   ...
 */
export function treeToCPFormat(nodes, edges) {
  const lines = [String(nodes)];
  for (const [u, v] of edges) {
    lines.push(`${u} ${v}`);
  }
  return lines.join("\n");
}

/**
 * Convert two arrays (common for problems like target sum) to CP-style format
 * @param {number[]} arr1 - First array
 * @param {number[]} arr2OrValue - Second array OR a single target value
 * @returns {string} CP-formatted stdin string
 * 
 * Output format (two arrays):
 *   n m
 *   arr1_elements
 *   arr2_elements
 * 
 * Output format (array + target):
 *   n
 *   arr_elements
 *   target
 */
export function twoArraysToCPFormat(arr1, arr2OrValue) {
  if (Array.isArray(arr2OrValue)) {
    const lines = [`${arr1.length} ${arr2OrValue.length}`];
    lines.push(arr1.join(" "));
    lines.push(arr2OrValue.join(" "));
    return lines.join("\n");
  }
  
  // Single value (target) case
  const lines = [String(arr1.length)];
  lines.push(arr1.join(" "));
  lines.push(String(arr2OrValue));
  return lines.join("\n");
}

/**
 * Convert array with single integer parameter to CP-style format
 * Common for: find kth element, rotate by k, etc.
 * @param {number[]} arr - The array
 * @param {number} k - The integer parameter
 * @returns {string} CP-formatted stdin string
 * 
 * Output format:
 *   n k
 *   arr_elements
 */
export function arrayWithParamToCPFormat(arr, k) {
  const lines = [`${arr.length} ${k}`];
  lines.push(arr.join(" "));
  return lines.join("\n");
}

/**
 * Convert string input to CP-style format
 * @param {string} str - The string
 * @param {boolean} [includeLength=false] - Whether to include length on first line
 * @returns {string} CP-formatted stdin string
 */
export function stringToCPFormat(str, includeLength = false) {
  if (includeLength) {
    return `${str.length}\n${str}`;
  }
  return str;
}

/**
 * Convert multiple values (primitives) to CP-style format
 * @param  {...(number|string)} values - Values to output
 * @returns {string} CP-formatted stdin string (one value per line)
 */
export function valuesToCPFormat(...values) {
  return values.map(String).join("\n");
}

/**
 * Validate that a string is in valid CP format (no JSON)
 * @param {string} stdin - The stdin string to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateCPFormat(stdin) {
  if (!stdin || typeof stdin !== "string") {
    return { valid: false, error: "stdin must be a non-empty string" };
  }
  
  const lines = stdin.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check for forbidden JSON characters
    if (line.includes("[") || line.includes("]")) {
      return { 
        valid: false, 
        error: `Line ${i + 1}: Contains brackets [ or ] - JSON format is forbidden` 
      };
    }
    
    if (line.includes("{") || line.includes("}")) {
      return { 
        valid: false, 
        error: `Line ${i + 1}: Contains braces { or } - JSON format is forbidden` 
      };
    }
    
    if (line.includes('"') || line.includes("'")) {
      return { 
        valid: false, 
        error: `Line ${i + 1}: Contains quotes - string quoting is forbidden` 
      };
    }
    
    // Check for comma-separated values (but allow in strings)
    if (/\d,\d/.test(line)) {
      return { 
        valid: false, 
        error: `Line ${i + 1}: Contains comma-separated numbers - use spaces instead` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Convert potentially JSON-formatted input to CP format
 * Used for migrating old test cases
 * @param {string} stdin - The stdin string (may be JSON)
 * @returns {string} CP-formatted stdin string
 */
export function convertToCPFormat(stdin) {
  if (!stdin || typeof stdin !== "string") {
    return "";
  }
  
  const lines = stdin.split("\n").map(l => l.trim()).filter(Boolean);
  const result = [];
  
  for (const line of lines) {
    // Check if line is JSON
    if ((line.startsWith("[") && line.endsWith("]")) || 
        (line.startsWith("{") && line.endsWith("}"))) {
      try {
        const parsed = JSON.parse(line);
        
        if (Array.isArray(parsed)) {
          // Check if it's a 2D array
          if (parsed.length > 0 && Array.isArray(parsed[0])) {
            // 2D array: convert to k-arrays format
            result.push(String(parsed.length));
            for (const inner of parsed) {
              result.push(String(inner.length));
              result.push(inner.join(" "));
            }
          } else {
            // 1D array
            result.push(String(parsed.length));
            result.push(parsed.join(" "));
          }
        } else if (typeof parsed === "object" && parsed !== null) {
          // Object: convert each field
          for (const [key, value] of Object.entries(parsed)) {
            if (Array.isArray(value)) {
              result.push(String(value.length));
              result.push(value.join(" "));
            } else {
              result.push(String(value));
            }
          }
        }
        continue;
      } catch (e) {
        // Not valid JSON, keep as-is
      }
    }
    
    // Already CP format or plain value
    result.push(line);
  }
  
  return result.join("\n");
}

/**
 * Parse CP-formatted input to extract arrays
 * @param {string} stdin - CP-formatted stdin
 * @returns {Object} Parsed input object
 */
export function parseCPInput(stdin) {
  const lines = stdin.split("\n").map(l => l.trim()).filter(Boolean);
  
  if (lines.length === 0) {
    return { type: "empty", values: [] };
  }
  
  const firstLine = lines[0];
  const firstLineParts = firstLine.split(/\s+/).map(Number);
  
  // Single integer
  if (lines.length === 1 && firstLineParts.length === 1) {
    return { type: "single_int", value: firstLineParts[0] };
  }
  
  // Two integers on first line (n and k, or n and m)
  if (lines.length >= 1 && firstLineParts.length === 2) {
    const [n, m] = firstLineParts;
    
    if (lines.length === 2) {
      // n k followed by array
      const arr = lines[1].split(/\s+/).map(Number);
      return { type: "array_with_param", n, k: m, array: arr };
    }
    
    if (lines.length === n + 1) {
      // Matrix: n x m
      const matrix = [];
      for (let i = 1; i <= n; i++) {
        matrix.push(lines[i].split(/\s+/).map(Number));
      }
      return { type: "matrix", rows: n, cols: m, matrix };
    }
  }
  
  // Single n followed by array
  if (lines.length === 2 && firstLineParts.length === 1) {
    const n = firstLineParts[0];
    const arr = lines[1].split(/\s+/).map(Number);
    return { type: "array", n, array: arr };
  }
  
  // n followed by array followed by another value (linked list with pos, array with target)
  if (lines.length === 3 && firstLineParts.length === 1) {
    const n = firstLineParts[0];
    const arr = lines[1].split(/\s+/).map(Number);
    const lastValue = parseInt(lines[2]);
    return { type: "array_with_extra", n, array: arr, extra: lastValue };
  }
  
  // k-arrays format
  if (firstLineParts.length === 1 && lines.length > 2) {
    const k = firstLineParts[0];
    const arrays = [];
    let idx = 1;
    
    while (idx < lines.length && arrays.length < k) {
      const len = parseInt(lines[idx]);
      idx++;
      if (idx < lines.length) {
        const arr = lines[idx].split(/\s+/).map(Number);
        arrays.push(arr);
        idx++;
      }
    }
    
    if (arrays.length === k) {
      return { type: "k_arrays", k, arrays };
    }
  }
  
  // Fallback: return all lines as-is
  return { type: "unknown", lines };
}

export default {
  arrayToCPFormat,
  matrix2DToCPFormat,
  kArraysToCPFormat,
  linkedListToCPFormat,
  graphToCPFormat,
  treeToCPFormat,
  twoArraysToCPFormat,
  arrayWithParamToCPFormat,
  stringToCPFormat,
  valuesToCPFormat,
  validateCPFormat,
  convertToCPFormat,
  parseCPInput,
};
