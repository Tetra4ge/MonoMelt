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
import json
import os
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
from services.import_resolver import resolve_imports
from services.graph_builder import build_graph, delete_graph
from services.metrics_calculator import compute_local_metrics, compute_graph_metrics
from db.neo4j_client import run_query, verify_connectivity
from db.pg_client import fetch, fetchrow, execute, execute_many

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis"])

# ---------------------------------------------------------------------------
# Background analysis pipeline
# ---------------------------------------------------------------------------

GRAPH_LANGUAGES = ("python", "javascript", "typescript")
SOURCE_EXTENSIONS = (".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".java", ".go", ".cs", ".c", ".cpp", ".h", ".rb", ".php")
DOWNLOAD_WORKERS = 8


def _load_source_files(supabase, project_id: str, source_version_id: str) -> list[dict]:
    """Blocking: read the file manifest and download every source file (parallel)."""
    from concurrent.futures import ThreadPoolExecutor

    response = supabase.table("source_files") \
        .select("file_path, language, content_hash") \
        .eq("source_version_id", source_version_id) \
        .eq("status", "included") \
        .execute()
    manifest = response.data or []

    if not manifest:
        return _load_sources_from_zip(supabase, project_id)

    def download(file_info: dict) -> Optional[dict]:
        file_path = file_info["file_path"]
        if os.path.splitext(file_path)[1].lower() not in SOURCE_EXTENSIONS:
            return None
        storage_path = f"projects/{project_id}/{source_version_id}/files/{file_path}"
        try:
            data = supabase.storage.from_("openai").download(storage_path)
            return {"file_path": file_path, "source": data.decode("utf-8", errors="replace") if data else ""}
        except Exception as exc:
            logger.warning("Could not download %s: %s", storage_path, exc)
            return None

    with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
        return [f for f in pool.map(download, manifest) if f is not None]


def _load_sources_from_zip(supabase, project_id: str) -> list[dict]:
    """Fallback when the manifest is empty: read source straight from the stored ZIP archive(s)."""
    import io
    import zipfile

    logger.info("Manifest empty, searching Supabase storage for project %s ZIP archives", project_id)
    files: list[dict] = []
    try:
        zip_paths = []
        for item in supabase.storage.from_("openai").list(f"projects/{project_id}") or []:
            item_name = item.get("name", "")
            if item_name.endswith(".zip"):
                zip_paths.append(f"projects/{project_id}/{item_name}")
            elif item_name:
                for sub in supabase.storage.from_("openai").list(f"projects/{project_id}/{item_name}") or []:
                    if sub.get("name", "").endswith(".zip"):
                        zip_paths.append(f"projects/{project_id}/{item_name}/{sub['name']}")

        for zip_path in zip_paths:
            zip_bytes = supabase.storage.from_("openai").download(zip_path)
            if not zip_bytes:
                continue
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
                for name in archive.namelist():
                    if os.path.splitext(name)[1].lower() in SOURCE_EXTENSIONS:
                        files.append({"file_path": name, "source": archive.read(name).decode("utf-8", errors="replace")})
    except Exception as exc:
        logger.error("Failed to extract ZIP from storage for project %s: %s", project_id, exc)
    return files


async def _save_diagnostics(analysis_run_id: str, parsed) -> None:
    """Persist parser warnings/errors so GET /analysis/{id}/diagnostics has data."""
    rows = [
        (analysis_run_id, pf.file_path, d.get("parser", "unknown"), d.get("severity", "warning"),
         d.get("message", ""), d.get("line"), d.get("column"))
        for pf in parsed
        for d in pf.diagnostics
    ]
    if rows:
        await execute_many(
            """
            INSERT INTO public.parser_diagnostics
                (analysis_run_id, file_path, parser, severity, message, line_number, column_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            rows,
        )


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
    
    # Set status to running in DB
    await execute(
        "UPDATE public.analysis_runs SET status = 'running', started_at = timezone('utc', now()) WHERE id = $1",
        analysis_run_id
    )

    try:
        from core.config import get_settings
        from supabase import create_client

        settings = get_settings()
        supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

        # Update Supabase status to analyzing so frontend knows we started
        supabase.table("analysis_jobs").update({"status": "analyzing"}).eq("source_version_id", source_version_id).execute()

        # 1+2. Load the manifest and download file contents. These are blocking
        # Supabase calls (thousands for a large repo), so keep them off the event loop.
        files_for_parsing = await asyncio.to_thread(
            _load_source_files, supabase, project_id, source_version_id
        )
        logger.info("Analysis run %s: %d source files downloaded", analysis_run_id, len(files_for_parsing))

        # 3. Parse
        parsed = await asyncio.to_thread(parse_files, files_for_parsing)
        resolve_imports(parsed)  # link imports to uploaded files -> real File->File edges
        logger.info("Parsed %d files", len(parsed))

        if not any(pf.language in GRAPH_LANGUAGES for pf in parsed):
            raise ValueError(
                "No supported source files found. MonoMelt currently analyses Python, JavaScript and TypeScript."
            )

        await _save_diagnostics(analysis_run_id, parsed)

        # 4. Build Neo4j graph (idempotent — delete first)
        await delete_graph(source_version_id, project_id, owner_id)
        graph_summary = await build_graph(
            parsed_files=parsed,
            analysis_run_id=analysis_run_id,
            source_version_id=source_version_id,
            project_id=project_id,
            owner_id=owner_id,
        )

        # 5. Compute metrics
        local_metrics = compute_local_metrics(parsed)
        agg_metrics = await compute_graph_metrics(
            source_version_id=source_version_id,
            project_id=project_id,
            owner_id=owner_id,
            local_metrics=local_metrics,
        )

        # Insert metrics to postgres
        await execute(
            """
            INSERT INTO public.code_metrics (
                analysis_run_id, source_version_id, total_files, total_lines,
                total_functions, total_classes, total_modules,
                unresolved_imports, cycle_count, graph_components,
                language_breakdown, top_fan_in, top_fan_out, centrality_candidates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """,
            analysis_run_id, source_version_id, agg_metrics.total_files, agg_metrics.total_lines,
            agg_metrics.total_functions, agg_metrics.total_classes, agg_metrics.total_modules,
            agg_metrics.unresolved_imports, agg_metrics.cycle_count, agg_metrics.graph_components,
            json.dumps(agg_metrics.language_breakdown), json.dumps([m.model_dump() for m in agg_metrics.top_fan_in]),
            json.dumps([m.model_dump() for m in agg_metrics.top_fan_out]), json.dumps(agg_metrics.centrality_candidates)
        )

        # 6. Mark completed
        await execute(
            """
            UPDATE public.analysis_runs
            SET status = 'completed', completed_at = timezone('utc', now()), graph_summary = $1
            WHERE id = $2
            """,
            json.dumps(graph_summary), analysis_run_id
        )

        # Update Supabase status so frontend breaks out of polling loop
        supabase.table("analysis_jobs").update({"status": "completed"}).eq("source_version_id", source_version_id).execute()

        logger.info("Analysis run %s completed successfully", analysis_run_id)

    except Exception as exc:
        logger.error("Analysis run %s failed: %s", analysis_run_id, exc, exc_info=True)
        await execute(
            "UPDATE public.analysis_runs SET status = 'failed', error_message = $1 WHERE id = $2",
            str(exc), analysis_run_id
        )
        try:
            from core.config import get_settings
            from supabase import create_client
            settings = get_settings()
            supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
            supabase.table("analysis_jobs").update({
                "status": "failed",
                "error_code": str(exc)
            }).eq("source_version_id", source_version_id).execute()
        except Exception:
            logger.exception("Could not mark analysis job %s as failed", source_version_id)


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
    svid   = str(request.source_version_id)

    # The gateway/worker own project and source creation. Never write to auth.users
    # from here: Supabase's auth schema is managed by Supabase and rejects app writes.
    try:
        source = await fetchrow(
            """
            SELECT sv.id
            FROM public.source_versions sv
            JOIN public.projects p ON p.id = sv.project_id
            WHERE sv.id = $1 AND sv.project_id = $2 AND p.owner_id = $3
            """,
            svid, project_id, owner_id,
        )
        if not source:
            raise HTTPException(status_code=404, detail="Source version was not found for this project")

        manifest = await fetchrow(
            "SELECT id FROM public.source_files WHERE source_version_id = $1 AND status = 'included' LIMIT 1",
            svid,
        )
        if not manifest:
            raise HTTPException(status_code=409, detail="Source ingestion is not complete; wait for the worker to create the source manifest")

        existing = await fetchrow(
            """
            SELECT id, status FROM public.analysis_runs
            WHERE source_version_id = $1 AND project_id = $2
              AND status IN ('pending', 'running')
            ORDER BY created_at DESC LIMIT 1
            """,
            svid, project_id,
        )
        if existing:
            return TriggerAnalysisResponse(
                success=True,
                analysis_run_id=uuid.UUID(str(existing['id'])),
                status=existing['status'],
                message="Analysis is already in progress.",
            )

        result = await fetchrow(
            """
            INSERT INTO public.analysis_runs (project_id, source_version_id, owner_id, status)
            VALUES ($1, $2, $3, 'pending')
            RETURNING id
            """,
            project_id, svid, owner_id,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unable to queue analysis for source_version=%s", svid)
        raise HTTPException(
            status_code=503,
            detail=f"Analysis database error: {str(exc)}",
        ) from exc
    
    if not result or 'id' not in result:
        raise HTTPException(status_code=500, detail="Failed to create analysis run in database")
        
    run_id = str(result['id'])

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
        message="Analysis started. Poll /analysis/run/{run_id}/status for updates.",
    )


@router.get("/run/{run_id}/status")
async def get_run_status(run_id: str):
    """Get the current status of an analysis run."""
    row = await fetchrow(
        "SELECT id, project_id, source_version_id, owner_id, status, started_at, completed_at, error_message, graph_summary FROM public.analysis_runs WHERE id = $1",
        run_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Analysis run not found")
        
    # Serialize datetime/uuid objects if necessary, though FastAPI handles dict well
    return {"success": True, "data": {
        "analysis_run_id": str(row["id"]),
        "source_version_id": str(row["source_version_id"]),
        "project_id": str(row["project_id"]),
        "owner_id": str(row["owner_id"]),
        "status": row["status"],
        "started_at": row["started_at"].isoformat() if row["started_at"] else None,
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
        "error_message": row["error_message"],
        "graph_summary": json.loads(row["graph_summary"]) if isinstance(row["graph_summary"], str) else row["graph_summary"]
    }}


@router.get("/{source_version_id}/metrics", response_model=AggregateMetrics)
async def get_metrics(
    source_version_id: str,
    project_id: str = Query(...),
    owner_id: str   = Query(...),
):
    """Return aggregate metrics for a completed analysis."""
    # Find the latest completed run for this source version
    run = await fetchrow(
        "SELECT id FROM public.analysis_runs WHERE source_version_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
        source_version_id
    )
    if not run:
        raise HTTPException(status_code=404, detail="No completed analysis found for this source version")
        
    row = await fetchrow("SELECT * FROM public.code_metrics WHERE analysis_run_id = $1", str(run["id"]))
    if not row:
        raise HTTPException(status_code=404, detail="Metrics not found")
        
    return AggregateMetrics(
        source_version_id=uuid.UUID(source_version_id),
        total_files=row["total_files"],
        total_lines=row["total_lines"],
        total_functions=row["total_functions"],
        total_classes=row["total_classes"],
        total_modules=row["total_modules"],
        unresolved_imports=row["unresolved_imports"],
        cycle_count=row["cycle_count"],
        graph_components=row["graph_components"],
        language_breakdown=json.loads(row["language_breakdown"]) if isinstance(row["language_breakdown"], str) else row["language_breakdown"],
        top_fan_in=json.loads(row["top_fan_in"]) if isinstance(row["top_fan_in"], str) else row["top_fan_in"],
        top_fan_out=json.loads(row["top_fan_out"]) if isinstance(row["top_fan_out"], str) else row["top_fan_out"],
        centrality_candidates=json.loads(row["centrality_candidates"]) if isinstance(row["centrality_candidates"], str) else row["centrality_candidates"]
    )


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
    run = await fetchrow(
        "SELECT id FROM public.analysis_runs WHERE source_version_id = $1 ORDER BY created_at DESC LIMIT 1",
        source_version_id
    )
    if not run:
        raise HTTPException(status_code=404, detail="No analysis run found for this source version")

    rows = await fetch(
        "SELECT file_path, parser, severity, message, line_number, column_number FROM public.parser_diagnostics WHERE analysis_run_id = $1",
        str(run["id"])
    )
    
    from uuid import UUID
    return DiagnosticsResponse(
        source_version_id=UUID(source_version_id),
        total=len(rows),
        diagnostics=[ParserDiagnostic(**r) for r in rows],
    )
