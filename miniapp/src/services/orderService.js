import { supabase, callEdgeFunction, callEdgeFunctionGet } from '../lib/supabase'

/** List user's orders with merchant name */
export async function listOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  if (!orders || orders.length === 0) return []

  // Get merchant names
  const merchantIds = [...new Set(orders.map(o => o.merchant_id))]
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, name')
    .in('id', merchantIds)

  const merchantMap = {}
  ;(merchants || []).forEach(m => { merchantMap[m.id] = m.name })

  // Get order items for summary
  const orderIds = orders.map(o => o.id)
  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, product_name')
    .in('order_id', orderIds)

  const itemsByOrder = {}
  ;(items || []).forEach(i => {
    if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = []
    itemsByOrder[i.order_id].push(i)
  })

  return orders.map(o => ({
    ...o,
    merchant_name: merchantMap[o.merchant_id] || 'Shop',
    items: itemsByOrder[o.id] || [],
    item_count: (itemsByOrder[o.id] || []).length,
  }))
}

/** Get a single order by ID with items */
export async function getOrder(id) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  // Get merchant name
  let merchant_name = 'Shop'
  if (order.merchant_id) {
    const { data: merchant } = await supabase
      .from('merchants')
      .select('name')
      .eq('id', order.merchant_id)
      .single()
    merchant_name = merchant?.name || 'Shop'
  }

  // Get order items
  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id)

  return { ...order, merchant_name, items: items || [] }
}

/** Place an order via Edge Function */
export async function placeOrder(token, payload) {
  return callEdgeFunction('place-order', payload, token)
}

/** Cancel an order via Edge Function */
export async function cancelOrder(token, orderId) {
  return callEdgeFunction('cancel-order', { order_id: orderId }, token)
}

/** Get KHQR QR code via Edge Function */
export async function getKhqr(token, orderId) {
  return callEdgeFunctionGet('generate-khqr', { order_id: orderId }, token)
}

/** Confirm KHQR payment via Edge Function */
export async function confirmPayment(token, orderId) {
  return callEdgeFunction('confirm-payment', { order_id: orderId }, token)
}
