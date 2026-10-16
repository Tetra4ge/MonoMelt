"""
PostgreSQL client using asyncpg (a connection per query; the Supabase pooler multiplexes them).
Provides a session factory for interacting with Supabase's Postgres.
"""

import logging
import asyncpg
from core.config import get_settings

logger = logging.getLogger(__name__)


def _connection_hint(db_url: str, exc: Exception) -> str:
    """Turn a raw connection error into something actionable."""
    from urllib.parse import urlparse

    host = urlparse(db_url).hostname or ""
    if isinstance(exc, OSError) and host.startswith("db.") and host.endswith(".supabase.co"):
        return (
            f"The host '{host}' is Supabase's direct connection, which is IPv6-only and does not "
            "resolve on IPv4 networks. Use the Session pooler connection string instead "
            "(host like aws-0-<region>.pooler.supabase.com, user postgres.<project-ref>) - "
            "Supabase dashboard > Connect > Session pooler."
        )
    if "password authentication failed" in str(exc):
        return "The database password in DATABASE_URL was rejected. Reset it in Supabase and update DATABASE_URL."
    if "Tenant or user not found" in str(exc):
        return "The pooler rejected the user. For the pooler the user must be postgres.<project-ref>, not plain 'postgres'."
    return "Verify the Supabase pooler hostname, password, network access, and SSL settings."


async def get_pg_connection() -> asyncpg.Connection:
    """
    Return a raw asyncpg connection.
    Always close it after use with await conn.close()
    """
    settings = get_settings()
    db_url = settings.database_url.strip()
    if not db_url:
        raise RuntimeError("DATABASE_URL is empty; configure the Supabase PostgreSQL URL")
    try:
        # statement_cache_size=0 keeps this working behind PgBouncer in transaction mode (port 6543).
        return await asyncpg.connect(db_url, timeout=10, statement_cache_size=0)
    except Exception as exc:
        hint = _connection_hint(db_url, exc)
        logger.error("PostgreSQL connection failed (%s: %s). %s", type(exc).__name__, exc, hint)
        raise RuntimeError(f"Unable to connect to DATABASE_URL. {hint}") from exc


async def verify_postgres() -> bool:
    """Used by /health: can we open a connection and run a trivial query?"""
    try:
        conn = await get_pg_connection()
        try:
            await conn.fetchval("select 1")
        finally:
            await conn.close()
        return True
    except Exception:
        return False


async def execute(query: str, *args) -> str:
    """Execute a write query (INSERT/UPDATE/DELETE). Returns command status."""
    conn = await get_pg_connection()
    try:
        result = await conn.execute(query, *args)
        return result
    finally:
        await conn.close()


async def execute_many(query: str, args_list: list[tuple]) -> None:
    """Run one write query for many argument tuples on a single connection."""
    conn = await get_pg_connection()
    try:
        await conn.executemany(query, args_list)
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
