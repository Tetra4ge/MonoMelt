from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

from api.routes.analysis import router as analysis_router
from api.routes.intelligence import router as intelligence_router
from db.neo4j_client import get_driver, close_driver, verify_connectivity


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm Neo4j driver. Shutdown: close it cleanly."""
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

# CORS — allow only the gateway in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict to gateway URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(analysis_router)
app.include_router(intelligence_router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check including Neo4j connectivity."""
    neo4j_ok = await verify_connectivity()
    return {
        "success": True,
        "service": "ai-analysis-service",
        "status": "up",
        "neo4j": "connected" if neo4j_ok else "unavailable",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
