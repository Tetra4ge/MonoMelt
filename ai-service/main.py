import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

from api.routes.analysis import router as analysis_router
from api.routes.intelligence import router as intelligence_router
from api.routes.decomposition import router as decomposition_router
from api.routes.planning import router as planning_router
from api.routes.blueprints import router as blueprints_router
from api.routes.reports import router as reports_router
from db.neo4j_client import get_driver, close_driver, verify_connectivity
from db.pg_client import verify_postgres
from services.realtime import verify_redis
from core.config import get_settings
from core.security import verify_internal_key, warn_if_unprotected



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm Neo4j driver. Shutdown: close it cleanly."""
    warn_if_unprotected()
    # Warm up driver connection pool
    get_driver()
    yield
    # Teardown
    await close_driver()


app = FastAPI(
    title="Transformation Intelligence AI Engine",
    description="Core AI analysis engine for breaking down monoliths into microservices.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - this service is called server-to-server; browsers should not need it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().allowed_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers (every router requires the internal key; /health stays public)
protected = [Depends(verify_internal_key)]
app.include_router(analysis_router, dependencies=protected)
app.include_router(intelligence_router, dependencies=protected)
app.include_router(decomposition_router, prefix="/decomposition", tags=["Decomposition"], dependencies=protected)
app.include_router(planning_router, dependencies=protected)
app.include_router(blueprints_router, dependencies=protected)
app.include_router(reports_router, prefix="/api", dependencies=protected)


async def _check(probe, seconds: float = 4.0) -> bool:
    """Run one dependency probe with its own timeout so a slow dependency cannot stall /health."""
    try:
        return bool(await asyncio.wait_for(probe(), timeout=seconds))
    except Exception:
        return False


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check including Neo4j, Postgres and Redis connectivity (probed concurrently)."""
    neo4j_ok, postgres_ok, redis_ok = await asyncio.gather(
        _check(verify_connectivity), _check(verify_postgres), _check(verify_redis)
    )
    return {
        "success": True,
        "service": "ai-analysis-service",
        "status": "up" if (neo4j_ok and postgres_ok and redis_ok) else "degraded",
        "neo4j": "connected" if neo4j_ok else "unavailable",
        "postgres": "connected" if postgres_ok else "unavailable",
        "redis": "connected" if redis_ok else "unavailable",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
