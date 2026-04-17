from fastapi import APIRouter, HTTPException

from app.models.schemas import MetricsRequest, MetricsResponse
from app.services.metrics import compute_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/compute", response_model=MetricsResponse)
def post_compute(body: MetricsRequest) -> MetricsResponse:
    try:
        return compute_metrics(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
