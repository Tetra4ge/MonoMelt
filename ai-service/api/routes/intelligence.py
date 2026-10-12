"""
Intelligence API Routes
=======================
Endpoints to trigger LLM enrichment and fetch findings.
"""

import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field, AliasChoices

from db.pg_client import fetch, fetchrow, execute
from services.enrichment import run_intelligence_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["Intelligence"])

class TriggerIntelligenceRequest(BaseModel):
    source_version_id: str = Field(validation_alias=AliasChoices('source_version_id', 'sourceVersionId'))

class ReviewFindingRequest(BaseModel):
    review_status: str

@router.post("/trigger", status_code=202)
async def trigger_intelligence(
    request: TriggerIntelligenceRequest,
    background_tasks: BackgroundTasks,
    project_id: str = Query(...),
    owner_id: str = Query(...),
):
    """
    Start the intelligence pipeline in the background.
    """
    svid = str(request.source_version_id)

    source = await fetchrow(
        """
        SELECT sv.id FROM public.source_versions sv
        JOIN public.projects p ON p.id = sv.project_id
        WHERE sv.id = $1 AND sv.project_id = $2 AND p.owner_id = $3
        """,
        svid, project_id, owner_id,
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source version was not found for this project")

    background_tasks.add_task(
        run_intelligence_pipeline,
        project_id=project_id,
        source_version_id=svid,
        owner_id=owner_id
    )
    
    return {"success": True, "message": "Intelligence pipeline started."}


@router.get("/{source_version_id}/findings")
async def get_findings(
    source_version_id: str,
    project_id: str = Query(...),
    owner_id: str = Query(...),
):
    """
    Fetch all LLM findings for a given source version.
    """
    rows = await fetch(
        "SELECT id, finding_type, subject_ids, explanation, confidence, evidence_ids, review_status, needs_review, created_at FROM public.ai_findings WHERE source_version_id = $1 AND project_id = $2 AND owner_id = $3 ORDER BY confidence DESC",
        source_version_id, project_id, owner_id
    )
    
    return {"success": True, "data": rows}


@router.post("/findings/{finding_id}/review")
async def review_finding(
    finding_id: str,
    request: ReviewFindingRequest,
    project_id: str = Query(...),
    owner_id: str = Query(...),
):
    """
    Update the human-in-the-loop review status of a finding.
    """
    if request.review_status not in ["approved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid review status")
        
    await execute(
        "UPDATE public.ai_findings SET review_status = $1, needs_review = false WHERE id = $2 AND project_id = $3 AND owner_id = $4",
        request.review_status, finding_id, project_id, owner_id
    )
    
    return {"success": True, "message": f"Finding {finding_id} marked as {request.review_status}"}
