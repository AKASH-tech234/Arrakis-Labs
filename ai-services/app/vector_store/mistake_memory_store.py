"""
Mistake Memory Store
====================

Vector store for mistake episodes with delta-based similarity retrieval.

Key features:
- Stores mistake episodes with embeddings
- Retrieves similar past mistakes for personalization
- Uses FAISS for efficient similarity search
"""

import json
import logging
import os
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)


class MistakeMemoryStore:
    """
    Vector store for mistake episodes.
    
    Stores mistake episodes with delta feature embeddings for:
    - Finding similar past mistakes
    - Tracking recurrence patterns
    - Building personalized feedback
    """
    
    def __init__(
        self,
        storage_dir: str = "vector_db/mistake_episodes",
        embedding_dim: int = 32,
    ):
        """
        Initialize store.
        
        Parameters
        ----------
        storage_dir : str
            Directory for storing episodes
        embedding_dim : int
            Dimension of delta feature embeddings
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.embedding_dim = embedding_dim
        
        # In-memory cache per user
        self._user_episodes: Dict[str, List[Dict]] = {}
        
        # FAISS indices per user
        self._user_indices: Dict[str, Any] = {}
    
    def record_mistake_episode(
        self,
        user_id: str,
        problem_id: str,
        root_cause: str,
        subtype: str,
        delta_features: Dict[str, float],
        timestamp: str,
        failure_mechanism: str = None,
        category: str = None,
    ) -> str:
        """
        Record a mistake episode.
        
        Parameters
        ----------
        user_id : str
            User identifier
        problem_id : str
            Problem identifier
        root_cause : str
            Predicted root cause
        subtype : str
            Predicted subtype
        delta_features : dict
            Delta feature values
        timestamp : str
            Episode timestamp
        failure_mechanism : str, optional
            Derived failure mechanism
        category : str, optional
            Problem category
            
        Returns
        -------
        str
            Episode ID
        """
        
        # Generate episode ID
        episode_id = self._generate_id(user_id, problem_id, timestamp)
        
        # Create embedding from delta features
        embedding = self._create_embedding(delta_features)
        
        # Build episode record
        episode = {
            "episode_id": episode_id,
            "user_id": user_id,
            "problem_id": problem_id,
            "root_cause": root_cause,
            "subtype": subtype,
            "failure_mechanism": failure_mechanism,
            "category": category,
            "delta_features": delta_features,
            "embedding": embedding,
            "timestamp": timestamp,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Store to file
        self._store_episode(user_id, episode)
        
        # Update in-memory cache
        if user_id not in self._user_episodes:
            self._user_episodes[user_id] = []
        self._user_episodes[user_id].append(episode)
        
        # Update FAISS index
        self._add_to_index(user_id, episode)
        
        logger.debug(f"Recorded episode {episode_id} for user {user_id}")
        
        return episode_id
    
    def find_similar_mistakes(
        self,
        user_id: str,
        delta_features: Dict[str, float],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Find similar past mistakes for a user.
        
        Parameters
        ----------
        user_id : str
            User identifier
        delta_features : dict
            Current delta features to match against
        top_k : int
            Number of similar episodes to return
            
        Returns
        -------
        List[Dict]
            Similar past mistake episodes
        """
        
        # Load user episodes if not cached
        if user_id not in self._user_episodes:
            self._load_user_episodes(user_id)
        
        episodes = self._user_episodes.get(user_id, [])
        
        if not episodes:
            return []
        
        # Create query embedding
        query_embedding = self._create_embedding(delta_features)
        
        # Simple cosine similarity (no FAISS for small per-user datasets)
        scored = []
        for ep in episodes:
            ep_embedding = ep.get("embedding", [])
            if ep_embedding:
                similarity = self._cosine_similarity(query_embedding, ep_embedding)
                scored.append((similarity, ep))
        
        # Sort by similarity descending
        scored.sort(key=lambda x: x[0], reverse=True)
        
        return [ep for _, ep in scored[:top_k]]
    
    def get_recurrence_count(
        self,
        user_id: str,
        subtype: str,
        lookback_days: int = 30,
    ) -> int:
        """
        Count how many times a subtype has recurred for a user.
        
        Parameters
        ----------
        user_id : str
            User identifier
        subtype : str
            Subtype to count
        lookback_days : int
            How far back to look
            
        Returns
        -------
        int
            Number of occurrences
        """
        
        if user_id not in self._user_episodes:
            self._load_user_episodes(user_id)
        
        episodes = self._user_episodes.get(user_id, [])
        
        # Filter by recency
        cutoff = datetime.utcnow().timestamp() - (lookback_days * 24 * 3600)
        
        count = 0
        for ep in episodes:
            if ep.get("subtype") == subtype:
                try:
                    ep_time = datetime.fromisoformat(ep["timestamp"]).timestamp()
                    if ep_time >= cutoff:
                        count += 1
                except (ValueError, KeyError):
                    count += 1  # Include if timestamp unparseable
        
        return count
    
    def get_user_subtype_distribution(
        self,
        user_id: str,
    ) -> Dict[str, int]:
        """
        Get distribution of subtypes for a user.
        
        Returns
        -------
        Dict[str, int]
            Subtype -> count mapping
        """
        
        if user_id not in self._user_episodes:
            self._load_user_episodes(user_id)
        
        episodes = self._user_episodes.get(user_id, [])
        
        distribution: Dict[str, int] = {}
        for ep in episodes:
            subtype = ep.get("subtype", "unknown")
            distribution[subtype] = distribution.get(subtype, 0) + 1
        
        return distribution
    
    def get_user_history(
        self,
        user_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Get recent mistake history for a user.
        
        Parameters
        ----------
        user_id : str
            User identifier
        limit : int
            Maximum episodes to return
            
        Returns
        -------
        List[Dict]
            Recent episodes (most recent first)
        """
        
        if user_id not in self._user_episodes:
            self._load_user_episodes(user_id)
        
        episodes = self._user_episodes.get(user_id, [])
        
        # Sort by timestamp descending
        sorted_eps = sorted(
            episodes,
            key=lambda x: x.get("timestamp", ""),
            reverse=True,
        )
        
        return sorted_eps[:limit]
    
    def delete_user_history(self, user_id: str) -> bool:
        """Delete all episodes for a user."""
        
        file_path = self._user_file(user_id)
        
        if file_path.exists():
            file_path.unlink()
        
        if user_id in self._user_episodes:
            del self._user_episodes[user_id]
        
        if user_id in self._user_indices:
            del self._user_indices[user_id]
        
        return True
    
    def _create_embedding(self, delta_features: Dict[str, float]) -> List[float]:
        """
        Create embedding from delta features.
        
        Maps delta features to a fixed-size vector.
        """
        
        # Feature keys in consistent order
        feature_keys = [
            "delta_attempts_same_category",
            "delta_root_cause_repeat_rate",
            "delta_complexity_mismatch",
            "delta_time_to_accept",
            "delta_optimization_transition",
        ]
        
        embedding = []
        
        for key in feature_keys:
            value = delta_features.get(key, 0.0)
            embedding.append(float(value))
        
        # Pad to embedding_dim
        while len(embedding) < self.embedding_dim:
            embedding.append(0.0)
        
        # Truncate if too long
        embedding = embedding[:self.embedding_dim]
        
        return embedding
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        
        if len(a) != len(b) or len(a) == 0:
            return 0.0
        
        dot_product = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot_product / (norm_a * norm_b)
    
    def _generate_id(self, user_id: str, problem_id: str, timestamp: str) -> str:
        """Generate unique episode ID."""
        content = f"{user_id}:{problem_id}:{timestamp}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _user_file(self, user_id: str) -> Path:
        """Get file path for user episodes."""
        safe_id = user_id.replace("/", "_").replace("\\", "_")
        return self.storage_dir / f"{safe_id}_episodes.jsonl"
    
    def _store_episode(self, user_id: str, episode: Dict) -> None:
        """Append episode to user's file."""
        file_path = self._user_file(user_id)
        
        with open(file_path, "a") as f:
            f.write(json.dumps(episode, default=str) + "\n")
    
    def _load_user_episodes(self, user_id: str) -> None:
        """Load all episodes for a user from file."""
        file_path = self._user_file(user_id)
        
        episodes = []
        
        if file_path.exists():
            with open(file_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            episodes.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        
        self._user_episodes[user_id] = episodes
    
    def _add_to_index(self, user_id: str, episode: Dict) -> None:
        """Add episode to FAISS index (if available)."""
        # For now, we use simple in-memory search
        # FAISS can be added for larger scale
        pass
