/**
 * Comprehensive CP Format Validation Script
 * 
 * Validates that:
 * 1. All database test cases are in valid CP format
 * 2. Dynamic test generation produces valid CP format
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';
import { generateDynamicTestInputs } from '../src/services/judge/dynamicTestGenerator.js';
import { validateCPFormat } from '../src/utils/cpInputFormat.js';

async function validateAllTestCases() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('         CP FORMAT VALIDATION - DATABASE & DYNAMIC TEST CASES          ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // ============ PART 1: Database Test Cases ============
  console.log('▶ PART 1: Validating Database Test Cases\n');
  
  const allTestCases = await TestCase.find({});
  console.log(`  Total test cases in DB: ${allTestCases.length}`);
  
  let dbValid = 0;
  let dbInvalid = 0;
  const invalidExamples = [];
  
  for (const tc of allTestCases) {
    const validation = validateCPFormat(tc.stdin);
    if (validation.valid) {
      dbValid++;
    } else {
      dbInvalid++;
      if (invalidExamples.length < 5) {
        const q = await Question.findById(tc.questionId);
        invalidExamples.push({
          question: q?.title || 'Unknown',
          error: validation.error,
          stdin: tc.stdin?.substring(0, 100),
          isHidden: tc.isHidden
        });
      }
    }
  }
  
  console.log(`  ✅ Valid CP format: ${dbValid}`);
  console.log(`  ❌ Invalid format: ${dbInvalid}`);
  
  if (invalidExamples.length > 0) {
    console.log('\n  Sample invalid test cases:');
    for (const ex of invalidExamples) {
      console.log(`    - [${ex.isHidden ? 'Hidden' : 'Visible'}] ${ex.question}`);
      console.log(`      Error: ${ex.error}`);
      console.log(`      stdin: ${ex.stdin}`);
    }
  }
  
  const dbPassRate = ((dbValid / allTestCases.length) * 100).toFixed(2);
  console.log(`\n  Database Pass Rate: ${dbPassRate}%\n`);

  // ============ PART 2: Dynamic Test Generation ============
  console.log('▶ PART 2: Validating Dynamic Test Generation\n');
  
  const questions = await Question.find({}).limit(30);
  let dynValid = 0;
  let dynInvalid = 0;
  let dynTotal = 0;
  
  for (const question of questions) {
    const testCases = await TestCase.find({ questionId: question._id }).limit(3);
    if (testCases.length === 0) continue;
    
    try {
      const seed = `validation-${question._id}-${Date.now()}`;
      const generated = generateDynamicTestInputs(question, testCases, seed, {
        edgeCount: 2,
        randomCount: 3,
        stressCount: 1
      });
      
      for (const tc of generated) {
        dynTotal++;
        const validation = validateCPFormat(tc.stdin);
        if (validation.valid) {
          dynValid++;
        } else {
          dynInvalid++;
        }
      }
    } catch (e) {
      // Generation failed
      dynInvalid++;
      dynTotal++;
    }
  }
  
  console.log(`  Total generated test cases: ${dynTotal}`);
  console.log(`  ✅ Valid CP format: ${dynValid}`);
  console.log(`  ❌ Invalid format: ${dynInvalid}`);
  
  const dynPassRate = dynTotal > 0 ? ((dynValid / dynTotal) * 100).toFixed(2) : '0.00';
  console.log(`\n  Dynamic Generation Pass Rate: ${dynPassRate}%\n`);

  // ============ SUMMARY ============
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                           VALIDATION SUMMARY                          ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`  📊 Database Test Cases:    ${dbPassRate}% pass rate (${dbValid}/${allTestCases.length})`);
  console.log(`  📊 Dynamic Test Cases:     ${dynPassRate}% pass rate (${dynValid}/${dynTotal})`);
  console.log('');
  
  const overallPass = parseFloat(dbPassRate) >= 95 && parseFloat(dynPassRate) >= 95;
  if (overallPass) {
    console.log('  ✅ VALIDATION PASSED - System is CP format compliant!\n');
  } else {
    console.log('  ⚠️  VALIDATION NEEDS ATTENTION - Some test cases need conversion\n');
  }

  await mongoose.disconnect();
}

validateAllTestCases().catch(console.error);
