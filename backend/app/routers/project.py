import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models.schemas import (
    DashboardSummaryResponse,
    ProjectOverviewResponse,
    ProjectSaveRequest,
    ProjectSaveResponse,
    ProjectSummary,
)
from app.services.auth import require_user, utc_now_iso
from app.services.project_access import (
    accessible_project_ids_for_user,
    build_access_record,
    get_access_record,
    require_project_access,
    save_access_index,
    load_access_index,
)
from app.services.supabase_store import (
    load_all_project_summaries,
    load_project_payload as load_project_payload_supabase,
    save_project_payload,
    save_project_summary,
    save_stage_snapshot,
    supabase_enabled,
)

router = APIRouter(prefix="/project", tags=["project"])

STORAGE = Path(__file__).resolve().parent.parent.parent / "storage" / "projects"
INDEX_PATH = STORAGE / "index.json"
STORAGE.mkdir(parents=True, exist_ok=True)
if not INDEX_PATH.exists():
    INDEX_PATH.write_text("{}", encoding="utf-8")


class NewProjectResponse(BaseModel):
    project_id: str


def sanitize_project_id(project_id: str) -> str:
    return "".join(c for c in project_id if c.isalnum() or c in "-_")


def load_index() -> dict:
    try:
        data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def save_index(payload: dict) -> None:
    INDEX_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_project_summary(project_id: str, payload: dict, existing: dict | None = None, access_record: dict | None = None) -> dict:
    meta = payload.get("meta", {}) if isinstance(payload.get("meta"), dict) else {}
    intake = meta.get("project_intake", {}) if isinstance(meta.get("project_intake"), dict) else {}
    customer = intake.get("customer", {}) if isinstance(intake.get("customer"), dict) else {}
    location = intake.get("location", {}) if isinstance(intake.get("location"), dict) else {}
    geometry = payload.get("geometry", {}) if isinstance(payload.get("geometry"), dict) else {}
    furniture = payload.get("furniture", [])
    image = payload.get("image", {}) if isinstance(payload.get("image"), dict) else {}
    created_at = existing.get("created_at") if existing else None
    return {
        "project_id": project_id,
        "name": str(meta.get("name") or image.get("filename") or "Untitled project"),
        "created_at": created_at or str(meta.get("created_at") or utc_now_iso()),
        "updated_at": utc_now_iso(),
        "image_filename": image.get("filename"),
        "room_count": len(geometry.get("rooms", [])) if isinstance(geometry.get("rooms"), list) else 0,
        "furniture_count": len(furniture) if isinstance(furniture, list) else 0,
        "customer_name": customer.get("name"),
        "customer_location": location.get("label") or location.get("query"),
        "project_type": intake.get("project_type"),
        "budget_range": intake.get("budget_range"),
        "access_status": access_record.get("status") if access_record else None,
        "customer_user_id": access_record.get("customer_user_id") if access_record else None,
        "vendor_user_id": access_record.get("vendor_user_id") if access_record else None,
    }


@router.post("/new", response_model=NewProjectResponse)
def new_project(user=Depends(require_user)) -> NewProjectResponse:
    return NewProjectResponse(project_id=str(uuid.uuid4()))


@router.post("/save", response_model=ProjectSaveResponse)
def save_project(body: ProjectSaveRequest, user=Depends(require_user)) -> ProjectSaveResponse:
    safe_id = sanitize_project_id(body.project_id)
    if not safe_id:
        raise HTTPException(status_code=400, detail="Invalid project_id")
    user_id = str(user["id"])
    index = load_index()
    user_projects = index.get(user_id, {})
    existing = user_projects.get(safe_id, {})
    if supabase_enabled():
        save_project_payload(safe_id, body.payload, user_id)
        save_stage_snapshot(safe_id, body.payload, user_id)
    else:
        path = STORAGE / f"{safe_id}.json"
        path.write_text(json.dumps(body.payload, indent=2), encoding="utf-8")
    access_index = load_access_index()
    access_record = build_access_record(safe_id, body.payload, user, access_index.get(safe_id))
    access_index[safe_id] = access_record
    save_access_index(access_index)
    summary = build_project_summary(safe_id, body.payload, existing, access_record)
    if supabase_enabled():
        save_project_summary(safe_id, summary, user_id)
    else:
        user_projects[safe_id] = summary
        index[user_id] = user_projects
        save_index(index)
    return ProjectSaveResponse(ok=True, project_id=safe_id)


@router.get("/load/{project_id}")
def load_project(project_id: str, user=Depends(require_user)) -> dict:
    safe_id = sanitize_project_id(project_id)
    require_project_access(user, safe_id)
    if supabase_enabled():
        payload = load_project_payload_supabase(safe_id)
        if payload is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return payload
    path = STORAGE / f"{safe_id}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Project not found")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/dashboard", response_model=DashboardSummaryResponse)
def dashboard_summary(user=Depends(require_user)) -> DashboardSummaryResponse:
    accessible_ids = accessible_project_ids_for_user(user)
    raw_projects: list[dict] = []
    if supabase_enabled():
        for project in load_all_project_summaries():
            project_id = str(project.get("project_id") or "")
            if project_id and project_id in accessible_ids:
                access_record = get_access_record(project_id) or {}
                merged = {**project, "project_id": project_id}
                if access_record:
                    merged.setdefault("access_status", access_record.get("status"))
                    merged.setdefault("customer_user_id", access_record.get("customer_user_id"))
                    merged.setdefault("vendor_user_id", access_record.get("vendor_user_id"))
                raw_projects.append(merged)
    else:
        index = load_index()
        for owner_projects in index.values():
            if not isinstance(owner_projects, dict):
                continue
            for project_id, project in owner_projects.items():
                if project_id in accessible_ids:
                    access_record = get_access_record(project_id) or {}
                    merged = {**project, "project_id": project_id}
                    if access_record:
                        merged.setdefault("access_status", access_record.get("status"))
                        merged.setdefault("customer_user_id", access_record.get("customer_user_id"))
                        merged.setdefault("vendor_user_id", access_record.get("vendor_user_id"))
                    raw_projects.append(merged)
    projects = [
        ProjectSummary(**value)
        for value in sorted(raw_projects, key=lambda item: item.get("updated_at", ""), reverse=True)
    ]
    return DashboardSummaryResponse(
        total_projects=len(projects),
        total_rooms=sum(project.room_count for project in projects),
        total_furniture=sum(project.furniture_count for project in projects),
        recent_projects=projects[:6],
    )


@router.get("/{project_id}/overview", response_model=ProjectOverviewResponse)
def project_overview(project_id: str, user=Depends(require_user)) -> ProjectOverviewResponse:
    payload = load_project(project_id, user)
    access_record = require_project_access(user, sanitize_project_id(project_id))
    summary = ProjectSummary(**build_project_summary(sanitize_project_id(project_id), payload, access_record=access_record))
    return ProjectOverviewResponse(summary=summary, payload=payload)
