# KHQR Payment Integration - MVP Implementation

## Overview
This MVP implementation provides KHQR (Cambodia's national QR payment standard) integration for the Favourite of Shop platform. The implementation follows the BAKONG KHQR specification based on EMV QR Code standards.

## Implementation Status: ✅ MVP Complete

### Backend Components

#### 1. **KHQR Utility** (`backend/app/utils/khqr.py`)
- ✅ QR code generation using `qrcode` library
- ✅ Base64 encoded PNG output
- ✅ Simplified EMV QR payload format
- ✅ Merchant account information retrieval
- ✅ Bakong app deep link generation
- ⚠️ Production: Needs full EMV QR format with CRC-16 checksum

**Key Functions:**
- `generate_khqr()` - Generates KHQR QR code as base64 image
- `generate_khqr_payload()` - Creates EMV-compliant payload string
- `get_merchant_account_info()` - Fetches merchant payment details
- `generate_payment_deeplink()` - Creates Bakong app deep link
- `verify_khqr_payment()` - Placeholder for payment verification

#### 2. **API Endpoints** (`backend/app/routes/orders.py`)

**GET /api/orders/{order_id}/khqr**
- Generates KHQR QR code for order payment
- Returns: QR code (base64), deep link, amount, expiry time
- Validates: payment method, payment status, order status
- Response includes payment instructions

**POST /api/orders/{order_id}/confirm-payment**
- Manual payment confirmation (MVP)
- Updates order status to 'confirmed'
- Updates payment_status to 'paid'
- ⚠️ Production: Should be triggered by BAKONG webhook

### Frontend Components

#### 3. **Checkout Flow** (`miniapp/src/pages/Checkout.jsx`)

**Enhanced 4-Step Checkout:**
1. **Step 1: Address** - Delivery information
2. **Step 2: Payment** - COD or KHQR selection
3. **Step 3: Confirm** - Order review
4. **Step 4: KHQR Payment** ⭐ NEW - QR code display and payment

**Step 4 Features:**
- ✅ Real-time QR code display (base64 image)
- ✅ Amount display ($XX.XX)
- ✅ 15-minute countdown timer
- ✅ Supported banks list (ABA, ACLEDA, Wing, Pi Pay, etc.)
- ✅ Step-by-step payment instructions
- ✅ Bakong app deep link button
- ✅ "I've Paid" confirmation button
- ✅ "I'll Pay Later" option
- ✅ Expiry warning notice

## KHQR Payload Format (Simplified MVP)

```
Format: field:value|field:value|...

00:KHQR              # Payload Format Indicator
01:12                # Point of Initiation (12 = static)
30:{merchant_account} # Merchant Account
52:0000              # Merchant Category Code
53:USD               # Transaction Currency
54:{amount}          # Transaction Amount
58:KH                # Country Code
59:{merchant_name}   # Merchant Name (max 25 chars)
62:ORD-{order_id}    # Additional Data (Order ID)
```

⚠️ **Production Enhancement Needed:**
- Full EMV QR specification compliance
- CRC-16 checksum calculation (field 63)
- Proper field tag formatting (2-digit tags)
- Length indicators for variable fields

## Production Integration Roadmap

### Phase 1: BAKONG API Integration
- [ ] Register merchant with National Bank of Cambodia
- [ ] Obtain BAKONG API credentials
- [ ] Implement full EMV QR generation with CRC-16
- [ ] Use BAKONG QR generation API: `https://api.bakong.nbc.gov.kh/v1/generate_qr`

### Phase 2: Payment Verification
- [ ] Implement BAKONG webhook handler
- [ ] Verify payment status via API: `GET /v1/check_transaction_status`
- [ ] Auto-confirm orders upon successful payment
- [ ] Handle payment failures and timeouts

### Phase 3: Enhanced Features
- [ ] Dynamic QR codes with unique transaction IDs
- [ ] Real-time payment status updates (WebSocket)
- [ ] Refund processing via BAKONG API
- [ ] Payment analytics and reconciliation

## Testing Checklist

### MVP Testing:
- [x] QR code generation works
- [x] QR code displays correctly in frontend
- [x] Timer countdown functions properly
- [x] Deep link button navigates to Bakong app
- [x] Manual payment confirmation works
- [x] Order status updates correctly

### Production Testing (TODO):
- [ ] Test with real BAKONG sandbox
- [ ] Verify QR scannability with banking apps
- [ ] Test webhook payment notifications
- [ ] Load testing with concurrent payments
- [ ] Security audit of payment flow

## Database Schema Support

**Orders Table:**
- `payment_method` - 'cod' or 'khqr'
- `payment_status` - 'pending', 'paid', 'failed', 'refunded'
- `status` - Order fulfillment status

**Merchants Table** (needs enhancement):
- `bakong_account` - Merchant's BAKONG account ID
- `phone` - Fallback for account identification

## Security Considerations

✅ **Implemented:**
- User authentication required for all endpoints
- Order ownership verification
- Payment method validation
- Order status checks before QR generation

⚠️ **Production Requirements:**
- HTTPS only in production
- Webhook signature verification
- Rate limiting on QR generation
- Payment timeout enforcement
- Fraud detection mechanisms

## Dependencies

**Backend:**
```
qrcode[pil]>=8.0
Pillow>=10.0
```

**Frontend:**
- No additional dependencies (uses native base64 image display)

## API Documentation

### Generate KHQR Code
```http
GET /api/orders/{order_id}/khqr
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "order_id": 123,
    "order_code": "ORD-ABC123",
    "amount": 45.99,
    "qr_code": "data:image/png;base64,iVBORw0KG...",
    "deeplink": "bakong://pay?account=...&amount=45.99",
    "expires_in": 900,
    "instructions": {
      "step1": "Scan this QR code with Bakong app",
      ...
    }
  }
}
```

### Confirm Payment
```http
POST /api/orders/{order_id}/confirm-payment
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "order_id": 123,
    "order_code": "ORD-ABC123",
    "payment_status": "paid",
    "status": "confirmed"
  }
}
```

## Support & Documentation

**BAKONG Resources:**
- Official Documentation: https://www.bakong.nbc.gov.kh
- API Documentation: Contact National Bank of Cambodia
- SDK Documentation: KHQR_SDK_Document.pdf

**Internal:**
- Backend utility: `backend/app/utils/khqr.py`
- API routes: `backend/app/routes/orders.py`
- Frontend checkout: `miniapp/src/pages/Checkout.jsx`

## Notes

- MVP uses simplified QR format for demonstration
- Real payments require BAKONG API integration
- Manual confirmation is temporary for MVP
- 15-minute QR expiry is configurable
- Supports both USD and KHR currencies (backend ready)

---

**Last Updated:** 2026-02-28
**Version:** 1.0 (MVP)
**Status:** Ready for testing
