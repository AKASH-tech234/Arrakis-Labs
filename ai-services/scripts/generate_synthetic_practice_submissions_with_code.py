"""\
Deterministic Synthetic Practice-Style Submissions WITH CODE (Phase 1.3)
========================================================================

Generates a synthetic, practice-shaped submission stream for training MIM.

Goals:
- Practice semantics: multiple attempts per problem, wrong→accepted transitions
- Deterministic labels from injected bug mechanism (root_cause + subtype)
- Deterministic code signals: code is real (Python/C++) and includes patterns that
  the code-signal extractor can detect (loops, indexing, recursion, etc.)

Output:
- JSON array of submissions suitable for DatasetBuilder.build_from_mongodb_export

Usage:
  python scripts/generate_synthetic_practice_submissions_with_code.py \
    --out data/mim/synth_submissions_with_code_v1.json \
    --n 10000 \
    --seed 42

Contract:
Each record includes at minimum:
- submission_id, userId, questionId, verdict, language, timestamp, code
And for failed submissions:
- root_cause, subtype

This is synthetic NOW; later, the same contract will be satisfied by MongoDB exports.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import random


ROOT_CAUSES = ["correctness", "efficiency", "implementation", "understanding_gap"]
SUBTYPES = [
    "wrong_invariant",
    "incorrect_boundary",
    "partial_case_handling",
    "state_loss",
    "brute_force_under_constraints",
    "premature_optimization",
    "misread_constraint",
]

# Synthetic realism knobs
# Fraction of samples whose CODE template is intentionally "mismatched" vs the label.
# This breaks trivial label recovery and forces probabilistic boundaries.
# Increase ambiguity until leakage gates pass (synthetic realism)
AMBIGUOUS_TEMPLATE_RATE = 0.40
# Additionally, sometimes pick a different template within the same root cause to avoid
# subtype-specific structural shortcuts.
INTRA_ROOT_TEMPLATE_RATE = 0.20

# Simple category/difficulty universe
CATEGORIES = ["arrays", "two_pointers", "binary_search", "dynamic_programming", "graphs"]
DIFFICULTIES = ["easy", "medium", "hard"]

LANGUAGES = ["python", "cpp"]


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat() + "Z"


def _pick_weighted(rng: random.Random, items: List[Tuple[str, float]]) -> str:
    total = sum(w for _, w in items)
    x = rng.random() * total
    s = 0.0
    for item, w in items:
        s += w
        if x <= s:
            return item
    return items[-1][0]


def _taxonomy_for(subtype: str) -> str:
    """Deterministic mapping from subtype to primary root cause (taxonomy-compatible)."""
    if subtype in ("wrong_invariant", "incorrect_boundary", "partial_case_handling"):
        return "correctness"
    if subtype in ("brute_force_under_constraints", "premature_optimization"):
        return "efficiency"
    if subtype == "state_loss":
        return "implementation"
    if subtype == "misread_constraint":
        return "understanding_gap"
    return "implementation"


# ─────────────────────────────────────────────────────────────────────────────
# CODE TEMPLATES
# ─────────────────────────────────────────────────────────────────────────────


def _py_header() -> str:
    return """\
import sys

def solve(data: str) -> str:
    # synthetic practice submission
"""


def _py_footer() -> str:
    return """\

def main():
    data = sys.stdin.read()
    sys.stdout.write(solve(data))

if __name__ == '__main__':
    main()
"""


def _cpp_header() -> str:
    return """\
#include <bits/stdc++.h>
using namespace std;

int main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
"""


def _cpp_footer() -> str:
    return """\
    return 0;
}
"""


def _inject_distractors(language: str, style: str) -> str:
    """Inject label-independent structural distractors.

    Purpose: break trivial label recovery from a few code-signal features.
    These blocks are deterministic and typically dead-code / non-impacting.

    style: one of {"flat", "nested", "recursion", "indexing", "mixed"}
    """
    if style == "flat":
        return ""

    if language == "python":
        if style == "mixed":
            # Combine multiple structural signals in dead code to reduce
            # label-correlated separability.
            return (
                _inject_distractors(language, "nested")
                + _inject_distractors(language, "recursion")
                + _inject_distractors(language, "indexing")
            )
        if style == "nested":
            return (
                "    # distractor: nested loops (dead code)\n"
                "    if False:\n"
                "        tmp = 0\n"
                "        for i in range(10):\n"
                "            for j in range(10):\n"
                "                tmp += i + j\n"
            )
        if style == "recursion":
            return (
                "    # distractor: recursion (unused)\n"
                "    def _unused_rec(k):\n"
                "        if k <= 0: return 0\n"
                "        return 1 + _unused_rec(k-1)\n"
                "    if False: _unused_rec(5)\n"
            )
        if style == "indexing":
            return (
                "    # distractor: indexing arithmetic (dead code)\n"
                "    if False:\n"
                "        a = [1,2,3,4]\n"
                "        for i in range(len(a)-1):\n"
                "            _ = a[i+1] - a[i]\n"
            )
        return ""

    # C++
    if style == "mixed":
        return (
            _inject_distractors(language, "nested")
            + _inject_distractors(language, "recursion")
            + _inject_distractors(language, "indexing")
        )
    if style == "nested":
        return (
            "    // distractor: nested loops (dead code)\n"
            "    if(false){ long long tmp=0; for(int i=0;i<10;i++){ for(int j=0;j<10;j++){ tmp += i+j; } } }\n"
        )
    if style == "recursion":
        return (
            "    // distractor: recursion (unused)\n"
            "    function<int(int)> _unused_rec = [&](int k){ if(k<=0) return 0; return 1 + _unused_rec(k-1); };\n"
            "    if(false){ cout<<_unused_rec(5); }\n"
        )
    if style == "indexing":
        return (
            "    // distractor: indexing arithmetic (dead code)\n"
            "    if(false){ vector<int> a={1,2,3,4}; for(int i=0;i+1<(int)a.size();i++){ int d=a[i+1]-a[i]; (void)d; } }\n"
        )
    return ""


def _make_code(subtype: str, language: str, is_fixed: bool, style: str) -> Tuple[str, str]:
    """Return (code, verdict_hint). verdict_hint used to choose runtime/TLE/WA."""

    if language == "python":
        body = []
        verdict_hint = "wrong_answer"

        if subtype == "incorrect_boundary":
            # off-by-one: arr[i+1] loop goes to len(arr)
            verdict_hint = "runtime_error" if not is_fixed else "accepted"
            body.append("    arr = [int(x) for x in data.split()]\n")
            body.append("    if not arr: return '0'\n")
            body.append("    ok = 1\n")
            if not is_fixed:
                body.append("    for i in range(len(arr)):\n")
                body.append("        if arr[i] > arr[i+1]:\n")
                body.append("            ok = 0\n")
            else:
                body.append("    for i in range(len(arr)-1):\n")
                body.append("        if arr[i] > arr[i+1]:\n")
                body.append("            ok = 0\n")
            body.append("    return str(ok)\n")

        elif subtype == "partial_case_handling":
            # missing empty check
            verdict_hint = "wrong_answer" if not is_fixed else "accepted"
            body.append("    arr = [int(x) for x in data.split()]\n")
            if not is_fixed:
                body.append("    # BUG: assumes arr has at least 1 element\n")
                body.append("    m = arr[0]\n")
            else:
                body.append("    if not arr: return '0'\n")
                body.append("    m = arr[0]\n")
            body.append("    for x in arr:\n")
            body.append("        if x > m: m = x\n")
            body.append("    return str(m)\n")

        elif subtype == "wrong_invariant":
            # invariant bug in prefix sum
            verdict_hint = "wrong_answer" if not is_fixed else "accepted"
            body.append("    arr = [int(x) for x in data.split()]\n")
            body.append("    s = 0\n")
            body.append("    best = 0\n")
            body.append("    for x in arr:\n")
            if not is_fixed:
                body.append("        # BUG: resets sum incorrectly\n")
                body.append("        s = x\n")
            else:
                body.append("        s += x\n")
            body.append("        if s > best: best = s\n")
            body.append("    return str(best)\n")

        elif subtype == "state_loss":
            # visited reset inside loop
            verdict_hint = "wrong_answer" if not is_fixed else "accepted"
            body.append("    arr = [int(x) for x in data.split()]\n")
            if not is_fixed:
                body.append("    total = 0\n")
                body.append("    for x in arr:\n")
                body.append("        visited = set()  # BUG: reset each iteration\n")
                body.append("        if x not in visited:\n")
                body.append("            visited.add(x)\n")
                body.append("            total += 1\n")
                body.append("    return str(total)\n")
            else:
                body.append("    visited = set()\n")
                body.append("    total = 0\n")
                body.append("    for x in arr:\n")
                body.append("        if x not in visited:\n")
                body.append("            visited.add(x)\n")
                body.append("            total += 1\n")
                body.append("    return str(total)\n")

        elif subtype == "brute_force_under_constraints":
            # nested loops
            verdict_hint = "time_limit_exceeded" if not is_fixed else "accepted"
            body.append("    arr = [int(x) for x in data.split()]\n")
            if not is_fixed:
                body.append("    best = -10**18\n")
                body.append("    for i in range(len(arr)):\n")
                body.append("        for j in range(len(arr)):\n")
                body.append("            best = max(best, arr[i] + arr[j])\n")
                body.append("    return str(best)\n")
            else:
                body.append("    if not arr: return '0'\n")
                body.append("    m = max(arr)\n")
                body.append("    return str(m + m)\n")

        elif subtype == "premature_optimization":
            # "clever" bit trick that misses negatives
            verdict_hint = "wrong_answer" if not is_fixed else "accepted"
            body.append("    arr = [int(x) for x in data.split()]\n")
            if not is_fixed:
                body.append("    # BUG: assumes all numbers non-negative\n")
                body.append("    x = 0\n")
                body.append("    for v in arr: x |= v\n")
                body.append("    return str(x)\n")
            else:
                body.append("    # use correct aggregate\n")
                body.append("    return str(sum(arr))\n")

        elif subtype == "misread_constraint":
            # uses recursion without memo on large n (signals understanding+efficiency)
            verdict_hint = "time_limit_exceeded" if not is_fixed else "accepted"
            body.append("    n = int(data.strip() or '0')\n")
            body.append("    sys.setrecursionlimit(1000000)\n")
            if not is_fixed:
                body.append("    # BUG: naive recursion (misread constraints)\n")
                body.append("    def fib(k):\n")
                body.append("        if k <= 1: return k\n")
                body.append("        return fib(k-1) + fib(k-2)\n")
                body.append("    return str(fib(n))\n")
            else:
                body.append("    # iterative DP\n")
                body.append("    a,b = 0,1\n")
                body.append("    for _ in range(n):\n")
                body.append("        a,b = b,a+b\n")
                body.append("    return str(a)\n")

        else:
            verdict_hint = "wrong_answer" if not is_fixed else "accepted"
            body.append("    return '0'\n")

        distract = _inject_distractors(language="python", style=style)
        code = _py_header() + distract + "".join(body) + _py_footer()
        return code, verdict_hint

    # C++
    body = []
    verdict_hint = "wrong_answer"

    if subtype == "incorrect_boundary":
        verdict_hint = "runtime_error" if not is_fixed else "accepted"
        body.append("    vector<long long> a; long long x; while(cin>>x) a.push_back(x);\n")
        body.append("    if(a.empty()){ cout<<0; return 0; }\n")
        body.append("    int ok=1;\n")
        if not is_fixed:
            body.append("    for(int i=0;i<(int)a.size();i++){ if(a[i]>a[i+1]) ok=0; }\n")
        else:
            body.append("    for(int i=0;i+1<(int)a.size();i++){ if(a[i]>a[i+1]) ok=0; }\n")
        body.append("    cout<<ok;\n")

    elif subtype == "partial_case_handling":
        verdict_hint = "wrong_answer" if not is_fixed else "accepted"
        body.append("    vector<long long> a; long long x; while(cin>>x) a.push_back(x);\n")
        if not is_fixed:
            body.append("    // BUG: assumes a has at least 1 element\n")
            body.append("    long long m=a[0];\n")
        else:
            body.append("    if(a.empty()){ cout<<0; return 0; }\n")
            body.append("    long long m=a[0];\n")
        body.append("    for(auto v:a) if(v>m) m=v;\n")
        body.append("    cout<<m;\n")

    elif subtype == "wrong_invariant":
        verdict_hint = "wrong_answer" if not is_fixed else "accepted"
        body.append("    vector<long long> a; long long x; while(cin>>x) a.push_back(x);\n")
        body.append("    long long s=0,best=0;\n")
        body.append("    for(auto v:a){\n")
        if not is_fixed:
            body.append("        // BUG: resets sum\n        s=v;\n")
        else:
            body.append("        s+=v;\n")
        body.append("        best=max(best,s);\n    }\n")
        body.append("    cout<<best;\n")

    elif subtype == "state_loss":
        verdict_hint = "wrong_answer" if not is_fixed else "accepted"
        body.append("    vector<long long> a; long long x; while(cin>>x) a.push_back(x);\n")
        if not is_fixed:
            body.append("    long long total=0;\n")
            body.append("    for(auto v:a){ unordered_set<long long> vis; if(!vis.count(v)){ vis.insert(v); total++; } }\n")
        else:
            body.append("    unordered_set<long long> vis; long long total=0;\n")
            body.append("    for(auto v:a){ if(!vis.count(v)){ vis.insert(v); total++; } }\n")
        body.append("    cout<<total;\n")

    elif subtype == "brute_force_under_constraints":
        verdict_hint = "time_limit_exceeded" if not is_fixed else "accepted"
        body.append("    vector<long long> a; long long x; while(cin>>x) a.push_back(x);\n")
        if not is_fixed:
            body.append("    long long best=LLONG_MIN;\n")
            body.append("    for(int i=0;i<(int)a.size();i++){\n")
            body.append("        for(int j=0;j<(int)a.size();j++){ best=max(best,a[i]+a[j]); }\n")
            body.append("    }\n")
            body.append("    cout<<best;\n")
        else:
            body.append("    if(a.empty()){ cout<<0; return 0; }\n")
            body.append("    long long m=*max_element(a.begin(),a.end());\n")
            body.append("    cout<<(m+m);\n")

    elif subtype == "premature_optimization":
        verdict_hint = "wrong_answer" if not is_fixed else "accepted"
        body.append("    vector<long long> a; long long x; while(cin>>x) a.push_back(x);\n")
        if not is_fixed:
            body.append("    // BUG: bitwise trick assuming non-negative\n")
            body.append("    long long y=0; for(auto v:a) y |= v; cout<<y;\n")
        else:
            body.append("    long long s=0; for(auto v:a) s+=v; cout<<s;\n")

    elif subtype == "misread_constraint":
        verdict_hint = "time_limit_exceeded" if not is_fixed else "accepted"
        body.append("    long long n; if(!(cin>>n)) n=0;\n")
        if not is_fixed:
            body.append("    // BUG: naive recursion (misread constraints)\n")
            body.append("    function<long long(long long)> fib = [&](long long k){ if(k<=1) return k; return fib(k-1)+fib(k-2); };\n")
            body.append("    cout<<fib(n);\n")
        else:
            body.append("    long long a=0,b=1; for(long long i=0;i<n;i++){ long long c=a+b; a=b; b=c; } cout<<a;\n")

    else:
        verdict_hint = "wrong_answer" if not is_fixed else "accepted"
        body.append("    cout<<0;\n")

    distract = _inject_distractors(language="cpp", style=style)
    code = _cpp_header() + distract + "".join(body) + _cpp_footer()
    return code, verdict_hint


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--n", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--users", type=int, default=1000)
    parser.add_argument("--problems", type=int, default=1200)
    args = parser.parse_args()

    rng = random.Random(args.seed)

    n = args.n
    users = [f"u{idx:04d}" for idx in range(args.users)]
    problems = [f"p{idx:05d}" for idx in range(args.problems)]

    # deterministic time base
    t0 = datetime(2026, 1, 1, 0, 0, 0)

    submissions: List[Dict] = []

    # We generate per-user sessions with repeated attempts per problem.
    sub_id = 0
    for i in range(n):
        # IMPORTANT: decouple label generation from context features.
        # If we derive everything from the same index `i`, models can learn
        # shortcuts via category/difficulty/problem_id rather than behavioral signals.
        user = rng.choice(users)

        # Choose a problem, with repeats to create attempt histories
        problem = rng.choice(problems)

        # Context features sampled independently of label
        category = rng.choice(CATEGORIES)
        difficulty = rng.choice(DIFFICULTIES)

        # Choose language
        language = rng.choice(LANGUAGES)

        # Determine attempt number by counting previous submissions for this (user, problem)
        attempt_number = 1
        for s in reversed(submissions[-200:]):
            if s["userId"] == user and s["questionId"] == problem:
                attempt_number = s.get("attemptNumber", 1) + 1
                break

        # Decide whether this attempt is fixed (accepted) based on attempt number
        # Practice semantics: typically accepted by attempt 2-4.
        # Add small randomness so the same attempt number doesn't deterministically imply verdict.
        fix_threshold = rng.choice([2, 3, 4])
        is_fixed = attempt_number >= fix_threshold

        # Choose a subtype and map to root cause
        # NOTE: subtype remains taxonomy-consistent, but we deliberately inject
        # label-independent structural distractors to avoid trivial separability.
        subtype = rng.choice(SUBTYPES)
        root_cause = _taxonomy_for(subtype)

        # Choose distractor style independent of subtype/root_cause
        style = rng.choice(["flat", "nested", "recursion", "indexing", "mixed"])

        # Generate code
        # Controlled ambiguity: sometimes generate code from a different subtype template
        # to ensure features are not perfectly label-separable.
        template_subtype = subtype
        r = rng.random()
        if r < AMBIGUOUS_TEMPLATE_RATE:
            # Prefer a different root-cause template (max ambiguity)
            other = [s for s in SUBTYPES if _taxonomy_for(s) != root_cause]
            template_subtype = rng.choice(other) if other else rng.choice(SUBTYPES)
        elif r < (AMBIGUOUS_TEMPLATE_RATE + INTRA_ROOT_TEMPLATE_RATE):
            # Different template within same root cause
            same = [s for s in SUBTYPES if _taxonomy_for(s) == root_cause and s != subtype]
            if same:
                template_subtype = rng.choice(same)

        code, verdict_hint = _make_code(template_subtype, language, is_fixed=is_fixed, style=style)
        verdict = "accepted" if is_fixed else verdict_hint

        # Simple tags for context
        tags = [category]
        if category == "binary_search":
            tags.append("binary_search")
        if category == "two_pointers":
            tags.append("two_pointers")
        if category == "dynamic_programming":
            tags.append("dynamic_programming")

        # Constraints (to help code_signals context; deterministic)
        constraints = {"n": 100000 if difficulty == "hard" else 10000 if difficulty == "medium" else 1000}

        # Synthetic time_to_accept proxy
        time_to_accept = 600 + attempt_number * 120 + (i % 60)

        ts = t0 + timedelta(seconds=i * 30)

        rec: Dict = {
            "_id": f"s{sub_id:07d}",
            "submission_id": f"s{sub_id:07d}",
            "userId": user,
            "questionId": problem,
            "verdict": verdict,
            "language": language,
            "timestamp": _iso(ts),
            "code": code,
            "category": category,
            "difficulty": difficulty,
            "tags": tags,
            "constraints": constraints,
            # Optional behavior fields used by delta feature computation
            "attemptNumber": attempt_number,
            "time_to_accept": time_to_accept,
            "used_complexity": "O(n^2)" if subtype == "brute_force_under_constraints" and not is_fixed else "O(n)",
            "expected_complexity": "O(n)" if constraints["n"] >= 10000 else "O(n^2)",
        }

        if verdict != "accepted":
            rec["root_cause"] = root_cause
            rec["subtype"] = subtype

        submissions.append(rec)
        sub_id += 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(submissions, indent=2))

    code_present = sum(1 for s in submissions if isinstance(s.get("code"), str) and s["code"].strip())
    rate = code_present / len(submissions) if submissions else 0.0
    print(f"Wrote {len(submissions)} submissions to {args.out}. code_present_rate={rate:.3f}")


if __name__ == "__main__":
    main()
