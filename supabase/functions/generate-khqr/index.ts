import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const url = new URL(req.url)
  const orderId = url.searchParams.get('order_id')
  if (!orderId) return errorResponse('order_id required')

  // Get user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('telegram_id', jwt.telegram_id)
    .single()
  if (!user) return errorResponse('User not found', 404)

  // Get order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return errorResponse('Order not found', 404)

  // Generate a placeholder KHQR (in production, integrate with Bakong/bank API)
  const amount = parseFloat(order.total)
  const merchantName = 'Favourite of Shop'
  const qrPayload = `KHQR:${order.order_code}:${amount.toFixed(2)}:${merchantName}`

  // Simple base64 SVG QR placeholder
  const svgQr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="white"/>
    <text x="100" y="90" text-anchor="middle" font-size="14" fill="#333">KHQR</text>
    <text x="100" y="115" text-anchor="middle" font-size="18" font-weight="bold" fill="#00BFA5">$${amount.toFixed(2)}</text>
    <text x="100" y="140" text-anchor="middle" font-size="10" fill="#666">${order.order_code}</text>
  </svg>`

  const qrCode = `data:image/svg+xml;base64,${btoa(svgQr)}`

  return jsonResponse({
    data: {
      qr_code: qrCode,
      amount,
      order_code: order.order_code,
      expires_in: 900,
      deeplink: `https://bakong.nbc.gov.kh/pay?amount=${amount}&ref=${order.order_code}`,
    },
  })
})
