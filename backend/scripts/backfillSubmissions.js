/**
 * Backfill Submissions with Denormalized Problem Data
 * ====================================================
 *
 * Updates existing submissions with problemCategory, problemDifficulty, problemTags
 * from the associated Question document.
 *
 * Usage: node scripts/backfillSubmissions.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

import Question from "../src/models/question/Question.js";
import Submission from "../src/models/profile/Submission.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

async function backfillSubmissions() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find submissions without denormalized data
    const submissionsToFix = await Submission.find({
      $or: [
        { problemCategory: null },
        { problemCategory: { $exists: false } },
        { problemDifficulty: null },
        { problemDifficulty: { $exists: false } },
        { problemTags: { $size: 0 } },
        { problemTags: { $exists: false } },
      ],
    })
      .select("_id questionId")
      .lean();

    console.log(
      `📊 Found ${submissionsToFix.length} submissions needing backfill\n`,
    );

    if (submissionsToFix.length === 0) {
      console.log("✅ All submissions already have denormalized data!");
      return;
    }

    // Build question ID -> data map for efficiency
    // Handle both ObjectId and string references
    const questionIds = [
      ...new Set(
        submissionsToFix.map((s) => s.questionId?.toString()).filter(Boolean),
      ),
    ];
    console.log(`📚 Fetching ${questionIds.length} unique questions...\n`);

    // Try to find by both _id and externalId
    const questions = await Question.find({
      $or: [
        {
          _id: {
            $in: questionIds
              .filter((id) => mongoose.Types.ObjectId.isValid(id))
              .map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
        { externalId: { $in: questionIds } },
      ],
    })
      .select("_id externalId topic tags difficulty")
      .lean();

    // Build map with both _id and externalId as keys
    const questionMap = new Map();
    questions.forEach((q) => {
      questionMap.set(q._id.toString(), q);
      if (q.externalId) {
        questionMap.set(q.externalId, q);
      }
    });

    // Update submissions in batches
    const BATCH_SIZE = 100;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < submissionsToFix.length; i += BATCH_SIZE) {
      const batch = submissionsToFix.slice(i, i + BATCH_SIZE);

      const bulkOps = batch
        .map((sub) => {
          const question = questionMap.get(sub.questionId?.toString());

          if (!question) {
            skipped++;
            return null;
          }

          return {
            updateOne: {
              filter: { _id: sub._id },
              update: {
                $set: {
                  problemCategory:
                    question.topic || question.tags?.[0] || "General",
                  problemDifficulty: question.difficulty,
                  problemTags: question.tags || [],
                },
              },
            },
          };
        })
        .filter(Boolean);

      if (bulkOps.length > 0) {
        const result = await Submission.bulkWrite(bulkOps);
        updated += result.modifiedCount;
      }

      console.log(
        `   Processed ${Math.min(i + BATCH_SIZE, submissionsToFix.length)}/${submissionsToFix.length}...`,
      );
    }

    console.log("\n" + "═".repeat(60));
    console.log("📊 BACKFILL SUMMARY:");
    console.log(`   ✅ Updated: ${updated} submissions`);
    console.log(`   ⏭️  Skipped: ${skipped} (question not found)`);
    console.log("═".repeat(60));

    // Verify
    const remaining = await Submission.countDocuments({
      $or: [{ problemCategory: null }, { problemDifficulty: null }],
    });

    if (remaining > 0) {
      console.log(
        `\n⚠️  Still ${remaining} submissions without data (orphaned questions?)`,
      );
    } else {
      console.log("\n✅ All submissions now have denormalized problem data!");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

backfillSubmissions();
