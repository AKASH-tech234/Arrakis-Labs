import redis
import json
import os
from typing import Any, Optional
import logging
import hashlib

logger = logging.getLogger(__name__)

class RedisCache:
    """Redis-based caching for AI responses"""
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL")
        self.client = None
        self.enabled = False
        self.default_ttl = 3600  # 1 hour
    
    def connect(self):
        """Connect to Redis"""
        if not self.redis_url:
            logger.warning("REDIS_URL not set - Redis caching disabled")
            return False
        
        try:
            self.client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=5
            )
            
            # Test connection
            self.client.ping()
            self.enabled = True
            logger.info("✅ Redis connected successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.enabled = False
            return False
    
    def _make_key(self, agent_name: str, cache_key: str) -> str:
        """Generate Redis key"""
        # Hash the cache_key to avoid key length issues
        key_hash = hashlib.sha256(cache_key.encode()).hexdigest()[:16]
        return f"ai:agent:{agent_name}:{key_hash}"
    
    def get(self, agent_name: str, cache_key: str) -> Optional[Any]:
        """Get cached agent response"""
        
        if not self.enabled:
            return None
        
        try:
            redis_key = self._make_key(agent_name, cache_key)
            data = self.client.get(redis_key)
            
            if data:
                logger.debug(f"⚡ Redis CACHE HIT for {agent_name}")
                return json.loads(data)
            else:
                logger.debug(f"🚫 Redis CACHE MISS for {agent_name}")
                return None
        except Exception as e:
            logger.error(f"❌ Redis get error: {e}")
            return None
    
    def set(
        self,
        agent_name: str,
        cache_key: str,
        value: Any,
        ttl: Optional[int] = None
    ):
        """Cache agent response"""
        
        if not self.enabled:
            return False
        
        try:
            redis_key = self._make_key(agent_name, cache_key)
            data = json.dumps(value)
            
            self.client.setex(
                redis_key,
                ttl or self.default_ttl,
                data
            )
            
            logger.debug(f"💾 Redis CACHE SET for {agent_name} (TTL: {ttl or self.default_ttl}s)")
            return True
        except Exception as e:
            logger.error(f"❌ Redis set error: {e}")
            return False
    
    def invalidate_user(self, user_id: str):
        """Invalidate all cached responses for a user"""
        
        if not self.enabled:
            return 0
        
        try:
            pattern = f"ai:agent:*:*{user_id}*"
            keys = self.client.keys(pattern)
            
            if keys:
                deleted = self.client.delete(*keys)
                logger.info(f"🗑️ Invalidated {deleted} cache entries for user {user_id}")
                return deleted
            
            return 0
        except Exception as e:
            logger.error(f"❌ Redis invalidate error: {e}")
            return 0
    
    def get_stats(self) -> dict:
        """Get Redis cache statistics"""
        
        if not self.enabled:
            return {"enabled": False}
        
        try:
            info = self.client.info("stats")
            return {
                "enabled": True,
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "total_commands_processed": info.get("total_commands_processed", 0),
            }
        except Exception as e:
            logger.error(f"❌ Redis stats error: {e}")
            return {"enabled": True, "error": str(e)}

# Singleton
redis_cache = RedisCache()