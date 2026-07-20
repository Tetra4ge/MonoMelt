"""
Neo4j Aura database client.
Provides a context manager and helper for running Cypher queries.
Every query MUST filter by owner_id, project_id, and source_version_id
to prevent data bleed between tenants.
"""

from contextlib import asynccontextmanager
from typing import Any

from neo4j import AsyncGraphDatabase, AsyncDriver
from core.config import get_settings

_driver: AsyncDriver | None = None


def get_driver() -> AsyncDriver:
    """Return (or create) the singleton async Neo4j driver."""
    global _driver
    if _driver is None:
        settings = get_settings()
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_username, settings.neo4j_password),
        )
    return _driver


async def close_driver() -> None:
    """Close the driver — call this on app shutdown."""
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


@asynccontextmanager
async def get_session(database: str | None = None):
    """
    Async context manager for a Neo4j session.
    Usage::
        async with get_session() as session:
            result = await session.run("RETURN 1")
    """
    settings = get_settings()
    db = database or settings.neo4j_database
    driver = get_driver()
    async with driver.session(database=db) as session:
        yield session


async def run_query(
    cypher: str,
    params: dict[str, Any] | None = None,
    database: str | None = None,
) -> list[dict[str, Any]]:
    """
    Execute a read/write Cypher query and return all records as dicts.
    """
    async with get_session(database=database) as session:
        result = await session.run(cypher, params or {})
        return [record.data() async for record in result]


async def verify_connectivity() -> bool:
    """Ping Neo4j — used in health check."""
    try:
        driver = get_driver()
        await driver.verify_connectivity()
        return True
    except Exception:
        return False
