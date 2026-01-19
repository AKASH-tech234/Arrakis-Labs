import json
import time
import logging
from pathlib import Path

logger = logging.getLogger("agent_metrics")

METRICS_FILE = Path("agent_metrics.json")


def record_metric(agent_name: str, elapsed: float):
    logger.debug(f"📊 Recording metric: {agent_name} = {elapsed:.2f}s")
    try:
        data = []

        if METRICS_FILE.exists():
            data = json.loads(METRICS_FILE.read_text())

        data.append({
            "agent": agent_name,
            "elapsed_seconds": round(elapsed, 2),
            "timestamp": int(time.time())
        })

        METRICS_FILE.write_text(json.dumps(data, indent=2))
        logger.debug(f"✅ Metric recorded successfully")
    except Exception as e:
        logger.error(f"❌ Failed to record metric: {e}")
