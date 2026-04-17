from __future__ import annotations

import json
import os
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import LocationSearchResponse, LocationSuggestion

router = APIRouter(prefix="/geo", tags=["geo"])


def _google_maps_key() -> str:
    return (os.environ.get("GOOGLE_MAPS_API_KEY") or "").strip()


def _search_google_places(query: str) -> list[LocationSuggestion]:
    key = _google_maps_key()
    if not key:
        return []
    url = (
        "https://maps.googleapis.com/maps/api/place/textsearch/json"
        f"?query={quote(query)}&key={quote(key)}"
    )
    request = Request(
        url,
        headers={
            "User-Agent": "SIGE/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))
    results = payload.get("results") if isinstance(payload, dict) else []
    suggestions: list[LocationSuggestion] = []
    for item in results if isinstance(results, list) else []:
        try:
            geometry = item.get("geometry", {}) if isinstance(item, dict) else {}
            location = geometry.get("location", {}) if isinstance(geometry, dict) else {}
            label = str(item.get("formatted_address") or item.get("name") or "")
            suggestions.append(
                LocationSuggestion(
                    label=label,
                    lat=float(location.get("lat")),
                    lng=float(location.get("lng")),
                )
            )
        except Exception:
            continue
    return suggestions[:5]


def _search_nominatim(query: str) -> list[LocationSuggestion]:
    url = (
        "https://nominatim.openstreetmap.org/search"
        f"?format=jsonv2&limit=5&q={quote(query)}"
    )
    request = Request(
        url,
        headers={
            "User-Agent": "SIGE/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    suggestions: list[LocationSuggestion] = []
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
    return suggestions


@router.get("/search", response_model=LocationSearchResponse)
def search_locations(q: str = Query(..., min_length=2, max_length=120)) -> LocationSearchResponse:
    query = q.strip()
    try:
        suggestions = _search_google_places(query)
        if not suggestions:
            suggestions = _search_nominatim(query)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Location lookup failed: {exc}") from exc
    return LocationSearchResponse(suggestions=suggestions)


@router.get("/reverse", response_model=LocationSuggestion)
def reverse_location(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> LocationSuggestion:
    key = _google_maps_key()
    if key:
        try:
            url = (
                "https://maps.googleapis.com/maps/api/geocode/json"
                f"?latlng={lat},{lng}&key={quote(key)}"
            )
            request = Request(
                url,
                headers={
                    "User-Agent": "SIGE/1.0",
                    "Accept": "application/json",
                },
            )
            with urlopen(request, timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))
            results = payload.get("results") if isinstance(payload, dict) else []
            if isinstance(results, list) and results:
                first = results[0]
                label = str(first.get("formatted_address") or "")
                if label:
                    return LocationSuggestion(label=label, lat=lat, lng=lng)
        except Exception:
            pass

    try:
        url = (
            "https://nominatim.openstreetmap.org/reverse"
            f"?format=jsonv2&lat={lat}&lon={lng}"
        )
        request = Request(
            url,
            headers={
                "User-Agent": "SIGE/1.0",
                "Accept": "application/json",
            },
        )
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
        label = str(payload.get("display_name") or f"{lat}, {lng}")
        return LocationSuggestion(label=label, lat=lat, lng=lng)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Reverse geocoding failed: {exc}") from exc
