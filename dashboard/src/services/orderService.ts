import { supabase } from '../lib/supabase'

interface ListParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  merchant_id?: number
}

/** List orders with pagination and filters */
export async function listOrders(params: ListParams = {}) {
  const { page = 1, limit = 20, search, status, merchant_id } = params

  let query = supabase.from('orders').select('*', { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (merchant_id) query = query.eq('merchant_id', merchant_id)
  if (search) {
    query = query.or(`order_code.ilike.%${search}%,delivery_address.ilike.%${search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  const { data: orders, error, count } = await query
  if (error) throw error

  // Enrich with customer names and merchant names
  if (orders && orders.length > 0) {
    const userIds = Array.from(new Set(orders.map(o => o.user_id).filter(Boolean)))
    const merchantIds = Array.from(new Set(orders.map(o => o.merchant_id).filter(Boolean)))

    const [usersRes, merchantsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('users').select('id, first_name, last_name, username, phone').in('id', userIds)
        : { data: [] },
      merchantIds.length > 0
        ? supabase.from('merchants').select('id, name').in('id', merchantIds)
        : { data: [] },
    ])

    const userMap: Record<number, any> = {}
    ;(usersRes.data || []).forEach((u: any) => {
      userMap[u.id] = {
        name: u.first_name ? `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}` : u.username || `User #${u.id}`,
        phone: u.phone,
      }
    })

    const merchantMap: Record<number, string> = {}
    ;(merchantsRes.data || []).forEach((m: any) => { merchantMap[m.id] = m.name })

    orders.forEach((o: any) => {
      const user = userMap[o.user_id] || {}
      o.customer_name = user.name || '—'
      o.customer_phone = user.phone || ''
      o.merchant_name = merchantMap[o.merchant_id] || 'Shop'
    })
  }

  return {
    data: orders || [],
    meta: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit),
    },
  }
}

/** Get single order with items */
export async function getOrder(id: number) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  // Get items
  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id)

  // Get customer info
  let customer_name = '—'
  let customer_phone = ''
  if (order.user_id) {
    const { data: user } = await supabase
      .from('users')
      .select('first_name, last_name, username, phone')
      .eq('id', order.user_id)
      .single()

    if (user) {
      customer_name = user.first_name
        ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
        : user.username || '—'
      customer_phone = user.phone || ''
    }
  }

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

  return {
    ...order,
    customer_name,
    customer_phone,
    merchant_name,
    items: (items || []).map((i: any) => ({
      ...i,
      subtotal: parseFloat(i.unit_price) * i.quantity,
    })),
  }
}

/** Update order status */
export async function updateOrderStatus(id: number, status: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
