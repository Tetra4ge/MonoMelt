"""
Analysis API Routes
===================
Thin FastAPI router — all heavy logic lives in the service layer.

Endpoints:
  POST /analysis/trigger              — kick off analysis for a source version
  GET  /analysis/{source_version_id}  — get analysis run status
  GET  /analysis/{source_version_id}/graph        — paginated graph view
  GET  /analysis/{source_version_id}/metrics      — aggregate metrics
  GET  /analysis/{source_version_id}/diagnostics  — parser diagnostics
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel

from models.schemas import (
    TriggerAnalysisRequest,
    TriggerAnalysisResponse,
    AggregateMetrics,
    DiagnosticsResponse,
    GraphResponse,
    GraphNode,
    GraphEdge,
    ParserDiagnostic,
    HealthResponse,
)
from services.ast_parser import parse_files
from services.graph_builder import build_graph, delete_graph
from services.metrics_calculator import compute_local_metrics, compute_graph_metrics
from db.neo4j_client import run_query, verify_connectivity
from db.pg_client import fetch, fetchrow, execute

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis"])

# ---------------------------------------------------------------------------
# In-memory run tracker (Phase 3 — replace with DB in Phase 4)
# ---------------------------------------------------------------------------
_runs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Background analysis pipeline
# ---------------------------------------------------------------------------

async def _run_analysis_pipeline(
    analysis_run_id: str,
    source_version_id: str,
    project_id: str,
    owner_id: str,
) -> None:
    """
    Full pipeline:
    1. Fetch file manifest + content from Supabase storage
    2. Parse files (AST)
    3. Write graph to Neo4j
    4. Compute + store metrics
    5. Update run status
    """
    _runs[analysis_run_id]["status"] = "running"
    _runs[analysis_run_id]["started_at"] = datetime.now(timezone.utc).isoformat()

    try:
        from core.config import get_settings
        from supabase import create_client

        settings = get_settings()
        supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

        # Update Supabase status to analyzing so frontend knows we started
        supabase.table("analysis_jobs").update({"status": "analyzing"}).eq("source_version_id", source_version_id).execute()

        # 1. Get file manifest
        response = supabase.table("source_files") \
            .select("file_path, language, content_hash") \
            .eq("source_version_id", source_version_id) \
            .eq("status", "included") \
            .execute()

        manifest = response.data or []
        logger.info("Analysis run %s: %d files in manifest", analysis_run_id, len(manifest))

        # 2. Download file content from storage and attach to manifest
        # Storage path pattern: {projectId}/{jobId}/{file_path}
        # We'll fetch the source version metadata to find the storage path
        sv_resp = supabase.table("source_versions") \
            .select("metadata") \
            .eq("id", source_version_id) \
            .single() \
            .execute()

        sv_metadata = sv_resp.data.get("metadata", {}) if sv_resp.data else {}

        files_for_parsing = []
        for file_info in manifest:
            if file_info["language"] not in ("python", "javascript", "typescript"):
                continue
            # Build storage path: stored under project folder in Supabase bucket
            storage_path = f"{project_id}/{file_info['file_path']}"
            try:
                dl = supabase.storage.from_("openai").download(storage_path)
                source = dl.decode("utf-8", errors="replace") if dl else ""
                files_for_parsing.append({
                    "file_path": file_info["file_path"],
                    "source": source,
                })
            except Exception as exc:
                logger.warning("Could not download %s: %s", storage_path, exc)
                files_for_parsing.append({
                    "file_path": file_info["file_path"],
                    "source": "",
                })

        # 3. Parse
        parsed = parse_files(files_for_parsing)
        logger.info("Parsed %d files", len(parsed))

        # 4. Build Neo4j graph (idempotent — delete first)
        await delete_graph(source_version_id, project_id, owner_id)
        graph_summary = await build_graph(
            parsed_files=parsed,
            analysis_run_id=analysis_run_id,
            project_id=project_id,
            source_version_id=source_version_id,
            owner_id=owner_id,
        )
        logger.info("Graph written: %s", graph_summary)

        # 5. Compute metrics
        local_metrics = compute_local_metrics(parsed)
        agg_metrics = await compute_graph_metrics(
            source_version_id=source_version_id,
            project_id=project_id,
            owner_id=owner_id,
            local_metrics=local_metrics,
        )

        # 6. Collect diagnostics
        all_diagnostics = []
        for pf in parsed:
            for d in pf.diagnostics:
                all_diagnostics.append({
                    **d,
                    "file_path": pf.file_path,
                    "parser": d.get("parser", "unknown"),
                })

        # 7. Store results in run tracker
        _runs[analysis_run_id].update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "metrics": agg_metrics.model_dump(mode="json"),
            "diagnostics": all_diagnostics,
            "graph_summary": graph_summary,
        })
        
        # Update Supabase status so frontend breaks out of polling loop
        supabase.table("analysis_jobs").update({"status": "completed"}).eq("source_version_id", source_version_id).execute()

    except Exception as exc:
        logger.exception("Analysis run %s failed", analysis_run_id)
        _runs[analysis_run_id].update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": str(exc),
        })
        try:
            from core.config import get_settings
            from supabase import create_client
            settings = get_settings()
            supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
            supabase.table("analysis_jobs").update({"status": "failed"}).eq("source_version_id", source_version_id).execute()
        except:
            pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/trigger", response_model=TriggerAnalysisResponse, status_code=202)
async def trigger_analysis(
    request: TriggerAnalysisRequest,
    background_tasks: BackgroundTasks,
    # In production these come from the verified JWT via the gateway
    project_id: str = Query(..., description="Project UUID"),
    owner_id: str   = Query(..., description="Owner UUID (from JWT sub)"),
):
    """
    Start an analysis pipeline for a given source_version_id.
    Returns immediately with a run ID; poll the status endpoint to track progress.
    """
    run_id = str(uuid.uuid4())
    svid   = str(request.source_version_id)

    _runs[run_id] = {
        "analysis_run_id": run_id,
        "source_version_id": svid,
        "project_id": project_id,
        "owner_id": owner_id,
        "status": "pending",
        "started_at": None,
        "completed_at": None,
        "error_message": None,
    }

    background_tasks.add_task(
        _run_analysis_pipeline,
        analysis_run_id=run_id,
        source_version_id=svid,
        project_id=project_id,
        owner_id=owner_id,
    )

    logger.info("Analysis run %s queued for source_version=%s", run_id, svid)

    return TriggerAnalysisResponse(
        success=True,
        analysis_run_id=uuid.UUID(run_id),
        status="pending",
        message="Analysis started. Poll /analysis/{run_id}/status for updates.",
    )


@router.get("/run/{run_id}/status")
async def get_run_status(run_id: str):
    """Get the current status of an analysis run."""
    run = _runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return {"success": True, "data": run}


@router.get("/{source_version_id}/metrics", response_model=AggregateMetrics)
async def get_metrics(
    source_version_id: str,
    project_id: str = Query(...),
    owner_id: str   = Query(...),
):
    """Return aggregate metrics for a completed analysis."""
    # Find the latest completed run for this source version
    run = next(
        (r for r in reversed(list(_runs.values()))
         if r["source_version_id"] == source_version_id and r["status"] == "completed"),
        None,
    )
    if not run:
        raise HTTPException(status_code=404, detail="No completed analysis found for this source version")

    return run["metrics"]


@router.get("/{source_version_id}/graph", response_model=GraphResponse)
async def get_graph(
    source_version_id: str,
    project_id: str = Query(...),
    owner_id: str   = Query(...),
    depth: int      = Query(default=2, ge=1, le=5, description="Relationship traversal depth"),
    cursor: Optional[str] = Query(default=None, description="Pagination cursor (skip count)"),
    limit: int      = Query(default=100, le=500),
):
    """
    Return a bounded, paginated view of the dependency graph.
    Nodes and edges are scoped strictly to this source version.
    """
    skip = int(cursor) if cursor and cursor.isdigit() else 0

    node_cypher = """
    MATCH (n {source_version_id: $svid, project_id: $pid, owner_id: $oid})
    WHERE n:File OR n:ExternalDependency OR n:Symbol
    RETURN n.node_id   AS id,
           labels(n)[0] AS label,
           n.file_path  AS file_path,
           COALESCE(n.name, n.file_path) AS name,
           n.language   AS language,
           n.lines_of_code AS loc
    ORDER BY n.node_id
    SKIP $skip LIMIT $limit
    """
    edge_cypher = """
    MATCH (a {source_version_id: $svid, project_id: $pid, owner_id: $oid})
          -[r]->(b {source_version_id: $svid})
    RETURN a.node_id AS source_id,
           b.node_id AS target_id,
           type(r)   AS relationship,
           coalesce(r.confidence, 1.0)         AS confidence,
           coalesce(r.extraction_method, 'static') AS extraction_method
    SKIP $skip LIMIT $limit
    """

    params = {"svid": source_version_id, "pid": project_id, "oid": owner_id, "skip": skip, "limit": limit}

    try:
        raw_nodes = await run_query(node_cypher, params)
        raw_edges = await run_query(edge_cypher, params)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Graph DB unavailable: {exc}")

    nodes = [
        GraphNode(
            id=r["id"],
            label=r["label"],
            name=r["name"] or r["id"],
            file_path=r.get("file_path"),
            language=r.get("language"),
            properties={"loc": r.get("loc", 0)},
        )
        for r in raw_nodes
    ]
    edges = [
        GraphEdge(
            source_id=r["source_id"],
            target_id=r["target_id"],
            relationship=r["relationship"],
            confidence=r["confidence"],
            extraction_method=r["extraction_method"],
        )
        for r in raw_edges
    ]

    next_cursor = str(skip + limit) if len(raw_nodes) == limit else None

    from uuid import UUID
    return GraphResponse(
        source_version_id=UUID(source_version_id),
        nodes=nodes,
        edges=edges,
        total_nodes=len(nodes),
        total_edges=len(edges),
        cursor=next_cursor,
    )


@router.get("/{source_version_id}/diagnostics", response_model=DiagnosticsResponse)
async def get_diagnostics(
    source_version_id: str,
    project_id: str = Query(...),
    owner_id: str   = Query(...),
):
    """Return parser diagnostics (warnings + errors) from the last analysis run."""
    run = next(
        (r for r in reversed(list(_runs.values()))
         if r["source_version_id"] == source_version_id),
        None,
    )
    if not run:
        raise HTTPException(status_code=404, detail="No analysis run found for this source version")

    diags = run.get("diagnostics", [])
    from uuid import UUID
    return DiagnosticsResponse(
        source_version_id=UUID(source_version_id),
        total=len(diags),
        diagnostics=[ParserDiagnostic(**d) for d in diags],
    )
