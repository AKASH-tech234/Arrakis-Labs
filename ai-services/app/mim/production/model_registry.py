"""
Model Registry (Phase 4.2)
==========================

Versioned model management with rollback support.

Features:
- Version tracking with metadata
- One-command rollback
- Model comparison
- Audit trail
"""

import json
import logging
import shutil
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ModelVersion:
    """Metadata for a model version."""
    version: str
    model_type: str  # "root_cause" or "subtype"
    created_at: str
    is_active: bool
    
    # Training info
    training_data_hash: Optional[str] = None
    feature_schema_version: Optional[str] = None
    
    # Metrics
    macro_f1: Optional[float] = None
    ece: Optional[float] = None
    
    # Paths
    model_path: Optional[str] = None
    calibrator_path: Optional[str] = None
    
    # Audit
    promoted_at: Optional[str] = None
    promoted_by: Optional[str] = None
    rollback_reason: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ModelRegistry:
    """
    Phase 4.2: Versioned model registry.
    
    Enables:
    - Track all model versions
    - Activate/deactivate models
    - Rollback to previous version
    - Compare model versions
    """
    
    REGISTRY_FILE = "model_registry.json"
    
    def __init__(self, models_dir: str = "app/mim/models"):
        self.models_dir = Path(models_dir)
        self.registry_path = self.models_dir / self.REGISTRY_FILE
        self._versions: Dict[str, List[ModelVersion]] = {}
        self._load()
    
    def _load(self) -> None:
        """Load registry from disk."""
        if self.registry_path.exists():
            try:
                data = json.loads(self.registry_path.read_text())
                for model_type, versions in data.items():
                    self._versions[model_type] = [
                        ModelVersion(**v) for v in versions
                    ]
                logger.info(f"Loaded model registry with {len(data)} model types")
            except Exception as e:
                logger.warning(f"Failed to load registry: {e}")
                self._versions = {}
        else:
            self._versions = {}
    
    def _save(self) -> None:
        """Save registry to disk."""
        data = {
            model_type: [v.to_dict() for v in versions]
            for model_type, versions in self._versions.items()
        }
        self.registry_path.write_text(json.dumps(data, indent=2))
    
    def register(
        self,
        model_type: str,
        version: str,
        model_path: str,
        metrics: Dict[str, float],
        training_data_hash: Optional[str] = None,
        feature_schema_version: Optional[str] = None,
        calibrator_path: Optional[str] = None,
    ) -> ModelVersion:
        """Register a new model version."""
        mv = ModelVersion(
            version=version,
            model_type=model_type,
            created_at=datetime.now(timezone.utc).isoformat(),
            is_active=False,
            training_data_hash=training_data_hash,
            feature_schema_version=feature_schema_version,
            macro_f1=metrics.get("macro_f1"),
            ece=metrics.get("ece"),
            model_path=model_path,
            calibrator_path=calibrator_path,
        )
        
        if model_type not in self._versions:
            self._versions[model_type] = []
        
        self._versions[model_type].append(mv)
        self._save()
        
        logger.info(f"Registered {model_type} version {version}")
        return mv
    
    def activate(
        self,
        model_type: str,
        version: str,
        promoted_by: str = "system",
    ) -> bool:
        """Activate a specific model version (deactivate others)."""
        if model_type not in self._versions:
            logger.error(f"Model type {model_type} not found")
            return False
        
        found = False
        for mv in self._versions[model_type]:
            if mv.version == version:
                mv.is_active = True
                mv.promoted_at = datetime.now(timezone.utc).isoformat()
                mv.promoted_by = promoted_by
                found = True
            else:
                mv.is_active = False
        
        if found:
            self._save()
            logger.info(f"Activated {model_type} version {version}")
        else:
            logger.error(f"Version {version} not found for {model_type}")
        
        return found
    
    def rollback(
        self,
        model_type: str,
        reason: str = "Manual rollback",
    ) -> Optional[ModelVersion]:
        """Rollback to previous active version."""
        if model_type not in self._versions:
            return None
        
        versions = self._versions[model_type]
        if len(versions) < 2:
            logger.warning("No previous version to rollback to")
            return None
        
        # Find current active and previous
        current_active = None
        previous = None
        
        for i, mv in enumerate(versions):
            if mv.is_active:
                current_active = mv
                if i > 0:
                    previous = versions[i - 1]
                break
        
        if not previous:
            # Try to find any previous version
            active_idx = next(
                (i for i, v in enumerate(versions) if v.is_active), 
                len(versions) - 1
            )
            if active_idx > 0:
                previous = versions[active_idx - 1]
        
        if not previous:
            logger.error("No previous version available for rollback")
            return None
        
        # Deactivate current, activate previous
        if current_active:
            current_active.is_active = False
            current_active.rollback_reason = reason
        
        previous.is_active = True
        previous.promoted_at = datetime.now(timezone.utc).isoformat()
        previous.promoted_by = "rollback"
        
        self._save()
        logger.info(f"Rolled back {model_type} to version {previous.version}: {reason}")
        
        return previous
    
    def get_active(self, model_type: str) -> Optional[ModelVersion]:
        """Get currently active version for a model type."""
        if model_type not in self._versions:
            return None
        
        for mv in self._versions[model_type]:
            if mv.is_active:
                return mv
        
        return None
    
    def list_versions(self, model_type: str) -> List[ModelVersion]:
        """List all versions for a model type."""
        return self._versions.get(model_type, [])
    
    def compare(
        self,
        model_type: str,
        version_a: str,
        version_b: str,
    ) -> Dict[str, Any]:
        """Compare two model versions."""
        versions = {v.version: v for v in self._versions.get(model_type, [])}
        
        va = versions.get(version_a)
        vb = versions.get(version_b)
        
        if not va or not vb:
            return {"error": "Version not found"}
        
        return {
            "version_a": va.to_dict(),
            "version_b": vb.to_dict(),
            "comparison": {
                "macro_f1_diff": (vb.macro_f1 or 0) - (va.macro_f1 or 0),
                "ece_diff": (vb.ece or 0) - (va.ece or 0),
                "same_schema": va.feature_schema_version == vb.feature_schema_version,
                "same_data": va.training_data_hash == vb.training_data_hash,
            }
        }


# Global registry instance
_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry


def get_active_model(model_type: str) -> Optional[ModelVersion]:
    """Get the active model version."""
    return get_registry().get_active(model_type)


def rollback_model(model_type: str, reason: str = "Manual rollback") -> Optional[ModelVersion]:
    """Rollback to previous model version."""
    return get_registry().rollback(model_type, reason)
