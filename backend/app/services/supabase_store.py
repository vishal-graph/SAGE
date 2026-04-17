from __future__ import annotations

from typing import Any

from app.services.auth import utc_now_iso
from app.services.supabase_client import create_supabase, get_supabase_env

PROJECTS_TABLE = "projects"
PROJECT_SUMMARIES_TABLE = "project_summaries"
PROJECT_ACCESS_TABLE = "project_access"
PROJECT_MESSAGES_TABLE = "project_messages"
PROJECT_STAGES_TABLE = "project_stages"


def supabase_enabled() -> bool:
    url, key = get_supabase_env()
    return bool(url and key)


def save_project_payload(project_id: str, payload: dict[str, Any], owner_user_id: str) -> None:
    now = utc_now_iso()
    create_supabase().table(PROJECTS_TABLE).upsert(
        {
            "project_id": project_id,
            "owner_user_id": owner_user_id,
            "payload": payload,
            "updated_at": now,
            "created_at": now,
        },
        on_conflict="project_id",
    ).execute()


def load_project_payload(project_id: str) -> dict[str, Any] | None:
    result = (
        create_supabase()
        .table(PROJECTS_TABLE)
        .select("payload")
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    payload = rows[0].get("payload")
    return payload if isinstance(payload, dict) else None


def save_project_summary(project_id: str, summary: dict[str, Any], owner_user_id: str) -> None:
    create_supabase().table(PROJECT_SUMMARIES_TABLE).upsert(
        {
            "project_id": project_id,
            "owner_user_id": owner_user_id,
            "summary": summary,
            "updated_at": utc_now_iso(),
        },
        on_conflict="project_id",
    ).execute()


def load_all_project_summaries() -> list[dict[str, Any]]:
    result = create_supabase().table(PROJECT_SUMMARIES_TABLE).select("project_id,summary").execute()
    rows = result.data or []
    out: list[dict[str, Any]] = []
    for row in rows:
        summary = row.get("summary")
        if isinstance(summary, dict):
            merged = dict(summary)
            merged.setdefault("project_id", row.get("project_id"))
            out.append(merged)
    return out


def save_access_record(project_id: str, record: dict[str, Any]) -> None:
    create_supabase().table(PROJECT_ACCESS_TABLE).upsert(
        {"project_id": project_id, "record": record, "updated_at": utc_now_iso()},
        on_conflict="project_id",
    ).execute()


def load_access_index() -> dict[str, dict[str, Any]]:
    result = create_supabase().table(PROJECT_ACCESS_TABLE).select("project_id,record").execute()
    rows = result.data or []
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        project_id = str(row.get("project_id") or "")
        record = row.get("record")
        if project_id and isinstance(record, dict):
            index[project_id] = record
    return index


def load_access_record(project_id: str) -> dict[str, Any] | None:
    result = (
        create_supabase()
        .table(PROJECT_ACCESS_TABLE)
        .select("record")
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    record = rows[0].get("record")
    return record if isinstance(record, dict) else None


def append_message(project_id: str, message: dict[str, Any]) -> None:
    create_supabase().table(PROJECT_MESSAGES_TABLE).insert(
        {
            "id": message.get("id"),
            "project_id": project_id,
            "message": message,
            "created_at": message.get("created_at") or utc_now_iso(),
        }
    ).execute()


def load_messages(project_id: str) -> list[dict[str, Any]]:
    result = (
        create_supabase()
        .table(PROJECT_MESSAGES_TABLE)
        .select("message")
        .eq("project_id", project_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = result.data or []
    out: list[dict[str, Any]] = []
    for row in rows:
        message = row.get("message")
        if isinstance(message, dict):
            out.append(message)
    return out


def overwrite_messages(project_id: str, messages: list[dict[str, Any]]) -> None:
    create_supabase().table(PROJECT_MESSAGES_TABLE).delete().eq("project_id", project_id).execute()
    if not messages:
        return
    create_supabase().table(PROJECT_MESSAGES_TABLE).insert(
        [
            {
                "id": message.get("id"),
                "project_id": project_id,
                "message": message,
                "created_at": message.get("created_at") or utc_now_iso(),
            }
            for message in messages
        ]
    ).execute()


def save_stage_snapshot(project_id: str, payload: dict[str, Any], saved_by_user_id: str) -> None:
    create_supabase().table(PROJECT_STAGES_TABLE).insert(
        {
            "project_id": project_id,
            "saved_by_user_id": saved_by_user_id,
            "payload": payload,
            "created_at": utc_now_iso(),
        }
    ).execute()
