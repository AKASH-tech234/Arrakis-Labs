import json
import time
import logging
from pathlib import Path

logger = logging.getLogger("agent_metrics")

METRICS_FILE = Path("agent_metrics.json")

def record_metric(agent_name: str, elapsed: float):
    try:
        if METRICS_FILE.exists():
            raw = METRICS_FILE.read_text().strip()
            data = json.loads(raw) if raw else []
        else:
            data = []

        data.append({
            "agent": agent_name,
            "elapsed_seconds": round(elapsed, 2),
            "timestamp": int(time.time()),
        })

        METRICS_FILE.write_text(json.dumps(data, indent=2))

    except Exception as e:
        logger.error(f"❌ Failed to record metric: {e}")
