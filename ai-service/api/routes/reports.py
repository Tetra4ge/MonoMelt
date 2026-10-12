from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from supabase import Client, create_client
from core.config import get_settings
from services.report_generator import ReportAgent
from services.realtime import publish_report_update
from models.schemas import ReportGenerateRequest, ReportGenerateResponse
import logging

router = APIRouter(prefix="/reports", tags=["Reports"])
logger = logging.getLogger(__name__)

def get_supabase_service_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

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
        agent = ReportAgent(project_id, supabase, owner_id=owner_id)
        final_report = await agent.build_report()

        # 5. Persist the generated JSONB payload and mark as completed
        supabase.table('project_reports').update({
            "payload": final_report.model_dump(),
            "status": "completed"
        }).eq('project_id', project_id)\
          .eq('version_number', next_version)\
          .execute()

        logger.info(f"Report v{next_version} successfully generated for {project_id}")

        # 6. Notify the API Gateway (via Redis) so it can push a real-time
        # `report_completed` WebSocket event to the React frontend.
        await publish_report_update(project_id, "completed", next_version)

    except Exception as e:
        logger.error(f"Failed to generate report for {project_id}: {str(e)}")
        # 7. Graceful Failure: Update database state so frontend knows it failed
        try:
            supabase.table('project_reports').update({
                "status": "failed",
                "payload": {"error": str(e)}
            }).eq('project_id', project_id)\
              .eq('version_number', next_version)\
              .eq('status', 'generating')\
              .execute()
            await publish_report_update(project_id, "failed", next_version)
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
