import { supabase } from '../lib/supabase'

function getDateRange(period: string, custom?: { start?: string; end?: string }) {
  const now = new Date()
  let start: Date
  let end = now

  if (period === 'custom' && custom?.start && custom?.end) {
    start = new Date(custom.start)
    end = new Date(custom.end)
    end.setHours(23, 59, 59, 999)
  } else if (period === '7d') {
    start = new Date(now)
    start.setDate(start.getDate() - 7)
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    // 30d default
    start = new Date(now)
    start.setDate(start.getDate() - 30)
  }

  return { start: start!.toISOString(), end: end.toISOString() }
}

/** Get KPI data */
export async function getKPI(params: any) {
  const range = getDateRange(params.period, params)
  const prevStart = new Date(range.start)
  const prevEnd = new Date(range.start)
  const durationMs = new Date(range.end).getTime() - new Date(range.start).getTime()
  prevStart.setTime(prevStart.getTime() - durationMs)

  // Current period orders
  const { data: currentOrders } = await supabase
    .from('orders')
    .select('id, total, user_id, created_at')
    .gte('created_at', range.start)
    .lte('created_at', range.end)

  // Previous period orders (for change %)
  const { data: prevOrders } = await supabase
    .from('orders')
    .select('id, total, user_id')
    .gte('created_at', prevStart.toISOString())
    .lt('created_at', range.start)

  // Current period new users
  const { count: newUsers } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', range.start)
    .lte('created_at', range.end)

  const { count: prevNewUsers } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', prevStart.toISOString())
    .lt('created_at', range.start)

  const curr = currentOrders || []
  const prev = prevOrders || []

  const revenue = curr.reduce((s, o) => s + parseFloat(o.total || 0), 0)
  const prevRevenue = prev.reduce((s, o) => s + parseFloat(o.total || 0), 0)
  const avgOrderValue = curr.length > 0 ? revenue / curr.length : 0
  const prevAvgOrderValue = prev.length > 0 ? prevRevenue / prev.length : 0

  const pctChange = (curr: number, prev: number) =>
    prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0

  return {
    revenue,
    revenue_change: pctChange(revenue, prevRevenue),
    orders: curr.length,
    orders_change: pctChange(curr.length, prev.length),
    new_users: newUsers || 0,
    new_users_change: pctChange(newUsers || 0, prevNewUsers || 0),
    avg_order_value: avgOrderValue,
    avg_order_value_change: pctChange(avgOrderValue, prevAvgOrderValue),
  }
}

/** Get revenue over time */
export async function getRevenue(params: any) {
  const range = getDateRange(params.period, params)

  const { data: orders } = await supabase
    .from('orders')
    .select('total, created_at')
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at')

  // Group by date
  const byDate: Record<string, { revenue: number; orders: number }> = {}
  ;(orders || []).forEach((o: any) => {
    const date = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!byDate[date]) byDate[date] = { revenue: 0, orders: 0 }
    byDate[date].revenue += parseFloat(o.total || 0)
    byDate[date].orders += 1
  })

  return Object.entries(byDate).map(([date, d]) => ({
    date,
    revenue: Math.round(d.revenue * 100) / 100,
    orders: d.orders,
  }))
}

/** Get order status distribution */
export async function getOrderStatus(params: any) {
  const range = getDateRange(params.period, params)

  const { data: orders } = await supabase
    .from('orders')
    .select('status, total')
    .gte('created_at', range.start)
    .lte('created_at', range.end)

  const byStatus: Record<string, { count: number; value: number }> = {}
  ;(orders || []).forEach((o: any) => {
    if (!byStatus[o.status]) byStatus[o.status] = { count: 0, value: 0 }
    byStatus[o.status].count += 1
    byStatus[o.status].value += parseFloat(o.total || 0)
  })

  return Object.entries(byStatus).map(([status, d]) => ({
    status,
    count: d.count,
    value: Math.round(d.value * 100) / 100,
  }))
}

/** Get top products */
export async function getTopProducts(params: any) {
  const range = getDateRange(params.period, params)
  const limit = params.limit || 10

  // Get order items from orders within the range
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .gte('created_at', range.start)
    .lte('created_at', range.end)

  if (!orders || orders.length === 0) return []

  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, product_name, quantity, unit_price')
    .in('order_id', orders.map(o => o.id))

  // Aggregate by product
  const byProduct: Record<number, { name: string; units: number; revenue: number }> = {}
  ;(items || []).forEach((i: any) => {
    const pid = i.product_id
    if (!byProduct[pid]) byProduct[pid] = { name: i.product_name, units: 0, revenue: 0 }
    byProduct[pid].units += i.quantity
    byProduct[pid].revenue += parseFloat(i.unit_price) * i.quantity
  })

  // Get merchant names for products
  const productIds = Object.keys(byProduct).map(Number)
  let merchantNames: Record<number, string> = {}
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, merchant_id')
      .in('id', productIds)

    const merchantIds = Array.from(new Set((products || []).map(p => p.merchant_id).filter(Boolean)))
    if (merchantIds.length > 0) {
      const { data: merchants } = await supabase
        .from('merchants')
        .select('id, name')
        .in('id', merchantIds)

      const mMap: Record<number, string> = {}
      ;(merchants || []).forEach((m: any) => { mMap[m.id] = m.name })

      ;(products || []).forEach((p: any) => {
        merchantNames[p.id] = mMap[p.merchant_id] || '—'
      })
    }
  }

  return Object.entries(byProduct)
    .map(([id, d]) => ({
      id: Number(id),
      name: d.name,
      product_name: d.name,
      merchant_name: merchantNames[Number(id)] || '—',
      units_sold: d.units,
      total_sold: d.units,
      revenue: Math.round(d.revenue * 100) / 100,
      total_revenue: Math.round(d.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

/** Get top merchants */
export async function getTopMerchants(params: any) {
  const range = getDateRange(params.period, params)
  const limit = params.limit || 10

  const { data: orders } = await supabase
    .from('orders')
    .select('merchant_id, total')
    .gte('created_at', range.start)
    .lte('created_at', range.end)

  const byMerchant: Record<number, { orders: number; revenue: number }> = {}
  ;(orders || []).forEach((o: any) => {
    const mid = o.merchant_id
    if (!byMerchant[mid]) byMerchant[mid] = { orders: 0, revenue: 0 }
    byMerchant[mid].orders += 1
    byMerchant[mid].revenue += parseFloat(o.total || 0)
  })

  const ids = Object.keys(byMerchant).map(Number)
  if (ids.length === 0) return []

  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, name')
    .in('id', ids)

  const nameMap: Record<number, string> = {}
  ;(merchants || []).forEach((m: any) => { nameMap[m.id] = m.name })

  return Object.entries(byMerchant)
    .map(([id, d]) => ({
      id: Number(id),
      name: nameMap[Number(id)] || `Merchant #${id}`,
      orders: d.orders,
      revenue: Math.round(d.revenue * 100) / 100,
      rating: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}
