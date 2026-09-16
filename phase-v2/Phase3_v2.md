# MonoMelt v2: Phase 3 (AI Service API Endpoints)

## 1. Phase Overview

Phase 3 transitions the core logic developed in Phase 2 from a dormant Python class into an active, network-accessible microservice endpoint. This phase focuses entirely on the FastAPI routing layer within the `ai-service`.

The primary objective is to create a robust HTTP `POST` endpoint that the Node.js BullMQ worker can invoke. This endpoint must not only trigger the `ReportAgent` logic but also handle database connection lifecycle management (dependency injection), implement strict idempotency checks to prevent data corruption, and execute the final SQL `UPSERT` command to save the generated JSON payload back to the Supabase database configured in Phase 1.

This document serves as the comprehensive, 150+ line technical specification for executing Phase 3.

---

## 2. Architectural Objectives

### 2.1 Decoupled Execution via Background Tasks
Generating the report involves concurrent network calls to Neo4j and Gemini, which can take anywhere from 3 to 15 seconds. If the FastAPI endpoint holds the HTTP connection open for this entire duration, it risks encountering client-side timeout errors from the Node.js API Gateway.

To solve this, the FastAPI endpoint must utilize FastAPI's native `BackgroundTasks`. The endpoint will immediately return a `202 Accepted` response to the Node.js caller, confirming that the generation process has begun. The actual heavy lifting (Phase 2's `build_report` function) will execute asynchronously in the background.

### 2.2 Idempotency and Version Incrementing
As established in Phase 1, reports are version-controlled. When the endpoint is hit, it must first query Supabase to find the highest existing `version_number` for the given `project_id`. If a report exists, the new report is saved as `version_number + 1`. If it is the first time the endpoint is hit, it defaults to `version_number = 1`.

### 2.3 Dependency Injection
FastAPI's `Depends` system must be used to securely inject the Supabase Service Role client into the route. This ensures that the route has the elevated privileges required to write to the `project_reports` table, bypassing the Row Level Security (RLS) policies that usually block unauthenticated inserts.

---

## 3. Route Specifications

### 3.1 The Request & Response Schemas

Before defining the route, we define the Pydantic models for the HTTP request and response.

```python
from pydantic import BaseModel

class ReportGenerateRequest(BaseModel):
    project_id: str
    owner_id: str

class ReportGenerateResponse(BaseModel):
    success: bool
    message: str
    status: str
    project_id: str
```

### 3.2 The FastAPI Route Definition

The new route will be located at `ai-service/api/routes/reports.py`.

```python
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from supabase import Client
from app.db.supabase import get_supabase_service_client
from app.services.report_generator import ReportAgent
from .schemas import ReportGenerateRequest, ReportGenerateResponse
import logging

router = APIRouter(prefix="/reports", tags=["Reports"])
logger = logging.getLogger(__name__)

async def generate_and_save_report(
    project_id: str, 
    owner_id: str, 
    supabase: Client
):
    """
    Background task that orchestrates the generation and database persistence.
    """
    try:
        # 1. Update status to 'generating'
        # We assume the API Gateway already created a 'pending' row.
        # We need to find the latest pending row and mark it as generating.
        
        # 2. Determine the Version Number (Idempotency check)
        version_query = supabase.table('project_reports')\
            .select('version_number')\
            .eq('project_id', project_id)\
            .order('version_number', desc=True)\
            .limit(1)\
            .execute()
            
        next_version = 1
        if version_query.data:
            next_version = version_query.data[0]['version_number'] + 1
            
        # 3. Create a placeholder row in Supabase
        insert_res = supabase.table('project_reports').insert({
            "project_id": project_id,
            "owner_id": owner_id,
            "version_number": next_version,
            "status": "generating"
        }).execute()
        
        # 4. Invoke the Phase 2 Generator Logic
        agent = ReportAgent(project_id, supabase)
        final_report = await agent.build_report()
        
        # 5. Persist the generated JSONB payload and mark as completed
        supabase.table('project_reports').update({
            "payload": final_report.model_dump(),
            "status": "completed"
        }).eq('project_id', project_id)\
          .eq('version_number', next_version)\
          .execute()
          
        logger.info(f"Report v{next_version} successfully generated for {project_id}")

    except Exception as e:
        logger.error(f"Failed to generate report for {project_id}: {str(e)}")
        # 6. Graceful Failure: Update database state so frontend knows it failed
        try:
            supabase.table('project_reports').update({
                "status": "failed",
                "payload": {"error": str(e)}
            }).eq('project_id', project_id)\
              .eq('status', 'generating')\
              .execute()
        except Exception as inner_e:
            logger.critical(f"Failed to update error status: {str(inner_e)}")


@router.post("/generate", response_model=ReportGenerateResponse, status_code=202)
async def trigger_report_generation(
    req: ReportGenerateRequest,
    background_tasks: BackgroundTasks,
    supabase: Client = Depends(get_supabase_service_client)
):
    """
    Triggers the generation of the final architectural report.
    Executes in the background to prevent HTTP timeouts.
    """
    try:
        # Enqueue the background task
        background_tasks.add_task(
            generate_and_save_report, 
            req.project_id, 
            req.owner_id, 
            supabase
        )
        
        return ReportGenerateResponse(
            success=True,
            message="Report generation has been queued successfully.",
            status="accepted",
            project_id=req.project_id
        )
        
    except Exception as e:
        logger.error(f"Error queuing report task: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to queue report generation.")
```

---

## 4. Integration into FastAPI App

To ensure the new routes are active, they must be registered in the main FastAPI application instance.

### 4.1 Update `main.py`
In `ai-service/main.py`, import and include the new router:

```python
from fastapi import FastAPI
from app.api.routes import decomposition, planning, reports

app = FastAPI(title="MonoMelt AI Service")

# Existing routers...
app.include_router(decomposition.router)
app.include_router(planning.router)

# New Phase 3 Router
app.include_router(reports.router, prefix="/api")
```

---

## 5. Security & Error Handling Strategies

### 5.1 Service Role Security
Notice that the dependency injected is `get_supabase_service_client` rather than a standard client. This is because the background worker running this logic has no context of the logged-in user's JWT. It must use the elevated Service Role Key to bypass the Row Level Security (RLS) policies configured in Phase 1. 
*Security Risk:* The Service Role key must never be exposed or returned in any HTTP response. It must remain strictly in the `.env` file of the `ai-service`.

### 5.2 Atomic Operations and Concurrency
If two identical requests hit the `/reports/generate` endpoint at the exact same millisecond, there is a race condition where both might calculate `next_version = 2`. 

This is where Phase 1 saves us. We defined a `UNIQUE(project_id, version_number)` constraint on the database. If this race condition occurs, the second background task's `INSERT` statement will immediately fail with a PostgreSQL Unique Violation error, triggering the `except` block and safely aborting the redundant generation.

---

## 6. Integration Hand-Off (To Phase 4)

With Phase 3 complete, the AI Service is now fully capable of receiving an HTTP trigger, asynchronously aggregating massive amounts of data from Neo4j and PostgreSQL, synthesizing it via LLMs, and securely writing a structured, version-controlled JSON payload back into the database.

However, a human user cannot trigger this endpoint directly from the frontend React app. 

In **Phase 4**, we will shift our focus to the Node.js ecosystem. We will configure the BullMQ background worker to automatically trigger this FastAPI endpoint the exact moment that Agents 1 through 5 complete their respective jobs, fully automating the report generation pipeline.
