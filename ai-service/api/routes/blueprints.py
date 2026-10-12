"""
FastAPI routes for Phase 7 Blueprint Export Engine.
"""

from fastapi import APIRouter, HTTPException, status
from models.blueprints import (
    GenerateBlueprintRequest,
    BlueprintResponse
)
from services.blueprint_generator import BlueprintGenerator

router = APIRouter(prefix="/api/blueprints", tags=["Blueprint Generator Engine"])


@router.post("/generate", response_model=BlueprintResponse, status_code=status.HTTP_200_OK)

def generate_blueprint(payload: GenerateBlueprintRequest):
    """
    Generates a versioned architecture blueprint package (ZIP + manifest).
    """
    try:
        generator = BlueprintGenerator(request=payload)
        response = generator.generate()
        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate blueprint package: {str(e)}"
        )
