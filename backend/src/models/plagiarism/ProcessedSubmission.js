/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROCESSED SUBMISSION MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Stores preprocessed/normalized code and TF-IDF vectors for plagiarism detection.
 * Created during preprocessing phase and cached for efficient reuse.
 */

import mongoose from "mongoose";

const processedSubmissionSchema = new mongoose.Schema(
  {
    // Original submission reference
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestSubmission",
      required: true,
      unique: true,
      index: true,
    },

    // Context
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Original code metadata
    originalLength: {
      type: Number,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },

    // Preprocessed content
    processedContent: {
      type: String,
      required: true,
    },
    processedLength: {
      type: Number,
      required: true,
    },

    // Tokenized form (array of tokens)
    tokens: {
      type: [String],
      default: [],
    },
    tokenCount: {
      type: Number,
      default: 0,
    },

    // N-gram fingerprints for quick comparison
    ngrams: {
      bigrams: [String],     // 2-grams
      trigrams: [String],    // 3-grams
      winnowHashes: [Number], // Winnowing fingerprints
    },

    // TF-IDF Vector (sparse representation)
    tfidfVector: {
      type: Map,
      of: Number,
      default: new Map(),
    },

    // Vector metadata
    vectorMagnitude: {
      type: Number,
      default: 0,
    },
    vocabSize: {
      type: Number,
      default: 0,
    },

    // Processing metadata
    preprocessingVersion: {
      type: String,
      default: "1.0",
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },

    // Flags
    isTooShort: {
      type: Boolean,
      default: false,
    },
    isBoilerplate: {
      type: Boolean,
      default: false,
    },
    processingError: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
processedSubmissionSchema.index({ contest: 1, problem: 1 });
processedSubmissionSchema.index({ contest: 1, problem: 1, user: 1 });

// Virtual for compression ratio
processedSubmissionSchema.virtual("compressionRatio").get(function () {
  return this.originalLength > 0
    ? (this.processedLength / this.originalLength).toFixed(2)
    : 0;
});

// Methods
processedSubmissionSchema.methods.getTFIDFVector = function () {
  return Object.fromEntries(this.tfidfVector);
};

processedSubmissionSchema.methods.getNgramSet = function (type = "trigrams") {
  return new Set(this.ngrams[type] || []);
};

// Statics
processedSubmissionSchema.statics.findByProblem = function (contestId, problemId) {
  return this.find({
    contest: contestId,
    problem: problemId,
    isTooShort: false,
    isBoilerplate: false,
    processingError: { $exists: false },
  });
};

processedSubmissionSchema.statics.getVectorsForComparison = async function (
  contestId,
  problemId
) {
  const docs = await this.find({
    contest: contestId,
    problem: problemId,
    isTooShort: false,
    isBoilerplate: false,
    processingError: { $exists: false },
  })
    .select("submission user tfidfVector vectorMagnitude tokens ngrams")
    .lean();

  return docs.map((doc) => ({
    submissionId: doc.submission,
    userId: doc.user,
    vector: doc.tfidfVector,
    magnitude: doc.vectorMagnitude,
    tokens: doc.tokens,
    ngrams: doc.ngrams,
  }));
};

export default mongoose.model("ProcessedSubmission", processedSubmissionSchema);
