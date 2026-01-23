"""
Tests for Redis Cache Module
=============================

Tests for app/cache/redis_cache.py
"""

import pytest
from unittest.mock import MagicMock, patch
import json


class TestRedisCache:
    """Tests for RedisCache class."""

    def test_redis_cache_init(self):
        """Test RedisCache initialization."""
        from app.cache.redis_cache import RedisCache
        
        cache = RedisCache()
        
        assert cache.client is None
        assert cache.enabled is False
        assert cache.default_ttl == 3600

    def test_redis_cache_connect_no_url(self):
        """Test connection without REDIS_URL set."""
        from app.cache.redis_cache import RedisCache
        
        with patch.dict("os.environ", {"REDIS_URL": ""}, clear=False):
            cache = RedisCache()
            cache.redis_url = None
            result = cache.connect()
            
            assert result is False
            assert cache.enabled is False

    @patch("redis.from_url")
    def test_redis_cache_connect_success(self, mock_redis_from_url):
        """Test successful Redis connection."""
        from app.cache.redis_cache import RedisCache
        
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_redis_from_url.return_value = mock_client
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        result = cache.connect()
        
        assert result is True
        assert cache.enabled is True
        assert cache.client is not None

    @patch("redis.from_url")
    def test_redis_cache_connect_failure(self, mock_redis_from_url):
        """Test Redis connection failure."""
        from app.cache.redis_cache import RedisCache
        
        mock_redis_from_url.side_effect = Exception("Connection refused")
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        result = cache.connect()
        
        assert result is False
        assert cache.enabled is False

    def test_make_key(self):
        """Test cache key generation."""
        from app.cache.redis_cache import RedisCache
        
        cache = RedisCache()
        
        key1 = cache._make_key("feedback_agent", "test_key_1")
        key2 = cache._make_key("feedback_agent", "test_key_2")
        key3 = cache._make_key("feedback_agent", "test_key_1")
        
        # Same inputs should produce same key
        assert key1 == key3
        # Different inputs should produce different keys
        assert key1 != key2
        # Keys should follow expected format
        assert key1.startswith("ai:agent:feedback_agent:")

    def test_get_cache_disabled(self):
        """Test get when cache is disabled."""
        from app.cache.redis_cache import RedisCache
        
        cache = RedisCache()
        cache.enabled = False
        
        result = cache.get("agent", "key")
        
        assert result is None

    def test_set_cache_disabled(self):
        """Test set when cache is disabled."""
        from app.cache.redis_cache import RedisCache
        
        cache = RedisCache()
        cache.enabled = False
        
        result = cache.set("agent", "key", {"data": "test"})
        
        assert result is False

    @patch("redis.from_url")
    def test_get_cache_hit(self, mock_redis_from_url):
        """Test cache hit scenario."""
        from app.cache.redis_cache import RedisCache
        
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.return_value = json.dumps({"explanation": "test"})
        mock_redis_from_url.return_value = mock_client
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        cache.connect()
        
        result = cache.get("feedback_agent", "test_key")
        
        assert result == {"explanation": "test"}

    @patch("redis.from_url")
    def test_get_cache_miss(self, mock_redis_from_url):
        """Test cache miss scenario."""
        from app.cache.redis_cache import RedisCache
        
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.return_value = None
        mock_redis_from_url.return_value = mock_client
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        cache.connect()
        
        result = cache.get("feedback_agent", "test_key")
        
        assert result is None

    @patch("redis.from_url")
    def test_set_cache_success(self, mock_redis_from_url):
        """Test successful cache set."""
        from app.cache.redis_cache import RedisCache
        
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_redis_from_url.return_value = mock_client
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        cache.connect()
        
        result = cache.set("feedback_agent", "test_key", {"data": "test"}, ttl=7200)
        
        assert result is True
        mock_client.setex.assert_called_once()

    @patch("redis.from_url")
    def test_invalidate_user(self, mock_redis_from_url):
        """Test user cache invalidation."""
        from app.cache.redis_cache import RedisCache
        
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.keys.return_value = ["key1", "key2"]
        mock_client.delete.return_value = 2
        mock_redis_from_url.return_value = mock_client
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        cache.connect()
        
        result = cache.invalidate_user("user_123")
        
        assert result == 2

    @patch("redis.from_url")
    def test_get_stats(self, mock_redis_from_url):
        """Test getting cache statistics."""
        from app.cache.redis_cache import RedisCache
        
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.info.return_value = {
            "keyspace_hits": 100,
            "keyspace_misses": 50,
            "total_commands_processed": 1000,
        }
        mock_redis_from_url.return_value = mock_client
        
        cache = RedisCache()
        cache.redis_url = "redis://localhost:6379"
        cache.connect()
        
        stats = cache.get_stats()
        
        assert stats["enabled"] is True
        assert stats["keyspace_hits"] == 100
        assert stats["keyspace_misses"] == 50


class TestCacheKey:
    """Tests for cache key building."""

    def test_build_cache_key_basic(self):
        """Test basic cache key building."""
        from app.cache.cache_key import build_cache_key
        
        payload = {
            "user_id": "user_123",
            "problem_id": "prob_001",
            "problem_category": "Array",
            "verdict": "wrong_answer",
            "code": "def solution(): pass",
        }
        
        key = build_cache_key("feedback_agent", payload)
        
        assert isinstance(key, str)
        assert len(key) == 64  # SHA256 hash length

    def test_build_cache_key_deterministic(self):
        """Test that cache keys are deterministic."""
        from app.cache.cache_key import build_cache_key
        
        payload = {
            "user_id": "user_123",
            "problem_id": "prob_001",
            "code": "def solution(): pass",
        }
        
        key1 = build_cache_key("feedback_agent", payload)
        key2 = build_cache_key("feedback_agent", payload)
        
        assert key1 == key2

    def test_build_cache_key_different_inputs(self):
        """Test that different inputs produce different keys."""
        from app.cache.cache_key import build_cache_key
        
        payload1 = {"user_id": "user_123", "code": "def a(): pass"}
        payload2 = {"user_id": "user_123", "code": "def b(): pass"}
        
        key1 = build_cache_key("feedback_agent", payload1)
        key2 = build_cache_key("feedback_agent", payload2)
        
        assert key1 != key2
