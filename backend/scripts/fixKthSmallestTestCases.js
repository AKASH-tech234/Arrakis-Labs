/**
 * Fix test cases for K-th Smallest in Merged Arrays
 * 
 * CORRECT CP FORMAT:
 * k              <- k-th smallest to find
 * n              <- number of arrays
 * len1           <- length of array 1
 * arr1_elements  <- space-separated elements
 * len2           <- length of array 2
 * arr2_elements  <- space-separated elements
 * ...
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';

async function fixKthSmallestTestCases() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const question = await Question.findOne({ title: /K-th Smallest in Merged/i });
  if (!question) {
    console.log('Question not found!');
    await mongoose.disconnect();
    return;
  }

  console.log('Question:', question.title);
  console.log('Slug:', question.slug);

  // Delete old test cases
  await TestCase.deleteMany({ questionId: question._id });
  console.log('Deleted old test cases\n');

  // Create new test cases in correct CP format
  const testCases = [
    // Visible test cases
    {
      questionId: question._id,
      stdin: `4\n2\n3\n1 3 5\n3\n2 4 6`,
      expectedStdout: '4',
      isHidden: false,
      label: 'Example 1: k=4, two sorted arrays',
      order: 1
    },
    {
      questionId: question._id,
      stdin: `5\n3\n2\n1 2\n2\n3 4\n2\n5 6`,
      expectedStdout: '5',
      isHidden: false,
      label: 'Example 2: k=5, three arrays',
      order: 2
    },
    // Hidden test cases
    {
      questionId: question._id,
      stdin: `3\n3\n2\n10 20\n2\n1 5\n2\n15 25`,
      expectedStdout: '10',
      isHidden: true,
      label: 'Unsorted merged result',
      order: 3
    },
    {
      questionId: question._id,
      stdin: `5\n3\n3\n1 1 1\n3\n2 2 2\n3\n3 3 3`,
      expectedStdout: '2',
      isHidden: true,
      label: 'Duplicate elements',
      order: 4
    },
    {
      questionId: question._id,
      stdin: `1\n3\n0\n\n0\n\n0\n`,
      expectedStdout: '-1',
      isHidden: true,
      label: 'All empty arrays',
      order: 5
    },
    {
      questionId: question._id,
      stdin: `1\n1\n1\n1`,
      expectedStdout: '1',
      isHidden: true,
      label: 'Single element',
      order: 6
    },
    {
      questionId: question._id,
      stdin: `6\n2\n3\n5 8 9\n3\n1 2 3`,
      expectedStdout: '9',
      isHidden: true,
      label: 'k equals total elements',
      order: 7
    },
    {
      questionId: question._id,
      stdin: `10\n2\n3\n1 2 3\n3\n4 5 6`,
      expectedStdout: '-1',
      isHidden: true,
      label: 'k larger than total',
      order: 8
    },
    {
      questionId: question._id,
      stdin: `1\n2\n5\n-10 -5 0 5 10\n5\n-8 -3 2 7 12`,
      expectedStdout: '-10',
      isHidden: true,
      label: 'Negative numbers',
      order: 9
    },
    {
      questionId: question._id,
      stdin: `7\n4\n3\n1 4 7\n3\n2 5 8\n3\n3 6 9\n3\n0 10 20`,
      expectedStdout: '6',
      isHidden: true,
      label: 'Four arrays',
      order: 10
    }
  ];

  // Insert new test cases
  await TestCase.insertMany(testCases);
  console.log(`Created ${testCases.length} test cases in correct CP format\n`);

  // Verify
  const newTestCases = await TestCase.find({ questionId: question._id });
  console.log('New test cases:');
  for (const tc of newTestCases) {
    console.log('---');
    console.log('Hidden:', tc.isHidden);
    console.log('stdin:');
    console.log(tc.stdin);
    console.log('expected:', tc.expectedStdout);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

fixKthSmallestTestCases().catch(console.error);
