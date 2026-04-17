from __future__ import annotations

from fastapi import HTTPException, WebSocket, status

from app.services.auth import find_user_by_id, load_sessions


def authenticate_websocket(websocket: WebSocket) -> dict:
    token = websocket.query_params.get("token", "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    session = load_sessions().get(token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again")
    user = find_user_by_id(str(session.get("user_id", "")))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    return user
