"""
Run BOTH FastAPI API Server + Telegram Bot in ONE process
This prevents 409 Conflict errors from multiple bot instances
"""
import asyncio
import uvicorn
import logging
from app.main import app
from app.database import init_db_pool
from bot.bot import create_bot_app

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def main():
    """Run FastAPI + Telegram Bot concurrently in same process"""
    logger.info("🚀 Starting Favourite of Shop - API + Bot Combined")

    # Initialize database pool
    init_db_pool()

    # Create bot application
    bot_app = create_bot_app()
    logger.info("✅ Bot application created")

    # Configure FastAPI server
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
    server = uvicorn.Server(config)

    # Start bot polling and API server concurrently
    async with bot_app:
        await bot_app.initialize()
        await bot_app.start()
        logger.info("✅ Bot started - polling for updates")

        # Start polling in background
        await bot_app.updater.start_polling(
            drop_pending_updates=True  # Prevents stale 409 conflicts
        )

        logger.info("✅ FastAPI server starting on http://0.0.0.0:8000")

        # Run FastAPI server (this blocks until shutdown)
        try:
            await server.serve()
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down...")
        finally:
            # Cleanup on exit
            await bot_app.updater.stop()
            await bot_app.stop()
            await bot_app.shutdown()
            logger.info("✅ Shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())