"""
FastAPI routes for Phase 6 Planning Engine.
"""

from fastapi import APIRouter, HTTPException, status
from models.planning import (
    GeneratePlanRequest,
    PlanReportResponse
)
from services.planning_engine import PlanningEngine

router = APIRouter(prefix="/api/planning", tags=["Planning Engine"])


@router.post("/generate", response_model=PlanReportResponse, status_code=status.HTTP_200_OK)

def generate_plan_report(payload: GeneratePlanRequest):
    """
    Generates a versioned planning report for a given scenario revision.
    """
    try:
        engine = PlanningEngine(
            proposed_services=payload.proposed_services,
            assumptions=payload.assumptions
        )
        report = engine.generate_plan()
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate planning report: {str(e)}"
        )


@router.post("/recalculate", response_model=PlanReportResponse, status_code=status.HTTP_200_OK)

def recalculate_plan_report(payload: GeneratePlanRequest):
    """
    Recalculates a planning report with updated user assumptions.
    """
    try:
        engine = PlanningEngine(
            proposed_services=payload.proposed_services,
            assumptions=payload.assumptions
        )
        report = engine.generate_plan()
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recalculate planning report: {str(e)}"
        )
