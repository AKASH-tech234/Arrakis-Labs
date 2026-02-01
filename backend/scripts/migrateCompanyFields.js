import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

async function runMigration() {
  console.log("🚀 Starting company fields migration...\n");

  try {

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const questionsCollection = db.collection("questions");

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

    const resultPrimary = await questionsCollection.updateMany(
      { primaryCompany: { $exists: false } },
      { $set: { primaryCompany: null } }
    );
    console.log(`✅ Added primaryCompany field to ${resultPrimary.modifiedCount} questions`);

    const resultCompanies = await questionsCollection.updateMany(
      { companies: { $exists: false } },
      { $set: { companies: [] } }
    );
    console.log(`✅ Added companies field to ${resultCompanies.modifiedCount} questions`);

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
