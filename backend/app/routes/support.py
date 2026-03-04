"""
Support API — customer-facing ticket & messaging endpoints
Tables: support_tickets, ticket_messages
"""
from fastapi import APIRouter, HTTPException, Depends
from app.models.support import TicketCreate, TicketReply
from app.database import execute_query
from app.utils.security import get_current_user
from app.config import settings
import logging

router = APIRouter(prefix="/support", tags=["Support"])
logger = logging.getLogger(__name__)


# ── Ticket CRUD ─────────────────────────────────────────────────

@router.post("/tickets")
async def create_ticket(body: TicketCreate, user: dict = Depends(get_current_user)):
    """Create a support ticket targeted at a specific merchant."""
    # Validate merchant
    merchant = execute_query(
        "SELECT id, name FROM merchants WHERE id = %s AND status = 'active'",
        (body.merchant_id,), fetch_one=True,
    )
    if not merchant:
        raise HTTPException(404, "Merchant not found")

    # Validate order if provided
    if body.order_id:
        order = execute_query(
            "SELECT id FROM orders WHERE id = %s AND user_id = %s AND merchant_id = %s",
            (body.order_id, user["id"], body.merchant_id), fetch_one=True,
        )
        if not order:
            raise HTTPException(404, "Order not found")

    # Insert ticket
    ticket_id = execute_query(
        "INSERT INTO support_tickets (user_id, merchant_id, order_id, subject) "
        "VALUES (%s, %s, %s, %s)",
        (user["id"], body.merchant_id, body.order_id, body.subject),
        commit=True,
    )

    # Insert first message
    execute_query(
        "INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, body) "
        "VALUES (%s, 'customer', %s, %s)",
        (ticket_id, user["id"], body.message),
        commit=True,
    )

    # Forward to Telegram support group
    if settings.SUPPORT_GROUP_ID:
        try:
            from app.utils.bot_manager import send_telegram_message
            text = (
                f"📩 New Support Ticket #{ticket_id}\n"
                f"From: {user.get('first_name', 'Customer')}\n"
                f"Merchant: {merchant['name']}\n"
                f"Subject: {body.subject}\n\n"
                f"{body.message[:500]}"
            )
            await send_telegram_message(int(settings.SUPPORT_GROUP_ID), text)
        except Exception as e:
            logger.warning(f"Failed to forward ticket to TG group: {e}")

    return {
        "success": True,
        "data": {"id": ticket_id, "status": "open"},
        "message": "Support ticket submitted successfully.",
    }


@router.get("/tickets")
async def list_tickets(user: dict = Depends(get_current_user)):
    """List all tickets for the current user."""
    tickets = execute_query(
        "SELECT t.id, t.subject, t.status, t.order_id, t.merchant_id, "
        "m.name AS merchant_name, m.icon_emoji AS merchant_emoji, "
        "t.created_at, t.updated_at, "
        "(SELECT tm.body FROM ticket_messages tm WHERE tm.ticket_id = t.id "
        " ORDER BY tm.created_at DESC LIMIT 1) AS last_message, "
        "(SELECT tm.sender_type FROM ticket_messages tm WHERE tm.ticket_id = t.id "
        " ORDER BY tm.created_at DESC LIMIT 1) AS last_sender "
        "FROM support_tickets t "
        "JOIN merchants m ON t.merchant_id = m.id "
        "WHERE t.user_id = %s "
        "ORDER BY t.updated_at DESC LIMIT 50",
        (user["id"],), fetch_all=True,
    ) or []
    return {"success": True, "data": tickets}


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int, user: dict = Depends(get_current_user)):
    """Get a single ticket with all its messages."""
    ticket = execute_query(
        "SELECT t.id, t.subject, t.status, t.order_id, t.merchant_id, "
        "m.name AS merchant_name, m.icon_emoji AS merchant_emoji, "
        "t.created_at, t.updated_at "
        "FROM support_tickets t "
        "JOIN merchants m ON t.merchant_id = m.id "
        "WHERE t.id = %s AND t.user_id = %s",
        (ticket_id, user["id"]), fetch_one=True,
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    messages = execute_query(
        "SELECT id, sender_type, sender_id, body, created_at "
        "FROM ticket_messages WHERE ticket_id = %s ORDER BY created_at ASC",
        (ticket_id,), fetch_all=True,
    ) or []

    return {"success": True, "data": {**ticket, "messages": messages}}


@router.post("/tickets/{ticket_id}/messages")
async def add_message(ticket_id: int, body: TicketReply, user: dict = Depends(get_current_user)):
    """Customer sends a follow-up message on an existing ticket."""
    ticket = execute_query(
        "SELECT id, status, merchant_id FROM support_tickets WHERE id = %s AND user_id = %s",
        (ticket_id, user["id"]), fetch_one=True,
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if ticket["status"] == "closed":
        raise HTTPException(422, "This ticket is closed")

    execute_query(
        "INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, body) "
        "VALUES (%s, 'customer', %s, %s)",
        (ticket_id, user["id"], body.message),
        commit=True,
    )

    # Set status back to open so merchant sees it
    execute_query(
        "UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = %s",
        (ticket_id,), commit=True,
    )

    return {"success": True, "message": "Message sent"}


# ── Static info ─────────────────────────────────────────────────

@router.get("/faq")
async def get_faq():
    """Get frequently asked questions."""
    faq_items = [
        {"id": 1, "category": "Orders", "question": "How do I track my order?",
         "answer": "Go to 'My Orders' and tap on your order to see its current status and tracking information."},
        {"id": 2, "category": "Orders", "question": "Can I cancel my order?",
         "answer": "You can cancel orders that are still in 'pending' status. Once confirmed by the merchant, cancellation requires contacting support."},
        {"id": 3, "category": "Payment", "question": "What payment methods are accepted?",
         "answer": "We accept Cash on Delivery (COD), KHQR, ABA Pay, and Wing."},
        {"id": 4, "category": "Delivery", "question": "How long does delivery take?",
         "answer": "Delivery time varies by merchant and location, typically 2-5 business days. Check product details for specific delivery estimates."},
        {"id": 5, "category": "Returns", "question": "What is the return policy?",
         "answer": "Returns are handled by individual merchants. Contact the merchant directly through the app or submit a support ticket."},
    ]
    return {"success": True, "data": faq_items}


@router.get("/contact")
async def get_contact_info():
    """Get support contact information."""
    return {
        "success": True,
        "data": {
            "email": "support@favouriteofshop.com",
            "telegram": "@FavouriteOfShop_bot",
            "hours": "Monday - Friday, 9:00 AM - 6:00 PM (Cambodia Time)",
            "response_time": "We aim to respond within 24 hours",
        },
    }
