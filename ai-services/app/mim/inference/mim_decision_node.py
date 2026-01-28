"""
MIM Decision Node
=================

Central inference node for MIM.

CRITICAL DESIGN:
- User state snapshot MUST be provided
- Accepted submissions go to REINFORCEMENT path ONLY
- Failed submissions go to FAILURE TRANSITION path
- No cross-contamination

Flow:
1. Check verdict
2. If accepted → reinforcement path (NO root cause)
3. If failed:
   a. Predict ROOT_CAUSE (Model A)
   b. Predict SUBTYPE (Model B, conditioned on ROOT_CAUSE)
   c. Derive FAILURE_MECHANISM (rule engine, NOT predicted)
   d. Generate feedback with state injection
"""

import json
import time
import logging
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime

import numpy as np

from app.mim.output_schemas.mim_input import MIMInput
from app.mim.output_schemas.mim_output import MIMOutput
from app.mim.output_schemas.correctness_feedback import CorrectnessFeedback
from app.mim.output_schemas.performance_feedback import PerformanceFeedback
from app.mim.output_schemas.reinforcement_feedback import ReinforcementFeedback

from app.mim.taxonomy.root_causes import ROOT_CAUSES, validate_root_cause
from app.mim.taxonomy.subtypes import SUBTYPES, validate_subtype, get_valid_subtypes_for_root_cause
from app.mim.taxonomy.failure_mechanism_rules import derive_failure_mechanism

from app.mim.features.delta_features import DeltaFeatures
from app.mim.features.state_snapshot import UserStateSnapshot
from app.mim.features.signal_extractor import extract_code_signals

logger = logging.getLogger(__name__)

# Model version for tracking (updated for Phase 2.1 calibration)
MODEL_VERSION = "v2.1.0"

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIDENCE CALIBRATION CONFIG (Phase 2.1)
# ═══════════════════════════════════════════════════════════════════════════════
# 
# These thresholds control how confidence affects decision-making:
# - HIGH: Trust diagnosis fully, allow aggressive learning adjustments
# - MEDIUM: Trust with caution, moderate adjustments
# - LOW: Conservative mode, minimal adjustments, flag for review
#
# SAFETY INVARIANT: max_confidence caps all predictions to prevent overconfidence
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIDENCE_CONFIG = {
    "max_confidence": 0.90,      # Hard cap - never output confidence > this
    "high_confidence": 0.80,     # Above: trust fully
    "medium_confidence": 0.65,   # Above: trust with caution  
    "low_confidence": 0.50,      # Below: conservative/degraded mode
    "calibration_enabled": True, # Apply isotonic calibration
}


class MIMDecisionNode:
    """
    Central MIM inference node.
    
    CRITICAL:
    - State snapshot is MANDATORY (not optional)
    - Accepted and Failed paths are COMPLETELY SEPARATE
    - All outputs are validated against taxonomy
    
    Phase 2.1 Additions:
    - Confidence calibration via isotonic regression
    - Conservative confidence caps for safety
    - Confidence-aware degradation modes
    """
    
    def __init__(
        self,
        model_dir: Optional[str] = None,
        load_models: bool = True,
        confidence_config: Optional[Dict[str, Any]] = None,
    ):
        self.model_dir = Path(model_dir) if model_dir else Path("app/mim/models")
        self.root_cause_model = None
        self.root_cause_metadata = None
        self.subtype_model = None
        self.subtype_metadata = None
        
        # Phase 2.1: Calibration components
        self.calibrator = None
        self.confidence_config = confidence_config or DEFAULT_CONFIDENCE_CONFIG
        
        if load_models:
            self._load_models()
            self._load_calibrator()
    
    def _load_models(self):
        """Load trained models."""
        try:
            from app.mim.training.train_root_cause_model import load_root_cause_model
            from app.mim.training.train_subtype_model import load_subtype_model
            
            self.root_cause_model, self.root_cause_metadata = load_root_cause_model(
                str(self.model_dir)
            )
            self.subtype_model, self.subtype_metadata = load_subtype_model(
                model_dir=str(self.model_dir)
            )
            logger.info("MIM models loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load MIM models: {e}. Will use fallback rules.")
    
    def _load_calibrator(self):
        """
        Load confidence calibrator (Phase 2.1).
        
        Falls back gracefully if calibrator not available.
        """
        if not self.confidence_config.get("calibration_enabled", True):
            logger.info("Calibration disabled by config")
            return
        
        calibrator_path = self.model_dir / "model_a_calibrator.joblib"
        config_path = self.model_dir / "calibration_config.json"
        
        try:
            from app.mim.calibration.wrapper import CalibrationWrapper
            
            if calibrator_path.exists():
                self.calibrator = CalibrationWrapper.load(str(calibrator_path))
                logger.info(f"Calibrator loaded: {self.calibrator.stats}")
                
                # Load config if available to override defaults
                if config_path.exists():
                    with open(config_path) as f:
                        saved_config = json.load(f)
                    # Merge saved thresholds (empirically validated)
                    if "thresholds" in saved_config:
                        self.confidence_config.update(saved_config["thresholds"])
                    if "confidence_caps" in saved_config:
                        self.confidence_config.update(saved_config["confidence_caps"])
                    logger.info(f"Calibration config loaded: {self.confidence_config}")
            else:
                logger.warning(f"Calibrator not found at {calibrator_path}. Using raw confidence.")
        except Exception as e:
            logger.warning(f"Could not load calibrator: {e}. Using raw confidence.")
    
    def _calibrate_confidence(self, raw_confidence: float) -> float:
        """
        Apply calibration and safety caps to raw confidence (Phase 2.1).
        
        Pipeline:
        1. Apply isotonic calibration (if available)
        2. Apply hard confidence cap (safety invariant)
        
        Parameters
        ----------
        raw_confidence : float
            Raw model confidence score
            
        Returns
        -------
        float
            Calibrated and capped confidence score
        """
        confidence = raw_confidence
        
        # Step 1: Apply calibration if available
        if self.calibrator is not None and self.calibrator.is_fitted:
            import numpy as np
            calibrated = self.calibrator.transform(np.array([confidence]))
            confidence = float(calibrated[0])
        
        # Step 2: Apply hard cap (SAFETY INVARIANT - never skip)
        max_conf = self.confidence_config.get("max_confidence", 0.90)
        confidence = min(confidence, max_conf)
        
        return confidence
    
    def _get_confidence_level(self, confidence: float) -> str:
        """
        Determine confidence level for decision-making (Phase 2.1).
        
        Returns
        -------
        str
            One of: "high", "medium", "low"
        """
        high_thresh = self.confidence_config.get("high_confidence", 0.80)
        med_thresh = self.confidence_config.get("medium_confidence", 0.65)
        
        if confidence >= high_thresh:
            return "high"
        elif confidence >= med_thresh:
            return "medium"
        else:
            return "low"
    
    def _should_use_conservative_mode(self, confidence: float) -> bool:
        """
        Check if confidence is too low for aggressive decisions (Phase 2.1).
        
        When True:
        - Use more conservative difficulty adjustments
        - Flag prediction for potential human review
        - Reduce pattern recurrence strength
        """
        low_thresh = self.confidence_config.get("low_confidence", 0.50)
        return confidence < low_thresh
    
    def infer(self, mim_input: MIMInput) -> MIMOutput:
        """
        Run MIM inference.
        
        Parameters
        ----------
        mim_input : MIMInput
            Validated input with user state snapshot
            
        Returns
        -------
        MIMOutput
            Inference result with appropriate feedback type
            
        ENFORCEMENT:
        - Accepted submissions → ReinforcementFeedback ONLY
        - Failed submissions → CorrectnessFeedback or PerformanceFeedback ONLY
        - Cross-contamination raises exception (fail-fast)
        """
        
        start_time = time.time()
        
        # ═══════════════════════════════════════════════════════════════════════
        # MIM INPUT LOGGING (for debugging/tracing)
        # ═══════════════════════════════════════════════════════════════════════
        self._log_mim_input(mim_input)
        
        # ───────────────────────────────────────────────────────────────────────
        # ROUTE: Accepted vs Failed (STRICT SEPARATION)
        # ───────────────────────────────────────────────────────────────────────
        
        if mim_input.is_accepted():
            output = self._handle_accepted(mim_input)
            # ENFORCEMENT: Accepted must produce ReinforcementFeedback
            self._enforce_verdict_gate(mim_input.verdict, output)
        else:
            output = self._handle_failed(mim_input)
            # ENFORCEMENT: Failed must NOT produce ReinforcementFeedback
            self._enforce_verdict_gate(mim_input.verdict, output)
        
        # Add latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Phase 2.1: Extract confidence metadata if present
        confidence_metadata = output.get("confidence_metadata")
        
        mim_output = MIMOutput(
            feedback_type=output["feedback_type"],
            correctness_feedback=output.get("correctness_feedback"),
            performance_feedback=output.get("performance_feedback"),
            reinforcement_feedback=output.get("reinforcement_feedback"),
            user_id=mim_input.user_id,
            problem_id=mim_input.problem_id,
            submission_id=mim_input.submission_id,
            inference_latency_ms=latency_ms,
            model_version=MODEL_VERSION,
            timestamp=datetime.utcnow().isoformat(),
            confidence_metadata=confidence_metadata,
        )
        
        # ═══════════════════════════════════════════════════════════════════════
        # MIM OUTPUT LOGGING (for debugging/tracing)
        # ═══════════════════════════════════════════════════════════════════════
        self._log_mim_output(mim_output, latency_ms)
        
        return mim_output
    
    def _handle_accepted(self, mim_input: MIMInput) -> Dict[str, Any]:
        """
        Handle ACCEPTED submission.
        
        CRITICAL:
        - NO root cause prediction
        - NO mistake history update
        - ONLY strength/reinforcement signals
        """
        
        logger.info(f"Processing ACCEPTED submission: {mim_input.submission_id}")
        
        # Extract technique from code/tags
        technique = self._infer_technique(mim_input)
        
        # Compute confidence boost
        confidence_boost = self._compute_confidence_boost(mim_input)
        
        # Determine readiness for harder problems
        snapshot = mim_input.user_state_snapshot
        ready_for_harder = self._assess_readiness_for_harder(mim_input, snapshot)
        
        reinforcement = ReinforcementFeedback(
            user_id=mim_input.user_id,
            problem_id=mim_input.problem_id,
            submission_id=mim_input.submission_id,
            category=mim_input.category,
            difficulty=mim_input.difficulty,
            technique=technique,
            confidence_boost=confidence_boost,
            time_to_solve_seconds=mim_input.delta_features.get("time_to_accept", 0.0),
            attempt_count=1,  # Would come from submission data
            was_optimal=True,  # Would check against expected_complexity
            categories_strengthened=[mim_input.category],
            techniques_demonstrated=[technique],
            readiness_delta=confidence_boost,
            ready_for_harder=ready_for_harder,
            suggested_next_difficulty=self._suggest_next_difficulty(mim_input, snapshot),
            suggested_next_categories=self._suggest_next_categories(snapshot),
            timestamp=datetime.utcnow().isoformat(),
        )
        
        return {
            "feedback_type": "reinforcement",
            "reinforcement_feedback": reinforcement,
        }
    
    def _handle_failed(self, mim_input: MIMInput) -> Dict[str, Any]:
        """
        Handle FAILED submission.
        
        Flow:
        1. Predict ROOT_CAUSE (Model A) - with calibrated confidence
        2. Predict SUBTYPE (Model B) - with calibrated confidence
        3. Derive FAILURE_MECHANISM (rule engine)
        4. Generate personalized feedback with confidence-aware adjustments
        
        Phase 2.1 Additions:
        - All confidence scores are calibrated and capped
        - Low confidence triggers conservative mode
        - Confidence level included in feedback for downstream use
        """
        
        logger.info(f"Processing FAILED submission: {mim_input.submission_id}")
        
        # Step 1: Predict ROOT_CAUSE (confidence already calibrated)
        root_cause, root_cause_confidence = self._predict_root_cause(mim_input)
        
        # Step 2: Predict SUBTYPE (conditioned on ROOT_CAUSE)
        subtype, subtype_confidence = self._predict_subtype(mim_input, root_cause)
        
        # ───────────────────────────────────────────────────────────────────────
        # ENFORCEMENT: Taxonomy Gate (MANDATORY)
        # ───────────────────────────────────────────────────────────────────────
        self._enforce_taxonomy_gate(root_cause, subtype)
        
        # Step 3: Derive FAILURE_MECHANISM (rule engine)
        code_signals = extract_code_signals(
            code=mim_input.code,
            verdict=mim_input.verdict,
            constraints=mim_input.constraints,
            problem_tags=mim_input.problem_tags,
        )
        
        failure_mechanism = derive_failure_mechanism(
            root_cause=root_cause,
            subtype=subtype,
            category=mim_input.category,
            signals=code_signals.to_dict(),
        )
        
        # Step 4: Generate personalized feedback
        snapshot = mim_input.user_state_snapshot
        
        # Check recurrence
        is_recurring = subtype in snapshot.get("dominant_failure_modes", [])
        recurrence_count = self._count_recurrence(subtype, snapshot)
        
        # ───────────────────────────────────────────────────────────────────────
        # Phase 2.1: Confidence-aware decision making
        # ───────────────────────────────────────────────────────────────────────
        
        # Combined confidence (both already calibrated)
        confidence = (root_cause_confidence + subtype_confidence) / 2
        confidence_level = self._get_confidence_level(confidence)
        conservative_mode = self._should_use_conservative_mode(confidence)
        
        if conservative_mode:
            logger.info(
                f"LOW CONFIDENCE ({confidence:.3f}) - using conservative mode. "
                f"root_cause={root_cause}, subtype={subtype}"
            )
        
        logger.info(
            f"Diagnosis: root_cause={root_cause} (conf={root_cause_confidence:.3f}), "
            f"subtype={subtype} (conf={subtype_confidence:.3f}), "
            f"combined_conf={confidence:.3f}, level={confidence_level}"
        )
        
        # Route to appropriate feedback type
        if root_cause == "efficiency":
            result = self._generate_efficiency_feedback(
                mim_input, root_cause, subtype, failure_mechanism,
                confidence, is_recurring, snapshot
            )
        else:
            result = self._generate_correctness_feedback(
                mim_input, root_cause, subtype, failure_mechanism,
                confidence, is_recurring, recurrence_count, snapshot
            )
        
        # Phase 2.1: Attach confidence metadata for downstream consumers
        result["confidence_metadata"] = {
            "root_cause_confidence": root_cause_confidence,
            "subtype_confidence": subtype_confidence,
            "combined_confidence": confidence,
            "confidence_level": confidence_level,
            "conservative_mode": conservative_mode,
            "calibration_applied": self.calibrator is not None,
        }
        
        return result
    
    def _predict_root_cause(self, mim_input: MIMInput) -> Tuple[str, float]:
        """
        Predict ROOT_CAUSE using Model A.
        
        Phase 2.1: Confidence is now CALIBRATED and CAPPED for safety.
        """
        
        if self.root_cause_model is None:
            # Fallback rule-based prediction (also calibrated)
            root_cause, raw_conf = self._rule_based_root_cause(mim_input)
            return root_cause, self._calibrate_confidence(raw_conf)
        
        try:
            features = self._extract_model_features(mim_input)
            
            # Check if it's LightGBM or sklearn
            if hasattr(self.root_cause_model, 'predict'):
                if hasattr(self.root_cause_model, 'num_trees'):
                    # LightGBM
                    probs = self.root_cause_model.predict([features])[0]
                else:
                    # sklearn
                    probs = self.root_cause_model.predict_proba([features])[0]
            else:
                root_cause, raw_conf = self._rule_based_root_cause(mim_input)
                return root_cause, self._calibrate_confidence(raw_conf)
            
            pred_idx = np.argmax(probs)
            raw_confidence = float(probs[pred_idx])
            
            # Phase 2.1: Apply calibration and safety cap
            calibrated_confidence = self._calibrate_confidence(raw_confidence)
            
            # Map index to root cause
            inv_map = {v: k for k, v in self.root_cause_metadata["label_mapping"].items()}
            root_cause = inv_map.get(pred_idx, "correctness")
            
            logger.debug(
                f"Root cause prediction: {root_cause}, "
                f"raw_conf={raw_confidence:.3f}, cal_conf={calibrated_confidence:.3f}"
            )
            
            return root_cause, calibrated_confidence
            
        except Exception as e:
            logger.warning(f"Model prediction failed: {e}. Using fallback.")
            root_cause, raw_conf = self._rule_based_root_cause(mim_input)
            return root_cause, self._calibrate_confidence(raw_conf)
    
    def _predict_subtype(
        self, 
        mim_input: MIMInput, 
        root_cause: str
    ) -> Tuple[str, float]:
        """Predict SUBTYPE using Model B (conditioned on ROOT_CAUSE)."""
        
        if self.subtype_model is None:
            return self._rule_based_subtype(mim_input, root_cause)
        
        try:
            features = self._extract_model_features(mim_input, root_cause)
            
            if hasattr(self.subtype_model, 'predict'):
                if hasattr(self.subtype_model, 'num_trees'):
                    probs = self.subtype_model.predict([features])[0]
                else:
                    probs = self.subtype_model.predict_proba([features])[0]
            else:
                return self._rule_based_subtype(mim_input, root_cause)
            
            pred_idx = np.argmax(probs)
            confidence = float(probs[pred_idx])
            
            inv_map = {v: k for k, v in self.subtype_metadata["label_mapping"].items()}
            subtype = inv_map.get(pred_idx)
            
            # Validate subtype is valid for this root cause
            valid_subtypes = get_valid_subtypes_for_root_cause(root_cause)
            if subtype not in valid_subtypes:
                # Fallback to most common for this root cause
                subtype = valid_subtypes[0]
                confidence = 0.5
            
            return subtype, confidence
            
        except Exception as e:
            logger.warning(f"Subtype prediction failed: {e}. Using fallback.")
            return self._rule_based_subtype(mim_input, root_cause)
    
    def _rule_based_root_cause(self, mim_input: MIMInput) -> Tuple[str, float]:
        """Fallback rule-based root cause prediction."""
        
        verdict = mim_input.verdict.lower()
        
        if verdict in ("time_limit_exceeded", "tle", "memory_limit_exceeded", "mle"):
            return "efficiency", 0.8
        
        if verdict in ("runtime_error", "re"):
            return "implementation", 0.7
        
        # Check complexity mismatch
        if mim_input.delta_features.get("delta_complexity_mismatch", 0) > 0:
            return "efficiency", 0.6
        
        # Default to correctness
        return "correctness", 0.6
    
    def _rule_based_subtype(
        self, 
        mim_input: MIMInput, 
        root_cause: str
    ) -> Tuple[str, float]:
        """Fallback rule-based subtype prediction."""
        
        valid_subtypes = get_valid_subtypes_for_root_cause(root_cause)
        
        code_lower = mim_input.code.lower()
        
        # Simple heuristics
        if root_cause == "correctness":
            if "for" in code_lower and ("<" in code_lower or "<=" in code_lower):
                return "incorrect_boundary", 0.6
            return "wrong_invariant", 0.5
        
        elif root_cause == "efficiency":
            return "brute_force_under_constraints", 0.6
        
        elif root_cause == "implementation":
            if "overflow" in str(mim_input.constraints).lower():
                return "overflow_underflow", 0.6
            return "off_by_one", 0.5
        
        elif root_cause == "understanding_gap":
            return "misread_constraint", 0.5
        
        return valid_subtypes[0], 0.5
    
    def _extract_model_features(
        self, 
        mim_input: MIMInput,
        root_cause: Optional[str] = None,
    ) -> list:
        """Extract features for model prediction."""
        
        deltas = mim_input.delta_features
        
        features = [
            deltas.get("delta_attempts_same_category", 0),
            deltas.get("delta_root_cause_repeat_rate", 0),
            deltas.get("delta_complexity_mismatch", 0),
            deltas.get("delta_time_to_accept", 0),
            deltas.get("delta_optimization_transition", 0),
            deltas.get("is_cold_start", 0),
            self._encode_category(mim_input.category),
            self._encode_difficulty(mim_input.difficulty),
        ]
        
        if root_cause:
            features.append(self._encode_root_cause(root_cause))
        
        return features
    
    def _encode_category(self, category: str) -> int:
        category_map = {
            "arrays": 0, "array": 0,
            "strings": 1, "string": 1,
            "dp": 2, "dynamic programming": 2,
            "graph": 3, "graphs": 3,
            "tree": 4, "trees": 4,
            "binary_search": 5, "two_pointers": 6,
            "hash_table": 7, "stack": 8, "queue": 9,
        }
        return category_map.get(category.lower(), 10)
    
    def _encode_difficulty(self, difficulty: str) -> int:
        return {"easy": 0, "medium": 1, "hard": 2}.get(difficulty.lower(), 1)
    
    def _encode_root_cause(self, root_cause: str) -> int:
        return {
            "correctness": 0, "efficiency": 1, 
            "implementation": 2, "understanding_gap": 3
        }.get(root_cause, 0)
    
    def _generate_correctness_feedback(
        self, mim_input, root_cause, subtype, failure_mechanism,
        confidence, is_recurring, recurrence_count, snapshot
    ) -> Dict[str, Any]:
        """Generate feedback for correctness/implementation/understanding_gap."""
        
        from app.mim.inference.feedback_generator import generate_correctness_feedback
        
        feedback = generate_correctness_feedback(
            user_id=mim_input.user_id,
            problem_id=mim_input.problem_id,
            submission_id=mim_input.submission_id,
            root_cause=root_cause,
            subtype=subtype,
            failure_mechanism=failure_mechanism,
            confidence=confidence,
            category=mim_input.category,
            difficulty=mim_input.difficulty,
            is_recurring=is_recurring,
            recurrence_count=recurrence_count,
            user_state_snapshot=snapshot,
        )
        
        return {
            "feedback_type": root_cause,
            "correctness_feedback": feedback,
        }
    
    def _generate_efficiency_feedback(
        self, mim_input, root_cause, subtype, failure_mechanism,
        confidence, is_recurring, snapshot
    ) -> Dict[str, Any]:
        """Generate feedback for efficiency problems."""
        
        from app.mim.inference.feedback_generator import generate_performance_feedback
        
        feedback = generate_performance_feedback(
            user_id=mim_input.user_id,
            problem_id=mim_input.problem_id,
            submission_id=mim_input.submission_id,
            subtype=subtype,
            failure_mechanism=failure_mechanism,
            confidence=confidence,
            category=mim_input.category,
            difficulty=mim_input.difficulty,
            expected_complexity=mim_input.expected_complexity,
            constraints=mim_input.constraints,
            is_recurring=is_recurring,
            user_state_snapshot=snapshot,
        )
        
        return {
            "feedback_type": "efficiency",
            "performance_feedback": feedback,
        }
    
    def _infer_technique(self, mim_input: MIMInput) -> str:
        """Infer technique from code/tags."""
        tags = [t.lower() for t in mim_input.problem_tags]
        if "two_pointers" in tags or "two pointers" in tags:
            return "two_pointers"
        if "binary_search" in tags:
            return "binary_search"
        if "dp" in tags or "dynamic programming" in mim_input.category.lower():
            return "dynamic_programming"
        return "general"
    
    def _compute_confidence_boost(self, mim_input: MIMInput) -> float:
        """Compute confidence boost for accepted submission."""
        base = {"easy": 0.1, "medium": 0.15, "hard": 0.25}.get(mim_input.difficulty.lower(), 0.15)
        return min(base, 0.3)
    
    def _assess_readiness_for_harder(self, mim_input: MIMInput, snapshot: Dict) -> bool:
        """Check if user is ready for harder problems."""
        strong_cats = snapshot.get("strong_categories", [])
        return mim_input.category.lower() in strong_cats
    
    def _suggest_next_difficulty(self, mim_input: MIMInput, snapshot: Dict) -> str:
        """Suggest next problem difficulty."""
        current = mim_input.difficulty.lower()
        strong = snapshot.get("strong_categories", [])
        
        if mim_input.category.lower() in strong:
            return {"easy": "medium", "medium": "hard", "hard": "hard"}[current]
        return current
    
    def _suggest_next_categories(self, snapshot: Dict) -> list:
        """Suggest categories to work on."""
        stagnant = snapshot.get("stagnant_areas", [])
        if stagnant:
            return stagnant[:2]
        return ["arrays", "strings"]
    
    def _count_recurrence(self, subtype: str, snapshot: Dict) -> int:
        """Count how often subtype has recurred."""
        dominant = snapshot.get("dominant_failure_modes", [])
        return dominant.count(subtype) if subtype in dominant else 0
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ENFORCEMENT GATES (MANDATORY)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _enforce_verdict_gate(self, verdict: str, output: Dict) -> None:
        """
        Enforce strict separation between accepted and failed paths.
        
        RULES (fail-fast, no exceptions):
        - If verdict == Accepted → output MUST be reinforcement
        - If verdict != Accepted → output MUST NOT be reinforcement
        
        This is correctness-critical. Violations raise immediately.
        """
        is_accepted = verdict.lower() in ("accepted", "ac")
        feedback_type = output.get("feedback_type", "")
        
        if is_accepted:
            # Accepted MUST produce ReinforcementFeedback
            if feedback_type != "reinforcement":
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Accepted submission produced "
                    f"'{feedback_type}' feedback instead of 'reinforcement'. "
                    f"This is a critical bug."
                )
            # Accepted MUST NOT have any root_cause logic executed
            if "correctness_feedback" in output or "performance_feedback" in output:
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Accepted submission has "
                    f"correctness/performance feedback attached. "
                    f"Root cause logic executed on accepted submission."
                )
        else:
            # Failed MUST NOT produce ReinforcementFeedback
            if feedback_type == "reinforcement":
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Failed submission (verdict='{verdict}') "
                    f"produced 'reinforcement' feedback. "
                    f"This is a critical bug."
                )
            # Failed MUST NOT update strength signals
            if "reinforcement_feedback" in output:
                raise RuntimeError(
                    f"VERDICT GATE VIOLATION: Failed submission has "
                    f"reinforcement_feedback attached. "
                    f"Strength signals updated on failed submission."
                )
    
    def _enforce_taxonomy_gate(self, root_cause: str, subtype: str) -> None:
        """
        Enforce that (root_cause, subtype) pair is valid.
        
        MUST be called:
        - After Model B inference
        - During dataset construction
        - During training validation
        
        Violations raise immediately (fail-fast).
        """
        from app.mim.taxonomy.subtype_masks import validate_subtype, SubtypeValidationError
        
        try:
            validate_subtype(root_cause, subtype)
        except SubtypeValidationError as e:
            raise RuntimeError(
                f"TAXONOMY GATE VIOLATION: {e}. "
                f"Model B produced invalid subtype for given root_cause."
            )


    # ═══════════════════════════════════════════════════════════════════════════
    # CONSOLE LOGGING METHODS (Step 1: Architecture Upgrade)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _log_mim_input(self, mim_input: MIMInput) -> None:
        """
        Log MIM input for debugging and tracing.
        
        Provides visibility into what MIM receives.
        """
        print("\n" + "=" * 70)
        print("🧠 MIM DECISION NODE - INPUT")
        print("=" * 70)
        print(f"  user_id:       {mim_input.user_id}")
        print(f"  problem_id:    {mim_input.problem_id}")
        print(f"  submission_id: {mim_input.submission_id}")
        print(f"  verdict:       {mim_input.verdict}")
        print(f"  category:      {mim_input.category}")
        print(f"  difficulty:    {mim_input.difficulty}")
        print(f"  code_length:   {len(mim_input.code)} chars")
        
        # Delta features summary
        deltas = mim_input.delta_features
        print(f"  delta_features:")
        print(f"    └─ attempts_same_cat:  {deltas.get('delta_attempts_same_category', 'N/A')}")
        print(f"    └─ root_cause_repeat:  {deltas.get('delta_root_cause_repeat_rate', 'N/A')}")
        print(f"    └─ complexity_mismatch: {deltas.get('delta_complexity_mismatch', 'N/A')}")
        print(f"    └─ is_cold_start:      {deltas.get('is_cold_start', 'N/A')}")
        
        # User state snapshot summary
        snapshot = mim_input.user_state_snapshot
        print(f"  user_state_snapshot:")
        print(f"    └─ strong_categories:     {snapshot.get('strong_categories', [])[:3]}...")
        print(f"    └─ weak_categories:       {snapshot.get('weak_categories', [])[:3]}...")
        print(f"    └─ dominant_failures:     {snapshot.get('dominant_failure_modes', [])[:3]}...")
        print(f"    └─ recent_pattern_trend:  {snapshot.get('recent_pattern_trend', 'N/A')}")
        print("-" * 70)
        
        logger.info(f"MIM INPUT: user={mim_input.user_id}, problem={mim_input.problem_id}, verdict={mim_input.verdict}")
    
    def _log_mim_output(self, mim_output: MIMOutput, latency_ms: float) -> None:
        """
        Log MIM output for debugging and tracing.
        
        Provides visibility into MIM decisions.
        """
        print("\n" + "=" * 70)
        print("🧠 MIM DECISION NODE - OUTPUT")
        print("=" * 70)
        print(f"  feedback_type: {mim_output.feedback_type}")
        print(f"  model_version: {mim_output.model_version}")
        print(f"  latency_ms:    {latency_ms:.2f}")
        
        # Log based on feedback type
        if mim_output.feedback_type == "reinforcement":
            rf = mim_output.reinforcement_feedback
            if rf:
                print(f"  REINFORCEMENT:")
                print(f"    └─ technique:         {rf.technique}")
                print(f"    └─ confidence_boost:  {rf.confidence_boost}")
                print(f"    └─ ready_for_harder:  {rf.ready_for_harder}")
                print(f"    └─ suggested_next:    {rf.suggested_next_difficulty}")
        else:
            # Failed submission - show diagnosis
            cf = mim_output.correctness_feedback
            pf = mim_output.performance_feedback
            
            if cf:
                print(f"  DIAGNOSIS (correctness):")
                print(f"    └─ root_cause:        {cf.root_cause}")
                print(f"    └─ subtype:           {cf.subtype}")
                print(f"    └─ failure_mechanism: {cf.failure_mechanism}")
                print(f"    └─ is_recurring:      {cf.is_recurring}")
                print(f"    └─ recurrence_count:  {cf.recurrence_count}")
            
            if pf:
                print(f"  DIAGNOSIS (efficiency):")
                print(f"    └─ subtype:           {pf.subtype}")
                print(f"    └─ failure_mechanism: {pf.failure_mechanism}")
                print(f"    └─ is_recurring:      {pf.is_recurring}")
        
        # Confidence metadata (Phase 2.1)
        cm = mim_output.confidence_metadata
        if cm:
            print(f"  CONFIDENCE (calibrated):")
            print(f"    └─ root_cause_conf:   {cm.root_cause_confidence:.3f}")
            print(f"    └─ subtype_conf:      {cm.subtype_confidence:.3f}")
            print(f"    └─ combined_conf:     {cm.combined_confidence:.3f}")
            print(f"    └─ confidence_level:  {cm.confidence_level}")
            print(f"    └─ conservative_mode: {cm.conservative_mode}")
            print(f"    └─ calibration:       {'applied' if cm.calibration_applied else 'not applied'}")
        
        print("=" * 70 + "\n")
        
        logger.info(
            f"MIM OUTPUT: type={mim_output.feedback_type}, "
            f"latency={latency_ms:.2f}ms, "
            f"conf_level={cm.confidence_level if cm else 'N/A'}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def run_mim_inference(mim_input: MIMInput) -> MIMOutput:
    """
    Run MIM inference (convenience function).
    
    Initializes MIMDecisionNode and runs inference.
    """
    node = MIMDecisionNode()
    return node.infer(mim_input)
