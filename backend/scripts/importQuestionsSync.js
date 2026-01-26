/**
 * Import/Update Questions with AI-Required Fields
 * ================================================
 *
 * This script reads the filled questions_to_fill.json and updates MongoDB.
 *
 * Usage: node scripts/importQuestionsSync.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../.env") });

// Import models
import Question from "../src/models/question/Question.js";
import Submission from "../src/models/profile/Submission.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

async function importQuestionData() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Read the filled data file
    const inputPath = join(__dirname, "../docs/questions_to_fill.json");

    if (!fs.existsSync(inputPath)) {
      console.error("❌ File not found: docs/questions_to_fill.json");
      console.error(
        "   Run exportQuestionsForSync.js first, fill the data, then run this script.",
      );
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
    const questions = data.questions;

    console.log(`\n📊 Processing ${questions.length} questions...\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const q of questions) {
      try {
        const { questionId, toFill } = q;

        // Skip if all values are still "FILL_ME"
        const allEmpty = Object.values(toFill).every(
          (v) => v === "FILL_ME" || (Array.isArray(v) && v[0] === "FILL_ME"),
        );

        if (allEmpty) {
          console.log(`⏭️  Skipping ${q.title} (no data filled)`);
          skipped++;
          continue;
        }

        // Build update object (only non-FILL_ME values)
        const updateFields = {};

        if (toFill.categoryType && toFill.categoryType !== "FILL_ME") {
          updateFields.categoryType = toFill.categoryType;
        }
        if (toFill.topic && toFill.topic !== "FILL_ME") {
          updateFields.topic = toFill.topic;
        }
        if (toFill.expectedApproach && toFill.expectedApproach !== "FILL_ME") {
          updateFields.expectedApproach = toFill.expectedApproach;
        }
        if (
          toFill.commonMistakes &&
          !toFill.commonMistakes.includes("FILL_ME")
        ) {
          updateFields.commonMistakes = toFill.commonMistakes;
        }
        if (
          toFill.timeComplexityHint &&
          toFill.timeComplexityHint !== "FILL_ME"
        ) {
          updateFields.timeComplexityHint = toFill.timeComplexityHint;
        }
        if (
          toFill.spaceComplexityHint &&
          toFill.spaceComplexityHint !== "FILL_ME"
        ) {
          updateFields.spaceComplexityHint = toFill.spaceComplexityHint;
        }
        if (
          toFill.canonicalAlgorithms &&
          !toFill.canonicalAlgorithms.includes("FILL_ME")
        ) {
          updateFields.canonicalAlgorithms = toFill.canonicalAlgorithms;
        }

        if (Object.keys(updateFields).length === 0) {
          console.log(`⏭️  Skipping ${q.title} (no valid data)`);
          skipped++;
          continue;
        }

        // Update the question
        const result = await Question.findByIdAndUpdate(
          questionId,
          { $set: updateFields },
          { new: true },
        );

        if (result) {
          console.log(`✅ Updated: ${q.title}`);
          console.log(`   Fields: ${Object.keys(updateFields).join(", ")}`);
          updated++;
        } else {
          console.log(`⚠️  Not found: ${q.title} (ID: ${questionId})`);
          errors++;
        }
      } catch (err) {
        console.error(`❌ Error updating ${q.title}: ${err.message}`);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 QUESTION UPDATE SUMMARY:");
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log("=".repeat(60));

    // Step 2: Backfill Submissions with denormalized problem data
    console.log("\n🔄 Backfilling Submissions with problem data...\n");

    const submissions = await Submission.find({
      $or: [
        { problemCategory: null },
        { problemDifficulty: null },
        { problemTags: { $size: 0 } },
      ],
    }).limit(1000);

    console.log(`   Found ${submissions.length} submissions needing backfill`);

    let submissionUpdates = 0;
    for (const sub of submissions) {
      try {
        const question = await Question.findById(sub.questionId).lean();
        if (question) {
          await Submission.findByIdAndUpdate(sub._id, {
            $set: {
              problemCategory:
                question.categoryType || question.topic || question.tags?.[0] || "General",
              problemDifficulty: question.difficulty,
              problemTags: question.tags || [],
            },
          });
          submissionUpdates++;
        }
      } catch (err) {
        // Silently skip
      }
    }

    console.log(`   ✅ Backfilled ${submissionUpdates} submissions`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

importQuestionData();
