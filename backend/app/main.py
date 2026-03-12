from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.config import settings
from app.routes import telegram_auth, admin_link, admin_auth, db_proxy, miniapp_api
import logging, os


logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)

_DEFAULT_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:3001",
]

ALLOWED_ORIGINS = settings.CORS_ORIGINS if settings.CORS_ORIGINS else _DEFAULT_DEV_ORIGINS

# Ensure upload directories exist
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "images"), exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Favourite of Shop API...")
    yield
    logger.info("Shutting down API...")


app = FastAPI(
    title="Favourite of Shop API",
    description="Multi-Tenant Telegram E-Commerce Bot Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Catch ALL unhandled errors and still return CORS headers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    detail = str(exc) if settings.DEBUG else "Internal server error"
    return JSONResponse(
        status_code=500,
        content={"detail": detail},
        headers=headers,
    )


# Register Routes (only Supabase-backed routes remain)
app.include_router(telegram_auth.router, prefix="/api")
app.include_router(admin_link.router, prefix="/api")
app.include_router(admin_auth.router, prefix="/api")

# Miniapp API (replaces Supabase Edge Functions)
app.include_router(miniapp_api.router)

# PostgREST + Storage proxy (must be BEFORE static files mount)
app.include_router(db_proxy.router)

# Serve uploaded images at /uploads/images/filename.jpg
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
async def root():
    return {
        "name": "Favourite of Shop API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "supabase",
        "environment": settings.ENVIRONMENT,
    }
