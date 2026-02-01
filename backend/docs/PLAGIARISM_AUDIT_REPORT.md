/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM DETECTION SYSTEM - QA AUDIT REPORT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Date: February 1, 2026
 * Reviewer: Senior Backend/QA Engineer
 * 
 * This document contains the full audit of the plagiarism detection system,
 * including bugs found, fairness concerns, scalability issues, and fixes applied.
 */

# PLAGIARISM DETECTION SYSTEM AUDIT REPORT

## EXECUTIVE SUMMARY

The plagiarism detection system is **well-architected** with proper separation of 
concerns, but requires **critical fixes** before production deployment.

### Overall Assessment: ⚠️ REQUIRES FIXES BEFORE PRODUCTION

| Category | Status | Priority |
|----------|--------|----------|
| Correctness | 🔴 Critical bugs found | P0 |
| Fairness | 🟡 Moderate concerns | P1 |
| Scalability | 🟡 Improvements needed | P1 |
| Security | 🟢 Adequate | P2 |
| Testing | 🟡 Incomplete coverage | P1 |

---

## 1. CRITICAL BUGS FOUND (P0)

### BUG-001: Preprocessor State Leak Between Submissions
**File:** `CodePreprocessor.js`
**Severity:** 🔴 CRITICAL
**Impact:** FALSE POSITIVES - Different users' code compared with wrong identifier maps

The preprocessor uses instance variables `identifierMap` and `identifierCounter` 
that are NOT reset between processing different submissions within the same batch.

```javascript
// PROBLEM: Instance state persists
this.identifierCounter = 0;
this.identifierMap = new Map();
```

When processing User A's code, variables get mapped (myVar → VAR1, count → VAR2).
When processing User B's code, if they used "count" first, it would map to VAR2
instead of VAR1, potentially causing false similarity detection.

**FIX APPLIED:** Reset state at START of each preprocess() call.

---

### BUG-002: Missing plagiarismCheck Reference in PlagiarismResult
**File:** `PlagiarismDetectionService.js` (compareSubmissions)
**Severity:** 🔴 CRITICAL
**Impact:** Results cannot be queried by plagiarism check job

The `plagiarismResults` array being inserted is missing the `plagiarismCheck` 
field which is marked as `required: true` in the schema.

```javascript
// PROBLEM: Missing required field
plagiarismResults.push({
  contest: contestId,
  problem: problemId,
  // plagiarismCheck: MISSING!
  ...
});
```

**FIX APPLIED:** Add plagiarismCheck reference to all result documents.

---

### BUG-003: Incorrect problemStatus Field Name
**File:** `PlagiarismDetectionService.js`
**Severity:** 🔴 CRITICAL
**Impact:** Problem status not tracked correctly

The code uses `plagiarismCheck.problemStatus.set()` but the schema defines 
`problemStatuses` as an array, not a Map.

**FIX APPLIED:** Use the correct schema structure for problem statuses.

---

### BUG-004: CheatingGroup Missing Required Fields
**File:** `PlagiarismDetectionService.js` (clusterCheaters)
**Severity:** 🔴 CRITICAL
**Impact:** CheatingGroup documents will fail validation

Creating CheatingGroup without `plagiarismCheck` reference (required field).

**FIX APPLIED:** Add plagiarismCheck reference when creating groups.

---

## 2. FAIRNESS CONCERNS (P1)

### FAIR-001: Same-Language Bias
**Issue:** Cross-language submissions are never compared.
**Impact:** Students could evade detection by submitting in different languages.
**Recommendation:** Add cross-language comparison for algorithmic structure.

### FAIR-002: Submission Time Not Considered
**Issue:** System doesn't track who submitted first.
**Impact:** Both users in a plagiarism pair are equally penalized.
**Recommendation:** Flag the later submitter as potential copier.

### FAIR-003: Template Code False Positives
**Issue:** Common algorithmic patterns (BFS, quicksort) may trigger false positives.
**Impact:** Legitimate independent solutions flagged as plagiarism.
**Recommendation:** 
  - Whitelist known algorithm templates
  - Add "structural uniqueness" threshold
  - Track problem-specific baseline similarity

### FAIR-004: Short Code Penalty Inequality
**Issue:** `minCodeLength: 50` excludes short but valid solutions.
**Impact:** Simple problems with one-liners are never checked.
**Recommendation:** Use percentage-based threshold relative to problem difficulty.

### FAIR-005: Auto-Penalty Without Appeal Period
**Issue:** Penalties applied immediately in `applyPenalties()`.
**Impact:** Users disqualified without chance to explain.
**Recommendation:** Add 48-hour appeal window before auto-penalty.

---

## 3. SCALABILITY ISSUES (P1)

### SCALE-001: O(n²) Comparison Complexity
**Issue:** All-pairs comparison for n submissions = n(n-1)/2 comparisons.
**Impact:** 1000 submissions = 499,500 comparisons (slow).
**Current Mitigation:** Quick winnowing filter (good).
**Recommendation:** Add LSH (Locality Sensitive Hashing) for sub-quadratic.

### SCALE-002: Sequential Problem Processing
**Issue:** Problems processed one at a time.
**Impact:** Large contests with many problems take longer.
**Recommendation:** Process problems in parallel (already have `parallelProblems` option but unused).

### SCALE-003: Individual DB Saves in Vectorization Loop
**Issue:** Each submission's vector saved individually.
**Impact:** N database writes instead of batch.
**Fix Applied:** Use bulkWrite for vector updates.

### SCALE-004: Fetching Original Code for Each Result
**Issue:** In comparison phase, fetching original code per result.
**Impact:** N*2 additional DB queries for matching sections.
**Fix Applied:** Batch fetch original submissions.

---

## 4. SECURITY CONSIDERATIONS (P2 - Adequate)

✅ Admin-only routes properly protected
✅ Results not exposed to users
✅ Audit trail for all admin actions
✅ Sensitive data (full code) only in admin views

---

## 5. TEST COVERAGE GAPS

### Missing Tests:
1. End-to-end integration with real ContestSubmission documents
2. Edge case: Single submission per problem
3. Edge case: All submissions identical (mass cheating)
4. Performance test with 1000+ submissions
5. Cross-language detection (future feature)
6. Resume/retry after failure
7. Concurrent job execution

---

## 6. RECOMMENDATIONS FOR PRODUCTION

### Before Launch:
1. ✅ Apply all P0 bug fixes (done in this audit)
2. Add appeal workflow with 48-hour grace period
3. Add submission timestamp to determine "first submitter"
4. Implement problem-specific similarity baselines
5. Add email notification on penalty (already implemented)

### Post-Launch Monitoring:
1. Track false positive rate (admin overrides)
2. Monitor average similarity by problem type
3. Alert on unusually high plagiarism rates
4. Log processing time per 100 submissions

---

## FIXES APPLIED IN THIS AUDIT

See the following files for applied fixes:
- CodePreprocessor.js - State reset bug
- PlagiarismDetectionService.js - Multiple critical bugs
- New: PlagiarismFairnessUtils.js - Fairness helpers
- test_plagiarism.js - Additional test cases
