/**
 * Migration Script: Add company fields to existing questions
 * 
 * This script adds the primaryCompany and companies fields to all existing
 * questions in the database. Since company data is optional, existing questions
 * will have:
 *   - primaryCompany: null
 *   - companies: []
 * 
 * This ensures backward compatibility and the frontend will display "General"
 * for problems without company data.
 * 
 * Usage:
 *   node scripts/migrateCompanyFields.js
 * 
 * Note: This migration is safe to run multiple times (idempotent).
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

async function runMigration() {
  console.log("🚀 Starting company fields migration...\n");

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const questionsCollection = db.collection("questions");

    // Count questions that need migration
    const questionsWithoutCompanyFields = await questionsCollection.countDocuments({
      $or: [
        { primaryCompany: { $exists: false } },
        { companies: { $exists: false } },
      ],
    });

    console.log(`📊 Found ${questionsWithoutCompanyFields} questions without company fields\n`);

    if (questionsWithoutCompanyFields === 0) {
      console.log("✨ All questions already have company fields. No migration needed.\n");
      return;
    }

    // Update questions that don't have primaryCompany field
    const resultPrimary = await questionsCollection.updateMany(
      { primaryCompany: { $exists: false } },
      { $set: { primaryCompany: null } }
    );
    console.log(`✅ Added primaryCompany field to ${resultPrimary.modifiedCount} questions`);

    // Update questions that don't have companies field
    const resultCompanies = await questionsCollection.updateMany(
      { companies: { $exists: false } },
      { $set: { companies: [] } }
    );
    console.log(`✅ Added companies field to ${resultCompanies.modifiedCount} questions`);

    // Verify migration
    const remaining = await questionsCollection.countDocuments({
      $or: [
        { primaryCompany: { $exists: false } },
        { companies: { $exists: false } },
      ],
    });

    if (remaining === 0) {
      console.log("\n🎉 Migration completed successfully!");
      console.log("   All questions now have primaryCompany and companies fields.\n");
    } else {
      console.log(`\n⚠️  Warning: ${remaining} questions still missing company fields.\n`);
    }

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("📤 Disconnected from MongoDB");
  }
}

runMigration();
