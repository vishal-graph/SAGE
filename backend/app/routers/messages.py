from __future__ import annotations

import re
import uuid
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from fastapi.websockets import WebSocketState
from pydantic import BaseModel, Field

from app.models.schemas import ChatAttachment, ChatMessage, ChatMessageListResponse, LinkPreview, LinkPreviewResponse
from app.services.redis_client import cache_get_json, cache_set_json
from app.services.auth import require_user, require_user_from_token, utc_now_iso
from app.services.project_access import ACCESS_STORAGE, load_messages, require_project_access, save_messages
from app.services.supabase_store import append_message as append_message_supabase, supabase_enabled
from app.services.ws_auth import authenticate_websocket

router = APIRouter(prefix="/project", tags=["messages"])
UPLOADS_DIR = ACCESS_STORAGE / "uploads"
URL_RE = re.compile(r"https?://[^\s<>'\"]+")


class MessageCreateRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)


ChatMessage.model_rebuild()


class MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.title = ""
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self.in_title = True
        if tag.lower() != "meta":
            return
        key = (attrs_dict.get("property") or attrs_dict.get("name") or "").lower()
        content = attrs_dict.get("content", "").strip()
        if key and content and key not in self.meta:
            self.meta[key] = content

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[project_id].add(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket) -> None:
        self.connections[project_id].discard(websocket)
        if not self.connections[project_id]:
            self.connections.pop(project_id, None)

    async def broadcast(self, project_id: str, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for socket in list(self.connections.get(project_id, set())):
            try:
                if socket.client_state == WebSocketState.CONNECTED:
                    await socket.send_json(payload)
                else:
                    stale.append(socket)
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(project_id, socket)


manager = ConnectionManager()


def serialize_message(project_id: str, user: dict[str, Any], body: str, attachment: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "sender_user_id": str(user["id"]),
        "sender_name": str(user.get("name") or "Unknown"),
        "sender_role": str(user.get("role") or "customer"),
        "body": body.strip(),
        "created_at": utc_now_iso(),
        "attachment": attachment,
    }


def sanitize_filename(name: str) -> str:
    cleaned = "".join(ch for ch in name if ch.isalnum() or ch in "._- ").strip().replace(" ", "_")
    return cleaned or "upload.bin"


def attachment_dir(project_id: str) -> Path:
    path = UPLOADS_DIR / project_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def extract_first_url(text: str) -> str | None:
    match = URL_RE.search(text)
    return match.group(0) if match else None


def fetch_link_preview(url: str) -> LinkPreview:
    cache_key = f"link-preview:{url}"
    cached = cache_get_json(cache_key)
    if isinstance(cached, dict):
        try:
            return LinkPreview(**cached)
        except Exception:
            pass
    try:
        request = Request(
            url,
            headers={
                "User-Agent": "SIGE-LinkPreview/1.0",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urlopen(request, timeout=8) as response:
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type.lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Link preview only supports HTML pages")
            raw = response.read(200_000).decode("utf-8", errors="ignore")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unable to fetch link preview: {exc}") from exc

    parser = MetadataParser()
    parser.feed(raw)
    title = (parser.meta.get("og:title") or parser.title or url).strip()
    description = (parser.meta.get("og:description") or parser.meta.get("description") or "").strip() or None
    image_url = (parser.meta.get("og:image") or "").strip() or None
    site_name = (parser.meta.get("og:site_name") or "").strip() or None

    if image_url:
        image_url = urljoin(url, image_url)

    preview = LinkPreview(
        url=url,
        title=title[:200],
        description=description[:300] if description else None,
        image_url=image_url,
        site_name=site_name[:120] if site_name else None,
    )
    cache_set_json(cache_key, preview.model_dump(), ttl_seconds=3600)
    return preview


async def broadcast_then_save(project_id: str, message: dict[str, Any]) -> None:
    await manager.broadcast(project_id, {"type": "message", "message": message})
    try:
        if supabase_enabled():
            append_message_supabase(project_id, message)
        else:
            messages = load_messages(project_id)
            messages.append(message)
            save_messages(project_id, messages)
    except Exception as exc:
        await manager.broadcast(
            project_id,
            {
                "type": "message_persist_failed",
                "message_id": message["id"],
                "detail": f"Message delivery was live, but save failed: {exc}",
            },
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Message broadcasted but could not be saved")


@router.get("/{project_id}/messages", response_model=ChatMessageListResponse)
def list_messages(project_id: str, user=Depends(require_user)) -> ChatMessageListResponse:
    require_project_access(user, project_id)
    messages = [ChatMessage(**message) for message in load_messages(project_id)]
    return ChatMessageListResponse(messages=messages)


@router.post("/{project_id}/messages", response_model=ChatMessage)
async def create_message(project_id: str, body: MessageCreateRequest, user=Depends(require_user)) -> ChatMessage:
    require_project_access(user, project_id)
    message = serialize_message(project_id, user, body.body)
    await broadcast_then_save(project_id, message)
    return ChatMessage(**message)


@router.post("/{project_id}/attachments", response_model=ChatMessage)
async def upload_attachment(project_id: str, file: UploadFile = File(...), user=Depends(require_user)) -> ChatMessage:
    require_project_access(user, project_id)
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file selected")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 15MB limit")

    safe_name = sanitize_filename(file.filename)
    stored_name = f"{uuid.uuid4()}_{safe_name}"
    stored_path = attachment_dir(project_id) / stored_name
    stored_path.write_bytes(content)

    attachment = {
        "name": safe_name,
        "content_type": file.content_type or "application/octet-stream",
        "size_bytes": len(content),
        "url": f"/api/project/uploads/{project_id}/{stored_name}",
    }
    message = serialize_message(project_id, user, f"Shared a file: {safe_name}", attachment=attachment)
    await broadcast_then_save(project_id, message)
    return ChatMessage(**message)


@router.get("/{project_id}/link-preview", response_model=LinkPreviewResponse)
def get_link_preview(project_id: str, url: str = Query(..., min_length=8, max_length=2000), user=Depends(require_user)) -> LinkPreviewResponse:
    require_project_access(user, project_id)
    if not URL_RE.fullmatch(url.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid URL")
    return LinkPreviewResponse(preview=fetch_link_preview(url.strip()))


@router.get("/uploads/{project_id}/{filename}")
def get_uploaded_file(
    project_id: str,
    filename: str,
    token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
):
    user = require_user_from_token(token) if token else require_user(authorization)
    require_project_access(user, project_id)
    path = attachment_dir(project_id) / filename
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path, filename=path.name.split("_", 1)[1] if "_" in path.name else path.name)


@router.websocket("/ws/projects/{project_id}")
async def project_ws(websocket: WebSocket, project_id: str):
    user = authenticate_websocket(websocket)
    require_project_access(user, project_id)
    await manager.connect(project_id, websocket)
    try:
        await websocket.send_json({"type": "ready", "project_id": project_id})
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)
    except Exception:
        manager.disconnect(project_id, websocket)
