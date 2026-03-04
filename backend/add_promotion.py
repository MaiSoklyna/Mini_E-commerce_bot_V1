from genericpath import exists
import sys,os 
sys.path.insert(0,os.path.dirname(__file__))
from app.database import execute_query,init_db_pool

def run():
    init_db_pool()
    
    promotions=[
        {
            "merchant_id":1,
            "title":"Valentine's Day Sale💕",
            "description":"Celebrate love with 20% OFF everything! Use codes at checkout for a sweet discount.",
            "discount_type":"percentage",
            "discount_value":20.0,
            "min_order_amount":10.0,
            "code":"LOVE2026",
            "usage_limit":100,
            "start_date":"2026-02-10 00:00:00",
            "end_date":"2026-02-26 23:59:59",
            "is_active":True,
        },
        {
            "merchant_id":1,
            "title":"Spring Fling Sale🌸",
            "description":"Bloom into savings with 15% OFF on all items! Use code SPRING2026 at checkout.",
            "discount_type":"percentage",
            "discount_value":15.0,
            "min_order_amount":20.0,
            "code":"SPRING2026",
            "usage_limit":50,
            "start_date":"2026-03-01 00:00:00",
            "end_date":"2026-03-15 23:59:59",
            "is_active":True,
            
        },
           {
            "merchant_id": 1,
            "title": "Khmer New Year Special 🎉",
            "description": "Happy Choul Chnam Thmey! Enjoy $5 OFF orders over $25. Celebrate the new year with great deals!",
            "discount_type": "fixed",
            "discount_value": 5,
            "min_order_amount": 25,
            "code": "KNY2026",
            "usage_limit": 10,
            "start_date": "2026-04-13 00:00:00",
            "end_date": "2026-04-17 23:59:59",
            "is_active": True,
        },
        {
            "merchant_id": 1,
            "title": "Water Festival Blowout 🌊",
            "description": "Bon Om Touk celebration! Get 15% OFF sitewide. Cool deals for the coolest festival of the year!",
            "discount_type": "percentage",
            "discount_value": 15,
            "min_order_amount": 15,
            "code": "WATER2026",
            "usage_limit": 50,
            "start_date": "2026-11-06 00:00:00",
            "end_date": "2026-11-09 23:59:59",
            "is_active": True,
        },
    ]
    
    for p in promotions:
        exists= execute_query(
            "SELECT promotion_id FROM promotions WHERE code =%s",
            (p["code"],),fetch_one=True
        )
        if exists:
            print(f"Code {p['code']} already exists, skipping.")
            continue
        pid=execute_query(
            """INSERT INTO promotions (merchant_id, title, description, discount_type, discount_value, min_order_amount, code, usage_limit, start_date, end_date, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                p["merchant_id"],
                p["title"],
                p["description"],
                p["discount_type"],
                p["discount_value"],
                p["min_order_amount"],
                p["code"],
                p["usage_limit"],
                p["start_date"],
                p["end_date"],
                p["is_active"]
            ),commit=True
        )
        print(f"Created: {p['title']} with code {p['code']} (ID: {pid})")
    print("\n📋 All promotions:")
    rows = execute_query("SELECT promotion_id, title, code, discount_type, discount_value, start_date, end_date FROM promotions", fetch_all=True) or []
    for r in rows:
        dtype = f"{r['discount_value']}%" if r["discount_type"] == "percentage" else f"${r['discount_value']}"
        print(f"  #{r['promotion_id']}  {r['title']}  |  {r['code']}  |  {dtype} OFF  |  {r['start_date']} → {r['end_date']}")

    print("\n🎉 Done!")
if __name__ == "__main__":
    run()    