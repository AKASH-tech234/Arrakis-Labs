/**
 * Export Questions for Schema Sync
 * =================================
 *
 * Run this script to get a list of all questions with their current data.
 * Output will be in JSON format for easy editing.
 *
 * Usage: node scripts/exportQuestionsForSync.js
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

// Import Question model
import Question from "../src/models/question/Question.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

async function exportQuestions() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Fetch all questions
    const questions = await Question.find({ isActive: true })
      .select({
        _id: 1,
        title: 1,
        difficulty: 1,
        constraints: 1,
        tags: 1,
        topic: 1,
        expectedApproach: 1,
        commonMistakes: 1,
        timeComplexityHint: 1,
        spaceComplexityHint: 1,
        canonicalAlgorithms: 1,
      })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`\n📊 Found ${questions.length} questions\n`);

    // Create export format
    const exportData = questions.map((q, index) => ({
      index: index + 1,
      questionId: q._id.toString(),
      title: q.title,
      difficulty: q.difficulty,
      constraints: q.constraints || "",

      // Current values (may be empty)
      currentData: {
        tags: q.tags || [],
        topic: q.topic || null,
        expectedApproach: q.expectedApproach || null,
        commonMistakes: q.commonMistakes || [],
        timeComplexityHint: q.timeComplexityHint || null,
        spaceComplexityHint: q.spaceComplexityHint || null,
        canonicalAlgorithms: q.canonicalAlgorithms || [],
      },

      // Fields to fill (copy and edit these)
      toFill: {
        topic: q.topic || "FILL_ME",
        expectedApproach: q.expectedApproach || "FILL_ME",
        commonMistakes:
          q.commonMistakes?.length > 0 ? q.commonMistakes : ["FILL_ME"],
        timeComplexityHint: q.timeComplexityHint || "FILL_ME",
        spaceComplexityHint: q.spaceComplexityHint || "FILL_ME",
        canonicalAlgorithms:
          q.canonicalAlgorithms?.length > 0
            ? q.canonicalAlgorithms
            : ["FILL_ME"],
      },
    }));

    // Calculate stats
    const stats = {
      totalQuestions: questions.length,
      withTopic: questions.filter((q) => q.topic).length,
      withExpectedApproach: questions.filter((q) => q.expectedApproach).length,
      withCommonMistakes: questions.filter((q) => q.commonMistakes?.length > 0)
        .length,
      withTimeComplexity: questions.filter((q) => q.timeComplexityHint).length,
      withSpaceComplexity: questions.filter((q) => q.spaceComplexityHint)
        .length,
      withCanonicalAlgorithms: questions.filter(
        (q) => q.canonicalAlgorithms?.length > 0,
      ).length,
    };

    console.log("📈 Current Data Coverage:");
    console.log(`   - topic: ${stats.withTopic}/${stats.totalQuestions}`);
    console.log(
      `   - expectedApproach: ${stats.withExpectedApproach}/${stats.totalQuestions}`,
    );
    console.log(
      `   - commonMistakes: ${stats.withCommonMistakes}/${stats.totalQuestions}`,
    );
    console.log(
      `   - timeComplexityHint: ${stats.withTimeComplexity}/${stats.totalQuestions}`,
    );
    console.log(
      `   - spaceComplexityHint: ${stats.withSpaceComplexity}/${stats.totalQuestions}`,
    );
    console.log(
      `   - canonicalAlgorithms: ${stats.withCanonicalAlgorithms}/${stats.totalQuestions}`,
    );

    // Write to file
    const outputPath = join(__dirname, "../docs/questions_to_fill.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify({ stats, questions: exportData }, null, 2),
    );

    console.log(`\n✅ Exported to: ${outputPath}`);
    console.log("\n📝 Instructions:");
    console.log("   1. Open docs/questions_to_fill.json");
    console.log("   2. Fill in the 'toFill' section for each question");
    console.log("   3. Replace 'FILL_ME' with actual values");
    console.log("   4. Run the import script when done");

    // Also print a quick summary to console
    console.log("\n" + "=".repeat(80));
    console.log("QUESTIONS NEEDING DATA:");
    console.log("=".repeat(80));

    exportData.forEach((q) => {
      const missing = [];
      if (q.toFill.topic === "FILL_ME") missing.push("topic");
      if (q.toFill.expectedApproach === "FILL_ME")
        missing.push("expectedApproach");
      if (q.toFill.commonMistakes[0] === "FILL_ME")
        missing.push("commonMistakes");
      if (q.toFill.timeComplexityHint === "FILL_ME")
        missing.push("timeComplexity");
      if (q.toFill.spaceComplexityHint === "FILL_ME")
        missing.push("spaceComplexity");
      if (q.toFill.canonicalAlgorithms[0] === "FILL_ME")
        missing.push("canonicalAlgorithms");

      if (missing.length > 0) {
        console.log(`\n${q.index}. ${q.title} (${q.difficulty})`);
        console.log(`   ID: ${q.questionId}`);
        console.log(`   Missing: ${missing.join(", ")}`);
      }
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

exportQuestions();
