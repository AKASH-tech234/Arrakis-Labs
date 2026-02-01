import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';

function jsonArrayToCPFormat(arr) {
  if (!Array.isArray(arr)) return String(arr);

  if (arr.length > 0 && Array.isArray(arr[0])) {
    const lines = [String(arr.length)];
    for (const row of arr) {
      lines.push(String(row.length));
      lines.push(row.map(v => v === null ? 'null' : String(v)).join(' '));
    }
    return lines.join('\n');
  }

  return `${arr.length}\n${arr.map(v => v === null ? 'null' : String(v)).join(' ')}`;
}

function treeJsonToCPFormat(treeStr) {
  try {
    const tree = JSON.parse(treeStr);
    if (!tree || typeof tree !== 'object') return treeStr;

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

    while (result.length > 0 && result[result.length - 1] === 'null') {
      result.pop();
    }

    return `${result.length}\n${result.join(' ')}`;
  } catch (e) {
    return treeStr;
  }
}

function convertLineToCPFormat(line) {
  const trimmed = line.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed);
      return jsonArrayToCPFormat(arr);
    } catch (e) {
      return trimmed;
    }
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return treeJsonToCPFormat(trimmed);
  }

  if (trimmed.includes('regex') || trimmed.includes('=')) {
    return trimmed;
  }

  if (/^[\(\)\[\]\{\}]+$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

function convertStdinToCPFormat(stdin) {
  if (!stdin) return stdin;

  const lines = stdin.split('\n');
  const result = [];

  for (const line of lines) {
    const converted = convertLineToCPFormat(line);

    if (converted.includes('\n')) {
      result.push(...converted.split('\n'));
    } else {
      result.push(converted);
    }
  }

  return result.join('\n');
}

function hasJsonFormat(stdin) {
  if (!stdin) return false;

  const lines = stdin.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {

      if (!trimmed.includes('regex') && !trimmed.includes('=')) {
        try {
          const parsed = JSON.parse(trimmed);

          if (Array.isArray(parsed) && isSimpleArray(parsed)) {
            return true;
          }
        } catch (e) {

        }
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);

        if (parsed && typeof parsed === 'object' && 'val' in parsed) {
          return true;
        }

      } catch (e) {

      }
    }
  }

  return false;
}

function isSimpleArray(arr) {
  if (!Array.isArray(arr)) return false;

  for (const item of arr) {
    if (item === null) continue;
    if (typeof item === 'number') continue;
    if (typeof item === 'string' && !isNaN(Number(item))) continue;
    if (Array.isArray(item) && isSimpleArray(item)) continue;
    return false;
  }
  return true;
}

async function migrateTestCases() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

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

    if (converted === tc.stdin) {
      console.log('⏭️  Skipped (no change needed or special format)');
      skippedCount++;
      continue;
    }

    console.log('\nConverted stdin:');
    console.log(converted.substring(0, 300));

    try {

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
