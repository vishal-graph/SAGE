from __future__ import annotations

from fastapi import APIRouter, Depends, Header, status
from pydantic import BaseModel

from app.models.schemas import AuthResponse, SignInRequest, SignUpRequest
from app.services.auth import (
    create_session,
    create_user,
    find_user_by_identifier,
    get_token_from_header,
    require_user,
    revoke_session,
    to_user_summary,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class OkResponse(BaseModel):
    ok: bool


@router.post("/sign-up", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def sign_up(body: SignUpRequest) -> AuthResponse:
    user = create_user(
        email=body.email,
        phone=body.phone,
        password=body.password,
        name=body.name,
        role=body.role,
    )
    token = create_session(str(user["id"]))
    return AuthResponse(token=token, user=to_user_summary(user))


@router.post("/sign-in", response_model=AuthResponse)
def sign_in(body: SignInRequest) -> AuthResponse:
    user = find_user_by_identifier(body.identifier)
    if not user or not verify_password(body.password, str(user.get("password_hash", ""))):
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email/phone or password")
    token = create_session(str(user["id"]))
    return AuthResponse(token=token, user=to_user_summary(user))


@router.get("/me")
def me(user=Depends(require_user)):
    return {"user": to_user_summary(user)}


@router.post("/sign-out", response_model=OkResponse)
def sign_out(authorization: str | None = Header(default=None)) -> OkResponse:
    token = get_token_from_header(authorization)
    revoke_session(token)
    return OkResponse(ok=True)
