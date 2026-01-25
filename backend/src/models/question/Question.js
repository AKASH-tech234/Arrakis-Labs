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
