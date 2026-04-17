from __future__ import annotations

import json
import os
from typing import Any

from redis import Redis


def get_redis_url() -> str:
    return (os.environ.get("REDIS_URL") or "").strip()


def redis_enabled() -> bool:
    return bool(get_redis_url())


def create_redis() -> Redis:
    return Redis.from_url(get_redis_url(), decode_responses=True)


def redis_health() -> dict[str, Any]:
    if not redis_enabled():
        return {"configured": False, "reachable": False, "detail": "REDIS_URL is not set"}
    try:
        client = create_redis()
        pong = client.ping()
        return {"configured": True, "reachable": bool(pong)}
    except Exception as exc:
        return {"configured": True, "reachable": False, "detail": str(exc)}


def cache_get_json(key: str) -> Any | None:
    if not redis_enabled():
        return None
    try:
        raw = create_redis().get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    if not redis_enabled():
        return
    try:
        create_redis().setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        return
