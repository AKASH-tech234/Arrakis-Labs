/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TF-IDF VECTORIZER SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Converts tokenized code into TF-IDF (Term Frequency-Inverse Document Frequency)
 * vectors for similarity computation.
 * 
 * TF-IDF = TF(t,d) * IDF(t,D)
 * - TF: How frequently a term appears in a document
 * - IDF: How rare a term is across all documents (higher = more discriminative)
 */

class TFIDFVectorizer {
  constructor() {
    // Document frequency: how many documents contain each term
    this.documentFrequency = new Map();
    // Total number of documents (submissions)
    this.totalDocuments = 0;
    // Vocabulary (all unique terms)
    this.vocabulary = new Set();
    // IDF values (cached after fitting)
    this.idfValues = new Map();
    // Is the vectorizer fitted?
    this.isFitted = false;
  }

  /**
   * Reset the vectorizer state
   */
  reset() {
    this.documentFrequency.clear();
    this.totalDocuments = 0;
    this.vocabulary.clear();
    this.idfValues.clear();
    this.isFitted = false;
  }

  /**
   * Fit the vectorizer on a collection of token arrays
   * @param {Array<Array<string>>} tokenizedDocuments - Array of token arrays
   */
  fit(tokenizedDocuments) {
    this.reset();
    this.totalDocuments = tokenizedDocuments.length;

    // Build vocabulary and document frequencies
    for (const tokens of tokenizedDocuments) {
      const uniqueTokens = new Set(tokens);
      
      for (const token of uniqueTokens) {
        this.vocabulary.add(token);
        this.documentFrequency.set(
          token,
          (this.documentFrequency.get(token) || 0) + 1
        );
      }
    }

    // Compute IDF values
    for (const [term, df] of this.documentFrequency) {
      // Using smoothed IDF: log((N + 1) / (df + 1)) + 1
      const idf = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
      this.idfValues.set(term, idf);
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Transform a single token array into a TF-IDF vector
   * @param {Array<string>} tokens - Token array
   * @returns {Object} - Sparse vector as {term: tfidf_value}
   */
  transform(tokens) {
    if (!this.isFitted) {
      throw new Error("Vectorizer must be fitted before transform");
    }

    // Compute term frequencies
    const termFrequency = new Map();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }

    // Compute TF-IDF
    const vector = new Map();
    const totalTerms = tokens.length;

    for (const [term, count] of termFrequency) {
      if (this.vocabulary.has(term)) {
        // Normalized TF: count / total terms in document
        const tf = count / totalTerms;
        const idf = this.idfValues.get(term) || 1;
        const tfidf = tf * idf;
        
        if (tfidf > 0) {
          vector.set(term, tfidf);
        }
      }
    }

    return vector;
  }

  /**
   * Fit and transform in one step (for a single corpus)
   */
  fitTransform(tokenizedDocuments) {
    this.fit(tokenizedDocuments);
    return tokenizedDocuments.map((tokens) => this.transform(tokens));
  }

  /**
   * Calculate the magnitude (L2 norm) of a vector
   */
  magnitude(vector) {
    let sum = 0;
    for (const value of vector.values()) {
      sum += value * value;
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute cosine similarity between two TF-IDF vectors
   */
  cosineSimilarity(vector1, vector2) {
    // Dot product
    let dotProduct = 0;
    for (const [term, value1] of vector1) {
      const value2 = vector2.get(term);
      if (value2) {
        dotProduct += value1 * value2;
      }
    }

    // Magnitudes
    const mag1 = this.magnitude(vector1);
    const mag2 = this.magnitude(vector2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Get vocabulary statistics
   */
  getStats() {
    return {
      vocabularySize: this.vocabulary.size,
      totalDocuments: this.totalDocuments,
      avgTermsPerDocument: this.totalDocuments > 0
        ? Array.from(this.documentFrequency.values()).reduce((a, b) => a + b, 0) / this.totalDocuments
        : 0,
    };
  }

  /**
   * Export the fitted state (for caching)
   */
  exportState() {
    return {
      documentFrequency: Object.fromEntries(this.documentFrequency),
      totalDocuments: this.totalDocuments,
      vocabulary: Array.from(this.vocabulary),
      idfValues: Object.fromEntries(this.idfValues),
      isFitted: this.isFitted,
    };
  }

  /**
   * Import a previously exported state
   */
  importState(state) {
    this.documentFrequency = new Map(Object.entries(state.documentFrequency));
    this.totalDocuments = state.totalDocuments;
    this.vocabulary = new Set(state.vocabulary);
    this.idfValues = new Map(Object.entries(state.idfValues));
    this.isFitted = state.isFitted;
    return this;
  }
}

/**
 * Batch vectorizer for processing multiple problems
 * Creates a separate vectorizer per problem for better accuracy
 */
class BatchTFIDFVectorizer {
  constructor() {
    // Vectorizer per problem
    this.problemVectorizers = new Map();
  }

  /**
   * Fit a vectorizer for a specific problem
   * @param {string} problemId - Problem identifier
   * @param {Array<{submissionId: string, tokens: Array<string>}>} submissions
   */
  fitProblem(problemId, submissions) {
    const vectorizer = new TFIDFVectorizer();
    const tokenArrays = submissions.map((s) => s.tokens);
    vectorizer.fit(tokenArrays);
    this.problemVectorizers.set(problemId.toString(), vectorizer);
    return vectorizer;
  }

  /**
   * Transform submissions for a specific problem
   */
  transformProblem(problemId, submissions) {
    const vectorizer = this.problemVectorizers.get(problemId.toString());
    if (!vectorizer) {
      throw new Error(`No vectorizer fitted for problem ${problemId}`);
    }

    return submissions.map((s) => ({
      submissionId: s.submissionId,
      userId: s.userId,
      vector: vectorizer.transform(s.tokens),
      magnitude: vectorizer.magnitude(vectorizer.transform(s.tokens)),
    }));
  }

  /**
   * Fit and transform all submissions for a problem
   */
  fitTransformProblem(problemId, submissions) {
    this.fitProblem(problemId, submissions);
    return this.transformProblem(problemId, submissions);
  }

  /**
   * Get vectorizer for a problem
   */
  getVectorizer(problemId) {
    return this.problemVectorizers.get(problemId.toString());
  }

  /**
   * Clear all vectorizers
   */
  clear() {
    this.problemVectorizers.clear();
  }
}

export { TFIDFVectorizer, BatchTFIDFVectorizer };
export default TFIDFVectorizer;
