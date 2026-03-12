import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Telegram
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")  # MUST be set in .env
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # App
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    MAX_CART_ITEMS: int = int(os.getenv("MAX_CART_ITEMS", "50"))
    CURRENCY: str = os.getenv("CURRENCY", "USD")

    # API (PORT env var is auto-set by Railway/Render/Fly.io)
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))

    # Frontend
    WEB_APP_URL: str = os.getenv("WEB_APP_URL", "http://localhost:3000")
    ADMIN_PANEL_URL: str = os.getenv("ADMIN_PANEL_URL", "http://localhost:3001")

    # Admin
    ADMIN_USER_IDS: list = [int(x) for x in os.getenv("ADMIN_USER_IDS", "").split(",") if x]

    # CORS
    CORS_ORIGINS: list = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x]

    # Support
    SUPPORT_GROUP_ID: int = int(os.getenv("SUPPORT_GROUP_ID", "0"))

    # Supabase
    NEXT_PUBLIC_SUPABASE_URL: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: str = os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")


settings = Settings()

if not settings.SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not set. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )
