/**
 * Test script to verify dynamic test generation produces valid CP format
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';
import { generateDynamicTestInputs } from '../src/services/judge/dynamicTestGenerator.js';
import { validateCPFormat } from '../src/utils/cpInputFormat.js';

async function testDynamicGeneration() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Get a sample of questions with test cases
  const questions = await Question.find({}).limit(20);
  
  console.log('=== TESTING DYNAMIC TEST GENERATION ===\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const question of questions) {
    console.log(`\n--- Question: ${question.title} ---`);
    
    // Get existing test cases for this question
    const testCases = await TestCase.find({ questionId: question._id }).limit(3);
    
    if (testCases.length === 0) {
      console.log('  No test cases found, skipping');
      continue;
    }
    
    console.log(`  Existing test cases: ${testCases.length}`);
    
    // Generate dynamic test inputs
    const seed = `test-${question._id}-${Date.now()}`;
    try {
      const generated = generateDynamicTestInputs(question, testCases, seed, {
        edgeCount: 2,
        randomCount: 3,
        stressCount: 1
      });
      
      console.log(`  Generated test cases: ${generated.length}`);
      
      // Validate each generated test case is in CP format
      for (let i = 0; i < generated.length; i++) {
        const tc = generated[i];
        const validation = validateCPFormat(tc.stdin);
        
        if (validation.valid) {
          console.log(`  ✅ TC ${i + 1} (${tc.label}): Valid CP format`);
          passed++;
        } else {
          console.log(`  ❌ TC ${i + 1} (${tc.label}): ${validation.error}`);
          console.log(`     stdin: ${tc.stdin?.substring(0, 100)}`);
          failed++;
        }
      }
    } catch (e) {
      console.log(`  ❌ Error generating: ${e.message}`);
      failed++;
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  await mongoose.disconnect();
  console.log('\nDone!');
}

testDynamicGeneration().catch(console.error);
