"""PostgREST proxy — lets the dashboard query Supabase through FastAPI.

The dashboard's Supabase JS client sends requests here instead of directly
to Supabase. FastAPI verifies the admin JWT locally, then forwards the
request to Supabase PostgREST using the service_role key (bypasses RLS).

This solves the JWT secret mismatch issue: admin tokens are signed with
SECRET_KEY (local), not SUPABASE_JWT_SECRET.
"""

import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

SUPABASE_REST_URL = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/") + "/rest/v1"
SRK = settings.SUPABASE_SERVICE_ROLE_KEY
ANON_KEY = settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY


def _verify_admin(request: Request) -> dict | None:
    """Verify admin JWT from Authorization header. Returns claims or None."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None

    token = auth[7:]
    # Skip verification for the anon/publishable key itself
    if token == ANON_KEY:
        return None

    # Verify as admin JWT (signed with SECRET_KEY)
    import jwt as pyjwt
    try:
        claims = pyjwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"],
                              audience="authenticated")
        return claims
    except Exception:
        pass

    # Also try SECRET_KEY for backwards compatibility
    try:
        claims = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return claims
    except Exception:
        return None


@router.api_route("/rest/v1/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD"])
async def postgrest_proxy(path: str, request: Request):
    """Proxy PostgREST requests to Supabase with service_role key.

    If the request has a valid admin JWT, it's forwarded with service_role access.
    Otherwise, it's forwarded with the anon key (public access only).
    """
    claims = _verify_admin(request)

    # Build target URL with query params
    qs = str(request.url.query)
    target = f"{SUPABASE_REST_URL}/{path}"
    if qs:
        target += f"?{qs}"

    # Build clean headers from scratch — whitelist only what PostgREST needs.
    # Never forward browser headers (user-agent, origin, referer, sec-*, etc.)
    # to avoid Supabase detecting "secret API key used from browser".
    forward_headers = {
        "accept": request.headers.get("accept", "application/json"),
        "accept-encoding": "identity",
    }

    # Forward content-type for methods with body
    ct = request.headers.get("content-type")
    if ct:
        forward_headers["content-type"] = ct

    # Forward PostgREST-specific headers
    for h in ("prefer", "range", "accept-profile", "content-profile"):
        val = request.headers.get(h)
        if val:
            forward_headers[h] = val

    if claims:
        # Authenticated user — use service_role for full access
        forward_headers["apikey"] = SRK
        forward_headers["authorization"] = f"Bearer {SRK}"
    else:
        # Anon user — use publishable key
        forward_headers["apikey"] = ANON_KEY
        forward_headers["authorization"] = f"Bearer {ANON_KEY}"

    # Read body
    body = await request.body()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(
            method=request.method,
            url=target,
            headers=forward_headers,
            content=body if body else None,
        )

    # Forward response headers (skip hop-by-hop and encoding headers)
    resp_headers = {}
    for key, value in resp.headers.items():
        key_lower = key.lower()
        if key_lower in ("transfer-encoding", "connection", "keep-alive", "content-encoding", "content-length"):
            continue
        resp_headers[key] = value

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
    )


@router.api_route("/storage/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "HEAD"])
async def storage_proxy(path: str, request: Request):
    """Proxy Supabase Storage requests."""
    claims = _verify_admin(request)

    storage_url = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/") + "/storage/v1"
    qs = str(request.url.query)
    target = f"{storage_url}/{path}"
    if qs:
        target += f"?{qs}"

    # Build clean headers — whitelist only what Storage API needs
    forward_headers = {
        "accept": request.headers.get("accept", "*/*"),
        "accept-encoding": "identity",
    }

    ct = request.headers.get("content-type")
    if ct:
        forward_headers["content-type"] = ct

    # Forward cache/range headers for file downloads
    for h in ("range", "cache-control", "x-upsert"):
        val = request.headers.get(h)
        if val:
            forward_headers[h] = val

    if claims:
        forward_headers["apikey"] = SRK
        forward_headers["authorization"] = f"Bearer {SRK}"
    else:
        forward_headers["apikey"] = ANON_KEY
        forward_headers["authorization"] = f"Bearer {ANON_KEY}"

    body = await request.body()

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.request(
            method=request.method,
            url=target,
            headers=forward_headers,
            content=body if body else None,
        )

    resp_headers = {}
    for key, value in resp.headers.items():
        if key.lower() in ("transfer-encoding", "connection", "keep-alive", "content-encoding", "content-length"):
            continue
        resp_headers[key] = value

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
    )
