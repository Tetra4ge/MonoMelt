"""
Service-to-service authentication.

The AI service is only meant to be called by the API gateway and the worker,
which already authenticate end users. They send a shared secret in the
`X-Internal-Key` header. When INTERNAL_API_KEY is unset (local development)
the check is skipped and a warning is logged at startup.
"""

import hmac
import logging

from fastapi import Header, HTTPException, status

from core.config import get_settings

logger = logging.getLogger(__name__)


def warn_if_unprotected() -> None:
    if not get_settings().internal_api_key:
        logger.warning("INTERNAL_API_KEY is not set - AI service endpoints are unauthenticated (fine for local dev only)")


async def verify_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    expected = get_settings().internal_api_key
    if not expected:
        return
    if not x_internal_key or not hmac.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing internal API key")
