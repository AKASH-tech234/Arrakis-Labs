/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CODE PREPROCESSOR SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Normalizes source code for plagiarism detection by:
 * - Removing comments (single-line and multi-line)
 * - Normalizing whitespace
 * - Normalizing variable/function names
 * - Removing string literals (optional)
 * - Converting to lowercase keywords
 * 
 * This ensures that superficial changes (renaming variables, reformatting)
 * don't affect similarity scores.
 */

// Language-specific comment patterns
const COMMENT_PATTERNS = {
  // C-family languages (C, C++, Java, JavaScript, TypeScript, Go, Rust, Swift, Kotlin, Scala)
  cFamily: {
    singleLine: /\/\/.*$/gm,
    multiLine: /\/\*[\s\S]*?\*\//g,
  },
  // Python, Ruby, Shell
  hash: {
    singleLine: /#.*$/gm,
    multiLine: /'''[\s\S]*?'''|"""[\s\S]*?"""/g,
  },
  // HTML, XML
  xml: {
    multiLine: /<!--[\s\S]*?-->/g,
  },
  // SQL
  sql: {
    singleLine: /--.*$/gm,
    multiLine: /\/\*[\s\S]*?\*\//g,
  },
};

// Language-specific string patterns
const STRING_PATTERNS = {
  cFamily: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
  python: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|"""[\s\S]*?"""|'''[\s\S]*?'''/g,
};

// Language-specific keywords (converted to generic tokens)
const KEYWORDS = {
  cFamily: new Set([
    "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
    "return", "try", "catch", "finally", "throw", "class", "struct", "enum",
    "public", "private", "protected", "static", "const", "var", "let", "function",
    "void", "int", "long", "double", "float", "char", "bool", "boolean", "string",
    "import", "export", "from", "default", "new", "delete", "this", "super",
    "extends", "implements", "interface", "abstract", "final", "override",
    "async", "await", "yield", "null", "undefined", "true", "false", "nullptr",
  ]),
  python: new Set([
    "if", "elif", "else", "for", "while", "try", "except", "finally", "raise",
    "class", "def", "return", "yield", "import", "from", "as", "with", "pass",
    "break", "continue", "lambda", "and", "or", "not", "in", "is", "True",
    "False", "None", "global", "nonlocal", "assert", "async", "await",
  ]),
};

// Language to family mapping
const LANGUAGE_FAMILY = {
  "c": "cFamily",
  "cpp": "cFamily",
  "c++": "cFamily",
  "java": "cFamily",
  "javascript": "cFamily",
  "js": "cFamily",
  "typescript": "cFamily",
  "ts": "cFamily",
  "go": "cFamily",
  "rust": "cFamily",
  "swift": "cFamily",
  "kotlin": "cFamily",
  "scala": "cFamily",
  "csharp": "cFamily",
  "c#": "cFamily",
  "python": "hash",
  "python3": "hash",
  "py": "hash",
  "ruby": "hash",
  "shell": "hash",
  "bash": "hash",
  "perl": "hash",
  "sql": "sql",
  "mysql": "sql",
  "postgresql": "sql",
};

class CodePreprocessor {
  constructor(options = {}) {
    this.options = {
      removeComments: true,
      normalizeWhitespace: true,
      normalizeIdentifiers: true,
      removeStrings: false, // Can lose semantic meaning
      minCodeLength: 50, // Characters
      ...options,
    };

    // Counter for normalized identifiers
    this.identifierCounter = 0;
    this.identifierMap = new Map();
  }

  /**
   * Main preprocessing method
   */
  preprocess(code, language) {
    // CRITICAL: Reset state for each new submission to prevent cross-contamination
    this.identifierMap.clear();
    this.identifierCounter = 0;

    if (!code || typeof code !== "string") {
      return {
        processed: "",
        tokens: [],
        error: "Invalid code input",
      };
    }

    language = language?.toLowerCase() || "cFamily";
    const family = LANGUAGE_FAMILY[language] || "cFamily";

    let processed = code;

    try {
      // Step 1: Remove comments
      if (this.options.removeComments) {
        processed = this.removeComments(processed, family);
      }

      // Step 2: Optionally remove string literals
      if (this.options.removeStrings) {
        processed = this.removeStrings(processed, family);
      }

      // Step 3: Normalize whitespace
      if (this.options.normalizeWhitespace) {
        processed = this.normalizeWhitespace(processed);
      }

      // Step 4: Normalize identifiers
      if (this.options.normalizeIdentifiers) {
        processed = this.normalizeIdentifiers(processed, family);
      }

      // Step 5: Tokenize
      const tokens = this.tokenize(processed);

      // Reset identifier map for next code
      this.identifierMap.clear();
      this.identifierCounter = 0;

      return {
        processed,
        tokens,
        originalLength: code.length,
        processedLength: processed.length,
        tokenCount: tokens.length,
        isTooShort: processed.length < this.options.minCodeLength,
      };
    } catch (error) {
      return {
        processed: "",
        tokens: [],
        error: error.message,
      };
    }
  }

  /**
   * Remove comments based on language family
   */
  removeComments(code, family) {
    const patterns = COMMENT_PATTERNS[family] || COMMENT_PATTERNS.cFamily;

    // Remove multi-line comments first
    if (patterns.multiLine) {
      code = code.replace(patterns.multiLine, " ");
    }

    // Then remove single-line comments
    if (patterns.singleLine) {
      code = code.replace(patterns.singleLine, "");
    }

    return code;
  }

  /**
   * Remove string literals
   */
  removeStrings(code, family) {
    const pattern = family === "python" ? STRING_PATTERNS.python : STRING_PATTERNS.cFamily;
    return code.replace(pattern, '""');
  }

  /**
   * Normalize whitespace: collapse multiple spaces, normalize newlines
   */
  normalizeWhitespace(code) {
    return code
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/[ \t]+/g, " ") // Collapse horizontal whitespace
      .replace(/\n\s*\n/g, "\n") // Remove empty lines
      .replace(/^\s+|\s+$/gm, "") // Trim each line
      .split("\n")
      .filter((line) => line.trim()) // Remove empty lines
      .join("\n")
      .trim();
  }

  /**
   * Normalize identifiers (variable/function names) to generic names
   * Preserves keywords but renames user-defined identifiers
   */
  normalizeIdentifiers(code, family) {
    const keywords = family === "python" ? KEYWORDS.python : KEYWORDS.cFamily;

    // Match identifiers: sequences of letters, numbers, underscores starting with letter/underscore
    const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

    return code.replace(identifierPattern, (match) => {
      // Don't normalize keywords
      if (keywords.has(match.toLowerCase())) {
        return match.toLowerCase();
      }

      // Don't normalize very short identifiers (likely loop vars like i, j, k)
      if (match.length <= 2) {
        return match;
      }

      // Check if we've seen this identifier before
      if (!this.identifierMap.has(match)) {
        this.identifierCounter++;
        this.identifierMap.set(match, `VAR${this.identifierCounter}`);
      }

      return this.identifierMap.get(match);
    });
  }

  /**
   * Tokenize preprocessed code
   */
  tokenize(code) {
    // Split on whitespace and common operators/punctuation
    const tokenPattern = /[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+|[+\-*/%=<>!&|^~?:;,.(){}\[\]]/g;
    const matches = code.match(tokenPattern);
    return matches || [];
  }

  /**
   * Generate n-grams from tokens
   */
  generateNgrams(tokens, n) {
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(" "));
    }
    return ngrams;
  }

  /**
   * Generate winnowing fingerprints (for efficient comparison)
   * Uses the winnowing algorithm for fingerprinting
   */
  generateWinnowFingerprints(tokens, windowSize = 4, ngramSize = 3) {
    // Generate n-grams
    const ngrams = this.generateNgrams(tokens, ngramSize);
    if (ngrams.length === 0) return [];

    // Hash each n-gram
    const hashes = ngrams.map((ngram) => this.hashString(ngram));

    // Apply winnowing: select minimum hash in each window
    const fingerprints = new Set();
    for (let i = 0; i <= hashes.length - windowSize; i++) {
      const window = hashes.slice(i, i + windowSize);
      fingerprints.add(Math.min(...window));
    }

    return Array.from(fingerprints);
  }

  /**
   * Simple string hash function
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if code is likely boilerplate/template
   */
  isBoilerplate(code, tokens) {
    // Very short code
    if (tokens.length < 10) return true;

    // Check for common boilerplate patterns
    const boilerplatePatterns = [
      /^#include\s*<.*>\s*int\s*main\s*\(\s*\)/m, // C/C++ hello world
      /^public\s+class\s+\w+\s*\{\s*public\s+static\s+void\s+main/m, // Java boilerplate
      /^from\s+\w+\s+import\s+\*?\s*$/m, // Python single import
    ];

    for (const pattern of boilerplatePatterns) {
      if (pattern.test(code)) {
        // Only boilerplate if code is very short
        if (code.length < 200) return true;
      }
    }

    return false;
  }

  /**
   * Full preprocessing pipeline returning all needed data
   */
  processForPlagiarismDetection(code, language) {
    const result = this.preprocess(code, language);

    if (result.error) {
      return {
        ...result,
        isBoilerplate: false,
        ngrams: { bigrams: [], trigrams: [], winnowHashes: [] },
      };
    }

    const bigrams = this.generateNgrams(result.tokens, 2);
    const trigrams = this.generateNgrams(result.tokens, 3);
    const winnowHashes = this.generateWinnowFingerprints(result.tokens);
    const isBoilerplate = this.isBoilerplate(result.processed, result.tokens);

    return {
      ...result,
      isBoilerplate,
      ngrams: {
        bigrams,
        trigrams,
        winnowHashes,
      },
    };
  }
}

// Singleton instance with default options
const preprocessor = new CodePreprocessor();

// Export both class and singleton
export { CodePreprocessor };
export default preprocessor;
