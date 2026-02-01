import 'dotenv/config';
import mongoose from 'mongoose';
import TestCase from '../src/models/question/TestCase.js';
import Question from '../src/models/question/Question.js';

async function fixTaskAssignmentTestCases() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const question = await Question.findOne({ title: /Task Assignment Feasibility/i });
  if (!question) {
    console.log('Question not found!');
    await mongoose.disconnect();
    return;
  }

  console.log('Question:', question.title);
  console.log('Slug:', question.slug);

  await TestCase.deleteMany({ questionId: question._id });
  console.log('Deleted old test cases\n');

  const testCases = [

    {
      questionId: question._id,
      stdin: `3 2
T1 T2 T3
W1 W2
2 2
T1 T2
2 2
T2 T3`,
      expectedStdout: '1',
      isHidden: false,
      label: 'Example 1: All tasks assignable',
      order: 1
    },

    {
      questionId: question._id,
      stdin: `4 2
T1 T2 T3 T4
W1 W2
2 2
T1 T2
2 1
T3 T4`,
      expectedStdout: '0',
      isHidden: false,
      label: 'Example 2: Capacity insufficient',
      order: 2
    },

    {
      questionId: question._id,
      stdin: `5 3
A B C D E
X Y Z
3 2
A B C
3 2
B C D
2 2
D E`,
      expectedStdout: '1',
      isHidden: true,
      label: 'Five tasks, three workers',
      order: 3
    },

    {
      questionId: question._id,
      stdin: `4 2
P Q R S
M N
2 1
P Q
2 1
R S`,
      expectedStdout: '0',
      isHidden: true,
      label: 'Capacity 1 each, need 2',
      order: 4
    },

    {
      questionId: question._id,
      stdin: `2 1
Task1 Task2
WorkerA
2 2
Task1 Task2`,
      expectedStdout: '1',
      isHidden: true,
      label: 'Single worker handles all',
      order: 5
    },

    {
      questionId: question._id,
      stdin: `3 2
A B C
W1 W2
1 1
A
1 1
B`,
      expectedStdout: '0',
      isHidden: true,
      label: 'Task C cannot be assigned',
      order: 6
    },

    {
      questionId: question._id,
      stdin: `4 2
T1 T2 T3 T4
W1 W2
4 2
T1 T2 T3 T4
4 2
T1 T2 T3 T4`,
      expectedStdout: '1',
      isHidden: true,
      label: 'Exact capacity, all overlap',
      order: 7
    },

    {
      questionId: question._id,
      stdin: `6 3
T1 T2 T3 T4 T5 T6
W1 W2 W3
2 2
T1 T2
2 2
T3 T4
2 2
T5 T6`,
      expectedStdout: '1',
      isHidden: true,
      label: 'Disjoint assignment',
      order: 8
    }
  ];

  await TestCase.insertMany(testCases);
  console.log(`Created ${testCases.length} test cases in correct CP format\n`);

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

fixTaskAssignmentTestCases().catch(console.error);
