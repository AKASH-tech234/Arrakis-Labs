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

async function verify() {
  await mongoose.connect(MONGODB_URI);

  const sample = await Question.findOne({ isActive: true }).lean();

  console.log("📊 Sample Question Fields:");
  console.log("   title:", sample.title);
  console.log("   topic:", sample.topic);
  console.log(
    "   expectedApproach:",
    (sample.expectedApproach || "").substring(0, 50) + "...",
  );
  console.log("   canonicalAlgorithms:", sample.canonicalAlgorithms);
  console.log("   timeComplexityHint:", sample.timeComplexityHint);
  console.log("   spaceComplexityHint:", sample.spaceComplexityHint);
  console.log("   commonMistakes:", sample.commonMistakes?.slice(0, 2));

  const withTopic = await Question.countDocuments({ topic: { $ne: null } });
  const withApproach = await Question.countDocuments({
    expectedApproach: { $ne: null },
  });
  const withAlgorithms = await Question.countDocuments({
    "canonicalAlgorithms.0": { $exists: true },
  });
  const total = await Question.countDocuments({ isActive: true });

  console.log("\n" + "═".repeat(50));
  console.log("📈 SCHEMA SYNC VERIFICATION:");
  console.log(`   Total active questions: ${total}`);
  console.log(`   With topic: ${withTopic}`);
  console.log(`   With expectedApproach: ${withApproach}`);
  console.log(`   With canonicalAlgorithms: ${withAlgorithms}`);
  console.log("═".repeat(50));

  if (
    withTopic === total &&
    withApproach === total &&
    withAlgorithms === total
  ) {
    console.log("\n✅ ALL FIELDS SYNCED SUCCESSFULLY!");
  } else {
    console.log("\n⚠️  Some questions still missing data");
  }

  await mongoose.disconnect();
}

verify();
