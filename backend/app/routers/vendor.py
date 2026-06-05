from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.models.schemas import VendorProfile
from app.services.auth import normalize_email, normalize_phone, require_user, save_user, utc_now_iso

router = APIRouter(prefix="/vendor", tags=["vendor"])

VENDOR_STORAGE = Path(__file__).resolve().parent.parent.parent / "storage" / "vendor"
VENDOR_PROFILES_PATH = VENDOR_STORAGE / "vendor_profiles.json"
VENDOR_UPLOADS_DIR = VENDOR_STORAGE / "uploads"


def _ensure_vendor_storage() -> None:
    VENDOR_STORAGE.mkdir(parents=True, exist_ok=True)
    VENDOR_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    if not VENDOR_PROFILES_PATH.exists():
        VENDOR_PROFILES_PATH.write_text("{}", encoding="utf-8")


def _read_profiles() -> Dict[str, Dict[str, Any]]:
    _ensure_vendor_storage()
    try:
        raw = json.loads(VENDOR_PROFILES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raw = {}
    return raw if isinstance(raw, dict) else {}


def _write_profiles(payload: Dict[str, Dict[str, Any]]) -> None:
    _ensure_vendor_storage()
    VENDOR_PROFILES_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_filename(name: str) -> str:
    cleaned = _SAFE_NAME_RE.sub("_", (name or "").strip())
    return cleaned or "file"


async def _save_upload(user_id: str, folder: str, file: UploadFile) -> str:
    _ensure_vendor_storage()
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing upload filename")
    vendor_dir = VENDOR_UPLOADS_DIR / user_id / folder
    vendor_dir.mkdir(parents=True, exist_ok=True)
    filename = _safe_filename(file.filename)
    path = vendor_dir / filename
    content = await file.read()
    path.write_bytes(content)
    # API serves these as static files via /vendor/uploads/... through a download endpoint below.
    return str(path.relative_to(VENDOR_STORAGE)).replace("\\", "/")


def _require_vendor(user: Dict[str, Any]) -> Dict[str, Any]:
    if str(user.get("role") or "") != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vendor account required")
    return user


@router.get("/profile", response_model=Optional[VendorProfile])
def get_vendor_profile(user=Depends(require_user)):
    user = _require_vendor(user)
    profiles = _read_profiles()
    data = profiles.get(str(user["id"]))
    return VendorProfile(**data) if isinstance(data, dict) else None


@router.post("/profile", response_model=VendorProfile)
async def upsert_vendor_profile(
    profile_json: str = Form(...),
    gst_certificate: UploadFile | None = File(default=None),
    pan_card: UploadFile | None = File(default=None),
    cancelled_cheque: UploadFile | None = File(default=None),
    portfolio: List[UploadFile] | None = File(default=None),
    user=Depends(require_user),
):
    user = _require_vendor(user)
    try:
        incoming = json.loads(profile_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile_json") from e
    if not isinstance(incoming, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile_json payload")

    user_id = str(user["id"])
    now = utc_now_iso()
    profiles = _read_profiles()
    existing = profiles.get(user_id) if isinstance(profiles.get(user_id), dict) else None

    phone = normalize_phone(str(incoming.get("phone") or user.get("phone") or ""))
    email = normalize_email(str(incoming.get("email") or user.get("email") or ""))
    if not phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone is required")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")

    # Keep auth user record in sync with onboarding email/phone.
    user_update = dict(user)
    user_update["phone"] = phone
    user_update["email"] = email
    if str(user_update.get("name") or "").strip() in ("", "Vendor"):
        company = str(incoming.get("company_name") or "").strip()
        if company:
            user_update["name"] = company
    save_user(user_update)

    docs: Dict[str, Optional[str]] = {}
    if existing and isinstance(existing.get("documents"), dict):
        docs.update({k: (str(v) if v else None) for k, v in existing.get("documents", {}).items()})

    if gst_certificate is not None:
        docs["gst_certificate"] = await _save_upload(user_id, "documents", gst_certificate)
    if pan_card is not None:
        docs["pan_card"] = await _save_upload(user_id, "documents", pan_card)
    if cancelled_cheque is not None:
        docs["cancelled_cheque"] = await _save_upload(user_id, "documents", cancelled_cheque)

    # Portfolio uploads: frontend sends multiple files with names like "{service}__original.jpg"
    portfolio_urls_by_service: Dict[str, List[str]] = {}
    if portfolio:
        for f in portfolio:
            service = "unknown"
            original = f.filename or "image"
            if "__" in original:
                prefix, rest = original.split("__", 1)
                if prefix.strip():
                    service = prefix.strip()
                    f.filename = rest
            url = await _save_upload(user_id, f"portfolio/{service}", f)
            portfolio_urls_by_service.setdefault(service, []).append(url)

    services = incoming.get("services")
    if not isinstance(services, list) or not any(str(x).strip() for x in services):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pick at least one service")
    services_clean = [str(x).strip() for x in services if str(x).strip()]

    # Build portfolio array combining existing + new uploads
    portfolio_out: List[Dict[str, Any]] = []
    existing_portfolio = existing.get("portfolio") if isinstance(existing, dict) else None
    if isinstance(existing_portfolio, list):
        for item in existing_portfolio:
            if isinstance(item, dict) and str(item.get("service") or "").strip():
                portfolio_out.append(
                    {
                        "service": str(item.get("service")),
                        "image_urls": list(item.get("image_urls") or []),
                    }
                )

    for service, urls in portfolio_urls_by_service.items():
        matched = next((p for p in portfolio_out if p.get("service") == service), None)
        if matched:
            matched["image_urls"] = list(matched.get("image_urls") or []) + urls
        else:
            portfolio_out.append({"service": service, "image_urls": urls})

    # Final profile
    profile_payload = {
        "user_id": user_id,
        "phone": phone,
        "email": email,
        "gst_number": str(incoming.get("gst_number") or "").strip(),
        "additional_gst_numbers": [str(x).strip() for x in (incoming.get("additional_gst_numbers") or []) if str(x).strip()],
        "company_name": str(incoming.get("company_name") or "").strip(),
        "company_type": str(incoming.get("company_type") or "").strip(),
        "designation": str(incoming.get("designation") or "").strip(),
        "alternative_contact_no": str(incoming.get("alternative_contact_no") or "").strip(),
        "bank_name": str(incoming.get("bank_name") or "").strip(),
        "account_number": str(incoming.get("account_number") or "").strip(),
        "ifsc_code": str(incoming.get("ifsc_code") or "").strip(),
        "min_project_budget_inr": int(incoming.get("min_project_budget_inr") or 0),
        "services": services_clean,
        "portfolio": portfolio_out,
        "documents": docs,
        "created_at": str(existing.get("created_at") if existing else now),
        "updated_at": now,
    }

    # Basic required validations (keep UI honest)
    required_keys = [
        "gst_number",
        "company_name",
        "company_type",
        "designation",
        "alternative_contact_no",
        "bank_name",
        "account_number",
        "ifsc_code",
    ]
    missing = [k for k in required_keys if not str(profile_payload.get(k) or "").strip()]
    if missing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing fields: {', '.join(missing)}")

    profiles[user_id] = profile_payload
    _write_profiles(profiles)
    return VendorProfile(**profile_payload)


@router.get("/uploads/{path:path}")
def download_vendor_upload(path: str, user=Depends(require_user)):
    """
    Simple file download for vendor uploads.
    Only the owning vendor can access their uploads.
    """
    user = _require_vendor(user)
    rel = (path or "").lstrip("/").replace("..", "")
    abs_path = (VENDOR_STORAGE / rel).resolve()
    # Ensure it stays inside storage/vendor
    if VENDOR_STORAGE not in abs_path.parents and abs_path != VENDOR_STORAGE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")
    if not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    # Enforce ownership: uploads are stored under uploads/<user_id>/...
    parts = abs_path.relative_to(VENDOR_STORAGE).parts
    if len(parts) < 2 or parts[0] != "uploads" or parts[1] != str(user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    from fastapi.responses import FileResponse

    return FileResponse(str(abs_path))

