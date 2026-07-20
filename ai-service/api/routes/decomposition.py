from fastapi import APIRouter, BackgroundTasks, Depends
from uuid import UUID
from models.schemas import TriggerDecompositionRequest, TriggerDecompositionResponse
from services.decomposition_engine import DecompositionEngine

router = APIRouter()

@router.post("/generate", response_model=TriggerDecompositionResponse, status_code=202)
async def trigger_decomposition(request: TriggerDecompositionRequest, background_tasks: BackgroundTasks):
    """
    Trigger the decomposition engine to generate microservice boundaries based on the requested strategy.
    """
    engine = DecompositionEngine(
        scenario_id=request.scenario_id,
        project_id=request.project_id,
        source_version_id=request.source_version_id,
        strategy_type=request.strategy_type
    )
    
    # Run the engine asynchronously in the background so we don't block the API Gateway
    background_tasks.add_task(engine.run)
    
    return TriggerDecompositionResponse(
        success=True,
        scenario_id=request.scenario_id,
        status="generating",
        message="Decomposition engine triggered successfully in the background."
    )
