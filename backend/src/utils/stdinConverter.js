import {
  arrayToCPFormat,
  kArraysToCPFormat,
  validateCPFormat,
} from "./cpInputFormat.js";

function valueToStdin(val) {
  if (val === null || val === undefined) {
    return "";
  }

  if (Array.isArray(val)) {

    if (val.length > 0 && Array.isArray(val[0])) {

      const lines = [String(val.length)];
      for (const row of val) {
        lines.push(String(row.length));
        lines.push(row.join(" "));
      }
      return lines.join("\n");
    }

    return `${val.length}\n${val.join(" ")}`;
  }

  if (typeof val === "object") {

    console.warn("[stdinConverter] ⚠️ Object type detected - converting to CP format");

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

export function jsonToStdin(input, inputFormat = null) {
  if (typeof input === "string") {

    const validation = validateCPFormat(input);
    if (!validation.valid) {
      console.warn(`[stdinConverter] ⚠️ Input string contains non-CP format: ${validation.error}`);

      if (input.trim().startsWith("[") || input.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(input.trim());
          return jsonToStdin(parsed);
        } catch (e) {

        }
      }
    }
    return input;
  }

  if (Array.isArray(input)) {

    return valueToStdin(input);
  }

  if (typeof input === "object" && input !== null) {
    const keys = Object.keys(input);
    const lines = [];

    for (const key of keys) {
      const val = input[key];

      if (Array.isArray(val)) {

        if (val.length > 0 && Array.isArray(val[0])) {

          lines.push(String(val.length));
          for (const row of val) {
            lines.push(String(row.length));
            lines.push(row.join(" "));
          }
        } else {

          lines.push(String(val.length));
          lines.push(val.join(" "));
        }
      } else if (typeof val === "object" && val !== null) {

        console.warn(`[stdinConverter] ⚠️ Nested object in input - converting to CP format`);
        const nestedCP = jsonToStdin(val);
        lines.push(nestedCP);
      } else {

        lines.push(String(val));
      }
    }

    return lines.join("\n");
  }

  return String(input || "");
}

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

      return trimmed
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  return trimmed;
}

function normalizeForComparison(str) {
  if (str === null || str === undefined) return "";

  return String(str)

    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    .split("\n")
    .map(line => line.trim())
    .join("\n")

    .trim()

    .replace(/[ \t]+/g, " ")

    .replace(/[\u00A0\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/g, " ");
}

function tryParseNumber(str) {
  const trimmed = String(str).trim();

  if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
    return { isNumber: false, value: NaN };
  }

  const num = Number(trimmed);

  if (!isNaN(num) && isFinite(num)) {
    return { isNumber: true, value: num };
  }

  return { isNumber: false, value: NaN };
}

function tryParseJSON(str) {
  const trimmed = String(str).trim();

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

function deepEqual(a, b) {

  if (a === b) return true;
  if (a == null || b == null) return a == b;

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return a === b;
}

export function compareOutputs(actual, expected, options = {}) {
  const {
    ignoreWhitespace = true,
    ignoreCase = false,
    floatTolerance = 1e-6,
    trimLines = true,
    allowNumericStringMatch = true,
  } = options;

  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) {

    const actualStr = normalizeForComparison(actual);
    const expectedStr = normalizeForComparison(expected);
    return actualStr === "" && expectedStr === "" || actualStr === expectedStr;
  }

  let actualStr = normalizeForComparison(actual);
  let expectedStr = normalizeForComparison(expected);

  if (actualStr === expectedStr) {
    return true;
  }

  if (ignoreCase) {
    if (actualStr.toLowerCase() === expectedStr.toLowerCase()) {
      return true;
    }
  }

  if (allowNumericStringMatch) {
    const actualNum = tryParseNumber(actualStr);
    const expectedNum = tryParseNumber(expectedStr);

    if (actualNum.isNumber && expectedNum.isNumber) {

      if (Number.isInteger(actualNum.value) && Number.isInteger(expectedNum.value)) {
        if (actualNum.value === expectedNum.value) {
          return true;
        }
      }

      if (Math.abs(actualNum.value - expectedNum.value) <= floatTolerance) {
        return true;
      }

      const maxVal = Math.max(Math.abs(actualNum.value), Math.abs(expectedNum.value));
      if (maxVal > 1 && Math.abs(actualNum.value - expectedNum.value) / maxVal <= floatTolerance) {
        return true;
      }
    }
  }

  const actualJSON = tryParseJSON(actualStr);
  const expectedJSON = tryParseJSON(expectedStr);

  if (actualJSON.isJSON && expectedJSON.isJSON) {
    if (deepEqual(actualJSON.value, expectedJSON.value)) {
      return true;
    }
  }

  const actualLines = actualStr.split("\n").filter(line => line.trim() !== "");
  const expectedLines = expectedStr.split("\n").filter(line => line.trim() !== "");

  if (actualLines.length !== expectedLines.length) {
    return false;
  }

  for (let i = 0; i < actualLines.length; i++) {
    const actualLine = actualLines[i].trim();
    const expectedLine = expectedLines[i].trim();

    if (actualLine === expectedLine) {
      continue;
    }

    if (ignoreCase && actualLine.toLowerCase() === expectedLine.toLowerCase()) {
      continue;
    }

    const actualLineNum = tryParseNumber(actualLine);
    const expectedLineNum = tryParseNumber(expectedLine);

    if (actualLineNum.isNumber && expectedLineNum.isNumber) {
      if (Math.abs(actualLineNum.value - expectedLineNum.value) <= floatTolerance) {
        continue;
      }
    }

    const actualLineJSON = tryParseJSON(actualLine);
    const expectedLineJSON = tryParseJSON(expectedLine);

    if (actualLineJSON.isJSON && expectedLineJSON.isJSON) {
      if (deepEqual(actualLineJSON.value, expectedLineJSON.value)) {
        continue;
      }
    }

    return false;
  }

  return true;
}

export function formatInputForDisplay(stdin) {
  if (!stdin) return "";

  const lines = stdin.split("\n").filter(Boolean);
  const formatted = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes(" ") && /^-?\d+(\s+-?\d+)+$/.test(trimmed)) {

      const nums = trimmed.split(/\s+/);
      formatted.push(`[${nums.join(", ")}]`);
    } else {

      formatted.push(trimmed);
    }
  }

  return formatted.join("\n");
}

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
