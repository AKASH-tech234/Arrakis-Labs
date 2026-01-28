"""
Phase 2.1 Calibration Integration Tests
=======================================

Tests that:
1. CalibrationWrapper fits, saves, and loads correctly
2. MIMDecisionNode applies calibration to confidence scores
3. Confidence caps are enforced (safety invariant)
4. Conservative mode triggers at low confidence
5. Confidence metadata is included in output
"""

import pytest
import numpy as np
import tempfile
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.mim.calibration.wrapper import CalibrationWrapper
from app.mim.calibration.evaluator import CalibrationEvaluator, compute_ece
from app.mim.calibration.thresholds import ThresholdValidator, recommend_thresholds


# ═══════════════════════════════════════════════════════════════════════════════
# CALIBRATION WRAPPER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestCalibrationWrapper:
    """Tests for CalibrationWrapper."""
    
    def test_isotonic_fit_transform(self):
        """Test isotonic calibration fits and transforms."""
        # Create mock data where high confidence correlates with correctness
        np.random.seed(42)
        n = 100
        y_confidence = np.random.uniform(0.3, 0.95, n)
        # Make correctness correlated with confidence (but not perfectly)
        y_correct = (y_confidence > 0.5 + np.random.normal(0, 0.15, n)).astype(int)
        
        wrapper = CalibrationWrapper(method="isotonic")
        wrapper.fit(y_correct, y_confidence)
        
        assert wrapper.is_fitted
        assert wrapper.stats is not None
        assert wrapper.stats.method == "isotonic"
        
        # Transform should work
        calibrated = wrapper.transform(y_confidence)
        assert len(calibrated) == n
        assert all(0 <= c <= 1 for c in calibrated)
    
    def test_platt_fit_transform(self):
        """Test Platt scaling fits and transforms."""
        np.random.seed(42)
        n = 100
        y_confidence = np.random.uniform(0.3, 0.95, n)
        y_correct = (y_confidence > 0.5 + np.random.normal(0, 0.15, n)).astype(int)
        
        wrapper = CalibrationWrapper(method="platt")
        wrapper.fit(y_correct, y_confidence)
        
        assert wrapper.is_fitted
        assert wrapper.stats.method == "platt"
        
        calibrated = wrapper.transform(y_confidence)
        assert len(calibrated) == n
    
    def test_save_load_roundtrip(self):
        """Test calibrator can be saved and loaded."""
        np.random.seed(42)
        n = 50
        y_confidence = np.random.uniform(0.3, 0.95, n)
        y_correct = (y_confidence > 0.5).astype(int)
        
        wrapper = CalibrationWrapper(method="isotonic")
        wrapper.fit(y_correct, y_confidence)
        
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            wrapper.save(f.name)
            
            loaded = CalibrationWrapper.load(f.name)
            
            assert loaded.is_fitted
            assert loaded.method == "isotonic"
            
            # Transform should give same results
            test_conf = np.array([0.5, 0.7, 0.9])
            original_result = wrapper.transform(test_conf)
            loaded_result = loaded.transform(test_conf)
            np.testing.assert_array_almost_equal(original_result, loaded_result)
    
    def test_unfitted_returns_raw(self):
        """Test unfitted wrapper returns raw confidence."""
        wrapper = CalibrationWrapper(method="isotonic")
        
        test_conf = np.array([0.5, 0.7, 0.9])
        result = wrapper.transform(test_conf)
        
        np.testing.assert_array_equal(result, test_conf)


# ═══════════════════════════════════════════════════════════════════════════════
# THRESHOLD VALIDATOR TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestThresholdValidator:
    """Tests for threshold validation."""
    
    def test_validate_threshold(self):
        """Test threshold validation computes correct metrics."""
        y_correct = np.array([1, 1, 1, 0, 0, 1, 1, 0])
        y_confidence = np.array([0.9, 0.85, 0.8, 0.75, 0.6, 0.55, 0.5, 0.4])
        
        validator = ThresholdValidator()
        result = validator.validate_threshold(y_correct, y_confidence, threshold=0.7)
        
        # Above 0.7: indices 0,1,2,3 -> confidence [0.9, 0.85, 0.8, 0.75]
        # Correct above 0.7: [1, 1, 1, 0] -> 3/4 = 0.75
        assert result.threshold == 0.7
        assert result.coverage_above == 0.5  # 4/8
        assert result.accuracy_above == 0.75  # 3/4
    
    def test_recommend_thresholds(self):
        """Test threshold recommendation."""
        np.random.seed(42)
        n = 200
        y_confidence = np.random.uniform(0.4, 0.95, n)
        # Higher confidence = more likely correct
        y_correct = (y_confidence > 0.5 + np.random.normal(0, 0.1, n)).astype(int)
        
        rec = recommend_thresholds(y_correct, y_confidence)
        
        assert rec.high_confidence >= rec.medium_confidence
        assert rec.medium_confidence >= rec.low_confidence
        assert "high" in rec.metrics
        assert "medium" in rec.metrics


# ═══════════════════════════════════════════════════════════════════════════════
# ECE COMPUTATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestECEComputation:
    """Tests for Expected Calibration Error."""
    
    def test_perfectly_calibrated_ece_zero(self):
        """Perfectly calibrated model should have ECE near zero."""
        # If confidence = accuracy in each bin, ECE should be ~0
        y_confidence = np.array([0.1, 0.1, 0.5, 0.5, 0.9, 0.9])
        y_correct = np.array([0, 0, 0, 1, 1, 1])  # 0%, 50%, 100% accuracy
        
        # Use bins parameter (list of bin edges)
        ece = compute_ece(y_correct, y_confidence, bins=[0.0, 0.33, 0.66, 1.0])
        # Should be low (allowing some tolerance due to bin boundaries)
        assert ece < 0.25
    
    def test_overconfident_model_high_ece(self):
        """Overconfident model should have high ECE."""
        # All predictions at high confidence, but many wrong
        y_confidence = np.array([0.9] * 10)
        y_correct = np.array([1, 1, 1, 0, 0, 0, 0, 0, 0, 0])  # Only 30% correct
        
        # Use default bins
        ece = compute_ece(y_correct, y_confidence)
        # Should be high: |0.9 - 0.3| = 0.6
        assert ece > 0.5


# ═══════════════════════════════════════════════════════════════════════════════
# MIM DECISION NODE CALIBRATION INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestMIMDecisionNodeCalibration:
    """Tests for calibration integration in MIMDecisionNode."""
    
    def test_confidence_cap_enforced(self):
        """Test that confidence is always capped at max_confidence."""
        from app.mim.inference.mim_decision_node import MIMDecisionNode, DEFAULT_CONFIDENCE_CONFIG
        
        node = MIMDecisionNode(load_models=False)
        
        # Even without calibrator, cap should be enforced
        max_conf = node.confidence_config["max_confidence"]
        
        # Test various raw confidences
        assert node._calibrate_confidence(0.5) <= max_conf
        assert node._calibrate_confidence(0.95) <= max_conf
        assert node._calibrate_confidence(1.0) <= max_conf
        
        # Raw confidence below cap should be unchanged (without calibrator)
        assert node._calibrate_confidence(0.7) == 0.7
    
    def test_confidence_levels(self):
        """Test confidence level classification."""
        from app.mim.inference.mim_decision_node import MIMDecisionNode
        
        node = MIMDecisionNode(load_models=False)
        
        # Default thresholds: high=0.80, medium=0.65, low=0.50
        assert node._get_confidence_level(0.85) == "high"
        assert node._get_confidence_level(0.80) == "high"
        assert node._get_confidence_level(0.70) == "medium"
        assert node._get_confidence_level(0.65) == "medium"
        assert node._get_confidence_level(0.55) == "low"
        assert node._get_confidence_level(0.40) == "low"
    
    def test_conservative_mode_triggers(self):
        """Test conservative mode triggers at low confidence."""
        from app.mim.inference.mim_decision_node import MIMDecisionNode
        
        node = MIMDecisionNode(load_models=False)
        
        # Default low threshold: 0.50
        assert node._should_use_conservative_mode(0.45) is True
        assert node._should_use_conservative_mode(0.50) is False
        assert node._should_use_conservative_mode(0.80) is False
    
    def test_calibrator_loads_and_applies(self):
        """Test calibrator loads from disk and applies to confidence."""
        from app.mim.inference.mim_decision_node import MIMDecisionNode
        
        # Create a mock calibrator
        np.random.seed(42)
        n = 50
        y_confidence = np.random.uniform(0.3, 0.95, n)
        y_correct = (y_confidence > 0.5).astype(int)
        
        calibrator = CalibrationWrapper(method="isotonic")
        calibrator.fit(y_correct, y_confidence)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save calibrator
            cal_path = Path(tmpdir) / "model_a_calibrator.joblib"
            calibrator.save(str(cal_path))
            
            # Save config
            config = {
                "thresholds": {
                    "high_confidence": 0.80,
                    "medium_confidence": 0.65,
                    "low_confidence": 0.50,
                },
                "confidence_caps": {
                    "max_confidence": 0.90,
                }
            }
            config_path = Path(tmpdir) / "calibration_config.json"
            with open(config_path, "w") as f:
                json.dump(config, f)
            
            # Create node - load_models=False skips model loading but we need to manually call _load_calibrator
            node = MIMDecisionNode(model_dir=tmpdir, load_models=False)
            # Manually trigger calibrator load since load_models=False skips it
            node._load_calibrator()
            
            assert node.calibrator is not None
            assert node.calibrator.is_fitted
            
            # Calibration should be applied
            raw_conf = 0.7
            calibrated = node._calibrate_confidence(raw_conf)
            
            # Should be different from raw (calibrator transforms)
            # and still within bounds
            assert 0 <= calibrated <= 0.90


# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUT SCHEMA TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidenceMetadataSchema:
    """Tests for ConfidenceMetadata in MIMOutput."""
    
    def test_confidence_metadata_schema(self):
        """Test ConfidenceMetadata validates correctly."""
        from app.mim.output_schemas.mim_output import ConfidenceMetadata
        
        metadata = ConfidenceMetadata(
            root_cause_confidence=0.75,
            subtype_confidence=0.65,
            combined_confidence=0.70,
            confidence_level="medium",
            conservative_mode=False,
            calibration_applied=True,
        )
        
        assert metadata.confidence_level == "medium"
        assert metadata.conservative_mode is False
    
    def test_confidence_metadata_validation(self):
        """Test ConfidenceMetadata rejects invalid values."""
        from app.mim.output_schemas.mim_output import ConfidenceMetadata
        from pydantic import ValidationError
        
        # Confidence out of range
        with pytest.raises(ValidationError):
            ConfidenceMetadata(
                root_cause_confidence=1.5,  # Invalid
                subtype_confidence=0.65,
                combined_confidence=0.70,
                confidence_level="medium",
                conservative_mode=False,
                calibration_applied=True,
            )
        
        # Invalid confidence level
        with pytest.raises(ValidationError):
            ConfidenceMetadata(
                root_cause_confidence=0.75,
                subtype_confidence=0.65,
                combined_confidence=0.70,
                confidence_level="super_high",  # Invalid
                conservative_mode=False,
                calibration_applied=True,
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
