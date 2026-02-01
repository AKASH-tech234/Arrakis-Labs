import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

function inferCategoryFromTitle(title) {
  const t = (title || "").toLowerCase();

  if (t.includes("array") || t.includes("sorted")) return "Arrays";
  if (t.includes("linked list") || t.includes("cycle detection")) return "Linked Lists";
  if (t.includes("tree") || t.includes("binary tree") || t.includes("bst")) return "Trees";
  if (t.includes("graph") || t.includes("path")) return "Graphs";
  if (t.includes("dynamic") || t.includes(" dp ")) return "Dynamic Programming";
  if (t.includes("string") || t.includes("substring") || t.includes("palindrome")) return "Strings";
  if (t.includes("hash") || t.includes("unique")) return "Hash Tables";
  if (t.includes("stack") || t.includes("queue")) return "Stacks & Queues";
  if (t.includes("divide") || t.includes("conquer")) return "Divide and Conquer";
  if (t.includes("math") || t.includes("number") || t.includes("ceiling") || t.includes("floor")) return "Math";
  if (t.includes("binary search") || t.includes("search")) return "Binary Search";
  if (t.includes("greedy") || t.includes("task") || t.includes("assignment") || t.includes("schedule")) return "Greedy";
  if (t.includes("backtrack")) return "Backtracking";
  if (t.includes("bit")) return "Bit Manipulation";
  if (t.includes("heap") || t.includes("largest") || t.includes("smallest") || t.includes("kth")) return "Heaps";
  if (t.includes("two pointer") || t.includes("sliding")) return "Two Pointers";
  if (t.includes("recursion") || t.includes("recursive")) return "Recursion";

  return "General";
}

async function runMigration() {
  console.log("🚀 Starting categoryType migration...\n");

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const questionsCollection = db.collection("questions");

    const questionsToUpdate = await questionsCollection.find({
      $or: [
        { categoryType: null },
        { categoryType: { $exists: false } }
      ]
    }).toArray();

    console.log(`📊 Found ${questionsToUpdate.length} questions with null categoryType\n`);

    if (questionsToUpdate.length === 0) {
      console.log("✨ All questions already have categoryType. No migration needed.\n");
      return;
    }

    let updated = 0;
    for (const q of questionsToUpdate) {
      const category = inferCategoryFromTitle(q.title);

      await questionsCollection.updateOne(
        { _id: q._id },
        { $set: { categoryType: category } }
      );

      console.log(`  ✅ "${q.title}" → ${category}`);
      updated++;
    }

    console.log(`\n🎉 Migration complete! Updated ${updated} questions.\n`);

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("📤 Disconnected from MongoDB");
  }
}

runMigration();
