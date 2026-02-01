import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

async function run() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const Question = mongoose.connection.collection('questions');

    const tagResult = await Question.aggregate([
      { $match: { isActive: true, tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\n=== ALL TAGS IN DATABASE ===');
    console.log(JSON.stringify(tagResult, null, 2));
    console.log('Total unique tags:', tagResult.length);

    const companyResult = await Question.aggregate([
      { $match: { isActive: true, companies: { $exists: true, $ne: [] } } },
      { $unwind: '$companies' },
      { $group: { _id: '$companies', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\n=== ALL COMPANIES IN DATABASE ===');
    console.log(JSON.stringify(companyResult, null, 2));
    console.log('Total unique companies:', companyResult.length);

    const primaryCompanyResult = await Question.aggregate([
      { $match: { isActive: true, primaryCompany: { $exists: true, $ne: null } } },
      { $group: { _id: '$primaryCompany', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\n=== PRIMARY COMPANIES IN DATABASE ===');
    console.log(JSON.stringify(primaryCompanyResult, null, 2));
    console.log('Total unique primary companies:', primaryCompanyResult.length);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
