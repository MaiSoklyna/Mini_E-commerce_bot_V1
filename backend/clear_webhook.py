import asyncio
from telegram import Bot
from app.config import settings

async def clear_webhook():
    bot = Bot(settings.TELEGRAM_BOT_TOKEN)
    result = await bot.delete_webhook(drop_pending_updates=True)
    print('Webhook cleared:', result)

if __name__ == "__main__":
    asyncio.run(clear_webhook())
