from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import init_db_pool
from app.routes import auth, products, categories, cart, orders, merchants, admin
import logging

# Configure logging
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("🚀 Starting Favourite of Shop API...")
    success = init_db_pool()
    if success:
        logger.info("✅ Database connected successfully")
    else:
        logger.error("❌ Database connection failed! Check your .env settings")
    yield
    # Shutdown
    logger.info("👋 Shutting down API...")


app = FastAPI(
    title="Favourite of Shop API",
    description="Multi-Tenant Telegram E-Commerce Bot Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routes
app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(cart.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(merchants.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


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
    """Health check endpoint."""
    from app.database import execute_query
    try:
        result = execute_query("SELECT 1 as ok", fetch_one=True)
        db_status = "connected" if result else "disconnected"
    except Exception:
        db_status = "disconnected"
    
    return {
        "status": "healthy",
        "database": db_status,
        "environment": settings.ENVIRONMENT,
    }
