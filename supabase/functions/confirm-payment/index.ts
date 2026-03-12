import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const { order_id } = await req.json()
  if (!order_id) return errorResponse('order_id required')

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
    .eq('id', order_id)
    .eq('user_id', user.id)
    .single()

  if (!order) return errorResponse('Order not found', 404)

  // Update payment and status
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', order_id)

  if (error) return errorResponse('Failed to confirm payment: ' + error.message, 500)

  return jsonResponse({ success: true, message: 'Payment confirmed' })
})
