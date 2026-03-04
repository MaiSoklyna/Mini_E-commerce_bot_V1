import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Telegram
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "")

    # Database
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "telegrambot")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback-secret-key")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # App
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    MAX_CART_ITEMS: int = int(os.getenv("MAX_CART_ITEMS", "50"))
    CURRENCY: str = os.getenv("CURRENCY", "USD")

    # API
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    # Frontend
    WEB_APP_URL: str = os.getenv("WEB_APP_URL", "http://localhost:3000")
    ADMIN_PANEL_URL: str = os.getenv("ADMIN_PANEL_URL", "http://localhost:3001")

    # Admin
    ADMIN_USER_IDS: list = [int(x) for x in os.getenv("ADMIN_USER_IDS", "").split(",") if x]

    # CORS
    CORS_ORIGINS: list = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x]

    # Support
    SUPPORT_GROUP_ID: int = int(os.getenv("SUPPORT_GROUP_ID", "0"))


settings = Settings()