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
      return "an invalid JSON array (CP format required; no brackets/commas)";
    case "json_object":
      return "an invalid JSON object (CP format required; no brackets/commas)";
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

function splitTokens(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/g);
}

function isIntegerToken(token) {
  return typeof token === "string" && /^[+-]?\d+$/.test(token);
}

function isAllIntegerTokens(tokens) {
  return Array.isArray(tokens) && tokens.length > 0 && tokens.every(isIntegerToken);
}

function tryBuildCodeforcesLikeInputFormat(linesPerCase) {
  // Goal: generate a Codeforces-like template with variable names.
  // Must not reveal actual values.
  const cases = Array.isArray(linesPerCase) ? linesPerCase : [];
  if (cases.length === 0) return null;

  const lineCounts = cases.map((lines) => lines.length);
  const minLines = Math.min(...lineCounts);
  const maxLines = Math.max(...lineCounts);

  // We only attempt structured inference when line counts are consistent.
  if (!isFinite(minLines) || !isFinite(maxLines) || minLines !== maxLines || minLines === 0) {
    return null;
  }

  const lineCount = minLines;
  const tokensPerCase = cases.map((lines) => lines.map(splitTokens));

  // 1) Single integer
  if (lineCount === 1) {
    const allOneInt = tokensPerCase.every((toks) => toks[0]?.length === 1 && isIntegerToken(toks[0][0]));
    if (allOneInt) {
      return "The first line contains an integer `n`.";
    }
  }

  // 2) n then array of n integers
  if (lineCount === 2) {
    const allFirstLineOneInt = tokensPerCase.every((toks) => toks[0]?.length === 1 && isIntegerToken(toks[0][0]));
    const allSecondLineInts = tokensPerCase.every((toks) => isAllIntegerTokens(toks[1]));

    if (allFirstLineOneInt && allSecondLineInts) {
      // Check whether the first integer equals the count of integers on line 2 for most cases.
      let matches = 0;
      for (let i = 0; i < tokensPerCase.length; i++) {
        const n = Number(tokensPerCase[i][0][0]);
        const k = tokensPerCase[i][1].length;
        if (Number.isFinite(n) && n === k) matches++;
      }
      const ratio = matches / tokensPerCase.length;

      if (ratio >= 0.8) {
        return [
          "The first line contains an integer `n` — the number of elements in the array.",
          "The second line contains `n` integers `a1, a2, ..., an`.",
        ].join("\n");
      }

      return [
        "The first line contains an integer `n`.",
        "The second line contains a sequence of integers (space-separated).",
      ].join("\n");
    }
  }

  // 3) r c then r rows of c integers (matrix)
  if (lineCount >= 2) {
    const firstLineAllTwoInts = tokensPerCase.every(
      (toks) => toks[0]?.length === 2 && toks[0].every(isIntegerToken),
    );

    if (firstLineAllTwoInts) {
      // Try matrix: lineCount should be r + 1 and each of the next r lines has c integers.
      let matrixMatches = 0;
      for (let i = 0; i < tokensPerCase.length; i++) {
        const r = Number(tokensPerCase[i][0][0]);
        const c = Number(tokensPerCase[i][0][1]);
        if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
        if (r + 1 !== lineCount) continue;

        let ok = true;
        for (let row = 1; row <= r; row++) {
          const rowTokens = tokensPerCase[i][row];
          if (!isAllIntegerTokens(rowTokens) || rowTokens.length !== c) {
            ok = false;
            break;
          }
        }

        if (ok) matrixMatches++;
      }

      if (matrixMatches / tokensPerCase.length >= 0.8) {
        return [
          "The first line contains two integers `r` and `c` — the number of rows and columns.",
          "The next `r` lines each contain `c` integers — the matrix elements.",
        ].join("\n");
      }

      // Try graph: lineCount should be m + 1 and each of the next m lines has 2 or 3 integers.
      let graphMatches = 0;
      let weightedMatches = 0;
      for (let i = 0; i < tokensPerCase.length; i++) {
        const n = Number(tokensPerCase[i][0][0]);
        const m = Number(tokensPerCase[i][0][1]);
        if (!Number.isFinite(n) || !Number.isFinite(m)) continue;
        if (m + 1 !== lineCount) continue;

        let ok = true;
        let weighted = true;
        for (let e = 1; e <= m; e++) {
          const edgeTokens = tokensPerCase[i][e];
          if (!isAllIntegerTokens(edgeTokens) || (edgeTokens.length !== 2 && edgeTokens.length !== 3)) {
            ok = false;
            break;
          }
          if (edgeTokens.length !== 3) weighted = false;
        }

        if (ok) {
          graphMatches++;
          if (weighted) weightedMatches++;
        }
      }

      if (graphMatches / tokensPerCase.length >= 0.8) {
        const isWeighted = weightedMatches / tokensPerCase.length >= 0.8;
        return isWeighted
          ? [
              "The first line contains two integers `n` and `m` — the number of nodes and edges.",
              "The next `m` lines each contain three integers `u`, `v`, and `w` — an edge between `u` and `v` with weight `w`.",
            ].join("\n")
          : [
              "The first line contains two integers `n` and `m` — the number of nodes and edges.",
              "The next `m` lines each contain two integers `u` and `v` — an edge between `u` and `v`.",
            ].join("\n");
      }
    }
  }

  return null;
}

function tryBuildCodeforcesLikeOutputFormat(expectedPerCase) {
  const outs = Array.isArray(expectedPerCase) ? expectedPerCase : [];
  if (outs.length === 0) return null;

  const linesPerCase = outs.map((out) => splitNonTrailingEmptyLines(out));
  const counts = linesPerCase.map((lines) => lines.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  if (!isFinite(min) || !isFinite(max) || max === 0) {
    return "Print nothing.";
  }

  // Only apply the variable naming when it is exactly one output line.
  if (min === 1 && max === 1) {
    const types = outs.map((out) => inferLineType(splitNonTrailingEmptyLines(out)[0] ?? ""));
    const merged = mergeTypes(types);

    if (merged === "integer") {
      return "Print one integer `ans` — the answer.";
    }
    if (merged === "number") {
      return "Print one number `ans` — the answer.";
    }
    if (merged === "string") {
      return "Print one string `ans` — the answer.";
    }
    if (merged === "boolean") {
      return "Print `YES`/`NO` (or `true`/`false`) as required by the problem.";
    }
  }

  return null;
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
    const varName = `x${i + 1}`;

    if (merged === "mixed") {
      lineDescriptors.push(
        `Line ${i + 1}: a value \`${varName}\` (type may vary by test case).`,
      );
    } else if (merged === "json") {
      lineDescriptors.push(
        `Line ${i + 1}: an invalid JSON value (CP format required; no brackets/commas) \`${varName}\`.`,
      );
    } else {
      lineDescriptors.push(`Line ${i + 1}: ${typeToPhrase(merged)} \`${varName}\`.`);
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
      return "Print one line containing the required output `ans`.";
    }

    if (merged === "json") {
      return "Print one line containing the required output `ans` in CP format (no JSON/brackets).";
    }

    return `Print one line containing ${typeToPhrase(merged)} \`ans\`.`;
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
    const varName = `y${i + 1}`;

    if (merged === "mixed") {
      lineDescriptors.push(
        `Line ${i + 1}: the required output \`${varName}\` (type may vary by test case).`,
      );
    } else if (merged === "json") {
      lineDescriptors.push(
        `Line ${i + 1}: the required output \`${varName}\` in CP format (no JSON/brackets).`,
      );
    } else {
      lineDescriptors.push(`Line ${i + 1}: ${typeToPhrase(merged)} \`${varName}\`.`);
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

  const codeforcesInput = tryBuildCodeforcesLikeInputFormat(linesPerCase);
  const codeforcesOutput = tryBuildCodeforcesLikeOutputFormat(expectedPerCase);

  return {
    inputFormat: codeforcesInput || buildInputFormatFromLinesPerCase(linesPerCase),
    outputFormat: codeforcesOutput || buildOutputFormatFromExpected(expectedPerCase),
  };
}
