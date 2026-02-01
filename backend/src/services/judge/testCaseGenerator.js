class SeededRandom {
  constructor(seed) {

    if (typeof seed === "string") {
      seed = this._hashString(seed);
    }
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  _hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  randFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  randBool(probability = 0.5) {
    return this.next() < probability;
  }

  choice(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  randIntArray(length, min, max) {
    return Array.from({ length }, () => this.randInt(min, max));
  }

  randString(length, charset = "abcdefghijklmnopqrstuvwxyz") {
    return Array.from({ length }, () => this.choice(charset)).join("");
  }
}

const TestCategory = {
  EDGE: "edge",
  RANDOM: "random",
  STRESS: "stress",
  ADVERSARIAL: "adversarial",
};

const InputType = {
  SINGLE_INT: "single_int",
  ARRAY_INT: "array_int",
  ARRAY_2D: "array_2d",
  STRING: "string",
  STRING_ARRAY: "string_array",
  GRAPH: "graph",
  TREE: "tree",
  MATRIX: "matrix",
  CUSTOM: "custom",
};

class TestCaseGenerator {
  constructor(problemConfig, seed) {
    this.config = problemConfig;
    this.rng = new SeededRandom(seed);
    this.testCases = [];
  }

  generateAll(options = {}) {
    const {
      edgeCount = 5,
      randomCount = 10,
      stressCount = 3,
      adversarialCount = 2,
    } = options;

    this.testCases = [];

    this._generateEdgeCases(edgeCount);
    this._generateRandomCases(randomCount);
    this._generateStressCases(stressCount);
    this._generateAdversarialCases(adversarialCount);

    return this.testCases;
  }

  _generateEdgeCases(count) {
    const { constraints, edgeCases, inputType } = this.config;

    if (Array.isArray(edgeCases)) {
      for (let i = 0; i < Math.min(edgeCases.length, count); i++) {
        const edge = edgeCases[i];
        const input = typeof edge.generate === "function"
          ? edge.generate(this.rng)
          : edge.input;

        this._addTestCase(input, TestCategory.EDGE, edge.label || `Edge ${i + 1}`);
      }
    }

    if (typeof this.config.customGenerator === "function") {
      return;
    }

    const remaining = count - this.testCases.length;
    if (remaining > 0) {
      const autoEdges = this._autoGenerateEdgeCases(inputType, constraints);
      for (let i = 0; i < Math.min(autoEdges.length, remaining); i++) {
        this._addTestCase(autoEdges[i].input, TestCategory.EDGE, autoEdges[i].label);
      }
    }
  }

  _autoGenerateEdgeCases(inputType, constraints) {
    const edges = [];

    switch (inputType) {
      case InputType.ARRAY_INT:
        const { arrayLength = {}, elementValue = {} } = constraints;
        const minLen = arrayLength.min ?? 1;
        const maxLen = arrayLength.max ?? 100;
        const minVal = elementValue.min ?? -1000;
        const maxVal = elementValue.max ?? 1000;

        if (minLen === 0) {
          edges.push({ label: "Empty array", input: { arr: [] } });
        }
        if (minLen <= 1) {
          edges.push({ label: "Single element min", input: { arr: [minVal] } });
          edges.push({ label: "Single element max", input: { arr: [maxVal] } });
          edges.push({ label: "Single zero", input: { arr: [0] } });
        }

        edges.push({
          label: "All same (min)",
          input: { arr: Array(Math.min(10, maxLen)).fill(minVal) },
        });
        edges.push({
          label: "All same (max)",
          input: { arr: Array(Math.min(10, maxLen)).fill(maxVal) },
        });

        edges.push({
          label: "Sorted ascending",
          input: { arr: Array.from({ length: Math.min(10, maxLen) }, (_, i) => minVal + i) },
        });
        edges.push({
          label: "Sorted descending",
          input: { arr: Array.from({ length: Math.min(10, maxLen) }, (_, i) => maxVal - i) },
        });
        break;

      case InputType.STRING:
        const { stringLength = {} } = constraints;
        const minStrLen = stringLength.min ?? 1;
        const maxStrLen = stringLength.max ?? 100;

        if (minStrLen === 0) {
          edges.push({ label: "Empty string", input: { s: "" } });
        }
        if (minStrLen <= 1) {
          edges.push({ label: "Single char", input: { s: "a" } });
        }
        edges.push({ label: "All same char", input: { s: "a".repeat(Math.min(20, maxStrLen)) } });
        edges.push({ label: "Palindrome", input: { s: "abcba" } });
        break;

      case InputType.SINGLE_INT:
        const { value = {} } = constraints;
        edges.push({ label: "Minimum value", input: { n: value.min ?? 0 } });
        edges.push({ label: "Maximum value", input: { n: value.max ?? 1000 } });
        edges.push({ label: "Zero", input: { n: 0 } });
        if ((value.min ?? 0) < 0) {
          edges.push({ label: "Negative one", input: { n: -1 } });
        }
        break;

      default:

        break;
    }

    return edges;
  }

  _generateRandomCases(count) {
    for (let i = 0; i < count; i++) {
      const input = this._generateRandomInput("medium");
      this._addTestCase(input, TestCategory.RANDOM, `Random ${i + 1}`);
    }
  }

  _generateStressCases(count) {
    for (let i = 0; i < count; i++) {
      const input = this._generateRandomInput("large");
      this._addTestCase(input, TestCategory.STRESS, `Stress ${i + 1}`);
    }
  }

  _generateAdversarialCases(count) {
    const { adversarialCases, inputType, constraints } = this.config;

    if (Array.isArray(adversarialCases)) {
      for (let i = 0; i < Math.min(adversarialCases.length, count); i++) {
        const adv = adversarialCases[i];
        const input = typeof adv.generate === "function"
          ? adv.generate(this.rng)
          : adv.input;

        this._addTestCase(input, TestCategory.ADVERSARIAL, adv.label || `Adversarial ${i + 1}`);
      }
    }

    if (typeof this.config.customGenerator === "function") {
      return;
    }

    const remaining = count - this.testCases.filter(tc => tc.category === TestCategory.ADVERSARIAL).length;
    if (remaining > 0) {
      const autoAdv = this._autoGenerateAdversarialCases(inputType, constraints);
      for (let i = 0; i < Math.min(autoAdv.length, remaining); i++) {
        this._addTestCase(autoAdv[i].input, TestCategory.ADVERSARIAL, autoAdv[i].label);
      }
    }
  }

  _autoGenerateAdversarialCases(inputType, constraints) {
    const cases = [];

    switch (inputType) {
      case InputType.ARRAY_INT:
        const { arrayLength = {}, elementValue = {} } = constraints;
        const maxLen = Math.min(arrayLength.max ?? 1000, 1000);
        const minVal = elementValue.min ?? -1000;
        const maxVal = elementValue.max ?? 1000;

        const alternating = Array.from({ length: maxLen }, (_, i) =>
          i % 2 === 0 ? minVal : maxVal
        );
        cases.push({ label: "Alternating extremes", input: { arr: alternating } });

        const mostlySorted = Array.from({ length: maxLen }, (_, i) => i);
        mostlySorted[Math.floor(maxLen / 2)] = maxVal;
        cases.push({ label: "Mostly sorted with outlier", input: { arr: mostlySorted } });

        const allZerosButOne = Array(maxLen).fill(0);
        allZerosButOne[maxLen - 1] = maxVal;
        cases.push({ label: "All zeros except last", input: { arr: allZerosButOne } });
        break;

      case InputType.STRING:
        const { stringLength = {} } = constraints;
        const maxStrLen = Math.min(stringLength.max ?? 1000, 1000);

        cases.push({
          label: "Alternating chars",
          input: { s: Array.from({ length: maxStrLen }, (_, i) => i % 2 === 0 ? "a" : "b").join("") },
        });

        const nearPalin = "a".repeat(Math.floor(maxStrLen / 2)) + "b" + "a".repeat(Math.floor(maxStrLen / 2));
        cases.push({ label: "Near palindrome", input: { s: nearPalin } });
        break;

      default:
        break;
    }

    return cases;
  }

  _generateRandomInput(sizeCategory = "medium") {
    const { inputType, constraints } = this.config;

    if (typeof this.config.customGenerator === "function") {
      return this.config.customGenerator(this.rng, sizeCategory);
    }

    const sizeMultiplier = {
      small: 0.1,
      medium: 0.5,
      large: 1.0,
    }[sizeCategory] ?? 0.5;

    switch (inputType) {
      case InputType.ARRAY_INT:
        return this._generateArrayInt(constraints, sizeMultiplier);
      case InputType.ARRAY_2D:
        return this._generateArray2D(constraints, sizeMultiplier);
      case InputType.STRING:
        return this._generateString(constraints, sizeMultiplier);
      case InputType.STRING_ARRAY:
        return this._generateStringArray(constraints, sizeMultiplier);
      case InputType.SINGLE_INT:
        return this._generateSingleInt(constraints);
      case InputType.GRAPH:
        return this._generateGraph(constraints, sizeMultiplier);
      case InputType.TREE:
        return this._generateTree(constraints, sizeMultiplier);
      case InputType.MATRIX:
        return this._generateMatrix(constraints, sizeMultiplier);
      case InputType.CUSTOM:

        throw new Error("Custom input type requires customGenerator function (not found)");
      default:
        throw new Error(`Unknown input type: ${inputType}`);
    }
  }

  _generateArrayInt(constraints, sizeMultiplier) {
    const { arrayLength = {}, elementValue = {} } = constraints;
    const minLen = arrayLength.min ?? 1;
    const maxLen = arrayLength.max ?? 100;
    const minVal = elementValue.min ?? -1000;
    const maxVal = elementValue.max ?? 1000;

    const length = this.rng.randInt(
      minLen,
      Math.max(minLen, Math.floor(maxLen * sizeMultiplier))
    );

    return {
      arr: this.rng.randIntArray(length, minVal, maxVal),
    };
  }

  _generateArray2D(constraints, sizeMultiplier) {
    const { rows = {}, cols = {}, elementValue = {} } = constraints;
    const minRows = rows.min ?? 1;
    const maxRows = Math.floor((rows.max ?? 20) * sizeMultiplier);
    const minCols = cols.min ?? 1;
    const maxCols = Math.floor((cols.max ?? 20) * sizeMultiplier);
    const minVal = elementValue.min ?? 0;
    const maxVal = elementValue.max ?? 100;

    const numRows = this.rng.randInt(minRows, Math.max(minRows, maxRows));
    const numCols = this.rng.randInt(minCols, Math.max(minCols, maxCols));

    const arr = [];
    for (let i = 0; i < numRows; i++) {
      arr.push(this.rng.randIntArray(numCols, minVal, maxVal));
    }

    return { matrix: arr };
  }

  _generateString(constraints, sizeMultiplier) {
    const { stringLength = {}, charset = "abcdefghijklmnopqrstuvwxyz" } = constraints;
    const minLen = stringLength.min ?? 1;
    const maxLen = Math.floor((stringLength.max ?? 100) * sizeMultiplier);

    const length = this.rng.randInt(minLen, Math.max(minLen, maxLen));
    return { s: this.rng.randString(length, charset) };
  }

  _generateStringArray(constraints, sizeMultiplier) {
    const { arrayLength = {}, stringLength = {}, charset = "abcdefghijklmnopqrstuvwxyz" } = constraints;
    const minLen = arrayLength.min ?? 1;
    const maxLen = Math.floor((arrayLength.max ?? 20) * sizeMultiplier);
    const minStrLen = stringLength.min ?? 1;
    const maxStrLen = stringLength.max ?? 20;

    const count = this.rng.randInt(minLen, Math.max(minLen, maxLen));
    const strings = [];
    for (let i = 0; i < count; i++) {
      const len = this.rng.randInt(minStrLen, maxStrLen);
      strings.push(this.rng.randString(len, charset));
    }

    return { strs: strings };
  }

  _generateSingleInt(constraints) {
    const { value = {} } = constraints;
    const min = value.min ?? 1;
    const max = value.max ?? 1000;
    return { n: this.rng.randInt(min, max) };
  }

  _generateGraph(constraints, sizeMultiplier) {
    const { nodes = {}, edges = {}, weighted = false } = constraints;
    const minNodes = nodes.min ?? 2;
    const maxNodes = Math.floor((nodes.max ?? 100) * sizeMultiplier);
    const maxEdges = edges.max ?? maxNodes * 2;

    const n = this.rng.randInt(minNodes, Math.max(minNodes, maxNodes));
    const numEdges = this.rng.randInt(n - 1, Math.min(maxEdges, (n * (n - 1)) / 2));

    const edgeList = [];
    const seen = new Set();

    for (let i = 1; i < n; i++) {
      const parent = this.rng.randInt(0, i - 1);
      const weight = weighted ? this.rng.randInt(1, 100) : 1;
      edgeList.push(weighted ? [parent, i, weight] : [parent, i]);
      seen.add(`${Math.min(parent, i)}-${Math.max(parent, i)}`);
    }

    let attempts = 0;
    while (edgeList.length < numEdges && attempts < 1000) {
      const u = this.rng.randInt(0, n - 1);
      const v = this.rng.randInt(0, n - 1);
      if (u !== v) {
        const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const weight = weighted ? this.rng.randInt(1, 100) : 1;
          edgeList.push(weighted ? [u, v, weight] : [u, v]);
        }
      }
      attempts++;
    }

    return { n, edges: edgeList };
  }

  _generateTree(constraints, sizeMultiplier) {
    const { nodes = {} } = constraints;
    const minNodes = nodes.min ?? 2;
    const maxNodes = Math.floor((nodes.max ?? 100) * sizeMultiplier);

    const n = this.rng.randInt(minNodes, Math.max(minNodes, maxNodes));
    const parent = [-1];

    for (let i = 1; i < n; i++) {
      parent.push(this.rng.randInt(0, i - 1));
    }

    return { n, parent };
  }

  _generateMatrix(constraints, sizeMultiplier) {
    return this._generateArray2D(constraints, sizeMultiplier);
  }

  _addTestCase(input, category, label) {
    const { referenceSolution, inputToStdin, outputFromStdout } = this.config;

    const stdin = typeof inputToStdin === "function"
      ? inputToStdin(input)
      : this._defaultInputToStdin(input);

    let expectedOutput = null;
    if (typeof referenceSolution === "function") {
      try {
        const result = referenceSolution(input);
        expectedOutput = typeof outputFromStdout === "function"
          ? outputFromStdout(result)
          : this._defaultOutputToStdout(result);
      } catch (err) {
        console.error(`[TestGen] Reference solution failed for ${label}:`, err.message);

        return;
      }
    }

    this.testCases.push({
      stdin,
      expectedStdout: expectedOutput,
      category,
      label,
      isHidden: true,
      input,
    });
  }

  _defaultInputToStdin(input) {
    if (typeof input === "string") return input;
    if (Array.isArray(input)) return input.map(String).join("\n");

    const lines = [];
    for (const [key, value] of Object.entries(input)) {
      if (Array.isArray(value)) {
        if (Array.isArray(value[0])) {

          lines.push(`${value.length} ${value[0]?.length ?? 0}`);
          for (const row of value) {
            lines.push(row.join(" "));
          }
        } else {

          lines.push(String(value.length));
          lines.push(value.join(" "));
        }
      } else {
        lines.push(String(value));
      }
    }
    return lines.join("\n");
  }

  _defaultOutputToStdout(result) {
    if (result === undefined || result === null) return "";
    if (typeof result === "string") return result;
    if (Array.isArray(result)) {
      if (Array.isArray(result[0])) {

        return result.map(row => row.join(" ")).join("\n");
      }
      return result.join(" ");
    }
    return String(result);
  }
}

class ProblemConfigBuilder {
  constructor(inputType) {
    this.config = {
      inputType,
      constraints: {},
      edgeCases: [],
      adversarialCases: [],
      referenceSolution: null,
      inputToStdin: null,
      outputFromStdout: null,
    };
  }

  setConstraints(constraints) {
    this.config.constraints = { ...this.config.constraints, ...constraints };
    return this;
  }

  addEdgeCase(label, inputOrGenerator) {
    if (typeof inputOrGenerator === "function") {
      this.config.edgeCases.push({ label, generate: inputOrGenerator });
    } else {
      this.config.edgeCases.push({ label, input: inputOrGenerator });
    }
    return this;
  }

  addAdversarialCase(label, inputOrGenerator) {
    if (typeof inputOrGenerator === "function") {
      this.config.adversarialCases.push({ label, generate: inputOrGenerator });
    } else {
      this.config.adversarialCases.push({ label, input: inputOrGenerator });
    }
    return this;
  }

  setReferenceSolution(fn) {
    this.config.referenceSolution = fn;
    return this;
  }

  setInputToStdin(fn) {
    this.config.inputToStdin = fn;
    return this;
  }

  setOutputFromStdout(fn) {
    this.config.outputFromStdout = fn;
    return this;
  }

  setCustomGenerator(fn) {
    this.config.customGenerator = fn;
    return this;
  }

  build() {
    return this.config;
  }
}

export {
  TestCaseGenerator,
  SeededRandom,
  TestCategory,
  InputType,
  ProblemConfigBuilder,
};
