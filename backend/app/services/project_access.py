from __future__ import annotations

import json
import secrets
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.services.auth import find_user_by_email, find_user_by_phone, normalize_email, normalize_phone, utc_now_iso
from app.services.supabase_store import (
    load_access_index as load_access_index_supabase,
    load_access_record as load_access_record_supabase,
    load_messages as load_messages_supabase,
    overwrite_messages as overwrite_messages_supabase,
    save_access_record as save_access_record_supabase,
    supabase_enabled,
)

ACCESS_STORAGE = Path(__file__).resolve().parent.parent.parent / "storage" / "project_access"
ACCESS_INDEX_PATH = ACCESS_STORAGE / "index.json"
MESSAGES_DIR = ACCESS_STORAGE / "messages"
TEST_CUSTOMER_ALL_PROJECTS_PHONE = "9392698439"


def _new_invite_code() -> str:
    return secrets.token_hex(3).upper()


def ensure_storage() -> None:
    ACCESS_STORAGE.mkdir(parents=True, exist_ok=True)
    MESSAGES_DIR.mkdir(parents=True, exist_ok=True)
    if not ACCESS_INDEX_PATH.exists():
        ACCESS_INDEX_PATH.write_text("{}", encoding="utf-8")


def _read_json(path: Path, fallback: Any) -> Any:
    ensure_storage()
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    ensure_storage()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_access_index() -> dict[str, dict[str, Any]]:
    if supabase_enabled():
        return load_access_index_supabase()
    raw = _read_json(ACCESS_INDEX_PATH, {})
    return raw if isinstance(raw, dict) else {}


def save_access_index(index: dict[str, dict[str, Any]]) -> None:
    if supabase_enabled():
        for project_id, record in index.items():
            if isinstance(record, dict):
                save_access_record_supabase(project_id, record)
        return
    _write_json(ACCESS_INDEX_PATH, index)


def message_path(project_id: str) -> Path:
    ensure_storage()
    return MESSAGES_DIR / f"{project_id}.json"


def load_messages(project_id: str) -> list[dict[str, Any]]:
    if supabase_enabled():
        return load_messages_supabase(project_id)
    raw = _read_json(message_path(project_id), [])
    return raw if isinstance(raw, list) else []


def save_messages(project_id: str, messages: list[dict[str, Any]]) -> None:
    if supabase_enabled():
        overwrite_messages_supabase(project_id, messages)
        return
    _write_json(message_path(project_id), messages)


def build_access_record(project_id: str, payload: dict[str, Any], owner_user: dict[str, Any], existing: dict[str, Any] | None = None) -> dict[str, Any]:
    existing = existing or {}
    meta = payload.get("meta", {}) if isinstance(payload.get("meta"), dict) else {}
    intake = meta.get("project_intake", {}) if isinstance(meta.get("project_intake"), dict) else {}
    customer = intake.get("customer", {}) if isinstance(intake.get("customer"), dict) else {}
    matched_customer = resolve_customer_from_contact(customer)
    owner_role = str(owner_user.get("role") or "vendor")
    status_value = "active" if matched_customer else "pending"
    existing_contact = existing.get("customer_contact", {}) if isinstance(existing.get("customer_contact"), dict) else {}
    customer_name = str(customer.get("name") or existing_contact.get("name") or "")
    customer_email = normalize_email(str(customer.get("email") or existing_contact.get("email") or ""))
    customer_phone = normalize_phone(str(customer.get("phone") or existing_contact.get("phone") or ""))
    return {
        "project_id": project_id,
        "owner_user_id": str(owner_user["id"]),
        "vendor_user_id": str(owner_user["id"]) if owner_role == "vendor" else str(existing.get("vendor_user_id") or owner_user["id"]),
        "customer_user_id": str(matched_customer["id"]) if matched_customer else existing.get("customer_user_id"),
        "customer_contact": {
            "name": customer_name,
            "email": customer_email,
            "phone": customer_phone,
        },
        "status": "active" if existing.get("customer_user_id") or matched_customer else status_value,
        "invite_token": existing.get("invite_token") or secrets.token_urlsafe(18),
        "invite_code": str(existing.get("invite_code") or _new_invite_code()).upper(),
        "created_at": existing.get("created_at") or utc_now_iso(),
        "updated_at": utc_now_iso(),
    }


def resolve_customer_from_contact(customer_contact: dict[str, Any]) -> dict[str, Any] | None:
    email = normalize_email(str(customer_contact.get("email") or ""))
    phone = normalize_phone(str(customer_contact.get("phone") or ""))
    return (find_user_by_email(email) if email else None) or (find_user_by_phone(phone) if phone else None)


def get_access_record(project_id: str) -> dict[str, Any] | None:
    if supabase_enabled():
        return load_access_record_supabase(project_id)
    return load_access_index().get(project_id)


def find_access_record_by_invite_code(invite_code: str) -> tuple[str, dict[str, Any]] | None:
    target = invite_code.strip().upper()
    if not target:
        return None
    for project_id, record in load_access_index().items():
        if str(record.get("invite_code") or "").upper() == target:
            return project_id, record
    return None


def is_global_test_customer(user: dict[str, Any]) -> bool:
    return str(user.get("role") or "") == "customer" and normalize_phone(str(user.get("phone") or "")) == TEST_CUSTOMER_ALL_PROJECTS_PHONE


def can_access_project(user: dict[str, Any], record: dict[str, Any] | None) -> bool:
    if is_global_test_customer(user):
        return True
    if not record:
        return False
    user_id = str(user["id"])
    if user_id in {str(record.get("owner_user_id", "")), str(record.get("vendor_user_id", "")), str(record.get("customer_user_id", ""))}:
        return True
    if str(user.get("role")) == "customer":
        contact = record.get("customer_contact", {})
        return normalize_email(str(user.get("email", ""))) == normalize_email(str(contact.get("email", ""))) or normalize_phone(
            str(user.get("phone", ""))
        ) == normalize_phone(str(contact.get("phone", "")))
    return False


def require_project_access(user: dict[str, Any], project_id: str) -> dict[str, Any]:
    record = get_access_record(project_id)
    if not can_access_project(user, record):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return record or {}


def accessible_project_ids_for_user(user: dict[str, Any]) -> set[str]:
    index = load_access_index()
    if is_global_test_customer(user):
        return set(index.keys())
    accessible: set[str] = set()
    for project_id, record in index.items():
        if can_access_project(user, record):
            accessible.add(project_id)
    return accessible
