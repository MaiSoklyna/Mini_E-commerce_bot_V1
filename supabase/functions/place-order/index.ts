import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const body = await req.json()
  const { merchant_id, delivery_address, delivery_province, note, payment_method, promo_code } = body

  if (!merchant_id || !delivery_address) {
    return errorResponse('merchant_id and delivery_address required')
  }

  // Get user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('telegram_id', jwt.telegram_id)
    .single()
  if (!user) return errorResponse('User not found', 404)

  // Call the place_order RPC
  const { data, error } = await supabaseAdmin.rpc('place_order', {
    p_user_id: user.id,
    p_merchant_id: merchant_id,
    p_delivery_address: delivery_address,
    p_delivery_province: delivery_province || null,
    p_customer_note: note || null,
    p_payment_method: payment_method || 'cod',
    p_promo_code: promo_code || null,
  })

  if (error) {
    const msg = error.message || 'Order failed'
    if (msg.includes('CART_EMPTY')) return errorResponse('Cart is empty', 400)
    return errorResponse(msg, 500)
  }

  return jsonResponse({ success: true, data })
})
