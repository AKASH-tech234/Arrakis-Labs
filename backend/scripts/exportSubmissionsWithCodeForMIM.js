/**
 * Export Submissions WITH CODE for MIM DatasetBuilder (Phase 1.3)
 * ==============================================================
 *
 * This script is the canonical source export for the AI services MIM training pipeline.
 *
 * Output JSON is intentionally shaped to satisfy DatasetBuilder's expectations:
 * - Includes a required code field (`code`)
 * - Includes verdict (`verdict`)
 * - Includes timestamps (`timestamp`)
 * - Includes question identifiers (`questionId`)
 * - Includes user identifier (`userId`)
 * - Includes denormalized problem fields if available (category/tags/difficulty)
 *
 * Guarantees:
 * - Deterministic export order (sorted by createdAt ascending)
 * - No transformations to code text
 *
 * Usage:
 *   node backend/scripts/exportSubmissionsWithCodeForMIM.js --out ./tmp_submissions_with_code.json
 *
 * Requires env:
 *   MONGODB_URI
 *   MONGODB_DB_NAME (optional)
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Submission from "../src/models/profile/Submission.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const limitIdx = args.indexOf("--limit");
  return {
    out: outIdx >= 0 ? args[outIdx + 1] : "./submissions_with_code_for_mim.json",
    limit: limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0,
  };
}

async function main() {
  const { out, limit } = parseArgs();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI env var is required");
  }

  const dbName = process.env.MONGODB_DB_NAME;

  await mongoose.connect(uri, {
    dbName: dbName || undefined,
  });

  const query = {};
  let q = Submission.find(query)
    .sort({ createdAt: 1 })
    .select(
      "userId questionId code language status passedCount totalCount totalExecutionTime maxMemoryUsed compileError isRun timeSpent hintsUsed attemptNumber problemCategory problemDifficulty problemTags createdAt"
    );

  if (limit && limit > 0) q = q.limit(limit);

  const docs = await q.lean();

  // Canonical export mapping
  const exported = docs.map((d) => ({
    _id: String(d._id),
    submission_id: String(d._id),
    userId: String(d.userId),
    questionId: String(d.questionId),
    verdict: d.status, // DatasetBuilder expects `verdict`
    code: d.code,
    language: d.language,
    timestamp: d.createdAt ? new Date(d.createdAt).toISOString() : null,

    // Optional context
    category: d.problemCategory ?? null,
    difficulty: d.problemDifficulty ?? null,
    tags: Array.isArray(d.problemTags) ? d.problemTags : [],

    // Optional execution
    execution_time_ms: d.totalExecutionTime ?? null,
    memory_used_kb: d.maxMemoryUsed ?? null,
    compile_error: d.compileError ?? null,

    // Optional behavioral
    timeSpent: d.timeSpent ?? null,
    hintsUsed: d.hintsUsed ?? 0,
    attemptNumber: d.attemptNumber ?? 1,
  }));

  const outPath = path.resolve(out);
  fs.writeFileSync(outPath, JSON.stringify(exported, null, 2));

  // Basic export integrity check
  const codePresent = exported.filter((x) => typeof x.code === "string" && x.code.trim().length > 0).length;
  const rate = exported.length ? codePresent / exported.length : 0;
  // eslint-disable-next-line no-console
  console.log(
    `Exported ${exported.length} submissions to ${outPath}. code_present_rate=${rate.toFixed(3)} (${codePresent}/${exported.length})`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
