"""Secure Telegram Login Widget authentication with HMAC verification.

Mints a Supabase-compatible JWT (signed with SUPABASE_JWT_SECRET) and
upserts the user profile via PostgREST.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Optional
from uuid import NAMESPACE_URL, uuid5

import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.rest import RestClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Telegram Auth"])

AUTH_DATE_MAX_AGE = 3600  # 1 hour
JWT_EXPIRY_SECONDS = 900  # 15 minutes


# ── Pydantic models ─────────────────────────────────────────────


class TelegramWidgetPayload(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class TelegramWidgetUser(BaseModel):
    id: str  # UUID string
    telegram_id: int
    name: str
    avatar_url: Optional[str] = None


class TelegramWidgetResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: TelegramWidgetUser


# ── Helpers ──────────────────────────────────────────────────────


def _verify_telegram_hash(payload: TelegramWidgetPayload) -> bool:
    """Verify HMAC-SHA256 per Telegram Login Widget spec."""
    secret = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()

    # Build data-check-string: sorted key=value pairs, excluding 'hash' and None values
    data = payload.model_dump(exclude={"hash"})
    parts = sorted(
        f"{k}={v}" for k, v in data.items() if v is not None
    )
    data_check_string = "\n".join(parts)

    computed = hmac.new(
        secret, data_check_string.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, payload.hash)


def _derive_uuid(telegram_id: int) -> str:
    """Deterministic UUID v5 from a Telegram user ID."""
    return str(uuid5(NAMESPACE_URL, f"telegram:{telegram_id}"))


def _mint_supabase_jwt(user_uuid: str, telegram_id: int, name: str) -> str:
    """Create a Supabase-compatible HS256 JWT."""
    now = int(time.time())
    iss = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/") + "/auth/v1"
    claims = {
        "sub": user_uuid,
        "role": "authenticated",
        "aud": "authenticated",
        "iss": iss,
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
        "telegram_id": telegram_id,
        "name": name,
    }
    return jwt.encode(claims, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


async def _upsert_profile(
    user_uuid: str,
    telegram_id: int,
    name: str,
    avatar_url: str | None,
) -> None:
    """Best-effort upsert into Supabase profiles table. Never fails login."""
    try:
        client = RestClient(service_role=True)
        body = {
            "id": user_uuid,
            "telegram_id": telegram_id,
            "name": name,
        }
        if avatar_url:
            body["avatar_url"] = avatar_url
        await client.insert("profiles", body, upsert=True)
    except Exception:
        logger.exception("Profile upsert failed (non-fatal)")


# ── Endpoint ─────────────────────────────────────────────────────


@router.post("/telegram", response_model=TelegramWidgetResponse)
async def telegram_widget_auth(payload: TelegramWidgetPayload):
    """Authenticate via Telegram Login Widget with HMAC verification."""

    # 1. Verify HMAC signature
    if not _verify_telegram_hash(payload):
        raise HTTPException(status_code=401, detail="Invalid Telegram hash")

    # 2. Check auth_date freshness
    if time.time() - payload.auth_date > AUTH_DATE_MAX_AGE:
        raise HTTPException(status_code=401, detail="Auth data is stale")

    # 3. Derive deterministic UUID
    user_uuid = _derive_uuid(payload.id)

    # 4. Build display name
    name = payload.first_name
    if payload.last_name:
        name += f" {payload.last_name}"

    # 5. Mint Supabase JWT
    access_token = _mint_supabase_jwt(user_uuid, payload.id, name)

    # 6. Upsert profile (best-effort)
    await _upsert_profile(user_uuid, payload.id, name, payload.photo_url)

    # 7. Return response
    return TelegramWidgetResponse(
        access_token=access_token,
        expires_in=JWT_EXPIRY_SECONDS,
        user=TelegramWidgetUser(
            id=user_uuid,
            telegram_id=payload.id,
            name=name,
            avatar_url=payload.photo_url,
        ),
    )
