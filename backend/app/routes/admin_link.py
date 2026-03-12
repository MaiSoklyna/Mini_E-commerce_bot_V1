from fastapi import APIRouter, HTTPException
from app.config import settings
from jose import jwt, JWTError
import httpx
import os

router = APIRouter(tags=["admin-link"])

@router.post("/admin/link-merchant")
async def admin_link_merchant(
    access_token: str,         # the JWT we minted for the user from /api/auth/telegram
    merchant_id: int,
    app_role: str | None = None  # optional: "merchant" or "super_admin"
):
    """
    Server-admin operation: link a profile (by JWT `sub`) to a merchant_id, optionally set app_role.
    Uses Supabase service-role to update the profiles row directly.
    """
    try:
        claims = jwt.get_unverified_claims(access_token)
        sub = claims.get("sub")
        if not sub:
            raise ValueError("JWT missing sub")
    except JWTError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JWT: {e}")

    supabase_url = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    srk = settings.SUPABASE_SERVICE_ROLE_KEY
    if not srk:
        raise HTTPException(status_code=500, detail="Missing service role key on server")

    payload = {"merchant_id": merchant_id}
    if app_role in ("merchant", "super_admin"):
        payload["app_role"] = app_role

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            f"{supabase_url}/rest/v1/profiles?id=eq.{sub}",
            headers={
                "apikey": srk,
                "Authorization": f"Bearer {srk}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            json=payload
        )
        if r.status_code >= 300:
            try:
                detail = r.json()
            except Exception:
                detail = {"status": r.status_code, "body": await r.aread()}
            raise HTTPException(status_code=500, detail=f"Profiles update failed: {detail}")

        return r.json()