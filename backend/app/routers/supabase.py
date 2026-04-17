from __future__ import annotations

from fastapi import APIRouter

from app.services.supabase_client import supabase_health

router = APIRouter(prefix="/supabase", tags=["supabase"])


@router.get("/health")
def health() -> dict:
    return supabase_health()
