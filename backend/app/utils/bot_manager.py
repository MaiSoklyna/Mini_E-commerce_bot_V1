"""
Bot Manager - Singleton for accessing Telegram bot instance
"""

import logging
from telegram import Bot
from app.config import settings

logger = logging.getLogger(__name__)

# Global bot instance
_bot_instance = None


def get_bot() -> Bot:
    """
    Get or create the global bot instance.

    Returns:
        Bot: Telegram bot instance
    """
    global _bot_instance

    if _bot_instance is None:
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.error("TELEGRAM_BOT_TOKEN not configured")
            raise ValueError("TELEGRAM_BOT_TOKEN is required")

        _bot_instance = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        logger.info("Telegram bot instance created")

    return _bot_instance


async def send_telegram_message(chat_id: int, text: str, **kwargs):
    """
    Send a message via Telegram bot.

    Args:
        chat_id: Telegram chat ID
        text: Message text
        **kwargs: Additional arguments for bot.send_message

    Returns:
        Message object or None if failed
    """
    try:
        bot = get_bot()
        message = await bot.send_message(chat_id=chat_id, text=text, **kwargs)
        return message
    except Exception as e:
        logger.error(f"Failed to send Telegram message to {chat_id}: {str(e)}")
        return None
