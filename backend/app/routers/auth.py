from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.models.schemas import AuthResponse, CustomerInviteActivateRequest, InviteCodeSignInRequest, SignInRequest, SignUpRequest
from app.services.auth import (
    create_session,
    create_user,
    find_user_by_identifier,
    hash_password,
    get_token_from_header,
    normalize_email,
    normalize_phone,
    require_user,
    revoke_session,
    save_user,
    to_user_summary,
    utc_now_iso,
    verify_password,
)
from app.services.project_access import find_access_record_by_invite_code, load_access_index, save_access_index

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email/phone or password")
    token = create_session(str(user["id"]))
    return AuthResponse(token=token, user=to_user_summary(user))


@router.post("/sign-in/invite-code", response_model=AuthResponse)
def sign_in_with_invite_code(body: InviteCodeSignInRequest) -> AuthResponse:
    invite_match = find_access_record_by_invite_code(body.invite_code)
    if not invite_match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")

    project_id, access_record = invite_match
    identifier_email = normalize_email(body.identifier)
    identifier_phone = normalize_phone(body.identifier)
    contact = access_record.get("customer_contact", {}) if isinstance(access_record.get("customer_contact"), dict) else {}
    contact_email = normalize_email(str(contact.get("email") or ""))
    contact_phone = normalize_phone(str(contact.get("phone") or ""))
    if (contact_email or contact_phone) and identifier_email != contact_email and identifier_phone != contact_phone:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite code does not match the customer contact for this project",
        )

    user = find_user_by_identifier(body.identifier)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No account found for this contact. Use customer first-time access to create password",
        )

    index = load_access_index()
    fresh_record = index.get(project_id, access_record)
    if not fresh_record.get("customer_user_id"):
        fresh_record["customer_user_id"] = str(user["id"])
        fresh_record["status"] = "active"
        fresh_record["updated_at"] = utc_now_iso()
        index[project_id] = fresh_record
        save_access_index(index)

    token = create_session(str(user["id"]))
    return AuthResponse(token=token, user=to_user_summary(user))


@router.post("/customer/activate-invite", response_model=AuthResponse)
def activate_customer_invite(body: CustomerInviteActivateRequest) -> AuthResponse:
    invite_match = find_access_record_by_invite_code(body.invite_code)
    if not invite_match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")

    project_id, access_record = invite_match
    identifier_email = normalize_email(body.identifier)
    identifier_phone = normalize_phone(body.identifier)
    contact = access_record.get("customer_contact", {}) if isinstance(access_record.get("customer_contact"), dict) else {}
    contact_email = normalize_email(str(contact.get("email") or ""))
    contact_phone = normalize_phone(str(contact.get("phone") or ""))
    if (contact_email or contact_phone) and identifier_email != contact_email and identifier_phone != contact_phone:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite code does not match the customer contact for this project",
        )

    user = find_user_by_identifier(body.identifier)
    if user:
        user["password_hash"] = hash_password(body.password)
        if body.name.strip():
            user["name"] = body.name.strip()
        if str(user.get("role") or "") != "customer":
            user["role"] = "customer"
        save_user(user)
    else:
        email = identifier_email or f"{identifier_phone.lstrip('+')}@customer.local"
        phone = identifier_phone
        user = create_user(
            email=email,
            phone=phone,
            password=body.password,
            name=body.name.strip(),
            role="customer",
        )

    index = load_access_index()
    fresh_record = index.get(project_id, access_record)
    fresh_record["customer_user_id"] = str(user["id"])
    fresh_record["status"] = "active"
    fresh_record["updated_at"] = utc_now_iso()
    index[project_id] = fresh_record
    save_access_index(index)

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
