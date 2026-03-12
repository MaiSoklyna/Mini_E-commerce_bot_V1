"""Complete admin authentication & management endpoints for the dashboard.

Handles: login, telegram sessions, profile management, password changes,
and admin-only operations that require service_role access to Supabase.
"""

import logging
import secrets
import time
from datetime import datetime, timezone
from typing import Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from app.config import settings
from app.services.rest import RestClient
from app.utils.security import verify_password, hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin Auth"])

JWT_EXPIRY_SECONDS = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


# ── JWT helpers ──────────────────────────────────────────────────

def _mint_admin_jwt(payload: dict) -> str:
    """Mint a Supabase-compatible JWT signed with SUPABASE_JWT_SECRET."""
    now = int(time.time())
    app_role = payload.pop("app_role", "merchant")
    claims = {
        **payload,
        "role": "authenticated",
        "aud": "authenticated",
        "iss": "supabase",
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
        "app_role": app_role,
    }
    return pyjwt.encode(claims, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


def _decode_admin_jwt(token: str) -> dict:
    """Verify and decode an admin JWT."""
    try:
        return pyjwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"],
                            audience="authenticated")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_claims(authorization: str = Header(...)) -> dict:
    """Extract JWT claims from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    return _decode_admin_jwt(authorization[7:])


# ── Request / Response models ────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: str
    password: str
    role: str = "merchant"


class UpdateProfileRequest(BaseModel):
    name: str
    email: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CreateMerchantAdminRequest(BaseModel):
    email: str
    password: str
    full_name: str
    merchant_id: int
    role: str = "admin"


# ── POST /api/admin/login ────────────────────────────────────────

@router.post("/login")
async def admin_login(body: AdminLoginRequest):
    """Authenticate admin via email/password. Returns Supabase-compatible JWT."""
    client = RestClient(service_role=True)

    if body.role == "super_admin":
        rows = await client.get(
            "super_admins?email=eq." + body.email.strip()
            + "&select=id,full_name,email,password_hash,is_active&limit=1"
        )
        if not rows:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        admin = rows[0]
        if not admin.get("is_active"):
            raise HTTPException(status_code=401, detail="Account is inactive")
        if not verify_password(body.password, admin["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Update last_login
        await client.update(
            f"super_admins?id=eq.{admin['id']}",
            {"last_login": datetime.now(timezone.utc).isoformat()},
        )

        token = _mint_admin_jwt({
            "sub": str(admin["id"]),
            "app_role": "super_admin",
            "email": admin["email"],
        })

        return {
            "success": True,
            "data": {
                "access_token": token,
                "expires_in": JWT_EXPIRY_SECONDS,
                "user": {
                    "id": admin["id"],
                    "email": admin["email"],
                    "name": admin["full_name"],
                    "role": "super_admin",
                },
            },
        }

    # Merchant admin login
    rows = await client.get(
        "merchant_admins?email=eq." + body.email.strip()
        + "&select=id,merchant_id,full_name,email,password_hash,role,is_active&limit=1"
    )
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    admin = rows[0]
    if not admin.get("is_active"):
        raise HTTPException(status_code=401, detail="Account is inactive")
    if not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Get merchant info
    merchant_name = None
    if admin.get("merchant_id"):
        merchants = await client.get(
            f"merchants?id=eq.{admin['merchant_id']}&select=name,status&limit=1"
        )
        if merchants:
            if merchants[0].get("status") == "suspended":
                raise HTTPException(status_code=403, detail="MERCHANT_SUSPENDED")
            merchant_name = merchants[0].get("name")

    # Update last_login
    await client.update(
        f"merchant_admins?id=eq.{admin['id']}",
        {"last_login": datetime.now(timezone.utc).isoformat()},
    )

    token = _mint_admin_jwt({
        "sub": str(admin["id"]),
        "app_role": "merchant",
        "merchant_id": admin["merchant_id"],
        "email": admin["email"],
    })

    return {
        "success": True,
        "data": {
            "access_token": token,
            "expires_in": JWT_EXPIRY_SECONDS,
            "user": {
                "id": admin["id"],
                "email": admin["email"],
                "name": admin["full_name"],
                "role": "merchant",
                "merchant_id": admin["merchant_id"],
                "merchant_name": merchant_name,
            },
        },
    }


# ── POST /api/admin/tg-session ──────────────────────────────────

@router.post("/tg-session")
async def create_tg_session():
    """Create a Telegram login session for dashboard auth."""
    session_id = "dash_" + secrets.token_urlsafe(32)
    client = RestClient(service_role=True)
    await client.insert("login_sessions", {"session_id": session_id})
    return {"session_id": session_id}


# ── GET /api/admin/poll-session ──────────────────────────────────

SESSION_TTL_SECONDS = 5 * 60

@router.get("/poll-session")
async def poll_tg_session(session_id: str):
    """Poll a Telegram login session status."""
    client = RestClient(service_role=True)

    rows = await client.get(
        f"login_sessions?session_id=eq.{session_id}"
        "&select=session_id,jwt_token,user_id,status,created_at&limit=1"
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found")

    row = rows[0]

    # Check expiry
    created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    if (now - created).total_seconds() > SESSION_TTL_SECONDS:
        await client.update(
            f"login_sessions?session_id=eq.{session_id}",
            {"status": "expired"},
        )
        return {"status": "expired"}

    if row["status"] == "completed" and row.get("jwt_token"):
        # Fetch admin info (try merchant_admins first, then super_admins)
        user_data = None
        if row.get("user_id"):
            admins = await client.get(
                f"merchant_admins?id=eq.{row['user_id']}"
                "&select=id,merchant_id,full_name,email,role&limit=1"
            )
            if admins:
                admin = admins[0]
                merchant_name = None
                if admin.get("merchant_id"):
                    merchants = await client.get(
                        f"merchants?id=eq.{admin['merchant_id']}&select=name&limit=1"
                    )
                    if merchants:
                        merchant_name = merchants[0].get("name")
                user_data = {
                    "id": admin["id"],
                    "email": admin["email"],
                    "name": admin["full_name"],
                    "role": "merchant",
                    "merchant_id": admin["merchant_id"],
                    "merchant_name": merchant_name,
                }
            else:
                # Try super_admins
                sa = await client.get(
                    f"super_admins?id=eq.{row['user_id']}"
                    "&select=id,full_name,email&limit=1"
                )
                if sa:
                    user_data = {
                        "id": sa[0]["id"],
                        "email": sa[0]["email"],
                        "name": sa[0]["full_name"],
                        "role": "super_admin",
                    }

        # Clean up session
        await client.delete(f"login_sessions?session_id=eq.{session_id}")

        return {
            "status": "completed",
            "token": row["jwt_token"],
            "user": user_data,
        }

    return {"status": "pending"}


# ── GET /api/admin/me ────────────────────────────────────────────

@router.get("/me")
async def get_current_admin(claims: dict = Depends(_get_claims)):
    """Get current admin profile from JWT."""
    client = RestClient(service_role=True)
    app_role = claims.get("app_role", "")
    admin_id = claims.get("sub")

    if app_role == "super_admin":
        rows = await client.get(
            f"super_admins?id=eq.{admin_id}&select=id,full_name,email,is_active&limit=1"
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Admin not found")
        admin = rows[0]
        return {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["full_name"],
            "role": "super_admin",
        }

    rows = await client.get(
        f"merchant_admins?id=eq.{admin_id}"
        "&select=id,merchant_id,full_name,email,role,is_active&limit=1"
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Admin not found")
    admin = rows[0]

    merchant_name = None
    if admin.get("merchant_id"):
        merchants = await client.get(
            f"merchants?id=eq.{admin['merchant_id']}&select=name&limit=1"
        )
        if merchants:
            merchant_name = merchants[0].get("name")

    return {
        "id": admin["id"],
        "email": admin["email"],
        "name": admin["full_name"],
        "role": "merchant",
        "merchant_id": admin["merchant_id"],
        "merchant_name": merchant_name,
    }


# ── POST /api/admin/update-profile ──────────────────────────────

@router.post("/update-profile")
async def update_profile(body: UpdateProfileRequest, claims: dict = Depends(_get_claims)):
    """Update admin name and email."""
    client = RestClient(service_role=True)
    app_role = claims.get("app_role", "")
    admin_id = claims.get("sub")

    table = "super_admins" if app_role == "super_admin" else "merchant_admins"
    await client.update(
        f"{table}?id=eq.{admin_id}",
        {"full_name": body.name, "email": body.email},
    )
    return {"success": True}


# ── POST /api/admin/change-password ──────────────────────────────

@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, claims: dict = Depends(_get_claims)):
    """Change admin password (requires current password)."""
    client = RestClient(service_role=True)
    app_role = claims.get("app_role", "")
    admin_id = claims.get("sub")

    table = "super_admins" if app_role == "super_admin" else "merchant_admins"
    rows = await client.get(f"{table}?id=eq.{admin_id}&select=password_hash&limit=1")

    if not rows:
        raise HTTPException(status_code=404, detail="Admin not found")

    if not verify_password(body.current_password, rows[0]["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = hash_password(body.new_password)
    await client.update(f"{table}?id=eq.{admin_id}", {"password_hash": new_hash})
    return {"success": True}


# ── POST /api/admin/create-merchant-admin (super_admin only) ─────

@router.post("/create-merchant-admin")
async def create_merchant_admin(body: CreateMerchantAdminRequest, claims: dict = Depends(_get_claims)):
    """Create a merchant admin account (super_admin only)."""
    if claims.get("app_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")

    client = RestClient(service_role=True)

    # Check merchant exists
    merchants = await client.get(f"merchants?id=eq.{body.merchant_id}&select=id&limit=1")
    if not merchants:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # Check email unique
    existing = await client.get(f"merchant_admins?email=eq.{body.email.strip()}&select=id&limit=1")
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")

    result = await client.insert("merchant_admins", {
        "email": body.email.strip(),
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "merchant_id": body.merchant_id,
        "role": body.role,
    })

    return {"success": True, "data": result}


# ── GET /api/admin/merchant-admins (super_admin only) ────────────

@router.get("/merchant-admins")
async def list_merchant_admins(merchant_id: Optional[int] = None, claims: dict = Depends(_get_claims)):
    """List merchant admin accounts (super_admin only)."""
    if claims.get("app_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")

    client = RestClient(service_role=True)
    query = "merchant_admins?select=id,merchant_id,full_name,email,role,is_active,last_login,created_at"
    if merchant_id:
        query += f"&merchant_id=eq.{merchant_id}"
    query += "&order=created_at.desc"

    rows = await client.get(query)
    return rows or []


# ── DELETE /api/admin/merchant-admins/{admin_id} (super_admin) ───

@router.delete("/merchant-admins/{admin_id}")
async def delete_merchant_admin(admin_id: int, claims: dict = Depends(_get_claims)):
    """Delete a merchant admin account (super_admin only)."""
    if claims.get("app_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")

    client = RestClient(service_role=True)
    await client.delete(f"merchant_admins?id=eq.{admin_id}")
    return {"success": True}


# ── POST /api/admin/refresh-token ────────────────────────────────

@router.post("/refresh-token")
async def refresh_token(claims: dict = Depends(_get_claims)):
    """Refresh the admin JWT (returns new token with extended expiry)."""
    app_role = claims.get("app_role", "merchant")
    new_payload = {
        "sub": claims.get("sub"),
        "app_role": app_role,
        "email": claims.get("email", ""),
    }
    if claims.get("merchant_id"):
        new_payload["merchant_id"] = claims["merchant_id"]

    token = _mint_admin_jwt(new_payload)
    return {"access_token": token, "expires_in": JWT_EXPIRY_SECONDS}
