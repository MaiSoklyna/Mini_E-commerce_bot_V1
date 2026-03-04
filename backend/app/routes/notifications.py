"""
Notifications API — customer endpoints
Tables: notifications
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from app.database import execute_query
from app.utils.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Get user notifications (latest first)."""
    notifications = execute_query(
        "SELECT id, type, title, body, ref_id, is_read, sent_at "
        "FROM notifications WHERE user_id = %s "
        "ORDER BY sent_at DESC LIMIT %s",
        (user["id"], limit), fetch_all=True,
    ) or []

    unread_count = execute_query(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND is_read = FALSE",
        (user["id"],), fetch_one=True,
    )

    return {
        "success": True,
        "data": {
            "notifications": notifications,
            "unread_count": unread_count["count"] if unread_count else 0,
        },
    }


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: int, user: dict = Depends(get_current_user)):
    """Mark a notification as read."""
    # Check notification belongs to user
    notification = execute_query(
        "SELECT id, is_read FROM notifications WHERE id = %s AND user_id = %s",
        (notification_id, user["id"]), fetch_one=True,
    )
    if not notification:
        raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")

    if notification["is_read"]:
        return {
            "success": True,
            "message": "Notification already marked as read",
        }

    # Mark as read
    execute_query(
        "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
        (notification_id, user["id"]), commit=True,
    )

    return {
        "success": True,
        "message": "Notification marked as read",
    }


@router.post("/mark-all-read")
async def mark_all_read(user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    updated = execute_query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
        (user["id"],), commit=True,
    )

    return {
        "success": True,
        "message": f"Marked all notifications as read",
    }
