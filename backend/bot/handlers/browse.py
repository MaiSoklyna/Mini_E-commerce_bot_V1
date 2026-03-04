from telegram import Update
from telegram.ext import ContextTypes
from app.database import execute_query
from bot.keyboards.inline import (
    merchant_list_keyboard, category_keyboard, product_list_keyboard,
    product_detail_keyboard, back_to_menu_keyboard
)
import logging

logger = logging.getLogger(__name__)


async def browse_shops(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show list of active merchants."""
    query = update.callback_query
    await query.answer()

    merchants = execute_query(
        """SELECT m.*,
                  (SELECT COUNT(*) FROM products p WHERE p.merchant_id = m.id AND p.is_active = TRUE) as product_count
           FROM merchants m WHERE m.status = 'active' ORDER BY m.name""",
        fetch_all=True
    )

    if not merchants:
        await query.edit_message_text(
            "😔 No shops available right now. Check back later!",
            reply_markup=back_to_menu_keyboard()
        )
        return

    await query.edit_message_text(
        "🏪 **Available Shops**\nSelect a shop to browse products:",
        parse_mode="Markdown",
        reply_markup=merchant_list_keyboard(merchants)
    )


async def view_shop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show categories for a specific merchant."""
    query = update.callback_query
    await query.answer()

    merchant_id = int(query.data.split("_")[1])

    merchant = execute_query(
        "SELECT * FROM merchants WHERE id = %s", (merchant_id,), fetch_one=True
    )
    if not merchant:
        await query.edit_message_text("Shop not found.", reply_markup=back_to_menu_keyboard())
        return

    # Get categories that have products for this merchant
    categories = execute_query(
        """SELECT DISTINCT c.id, c.name, c.icon_emoji
           FROM categories c
           JOIN products p ON c.id = p.category_id
           WHERE p.merchant_id = %s AND p.is_active = TRUE
           ORDER BY c.name""",
        (merchant_id,), fetch_all=True
    )

    text = f"🏪 **{merchant['name']}**\n"
    if merchant.get("description"):
        text += f"_{merchant['description']}_\n"
    text += "\nSelect a category or view all products:"

    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=category_keyboard(categories, merchant_id)
    )


async def view_category_products(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show products in a category for a merchant."""
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_")
    merchant_id = int(parts[1])
    category_id = int(parts[2])

    products = execute_query(
        """SELECT * FROM products
           WHERE merchant_id = %s AND category_id = %s AND is_active = TRUE
           ORDER BY name""",
        (merchant_id, category_id), fetch_all=True
    )

    if not products:
        await query.edit_message_text(
            "No products in this category.",
            reply_markup=back_to_menu_keyboard()
        )
        return

    category = execute_query(
        "SELECT name FROM categories WHERE id = %s",
        (category_id,), fetch_one=True
    )
    cat_name = category["name"] if category else "Products"

    await query.edit_message_text(
        f"📂 **{cat_name}**\nSelect a product for details:",
        parse_mode="Markdown",
        reply_markup=product_list_keyboard(products, merchant_id)
    )


async def view_all_products(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show all products for a merchant."""
    query = update.callback_query
    await query.answer()

    merchant_id = int(query.data.split("_")[1])

    products = execute_query(
        """SELECT * FROM products
           WHERE merchant_id = %s AND is_active = TRUE
           ORDER BY name""",
        (merchant_id,), fetch_all=True
    )

    if not products:
        await query.edit_message_text(
            "No products available in this shop.",
            reply_markup=back_to_menu_keyboard()
        )
        return

    await query.edit_message_text(
        "📋 **All Products**\nSelect a product for details:",
        parse_mode="Markdown",
        reply_markup=product_list_keyboard(products, merchant_id)
    )


async def view_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show product details with add to cart option."""
    query = update.callback_query
    await query.answer()

    product_id = int(query.data.split("_")[1])

    product = execute_query(
        """SELECT p.*, m.name as merchant_name
           FROM products p
           JOIN merchants m ON p.merchant_id = m.id
           WHERE p.id = %s""",
        (product_id,), fetch_one=True
    )

    if not product:
        await query.edit_message_text("Product not found.", reply_markup=back_to_menu_keyboard())
        return

    # Store current quantity in user data
    context.user_data[f"qty_{product_id}"] = 1

    stock_text = f"✅ In Stock ({product['stock']})" if product["stock"] > 0 else "❌ Out of Stock"
    rating_text = f"⭐ {product['rating_avg']:.1f}/5 ({product['review_count']} reviews)" if product["review_count"] > 0 else "No reviews yet"

    text = (
        f"🛍️ **{product['name']}**\n"
        f"🏪 {product['merchant_name']}\n\n"
        f"💰 **${product['base_price']:.2f}**\n"
        f"📦 {stock_text}\n"
        f"🚚 Delivery: ~{product['delivery_days']} days\n"
        f"{rating_text}\n"
    )
    if product.get("description"):
        text += f"\n📝 {product['description']}"

    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=product_detail_keyboard(product_id, product["merchant_id"])
    )