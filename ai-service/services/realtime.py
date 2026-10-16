"""
Redis Pub/Sub publisher used to notify the Node.js API Gateway (socket.js)
that a project_reports row has changed, so it can broadcast a
`report_completed` WebSocket event to the React frontend in real time.

This is intentionally best-effort: a Redis outage must never prevent a
report from being generated or saved. Every call here is wrapped so a
failure only logs a warning.
"""

import json
import logging

import redis.asyncio as aioredis

from core.config import get_settings

logger = logging.getLogger(__name__)

REPORT_UPDATES_CHANNEL = "report-updates"

_redis_client: aioredis.Redis | None = None


def _get_redis_client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def verify_redis() -> bool:
    """Used by /health: can we reach Redis? (Without it reports still save, but no live events.)"""
    try:
        return bool(await _get_redis_client().ping())
    except Exception:
        return False


async def publish_report_update(project_id: str, status: str, version_number: int | None = None) -> None:
    """Publishes a `report-updates` event picked up by api-gateway/socket.js."""
    try:
        client = _get_redis_client()
        payload = {"project_id": project_id, "status": status}
        if version_number is not None:
            payload["version_number"] = version_number
        receivers = await client.publish(REPORT_UPDATES_CHANNEL, json.dumps(payload))
        if receivers == 0:
            logger.warning("Published report-updates for project %s but nothing is subscribed (is the gateway running and using the same Redis?)", project_id)
    except Exception as e:
        logger.warning(f"Failed to publish report-updates event for project {project_id} to {get_settings().redis_url.split('@')[-1]}: {e}")
