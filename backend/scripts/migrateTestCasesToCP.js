/**
 * Migration Script: Convert JSON Test Cases to CP Format
 * 
 * This script finds all test cases with JSON-style input (brackets, braces)
 * and converts them to strict CP format.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';

/**
 * Convert JSON array to CP format
 */
function jsonArrayToCPFormat(arr) {
  if (!Array.isArray(arr)) return String(arr);
  
  // 2D array
  if (arr.length > 0 && Array.isArray(arr[0])) {
    const lines = [String(arr.length)];
    for (const row of arr) {
      lines.push(String(row.length));
      lines.push(row.map(v => v === null ? 'null' : String(v)).join(' '));
    }
    return lines.join('\n');
  }
  
  // 1D array
  return `${arr.length}\n${arr.map(v => v === null ? 'null' : String(v)).join(' ')}`;
}

/**
 * Convert binary tree JSON to CP format
 * JSON: {"val":1,"left":{"val":2},"right":{"val":3}}
 * CP format: level-order with nulls
 */
function treeJsonToCPFormat(treeStr) {
  try {
    const tree = JSON.parse(treeStr);
    if (!tree || typeof tree !== 'object') return treeStr;
    
    // Level-order traversal
    const result = [];
    const queue = [tree];
    
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === null) {
        result.push('null');
      } else {
        result.push(String(node.val));
        queue.push(node.left || null);
        queue.push(node.right || null);
      }
    }
    
    // Trim trailing nulls
    while (result.length > 0 && result[result.length - 1] === 'null') {
      result.pop();
    }
    
    return `${result.length}\n${result.join(' ')}`;
  } catch (e) {
    return treeStr;
  }
}

/**
 * Convert a stdin line from JSON to CP format
 */
function convertLineToCPFormat(line) {
  const trimmed = line.trim();
  
  // JSON array: [1,2,3] or [[1,2],[3,4]]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed);
      return jsonArrayToCPFormat(arr);
    } catch (e) {
      return trimmed;
    }
  }
  
  // JSON object (tree): {"val":1,...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return treeJsonToCPFormat(trimmed);
  }
  
  // Regex patterns with brackets - these are string inputs, keep as-is
  if (trimmed.includes('regex') || trimmed.includes('=')) {
    return trimmed;
  }
  
  // Parentheses strings like ()[]{}  - these are the actual input for bracket problems
  if (/^[\(\)\[\]\{\}]+$/.test(trimmed)) {
    return trimmed;
  }
  
  return trimmed;
}

/**
 * Convert full stdin from JSON to CP format
 */
function convertStdinToCPFormat(stdin) {
  if (!stdin) return stdin;
  
  const lines = stdin.split('\n');
  const result = [];
  
  for (const line of lines) {
    const converted = convertLineToCPFormat(line);
    // If conversion produced multiple lines, add them all
    if (converted.includes('\n')) {
      result.push(...converted.split('\n'));
    } else {
      result.push(converted);
    }
  }
  
  return result.join('\n');
}

/**
 * Check if stdin contains JSON format that can be safely converted
 */
function hasJsonFormat(stdin) {
  if (!stdin) return false;
  
  const lines = stdin.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    
    // JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      // But not if it's a regex character class like [abc]
      if (!trimmed.includes('regex') && !trimmed.includes('=')) {
        try {
          const parsed = JSON.parse(trimmed);
          // Only consider it JSON if it's a simple array (numbers or nested number arrays)
          if (Array.isArray(parsed) && isSimpleArray(parsed)) {
            return true;
          }
        } catch (e) {
          // Not valid JSON, might be regex
        }
      }
    }
    
    // JSON object - only handle tree objects with val/left/right
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Only convert tree structures
        if (parsed && typeof parsed === 'object' && 'val' in parsed) {
          return true;
        }
        // Skip complex objects like graphs, B-Trees, queries
      } catch (e) {
        // Not valid JSON
      }
    }
  }
  
  return false;
}

/**
 * Check if array contains only simple values (numbers, nulls, or nested simple arrays)
 */
function isSimpleArray(arr) {
  if (!Array.isArray(arr)) return false;
  
  for (const item of arr) {
    if (item === null) continue;
    if (typeof item === 'number') continue;
    if (typeof item === 'string' && !isNaN(Number(item))) continue;
    if (Array.isArray(item) && isSimpleArray(item)) continue;
    return false; // Contains objects or complex types
  }
  return true;
}

async function migrateTestCases() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Find all test cases with JSON format
  const allTestCases = await TestCase.find({});
  console.log('Total test cases:', allTestCases.length);
  
  const jsonTestCases = allTestCases.filter(tc => hasJsonFormat(tc.stdin));
  console.log('Test cases with JSON format:', jsonTestCases.length);
  
  if (jsonTestCases.length === 0) {
    console.log('\n✅ No JSON test cases found. All test cases are in CP format!');
    await mongoose.disconnect();
    return;
  }

  console.log('\n=== MIGRATING TEST CASES ===\n');
  
  let migratedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const tc of jsonTestCases) {
    const q = await Question.findById(tc.questionId);
    const questionTitle = q?.title || 'Unknown';
    
    console.log('---');
    console.log('Question:', questionTitle);
    console.log('Original stdin:');
    console.log(tc.stdin?.substring(0, 300));
    
    const converted = convertStdinToCPFormat(tc.stdin);
    
    // Check if conversion changed anything
    if (converted === tc.stdin) {
      console.log('⏭️  Skipped (no change needed or special format)');
      skippedCount++;
      continue;
    }
    
    console.log('\nConverted stdin:');
    console.log(converted.substring(0, 300));
    
    try {
      // Update in database
      await TestCase.findByIdAndUpdate(tc._id, { stdin: converted });
      console.log('✅ Migrated successfully');
      migratedCount++;
    } catch (e) {
      console.log('❌ Error:', e.message);
      errors.push({ question: questionTitle, error: e.message });
    }
    
    console.log('');
  }

  console.log('\n=== MIGRATION SUMMARY ===');
  console.log('Total JSON test cases:', jsonTestCases.length);
  console.log('Successfully migrated:', migratedCount);
  console.log('Skipped:', skippedCount);
  console.log('Errors:', errors.length);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.question}: ${e.error}`));
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

// Add --dry-run flag support
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
  
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const allTestCases = await TestCase.find({});
    const jsonTestCases = allTestCases.filter(tc => hasJsonFormat(tc.stdin));
    
    console.log('Test cases that would be migrated:', jsonTestCases.length);
    
    for (const tc of jsonTestCases) {
      const q = await Question.findById(tc.questionId);
      console.log('---');
      console.log('Question:', q?.title || 'Unknown');
      console.log('BEFORE:', tc.stdin?.substring(0, 200));
      console.log('AFTER:', convertStdinToCPFormat(tc.stdin).substring(0, 200));
    }
    
    await mongoose.disconnect();
  })();
} else {
  migrateTestCases().catch(console.error);
}
