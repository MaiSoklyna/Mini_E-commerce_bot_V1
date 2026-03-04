import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends
from app.models.user import TelegramAuth, UserResponse, TokenResponse, UserUpdate
from app.database import execute_query
from app.utils.security import create_access_token, get_current_user
from app.config import settings

SESSION_TTL_MINUTES = 5

router = APIRouter(prefix="/auth", tags=["Authentication"])

_USER_COLS = (
    "id, telegram_id, username, first_name, last_name, "
    "phone, email, language, address, is_active, created_at"
)


def _make_token(user_id: int) -> str:
    return create_access_token({"sub": str(user_id), "role": "customer"})


@router.post("/telegram", response_model=TokenResponse)
async def telegram_auth(auth_data: TelegramAuth):
    """Register or login via Telegram (used by bot and miniapp WebApp)."""
    user = execute_query(
        f"SELECT {_USER_COLS} FROM users WHERE telegram_id = %s",
        (auth_data.telegram_id,), fetch_one=True
    )

    if not user:
        new_id = execute_query(
            "INSERT INTO users (telegram_id, username, first_name, last_name, language) "
            "VALUES (%s, %s, %s, %s, %s)",
            (
                auth_data.telegram_id,
                auth_data.username or f"user_{auth_data.telegram_id}",
                auth_data.first_name or "",
                auth_data.last_name or "",
                auth_data.language or "en",
            ),
            commit=True,
        )
        user = execute_query(
            f"SELECT {_USER_COLS} FROM users WHERE id = %s",
            (new_id,), fetch_one=True
        )

    token = _make_token(user["id"])
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(**user).model_dump(),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(**current_user)


@router.put("/me")
async def update_me(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update profile fields (phone, email, address, language)."""
    fields = data.model_dump(exclude_none=True)
    if not fields:
        return {"message": "Nothing to update"}

    sets = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [current_user["id"]]
    execute_query(f"UPDATE users SET {sets} WHERE id = %s", tuple(values), commit=True)
    return {"message": "Profile updated"}


# ── Login Sessions (magic-link via Telegram bot) ────────────────


@router.post("/sessions")
async def create_login_session():
    """Create a pending login session. Browser calls this, then deep-links to bot."""
    session_id = secrets.token_urlsafe(32)
    execute_query(
        "INSERT INTO login_sessions (session_id) VALUES (%s)",
        (session_id,), commit=True,
    )
    return {"session_id": session_id}


@router.get("/sessions/{session_id}")
async def poll_login_session(session_id: str):
    """Poll a login session. Returns token+user when bot completes it."""
    row = execute_query(
        "SELECT session_id, jwt_token, user_id, status, created_at "
        "FROM login_sessions WHERE session_id = %s",
        (session_id,), fetch_one=True,
    )
    if not row:
        raise HTTPException(404, "Session not found")

    # Check expiry (5 minutes)
    created = row["created_at"]
    if isinstance(created, str):
        created = datetime.fromisoformat(created)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > timedelta(minutes=SESSION_TTL_MINUTES):
        execute_query(
            "UPDATE login_sessions SET status='expired' WHERE session_id=%s",
            (session_id,), commit=True,
        )
        return {"status": "expired"}

    if row["status"] == "completed" and row["jwt_token"]:
        user = execute_query(
            f"SELECT {_USER_COLS} FROM users WHERE id = %s",
            (row["user_id"],), fetch_one=True,
        )
        # Clean up used session
        execute_query(
            "DELETE FROM login_sessions WHERE session_id=%s",
            (session_id,), commit=True,
        )
        return {
            "status": "completed",
            "token": row["jwt_token"],
            "user": UserResponse(**user).model_dump() if user else None,
        }

    return {"status": "pending"}
