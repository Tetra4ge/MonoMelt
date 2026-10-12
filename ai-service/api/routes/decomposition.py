from fastapi import APIRouter, BackgroundTasks, HTTPException

from db.pg_client import fetchrow
from models.schemas import TriggerDecompositionRequest, TriggerDecompositionResponse
from services.decomposition_engine import DecompositionEngine

router = APIRouter()


@router.post("/generate", response_model=TriggerDecompositionResponse, status_code=202)
async def trigger_decomposition(request: TriggerDecompositionRequest, background_tasks: BackgroundTasks):
    """
    Trigger the decomposition engine to generate microservice boundaries based on the requested strategy.
    The scenario row must already exist and belong to the stated owner/project/source version.
    """
    scenario = await fetchrow(
        """
        SELECT id FROM public.decomposition_scenarios
        WHERE id = $1 AND project_id = $2 AND source_version_id = $3 AND owner_id = $4
        """,
        str(request.scenario_id), str(request.project_id), str(request.source_version_id), str(request.owner_id),
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario was not found for this project")

    engine = DecompositionEngine(
        scenario_id=request.scenario_id,
        project_id=request.project_id,
        source_version_id=request.source_version_id,
        strategy_type=request.strategy_type,
        owner_id=request.owner_id,
    )

    # Run the engine in the background so we don't block the API Gateway
    background_tasks.add_task(engine.run)

    return TriggerDecompositionResponse(
        success=True,
        scenario_id=request.scenario_id,
        status="generating",
        message="Decomposition engine triggered successfully in the background."
    )
