"""
User State Store
================

Vector store for persisting user state snapshots.

Uses FAISS for local vector storage with JSON metadata.
"""

import json
import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class UserStateStore:
    """
    Persistent storage for user state snapshots.
    
    Uses file-based storage with optional FAISS embeddings
    for similarity-based retrieval.
    """
    
    def __init__(
        self,
        storage_dir: str = "vector_db/user_states",
        use_faiss: bool = False,
    ):
        """
        Initialize store.
        
        Parameters
        ----------
        storage_dir : str
            Directory for storing user states
        use_faiss : bool
            Whether to use FAISS for similarity search
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.use_faiss = use_faiss
        self._index = None
        self._id_map: List[str] = []
        
        if use_faiss:
            self._init_faiss()
    
    def _init_faiss(self):
        """Initialize FAISS index."""
        try:
            import faiss
            import numpy as np
            
            # 64-dimensional embedding for user state
            self._index = faiss.IndexFlatL2(64)
            logger.info("FAISS index initialized")
        except ImportError:
            logger.warning("FAISS not available, using file-only storage")
            self.use_faiss = False
    
    def get_user_state(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user state by ID.
        
        Parameters
        ----------
        user_id : str
            User identifier
            
        Returns
        -------
        Dict or None
            User state if exists
        """
        file_path = self._user_file(user_id)
        
        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    return json.load(f)
            except json.JSONDecodeError:
                logger.error(f"Corrupted state file for user {user_id}")
                return None
        
        return None
    
    def update_user_state(self, user_id: str, state: Dict[str, Any]) -> None:
        """
        Update user state.
        
        Parameters
        ----------
        user_id : str
            User identifier
        state : dict
            User state to store
        """
        state["user_id"] = user_id
        state["_updated_at"] = datetime.utcnow().isoformat()
        
        file_path = self._user_file(user_id)
        
        with open(file_path, "w") as f:
            json.dump(state, f, indent=2, default=str)
        
        logger.debug(f"Updated state for user {user_id}")
    
    def get_user_strengths(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user strength signals.
        
        Stored separately from failure state.
        """
        file_path = self._strengths_file(user_id)
        
        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return None
        
        return None
    
    def update_user_strengths(self, user_id: str, strengths: Dict[str, Any]) -> None:
        """
        Update user strength signals.
        
        Stored separately from failure state.
        """
        strengths["user_id"] = user_id
        strengths["_updated_at"] = datetime.utcnow().isoformat()
        
        file_path = self._strengths_file(user_id)
        
        with open(file_path, "w") as f:
            json.dump(strengths, f, indent=2, default=str)
    
    def list_users(self) -> List[str]:
        """List all users with stored state."""
        users = set()
        
        for file_path in self.storage_dir.glob("*_state.json"):
            user_id = file_path.stem.replace("_state", "")
            users.add(user_id)
        
        return list(users)
    
    def delete_user(self, user_id: str) -> bool:
        """Delete all data for a user."""
        state_file = self._user_file(user_id)
        strengths_file = self._strengths_file(user_id)
        
        deleted = False
        
        if state_file.exists():
            state_file.unlink()
            deleted = True
        
        if strengths_file.exists():
            strengths_file.unlink()
            deleted = True
        
        return deleted
    
    def find_similar_users(
        self,
        state_embedding: List[float],
        top_k: int = 5,
    ) -> List[str]:
        """
        Find users with similar state (for cohort analysis).
        
        Requires FAISS to be enabled.
        """
        if not self.use_faiss or self._index is None:
            logger.warning("FAISS not available for similarity search")
            return []
        
        try:
            import numpy as np
            
            query = np.array([state_embedding], dtype=np.float32)
            distances, indices = self._index.search(query, top_k)
            
            results = []
            for idx in indices[0]:
                if 0 <= idx < len(self._id_map):
                    results.append(self._id_map[idx])
            
            return results
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    def _user_file(self, user_id: str) -> Path:
        """Get file path for user state."""
        safe_id = user_id.replace("/", "_").replace("\\", "_")
        return self.storage_dir / f"{safe_id}_state.json"
    
    def _strengths_file(self, user_id: str) -> Path:
        """Get file path for user strengths."""
        safe_id = user_id.replace("/", "_").replace("\\", "_")
        return self.storage_dir / f"{safe_id}_strengths.json"
