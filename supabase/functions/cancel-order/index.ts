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
  if (order.status !== 'pending') return errorResponse('Only pending orders can be cancelled')

  // Restore stock
  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', order_id)

  if (items) {
    for (const item of items) {
      if (item.product_id) {
        await supabaseAdmin.rpc('', {}).catch(() => {})
        // Direct update
        const { data: prod } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single()

        if (prod) {
          await supabaseAdmin
            .from('products')
            .update({ stock: prod.stock + item.quantity })
            .eq('id', item.product_id)
        }
      }
    }
  }

  // Cancel the order
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order_id)

  if (error) return errorResponse('Failed to cancel order: ' + error.message, 500)

  return jsonResponse({ success: true, message: 'Order cancelled' })
})
