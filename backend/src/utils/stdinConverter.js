

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

function arrayToStdin(arr) {
  const lines = [];

  lines.push(String(arr.length));

  if (arr.length > 0 && Array.isArray(arr[0])) {
    
    for (const subArr of arr) {
      if (Array.isArray(subArr)) {
        lines.push(subArr.map(v => valueToStdin(v)).join(" "));
      } else {
        lines.push(valueToStdin(subArr));
      }
    }
  } else {
    
    if (arr.length > 0) {
      lines.push(arr.map(v => valueToStdin(v)).join(" "));
    }
  }
  
  return lines.join("\n");
}

function objectToStdin(obj) {
  const lines = [];
  
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    lines.push(valueToStdin(value));
  }
  
  return lines.join("\n");
}

export function jsonToStdin(input) {
  if (input === null || input === undefined) {
    return "";
  }
  
  const result = valueToStdin(input);
  return result.trim();
}

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
    
    if (expectedOutput.length > 0 && Array.isArray(expectedOutput[0])) {
      return expectedOutput
        .map(row => row.map(v => valueToStdin(v)).join(" "))
        .join("\n");
    }
    
    return expectedOutput.map(v => valueToStdin(v)).join(" ");
  }

  if (typeof expectedOutput === "object") {
    
    return JSON.stringify(expectedOutput);
  }

  return String(expectedOutput).trim();
}

export function compareOutputs(actual, expected) {
  
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
