/**
 * Backfill Question.categoryType
 * =============================
 *
 * Populates categoryType for existing questions using:
 * 1) Explicit title mappings (highest priority)
 * 2) Heuristics based on existing tags
 *
 * Usage: node scripts/backfillQuestionTypes.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

import Question from "../src/models/question/Question.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

const TITLE_TO_CATEGORY_TYPE = new Map([
  ["Ceiling of a Number", "Math"],
  ["Check if Array is Sorted (Divide and Conquer)", "Divide and Conquer"],
  ["Unique Numbers", "Hashing"],
  ["Kth Largest Element Check", "Sorting"],
  ["Task Assignment Feasibility", "Greedy"],
  ["Linked List Cycle Detection", "Linked List"],
]);

const TAG_TO_CATEGORY_TYPE = new Map([
  ["Hash Table", "Hashing"],
  ["Binary Search", "Searching"],
  ["Divide and Conquer", "Divide and Conquer"],
  ["Linked List", "Linked List"],
  ["Greedy", "Greedy"],
  ["Sorting", "Sorting"],
  ["Math", "Math"],
  ["Array", "Array"],
]);

const PRIORITY = [
  "Divide and Conquer",
  "Searching",
  "Sorting",
  "Greedy",
  "Linked List",
  "Hashing",
  "Math",
  "Array",
];

const CATEGORY_KEYWORDS = {
  "Divide and Conquer": [
    "divide and conquer",
    "merge sort",
    "quick sort",
    "recurrence",
    "subproblem",
  ],
  Searching: [
    "binary search",
    "search insert",
    "search",
    "find peak",
    "lower bound",
    "upper bound",
  ],
  Sorting: [
    "sort",
    "sorted",
    "kth largest",
    "k-th largest",
    "kth smallest",
    "order statistics",
    "merge",
    "heap",
    "priority queue",
  ],
  Greedy: [
    "greedy",
    "activity selection",
    "task assignment",
    "feasibility",
    "minimum number of",
    "maximum number of",
  ],
  "Linked List": [
    "linked list",
    "cycle detection",
    "singly linked",
    "reverse linked",
  ],
  Hashing: [
    "hash",
    "hash table",
    "hashmap",
    "hash map",
    "frequency",
    "unique numbers",
    "duplicates",
    "anagram",
  ],
  Math: [
    "math",
    "prime",
    "gcd",
    "lcm",
    "mod",
    "modulo",
    "ceiling",
    "floor",
    "sum of",
    "power",
  ],
  Array: [
    "array",
    "subarray",
    "matrix",
    "2d",
    "rotate",
    "prefix",
    "range",
  ],
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCategory(text, tags) {
  const scores = new Map();
  for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
    scores.set(cat, 0);
  }

  // Tags get higher weight
  const normalizedTags = Array.isArray(tags)
    ? tags.map((t) => normalizeText(t)).filter(Boolean)
    : [];

  for (const tag of normalizedTags) {
    for (const [tagKey, mapped] of TAG_TO_CATEGORY_TYPE.entries()) {
      if (tag === normalizeText(tagKey)) {
        scores.set(mapped, (scores.get(mapped) || 0) + 10);
      }
    }

    // Soft tag keyword matches
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const kw of kws) {
        if (tag.includes(normalizeText(kw))) {
          scores.set(cat, (scores.get(cat) || 0) + 4);
        }
      }
    }
  }

  // Title/description keyword matches
  const t = normalizeText(text);
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      const needle = normalizeText(kw);
      if (!needle) continue;
      if (t.includes(needle)) {
        scores.set(cat, (scores.get(cat) || 0) + (needle.length >= 10 ? 3 : 2));
      }
    }
  }

  // Pick best by score, then priority order
  const bestScore = Math.max(...Array.from(scores.values()));
  const bestCats = Array.from(scores.entries())
    .filter(([, s]) => s === bestScore)
    .map(([c]) => c);

  if (bestScore <= 0) return null;

  for (const p of PRIORITY) {
    if (bestCats.includes(p)) return p;
  }
  return bestCats[0] || null;
}

function inferCategoryType({ title, tags, description }) {
  if (title && TITLE_TO_CATEGORY_TYPE.has(title)) {
    return TITLE_TO_CATEGORY_TYPE.get(title);
  }

  const combinedText = `${title || ""} ${description || ""}`.trim();
  const scored = scoreCategory(combinedText, tags);
  return scored;
}

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  const questions = await Question.find({ isActive: true })
    .select("_id title description tags categoryType")
    .lean();

  console.log(`\n📊 Scanning ${questions.length} active questions...`);

  const ops = [];
  let alreadySet = 0;
  let updated = 0;
  const counts = {
    Math: 0,
    Array: 0,
    "Divide and Conquer": 0,
    Searching: 0,
    "Linked List": 0,
    Greedy: 0,
    Hashing: 0,
    Sorting: 0,
  };

  for (const q of questions) {
    const existing = String(q.categoryType || "").trim();
    const isUnset = !existing || existing.toLowerCase() === "unknown";
    if (!isUnset) {
      alreadySet++;
      if (counts[existing] !== undefined) counts[existing] += 1;
      continue;
    }

    const next =
      inferCategoryType({
        title: q.title,
        tags: q.tags,
        description: q.description,
      }) || "Array";

    if (counts[next] !== undefined) counts[next] += 1;
    updated++;
    ops.push({
      updateOne: {
        filter: { _id: q._id },
        update: { $set: { categoryType: next } },
      },
    });
  }

  if (ops.length > 0) {
    console.log(`\n✍️  Writing ${ops.length} updates...`);
    const result = await Question.bulkWrite(ops, { ordered: false });
    console.log("✅ Backfill complete");
    console.log(
      `   Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`,
    );
  } else {
    console.log("\nℹ️  No updates needed (all inferred values already set)");
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 CATEGORY TYPE BACKFILL SUMMARY:");
  console.log(`   ✅ Already set: ${alreadySet}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log("\n📈 Distribution (best-effort):");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`   - ${k}: ${v}`);
  }
  console.log("=".repeat(60));

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected from MongoDB");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
