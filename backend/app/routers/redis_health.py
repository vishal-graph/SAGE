from __future__ import annotations

from fastapi import APIRouter

from app.services.redis_client import redis_health

router = APIRouter(prefix="/redis", tags=["redis"])


@router.get("/health")
def health() -> dict:
    return redis_health()
