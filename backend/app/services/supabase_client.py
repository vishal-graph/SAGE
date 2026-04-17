from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from supabase import Client, create_client


def get_supabase_env() -> tuple[str, str]:
    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "").strip()
    return url, key


def create_supabase() -> Client:
    url, key = get_supabase_env()
    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return create_client(url, key)


def supabase_health() -> dict[str, Any]:
    url, key = get_supabase_env()
    if not url or not key:
        return {"configured": False, "reachable": False, "detail": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"}

    health_url = f"{url.rstrip('/')}/rest/v1/"
    request = Request(
        health_url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            raw = response.read(5000).decode("utf-8", errors="ignore")
            parsed: Any = None
            if raw.strip():
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = raw[:200]
            return {
                "configured": True,
                "reachable": True,
                "status_code": response.status,
                "detail": parsed,
            }
    except Exception as exc:
        return {"configured": True, "reachable": False, "detail": str(exc)}
