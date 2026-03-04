"""
MiniShopBot v2 — Full Database Migration
Drops the old v1 schema and rebuilds with the new 18-table design.

WARNING: This permanently deletes all existing data.
         Back up your database before running.

Usage:
    cd D:/favourite-of-shop/backend
    python migrate_db.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import execute_query, init_db_pool

# Old v1 tables to drop (in reverse FK order to avoid constraint errors)
OLD_TABLES = [
    "telegram_configs",
    "promotions",
    "support_tickets",
    "invoices",
    "payments",
    "order_items",
    "orders",
    "reviews",
    "shopping_cart",
    "product_images",
    "products",
    "product_categories",
    "merchants",
    "profiles",
    "admin_users",
    "users",
    # v1 migration tables (if migrate_db was run before)
    "product_variant_groups",
    "product_variant_options",
]

# New v2 tables (also drop if partially created, before full rebuild)
NEW_TABLES_TO_CLEAN = [
    "telegram_sessions",
    "notifications",
    "promo_usages",
    "promo_codes",
    "reviews",
    "order_items",
    "orders",
    "cart_items",
    "cart",
    "product_images",
    "product_variant_options",
    "product_variants",
    "products",
    "categories",
    "merchant_admins",
    "super_admins",
    "merchants",
    "users",
]


def confirm():
    print("⚠️  WARNING: This will DROP ALL TABLES and rebuild from scratch.")
    print("   All existing data will be permanently deleted.")
    answer = input("\n   Type 'yes' to continue: ").strip().lower()
    return answer == "yes"


def disable_fk_checks():
    execute_query("SET FOREIGN_KEY_CHECKS = 0", commit=True)


def enable_fk_checks():
    execute_query("SET FOREIGN_KEY_CHECKS = 1", commit=True)


def drop_tables(table_list: list):
    for table in table_list:
        try:
            execute_query(f"DROP TABLE IF EXISTS `{table}`", commit=True)
            print(f"    🗑️   {table} dropped")
        except Exception as e:
            print(f"    ⚠️   {table}: {e}")


def run():
    print("🔄  MiniShopBot — v1 → v2 Migration\n")
    init_db_pool()

    if not confirm():
        print("\n❌  Migration cancelled.")
        return

    print("\n🗑️   Dropping old v1 tables...")
    disable_fk_checks()
    drop_tables(OLD_TABLES)

    print("\n🗑️   Dropping any partial v2 tables...")
    drop_tables(NEW_TABLES_TO_CLEAN)

    enable_fk_checks()

    print("\n🔧  Rebuilding with v2 schema (running setup_db.py)...")
    print("-" * 50)

    # Delegate to setup_db which has the full CREATE TABLE logic
    import setup_db
    setup_db.run()

    print("\n✅  Migration complete — database is now on v2 schema.")


if __name__ == "__main__":
    run()
