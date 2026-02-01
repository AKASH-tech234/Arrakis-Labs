import { SeededRandom } from "./testCaseGenerator.js";
import {
  arrayToCPFormat,
  kArraysToCPFormat,
  linkedListToCPFormat,
  matrix2DToCPFormat,
  validateCPFormat,
} from "../../utils/cpInputFormat.js";

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

  for (const tc of testCases) {
    try {
      const stdin = tc.stdin || "";
      const lines = stdin.split("\n").filter(l => l.trim());

      const pattern = detectInputPattern(lines);
      analysis.patterns.push(pattern);

      analyzeValues(lines, analysis);
    } catch (e) {

    }
  }

  analysis.type = getMostCommonPattern(analysis.patterns);

  return analysis;
}

function detectInputPattern(lines) {
  if (lines.length === 0) return "empty";

  const firstLine = lines[0].trim();

  if (/^-?\d+$/.test(firstLine)) {
    if (lines.length === 1) return "single_int";
    if (lines.length === 2) {

      const secondLine = lines[1].trim();

      if (secondLine.startsWith("[") || secondLine.startsWith("{")) return "k_arrays_cp";
      if (secondLine.includes(" ")) return "n_then_array";
      if (/^-?\d+$/.test(secondLine)) return "two_ints";
      return "n_then_value";
    }

    if (lines.length >= 3) {
      const k = parseInt(firstLine);

      if (lines.length === 2 * k + 1) {
        let isKArrays = true;
        for (let i = 1; i < lines.length && isKArrays; i += 2) {

          if (!/^\d+$/.test(lines[i].trim())) {
            isKArrays = false;
          }
        }
        if (isKArrays) return "k_arrays_cp";
      }
      return "n_then_multiline";
    }
  }

  if (firstLine.includes(" ")) {
    const parts = firstLine.split(/\s+/);
    if (parts.every(p => /^-?\d+$/.test(p))) {

      if (lines.length === 1) return "array_first_line";
      if (lines.length === 2) {
        const secondLine = lines[1].trim();

        if (/^-?\d+$/.test(secondLine)) return "array_then_int";

        if (secondLine.includes(" ")) return "two_arrays";
      }

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

  if (firstLine.startsWith("{") || firstLine.startsWith("[")) {
    console.warn("[DynamicTestGen] ⚠️ JSON format detected - will convert to CP format");

    try {
      const parsed = JSON.parse(firstLine);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && Array.isArray(parsed[0])) {
          return "k_arrays_cp";
        }
        return "n_then_array";
      }
    } catch (e) {

    }
    return "n_then_array";
  }

  if (lines.some(l => l.includes("null") || l.includes("None"))) {
    return "tree_cp";
  }

  return "multiline";
}

function analyzeValues(lines, analysis) {
  const allNumbers = [];
  const allArrayLengths = [];
  const allStrings = [];

  for (const line of lines) {
    const trimmed = line.trim();

    const numbers = trimmed.match(/-?\d+/g);
    if (numbers) {
      allNumbers.push(...numbers.map(Number));
    }

    const spaceParts = trimmed.split(/\s+/);
    if (spaceParts.length > 1 && spaceParts.every(p => /^-?\d+$/.test(p))) {
      allArrayLengths.push(spaceParts.length);
    }

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

function getMostCommonPattern(patterns) {
  if (patterns.length === 0) return "unknown";

  const counts = {};
  for (const p of patterns) {
    counts[p] = (counts[p] || 0) + 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

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

        }
      }
      if (trimmed.startsWith("{")) {
        return "object";
      }
    }
  }

  return "1d_array";
}

function parseConstraints(description, constraints) {
  const parsed = {
    n: { min: 1, max: 1000 },
    values: { min: -10000, max: 10000 },
    strings: { minLen: 1, maxLen: 100 },
    k: null,
    target: null,
  };

  const text = `${description || ""} ${constraints || ""}`;

  const lengthPatterns = [

    /1\s*[<≤]=?\s*(?:n|length|size|nums\.length|arr\.length|s\.length)\s*[<≤]=?\s*10\^(\d+)/gi,
    /1\s*[<≤]=?\s*(?:n|length|size)\s*[<≤]=?\s*(\d+)/gi,

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

        parsed.n.max = Math.min(val, 10000);
        break;
      }
    }
  }

  const valuePatterns = [

    /-?10\^(\d+)\s*[<≤]=?\s*(?:nums\[i\]|arr\[i\]|val|value|element)/gi,
    /(?:nums\[i\]|arr\[i\]|val|value|element)\s*[<≤]=?\s*-?10\^(\d+)/gi,

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

  if (/non-negative|>= 0|≥ 0/i.test(text)) {
    parsed.values.min = 0;
  }

  if (/positive integer|> 0|>= 1/i.test(text)) {
    parsed.values.min = 1;
  }

  return parsed;
}

function generateTestInputs(analysis, constraints, seed, count = 10, existingTestCases = []) {
  const rng = new SeededRandom(seed);
  const inputs = [];

  const type = analysis.type;
  const valueRange = analysis.valueRanges || constraints.values;
  const arrayLengthRange = analysis.arrayLengths || { min: 1, max: Math.min(constraints.n.max, 100) };

  inputs.push(...generateEdgeCases(type, valueRange, arrayLengthRange, rng, existingTestCases));

  const randomCount = Math.max(0, count - inputs.length);
  for (let i = 0; i < randomCount; i++) {
    const input = generateSingleInput(type, valueRange, arrayLengthRange, rng, i < 2 ? "small" : i < 5 ? "medium" : "large", existingTestCases);
    if (input) inputs.push(input);
  }

  return inputs;
}

function generateEdgeCases(type, valueRange, arrayRange, rng, existingTestCases = []) {
  const cases = [];
  const min = valueRange.min ?? -1000;
  const max = valueRange.max ?? 1000;

  switch (type) {
    case "n_then_array":
    case "array_first_line":

      cases.push(formatArrayInput(type, [rng.randInt(min, max)]));

      cases.push(formatArrayInput(type, [rng.randInt(min, max), rng.randInt(min, max)]));

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

      cases.push({ stdin: `${rng.randInt(min, max)}\n-1`, category: "edge", label: "Single element, no cycle" });

      cases.push({ stdin: `${rng.randInt(min, max)}\n0`, category: "edge", label: "Self cycle" });

      cases.push({ stdin: `${rng.randInt(min, max)} ${rng.randInt(min, max)}\n0`, category: "edge", label: "Two elements, cycle to head" });
      break;

    case "two_arrays":

      cases.push({ stdin: `${rng.randInt(min, max)}\n${rng.randInt(min, max)}`, category: "edge", label: "Single elements" });
      break;

    case "k_arrays_cp": {

      const singleVal = rng.randInt(min, max);
      cases.push({
        stdin: `1\n1\n${singleVal}`,
        category: "edge",
        label: "k=1, single element"
      });

      const val1 = rng.randInt(min, max);
      const val2 = rng.randInt(min, max);
      cases.push({
        stdin: `2\n1\n${val1}\n1\n${val2}`,
        category: "edge",
        label: "k=2, single elements"
      });

      const twoVals = [rng.randInt(min, max), rng.randInt(min, max)].sort((a, b) => a - b);
      cases.push({
        stdin: `1\n2\n${twoVals.join(" ")}`,
        category: "edge",
        label: "k=1, two elements"
      });
      break;
    }

    case "linked_list_cp": {

      cases.push({
        stdin: `1\n${rng.randInt(min, max)}\n-1`,
        category: "edge",
        label: "Single node, no cycle"
      });

      cases.push({
        stdin: `1\n${rng.randInt(min, max)}\n0`,
        category: "edge",
        label: "Self cycle"
      });

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

    case "json": {

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

    case "k_arrays_cp": {

      const numArrays = rng.randInt(2, Math.min(5, Math.max(2, len)));
      const lines = [String(numArrays)];

      for (let i = 0; i < numArrays; i++) {
        const innerLen = rng.randInt(1, Math.min(10, len));
        const inner = [];
        for (let j = 0; j < innerLen; j++) {
          inner.push(rng.randInt(min, max));
        }

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

    case "linked_list_cp": {

      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }

      const pos = rng.randBool(0.3) ? -1 : rng.randInt(0, len - 1);
      return {
        stdin: `${len}\n${arr.join(" ")}\n${pos}`,
        category: "random",
        label: `Random ${size}`,
      };
    }

    case "array_then_int": {

      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(rng.randInt(min, max));
      }

      const secondInt = rng.randBool(0.3) ? -1 : rng.randInt(0, len - 1);
      return {
        stdin: `${arr.join(" ")}\n${secondInt}`,
        category: "random",
        label: `Random ${size}`,
      };
    }

    case "two_arrays": {

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

      return generateFromExistingPattern(existingTestCases, rng, size);
  }
}

function generateFromExistingPattern(existingTestCases, rng, size) {
  if (!existingTestCases || existingTestCases.length === 0) {
    return null;
  }

  const template = existingTestCases[rng.randInt(0, existingTestCases.length - 1)];
  const stdin = template.stdin || "";
  const lines = stdin.split("\n");

  if (lines.length === 0) return null;

  const modifiedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^-?\d+$/.test(trimmed)) {
      const original = parseInt(trimmed);
      const delta = rng.randInt(-10, 10);
      modifiedLines.push(String(original + delta));
      continue;
    }

    if (/^-?\d+(\s+-?\d+)*$/.test(trimmed)) {
      const nums = trimmed.split(/\s+/).map(Number);
      const modified = nums.map(n => {
        if (rng.randBool(0.3)) {
          return n + rng.randInt(-5, 5);
        }
        return n;
      });
      modifiedLines.push(modified.join(" "));
      continue;
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {

          if (parsed.length > 0 && Array.isArray(parsed[0])) {

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

      }
    }

    modifiedLines.push(trimmed);
  }

  return {
    stdin: modifiedLines.join("\n"),
    category: "random",
    label: `Variant ${size}`,
  };
}

function formatArrayInput(type, arr) {
  if (type === "n_then_array") {

    return {
      stdin: `${arr.length}\n${arr.join(" ")}`,
      category: "generated",
      label: `Array (n=${arr.length})`,
    };
  }

  if (type === "array_first_line") {

    return {
      stdin: arr.join(" "),
      category: "generated",
      label: `Array (n=${arr.length})`,
    };
  }

  return {
    stdin: `${arr.length}\n${arr.join(" ")}`,
    category: "generated",
    label: `Array (n=${arr.length})`,
  };
}

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

  const analysis = analyzeTestCaseStructure(existingTestCases);
  console.log(`[DynamicTestGen] Detected pattern: ${analysis.type}`);
  console.log(`[DynamicTestGen] Value ranges:`, JSON.stringify(analysis.valueRanges));

  const constraints = parseConstraints(question.description, question.constraints);
  console.log(`[DynamicTestGen] Parsed constraints:`, JSON.stringify(constraints));

  const generatedInputs = generateTestInputs(analysis, constraints, seed, totalCount, existingTestCases);
  console.log(`[DynamicTestGen] Generated ${generatedInputs.length} test inputs`);
  console.log(`[DynamicTestGen] ═══════════════════════════════════════════════════\n`);

  return generatedInputs.filter(Boolean);
}

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

export async function generateAndValidateHiddenTests(
  question,
  existingTestCases,
  code,
  language,
  executeCode,
  seed,
  options = {}
) {

  const generatedInputs = generateDynamicTestInputs(question, existingTestCases, seed, options);

  if (generatedInputs.length === 0) {
    console.log(`[DynamicTestGen] No test inputs generated - using DB tests only`);
    return [];
  }

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
