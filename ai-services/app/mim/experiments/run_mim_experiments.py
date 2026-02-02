#!/usr/bin/env python3
"""
MIM Experiment Harness
======================

A lightweight experimentation tool for observing MIM behavior with custom inputs.

This script:
1. Loads test cases from mim_test_inputs.json
2. Constructs valid MIM input objects
3. Executes MIM decision flow exactly as production
4. Captures and displays all intermediate and final outputs

CRITICAL: This does NOT modify MIM behavior. It only observes.

Usage:
    python run_mim_experiments.py                     # Run all cases
    python run_mim_experiments.py --case beginner_struggling
    python run_mim_experiments.py --verbose           # Show all intermediate outputs
    python run_mim_experiments.py --list              # List available cases
"""

import argparse
import io
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ═══════════════════════════════════════════════════════════════════════════════
# WINDOWS ENCODING FIX
# ═══════════════════════════════════════════════════════════════════════════════
# On Windows, the default console encoding (cp1252) cannot handle Unicode emojis.
# We force UTF-8 output to avoid UnicodeEncodeError in the MIM decision node logging.

if sys.platform == "win32":
    # Set environment variable for Python subprocesses
    os.environ["PYTHONIOENCODING"] = "utf-8"
    # Reconfigure stdout/stderr if possible (Python 3.7+)
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            # Fallback: wrap streams
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("mim.experiments")


# ═══════════════════════════════════════════════════════════════════════════════
# INPUT LOADING
# ═══════════════════════════════════════════════════════════════════════════════

def load_test_cases(input_file: Path) -> Dict[str, Any]:
    """
    Load test cases from JSON file.
    
    Parameters
    ----------
    input_file : Path
        Path to mim_test_inputs.json
        
    Returns
    -------
    Dict[str, Any]
        Parsed test cases
        
    Raises
    ------
    FileNotFoundError
        If input file does not exist
    json.JSONDecodeError
        If JSON is malformed
    ValueError
        If required structure is missing
    """
    if not input_file.exists():
        raise FileNotFoundError(f"Test inputs file not found: {input_file}")
    
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Validate structure
    if "cases" not in data:
        raise ValueError("Test inputs must contain 'cases' key at root level")
    
    if not isinstance(data["cases"], dict):
        raise ValueError("'cases' must be a dictionary of named test cases")
    
    if len(data["cases"]) == 0:
        raise ValueError("At least one test case must be defined")
    
    return data


def list_available_cases(cases: Dict[str, Any]) -> None:
    """Print available test cases with descriptions."""
    print("\n" + "═" * 70)
    print("AVAILABLE TEST CASES")
    print("═" * 70)
    
    for name, case_data in cases.items():
        desc = case_data.get("description", "No description")
        verdict = case_data.get("submission", {}).get("verdict", "unknown")
        difficulty = case_data.get("problem_context", {}).get("difficulty", "unknown")
        print(f"\n  {name}")
        print(f"    Description: {desc}")
        print(f"    Verdict: {verdict} | Difficulty: {difficulty}")
    
    print("\n" + "═" * 70)


# ═══════════════════════════════════════════════════════════════════════════════
# INPUT VALIDATION & CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════════

def validate_test_case(case_name: str, case_data: Dict[str, Any]) -> List[str]:
    """
    Validate that a test case has all required fields.
    
    Returns list of validation errors (empty if valid).
    """
    errors = []
    
    # Required top-level keys
    required_keys = ["description", "submission", "problem_context", "user_state", "delta_features"]
    for key in required_keys:
        if key not in case_data:
            errors.append(f"Missing required key: {key}")
    
    # Validate submission structure
    submission = case_data.get("submission", {})
    submission_required = ["user_id", "problem_id", "submission_id", "code", "verdict"]
    for key in submission_required:
        if key not in submission:
            errors.append(f"submission.{key} is required")
    
    # Validate problem_context structure
    problem_ctx = case_data.get("problem_context", {})
    problem_required = ["category", "difficulty", "expected_complexity", "constraints", "problem_tags"]
    for key in problem_required:
        if key not in problem_ctx:
            errors.append(f"problem_context.{key} is required")
    
    # Validate user_state structure (required for MIMInput)
    user_state = case_data.get("user_state", {})
    state_required = ["dominant_failure_modes", "improving_areas", "stagnant_areas"]
    for key in state_required:
        if key not in user_state:
            errors.append(f"user_state.{key} is required (used in user_state_snapshot)")
    
    # Validate delta_features for failed submissions
    verdict = submission.get("verdict", "").lower()
    if verdict not in ("accepted", "ac"):
        delta = case_data.get("delta_features", {})
        delta_required = ["delta_attempts_same_category", "delta_root_cause_repeat_rate", "is_cold_start"]
        for key in delta_required:
            if key not in delta:
                errors.append(f"delta_features.{key} is required for failed submissions")
    
    return errors


def build_mim_input(case_name: str, case_data: Dict[str, Any]) -> "MIMInput":
    """
    Construct a valid MIMInput from test case data.
    
    This uses the production MIMInput schema to ensure compatibility.
    
    Parameters
    ----------
    case_name : str
        Name of the test case (for error messages)
    case_data : Dict[str, Any]
        Test case data from JSON
        
    Returns
    -------
    MIMInput
        Validated input object ready for MIM inference
        
    Raises
    ------
    ValueError
        If input data is invalid
    """
    from app.mim.output_schemas.mim_input import MIMInput
    
    submission = case_data["submission"]
    problem_ctx = case_data["problem_context"]
    user_state = case_data["user_state"]
    delta_features = case_data.get("delta_features", {})
    
    # Build the user_state_snapshot dict (matches MIMInput validator expectations)
    user_state_snapshot = {
        "user_id": submission["user_id"],
        "dominant_failure_modes": user_state.get("dominant_failure_modes", []),
        "dominant_root_causes": user_state.get("dominant_root_causes", []),
        "improving_areas": user_state.get("improving_areas", []),
        "stagnant_areas": user_state.get("stagnant_areas", []),
        "regressing_areas": user_state.get("regressing_areas", []),
        "strong_categories": user_state.get("strong_categories", []),
        "strong_techniques": user_state.get("strong_techniques", []),
        "recent_transitions": user_state.get("recent_transitions", {
            "brute_force_to_optimized": False,
            "optimized_to_brute_force": False,
            "new_category_attempted": False,
        }),
        "total_failed": user_state.get("total_failed", 0),
        "total_accepted": user_state.get("total_accepted", 0),
        "history_span_days": user_state.get("history_span_days", 0),
        "snapshot_timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    
    # Build delta_features dict with defaults for required fields
    delta_dict = {
        "delta_attempts_same_category": delta_features.get("delta_attempts_same_category", 0.0),
        "delta_root_cause_repeat_rate": delta_features.get("delta_root_cause_repeat_rate", 0.0),
        "delta_complexity_mismatch": delta_features.get("delta_complexity_mismatch", 0.0),
        "delta_time_to_accept": delta_features.get("delta_time_to_accept", 0.0),
        "delta_optimization_transition": delta_features.get("delta_optimization_transition", 0.0),
        "is_cold_start": delta_features.get("is_cold_start", 1.0),
    }
    
    try:
        mim_input = MIMInput(
            user_id=submission["user_id"],
            problem_id=submission["problem_id"],
            submission_id=submission["submission_id"],
            code=submission["code"],
            verdict=submission["verdict"],
            category=problem_ctx["category"],
            difficulty=problem_ctx["difficulty"],
            expected_complexity=problem_ctx["expected_complexity"],
            constraints=problem_ctx["constraints"],
            problem_tags=problem_ctx["problem_tags"],
            user_state_snapshot=user_state_snapshot,
            delta_features=delta_dict,
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
        )
        return mim_input
    except Exception as e:
        raise ValueError(f"Failed to construct MIMInput for case '{case_name}': {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# MIM EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def run_mim_inference(mim_input: "MIMInput", verbose: bool = False) -> Dict[str, Any]:
    """
    Execute MIM inference using the production decision node.
    
    Parameters
    ----------
    mim_input : MIMInput
        Validated input object
    verbose : bool
        If True, capture intermediate outputs
        
    Returns
    -------
    Dict[str, Any]
        Complete result including:
        - raw_input: The input data
        - feature_snapshot: Features used by model
        - pattern_detection: Pattern engine results
        - difficulty_decision: Difficulty action
        - roadmap_decision: Roadmap signals (if applicable)
        - final_output: Complete MIMOutput
        - execution_metadata: Timing and version info
    """
    from app.mim.inference.mim_decision_node import MIMDecisionNode
    from app.mim.features.signal_extractor import extract_code_signals
    from app.mim.taxonomy.failure_mechanism_rules import derive_failure_mechanism
    
    result = {
        "raw_input": None,
        "feature_snapshot": None,
        "code_signals": None,
        "pattern_detection": None,
        "difficulty_decision": None,
        "final_output": None,
        "execution_metadata": {},
    }
    
    start_time = time.time()
    
    # Store raw input
    result["raw_input"] = {
        "user_id": mim_input.user_id,
        "problem_id": mim_input.problem_id,
        "submission_id": mim_input.submission_id,
        "verdict": mim_input.verdict,
        "category": mim_input.category,
        "difficulty": mim_input.difficulty,
        "expected_complexity": mim_input.expected_complexity,
        "constraints": mim_input.constraints,
        "problem_tags": mim_input.problem_tags,
    }
    
    # Feature snapshot
    result["feature_snapshot"] = {
        "delta_features": mim_input.delta_features,
        "user_state_snapshot": mim_input.user_state_snapshot,
    }
    
    # Extract code signals (intermediate)
    if verbose:
        code_signals = extract_code_signals(
            code=mim_input.code,
            verdict=mim_input.verdict,
            constraints=mim_input.constraints,
            problem_tags=mim_input.problem_tags,
        )
        result["code_signals"] = code_signals.to_dict()
    
    # Run MIM decision node
    try:
        decision_node = MIMDecisionNode(load_models=True)
        mim_output = decision_node.infer(mim_input)
        
        # Extract output components
        result["final_output"] = {
            "feedback_type": mim_output.feedback_type,
            "user_id": mim_output.user_id,
            "problem_id": mim_output.problem_id,
            "submission_id": mim_output.submission_id,
            "inference_latency_ms": mim_output.inference_latency_ms,
            "model_version": mim_output.model_version,
            "timestamp": mim_output.timestamp,
        }
        
        # Add confidence metadata if present
        if mim_output.confidence_metadata:
            result["final_output"]["confidence_metadata"] = {
                "root_cause_confidence": mim_output.confidence_metadata.root_cause_confidence,
                "subtype_confidence": mim_output.confidence_metadata.subtype_confidence,
                "combined_confidence": mim_output.confidence_metadata.combined_confidence,
                "confidence_level": mim_output.confidence_metadata.confidence_level,
                "conservative_mode": mim_output.confidence_metadata.conservative_mode,
                "calibration_applied": mim_output.confidence_metadata.calibration_applied,
            }
        
        # Extract feedback details based on type
        feedback = mim_output.get_feedback()
        feedback_dict = feedback.model_dump() if hasattr(feedback, 'model_dump') else feedback.dict()
        result["final_output"]["feedback"] = feedback_dict
        
        # Pattern detection (extracted from feedback if available)
        if hasattr(feedback, 'is_recurring'):
            result["pattern_detection"] = {
                "is_recurring": feedback.is_recurring,
                "recurrence_count": getattr(feedback, 'recurrence_count', 0),
                "related_past_problems": getattr(feedback, 'related_past_problems', []),
            }
        
        # Difficulty decision (derived from user state)
        if mim_output.feedback_type == "reinforcement":
            result["difficulty_decision"] = {
                "ready_for_harder": getattr(feedback, 'ready_for_harder', False),
                "suggested_next_difficulty": getattr(feedback, 'suggested_next_difficulty', None),
            }
        
    except Exception as e:
        logger.error(f"MIM inference failed: {e}", exc_info=True)
        result["final_output"] = {"error": str(e)}
    
    # Execution metadata
    result["execution_metadata"] = {
        "total_time_ms": (time.time() - start_time) * 1000,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUT FORMATTING
# ═══════════════════════════════════════════════════════════════════════════════

def format_result(case_name: str, description: str, result: Dict[str, Any], verbose: bool = False) -> str:
    """Format experiment result for display."""
    lines = []
    
    lines.append("\n" + "═" * 80)
    lines.append(f"EXPERIMENT: {case_name}")
    lines.append(f"Description: {description}")
    lines.append("═" * 80)
    
    # Raw Input Summary
    raw = result.get("raw_input", {})
    lines.append("\n┌─ RAW INPUT ───────────────────────────────────────────────────────────────────")
    lines.append(f"│ User: {raw.get('user_id', 'N/A')} | Problem: {raw.get('problem_id', 'N/A')}")
    lines.append(f"│ Verdict: {raw.get('verdict', 'N/A')} | Category: {raw.get('category', 'N/A')} | Difficulty: {raw.get('difficulty', 'N/A')}")
    lines.append(f"│ Expected Complexity: {raw.get('expected_complexity', 'N/A')}")
    lines.append(f"│ Problem Tags: {', '.join(raw.get('problem_tags', []))}")
    lines.append("└───────────────────────────────────────────────────────────────────────────────")
    
    # Feature Snapshot
    features = result.get("feature_snapshot", {})
    delta = features.get("delta_features", {})
    lines.append("\n┌─ FEATURE SNAPSHOT ────────────────────────────────────────────────────────────")
    lines.append(f"│ Delta Attempts (Same Category): {delta.get('delta_attempts_same_category', 0):.2f}")
    lines.append(f"│ Delta Root Cause Repeat Rate:   {delta.get('delta_root_cause_repeat_rate', 0):.2f}")
    lines.append(f"│ Delta Complexity Mismatch:      {delta.get('delta_complexity_mismatch', 0):.2f}")
    lines.append(f"│ Is Cold Start:                  {delta.get('is_cold_start', 1.0):.0f}")
    
    snapshot = features.get("user_state_snapshot", {})
    lines.append(f"│ Dominant Failure Modes: {', '.join(snapshot.get('dominant_failure_modes', [])) or 'None'}")
    lines.append(f"│ Improving Areas: {', '.join(snapshot.get('improving_areas', [])) or 'None'}")
    lines.append(f"│ Stagnant Areas: {', '.join(snapshot.get('stagnant_areas', [])) or 'None'}")
    lines.append("└───────────────────────────────────────────────────────────────────────────────")
    
    # Code Signals (verbose only)
    if verbose and result.get("code_signals"):
        signals = result["code_signals"]
        lines.append("\n┌─ CODE SIGNALS ─────────────────────────────────────────────────────────────────")
        active_signals = [k for k, v in signals.items() if v and k != "verdict" and k != "extras"]
        lines.append(f"│ Active: {', '.join(active_signals) if active_signals else 'None detected'}")
        lines.append("└───────────────────────────────────────────────────────────────────────────────")
    
    # Pattern Detection
    pattern = result.get("pattern_detection", {})
    if pattern:
        lines.append("\n┌─ PATTERN DETECTION ────────────────────────────────────────────────────────────")
        lines.append(f"│ Is Recurring: {pattern.get('is_recurring', False)}")
        lines.append(f"│ Recurrence Count: {pattern.get('recurrence_count', 0)}")
        related = pattern.get('related_past_problems', [])
        lines.append(f"│ Related Past Problems: {', '.join(related[:3]) if related else 'None'}")
        lines.append("└───────────────────────────────────────────────────────────────────────────────")
    
    # Difficulty Decision
    difficulty = result.get("difficulty_decision", {})
    if difficulty:
        lines.append("\n┌─ DIFFICULTY DECISION ──────────────────────────────────────────────────────────")
        lines.append(f"│ Ready for Harder: {difficulty.get('ready_for_harder', 'N/A')}")
        lines.append(f"│ Suggested Next: {difficulty.get('suggested_next_difficulty', 'N/A')}")
        lines.append("└───────────────────────────────────────────────────────────────────────────────")
    
    # Final MIM Output
    output = result.get("final_output", {})
    lines.append("\n┌─ FINAL MIM VERDICT ────────────────────────────────────────────────────────────")
    
    if "error" in output:
        lines.append(f"│ ⚠️  ERROR: {output['error']}")
    else:
        lines.append(f"│ Feedback Type: {output.get('feedback_type', 'N/A')}")
        lines.append(f"│ Model Version: {output.get('model_version', 'N/A')}")
        lines.append(f"│ Inference Latency: {output.get('inference_latency_ms', 0):.2f}ms")
        
        # Confidence metadata
        conf = output.get("confidence_metadata", {})
        if conf:
            lines.append(f"│")
            lines.append(f"│ Confidence:")
            lines.append(f"│   Root Cause: {conf.get('root_cause_confidence', 0):.1%}")
            lines.append(f"│   Subtype: {conf.get('subtype_confidence', 0):.1%}")
            lines.append(f"│   Combined: {conf.get('combined_confidence', 0):.1%}")
            lines.append(f"│   Level: {conf.get('confidence_level', 'N/A')}")
            lines.append(f"│   Conservative Mode: {conf.get('conservative_mode', False)}")
        
        # Feedback details
        feedback = output.get("feedback", {})
        if feedback:
            lines.append(f"│")
            lines.append(f"│ Feedback Details:")
            
            if "root_cause" in feedback:
                lines.append(f"│   Root Cause: {feedback.get('root_cause', 'N/A')}")
                lines.append(f"│   Subtype: {feedback.get('subtype', 'N/A')}")
                lines.append(f"│   Failure Mechanism: {feedback.get('failure_mechanism', 'N/A')}")
                if verbose:
                    lines.append(f"│   Explanation: {feedback.get('explanation', 'N/A')[:100]}...")
                    lines.append(f"│   Fix Direction: {feedback.get('fix_direction', 'N/A')[:100]}...")
            elif "technique" in feedback:
                # Reinforcement feedback
                lines.append(f"│   Category: {feedback.get('category', 'N/A')}")
                lines.append(f"│   Technique: {feedback.get('technique', 'N/A')}")
                lines.append(f"│   Confidence Boost: {feedback.get('confidence_boost', 0):.1%}")
                lines.append(f"│   Strength Signal: {feedback.get('strength_signal', 'N/A')}")
    
    lines.append("└───────────────────────────────────────────────────────────────────────────────")
    
    # Execution Metadata
    meta = result.get("execution_metadata", {})
    lines.append(f"\nTotal Execution Time: {meta.get('total_time_ms', 0):.2f}ms")
    
    return "\n".join(lines)


def print_json_result(case_name: str, result: Dict[str, Any]) -> None:
    """Print result as formatted JSON."""
    print(json.dumps({case_name: result}, indent=2, default=str))


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """Main entry point for the experiment harness."""
    parser = argparse.ArgumentParser(
        description="MIM Experiment Harness - Observe MIM behavior with custom inputs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_mim_experiments.py                      # Run all cases
  python run_mim_experiments.py --case beginner_struggling
  python run_mim_experiments.py --verbose            # Show intermediate outputs
  python run_mim_experiments.py --json               # Output as JSON
  python run_mim_experiments.py --list               # List available cases
        """
    )
    
    parser.add_argument(
        "--case", "-c",
        type=str,
        help="Run only the specified test case"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show all intermediate outputs (code signals, etc.)"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output results as JSON instead of formatted text"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available test cases and exit"
    )
    parser.add_argument(
        "--input-file", "-f",
        type=str,
        default=None,
        help="Path to test inputs JSON file (default: mim_test_inputs.json in same directory)"
    )
    
    args = parser.parse_args()
    
    # Determine input file path
    script_dir = Path(__file__).parent
    input_file = Path(args.input_file) if args.input_file else script_dir / "mim_test_inputs.json"
    
    # Load test cases
    try:
        data = load_test_cases(input_file)
    except Exception as e:
        logger.error(f"Failed to load test cases: {e}")
        sys.exit(1)
    
    cases = data["cases"]
    
    # Handle --list
    if args.list:
        list_available_cases(cases)
        sys.exit(0)
    
    # Determine which cases to run
    if args.case:
        if args.case not in cases:
            logger.error(f"Unknown case: '{args.case}'. Use --list to see available cases.")
            sys.exit(1)
        cases_to_run = {args.case: cases[args.case]}
    else:
        cases_to_run = cases
    
    # Run experiments
    all_results = {}
    
    for case_name, case_data in cases_to_run.items():
        logger.info(f"Running experiment: {case_name}")
        
        # Validate test case
        validation_errors = validate_test_case(case_name, case_data)
        if validation_errors:
            logger.error(f"Validation failed for '{case_name}':")
            for err in validation_errors:
                logger.error(f"  - {err}")
            continue
        
        # Build MIMInput
        try:
            mim_input = build_mim_input(case_name, case_data)
        except ValueError as e:
            logger.error(f"Failed to build MIMInput for '{case_name}': {e}")
            continue
        
        # Run inference
        result = run_mim_inference(mim_input, verbose=args.verbose)
        all_results[case_name] = result
        
        # Output result
        if args.json:
            print_json_result(case_name, result)
        else:
            formatted = format_result(
                case_name,
                case_data.get("description", "No description"),
                result,
                verbose=args.verbose
            )
            print(formatted)
    
    # Summary
    if not args.json and len(cases_to_run) > 1:
        print("\n" + "═" * 80)
        print(f"EXPERIMENT SUMMARY: {len(all_results)} / {len(cases_to_run)} cases completed")
        print("═" * 80)


if __name__ == "__main__":
    main()
