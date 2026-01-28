/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MIGRATION SCRIPT: Generate slugs for all existing questions
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This script ensures ALL questions in the database have a properly formatted slug.
 * The slug is critical for hidden test case generation - without it, problems
 * won't match registered generators in problemConfigRegistry.js
 * 
 * RUN: node scripts/migrateQuestionSlugs.js
 * 
 * WHAT IT DOES:
 * 1. Finds all questions without a slug (or with empty slug)
 * 2. Generates slug from title: lowercase, trim, replace spaces with hyphens
 * 3. Saves the slug back to the database
 * 4. Reports which problems were updated
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Slug generation function (same as in Question.js)
function generateSlug(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // Remove special chars (keep letters, numbers, spaces, hyphens)
    .replace(/\s+/g, "-")          // Replace spaces with hyphens
    .replace(/-+/g, "-")           // Collapse multiple hyphens
    .replace(/^-|-$/g, "");        // Trim leading/trailing hyphens
}

async function migrateQuestionSlugs() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  MIGRATION: Generate slugs for all questions");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI or MONGODB_URI not found in environment variables");
    }

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get the Question collection directly (to avoid model conflicts)
    const db = mongoose.connection.db;
    const questionsCollection = db.collection("questions");

    // Find all questions
    const allQuestions = await questionsCollection.find({}).toArray();
    console.log(`📊 Found ${allQuestions.length} total questions\n`);

    // Find questions without slugs
    const questionsWithoutSlugs = allQuestions.filter(q => !q.slug || q.slug.trim() === "");
    console.log(`⚠️  ${questionsWithoutSlugs.length} questions need slug generation\n`);

    if (questionsWithoutSlugs.length === 0) {
      console.log("✅ All questions already have slugs. Nothing to migrate.\n");
      await mongoose.disconnect();
      return;
    }

    // Process each question
    console.log("Processing questions:\n");
    let successCount = 0;
    let errorCount = 0;

    for (const question of questionsWithoutSlugs) {
      const title = question.title || "";
      const newSlug = generateSlug(title);

      if (!newSlug) {
        console.log(`  ❌ ${question._id}: Cannot generate slug from empty title`);
        errorCount++;
        continue;
      }

      try {
        await questionsCollection.updateOne(
          { _id: question._id },
          { $set: { slug: newSlug } }
        );
        console.log(`  ✅ "${title}" → "${newSlug}"`);
        successCount++;
      } catch (err) {
        console.log(`  ❌ "${title}": ${err.message}`);
        errorCount++;
      }
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("  MIGRATION COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`  ✅ Updated: ${successCount}`);
    console.log(`  ❌ Errors:  ${errorCount}`);
    console.log(`  📊 Total:   ${allQuestions.length}`);
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Show all slugs for verification
    console.log("All question slugs after migration:\n");
    const updatedQuestions = await questionsCollection.find({}).toArray();
    updatedQuestions.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.slug || "(no slug)"} ← "${q.title}"`);
    });

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the migration
migrateQuestionSlugs();
