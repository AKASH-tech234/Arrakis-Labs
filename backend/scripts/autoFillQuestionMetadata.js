/**
 * Auto-Fill Question Metadata
 * ============================
 *
 * Smart script to auto-populate AI-required fields based on problem title analysis.
 * Uses pattern matching to infer:
 * - topic
 * - expectedApproach
 * - timeComplexityHint
 * - spaceComplexityHint
 * - canonicalAlgorithms
 * - commonMistakes
 *
 * Usage: node scripts/autoFillQuestionMetadata.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

import Question from "../src/models/question/Question.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/arrakis";

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN RULES - Map keywords in title to metadata
// ═══════════════════════════════════════════════════════════════════════════════

const TOPIC_PATTERNS = [
  // Graph algorithms
  {
    pattern: /bipartite|matching|assignment/i,
    topic: "Graphs",
    algorithms: ["bipartite_matching"],
    approach: "Hungarian algorithm or max flow for bipartite matching",
  },
  {
    pattern: /shortest path|dijkstra|bellman|floyd/i,
    topic: "Graphs",
    algorithms: ["dijkstra", "bellman_ford"],
    approach:
      "Use Dijkstra for non-negative weights, Bellman-Ford for negative",
  },
  {
    pattern: /topological|course schedule|prerequisite/i,
    topic: "Graphs",
    algorithms: ["topological_sort"],
    approach: "Use Kahn's algorithm or DFS for topological ordering",
  },
  {
    pattern: /spanning tree|kruskal|prim|mst/i,
    topic: "Graphs",
    algorithms: ["kruskal_prim", "union_find"],
    approach: "Use Kruskal with Union-Find or Prim with priority queue",
  },
  {
    pattern: /connected|connectivity|component/i,
    topic: "Graphs",
    algorithms: ["union_find", "bfs_dfs"],
    approach: "Use Union-Find for connectivity queries or BFS/DFS",
  },
  {
    pattern: /cycle.*graph|detect cycle/i,
    topic: "Graphs",
    algorithms: ["bfs_dfs"],
    approach: "Use DFS with visited states or Union-Find",
  },
  {
    pattern: /path.*graph|graph.*path|dfs|bfs|traverse/i,
    topic: "Graphs",
    algorithms: ["bfs_dfs"],
    approach: "Use BFS for shortest path, DFS for existence",
  },
  {
    pattern: /network flow|max flow|min cut/i,
    topic: "Graphs",
    algorithms: ["max_flow"],
    approach: "Use Ford-Fulkerson or Edmonds-Karp algorithm",
  },
  {
    pattern: /negative cycle/i,
    topic: "Graphs",
    algorithms: ["bellman_ford"],
    approach: "Use Bellman-Ford and check for updates after V-1 iterations",
  },

  // Tree algorithms
  {
    pattern: /binary tree|tree traversal|inorder|preorder|postorder/i,
    topic: "Trees",
    algorithms: ["bfs_dfs"],
    approach: "Use recursive or iterative traversal",
  },
  {
    pattern: /bst|binary search tree/i,
    topic: "Trees",
    algorithms: ["binary_search"],
    approach: "Leverage BST property: left < root < right",
  },
  {
    pattern: /avl.*tree|balanced.*tree/i,
    topic: "Trees",
    algorithms: ["binary_search"],
    approach: "Check balance factor and perform rotations",
  },
  {
    pattern: /red.?black|rb.*tree/i,
    topic: "Trees",
    algorithms: ["binary_search"],
    approach:
      "Validate red-black properties: root black, no red-red, equal black height",
  },
  {
    pattern: /b.?tree/i,
    topic: "Trees",
    algorithms: ["binary_search"],
    approach: "Check node degree constraints and key ordering",
  },
  {
    pattern: /heap|priority queue/i,
    topic: "Trees",
    algorithms: ["heap_priority_queue"],
    approach: "Maintain heap property through sift up/down operations",
  },
  {
    pattern: /trie|prefix tree/i,
    topic: "Trees",
    algorithms: ["trie"],
    approach: "Build trie from words, traverse for queries",
  },
  {
    pattern: /segment tree|range query|range update/i,
    topic: "Trees",
    algorithms: ["segment_tree"],
    approach: "Build segment tree, query/update in O(log n)",
  },
  {
    pattern: /fenwick|bit|binary indexed/i,
    topic: "Trees",
    algorithms: ["fenwick_tree"],
    approach: "Use BIT for prefix sum queries and point updates",
  },
  {
    pattern: /path.*sum|tree.*path/i,
    topic: "Trees",
    algorithms: ["bfs_dfs"],
    approach: "Use DFS to track path and sum",
  },
  {
    pattern: /lca|lowest common ancestor/i,
    topic: "Trees",
    algorithms: ["bfs_dfs"],
    approach: "Use binary lifting or Euler tour technique",
  },

  // Array/String algorithms
  {
    pattern: /two.*sum|pair.*sum/i,
    topic: "Arrays",
    algorithms: ["hash_map"],
    approach: "Use hash map to store complements",
  },
  {
    pattern: /three.*sum/i,
    topic: "Arrays",
    algorithms: ["two_pointers"],
    approach: "Sort and use two pointers for each element",
  },
  {
    pattern: /sliding window|subarray.*sum|substring/i,
    topic: "Arrays",
    algorithms: ["sliding_window"],
    approach: "Use two pointers with expand/contract window",
  },
  {
    pattern: /two pointer|merge.*sorted/i,
    topic: "Arrays",
    algorithms: ["two_pointers"],
    approach: "Use two pointers moving towards each other or same direction",
  },
  {
    pattern: /binary search|sorted.*array|search.*sorted|rotated.*sorted/i,
    topic: "Arrays",
    algorithms: ["binary_search"],
    approach: "Use binary search to eliminate half each iteration",
  },
  {
    pattern: /kadane|maximum.*subarray|max.*sum/i,
    topic: "Arrays",
    algorithms: ["kadane"],
    approach: "Use Kadane's algorithm: max_ending_here vs max_so_far",
  },
  {
    pattern: /prefix.*sum|range.*sum/i,
    topic: "Arrays",
    algorithms: ["hash_map"],
    approach: "Precompute prefix sums for O(1) range queries",
  },
  {
    pattern: /monotonic.*stack|next.*greater|histogram/i,
    topic: "Arrays",
    algorithms: ["monotonic_stack"],
    approach: "Maintain monotonic stack to track nearest elements",
  },
  {
    pattern: /inversion|merge.*sort/i,
    topic: "Arrays",
    algorithms: ["merge_sort", "divide_conquer"],
    approach: "Use modified merge sort to count inversions",
  },
  {
    pattern: /quick.*sort|partition/i,
    topic: "Arrays",
    algorithms: ["quick_sort"],
    approach: "Use partition to place pivot correctly",
  },
  {
    pattern: /k.?th.*smallest|k.?th.*largest|median/i,
    topic: "Arrays",
    algorithms: ["heap_priority_queue", "quick_sort"],
    approach: "Use quickselect or heap for kth element",
  },
  {
    pattern: /duplicate|unique/i,
    topic: "Arrays",
    algorithms: ["hash_map"],
    approach: "Use hash set to track seen elements",
  },
  {
    pattern: /anagram/i,
    topic: "Strings",
    algorithms: ["hash_map"],
    approach: "Compare character frequency counts",
  },
  {
    pattern: /palindrome/i,
    topic: "Strings",
    algorithms: ["two_pointers"],
    approach: "Check characters from both ends towards center",
  },
  {
    pattern: /pattern.*match|regex|valid.*string/i,
    topic: "Strings",
    algorithms: ["backtracking"],
    approach: "Use regex or character-by-character validation",
  },

  // Dynamic Programming
  {
    pattern: /knapsack|subset.*sum|target.*sum/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_knapsack"],
    approach: "Use 0/1 or unbounded knapsack DP",
  },
  {
    pattern: /longest.*common|lcs/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_lcs"],
    approach: "Build 2D DP table comparing characters",
  },
  {
    pattern: /edit.*distance|levenshtein/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_2d"],
    approach: "Use 2D DP with insert/delete/replace operations",
  },
  {
    pattern: /coin.*change/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_1d"],
    approach: "Use 1D DP to track minimum coins for each amount",
  },
  {
    pattern: /fibonacci|climb.*stair/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_1d"],
    approach: "Use DP or memoization with recurrence relation",
  },
  {
    pattern: /word.*break/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_1d", "trie"],
    approach: "Use DP to check breakable prefixes",
  },
  {
    pattern: /longest.*increasing|lis/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_1d", "binary_search"],
    approach: "Use DP with binary search for O(n log n)",
  },
  {
    pattern: /stock|buy.*sell/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_1d"],
    approach: "Track best buy point and max profit",
  },
  {
    pattern: /grid.*path|unique.*path/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_2d"],
    approach: "Use 2D DP to count/track paths",
  },
  {
    pattern: /matrix.*chain|optimal.*bst/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_2d"],
    approach: "Use interval DP with O(n³) complexity",
  },
  {
    pattern: /scrambled|interleaving/i,
    topic: "Dynamic Programming",
    algorithms: ["dp_2d"],
    approach: "Use memoization with string indices",
  },

  // Other algorithms
  {
    pattern: /greedy|interval|scheduling/i,
    topic: "Greedy",
    algorithms: ["greedy"],
    approach: "Sort by end time and select non-overlapping",
  },
  {
    pattern: /backtrack|permutation|combination|subset/i,
    topic: "Backtracking",
    algorithms: ["backtracking"],
    approach: "Use recursion with include/exclude choices",
  },
  {
    pattern: /divide.*conquer|merge/i,
    topic: "Divide and Conquer",
    algorithms: ["divide_conquer"],
    approach: "Split problem, solve subproblems, merge results",
  },
  {
    pattern: /bit.*manipulation|xor|set.*bit/i,
    topic: "Bit Manipulation",
    algorithms: ["hash_map"],
    approach: "Use bitwise operations for efficient manipulation",
  },
  {
    pattern: /linked.*list|node/i,
    topic: "Linked Lists",
    algorithms: ["two_pointers"],
    approach: "Use slow/fast pointers or iterative traversal",
  },
  {
    pattern: /cycle.*linked/i,
    topic: "Linked Lists",
    algorithms: ["two_pointers"],
    approach: "Use Floyd's tortoise and hare algorithm",
  },
  {
    pattern: /stack|queue|bracket|parentheses/i,
    topic: "Stacks & Queues",
    algorithms: ["monotonic_stack"],
    approach: "Use stack for matching and order tracking",
  },
  {
    pattern: /recursion|recursive/i,
    topic: "Recursion",
    algorithms: ["backtracking"],
    approach: "Define base case and recursive relation",
  },
  {
    pattern: /math|gcd|prime|modulo|factorial/i,
    topic: "Mathematics",
    algorithms: ["hash_map"],
    approach: "Use mathematical properties and formulas",
  },

  // Maze/Grid specific
  {
    pattern: /maze|labyrinth|escape/i,
    topic: "Graphs",
    algorithms: ["bfs_dfs"],
    approach: "Use BFS for shortest path in unweighted graph",
  },
  {
    pattern: /grid|matrix.*path/i,
    topic: "Graphs",
    algorithms: ["bfs_dfs", "dp_2d"],
    approach: "Use BFS/DFS for path finding or DP for counting",
  },
  {
    pattern: /island|flood.*fill/i,
    topic: "Graphs",
    algorithms: ["bfs_dfs"],
    approach: "Use BFS/DFS to explore connected regions",
  },
  {
    pattern: /teleport|portal/i,
    topic: "Graphs",
    algorithms: ["bfs_dfs"],
    approach: "Model teleporters as zero-cost edges in BFS",
  },
];

// Difficulty-based complexity hints
const COMPLEXITY_BY_DIFFICULTY = {
  Easy: { time: "O(n)", space: "O(1) or O(n)" },
  Medium: { time: "O(n log n) or O(n²)", space: "O(n)" },
  Hard: { time: "O(n²) or O(n log n) or O(V+E)", space: "O(n) or O(n²)" },
};

// Common mistakes by topic
const COMMON_MISTAKES_BY_TOPIC = {
  Arrays: [
    "Off-by-one errors in indices",
    "Not handling empty array",
    "Integer overflow in sum",
  ],
  Strings: [
    "Not handling empty string",
    "Case sensitivity issues",
    "Off-by-one in substring",
  ],
  Graphs: [
    "Not marking visited nodes",
    "Incorrect adjacency list construction",
    "Stack overflow in DFS",
  ],
  Trees: [
    "Null pointer on empty tree",
    "Not handling single node case",
    "Incorrect parent-child relationship",
  ],
  "Dynamic Programming": [
    "Incorrect base case",
    "Wrong state transition",
    "Not handling boundary conditions",
  ],
  "Linked Lists": [
    "Losing head pointer",
    "Not handling null next",
    "Cycle in modification",
  ],
  Recursion: [
    "Missing base case",
    "Stack overflow on large input",
    "Redundant recursive calls",
  ],
  Backtracking: [
    "Not reverting state after recursion",
    "Missing pruning conditions",
    "Duplicate results",
  ],
  Greedy: [
    "Assuming local optimal is global optimal",
    "Not sorting correctly",
    "Missing edge cases",
  ],
  "Bit Manipulation": [
    "Sign bit issues",
    "Overflow in shift operations",
    "Wrong mask application",
  ],
  "Stacks & Queues": [
    "Stack underflow",
    "Queue empty check",
    "Wrong order of operations",
  ],
  Mathematics: [
    "Integer overflow",
    "Division by zero",
    "Floating point precision",
  ],
  "Divide and Conquer": [
    "Incorrect merge step",
    "Not handling odd/even length",
    "Infinite recursion",
  ],
};

function inferMetadata(question) {
  const { title, difficulty, tags } = question;
  const titleLower = title.toLowerCase();

  let metadata = {
    topic: null,
    expectedApproach: null,
    canonicalAlgorithms: [],
    timeComplexityHint: COMPLEXITY_BY_DIFFICULTY[difficulty]?.time || "O(n)",
    spaceComplexityHint: COMPLEXITY_BY_DIFFICULTY[difficulty]?.space || "O(n)",
    commonMistakes: [],
  };

  // Check each pattern
  for (const rule of TOPIC_PATTERNS) {
    if (rule.pattern.test(titleLower)) {
      metadata.topic = rule.topic;
      metadata.canonicalAlgorithms = [
        ...new Set([...metadata.canonicalAlgorithms, ...rule.algorithms]),
      ];
      if (!metadata.expectedApproach) {
        metadata.expectedApproach = rule.approach;
      }
    }
  }

  // Fallback to tags if no pattern matched
  if (!metadata.topic && tags && tags.length > 0) {
    metadata.topic = tags[0];
  }

  // Set common mistakes based on topic
  if (metadata.topic && COMMON_MISTAKES_BY_TOPIC[metadata.topic]) {
    metadata.commonMistakes = COMMON_MISTAKES_BY_TOPIC[metadata.topic];
  } else {
    metadata.commonMistakes = [
      "Check edge cases",
      "Handle empty input",
      "Watch for off-by-one errors",
    ];
  }

  // Default values if still null
  if (!metadata.topic) metadata.topic = "General";
  if (!metadata.expectedApproach)
    metadata.expectedApproach =
      "Analyze problem constraints and choose appropriate data structure";
  if (metadata.canonicalAlgorithms.length === 0)
    metadata.canonicalAlgorithms = ["hash_map"];

  return metadata;
}

async function main() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Fetch all questions
    const questions = await Question.find({ isActive: true })
      .select(
        "_id title difficulty tags topic expectedApproach commonMistakes timeComplexityHint spaceComplexityHint canonicalAlgorithms",
      )
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📊 Found ${questions.length} questions\n`);

    // Questions needing update
    const needsUpdate = questions.filter(
      (q) => !q.topic || !q.expectedApproach || !q.canonicalAlgorithms?.length,
    );

    console.log(`🔧 ${needsUpdate.length} questions need metadata\n`);

    // Infer metadata for each
    const updates = needsUpdate.map((q) => ({
      _id: q._id,
      title: q.title,
      difficulty: q.difficulty,
      currentTags: q.tags,
      inferred: inferMetadata(q),
    }));

    // Write to review file
    const outputPath = join(__dirname, "../docs/questions_auto_filled.json");
    fs.writeFileSync(outputPath, JSON.stringify(updates, null, 2));

    console.log(`\n📝 Generated auto-fill suggestions: ${outputPath}`);
    console.log("\n📋 Sample (first 5):");
    console.log("─".repeat(80));

    updates.slice(0, 5).forEach((u, i) => {
      console.log(`\n${i + 1}. ${u.title} (${u.difficulty})`);
      console.log(`   Topic: ${u.inferred.topic}`);
      console.log(
        `   Approach: ${u.inferred.expectedApproach.substring(0, 60)}...`,
      );
      console.log(
        `   Algorithms: ${u.inferred.canonicalAlgorithms.join(", ")}`,
      );
      console.log(
        `   Complexity: ${u.inferred.timeComplexityHint} time, ${u.inferred.spaceComplexityHint} space`,
      );
    });

    // Ask for confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question(
        `\n\n🚀 Apply auto-fill to ${updates.length} questions? (yes/no): `,
        resolve,
      );
    });
    rl.close();

    if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
      console.log("\n🔄 Updating database...\n");

      let updated = 0;
      for (const u of updates) {
        try {
          await Question.findByIdAndUpdate(u._id, {
            $set: {
              topic: u.inferred.topic,
              expectedApproach: u.inferred.expectedApproach,
              canonicalAlgorithms: u.inferred.canonicalAlgorithms,
              timeComplexityHint: u.inferred.timeComplexityHint,
              spaceComplexityHint: u.inferred.spaceComplexityHint,
              commonMistakes: u.inferred.commonMistakes,
            },
          });
          updated++;
          if (updated % 50 === 0) {
            console.log(`   Updated ${updated}/${updates.length}...`);
          }
        } catch (err) {
          console.error(`   ❌ Failed: ${u.title}: ${err.message}`);
        }
      }

      console.log(`\n✅ Successfully updated ${updated} questions!`);
    } else {
      console.log(
        "\n⏭️  Skipped. Review the file and run importQuestionsSync.js manually.",
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

main();
