"""
Add receipt_sent_at column to orders table
"""

from app.database import init_db_pool, execute_query


def add_receipt_sent_column():
    """Add receipt_sent_at timestamp column to orders table"""
    print("Adding receipt_sent_at column to orders table...")

    if not init_db_pool():
        print("Failed to initialize database pool")
        return False

    try:
        # Check if column already exists
        check_sql = """
            SELECT COUNT(*) as count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders'
            AND COLUMN_NAME = 'receipt_sent_at'
        """

        result = execute_query(check_sql, fetch_one=True)

        if result and result['count'] > 0:
            print("Column 'receipt_sent_at' already exists")
            return True

        # Add the column
        alter_sql = """
            ALTER TABLE orders
            ADD COLUMN receipt_sent_at TIMESTAMP NULL DEFAULT NULL
            COMMENT 'Timestamp when delivery receipt was sent to customer'
        """

        execute_query(alter_sql, commit=True)
        print("Successfully added 'receipt_sent_at' column to orders table")

        # Add index for faster queries
        index_sql = """
            CREATE INDEX idx_orders_receipt_sent
            ON orders(receipt_sent_at)
        """

        try:
            execute_query(index_sql, commit=True)
            print("Added index on receipt_sent_at column")
        except Exception as e:
            if "Duplicate key name" in str(e):
                print("Index already exists")
            else:
                print(f"Warning: Could not create index: {str(e)}")

        return True

    except Exception as e:
        print(f"Error: {str(e)}")
        return False


if __name__ == "__main__":
    success = add_receipt_sent_column()
    if success:
        print("\nMigration completed successfully!")
    else:
        print("\nMigration failed!")
