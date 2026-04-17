from __future__ import annotations

import json
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import LocationSearchResponse, LocationSuggestion

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/search", response_model=LocationSearchResponse)
def search_locations(q: str = Query(..., min_length=2, max_length=120)) -> LocationSearchResponse:
    url = (
        "https://nominatim.openstreetmap.org/search"
        f"?format=jsonv2&limit=5&q={quote(q.strip())}"
    )
    request = Request(
        url,
        headers={
            "User-Agent": "SIGE/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Location lookup failed: {exc}") from exc

    suggestions = []
    for item in payload if isinstance(payload, list) else []:
        try:
            suggestions.append(
                LocationSuggestion(
                    label=str(item.get("display_name") or ""),
                    lat=float(item.get("lat")),
                    lng=float(item.get("lon")),
                )
            )
        except Exception:
            continue
    return LocationSearchResponse(suggestions=suggestions)
