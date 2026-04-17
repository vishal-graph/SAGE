from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.models.schemas import CleanFloorplanImageRequest, CleanFloorplanImageResponse
from app.services.gemini_clean_image import clean_floorplan_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/clean-floorplan-image", response_model=CleanFloorplanImageResponse)
def ai_clean_floorplan_image(req: CleanFloorplanImageRequest):
    """
    Use a Gemini image model to redraw the plan: walls and doors only, no furniture or annotations.
    Returns a PNG (approximate geometry). Re-upload the original raster to restore it.
    """
    try:
        raw = clean_floorplan_image(req.image_b64, req.mime_type, req.width, req.height)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:  # pragma: no cover
        logger.exception("Gemini clean floorplan image failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return CleanFloorplanImageResponse(
        image_b64=raw["image_b64"],
        mime_type=raw["mime_type"],
        width=raw["width"],
        height=raw["height"],
        source_width=raw["source_width"],
        source_height=raw["source_height"],
        model=raw["model"],
    )


@router.post("/optimize")
def ai_optimize():
    return JSONResponse(
        status_code=501,
        content={"detail": "Not implemented — AI phase 2"},
    )


@router.post("/suggest")
def ai_suggest():
    return JSONResponse(
        status_code=501,
        content={"detail": "Not implemented — AI phase 2"},
    )


@router.post("/validate")
def ai_validate():
    return JSONResponse(
        status_code=501,
        content={"detail": "Not implemented — AI phase 2"},
    )
