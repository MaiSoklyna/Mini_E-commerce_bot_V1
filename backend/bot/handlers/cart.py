from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
from app.database import execute_query
from bot.keyboards.inline import cart_keyboard, back_to_menu_keyboard, checkout_confirm_keyboard, main_menu_keyboard
import logging

logger = logging.getLogger(__name__)

# Conversation states for checkout
CHECKOUT_ADDRESS, CHECKOUT_CITY, CHECKOUT_CONFIRM = range(3)


async def add_to_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Add product to cart."""
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_")
    product_id = int(parts[1])
    quantity = int(parts[2]) if len(parts) > 2 else 1

    telegram_id = update.effective_user.id

    # Get user
    user = execute_query("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)
    if not user:
        await query.edit_message_text("Please /start first to register.", reply_markup=back_to_menu_keyboard())
        return

    # Get product
    product = execute_query(
        "SELECT id, merchant_id, name, base_price, stock, is_active FROM products WHERE id = %s AND is_active = TRUE",
        (product_id,), fetch_one=True
    )
    if not product:
        await query.edit_message_text("Product not found.", reply_markup=back_to_menu_keyboard())
        return

    if quantity > product["stock"]:
        await query.answer(f"Only {product['stock']} in stock!", show_alert=True)
        return

    unit_price = float(product["base_price"])
    user_id = user["id"]

    # Step 1: Find or create cart for user+merchant
    cart = execute_query(
        "SELECT id FROM cart WHERE user_id = %s AND merchant_id = %s",
        (user_id, product["merchant_id"]), fetch_one=True
    )
    if cart:
        cart_id = cart["id"]
    else:
        cart_id = execute_query(
            "INSERT INTO cart (user_id, merchant_id) VALUES (%s, %s)",
            (user_id, product["merchant_id"]), commit=True
        )

    # Step 2: Check if product already in cart_items
    existing = execute_query(
        "SELECT id, quantity FROM cart_items WHERE cart_id = %s AND product_id = %s",
        (cart_id, product_id), fetch_one=True
    )

    if existing:
        new_qty = existing["quantity"] + quantity
        execute_query(
            "UPDATE cart_items SET quantity = %s, unit_price = %s WHERE id = %s",
            (new_qty, unit_price, existing["id"]), commit=True
        )
    else:
        execute_query(
            "INSERT INTO cart_items (cart_id, product_id, quantity, unit_price) VALUES (%s, %s, %s, %s)",
            (cart_id, product_id, quantity, unit_price), commit=True
        )

    await query.answer(f"✅ Added {quantity}x {product['name']} to cart!", show_alert=True)
    await query.edit_message_text(
        f"✅ **Added to Cart!**\n\n"
        f"🛍️ {product['name']} x{quantity}\n"
        f"💰 ${unit_price * quantity:.2f}\n\n"
        f"What would you like to do next?",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🛒 View Cart", callback_data="view_cart")],
            [InlineKeyboardButton("🛍️ Continue Shopping", callback_data="browse_shops")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")],
        ])
    )


async def view_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show cart contents."""
    query = update.callback_query
    await query.answer()

    telegram_id = update.effective_user.id
    user = execute_query("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)
    if not user:
        await query.edit_message_text("Please /start first.", reply_markup=back_to_menu_keyboard())
        return

    items = execute_query(
        """SELECT ci.id, ci.quantity, ci.unit_price, ci.unit_price * ci.quantity AS line_total,
                  p.name, m.name AS merchant_name
           FROM cart_items ci
           JOIN cart c ON ci.cart_id = c.id
           JOIN products p ON ci.product_id = p.id
           JOIN merchants m ON c.merchant_id = m.id
           WHERE c.user_id = %s
           ORDER BY ci.created_at DESC""",
        (user["id"],), fetch_all=True
    )

    if not items:
        await query.edit_message_text(
            "🛒 Your cart is empty!\n\nBrowse shops to add products.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🛍️ Browse Shops", callback_data="browse_shops")],
                [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")],
            ])
        )
        return

    total = sum(float(item["line_total"]) for item in items)
    text = "🛒 **Your Shopping Cart**\n\n"
    for item in items:
        text += f"• {item['name']} x{item['quantity']} — ${float(item['line_total']):.2f}\n"
        text += f"  _from {item['merchant_name']}_\n"
    text += f"\n💰 **Total: ${total:.2f}**"

    await query.edit_message_text(text, parse_mode="Markdown", reply_markup=cart_keyboard(items))


async def remove_from_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Remove item from cart."""
    query = update.callback_query
    item_id = int(query.data.split("_")[1])

    execute_query("DELETE FROM cart_items WHERE id = %s", (item_id,), commit=True)
    await query.answer("Removed from cart!")

    # Refresh cart view
    await view_cart(update, context)


async def clear_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Clear entire cart."""
    query = update.callback_query
    await query.answer()

    telegram_id = update.effective_user.id
    user = execute_query("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)
    if user:
        execute_query(
            "DELETE ci FROM cart_items ci JOIN cart c ON ci.cart_id = c.id WHERE c.user_id = %s",
            (user["id"],), commit=True
        )

    await query.edit_message_text(
        "🗑 Cart cleared!",
        reply_markup=back_to_menu_keyboard()
    )


async def checkout_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start checkout - ask for delivery address."""
    query = update.callback_query
    await query.answer()

    telegram_id = update.effective_user.id
    user = execute_query("SELECT id, address FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)

    # Check if user has saved address
    if user and user.get("address"):
        context.user_data["checkout_address"] = user["address"]

        await query.edit_message_text(
            f"📍 **Delivery Address:**\n"
            f"{user['address']}\n\n"
            f"Use this address?",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Use This Address", callback_data="confirm_address")],
                [InlineKeyboardButton("✏️ New Address", callback_data="new_address")],
                [InlineKeyboardButton("❌ Cancel", callback_data="view_cart")],
            ])
        )
    else:
        await query.edit_message_text(
            "📍 **Checkout**\n\nPlease type your **delivery address**:",
            parse_mode="Markdown"
        )
        context.user_data["checkout_state"] = "waiting_address"


async def handle_checkout_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input during checkout."""
    state = context.user_data.get("checkout_state")

    if state == "waiting_address":
        context.user_data["checkout_address"] = update.message.text
        context.user_data["checkout_state"] = None

        # Save to users.address
        telegram_id = update.effective_user.id
        user = execute_query("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)
        if user:
            execute_query(
                "UPDATE users SET address = %s WHERE id = %s",
                (context.user_data["checkout_address"], user["id"]),
                commit=True
            )

        await update.message.reply_text(
            f"📍 **Delivery to:**\n"
            f"{context.user_data['checkout_address']}\n\n"
            f"💳 Payment: **Cash on Delivery**\n\n"
            f"Confirm your order?",
            parse_mode="Markdown",
            reply_markup=checkout_confirm_keyboard()
        )


async def confirm_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Confirm saved address for checkout."""
    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        f"📍 **Delivery to:**\n"
        f"{context.user_data.get('checkout_address', 'N/A')}\n\n"
        f"💳 Payment: **Cash on Delivery**\n\n"
        f"Confirm your order?",
        parse_mode="Markdown",
        reply_markup=checkout_confirm_keyboard()
    )


async def new_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Ask for new delivery address."""
    query = update.callback_query
    await query.answer()

    context.user_data["checkout_state"] = "waiting_address"
    await query.edit_message_text(
        "📍 Please type your **delivery address**:",
        parse_mode="Markdown"
    )


async def confirm_order_cod(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Confirm and place order with Cash on Delivery."""
    query = update.callback_query
    await query.answer()

    telegram_id = update.effective_user.id
    user = execute_query("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)
    if not user:
        await query.edit_message_text("Error: User not found.", reply_markup=back_to_menu_keyboard())
        return

    user_id = user["id"]
    address = context.user_data.get("checkout_address", "")

    # Get cart items
    cart_items = execute_query(
        """SELECT ci.id, ci.product_id, ci.quantity, ci.unit_price, ci.unit_price * ci.quantity AS line_total,
                  p.name AS product_name, p.sku, p.stock, c.merchant_id
           FROM cart_items ci
           JOIN cart c ON ci.cart_id = c.id
           JOIN products p ON ci.product_id = p.id
           WHERE c.user_id = %s""",
        (user_id,), fetch_all=True
    )

    if not cart_items:
        await query.edit_message_text("Cart is empty!", reply_markup=back_to_menu_keyboard())
        return

    # Group by merchant and create orders
    import uuid
    merchant_groups = {}
    for item in cart_items:
        mid = item["merchant_id"]
        if mid not in merchant_groups:
            merchant_groups[mid] = []
        merchant_groups[mid].append(item)

    created_orders = []
    for merchant_id, items in merchant_groups.items():
        subtotal = sum(float(item["line_total"]) for item in items)
        order_code = f"ORD-{uuid.uuid4().hex[:8].upper()}"

        order_id = execute_query(
            """INSERT INTO orders (order_code, merchant_id, user_id, subtotal, discount_amount, total,
                   delivery_address, payment_method, payment_status, status)
               VALUES (%s, %s, %s, %s, 0, %s, %s, 'cod', 'unpaid', 'pending')""",
            (order_code, merchant_id, user_id, subtotal, subtotal, address),
            commit=True
        )

        for item in items:
            execute_query(
                """INSERT INTO order_items (order_id, product_id, product_name, product_sku,
                       quantity, unit_price, subtotal)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (order_id, item["product_id"], item["product_name"], item.get("sku"),
                 item["quantity"], float(item["unit_price"]), float(item["line_total"])),
                commit=True
            )
            # Decrease stock
            execute_query(
                "UPDATE products SET stock = stock - %s WHERE id = %s",
                (item["quantity"], item["product_id"]), commit=True
            )

        created_orders.append({"order_code": order_code, "total": subtotal})

    # Clear cart
    execute_query(
        "DELETE ci FROM cart_items ci JOIN cart c ON ci.cart_id = c.id WHERE c.user_id = %s",
        (user_id,), commit=True
    )

    # Build confirmation message
    text = "🎉 **Order Placed Successfully!**\n\n"
    for o in created_orders:
        text += f"📦 Order: `{o['order_code']}`\n"
        text += f"💰 Total: ${o['total']:.2f}\n\n"
    text += f"📍 Delivery: {address}\n"
    text += f"💳 Payment: Cash on Delivery\n\n"
    text += "You can track your orders anytime!"

    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📦 My Orders", callback_data="my_orders")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")],
        ])
    )