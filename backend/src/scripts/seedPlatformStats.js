

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import PlatformStats from "../models/profile/PlatformStats.js";
import PlatformProfile from "../models/profile/PlatformProfile.js";
import User from "../models/auth/User.js";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const userIdArg = args.find((a) => a.startsWith("--user="))?.split("=")[1];

function generateSampleStats(platform, options = {}) {
  const {
    totalSolved = 0,
    totalAttempted = 0,
    currentRating = null,
    highestRating = null,
    contestsParticipated = 0,
  } = options;

  return {
    totalSolved,
    totalAttempted,
    last30DaysSolved: 0,
    avgSolvedPerDay: 0,
    contestsParticipated,
    currentRating,
    highestRating,
    difficulty: {
      easy: { solved: 0, attempted: 0 },
      medium: { solved: 0, attempted: 0 },
      hard: { solved: 0, attempted: 0 },
    },
    skills: new Map(),
    daily: [],
    dataSource: "internal",
    lastSyncedAt: new Date(),
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("PlatformStats Seed Script");
  console.log("=".repeat(60));
  
  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be written to DB\n");
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not found in environment");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }

  const query = userIdArg ? { userId: userIdArg } : {};
  const profiles = await PlatformProfile.find(query).lean();

  console.log(`Found ${profiles.length} PlatformProfile(s) to check\n`);

  let created = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const existing = await PlatformStats.findOne({
      userId: profile.userId,
      platform: profile.platform,
    }).lean();

    if (existing && existing.totalSolved > 0) {
      console.log(`⏭️  Skipping ${profile.platform} for user ${profile.userId} - stats already exist with data`);
      skipped++;
      continue;
    }

    const stats = generateSampleStats(profile.platform);

    console.log(`📝 ${existing ? "Updating" : "Creating"} ${profile.platform} stats for user ${profile.userId}`);

    if (!isDryRun) {
      await PlatformStats.findOneAndUpdate(
        { userId: profile.userId, platform: profile.platform },
        { $set: stats },
        { upsert: true }
      );
    }

    created++;
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Created/Updated: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log("=".repeat(60));

  if (isDryRun) {
    console.log("\n⚠️  This was a dry run. No changes were made.");
    console.log("   Run without --dry-run to apply changes.");
  }

  await mongoose.disconnect();
  console.log("\n✅ Done");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
