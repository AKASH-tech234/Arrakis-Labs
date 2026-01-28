/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROBLEM CONFIG REGISTRY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This file provides a centralized registry for problem test case configurations.
 * Each problem defines:
 *   - Input constraints (array lengths, value ranges, etc.)
 *   - Edge cases for thorough testing
 *   - Reference solution for computing expected outputs
 *   - Input/output format converters
 * 
 * SECURITY: Reference solutions are server-side only. They're NEVER sent to clients.
 * 
 * USAGE:
 *   1. Import the registry in your problem setup
 *   2. Register new problems using registerProblem()
 *   3. Problems are automatically available for hidden test generation
 * 
 * @example
 *   import { registerProblem, InputType } from './problemConfigRegistry.js';
 *   
 *   registerProblem("merge-sorted-arrays", {
 *     inputType: InputType.ARRAY_INT,
 *     constraints: { arrayLength: { min: 1, max: 10000 } },
 *     referenceSolution: (input) => { ... },
 *   });
 */

import {
  InputType,
  TestCategory,
  ProblemConfigBuilder,
} from "./testCaseGenerator.js";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Problem Registry - Maps slug → configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * CRITICAL: The slug must match the problem title after normalization.
 * 
 * SLUG NORMALIZATION RULES:
 * 1. Convert to lowercase
 * 2. Remove special characters (keep only a-z, 0-9, spaces, hyphens)
 * 3. Replace spaces with hyphens
 * 4. Collapse multiple hyphens into one
 * 5. Trim leading/trailing hyphens
 * 
 * EXAMPLES:
 * "Two Sum" → "two-sum"
 * "Valid Palindrome" → "valid-palindrome"
 * "Repeated Substring Check" → "repeated-substring-check"
 * "LRU Cache" → "lru-cache"
 */
const problemRegistry = new Map();

/**
 * Normalize a slug to match the format used in Question.effectiveSlug
 * @param {string} slug - Raw slug or problem title
 * @returns {string} Normalized slug
 */
function normalizeSlug(slug) {
  if (!slug) return "";
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // Remove special chars
    .replace(/\s+/g, "-")          // Replace spaces with hyphens
    .replace(/-+/g, "-")           // Collapse multiple hyphens
    .replace(/^-|-$/g, "");        // Trim leading/trailing hyphens
}

/**
 * Register a new problem configuration
 * 
 * @param {string} slug - Problem identifier (e.g., "two-sum", "valid-parentheses")
 * @param {object} config - Problem configuration (from ProblemConfigBuilder.build())
 */
function registerProblem(slug, config) {
  const normalizedSlug = normalizeSlug(slug);
  problemRegistry.set(normalizedSlug, config);
  console.log(`[ProblemRegistry] Registered: ${normalizedSlug}`);
}

/**
 * Get a problem configuration by slug
 * 
 * @param {string} slug - Problem identifier
 * @returns {object|null} Problem configuration or null if not found
 */
function getProblemConfig(slug) {
  const normalizedSlug = normalizeSlug(slug);
  return problemRegistry.get(normalizedSlug) || null;
}

/**
 * Check if a problem is registered
 * 
 * @param {string} slug - Problem identifier
 * @returns {boolean}
 */
function hasProblem(slug) {
  const normalizedSlug = normalizeSlug(slug);
  const found = problemRegistry.has(normalizedSlug);
  return found;
}

/**
 * Get all registered problem slugs
 * 
 * @returns {string[]}
 */
function getAllProblemSlugs() {
  return Array.from(problemRegistry.keys());
}

/**
 * Debug helper: Log all registered slugs
 */
function logAllRegisteredSlugs() {
  console.log(`[ProblemRegistry] ${problemRegistry.size} problems registered:`);
  getAllProblemSlugs().forEach(slug => console.log(`  - ${slug}`));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-REGISTERED COMMON PROBLEMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * TWO SUM
 * Given an array and a target, find two indices that sum to target.
 */
registerProblem(
  "two-sum",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 2, max: 10000 },
      elementValue: { min: -1000000000, max: 1000000000 },
    })
    .addEdgeCase("Minimum size", { arr: [2, 7], target: 9 })
    .addEdgeCase("Negative numbers", { arr: [-3, 4, 3, 90], target: 0 })
    .addEdgeCase("Same element twice", { arr: [3, 3], target: 6 })
    .addEdgeCase("Large values", { arr: [1000000000, -1000000000], target: 0 })
    .setReferenceSolution((input) => {
      const { arr, target } = input;
      const map = new Map();
      for (let i = 0; i < arr.length; i++) {
        const complement = target - arr[i];
        if (map.has(complement)) {
          return [map.get(complement), i];
        }
        map.set(arr[i], i);
      }
      return [-1, -1];
    })
    .setInputToStdin((input) => {
      return `${input.arr.length}\n${input.arr.join(" ")}\n${input.target}`;
    })
    .setOutputFromStdout((result) => result.join(" "))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { small: 10, medium: 100, large: 1000 };
      const n = sizes[sizeCategory] || 100;
      const arr = rng.randIntArray(n, -1000, 1000);
      const i = rng.randInt(0, n - 2);
      const j = rng.randInt(i + 1, n - 1);
      const target = arr[i] + arr[j];
      return { arr, target };
    })
    .build()
);

/**
 * MAXIMUM SUBARRAY (Kadane's Algorithm)
 * Find the contiguous subarray with the largest sum.
 */
registerProblem(
  "maximum-subarray",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 100000 },
      elementValue: { min: -10000, max: 10000 },
    })
    .addEdgeCase("Single positive", { arr: [5] })
    .addEdgeCase("Single negative", { arr: [-3] })
    .addEdgeCase("All negative", { arr: [-2, -1, -3, -4] })
    .addEdgeCase("All positive", { arr: [1, 2, 3, 4, 5] })
    .addEdgeCase("Classic example", { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4] })
    .addAdversarialCase("Max at end", (rng) => {
      const arr = Array(100).fill(-1);
      arr[99] = 1000;
      return { arr };
    })
    .addAdversarialCase("Max at start", (rng) => {
      const arr = Array(100).fill(-1);
      arr[0] = 1000;
      return { arr };
    })
    .setReferenceSolution((input) => {
      const { arr } = input;
      let maxSum = arr[0];
      let currentSum = arr[0];
      for (let i = 1; i < arr.length; i++) {
        currentSum = Math.max(arr[i], currentSum + arr[i]);
        maxSum = Math.max(maxSum, currentSum);
      }
      return maxSum;
    })
    .setInputToStdin((input) => `${input.arr.length}\n${input.arr.join(" ")}`)
    .setOutputFromStdout((result) => String(result))
    .build()
);

/**
 * BINARY SEARCH
 * Find target in sorted array, return index or -1.
 */
registerProblem(
  "binary-search",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 100000 },
      elementValue: { min: -1000000000, max: 1000000000 },
    })
    .addEdgeCase("Single element found", { arr: [5], target: 5 })
    .addEdgeCase("Single element not found", { arr: [5], target: 3 })
    .addEdgeCase("First element", { arr: [1, 2, 3, 4, 5], target: 1 })
    .addEdgeCase("Last element", { arr: [1, 2, 3, 4, 5], target: 5 })
    .addEdgeCase("Middle element", { arr: [1, 2, 3, 4, 5], target: 3 })
    .addEdgeCase("Not found (too small)", { arr: [1, 3, 5, 7, 9], target: 0 })
    .addEdgeCase("Not found (too large)", { arr: [1, 3, 5, 7, 9], target: 10 })
    .addEdgeCase("Not found (middle)", { arr: [1, 3, 5, 7, 9], target: 4 })
    .setReferenceSolution((input) => {
      const { arr, target } = input;
      let left = 0,
        right = arr.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
      }
      return -1;
    })
    .setInputToStdin((input) => `${input.arr.length}\n${input.arr.join(" ")}\n${input.target}`)
    .setOutputFromStdout((result) => String(result))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { small: 10, medium: 1000, large: 10000 };
      const n = sizes[sizeCategory] || 1000;
      let arr = rng.randIntArray(n, -100000, 100000);
      arr = [...new Set(arr)].sort((a, b) => a - b);
      const target = rng.randBool(0.5)
        ? arr[rng.randInt(0, arr.length - 1)]
        : rng.randInt(-100001, 100001);
      return { arr, target };
    })
    .build()
);

/**
 * VALID PARENTHESES
 * Check if string of brackets is properly balanced.
 */
registerProblem(
  "valid-parentheses",
  new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 10000 },
      charset: "()[]{}",
    })
    .addEdgeCase("Simple match", { s: "()" })
    .addEdgeCase("Multiple types", { s: "()[]{}" })
    .addEdgeCase("Nested", { s: "{[]}" })
    .addEdgeCase("Wrong order", { s: "(]" })
    .addEdgeCase("Unmatched open", { s: "(((" })
    .addEdgeCase("Unmatched close", { s: ")))" })
    .addEdgeCase("Complex nested", { s: "([{}])" })
    .setReferenceSolution((input) => {
      const { s } = input;
      const stack = [];
      const pairs = { "(": ")", "[": "]", "{": "}" };
      for (const c of s) {
        if (pairs[c]) {
          stack.push(pairs[c]);
        } else {
          if (stack.pop() !== c) return false;
        }
      }
      return stack.length === 0;
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => (result ? "true" : "false"))
    .build()
);

/**
 * REVERSE STRING
 * Reverse a string in-place.
 */
registerProblem(
  "reverse-string",
  new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 100000 },
      charset: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("Two chars", { s: "ab" })
    .addEdgeCase("Palindrome", { s: "racecar" })
    .addEdgeCase("Mixed case", { s: "HeLLo" })
    .setReferenceSolution((input) => input.s.split("").reverse().join(""))
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => result)
    .build()
);

/**
 * VALID PALINDROME
 * Check if string is palindrome (alphanumeric only, case-insensitive).
 */
registerProblem(
  "valid-palindrome",
  new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 200000 },
      charset:
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.!?'-",
    })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("Empty after cleanup", { s: ".,!?" })
    .addEdgeCase("Classic", { s: "A man, a plan, a canal: Panama" })
    .addEdgeCase("Not palindrome", { s: "race a car" })
    .addEdgeCase("Numbers", { s: "12321" })
    .setReferenceSolution((input) => {
      const cleaned = input.s.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleaned.length === 0) return true;
      let left = 0,
        right = cleaned.length - 1;
      while (left < right) {
        if (cleaned[left] !== cleaned[right]) return false;
        left++;
        right--;
      }
      return true;
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => (result ? "true" : "false"))
    .build()
);

/**
 * FIBONACCI NUMBER
 * Compute the nth Fibonacci number.
 */
registerProblem(
  "fibonacci-number",
  new ProblemConfigBuilder(InputType.SINGLE_INT)
    .setConstraints({
      value: { min: 0, max: 45 },
    })
    .addEdgeCase("Zero", { n: 0 })
    .addEdgeCase("One", { n: 1 })
    .addEdgeCase("Two", { n: 2 })
    .addEdgeCase("Ten", { n: 10 })
    .addEdgeCase("Max safe", { n: 45 })
    .setReferenceSolution((input) => {
      const n = input.n;
      if (n <= 1) return n;
      let a = 0,
        b = 1;
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
      }
      return b;
    })
    .setInputToStdin((input) => String(input.n))
    .setOutputFromStdout((result) => String(result))
    .build()
);

/**
 * CLIMBING STAIRS
 * Count distinct ways to climb n stairs (1 or 2 steps at a time).
 */
registerProblem(
  "climbing-stairs",
  new ProblemConfigBuilder(InputType.SINGLE_INT)
    .setConstraints({
      value: { min: 1, max: 45 },
    })
    .addEdgeCase("One step", { n: 1 })
    .addEdgeCase("Two steps", { n: 2 })
    .addEdgeCase("Three steps", { n: 3 })
    .addEdgeCase("Ten steps", { n: 10 })
    .setReferenceSolution((input) => {
      const n = input.n;
      if (n <= 2) return n;
      let a = 1,
        b = 2;
      for (let i = 3; i <= n; i++) {
        [a, b] = [b, a + b];
      }
      return b;
    })
    .setInputToStdin((input) => String(input.n))
    .setOutputFromStdout((result) => String(result))
    .build()
);

/**
 * CONTAINS DUPLICATE
 * Check if array contains any duplicate values.
 */
registerProblem(
  "contains-duplicate",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 100000 },
      elementValue: { min: -1000000000, max: 1000000000 },
    })
    .addEdgeCase("Single element", { arr: [1] })
    .addEdgeCase("Two same", { arr: [1, 1] })
    .addEdgeCase("Two different", { arr: [1, 2] })
    .addEdgeCase("Has duplicate", { arr: [1, 2, 3, 1] })
    .addEdgeCase("No duplicates", { arr: [1, 2, 3, 4] })
    .setReferenceSolution((input) => {
      const { arr } = input;
      return new Set(arr).size !== arr.length;
    })
    .setInputToStdin((input) => `${input.arr.length}\n${input.arr.join(" ")}`)
    .setOutputFromStdout((result) => (result ? "true" : "false"))
    .build()
);

/**
 * MERGE SORTED ARRAY
 * Merge two sorted arrays in-place.
 */
registerProblem(
  "merge-sorted-array",
  new ProblemConfigBuilder(InputType.CUSTOM)
    .setConstraints({
      arrayLength: { min: 0, max: 200 },
      elementValue: { min: -1000000000, max: 1000000000 },
    })
    .addEdgeCase("Both empty", { nums1: [], m: 0, nums2: [], n: 0 })
    .addEdgeCase("First empty", { nums1: [0], m: 0, nums2: [1], n: 1 })
    .addEdgeCase("Second empty", { nums1: [1], m: 1, nums2: [], n: 0 })
    .addEdgeCase("Basic merge", { nums1: [1, 2, 3, 0, 0, 0], m: 3, nums2: [2, 5, 6], n: 3 })
    .setReferenceSolution((input) => {
      const { nums1, m, nums2, n } = input;
      const result = [...nums1.slice(0, m), ...nums2.slice(0, n)].sort((a, b) => a - b);
      return result;
    })
    .setInputToStdin((input) => {
      const { nums1, m, nums2, n } = input;
      return `${m} ${n}\n${nums1.slice(0, m).join(" ") || ""}\n${nums2.slice(0, n).join(" ") || ""}`;
    })
    .setOutputFromStdout((result) => result.join(" "))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { small: 5, medium: 50, large: 100 };
      const maxSize = sizes[sizeCategory] || 50;
      const m = rng.randInt(0, maxSize);
      const n = rng.randInt(0, maxSize);
      const nums1 = rng.randIntArray(m, -1000, 1000).sort((a, b) => a - b);
      nums1.push(...Array(n).fill(0)); // Padding for in-place merge
      const nums2 = rng.randIntArray(n, -1000, 1000).sort((a, b) => a - b);
      return { nums1, m, nums2, n };
    })
    .build()
);

/**
 * K-TH SMALLEST IN MERGED ARRAYS
 * Find the k-th smallest element among k sorted arrays.
 * DB Problem Title: "K-th Smallest in Merged Arrays"
 * Slug: "k-th-smallest-in-merged-arrays"
 */
registerProblem(
  "k-th-smallest-in-merged-arrays",
  new ProblemConfigBuilder(InputType.CUSTOM)
    .setConstraints({
      arrayCount: { min: 1, max: 100 },
      arrayLength: { min: 0, max: 500 },
      elementValue: { min: -10000, max: 10000 },
    })
    .addEdgeCase("Single array", { 
      k: 2, 
      arrays: [[1, 3, 5]] 
    })
    .addEdgeCase("Two arrays", { 
      k: 3, 
      arrays: [[1, 3, 5], [2, 4, 6]] 
    })
    .addEdgeCase("K equals 1", { 
      k: 1, 
      arrays: [[5, 10], [1, 2], [3, 4]] 
    })
    .addEdgeCase("K too large", { 
      k: 100, 
      arrays: [[1, 2], [3, 4]] 
    })
    .addEdgeCase("Empty arrays", { 
      k: 1, 
      arrays: [[], [1, 2], []] 
    })
    .addEdgeCase("All same values", { 
      k: 3, 
      arrays: [[1, 1, 1], [1, 1, 1]] 
    })
    .addEdgeCase("Negative values", { 
      k: 2, 
      arrays: [[-5, -3, -1], [-4, -2, 0]] 
    })
    .setReferenceSolution((input) => {
      const { k, arrays } = input;
      // Merge all arrays and sort
      const merged = arrays.flat().sort((a, b) => a - b);
      if (k > merged.length || k < 1) return -1;
      return merged[k - 1];
    })
    .setInputToStdin((input) => {
      const { k, arrays } = input;
      let lines = [];
      lines.push(`${k}`);
      lines.push(`${arrays.length}`);
      for (const arr of arrays) {
        lines.push(`${arr.length}`);
        if (arr.length > 0) {
          lines.push(arr.join(" "));
        }
      }
      return lines.join("\n");
    })
    .setOutputFromStdout((result) => String(result))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { 
        small: { numArrays: 3, maxLen: 10 }, 
        medium: { numArrays: 10, maxLen: 50 }, 
        large: { numArrays: 50, maxLen: 100 } 
      };
      const config = sizes[sizeCategory] || sizes.medium;
      
      const numArrays = rng.randInt(1, config.numArrays);
      const arrays = [];
      let totalElements = 0;
      
      for (let i = 0; i < numArrays; i++) {
        const len = rng.randInt(0, config.maxLen);
        const arr = rng.randIntArray(len, -10000, 10000).sort((a, b) => a - b);
        arrays.push(arr);
        totalElements += len;
      }
      
      // k should be valid most of the time, but sometimes test edge cases
      const k = totalElements > 0 
        ? (rng.randBool(0.9) ? rng.randInt(1, totalElements) : rng.randInt(1, totalElements + 10))
        : 1;
      
      return { k, arrays };
    })
    .build()
);

/**
 * REPEATED SUBSTRING CHECK
 * Check if a string can be constructed by repeating a substring.
 * DB Problem Title: "Repeated Substring Check"
 * Slug: "repeated-substring-check"
 */
registerProblem(
  "repeated-substring-check",
  new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 100 },
      charset: "abcdefghijklmnopqrstuvwxyz",
    })
    .addEdgeCase("abab pattern", { s: "abab" })
    .addEdgeCase("abc no pattern", { s: "abc" })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("All same", { s: "aaaa" })
    .addEdgeCase("Two char repeat", { s: "abcabc" })
    .addEdgeCase("Long pattern", { s: "abcabcabcabc" })
    .addEdgeCase("Almost pattern", { s: "abcabcd" })
    .setReferenceSolution((input) => {
      // Count valid repeated substring patterns
      const s = input.s;
      const n = s.length;
      let count = 0;
      
      // Check each possible substring length that divides n
      for (let len = 1; len <= n / 2; len++) {
        if (n % len === 0) {
          const pattern = s.substring(0, len);
          let isRepeated = true;
          for (let i = len; i < n; i += len) {
            if (s.substring(i, i + len) !== pattern) {
              isRepeated = false;
              break;
            }
          }
          if (isRepeated) count++;
        }
      }
      return count;
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => String(result))
    .build()
);

/**
 * INCREMENT SUBSTRING (Repeated Substring Pattern)
 * Count number of repeated substring patterns in a string.
 * Based on the problem in the user's screenshot.
 */
registerProblem(
  "increment-substring",
  new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 100 },
      charset: "abcdefghijklmnopqrstuvwxyz",
    })
    .addEdgeCase("abab pattern", { s: "abab" })
    .addEdgeCase("abc no pattern", { s: "abc" })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("All same", { s: "aaaa" })
    .addEdgeCase("Two char repeat", { s: "abcabc" })
    .addEdgeCase("Long pattern", { s: "abcabcabcabc" })
    .setReferenceSolution((input) => {
      // Count valid repeated substring patterns
      const s = input.s;
      const n = s.length;
      let count = 0;
      
      // Check each possible substring length that divides n
      for (let len = 1; len <= n / 2; len++) {
        if (n % len === 0) {
          const pattern = s.substring(0, len);
          let isRepeated = true;
          for (let i = len; i < n; i += len) {
            if (s.substring(i, i + len) !== pattern) {
              isRepeated = false;
              break;
            }
          }
          if (isRepeated) count++;
        }
      }
      return count;
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => String(result))
    .build()
);

/**
 * REPEATED SUBSTRING PATTERN (Alternative name)
 */
registerProblem(
  "repeated-substring-pattern",
  new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 10000 },
      charset: "abcdefghijklmnopqrstuvwxyz",
    })
    .addEdgeCase("Has pattern", { s: "abab" })
    .addEdgeCase("No pattern", { s: "aba" })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("All same", { s: "aaaa" })
    .setReferenceSolution((input) => {
      const s = input.s;
      // KMP-based solution: if s repeats, (s + s)[1:-1] contains s
      const doubled = (s + s).slice(1, -1);
      return doubled.includes(s);
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => (result ? "true" : "false"))
    .build()
);

/**
 * LONGEST COMMON PREFIX
 * Find the longest common prefix among an array of strings.
 */
registerProblem(
  "longest-common-prefix",
  new ProblemConfigBuilder(InputType.STRING_ARRAY)
    .setConstraints({
      arrayLength: { min: 1, max: 200 },
      stringLength: { min: 0, max: 200 },
      charset: "abcdefghijklmnopqrstuvwxyz",
    })
    .addEdgeCase("Has prefix", { strs: ["flower", "flow", "flight"] })
    .addEdgeCase("No prefix", { strs: ["dog", "racecar", "car"] })
    .addEdgeCase("Single string", { strs: ["alone"] })
    .addEdgeCase("Empty string", { strs: ["", "b"] })
    .addEdgeCase("All same", { strs: ["abc", "abc", "abc"] })
    .setReferenceSolution((input) => {
      const strs = input.strs;
      if (strs.length === 0) return "";
      let prefix = strs[0];
      for (let i = 1; i < strs.length; i++) {
        while (strs[i].indexOf(prefix) !== 0) {
          prefix = prefix.slice(0, -1);
          if (prefix === "") return "";
        }
      }
      return prefix;
    })
    .setInputToStdin((input) => `${input.strs.length}\n${input.strs.join("\n")}`)
    .setOutputFromStdout((result) => result)
    .build()
);

/**
 * PLUS ONE
 * Add one to a number represented as array of digits.
 */
registerProblem(
  "plus-one",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 100 },
      elementValue: { min: 0, max: 9 },
    })
    .addEdgeCase("Simple", { digits: [1, 2, 3] })
    .addEdgeCase("Carry", { digits: [1, 2, 9] })
    .addEdgeCase("All nines", { digits: [9, 9, 9] })
    .addEdgeCase("Single digit", { digits: [0] })
    .addEdgeCase("Single nine", { digits: [9] })
    .setReferenceSolution((input) => {
      const digits = [...input.digits];
      for (let i = digits.length - 1; i >= 0; i--) {
        if (digits[i] < 9) {
          digits[i]++;
          return digits;
        }
        digits[i] = 0;
      }
      return [1, ...digits];
    })
    .setInputToStdin((input) => `${input.digits.length}\n${input.digits.join(" ")}`)
    .setOutputFromStdout((result) => result.join(" "))
    .build()
);

/**
 * REMOVE DUPLICATES FROM SORTED ARRAY
 * Remove duplicates in-place, return new length.
 */
registerProblem(
  "remove-duplicates-from-sorted-array",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 0, max: 30000 },
      elementValue: { min: -100, max: 100 },
    })
    .addEdgeCase("Has duplicates", { nums: [1, 1, 2] })
    .addEdgeCase("Many duplicates", { nums: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] })
    .addEdgeCase("No duplicates", { nums: [1, 2, 3] })
    .addEdgeCase("Single element", { nums: [1] })
    .addEdgeCase("Empty", { nums: [] })
    .setReferenceSolution((input) => {
      const nums = input.nums;
      if (nums.length === 0) return 0;
      let k = 1;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[k - 1]) {
          nums[k] = nums[i];
          k++;
        }
      }
      return k;
    })
    .setInputToStdin((input) => `${input.nums.length}\n${input.nums.join(" ") || ""}`)
    .setOutputFromStdout((result) => String(result))
    .build()
);

/**
 * SEARCH INSERT POSITION
 * Find index to insert target in sorted array.
 */
registerProblem(
  "search-insert-position",
  new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 10000 },
      elementValue: { min: -10000, max: 10000 },
    })
    .addEdgeCase("Found", { nums: [1, 3, 5, 6], target: 5 })
    .addEdgeCase("Insert middle", { nums: [1, 3, 5, 6], target: 2 })
    .addEdgeCase("Insert end", { nums: [1, 3, 5, 6], target: 7 })
    .addEdgeCase("Insert start", { nums: [1, 3, 5, 6], target: 0 })
    .setReferenceSolution((input) => {
      const { nums, target } = input;
      let left = 0, right = nums.length;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (nums[mid] < target) left = mid + 1;
        else right = mid;
      }
      return left;
    })
    .setInputToStdin((input) => `${input.nums.length}\n${input.nums.join(" ")}\n${input.target}`)
    .setOutputFromStdout((result) => String(result))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { small: 10, medium: 100, large: 1000 };
      const n = sizes[sizeCategory] || 100;
      let nums = rng.randIntArray(n, -1000, 1000);
      nums = [...new Set(nums)].sort((a, b) => a - b);
      const target = rng.randBool(0.5)
        ? nums[rng.randInt(0, nums.length - 1)]
        : rng.randInt(-1001, 1001);
      return { nums, target };
    })
    .build()
);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  registerProblem,
  getProblemConfig,
  hasProblem,
  getAllProblemSlugs,
  logAllRegisteredSlugs,
  normalizeSlug,
  problemRegistry,
  InputType,
  TestCategory,
  ProblemConfigBuilder,
};
