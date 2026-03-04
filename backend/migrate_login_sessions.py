"""
Create login_sessions table for magic-link Telegram login.
Run: cd D:/favourite-of-shop/backend && python migrate_login_sessions.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import execute_query, init_db_pool

TABLE_SQL = (
    "CREATE TABLE IF NOT EXISTS login_sessions ("
    "  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,"
    "  session_id VARCHAR(64)  UNIQUE NOT NULL,"
    "  jwt_token  TEXT         NULL,"
    "  user_id    INT UNSIGNED NULL,"
    "  status     ENUM('pending','completed','expired') DEFAULT 'pending',"
    "  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,"
    "  INDEX idx_login_session_id (session_id)"
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
)

if __name__ == "__main__":
    init_db_pool()
    print("Creating login_sessions table...")
    try:
        execute_query(TABLE_SQL, commit=True)
        print("  login_sessions created")
    except Exception as e:
        print(f"  Error: {e}")
    print("Done!")
