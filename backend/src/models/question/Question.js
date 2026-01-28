import mongoose from "mongoose";

const exampleSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true,
      trim: true,
    },
    output: {
      type: String,
      required: true,
      trim: true,
    },
    explanation: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      sparse: true,
      index: true,
    },
    // URL-friendly slug for problem identification (e.g., "two-sum", "valid-palindrome")
    slug: {
      type: String,
      sparse: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: [true, "Difficulty is required"],
    },
    constraints: {
      type: String,
      default: "",
      trim: true,
    },

    examples: {
      type: [exampleSchema],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 10;
        },
        message: "Cannot have more than 10 examples",
      },
    },

    tags: {
      type: [String],
      default: [],
    },
    // Problem type for UI category column (e.g., "Math", "Array")
    categoryType: {
      type: String,
      default: null,
      index: true,
    },
    // Primary topic/category (e.g., "Arrays", "Dynamic Programming")
    topic: {
      type: String,
      default: null,
      index: true,
    },
    // AI-assist fields (optional - inferred dynamically if not set)
    expectedApproach: {
      type: String,
      default: null, // e.g., "Two pointers", "Binary search"
    },
    commonMistakes: {
      type: [String],
      default: [], // Known pitfalls for this problem
    },
    timeComplexityHint: {
      type: String,
      default: null, // Expected O() notation
    },
    spaceComplexityHint: {
      type: String,
      default: null, // Expected memory complexity
    },
    // v3.2: Canonical algorithms for AI feedback grounding
    // e.g., ["bipartite_matching", "max_flow"] for task assignment problems
    canonicalAlgorithms: {
      type: [String],
      default: [], // Preferred algorithms for this problem
    },
    // For optimistic concurrency control
    version: {
      type: Number,
      default: 1,
    },

    totalSubmissions: {
      type: Number,
      default: 0,
    },
    acceptedSubmissions: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  },
);

questionSchema.index({ title: "text", description: "text" });
questionSchema.index({ difficulty: 1, isActive: 1 });
questionSchema.index({ tags: 1 });

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SLUG GENERATION - Critical for Hidden Test Case Generation
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * WHY THIS MATTERS:
 * The hidden test case generator (problemConfigRegistry.js) looks up problem
 * configurations by slug. If the slug doesn't match a registered problem,
 * NO hidden test cases will be generated - only DB test cases will run.
 * 
 * SLUG FORMAT: lowercase, alphanumeric + hyphens only
 * Example: "Repeated Substring Check" → "repeated-substring-check"
 */

/**
 * Generate a URL-friendly slug from any string
 * @param {string} str - Input string (e.g., problem title)
 * @returns {string} Normalized slug
 */
function generateSlug(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // Remove special chars (keep letters, numbers, spaces, hyphens)
    .replace(/\s+/g, "-")          // Replace spaces with hyphens
    .replace(/-+/g, "-")           // Collapse multiple hyphens
    .replace(/^-|-$/g, "");        // Trim leading/trailing hyphens
}

// Auto-generate slug from title before saving (for new documents)
questionSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = generateSlug(this.title);
    console.log(`[Question] Auto-generated slug: "${this.slug}" from title: "${this.title}"`);
  }
  next();
});

/**
 * Virtual getter: Always returns a usable slug, even if not stored in DB
 * This ensures hidden test generation works for existing questions without slug field
 */
questionSchema.virtual("effectiveSlug").get(function () {
  // Use stored slug if available, otherwise generate from title
  return this.slug || generateSlug(this.title);
});

questionSchema.virtual("acceptanceRate").get(function () {
  if (this.totalSubmissions === 0) return 0;
  return ((this.acceptedSubmissions / this.totalSubmissions) * 100).toFixed(1);
});

questionSchema.pre("findOneAndUpdate", function () {
  this.set({ version: this.get("version") + 1 || 1 });
});

questionSchema.set("toJSON", { virtuals: true });
questionSchema.set("toObject", { virtuals: true });

export default mongoose.model("Question", questionSchema);
