/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SIMILARITY ENGINE SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Computes similarity between code submissions using multiple metrics:
 * - Cosine similarity (TF-IDF vectors)
 * - Jaccard similarity (token sets)
 * - Levenshtein distance (edit distance)
 * - Token overlap ratio
 * - Structural similarity (AST-like comparison via n-grams)
 * 
 * Combines metrics using weighted average for final score.
 */

import { TFIDFVectorizer } from "./TFIDFVectorizer.js";

// Default weights for combining similarity metrics
const DEFAULT_WEIGHTS = {
  cosine: 0.40,      // TF-IDF cosine similarity
  jaccard: 0.20,     // Jaccard token similarity
  levenshtein: 0.15, // Normalized Levenshtein
  tokenOverlap: 0.10, // Token overlap ratio
  structural: 0.15,  // N-gram structural similarity
};

class SimilarityEngine {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.vectorizer = new TFIDFVectorizer();
  }

  /**
   * Compute cosine similarity between two TF-IDF vectors
   */
  cosineSimilarity(vector1, vector2) {
    if (!vector1 || !vector2 || vector1.size === 0 || vector2.size === 0) {
      return 0;
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    // Calculate dot product and first magnitude
    for (const [term, value1] of vector1) {
      mag1 += value1 * value1;
      const value2 = vector2.get(term);
      if (value2 !== undefined) {
        dotProduct += value1 * value2;
      }
    }

    // Calculate second magnitude
    for (const value2 of vector2.values()) {
      mag2 += value2 * value2;
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Compute Jaccard similarity between two token sets
   * Jaccard = |A ∩ B| / |A ∪ B|
   */
  jaccardSimilarity(tokens1, tokens2) {
    if (!tokens1?.length || !tokens2?.length) {
      return 0;
    }

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    let intersection = 0;
    for (const token of set1) {
      if (set2.has(token)) {
        intersection++;
      }
    }

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Compute normalized Levenshtein distance
   * Using optimized algorithm for token sequences
   */
  levenshteinSimilarity(tokens1, tokens2) {
    if (!tokens1?.length || !tokens2?.length) {
      return tokens1?.length === tokens2?.length ? 1 : 0;
    }

    const m = tokens1.length;
    const n = tokens2.length;

    // For very long sequences, use approximation
    if (m * n > 1000000) {
      return this.approximateLevenshtein(tokens1, tokens2);
    }

    // Standard DP approach with space optimization
    let prev = Array(n + 1).fill(0).map((_, i) => i);
    let curr = Array(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = tokens1[i - 1] === tokens2[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,      // deletion
          curr[j - 1] + 1,  // insertion
          prev[j - 1] + cost // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    const distance = prev[n];
    const maxLen = Math.max(m, n);
    return maxLen > 0 ? 1 - distance / maxLen : 1;
  }

  /**
   * Approximate Levenshtein for long sequences using sampling
   */
  approximateLevenshtein(tokens1, tokens2) {
    const sampleSize = 100;
    const sample1 = this.sampleTokens(tokens1, sampleSize);
    const sample2 = this.sampleTokens(tokens2, sampleSize);
    return this.levenshteinSimilarity(sample1, sample2);
  }

  /**
   * Sample tokens evenly from array
   */
  sampleTokens(tokens, size) {
    if (tokens.length <= size) return tokens;
    const step = tokens.length / size;
    const sampled = [];
    for (let i = 0; i < size; i++) {
      sampled.push(tokens[Math.floor(i * step)]);
    }
    return sampled;
  }

  /**
   * Compute token overlap ratio
   * Ratio of common tokens to total unique tokens
   */
  tokenOverlapRatio(tokens1, tokens2) {
    if (!tokens1?.length || !tokens2?.length) {
      return 0;
    }

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    let common = 0;
    for (const token of set1) {
      if (set2.has(token)) {
        common++;
      }
    }

    // Symmetric overlap: common / min(|A|, |B|)
    const minSize = Math.min(set1.size, set2.size);
    return minSize > 0 ? common / minSize : 0;
  }

  /**
   * Compute structural similarity using n-grams
   * Compares trigram fingerprints
   */
  structuralSimilarity(ngrams1, ngrams2) {
    if (!ngrams1?.trigrams?.length || !ngrams2?.trigrams?.length) {
      return 0;
    }

    // Use trigrams for structural comparison
    const set1 = new Set(ngrams1.trigrams);
    const set2 = new Set(ngrams2.trigrams);

    let intersection = 0;
    for (const ngram of set1) {
      if (set2.has(ngram)) {
        intersection++;
      }
    }

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Compute winnowing fingerprint similarity
   * For fast approximate comparison
   */
  winnowingSimilarity(fingerprints1, fingerprints2) {
    if (!fingerprints1?.length || !fingerprints2?.length) {
      return 0;
    }

    const set1 = new Set(fingerprints1);
    const set2 = new Set(fingerprints2);

    let intersection = 0;
    for (const fp of set1) {
      if (set2.has(fp)) {
        intersection++;
      }
    }

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Compute comprehensive similarity between two processed submissions
   * Returns individual metrics and combined score
   */
  computeSimilarity(submission1, submission2) {
    const metrics = {
      cosine: this.cosineSimilarity(submission1.vector, submission2.vector),
      jaccard: this.jaccardSimilarity(submission1.tokens, submission2.tokens),
      levenshtein: this.levenshteinSimilarity(submission1.tokens, submission2.tokens),
      tokenOverlap: this.tokenOverlapRatio(submission1.tokens, submission2.tokens),
      structural: this.structuralSimilarity(submission1.ngrams, submission2.ngrams),
    };

    // Calculate weighted average
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [metric, value] of Object.entries(metrics)) {
      const weight = this.weights[metric] || 0;
      weightedSum += value * weight;
      totalWeight += weight;
    }

    const combinedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      score: Math.round(combinedScore * 10000) / 10000, // 4 decimal places
      metrics,
    };
  }

  /**
   * Quick similarity check using winnowing (for filtering)
   * Returns true if submissions might be similar (worth detailed comparison)
   */
  quickSimilarityCheck(submission1, submission2, threshold = 0.3) {
    const winnowSim = this.winnowingSimilarity(
      submission1.ngrams?.winnowHashes,
      submission2.ngrams?.winnowHashes
    );
    return winnowSim >= threshold;
  }

  /**
   * Find matching sections between two code strings
   * For highlighting similar portions in UI
   */
  findMatchingSections(code1, code2, minMatchLength = 10) {
    const matches = [];
    const lines1 = code1.split("\n");
    const lines2 = code2.split("\n");

    // Build line hash map for code2
    const lineMap = new Map();
    lines2.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.length >= minMatchLength) {
        if (!lineMap.has(trimmed)) {
          lineMap.set(trimmed, []);
        }
        lineMap.get(trimmed).push(idx);
      }
    });

    // Find matching line sequences
    for (let i = 0; i < lines1.length; i++) {
      const trimmed = lines1[i].trim();
      if (trimmed.length < minMatchLength) continue;

      const matchingLines = lineMap.get(trimmed);
      if (!matchingLines) continue;

      for (const j of matchingLines) {
        // Extend match forwards
        let matchLen = 1;
        while (
          i + matchLen < lines1.length &&
          j + matchLen < lines2.length &&
          lines1[i + matchLen].trim() === lines2[j + matchLen].trim()
        ) {
          matchLen++;
        }

        if (matchLen >= 3) { // At least 3 matching lines
          matches.push({
            submission1: { startLine: i + 1, endLine: i + matchLen },
            submission2: { startLine: j + 1, endLine: j + matchLen },
            lineCount: matchLen,
          });
        }
      }
    }

    // Remove overlapping matches, keep longest
    return this.deduplicateMatches(matches);
  }

  /**
   * Remove overlapping matches, keeping longest ones
   */
  deduplicateMatches(matches) {
    if (matches.length <= 1) return matches;

    // Sort by length descending
    matches.sort((a, b) => b.lineCount - a.lineCount);

    const result = [];
    const usedLines1 = new Set();
    const usedLines2 = new Set();

    for (const match of matches) {
      let overlaps = false;

      // Check overlap in submission1
      for (let i = match.submission1.startLine; i <= match.submission1.endLine; i++) {
        if (usedLines1.has(i)) {
          overlaps = true;
          break;
        }
      }

      // Check overlap in submission2
      if (!overlaps) {
        for (let i = match.submission2.startLine; i <= match.submission2.endLine; i++) {
          if (usedLines2.has(i)) {
            overlaps = true;
            break;
          }
        }
      }

      if (!overlaps) {
        result.push(match);
        for (let i = match.submission1.startLine; i <= match.submission1.endLine; i++) {
          usedLines1.add(i);
        }
        for (let i = match.submission2.startLine; i <= match.submission2.endLine; i++) {
          usedLines2.add(i);
        }
      }
    }

    return result;
  }

  /**
   * Compare all pairs in a list of submissions
   * Returns array of comparison results above threshold
   */
  compareAllPairs(submissions, threshold = 0.5, useQuickFilter = true) {
    const results = [];
    const n = submissions.length;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Quick filter first
        if (useQuickFilter) {
          const passesQuickCheck = this.quickSimilarityCheck(
            submissions[i],
            submissions[j],
            threshold * 0.5 // Lower threshold for quick check
          );
          if (!passesQuickCheck) continue;
        }

        // Full comparison
        const similarity = this.computeSimilarity(submissions[i], submissions[j]);

        if (similarity.score >= threshold) {
          results.push({
            submission1: submissions[i].submissionId,
            submission2: submissions[j].submissionId,
            user1: submissions[i].userId,
            user2: submissions[j].userId,
            ...similarity,
          });
        }
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

export default SimilarityEngine;
export { SimilarityEngine, DEFAULT_WEIGHTS };
