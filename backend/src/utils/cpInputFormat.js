export function arrayToCPFormat(arr) {
  if (!arr || arr.length === 0) {
    return "0\n";
  }
  return `${arr.length}\n${arr.join(" ")}`;
}

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

  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const lines = [`${rows} ${cols}`];
  for (const row of matrix) {
    lines.push(row.join(" "));
  }
  return lines.join("\n");
}

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

export function linkedListToCPFormat(values, cyclePos = -1) {
  if (!values || values.length === 0) {
    return "0\n\n-1";
  }
  return `${values.length}\n${values.join(" ")}\n${cyclePos}`;
}

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

export function treeToCPFormat(nodes, edges) {
  const lines = [String(nodes)];
  for (const [u, v] of edges) {
    lines.push(`${u} ${v}`);
  }
  return lines.join("\n");
}

export function twoArraysToCPFormat(arr1, arr2OrValue) {
  if (Array.isArray(arr2OrValue)) {
    const lines = [`${arr1.length} ${arr2OrValue.length}`];
    lines.push(arr1.join(" "));
    lines.push(arr2OrValue.join(" "));
    return lines.join("\n");
  }

  const lines = [String(arr1.length)];
  lines.push(arr1.join(" "));
  lines.push(String(arr2OrValue));
  return lines.join("\n");
}

export function arrayWithParamToCPFormat(arr, k) {
  const lines = [`${arr.length} ${k}`];
  lines.push(arr.join(" "));
  return lines.join("\n");
}

export function stringToCPFormat(str, includeLength = false) {
  if (includeLength) {
    return `${str.length}\n${str}`;
  }
  return str;
}

export function valuesToCPFormat(...values) {
  return values.map(String).join("\n");
}

export function validateCPFormat(stdin) {
  if (!stdin || typeof stdin !== "string") {
    return { valid: false, error: "stdin must be a non-empty string" };
  }

  const lines = stdin.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

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

    if (/\d,\d/.test(line)) {
      return {
        valid: false,
        error: `Line ${i + 1}: Contains comma-separated numbers - use spaces instead`
      };
    }
  }

  return { valid: true };
}

export function convertToCPFormat(stdin) {
  if (!stdin || typeof stdin !== "string") {
    return "";
  }

  const lines = stdin.split("\n").map(l => l.trim()).filter(Boolean);
  const result = [];

  for (const line of lines) {

    if ((line.startsWith("[") && line.endsWith("]")) ||
        (line.startsWith("{") && line.endsWith("}"))) {
      try {
        const parsed = JSON.parse(line);

        if (Array.isArray(parsed)) {

          if (parsed.length > 0 && Array.isArray(parsed[0])) {

            result.push(String(parsed.length));
            for (const inner of parsed) {
              result.push(String(inner.length));
              result.push(inner.join(" "));
            }
          } else {

            result.push(String(parsed.length));
            result.push(parsed.join(" "));
          }
        } else if (typeof parsed === "object" && parsed !== null) {

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

      }
    }

    result.push(line);
  }

  return result.join("\n");
}

export function parseCPInput(stdin) {
  const lines = stdin.split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { type: "empty", values: [] };
  }

  const firstLine = lines[0];
  const firstLineParts = firstLine.split(/\s+/).map(Number);

  if (lines.length === 1 && firstLineParts.length === 1) {
    return { type: "single_int", value: firstLineParts[0] };
  }

  if (lines.length >= 1 && firstLineParts.length === 2) {
    const [n, m] = firstLineParts;

    if (lines.length === 2) {

      const arr = lines[1].split(/\s+/).map(Number);
      return { type: "array_with_param", n, k: m, array: arr };
    }

    if (lines.length === n + 1) {

      const matrix = [];
      for (let i = 1; i <= n; i++) {
        matrix.push(lines[i].split(/\s+/).map(Number));
      }
      return { type: "matrix", rows: n, cols: m, matrix };
    }
  }

  if (lines.length === 2 && firstLineParts.length === 1) {
    const n = firstLineParts[0];
    const arr = lines[1].split(/\s+/).map(Number);
    return { type: "array", n, array: arr };
  }

  if (lines.length === 3 && firstLineParts.length === 1) {
    const n = firstLineParts[0];
    const arr = lines[1].split(/\s+/).map(Number);
    const lastValue = parseInt(lines[2]);
    return { type: "array_with_extra", n, array: arr, extra: lastValue };
  }

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
