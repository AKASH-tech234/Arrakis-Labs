import hashlib
import json
import logging
from typing import Dict, Any

logger = logging.getLogger("cache_key")


def build_cache_key(agent_name: str, payload: Dict[str, Any]) -> str:
    stable_payload = {
        "agent": agent_name,
        "user_id": payload.get("user_id"),
        "problem_id": payload.get("problem_id"),
        "problem_category": payload.get("problem_category"),
        "verdict": payload.get("verdict"),
        "error_type": payload.get("error_type"),
        "code": payload.get("code"),
    }

    raw = json.dumps(stable_payload, sort_keys=True)
    cache_key = hashlib.sha256(raw.encode()).hexdigest()
    logger.debug(f"🔑 Cache key generated for {agent_name}: {cache_key[:16]}...")
    return cache_key
