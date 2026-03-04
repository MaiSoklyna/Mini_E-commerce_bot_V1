import mysql.connector
from mysql.connector import pooling, Error
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Connection pool for better performance
db_pool = None

def init_db_pool():
    """Initialize the database connection pool."""
    global db_pool
    try:
        db_pool = pooling.MySQLConnectionPool(
            pool_name="shop_pool",
            pool_size=10,
            pool_reset_session=True,
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            charset="utf8mb4",
            collation="utf8mb4_unicode_ci",
            autocommit=False,
        )
        logger.info("✅ Database connection pool created successfully")
        return True
    except Error as e:
        logger.error(f"❌ Failed to create database pool: {e}")
        return False


def get_db():
    """Get a database connection from the pool. Use as context manager or dependency."""
    global db_pool
    if db_pool is None:
        init_db_pool()
    
    conn = db_pool.get_connection()
    try:
        yield conn
    finally:
        if conn.is_connected():
            conn.close()


def execute_query(query: str, params: tuple = None, fetch_one: bool = False, fetch_all: bool = False, commit: bool = False):
    """
    Execute a database query with automatic connection handling.
    
    Args:
        query: SQL query string
        params: Query parameters (tuple)
        fetch_one: Return single row
        fetch_all: Return all rows
        commit: Commit the transaction (for INSERT/UPDATE/DELETE)
    
    Returns:
        Query result or last inserted ID for INSERT operations
    """
    global db_pool
    if db_pool is None:
        init_db_pool()
    
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params)
        
        if commit:
            conn.commit()
            return cursor.lastrowid
        
        if fetch_one:
            return cursor.fetchone()
        
        if fetch_all:
            return cursor.fetchall()
        
        return None
        
    except Error as e:
        if conn and commit:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def execute_many(query: str, data: list, commit: bool = True):
    """Execute a query with multiple sets of parameters."""
    global db_pool
    if db_pool is None:
        init_db_pool()
    
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.executemany(query, data)
        if commit:
            conn.commit()
        return cursor.rowcount
    except Error as e:
        if conn and commit:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()