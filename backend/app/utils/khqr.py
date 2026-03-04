"""
KHQR Payment Integration Utility
Based on BAKONG KHQR Specification (EMV QR Code Standard)
For MVP: Generates static QR codes with simplified format
Production: Use BAKONG API at api.bakong.nbc.gov.kh
"""

import qrcode
import base64
from io import BytesIO
from typing import Optional
from app.database import execute_query


def get_merchant_name(merchant_id: int) -> str:
    """Fetch merchant name from database"""
    if not merchant_id:
        return "Favourite of Shop"

    sql = "SELECT name FROM merchants WHERE id = %s"
    result = execute_query(sql, (merchant_id,), fetch_one=True)
    return result['name'] if result else "Unknown Merchant"


def get_merchant_account_info(merchant_id: int) -> dict:
    """Fetch merchant payment account information"""
    if not merchant_id:
        return {
            'name': 'Favourite of Shop',
            'account_id': 'platform@bakong',
            'bakong_account': None
        }

    sql = """
        SELECT name, bakong_account, phone
        FROM merchants
        WHERE id = %s
    """
    result = execute_query(sql, (merchant_id,), fetch_one=True)

    if result:
        return {
            'name': result['name'],
            'account_id': result.get('bakong_account') or result.get('phone') or f'merchant_{merchant_id}@bakong',
            'bakong_account': result.get('bakong_account')
        }

    return {
        'name': 'Unknown Merchant',
        'account_id': f'merchant_{merchant_id}@bakong',
        'bakong_account': None
    }


def generate_khqr_payload(
    amount: float,
    order_id: str,
    merchant_id: Optional[int] = None,
    currency: str = "USD"
) -> str:
    """
    Generate KHQR payload string following simplified EMV QR format

    Args:
        amount: Transaction amount
        order_id: Order identifier
        merchant_id: Merchant ID (optional, defaults to platform)
        currency: Currency code (USD or KHR)

    Returns:
        KHQR payload string
    """
    merchant_info = get_merchant_account_info(merchant_id) if merchant_id else {
        'name': 'Favourite of Shop',
        'account_id': 'platform@bakong'
    }

    # Simplified KHQR format for MVP
    # Production format should follow full EMV QR specification
    # with proper field tags and CRC calculation

    payload_parts = [
        f"00:KHQR",  # Payload Format Indicator
        f"01:12",    # Point of Initiation (12 = static)
        f"30:{merchant_info['account_id']}",  # Merchant Account
        f"52:0000",  # Merchant Category Code
        f"53:{currency}",  # Transaction Currency
        f"54:{amount:.2f}",  # Transaction Amount
        f"58:KH",    # Country Code
        f"59:{merchant_info['name'][:25]}",  # Merchant Name (max 25 chars)
        f"62:ORD-{order_id}",  # Additional Data (Order ID)
    ]

    payload = "|".join(payload_parts)

    # For production, calculate CRC-16 checksum and append
    # payload += f"|63:{calculate_crc16(payload)}"

    return payload


def generate_khqr(
    amount: float,
    order_id: str,
    merchant_id: Optional[int] = None,
    currency: str = "USD"
) -> str:
    """
    Generate KHQR QR code as base64 encoded image

    Args:
        amount: Transaction amount
        order_id: Order identifier
        merchant_id: Merchant ID (optional)
        currency: Currency code (USD or KHR)

    Returns:
        Base64 encoded PNG image string
    """
    # Generate KHQR payload
    payload = generate_khqr_payload(amount, order_id, merchant_id, currency)

    # Create QR code
    qr = qrcode.QRCode(
        version=1,  # Auto-adjust size
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # Medium error correction
        box_size=8,  # Size of each box in pixels
        border=2,    # Border size in boxes
    )

    qr.add_data(payload)
    qr.make(fit=True)

    # Generate image
    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    base64_image = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return f"data:image/png;base64,{base64_image}"


def verify_khqr_payment(
    transaction_id: str,
    order_id: str,
    expected_amount: float
) -> dict:
    """
    Verify KHQR payment status (MVP simulation)

    In production, this would call BAKONG API to verify actual payment
    For MVP, this is a placeholder that returns mock verification

    Args:
        transaction_id: KHQR transaction ID
        order_id: Order ID to verify
        expected_amount: Expected payment amount

    Returns:
        dict: Verification result with status and details
    """
    # Production implementation would call:
    # GET https://api.bakong.nbc.gov.kh/v1/check_transaction_status

    # MVP: Return mock verification
    # In real implementation, parse response from BAKONG API

    return {
        'success': False,
        'verified': False,
        'status': 'pending',
        'message': 'Manual verification required. For production, implement BAKONG API integration.',
        'transaction_id': transaction_id,
        'order_id': order_id,
        'amount': expected_amount,
        'note': 'This is MVP mode. Customer should screenshot payment confirmation.'
    }


def generate_payment_deeplink(
    amount: float,
    order_id: str,
    merchant_id: Optional[int] = None
) -> str:
    """
    Generate Bakong app deep link for direct payment

    Args:
        amount: Payment amount
        order_id: Order identifier
        merchant_id: Merchant ID

    Returns:
        Bakong app deep link URL
    """
    merchant_info = get_merchant_account_info(merchant_id) if merchant_id else {
        'account_id': 'platform@bakong'
    }

    # Bakong deep link format
    # This opens the Bakong mobile app directly with payment details pre-filled
    account = merchant_info['account_id']

    deeplink = f"bakong://pay?account={account}&amount={amount:.2f}&note=Order-{order_id}"

    return deeplink
