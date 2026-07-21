"""
PostgreSQL client using asyncpg via SQLAlchemy 2.0 async engine.
Provides a session factory for interacting with Supabase's Postgres.
"""

import os
import logging
import asyncpg
from core.config import get_settings

logger = logging.getLogger(__name__)


async def get_pg_connection() -> asyncpg.Connection:
    """
    Return a raw asyncpg connection. 
    Always close it after use with await conn.close()
    """
    settings = get_settings()
    db_url = settings.database_url
    try:
        return await asyncpg.connect(db_url, timeout=5)
    except Exception as exc:
        logger.warning(f"Primary DB connection failed ({exc}) — connecting to local postgres fallback")
        fallback_url = os.getenv("FALLBACK_DATABASE_URL", "postgresql://user:password@postgres:5432/transformation_db")
        return await asyncpg.connect(fallback_url, timeout=5)


async def execute(query: str, *args) -> str:
    """Execute a write query (INSERT/UPDATE/DELETE). Returns command status."""
    conn = await get_pg_connection()
    try:
        result = await conn.execute(query, *args)
        return result
    finally:
        await conn.close()


async def fetch(query: str, *args) -> list[dict]:
    """Execute a read query and return rows as list of dicts."""
    conn = await get_pg_connection()
    try:
        rows = await conn.fetch(query, *args)
        return [dict(row) for row in rows]
    finally:
        await conn.close()


async def fetchrow(query: str, *args) -> dict | None:
    """Execute a read query and return one row as a dict."""
    conn = await get_pg_connection()
    try:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None
    finally:
        await conn.close()
