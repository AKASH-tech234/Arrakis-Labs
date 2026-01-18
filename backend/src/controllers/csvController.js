import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import mongoose from "mongoose";
import Question from "../models/Question.js";
import TestCase from "../models/TestCase.js";
import AuditLog from "../models/AuditLog.js";
import { jsonToStdin, outputToStdout } from "../utils/stdinConverter.js";

// Multer configuration for CSV uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
    cb(null, true);
  } else {
    const err = new Error("Only CSV files are allowed");
    err.status = 400;
    cb(err, false);
  }
};

const csvUploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single("file");

// Wrap multer to return clean 400 responses instead of generic 500s
export const uploadCSV = (req, res, next) => {
  csvUploader(req, res, (err) => {
    if (!err) return next();

    // Multer errors (e.g., LIMIT_FILE_SIZE)
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "CSV file too large. Max size is 5MB"
          : err.message;
      return res.status(400).json({
        success: false,
        message,
      });
    }

    const status = err.status && Number.isInteger(err.status) ? err.status : 400;
    return res.status(status).json({
      success: false,
      message: err.message || "Invalid CSV upload",
    });
  });
};

/**
 * CSV Injection Protection
 * Sanitizes string values to prevent formula injection attacks
 * Dangerous characters: = + - @ | Tab Carriage Return
 */
function sanitizeCSVValue(value) {
  if (typeof value !== "string") return value;
  
  // Check for formula injection characters at the start
  const dangerousChars = ["=", "+", "-", "@", "|", "\t", "\r"];
  const trimmedValue = value.trim();
  
  if (dangerousChars.some(char => trimmedValue.startsWith(char))) {
    // Prefix with single quote to neutralize formula
    return "'" + trimmedValue;
  }
  
  return value;
}

/**
 * Required CSV columns
 */
const REQUIRED_COLUMNS = [
  "title",
  "description",
  "difficulty",
];

const OPTIONAL_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "constraints",
  "example",
  "examples",
  "test_cases",
  "tags",
];

// Transactions are great for small imports, but large CSV imports can exceed
// MongoDB transaction limits (ops/size/time) and get aborted.
const TRANSACTION_ROW_LIMIT = 50;
const TRANSACTION_CHUNK_SIZE = 25;

function normalizeHeader(header) {
  if (!header) return "";
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function isValidDateString(value) {
  if (!value) return true;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function normalizeDifficulty(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "easy") return "Easy";
  if (trimmed === "medium") return "Medium";
  if (trimmed === "hard") return "Hard";
  return null;
}

/**
 * Validate CSV row
 * @param {Object} row - CSV row object
 * @param {number} index - Row index (0-based)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRow(row, index) {
  const errors = [];
  const rowNum = index + 2; // Account for header row and 0-indexing

  // Check required fields
  if (!row.title?.trim()) {
    errors.push(`Row ${rowNum}: Missing title`);
  } else if (row.title.trim().length > 200) {
    errors.push(`Row ${rowNum}: Title too long (max 200 characters)`);
  }

  if (!row.description?.trim()) {
    errors.push(`Row ${rowNum}: Missing description`);
  }

  const normalizedDifficulty = normalizeDifficulty(row.difficulty);
  if (!normalizedDifficulty) {
    errors.push(`Row ${rowNum}: Invalid difficulty. Must be Easy, Medium, or Hard`);
  }

  if (!isValidDateString(row.created_at)) {
    errors.push(`Row ${rowNum}: Invalid date in 'created_at' field`);
  }

  if (!isValidDateString(row.updated_at)) {
    errors.push(`Row ${rowNum}: Invalid date in 'updated_at' field`);
  }

  // Validate examples JSON if provided
  const examplesValue = row.examples || row.example;
  if (examplesValue) {
    try {
      const parsed = JSON.parse(examplesValue);
      const normalized = Array.isArray(parsed) ? parsed : [parsed];
      normalized.forEach((ex, i) => {
        if (ex?.input === undefined) errors.push(`Row ${rowNum}: Example ${i + 1} missing 'input'`);
        if (ex?.output === undefined) errors.push(`Row ${rowNum}: Example ${i + 1} missing 'output'`);
      });
    } catch (e) {
      errors.push(`Row ${rowNum}: Invalid JSON in 'example(s)' field`);
    }
  }

  // Validate test_cases JSON if provided
  if (row.test_cases) {
    try {
      const testCases = JSON.parse(row.test_cases);
      if (!Array.isArray(testCases)) {
        errors.push(`Row ${rowNum}: 'test_cases' must be a JSON array`);
      } else {
        testCases.forEach((tc, i) => {
          if (tc.input === undefined) {
            errors.push(`Row ${rowNum}: Test case ${i + 1} missing 'input'`);
          }
          if (tc.expected_output === undefined) {
            errors.push(`Row ${rowNum}: Test case ${i + 1} missing 'expected_output'`);
          }
        });
      }
    } catch (e) {
      errors.push(`Row ${rowNum}: Invalid JSON in 'test_cases' field`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse CSV buffer to array of rows
 * @param {Buffer} buffer - CSV file buffer
 * @returns {Promise<Object[]>} - Parsed rows
 */
function parseCSVBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => normalizeHeader(header),
        mapValues: ({ value }) => {
          // Sanitize CSV values to prevent formula injection
          const trimmed = value?.trim() || "";
          return sanitizeCSVValue(trimmed);
        },
      }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", (error) => reject(error));
  });
}

/**
 * Process and save a single CSV row
 * @param {Object} row - Validated CSV row
 * @param {string} adminId - Admin ID for audit
 * @param {mongoose.ClientSession} session - MongoDB session for transaction
 * @returns {Promise<{ question: Object, testCaseCount: number }>}
 */
async function processRow(row, adminId, session) {
  // Parse examples
  let examples = [];
  const examplesValue = row.examples || row.example;
  if (examplesValue) {
    const parsed = JSON.parse(examplesValue);
    const parsedExamples = Array.isArray(parsed) ? parsed : [parsed];
    examples = parsedExamples.map((ex) => ({
      input: typeof ex.input === "object" ? JSON.stringify(ex.input) : String(ex.input),
      output: typeof ex.output === "object" ? JSON.stringify(ex.output) : String(ex.output),
      explanation: ex.explanation || "",
    }));
  }

  // Parse tags
  let tags = [];
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags);
      if (!Array.isArray(tags)) tags = [row.tags];
    } catch {
      tags = row.tags.split(",").map(t => t.trim()).filter(Boolean);
    }
  }

  // Create question
  const createdAt = row.created_at ? new Date(row.created_at) : undefined;
  const updatedAt = row.updated_at ? new Date(row.updated_at) : undefined;

  const question = await Question.create(
    [
      {
        externalId: row.id || null,
        title: row.title.trim(),
        description: row.description.trim(),
        difficulty: normalizeDifficulty(row.difficulty) || row.difficulty?.trim(),
        constraints: row.constraints?.trim() || "",
        examples,
        tags,
        createdBy: adminId,
        updatedBy: adminId,
        ...(createdAt ? { createdAt } : {}),
        ...(updatedAt ? { updatedAt } : {}),
      },
    ],
    { session }
  );

  const questionDoc = question[0];
  let testCaseCount = 0;

  // Parse and create test cases
  // First 2 test cases are VISIBLE (for Run), rest are HIDDEN (for Submit)
  if (row.test_cases) {
    const testCases = JSON.parse(row.test_cases);
    const testCaseDocs = testCases.map((tc, index) => ({
      questionId: questionDoc._id,
      stdin: jsonToStdin(tc.input),
      expectedStdout: outputToStdout(tc.expected_output),
      // First 2 are visible for "Run", rest hidden for "Submit" (LeetCode-style)
      isHidden: tc.is_hidden !== undefined ? tc.is_hidden : index >= 2,
      label: tc.label || `Test Case ${index + 1}`,
      timeLimit: tc.time_limit || 2000,
      memoryLimit: tc.memory_limit || 256,
      order: index,
    }));

    await TestCase.insertMany(testCaseDocs, { session });
    testCaseCount = testCaseDocs.length;
  }

  return { question: questionDoc, testCaseCount };
}

/**
 * Upload and process CSV file
 * POST /api/admin/upload-csv
 */
export const processCSVUpload = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file provided",
      });
    }

    // Parse CSV
    const rows = await parseCSVBuffer(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty",
      });
    }

    // Check for required columns
    const columns = Object.keys(rows[0]);
    const missingColumns = REQUIRED_COLUMNS.filter(col => !columns.includes(col));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      });
    }

    // Validate all rows first
    const validationResults = rows.map((row, index) => ({
      row,
      index,
      ...validateRow(row, index),
    }));

    const invalidRows = validationResults.filter(r => !r.valid);
    
    if (invalidRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: invalidRows.flatMap(r => r.errors),
        invalidCount: invalidRows.length,
        totalRows: rows.length,
      });
    }

    // Process all rows in a transaction when supported (replica set);
    // fall back to non-transactional inserts on standalone MongoDB.
    let usedTransaction = false;
    const results = {
      questionsCreated: 0,
      testCasesCreated: 0,
      questions: [],
      warnings: [],
    };

    const recordResult = (question, testCaseCount) => {
      results.questionsCreated++;
      results.testCasesCreated += testCaseCount;
      results.questions.push({
        id: question._id,
        title: question.title,
        difficulty: question.difficulty,
        testCases: testCaseCount,
      });
    };

    const runImport = async (rowsToImport, activeSession) => {
      for (const { row } of rowsToImport) {
        const { question, testCaseCount } = await processRow(
          row,
          req.admin._id,
          activeSession
        );
        recordResult(question, testCaseCount);
      }
    };

    try {
      usedTransaction = true;

      // For larger imports, chunk into multiple transactions to avoid txn aborts.
      if (validationResults.length > TRANSACTION_ROW_LIMIT) {
        results.warnings.push(
          `Large import (${validationResults.length} rows): processed in chunks of ${TRANSACTION_CHUNK_SIZE} with separate transactions`
        );

        for (let start = 0; start < validationResults.length; start += TRANSACTION_CHUNK_SIZE) {
          const chunk = validationResults.slice(start, start + TRANSACTION_CHUNK_SIZE);
          session.startTransaction();
          try {
            await runImport(chunk, session);
            await session.commitTransaction();
          } catch (chunkError) {
            try {
              await session.abortTransaction();
            } catch {
              // ignore
            }
            throw chunkError;
          }
        }
      } else {
        session.startTransaction();
        await runImport(validationResults, session);
        await session.commitTransaction();
      }
    } catch (txError) {
      // Abort any in-flight transaction
      try {
        await session.abortTransaction();
      } catch {
        // ignore
      }

      const msg = String(txError?.message || "");
      const looksLikeStandaloneTxnError =
        msg.includes("Transaction numbers are only allowed") ||
        msg.includes("replica set") ||
        msg.includes("mongos");

      if (!looksLikeStandaloneTxnError) {
        throw txError;
      }

      // Fallback without transaction/session
      usedTransaction = false;
      results.warnings.push(
        "MongoDB transactions are not supported by the current server; import ran without a transaction"
      );
      // Reset counts in case any partial progress was recorded before the error
      results.questionsCreated = 0;
      results.testCasesCreated = 0;
      results.questions = [];
      await runImport(validationResults, undefined);
    }

    // Log audit
    await AuditLog.log({
      adminId: req.admin._id,
      action: "UPLOAD_CSV",
      resourceType: "CSV",
      details: {
        filename: req.file.originalname,
        questionsCreated: results.questionsCreated,
        testCasesCreated: results.testCasesCreated,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(201).json({
      success: true,
      message: "CSV uploaded successfully",
      data: {
        ...results,
        transaction: usedTransaction,
      },
    });

  } catch (error) {
    // Rollback transaction on error (safely)
    try {
      if (session?.inTransaction?.()) {
        await session.abortTransaction();
      }
    } catch (abortErr) {
      // Never crash the process because abortTransaction failed
      console.error("[CSV Upload Abort Error]:", abortErr?.message || abortErr);
    }
    
    console.error("[CSV Upload Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to process CSV upload",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Preview CSV without saving
 * POST /api/admin/preview-csv
 */
export const previewCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file provided",
      });
    }

    const rows = await parseCSVBuffer(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty",
      });
    }

    // Validate all rows
    const validationResults = rows.map((row, index) => {
      let testCaseCount = 0;
      if (row.test_cases) {
        try {
          const parsed = JSON.parse(row.test_cases);
          testCaseCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          testCaseCount = 0;
        }
      }

      return {
        rowNumber: index + 2,
        title: row.title || "(missing)",
        difficulty: normalizeDifficulty(row.difficulty) || row.difficulty || "(missing)",
        testCaseCount,
        ...validateRow(row, index),
      };
    });

    const validCount = validationResults.filter(r => r.valid).length;
    const invalidCount = validationResults.filter(r => !r.valid).length;

    res.status(200).json({
      success: true,
      preview: {
        totalRows: rows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        rows: validationResults.slice(0, 50), // Limit preview to 50 rows
      },
    });

  } catch (error) {
    console.error("[CSV Preview Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to preview CSV",
    });
  }
};
