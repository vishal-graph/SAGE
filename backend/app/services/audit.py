from __future__ import annotations

import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import Any

from starlette.requests import Request

from app.services.auth import find_user_by_id, load_sessions, utc_now_iso
from app.services.supabase_store import supabase_enabled
from app.services.supabase_client import create_supabase

AUDIT_STORAGE = Path(__file__).resolve().parent.parent.parent / "storage" / "audit"
AUDIT_LOG_PATH = AUDIT_STORAGE / "requests.jsonl"


def audit_enabled() -> bool:
    return (os.environ.get("ENABLE_REQUEST_AUDIT", "1").strip().lower() not in {"0", "false", "no"})


def trust_proxy_headers() -> bool:
    return (os.environ.get("TRUST_PROXY_HEADERS", "1").strip().lower() not in {"0", "false", "no"})


def _audit_salt() -> str:
    return os.environ.get("AUDIT_HASH_SALT", "sige-audit-default-salt")


def _sha256(value: str) -> str:
    payload = f"{_audit_salt()}::{value}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _extract_bearer_token(authorization: str) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return ""
    return token.strip()


def _resolve_user_id_from_token(token: str) -> str | None:
    if not token:
        return None
    session = load_sessions().get(token)
    if not session:
        return None
    user = find_user_by_id(str(session.get("user_id", "")))
    if not user:
        return None
    return str(user.get("id", ""))


def _client_ip(request: Request) -> str:
    if trust_proxy_headers():
        fwd = request.headers.get("x-forwarded-for", "").strip()
        if fwd:
            return fwd.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    return request.client.host if request.client else ""


def create_request_id() -> str:
    return str(uuid.uuid4())


def build_request_audit(
    request: Request,
    *,
    request_id: str,
    status_code: int,
    duration_ms: int,
) -> dict[str, Any]:
    raw_ip = _client_ip(request)
    auth_header = request.headers.get("authorization", "").strip()
    bearer = _extract_bearer_token(auth_header) if auth_header else ""
    user_id = _resolve_user_id_from_token(bearer)
    ua = request.headers.get("user-agent", "").strip()

    return {
        "timestamp": utc_now_iso(),
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "query": request.url.query,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "ip": raw_ip or None,
        "ip_hash": _sha256(raw_ip) if raw_ip else None,
        "user_agent": ua or None,
        "user_agent_hash": _sha256(ua) if ua else None,
        "auth_user_id": user_id,
        "token_hash": _sha256(bearer) if bearer else None,
        "origin": request.headers.get("origin"),
        "referer": request.headers.get("referer"),
        "content_length": request.headers.get("content-length"),
    }


def persist_request_audit(record: dict[str, Any]) -> None:
    if not audit_enabled():
        return
    if supabase_enabled():
        try:
            create_supabase().table("request_audit_logs").insert(record).execute()
            return
        except Exception:
            # Fall back to local file if Supabase table is missing/unreachable.
            pass
    AUDIT_STORAGE.mkdir(parents=True, exist_ok=True)
    with AUDIT_LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=True) + "\n")
