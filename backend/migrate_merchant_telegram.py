"""
Migration: Add telegram_id column to merchant_admins table.
Run: cd D:/favourite-of-shop/backend && python migrate_merchant_telegram.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import execute_query, init_db_pool

def migrate():
    init_db_pool()

    # Add telegram_id column
    try:
        execute_query(
            "ALTER TABLE merchant_admins ADD COLUMN telegram_id BIGINT NULL AFTER email",
            commit=True,
        )
        print("Added telegram_id column to merchant_admins")
    except Exception as e:
        if "Duplicate column" in str(e):
            print("telegram_id column already exists — skipping")
        else:
            raise

    # Add unique index
    try:
        execute_query(
            "ALTER TABLE merchant_admins ADD UNIQUE INDEX idx_merchant_admin_tg (telegram_id)",
            commit=True,
        )
        print("Added unique index on telegram_id")
    except Exception as e:
        if "Duplicate key name" in str(e):
            print("Index already exists — skipping")
        else:
            raise

    print("Migration complete!")

if __name__ == "__main__":
    migrate()
