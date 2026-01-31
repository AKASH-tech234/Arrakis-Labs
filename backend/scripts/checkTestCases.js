import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';

async function checkTestCases() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Find test cases with JSON brackets
  const jsonBracketCases = await TestCase.find({
    $or: [
      { stdin: { $regex: '\\[' } },
      { stdin: { $regex: '\\{' } },
    ]
  }).limit(20);
  
  console.log('=== TEST CASES WITH JSON FORMAT ===');
  console.log('Found:', jsonBracketCases.length, 'test cases with brackets\n');
  
  for (const tc of jsonBracketCases) {
    const q = await Question.findById(tc.questionId);
    console.log('---');
    console.log('Question:', q?.title || 'Unknown');
    console.log('Hidden:', tc.isHidden);
    console.log('stdin:', tc.stdin?.substring(0, 300));
    console.log('');
  }

  // Get total counts
  const totalTestCases = await TestCase.countDocuments();
  const hiddenTestCases = await TestCase.countDocuments({ isHidden: true });
  const visibleTestCases = await TestCase.countDocuments({ isHidden: false });

  console.log('\n=== TEST CASE STATISTICS ===');
  console.log('Total test cases:', totalTestCases);
  console.log('Hidden test cases:', hiddenTestCases);
  console.log('Visible test cases:', visibleTestCases);

  // Sample hidden test cases
  console.log('\n=== SAMPLE HIDDEN TEST CASES ===');
  const hiddenSamples = await TestCase.find({ isHidden: true }).limit(10);
  for (const tc of hiddenSamples) {
    const q = await Question.findById(tc.questionId);
    console.log('---');
    console.log('Question:', q?.title || 'Unknown');
    console.log('stdin:', tc.stdin?.substring(0, 200));
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

checkTestCases().catch(console.error);
