/**
 * Infer user-facing Input/Output format text from stored stdin/expectedStdout.
 *
 * IMPORTANT:
 * - Must not reveal actual test values.
 * - Can reveal structure (line counts, JSON vs primitive, etc.).
 * - Works with this codebase's convention: each test case stores raw stdin as text.
 */

function normalizeNewlines(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function splitNonTrailingEmptyLines(text) {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split("\n");

  // Remove trailing empty/whitespace-only lines (common when users print extra newlines)
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  // Remove leading empty/whitespace-only lines as well
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  return lines;
}

function safeJsonType(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return null;

  const startsJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  if (!startsJson) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return "json_array";
    if (parsed && typeof parsed === "object") return "json_object";
    return "json";
  } catch {
    return null;
  }
}

function inferLineType(line) {
  const trimmed = String(line ?? "").trim();
  if (trimmed === "") return "empty";

  const jsonType = safeJsonType(trimmed);
  if (jsonType) return jsonType;

  const lower = trimmed.toLowerCase();
  if (lower === "true" || lower === "false") return "boolean";

  // Integer (no decimals)
  if (/^[+-]?\d+$/.test(trimmed)) return "integer";

  // Float / scientific
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    return "number";
  }

  return "string";
}

function typeToPhrase(type) {
  switch (type) {
    case "json_array":
      return "a JSON array (single line)";
    case "json_object":
      return "a JSON object (single line)";
    case "integer":
      return "an integer";
    case "number":
      return "a number";
    case "boolean":
      return "a boolean";
    case "string":
      return "a string";
    case "empty":
      return "an empty line";
    default:
      return "a value";
  }
}

function mergeTypes(types) {
  const filtered = Array.from(new Set(types.filter(Boolean)));
  if (filtered.length === 0) return "value";
  if (filtered.length === 1) return filtered[0];

  // Prefer more specific JSON types if present
  if (filtered.includes("json_object") || filtered.includes("json_array")) {
    const jsonTypes = filtered.filter((t) => t.startsWith("json"));
    if (jsonTypes.length === 1) return jsonTypes[0];
    if (jsonTypes.length > 1) return "json";
  }

  // Integer is a subset of number; if both exist, treat as number
  if (filtered.includes("integer") && filtered.includes("number")) {
    return "number";
  }

  // Otherwise mixed
  return "mixed";
}

function buildInputFormatFromLinesPerCase(linesPerCase) {
  const counts = linesPerCase.map((lines) => lines.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  if (!isFinite(min) || !isFinite(max) || max === 0) {
    return "The input is empty.";
  }

  const intro =
    min === max
      ? `The input consists of ${min} line${min === 1 ? "" : "s"}.`
      : `The input consists of between ${min} and ${max} non-empty lines.`;

  const describeUpTo = min; // only lines guaranteed to exist
  const lineDescriptors = [];

  for (let i = 0; i < describeUpTo; i++) {
    const typesAtI = linesPerCase.map((lines) => (lines[i] !== undefined ? inferLineType(lines[i]) : null));
    const merged = mergeTypes(typesAtI);

    if (merged === "mixed") {
      lineDescriptors.push(`Line ${i + 1}: a value (type may vary by test case).`);
    } else if (merged === "json") {
      lineDescriptors.push(`Line ${i + 1}: a JSON value (single line).`);
    } else {
      lineDescriptors.push(`Line ${i + 1}: ${typeToPhrase(merged)}.`);
    }
  }

  // If line count varies, indicate remaining lines are additional parameters.
  const tail =
    min !== max
      ? "Additional lines (if present) are additional input parameters, each provided on its own line."
      : null;

  return [
    intro,
    "Each line represents one input parameter in the order specified by the problem statement.",
    ...lineDescriptors,
    tail,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildOutputFormatFromExpected(expectedPerCase) {
  const linesPerCase = expectedPerCase.map((out) => splitNonTrailingEmptyLines(out));
  const counts = linesPerCase.map((lines) => lines.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  if (!isFinite(min) || !isFinite(max) || max === 0) {
    return "Print nothing.";
  }

  if (min === 1 && max === 1) {
    const types = expectedPerCase.map((out) => inferLineType(splitNonTrailingEmptyLines(out)[0] ?? ""));
    const merged = mergeTypes(types);

    if (merged === "mixed") {
      return "Print one line containing the required output.";
    }

    if (merged === "json") {
      return "Print one line containing a JSON value.";
    }

    return `Print one line containing ${typeToPhrase(merged)}.`;
  }

  const intro =
    min === max
      ? `Print ${min} line${min === 1 ? "" : "s"}.`
      : `Print between ${min} and ${max} non-empty lines.`;

  // Describe guaranteed lines based on min
  const describeUpTo = min;
  const lineDescriptors = [];
  for (let i = 0; i < describeUpTo; i++) {
    const typesAtI = expectedPerCase.map((out) => {
      const lines = splitNonTrailingEmptyLines(out);
      return lines[i] !== undefined ? inferLineType(lines[i]) : null;
    });
    const merged = mergeTypes(typesAtI);

    if (merged === "mixed") {
      lineDescriptors.push(`Line ${i + 1}: the required output (type may vary by test case).`);
    } else if (merged === "json") {
      lineDescriptors.push(`Line ${i + 1}: a JSON value.`);
    } else {
      lineDescriptors.push(`Line ${i + 1}: ${typeToPhrase(merged)}.`);
    }
  }

  const tail =
    min !== max
      ? "Additional lines (if present) are part of the required output." 
      : null;

  return [intro, ...lineDescriptors, tail].filter(Boolean).join("\n");
}

export function inferIOFormatsFromTestCases(testCases) {
  const safeCases = Array.isArray(testCases) ? testCases : [];

  const linesPerCase = safeCases.map((tc) => splitNonTrailingEmptyLines(tc?.stdin));
  const expectedPerCase = safeCases.map((tc) => normalizeNewlines(tc?.expectedStdout).trimEnd());

  // If no test cases, fall back to generic format.
  if (safeCases.length === 0) {
    return {
      inputFormat:
        "The input consists of one or more lines. Each line represents one input parameter.",
      outputFormat: "Print the required result to standard output.",
    };
  }

  return {
    inputFormat: buildInputFormatFromLinesPerCase(linesPerCase),
    outputFormat: buildOutputFormatFromExpected(expectedPerCase),
  };
}
