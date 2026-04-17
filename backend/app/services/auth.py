from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import Header, HTTPException, status

from app.models.schemas import UserSummary
from app.services.supabase_client import create_supabase, get_supabase_env

AUTH_STORAGE = Path(__file__).resolve().parent.parent.parent / "storage" / "auth"
USERS_PATH = AUTH_STORAGE / "users.json"
SESSIONS_PATH = AUTH_STORAGE / "sessions.json"
SUPABASE_USERS_TABLE = "auth_users"
SUPABASE_SESSIONS_TABLE = "auth_sessions"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _supabase_enabled() -> bool:
    url, key = get_supabase_env()
    return bool(url and key)


def ensure_storage() -> None:
    AUTH_STORAGE.mkdir(parents=True, exist_ok=True)
    if not USERS_PATH.exists():
        USERS_PATH.write_text("[]", encoding="utf-8")
    if not SESSIONS_PATH.exists():
        SESSIONS_PATH.write_text("{}", encoding="utf-8")


def _read_json(path: Path, fallback: Any) -> Any:
    ensure_storage()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    ensure_storage()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _normalize_user_record(user: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(user)
    normalized["email"] = normalize_email(str(normalized.get("email", "")))
    normalized["phone"] = normalize_phone(str(normalized.get("phone", "")))
    normalized["role"] = str(normalized.get("role") or "customer")
    normalized["name"] = str(normalized.get("name", "")).strip()
    return normalized


def load_users() -> list[Dict[str, Any]]:
    if _supabase_enabled():
        try:
            result = (
                create_supabase()
                .table(SUPABASE_USERS_TABLE)
                .select("id,email,phone,name,role,password_hash,created_at")
                .execute()
            )
            rows = result.data or []
            normalized = [_normalize_user_record(user) for user in rows if isinstance(user, dict)]
            return normalized
        except Exception:
            return []
    raw = _read_json(USERS_PATH, [])
    if not isinstance(raw, list):
        return []
    normalized = [_normalize_user_record(user) for user in raw if isinstance(user, dict)]
    if normalized != raw:
        save_users(normalized)
    return normalized


def save_users(users: list[Dict[str, Any]]) -> None:
    if _supabase_enabled():
        try:
            if not users:
                return
            create_supabase().table(SUPABASE_USERS_TABLE).upsert(users, on_conflict="id").execute()
        except Exception:
            return
        return
    _write_json(USERS_PATH, users)


def load_sessions() -> Dict[str, Dict[str, str]]:
    if _supabase_enabled():
        try:
            result = (
                create_supabase()
                .table(SUPABASE_SESSIONS_TABLE)
                .select("token,user_id,created_at")
                .execute()
            )
            rows = result.data or []
            out: Dict[str, Dict[str, str]] = {}
            for row in rows:
                if not isinstance(row, dict):
                    continue
                token = str(row.get("token") or "").strip()
                user_id = str(row.get("user_id") or "").strip()
                created_at = str(row.get("created_at") or "")
                if token and user_id:
                    out[token] = {"user_id": user_id, "created_at": created_at}
            return out
        except Exception:
            return {}
    raw = _read_json(SESSIONS_PATH, {})
    return raw if isinstance(raw, dict) else {}


def save_sessions(sessions: Dict[str, Dict[str, str]]) -> None:
    if _supabase_enabled():
        try:
            db = create_supabase()
            db.table(SUPABASE_SESSIONS_TABLE).delete().neq("token", "").execute()
            if sessions:
                payload = [
                    {"token": token, "user_id": str(meta.get("user_id", "")), "created_at": str(meta.get("created_at", utc_now_iso()))}
                    for token, meta in sessions.items()
                    if token and str(meta.get("user_id", "")).strip()
                ]
                if payload:
                    db.table(SUPABASE_SESSIONS_TABLE).insert(payload).execute()
        except Exception:
            return
        return
    _write_json(SESSIONS_PATH, sessions)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit() or ch == "+")


def _pbkdf2(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = _pbkdf2(password, salt)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_b64, digest_b64 = stored_hash.split("$", 1)
        salt = base64.b64decode(salt_b64.encode())
        expected = base64.b64decode(digest_b64.encode())
    except Exception:
        return False
    actual = _pbkdf2(password, salt)
    return hmac.compare_digest(actual, expected)


def to_user_summary(user: Dict[str, Any]) -> UserSummary:
    normalized = _normalize_user_record(user)
    return UserSummary(
        id=str(normalized["id"]),
        email=str(normalized["email"]),
        name=str(normalized["name"]),
        role=str(normalized["role"]),
        phone=str(normalized.get("phone", "")),
        created_at=str(normalized["created_at"]),
    )


def find_user_by_email(email: str, role: str | None = None) -> Dict[str, Any] | None:
    target = normalize_email(email)
    for user in load_users():
        if role and str(user.get("role") or "") != role:
            continue
        if str(user.get("email", "")).lower() == target:
            return user
    return None


def find_user_by_phone(phone: str, role: str | None = None) -> Dict[str, Any] | None:
    target = normalize_phone(phone)
    for user in load_users():
        if role and str(user.get("role") or "") != role:
            continue
        if normalize_phone(str(user.get("phone", ""))) == target:
            return user
    return None


def find_users_by_identifier(identifier: str) -> list[Dict[str, Any]]:
    raw = identifier.strip()
    target_email = normalize_email(raw)
    target_phone = normalize_phone(raw)
    matches: list[Dict[str, Any]] = []
    for user in load_users():
        user_email = normalize_email(str(user.get("email", "")))
        user_phone = normalize_phone(str(user.get("phone", "")))
        if (target_email and user_email == target_email) or (target_phone and user_phone == target_phone):
            matches.append(user)
    return matches


def find_user_by_identifier(identifier: str, role: str | None = None) -> Dict[str, Any] | None:
    matches = find_users_by_identifier(identifier)
    if role:
        for user in matches:
            if str(user.get("role") or "") == role:
                return user
        return None
    return matches[0] if matches else None


def find_user_by_id(user_id: str) -> Dict[str, Any] | None:
    for user in load_users():
        if str(user.get("id")) == user_id:
            return user
    return None


def create_user(*, email: str, phone: str, password: str, name: str, role: str) -> Dict[str, Any]:
    users = load_users()
    normalized_email = normalize_email(email)
    normalized_phone = normalize_phone(phone)
    if any(str(existing.get("email", "")).lower() == normalized_email for existing in users):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for that email")
    if normalized_phone and any(normalize_phone(str(existing.get("phone", ""))) == normalized_phone for existing in users):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for that phone number")

    user = {
        "id": str(uuid.uuid4()),
        "email": normalized_email,
        "phone": normalized_phone,
        "name": name.strip(),
        "role": role,
        "password_hash": hash_password(password),
        "created_at": utc_now_iso(),
    }
    users.append(user)
    save_users(users)
    return user


def save_user(user: Dict[str, Any]) -> None:
    users = load_users()
    user_id = str(user.get("id") or "")
    if not user_id:
        return
    updated = False
    for idx, existing in enumerate(users):
        if str(existing.get("id")) == user_id:
            users[idx] = _normalize_user_record({**existing, **user})
            updated = True
            break
    if not updated:
        users.append(_normalize_user_record(user))
    save_users(users)


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    created_at = utc_now_iso()
    if _supabase_enabled():
        try:
            create_supabase().table(SUPABASE_SESSIONS_TABLE).insert(
                {"token": token, "user_id": user_id, "created_at": created_at}
            ).execute()
        except Exception:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create session")
        return token
    sessions = load_sessions()
    sessions[token] = {"user_id": user_id, "created_at": created_at}
    save_sessions(sessions)
    return token


def revoke_session(token: str) -> None:
    if _supabase_enabled():
        try:
            create_supabase().table(SUPABASE_SESSIONS_TABLE).delete().eq("token", token).execute()
        except Exception:
            return
        return
    sessions = load_sessions()
    if token in sessions:
        sessions.pop(token, None)
        save_sessions(sessions)


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    return value.strip()


def require_user(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    token = _extract_bearer_token(authorization)
    sessions = load_sessions()
    session = sessions.get(token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again")
    user = find_user_by_id(str(session.get("user_id", "")))
    if not user:
        sessions.pop(token, None)
        save_sessions(sessions)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    return user


def get_token_from_header(authorization: str | None) -> str:
    return _extract_bearer_token(authorization)


def require_user_from_token(token: str) -> Dict[str, Any]:
    clean_token = token.strip()
    if not clean_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    sessions = load_sessions()
    session = sessions.get(clean_token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again")
    user = find_user_by_id(str(session.get("user_id", "")))
    if not user:
        sessions.pop(clean_token, None)
        save_sessions(sessions)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    return user
