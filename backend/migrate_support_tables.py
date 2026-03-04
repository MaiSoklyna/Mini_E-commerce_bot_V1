"""
Migration: Create support_tickets + ticket_messages tables
Run: cd D:/favourite-of-shop/backend && python migrate_support_tables.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import execute_query, init_db_pool

TABLES = [
    ("support_tickets",
     "CREATE TABLE IF NOT EXISTS support_tickets ("
     "  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  user_id       INT UNSIGNED    NOT NULL,"
     "  merchant_id   INT UNSIGNED    NOT NULL,"
     "  order_id      INT UNSIGNED    NULL,"
     "  subject       VARCHAR(200)    NOT NULL,"
     "  status        ENUM('open','replied','closed') DEFAULT 'open',"
     "  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,"
     "  FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    ("ticket_messages",
     "CREATE TABLE IF NOT EXISTS ticket_messages ("
     "  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  ticket_id     INT UNSIGNED    NOT NULL,"
     "  sender_type   ENUM('customer','merchant') NOT NULL,"
     "  sender_id     INT UNSIGNED    NOT NULL,"
     "  body          TEXT            NOT NULL,"
     "  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),
]

INDEXES = [
    ("idx_tickets_merchant", "support_tickets(merchant_id, status, created_at)"),
    ("idx_tickets_user",     "support_tickets(user_id, created_at)"),
    ("idx_ticket_messages",  "ticket_messages(ticket_id, created_at)"),
]


def run():
    print("🔧  Support Tables Migration\n")
    init_db_pool()

    print("📋  Creating tables...")
    for name, ddl in TABLES:
        try:
            execute_query(ddl, commit=True)
            print(f"    ✅  {name}")
        except Exception as e:
            print(f"    ⚠️   {name}: {e}")

    print("\n🔍  Creating indexes...")
    for idx_name, idx_cols in INDEXES:
        try:
            execute_query(f"CREATE INDEX {idx_name} ON {idx_cols}", commit=True)
            print(f"    ✅  {idx_name}")
        except Exception as e:
            if "Duplicate key name" in str(e):
                print(f"    ⏭   {idx_name} already exists")
            else:
                print(f"    ⚠️   {idx_name}: {e}")

    print("\n🎉  Migration complete!")


if __name__ == "__main__":
    run()
