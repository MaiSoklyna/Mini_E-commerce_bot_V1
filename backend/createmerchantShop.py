"""
Create Doro Shop merchant + merchant admin login.
Usage: cd D:\favourite-of-shop\backend
       python create_doro_shop.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import execute_query, init_db_pool
import bcrypt

init_db_pool()

# 1. Check if Doro Shop merchant exists
merchant = execute_query("SELECT * FROM merchants WHERE merchant_name='Doro Shop'", fetch_one=True)

if not merchant:
    # Create owner user first
    owner_id = execute_query(
        "INSERT INTO users (username, role, is_verified) VALUES ('doro_shop', 'merchant', TRUE)",
        commit=True
    )
    # Create merchant
    mid = execute_query(
        """INSERT INTO merchants (merchant_name, shop_description, contact_phone, status, owner_id)
           VALUES ('Doro Shop', 'The first shop of your favorite snakes', '0716249197', 'active', %s)""",
        (owner_id,), commit=True
    )
    print(f"  ✅ Doro Shop created (merchant_id: {mid})")
else:
    mid = merchant["merchant_id"]
    print(f"  ✅ Doro Shop already exists (merchant_id: {mid})")

# 2. Create merchant admin account
pw_hash = bcrypt.hashpw(b"doro123", bcrypt.gensalt()).decode()

existing = execute_query("SELECT id FROM admin_users WHERE email='doro@shop.com'", fetch_one=True)
if existing:
    execute_query(
        "UPDATE admin_users SET password_hash=%s, merchant_id=%s, role='merchant_admin', is_active=TRUE WHERE email='doro@shop.com'",
        (pw_hash, mid), commit=True
    )
    print(f"  ✅ Doro admin password reset")
else:
    execute_query(
        """INSERT INTO admin_users (email, password_hash, name, role, merchant_id, is_active)
           VALUES ('doro@shop.com', %s, 'Doro Admin', 'merchant_admin', %s, TRUE)""",
        (pw_hash, mid), commit=True
    )
    print(f"  ✅ Doro admin created")

# 3. Show all logins
print("\n🎉 Login credentials:")
print("=" * 50)
print("SUPER ADMIN (sees everything):")
print("  Email:    admin@digitalalchemy.com")
print("  Password: admin123")
print()
print("DORO SHOP MERCHANT (sees only their shop):")
print("  Email:    doro@shop.com")
print("  Password: doro123")
print("=" * 50)
print(f"\nDashboard: http://localhost:5173")