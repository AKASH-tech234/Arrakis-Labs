# Schema Sync Requirements - Backend vs AI-Services

## Analysis Date: January 26, 2026

---

## 1. PROBLEM/QUESTION SCHEMA COMPARISON

### Backend (Question.js) - CURRENT FIELDS:

| Field               | Type     | Status        |
| ------------------- | -------- | ------------- |
| title               | String   | ✅ Has        |
| description         | String   | ✅ Has        |
| difficulty          | Enum     | ✅ Has        |
| constraints         | String   | ✅ Has        |
| tags                | [String] | ✅ Has        |
| topic               | String   | ✅ Has        |
| expectedApproach    | String   | ✅ Has        |
| commonMistakes      | [String] | ✅ Has        |
| timeComplexityHint  | String   | ✅ Has        |
| spaceComplexityHint | String   | ✅ Has        |
| canonicalAlgorithms | [String] | ✅ Has (v3.2) |

### AI-Services (ProblemContext) - REQUIRED FIELDS:

| Field                 | Type      | Source Field        |
| --------------------- | --------- | ------------------- |
| problem_id            | String    | \_id                |
| title                 | String    | title               |
| statement             | String    | description         |
| constraints           | String    | constraints         |
| tags                  | List[str] | tags                |
| difficulty            | String    | difficulty          |
| expected_approach     | String    | expectedApproach    |
| time_complexity_hint  | String    | timeComplexityHint  |
| space_complexity_hint | String    | spaceComplexityHint |
| common_mistakes       | List[str] | commonMistakes      |
| canonical_algorithms  | List[str] | canonicalAlgorithms |

### ❌ MISSING DATA TO FILL FOR EACH QUESTION:

Please provide the following for **EACH** question in your database:

---

## QUESTION DATA REQUIREMENTS

For each question, I need:

```json
{
  "questionId": "<MongoDB ObjectId>",
  "title": "<problem title>",

  // REQUIRED - Fill these:
  "topic": "<Primary topic: Arrays, Strings, DP, Graphs, Trees, etc.>",
  "expectedApproach": "<Algorithm approach like: Two Pointers, Binary Search, BFS/DFS, etc.>",
  "commonMistakes": ["<mistake 1>", "<mistake 2>"],
  "timeComplexityHint": "<O(n), O(n log n), O(n²), etc.>",
  "spaceComplexityHint": "<O(1), O(n), etc.>",
  "canonicalAlgorithms": ["<algorithm_key_1>", "<algorithm_key_2>"]
}
```

### Valid Values for `canonicalAlgorithms`:

```
- hash_map
- two_pointers
- sliding_window
- binary_search
- bfs_dfs
- dijkstra
- bellman_ford
- floyd_warshall
- union_find
- kruskal_prim
- topological_sort
- max_flow
- bipartite_matching
- dp_1d
- dp_2d
- dp_knapsack
- dp_lcs
- dp_tree
- divide_conquer
- greedy
- backtracking
- trie
- segment_tree
- fenwick_tree
- monotonic_stack
- kadane
- merge_sort
- quick_sort
- heap_priority_queue
```

---

## 2. USER SCHEMA COMPARISON

### Backend (User.js) - AI Profile Fields:

| Field                         | Type     | Status |
| ----------------------------- | -------- | ------ |
| aiProfile.weakTopics          | [String] | ✅ Has |
| aiProfile.strongTopics        | [String] | ✅ Has |
| aiProfile.commonMistakes      | [String] | ✅ Has |
| aiProfile.recurringPatterns   | [String] | ✅ Has |
| aiProfile.successRate         | Number   | ✅ Has |
| aiProfile.totalSubmissions    | Number   | ✅ Has |
| aiProfile.recentCategories    | [String] | ✅ Has |
| aiProfile.skillLevels         | Map      | ✅ Has |
| aiProfile.difficultyReadiness | Object   | ✅ Has |

### AI-Services (UserProfile) - REQUIRED FIELDS:

All fields are present in backend schema. ✅ **SYNCED**

---

## 3. SUBMISSION SCHEMA COMPARISON

### Backend (Submission.js) - CURRENT FIELDS:

| Field             | Type     | Status |
| ----------------- | -------- | ------ |
| userId            | ObjectId | ✅ Has |
| questionId        | ObjectId | ✅ Has |
| code              | String   | ✅ Has |
| language          | String   | ✅ Has |
| status            | String   | ✅ Has |
| problemCategory   | String   | ✅ Has |
| problemDifficulty | String   | ✅ Has |
| problemTags       | [String] | ✅ Has |

### AI-Services (SubmissionContext) - REQUIRED FIELDS:

All required fields present. ✅ **SYNCED**

---

## 4. ACTION ITEMS

### For QUESTIONS - Please provide data for:

1. List all your current questions with their `_id` and `title`
2. For each question, provide the missing field values

### Example Format I Need:

```
Question 1:
- ID: 6789abc...
- Title: "Two Sum"
- topic: "Arrays"
- expectedApproach: "Use hash map to store complements, single pass O(n)"
- commonMistakes: ["Returning indices in wrong order", "Not handling duplicates"]
- timeComplexityHint: "O(n)"
- spaceComplexityHint: "O(n)"
- canonicalAlgorithms: ["hash_map"]

Question 2:
- ID: 6789def...
- Title: "Merge Intervals"
...
```

---

## DATABASE UPDATE SCRIPT

Once you provide the data, I will:

1. Create a Node.js migration script
2. Update all questions in MongoDB
3. Backfill Submission documents with denormalized problem data
4. Verify AI-services can fetch complete ProblemContext

---

## HOW TO GET YOUR QUESTION LIST

Run this in your backend terminal:

```bash
# In MongoDB shell or Compass
db.questions.find({}, {_id: 1, title: 1, difficulty: 1, tags: 1, topic: 1, expectedApproach: 1}).pretty()
```

Or create a quick API endpoint to export.

---

## PLEASE PROVIDE:

1. **Total number of questions** in your database
2. **List of questions** with their current data
3. **Fill in the missing values** for each question

I'll then generate the update script and handle the database migration!
