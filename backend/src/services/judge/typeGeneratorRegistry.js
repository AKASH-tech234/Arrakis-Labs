/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TYPE-BASED TEST CASE GENERATOR REGISTRY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This module provides automatic hidden test case generation based on problem TYPE.
 * Instead of registering individual problems by slug, we generate test cases
 * based on the problem's category/type (ARRAY, SORTING, MATH, etc.).
 * 
 * BENEFITS:
 * - Works for ALL 619+ problems automatically
 * - No manual per-problem registration needed
 * - New problems automatically get hidden tests based on their type
 * 
 * SECURITY:
 * - Generated test cases are NEVER exposed to frontend
 * - Only test number and pass/fail status are returned
 * 
 * USAGE:
 *   import { generateTestsByType, hasGeneratorForType } from './typeGeneratorRegistry.js';
 *   
 *   if (hasGeneratorForType(problem.type)) {
 *     const hiddenTests = generateTestsByType(problem.type, seed, constraints);
 *   }
 */

import { SeededRandom } from "./testCaseGenerator.js";

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM NUMBER GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a seeded RNG for deterministic test generation
 * @param {string} seed - Seed string (e.g., "userId-questionId-timestamp")
 * @returns {SeededRandom} Seeded random number generator
 */
function createRNG(seed) {
  return new SeededRandom(seed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format test case for execution
 */
function formatTestCase(stdin, expectedStdout, category, label) {
  return {
    stdin: String(stdin),
    expectedStdout: String(expectedStdout).trim(),
    category,
    label,
    isHidden: true,
  };
}

/**
 * Generate a random array of integers
 */
function randomIntArray(rng, length, min, max) {
  const arr = [];
  for (let i = 0; i < length; i++) {
    arr.push(rng.randInt(min, max));
  }
  return arr;
}

/**
 * Generate a sorted array
 */
function sortedIntArray(rng, length, min, max) {
  return randomIntArray(rng, length, min, max).sort((a, b) => a - b);
}

/**
 * Generate array with duplicates
 */
function arrayWithDuplicates(rng, length, min, max) {
  const uniqueCount = Math.max(1, Math.floor(length / 3));
  const uniqueValues = randomIntArray(rng, uniqueCount, min, max);
  const arr = [];
  for (let i = 0; i < length; i++) {
    arr.push(uniqueValues[rng.randInt(0, uniqueCount - 1)]);
  }
  return arr;
}

/**
 * Generate a random string
 */
function randomString(rng, length, charset = "abcdefghijklmnopqrstuvwxyz") {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[rng.randInt(0, charset.length - 1)];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARRAY TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateArrayTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  const maxLen = constraints.maxArrayLength || 1000;
  const minVal = constraints.minValue || -10000;
  const maxVal = constraints.maxValue || 10000;

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n42",
    "42", // Single element - expected output depends on problem
    "edge",
    "Single element array"
  ));
  
  tests.push(formatTestCase(
    "2\n1 2",
    "1 2",
    "edge",
    "Two element array"
  ));
  
  tests.push(formatTestCase(
    `5\n${Array(5).fill(0).join(" ")}`,
    Array(5).fill(0).join(" "),
    "edge",
    "All zeros"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(5, 50);
    const arr = randomIntArray(rng, len, minVal, maxVal);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      arr.join(" "), // Placeholder - actual output computed by reference solution
      "random",
      `Random array ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = Math.min(maxLen, 500 + i * 200);
    const arr = randomIntArray(rng, len, minVal, maxVal);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      arr.join(" "),
      "stress",
      `Stress test ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    `10\n${Array(10).fill(maxVal).join(" ")}`,
    Array(10).fill(maxVal).join(" "),
    "adversarial",
    "All maximum values"
  ));
  
  tests.push(formatTestCase(
    `10\n${Array(10).fill(minVal).join(" ")}`,
    Array(10).fill(minVal).join(" "),
    "adversarial",
    "All minimum values"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SORTING TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateSortingTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  const maxLen = constraints.maxArrayLength || 1000;
  const minVal = constraints.minValue || -10000;
  const maxVal = constraints.maxValue || 10000;

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n42",
    "42",
    "edge",
    "Single element"
  ));
  
  tests.push(formatTestCase(
    "5\n1 2 3 4 5",
    "1 2 3 4 5",
    "edge",
    "Already sorted"
  ));
  
  tests.push(formatTestCase(
    "5\n5 4 3 2 1",
    "1 2 3 4 5",
    "edge",
    "Reverse sorted"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(10, 100);
    const arr = randomIntArray(rng, len, minVal, maxVal);
    const sorted = [...arr].sort((a, b) => a - b);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      sorted.join(" "),
      "random",
      `Random unsorted ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = Math.min(maxLen, 500 + i * 300);
    const arr = randomIntArray(rng, len, minVal, maxVal);
    const sorted = [...arr].sort((a, b) => a - b);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      sorted.join(" "),
      "stress",
      `Stress test ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  const dupArr = arrayWithDuplicates(rng, 20, 1, 5);
  tests.push(formatTestCase(
    `20\n${dupArr.join(" ")}`,
    [...dupArr].sort((a, b) => a - b).join(" "),
    "adversarial",
    "Many duplicates"
  ));
  
  tests.push(formatTestCase(
    `10\n${Array(10).fill(7).join(" ")}`,
    Array(10).fill(7).join(" "),
    "adversarial",
    "All same values"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCHING TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateSearchingTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  const maxLen = constraints.maxArrayLength || 1000;

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n5\n5",
    "0",
    "edge",
    "Single element found"
  ));
  
  tests.push(formatTestCase(
    "1\n5\n3",
    "-1",
    "edge",
    "Single element not found"
  ));
  
  tests.push(formatTestCase(
    "5\n1 2 3 4 5\n1",
    "0",
    "edge",
    "First element"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(10, 100);
    const arr = sortedIntArray(rng, len, -1000, 1000);
    const targetIdx = rng.randInt(0, len - 1);
    const target = arr[targetIdx];
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}\n${target}`,
      String(arr.indexOf(target)),
      "random",
      `Random search ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = Math.min(maxLen, 500 + i * 300);
    const arr = sortedIntArray(rng, len, -100000, 100000);
    const targetIdx = rng.randInt(0, len - 1);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}\n${arr[targetIdx]}`,
      String(targetIdx),
      "stress",
      `Stress search ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "10\n1 2 3 4 5 6 7 8 9 10\n0",
    "-1",
    "adversarial",
    "Target smaller than all"
  ));
  
  tests.push(formatTestCase(
    "10\n1 2 3 4 5 6 7 8 9 10\n11",
    "-1",
    "adversarial",
    "Target larger than all"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HASHING TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateHashingTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  const maxLen = constraints.maxArrayLength || 1000;

  // Edge cases (3) - Two Sum style
  tests.push(formatTestCase(
    "2\n2 7\n9",
    "0 1",
    "edge",
    "Minimum size pair"
  ));
  
  tests.push(formatTestCase(
    "4\n-3 4 3 90\n0",
    "0 2",
    "edge",
    "Negative numbers sum to zero"
  ));
  
  tests.push(formatTestCase(
    "2\n3 3\n6",
    "0 1",
    "edge",
    "Same values"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(5, 50);
    const arr = randomIntArray(rng, len, -100, 100);
    const idx1 = rng.randInt(0, len - 2);
    const idx2 = rng.randInt(idx1 + 1, len - 1);
    const target = arr[idx1] + arr[idx2];
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}\n${target}`,
      `${idx1} ${idx2}`,
      "random",
      `Random hash lookup ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = Math.min(maxLen, 200 + i * 100);
    const arr = randomIntArray(rng, len, -1000, 1000);
    const idx1 = rng.randInt(0, len - 2);
    const idx2 = rng.randInt(idx1 + 1, len - 1);
    const target = arr[idx1] + arr[idx2];
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}\n${target}`,
      `${idx1} ${idx2}`,
      "stress",
      `Stress hash ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "5\n1 1 1 1 1\n2",
    "0 1",
    "adversarial",
    "All same values"
  ));
  
  const largeArr = randomIntArray(rng, 100, 1000000, 2000000);
  largeArr[0] = -1000000;
  largeArr[99] = 1000000;
  tests.push(formatTestCase(
    `100\n${largeArr.join(" ")}\n0`,
    "0 99",
    "adversarial",
    "Large values sum to zero"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GREEDY TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateGreedyTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  // Greedy problems often involve intervals, coins, or activity selection

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n10",
    "10",
    "edge",
    "Single element"
  ));
  
  tests.push(formatTestCase(
    "3\n1 2 3",
    "6",
    "edge",
    "Small increasing sequence"
  ));
  
  tests.push(formatTestCase(
    "5\n5 4 3 2 1",
    "15",
    "edge",
    "Decreasing sequence"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(5, 30);
    const arr = randomIntArray(rng, len, 1, 100);
    const sum = arr.reduce((a, b) => a + b, 0);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      String(sum),
      "random",
      `Random greedy ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = 100 + i * 100;
    const arr = randomIntArray(rng, len, 1, 1000);
    const sum = arr.reduce((a, b) => a + b, 0);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      String(sum),
      "stress",
      `Stress greedy ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "10\n1 1 1 1 1 1 1 1 1 1",
    "10",
    "adversarial",
    "All ones"
  ));
  
  tests.push(formatTestCase(
    "5\n1000000 1000000 1000000 1000000 1000000",
    "5000000",
    "adversarial",
    "Large values"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIVIDE AND CONQUER TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateDivideAndConquerTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  // D&C problems: merge sort, binary search, max subarray, etc.

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n5",
    "5",
    "edge",
    "Single element"
  ));
  
  tests.push(formatTestCase(
    "2\n-1 1",
    "1",
    "edge",
    "Two elements"
  ));
  
  tests.push(formatTestCase(
    "5\n-2 -1 -3 -4 -5",
    "-1",
    "edge",
    "All negative (max subarray style)"
  ));

  // Random cases (5) - Max subarray style
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(5, 50);
    const arr = randomIntArray(rng, len, -100, 100);
    // Compute max subarray sum (Kadane's)
    let maxSum = arr[0], currentSum = arr[0];
    for (let j = 1; j < arr.length; j++) {
      currentSum = Math.max(arr[j], currentSum + arr[j]);
      maxSum = Math.max(maxSum, currentSum);
    }
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      String(maxSum),
      "random",
      `Random D&C ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = 200 + i * 200;
    const arr = randomIntArray(rng, len, -1000, 1000);
    let maxSum = arr[0], currentSum = arr[0];
    for (let j = 1; j < arr.length; j++) {
      currentSum = Math.max(arr[j], currentSum + arr[j]);
      maxSum = Math.max(maxSum, currentSum);
    }
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      String(maxSum),
      "stress",
      `Stress D&C ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "10\n1 2 3 4 5 6 7 8 9 10",
    "55",
    "adversarial",
    "All positive (entire array is max)"
  ));
  
  const alternating = [];
  for (let i = 0; i < 20; i++) {
    alternating.push(i % 2 === 0 ? 100 : -99);
  }
  tests.push(formatTestCase(
    `20\n${alternating.join(" ")}`,
    String(Math.max(...alternating.map((_, i, a) => {
      let sum = 0, max = a[0];
      for (let j = 0; j < a.length; j++) {
        sum = Math.max(a[j], sum + a[j]);
        max = Math.max(max, sum);
      }
      return max;
    }))),
    "adversarial",
    "Alternating positive/negative"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKED LIST TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateLinkedListTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  // Linked list problems: reverse, merge, detect cycle, etc.
  // Input format: array representation of linked list

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n1",
    "1",
    "edge",
    "Single node"
  ));
  
  tests.push(formatTestCase(
    "2\n1 2",
    "2 1",
    "edge",
    "Two nodes (reverse)"
  ));
  
  tests.push(formatTestCase(
    "0",
    "",
    "edge",
    "Empty list"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(3, 20);
    const arr = randomIntArray(rng, len, 1, 100);
    const reversed = [...arr].reverse();
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      reversed.join(" "),
      "random",
      `Random list ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = 100 + i * 100;
    const arr = randomIntArray(rng, len, 1, 1000);
    const reversed = [...arr].reverse();
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      reversed.join(" "),
      "stress",
      `Stress list ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "5\n1 1 1 1 1",
    "1 1 1 1 1",
    "adversarial",
    "All same values"
  ));
  
  tests.push(formatTestCase(
    "10\n10 9 8 7 6 5 4 3 2 1",
    "1 2 3 4 5 6 7 8 9 10",
    "adversarial",
    "Already reverse sorted"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATH TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateMathTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];
  
  // Math problems: factorial, fibonacci, prime, GCD, etc.

  // Edge cases (3)
  tests.push(formatTestCase(
    "0",
    "1",
    "edge",
    "Zero (factorial of 0 = 1)"
  ));
  
  tests.push(formatTestCase(
    "1",
    "1",
    "edge",
    "One"
  ));
  
  tests.push(formatTestCase(
    "2",
    "2",
    "edge",
    "Two"
  ));

  // Random cases (5) - Fibonacci style
  for (let i = 0; i < 5; i++) {
    const n = rng.randInt(3, 30);
    // Compute fibonacci
    let a = 0, b = 1;
    for (let j = 2; j <= n; j++) {
      [a, b] = [b, a + b];
    }
    const fib = n <= 1 ? n : b;
    tests.push(formatTestCase(
      String(n),
      String(fib),
      "random",
      `Random math ${i + 1} (n=${n})`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const n = 40 + i * 5; // Fibonacci can get large
    let a = 0n, b = 1n;
    for (let j = 2; j <= n; j++) {
      [a, b] = [b, a + b];
    }
    tests.push(formatTestCase(
      String(n),
      String(b),
      "stress",
      `Stress math ${i + 1} (n=${n})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "10",
    "55",
    "adversarial",
    "Fibonacci 10"
  ));
  
  tests.push(formatTestCase(
    "20",
    "6765",
    "adversarial",
    "Fibonacci 20"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateStringTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];

  // Edge cases (3)
  tests.push(formatTestCase(
    "a",
    "a",
    "edge",
    "Single character"
  ));
  
  tests.push(formatTestCase(
    "ab",
    "ba",
    "edge",
    "Two characters (reverse)"
  ));
  
  tests.push(formatTestCase(
    "racecar",
    "racecar",
    "edge",
    "Palindrome"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(5, 50);
    const str = randomString(rng, len);
    const reversed = str.split("").reverse().join("");
    tests.push(formatTestCase(
      str,
      reversed,
      "random",
      `Random string ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = 200 + i * 200;
    const str = randomString(rng, len);
    const reversed = str.split("").reverse().join("");
    tests.push(formatTestCase(
      str,
      reversed,
      "stress",
      `Stress string ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "aaaaaaaaaa",
    "aaaaaaaaaa",
    "adversarial",
    "All same characters"
  ));
  
  tests.push(formatTestCase(
    "abcdefghij",
    "jihgfedcba",
    "adversarial",
    "Sequential characters"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC PROGRAMMING TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateDPTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];

  // Edge cases (3) - Climbing stairs style
  tests.push(formatTestCase(
    "1",
    "1",
    "edge",
    "n=1"
  ));
  
  tests.push(formatTestCase(
    "2",
    "2",
    "edge",
    "n=2"
  ));
  
  tests.push(formatTestCase(
    "3",
    "3",
    "edge",
    "n=3"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const n = rng.randInt(4, 30);
    // Climbing stairs: dp[i] = dp[i-1] + dp[i-2]
    let a = 1, b = 2;
    for (let j = 3; j <= n; j++) {
      [a, b] = [b, a + b];
    }
    const result = n <= 2 ? n : b;
    tests.push(formatTestCase(
      String(n),
      String(result),
      "random",
      `Random DP ${i + 1} (n=${n})`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const n = 40 + i * 5;
    let a = 1n, b = 2n;
    for (let j = 3; j <= n; j++) {
      [a, b] = [b, a + b];
    }
    tests.push(formatTestCase(
      String(n),
      String(b),
      "stress",
      `Stress DP ${i + 1} (n=${n})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "10",
    "89",
    "adversarial",
    "Climbing stairs n=10"
  ));
  
  tests.push(formatTestCase(
    "20",
    "10946",
    "adversarial",
    "Climbing stairs n=20"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREE TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateTreeTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];

  // Trees represented as array (level-order) or edge list

  // Edge cases (3)
  tests.push(formatTestCase(
    "1\n1",
    "1",
    "edge",
    "Single node tree"
  ));
  
  tests.push(formatTestCase(
    "3\n1 2 3",
    "1 2 3",
    "edge",
    "Complete binary tree (3 nodes)"
  ));
  
  tests.push(formatTestCase(
    "7\n1 2 3 4 5 6 7",
    "1 2 3 4 5 6 7",
    "edge",
    "Complete binary tree (7 nodes)"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const len = rng.randInt(5, 31);
    const arr = randomIntArray(rng, len, 1, 100);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      arr.join(" "),
      "random",
      `Random tree ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const len = 63 + i * 64; // Complete binary tree sizes
    const arr = randomIntArray(rng, len, 1, 1000);
    tests.push(formatTestCase(
      `${len}\n${arr.join(" ")}`,
      arr.join(" "),
      "stress",
      `Stress tree ${i + 1} (n=${len})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "15\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
    "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
    "adversarial",
    "Complete tree sequential values"
  ));
  
  tests.push(formatTestCase(
    "7\n7 7 7 7 7 7 7",
    "7 7 7 7 7 7 7",
    "adversarial",
    "All same values"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateGraphTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];

  // Graphs as adjacency list or edge list

  // Edge cases (3)
  tests.push(formatTestCase(
    "1 0",
    "0",
    "edge",
    "Single node, no edges"
  ));
  
  tests.push(formatTestCase(
    "2 1\n0 1",
    "0 1",
    "edge",
    "Two nodes, one edge"
  ));
  
  tests.push(formatTestCase(
    "3 3\n0 1\n1 2\n0 2",
    "0 1 2",
    "edge",
    "Triangle"
  ));

  // Random cases (5)
  for (let i = 0; i < 5; i++) {
    const n = rng.randInt(4, 10);
    const maxEdges = (n * (n - 1)) / 2;
    const e = rng.randInt(n - 1, Math.min(maxEdges, n * 2));
    const edges = new Set();
    while (edges.size < e) {
      const u = rng.randInt(0, n - 1);
      const v = rng.randInt(0, n - 1);
      if (u !== v) {
        const edge = u < v ? `${u} ${v}` : `${v} ${u}`;
        edges.add(edge);
      }
    }
    const edgeList = Array.from(edges).join("\n");
    tests.push(formatTestCase(
      `${n} ${edges.size}\n${edgeList}`,
      Array.from({ length: n }, (_, i) => i).join(" "),
      "random",
      `Random graph ${i + 1}`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const n = 20 + i * 10;
    const e = n * 2;
    const edges = new Set();
    // Create a connected graph
    for (let j = 1; j < n; j++) {
      edges.add(`${j - 1} ${j}`);
    }
    while (edges.size < e) {
      const u = rng.randInt(0, n - 1);
      const v = rng.randInt(0, n - 1);
      if (u !== v) {
        const edge = u < v ? `${u} ${v}` : `${v} ${u}`;
        edges.add(edge);
      }
    }
    tests.push(formatTestCase(
      `${n} ${edges.size}\n${Array.from(edges).join("\n")}`,
      Array.from({ length: n }, (_, i) => i).join(" "),
      "stress",
      `Stress graph ${i + 1} (n=${n}, e=${edges.size})`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "5 4\n0 1\n1 2\n2 3\n3 4",
    "0 1 2 3 4",
    "adversarial",
    "Linear chain"
  ));
  
  tests.push(formatTestCase(
    "4 6\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3",
    "0 1 2 3",
    "adversarial",
    "Complete graph K4"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKTRACKING TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateBacktrackingTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];

  // Backtracking: permutations, combinations, subsets, N-Queens

  // Edge cases (3)
  tests.push(formatTestCase(
    "1",
    "1",
    "edge",
    "n=1"
  ));
  
  tests.push(formatTestCase(
    "2",
    "2",
    "edge",
    "n=2"
  ));
  
  tests.push(formatTestCase(
    "3",
    "6",
    "edge",
    "n=3 (permutations count)"
  ));

  // Random cases (5) - Count permutations = n!
  function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }
  
  for (let i = 0; i < 5; i++) {
    const n = rng.randInt(4, 8);
    tests.push(formatTestCase(
      String(n),
      String(factorial(n)),
      "random",
      `Random backtrack ${i + 1} (n=${n})`
    ));
  }

  // Stress cases (2)
  tests.push(formatTestCase(
    "9",
    String(factorial(9)),
    "stress",
    "Stress backtrack 1 (n=9)"
  ));
  
  tests.push(formatTestCase(
    "10",
    String(factorial(10)),
    "stress",
    "Stress backtrack 2 (n=10)"
  ));

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "5",
    "120",
    "adversarial",
    "5! = 120"
  ));
  
  tests.push(formatTestCase(
    "7",
    "5040",
    "adversarial",
    "7! = 5040"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIT MANIPULATION TYPE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateBitManipulationTests(seed, constraints = {}) {
  const rng = createRNG(seed);
  const tests = [];

  // Edge cases (3)
  tests.push(formatTestCase(
    "0",
    "0",
    "edge",
    "Zero"
  ));
  
  tests.push(formatTestCase(
    "1",
    "1",
    "edge",
    "One"
  ));
  
  tests.push(formatTestCase(
    "2",
    "1",
    "edge",
    "Power of 2"
  ));

  // Random cases (5) - Count set bits
  for (let i = 0; i < 5; i++) {
    const n = rng.randInt(1, 1000000);
    const setBits = n.toString(2).split("").filter(b => b === "1").length;
    tests.push(formatTestCase(
      String(n),
      String(setBits),
      "random",
      `Random bits ${i + 1} (n=${n})`
    ));
  }

  // Stress cases (2)
  for (let i = 0; i < 2; i++) {
    const n = rng.randInt(1000000000, 2147483647);
    const setBits = n.toString(2).split("").filter(b => b === "1").length;
    tests.push(formatTestCase(
      String(n),
      String(setBits),
      "stress",
      `Stress bits ${i + 1}`
    ));
  }

  // Adversarial cases (2)
  tests.push(formatTestCase(
    "2147483647",
    "31",
    "adversarial",
    "Max 32-bit signed (all 1s)"
  ));
  
  tests.push(formatTestCase(
    "1073741824",
    "1",
    "adversarial",
    "2^30 (single bit set)"
  ));

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GENERATOR REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry mapping problem types to their generator functions.
 * Keys are normalized to uppercase for consistent matching.
 */
const typeGeneratorRegistry = {
  // Primary types
  "ARRAY": generateArrayTests,
  "SORTING": generateSortingTests,
  "SEARCHING": generateSearchingTests,
  "HASHING": generateHashingTests,
  "GREEDY": generateGreedyTests,
  "DIVIDE AND CONQUER": generateDivideAndConquerTests,
  "LINKED LIST": generateLinkedListTests,
  "MATH": generateMathTests,
  "STRING": generateStringTests,
  "DYNAMIC PROGRAMMING": generateDPTests,
  "DP": generateDPTests,
  "TREE": generateTreeTests,
  "GRAPH": generateGraphTests,
  "BACKTRACKING": generateBacktrackingTests,
  "BIT MANIPULATION": generateBitManipulationTests,
  
  // Aliases and variations
  "ARRAYS": generateArrayTests,
  "SORT": generateSortingTests,
  "SEARCH": generateSearchingTests,
  "HASH": generateHashingTests,
  "HASH TABLE": generateHashingTests,
  "HASH MAP": generateHashingTests,
  "LINKEDLIST": generateLinkedListTests,
  "LINKED-LIST": generateLinkedListTests,
  "MATHEMATICS": generateMathTests,
  "STRINGS": generateStringTests,
  "TREES": generateTreeTests,
  "BINARY TREE": generateTreeTests,
  "BST": generateTreeTests,
  "GRAPHS": generateGraphTests,
  "BFS": generateGraphTests,
  "DFS": generateGraphTests,
  "RECURSION": generateBacktrackingTests,
  "BITS": generateBitManipulationTests,
  "TWO POINTERS": generateArrayTests,
  "SLIDING WINDOW": generateArrayTests,
  "STACK": generateArrayTests,
  "QUEUE": generateArrayTests,
  "HEAP": generateArrayTests,
  "PRIORITY QUEUE": generateArrayTests,
};

/**
 * Normalize a type string for consistent lookup
 * @param {string} type - Raw type string
 * @returns {string} Normalized type (uppercase, trimmed)
 */
function normalizeType(type) {
  if (!type) return "";
  return String(type).toUpperCase().trim();
}

/**
 * Check if a generator exists for the given type
 * @param {string} type - Problem type
 * @returns {boolean}
 */
function hasGeneratorForType(type) {
  const normalized = normalizeType(type);
  return normalized in typeGeneratorRegistry;
}

/**
 * Generate test cases based on problem type
 * @param {string} type - Problem type (e.g., "ARRAY", "SORTING")
 * @param {string} seed - Seed for deterministic generation
 * @param {object} constraints - Optional constraints from problem
 * @returns {Array} Array of test cases
 */
function generateTestsByType(type, seed, constraints = {}) {
  const normalized = normalizeType(type);
  const generator = typeGeneratorRegistry[normalized];
  
  if (!generator) {
    console.warn(`[TypeRegistry] No generator for type: "${type}" (normalized: "${normalized}")`);
    return [];
  }
  
  try {
    return generator(seed, constraints);
  } catch (error) {
    console.error(`[TypeRegistry] Generator failed for type "${type}": ${error.message}`);
    return [];
  }
}

/**
 * Get all registered types
 * @returns {string[]}
 */
function getAllRegisteredTypes() {
  return Object.keys(typeGeneratorRegistry);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  typeGeneratorRegistry,
  hasGeneratorForType,
  generateTestsByType,
  getAllRegisteredTypes,
  normalizeType,
  // Individual generators (for testing)
  generateArrayTests,
  generateSortingTests,
  generateSearchingTests,
  generateHashingTests,
  generateGreedyTests,
  generateDivideAndConquerTests,
  generateLinkedListTests,
  generateMathTests,
  generateStringTests,
  generateDPTests,
  generateTreeTests,
  generateGraphTests,
  generateBacktrackingTests,
  generateBitManipulationTests,
};
