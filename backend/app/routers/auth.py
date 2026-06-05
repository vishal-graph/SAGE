from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.models.schemas import AuthResponse, CustomerInviteActivateRequest, InviteCodeSignInRequest, SignInRequest, SignUpRequest
from app.services.auth import (
    create_session,
    create_user,
    find_user_by_identifier,
    find_user_by_phone,
    find_users_by_identifier,
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


class SendOtpRequest(BaseModel):
    phoneNumber: str


class VerifyOtpRequest(BaseModel):
    phoneNumber: str
    otp: str


def _otp_base_url() -> str:
    return (os.environ.get("SIGE_OTP_BASE_URL") or "https://devapi.tatvaops.com/users/api/auth").rstrip("/")


class VendorOtpSignInRequest(BaseModel):
    phoneNumber: str
    otp: str
    email: str | None = None


@router.post("/vendor/otp-sign-in", response_model=AuthResponse)
def vendor_otp_sign_in(body: VendorOtpSignInRequest) -> AuthResponse:
    """
    First-time vendor flow:
    - verifies OTP with upstream provider
    - creates vendor user if missing (password is random, login is via OTP)
    - returns a normal SIGE session token
    """
    url = f"{_otp_base_url()}/verify-otp"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json={"phoneNumber": body.phoneNumber, "otp": body.otp})
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"OTP provider unreachable: {e.__class__.__name__}") from e

    if resp.status_code >= 400:
        detail = resp.text[:2000] if resp.text else "OTP provider error"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

    # Heuristic: treat explicit { ok/verified/success: false } as invalid.
    try:
        payload = resp.json()
        if isinstance(payload, dict):
            if payload.get("ok") is False or payload.get("verified") is False or payload.get("success") is False:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")
    except HTTPException:
        raise
    except Exception:
        payload = None

    phone = normalize_phone(body.phoneNumber)
    user = find_user_by_phone(phone, "vendor")
    if not user:
        email = normalize_email(body.email or "") or f"{phone.lstrip('+')}@vendor.local"
        user = create_user(
            email=email,
            phone=phone,
            password=os.urandom(16).hex(),
            name="Vendor",
            role="vendor",
        )
    else:
        # Allow capturing email during OTP onboarding if provided.
        if body.email and body.email.strip():
            user["email"] = normalize_email(body.email)
            save_user(user)

    token = create_session(str(user["id"]))
    return AuthResponse(token=token, user=to_user_summary(user))


@router.post("/otp/send")
def send_otp(body: SendOtpRequest):
    """
    Proxy OTP send through the upstream provider API.
    Frontend should call this endpoint (no CORS/provider coupling).
    """
    url = f"{_otp_base_url()}/send-otp"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json={"phoneNumber": body.phoneNumber})
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"OTP provider unreachable: {e.__class__.__name__}") from e

    if resp.status_code >= 400:
        detail = resp.text[:2000] if resp.text else "OTP provider error"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
    try:
        return resp.json()
    except Exception:
        return {"ok": True, "raw": resp.text}


@router.post("/otp/verify")
def verify_otp(body: VerifyOtpRequest):
    """Proxy OTP verify through the upstream provider API."""
    url = f"{_otp_base_url()}/verify-otp"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json={"phoneNumber": body.phoneNumber, "otp": body.otp})
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"OTP provider unreachable: {e.__class__.__name__}") from e

    if resp.status_code >= 400:
        detail = resp.text[:2000] if resp.text else "OTP provider error"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
    try:
        return resp.json()
    except Exception:
        return {"ok": True, "raw": resp.text}


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
    user = find_user_by_identifier(body.identifier, body.role)
    if not user and body.role is None:
        matches = find_users_by_identifier(body.identifier)
        if len(matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Multiple accounts found. Please choose user type and sign in again",
            )

    # Dev-only vendor bypass password:
    # Enable by setting SIGE_VENDOR_BYPASS_PASSWORD in the backend environment.
    bypass_pw = (os.environ.get("SIGE_VENDOR_BYPASS_PASSWORD") or "").strip()
    bypass_ok = bool(bypass_pw) and body.role == "vendor" and body.password == bypass_pw

    if not user or (not bypass_ok and not verify_password(body.password, str(user.get("password_hash", "")))):
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

    user = find_user_by_identifier(body.identifier, "customer")
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

    user = find_user_by_identifier(body.identifier, "customer")
    if user:
        user["password_hash"] = hash_password(body.password)
        if body.name.strip():
            user["name"] = body.name.strip()
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
