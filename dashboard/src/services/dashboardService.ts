import { supabase } from '../lib/supabase'

/** Get dashboard statistics */
export async function getDashboardStats(user: any) {
  const isMerchant = user?.role === 'merchant'
  const merchantId = user?.merchant_id

  // Products count
  let productQuery = supabase.from('products').select('id', { count: 'exact', head: true })
  if (isMerchant && merchantId) productQuery = productQuery.eq('merchant_id', merchantId)

  // Orders count + revenue
  let orderQuery = supabase.from('orders').select('id, total, status, created_at, user_id, order_code')
  if (isMerchant && merchantId) orderQuery = orderQuery.eq('merchant_id', merchantId)

  // Run queries in parallel
  const [productRes, orderRes, merchantRes, userCountRes] = await Promise.all([
    productQuery,
    orderQuery,
    !isMerchant ? supabase.from('merchants').select('id, status', { count: 'exact' }) : null,
    !isMerchant ? supabase.from('users').select('id', { count: 'exact', head: true }) : null,
  ])

  const productCount = productRes.count ?? 0
  const orders = orderRes.data || []
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0)

  const stats: any = {
    total_products: productCount,
    total_orders: orders.length,
    total_revenue: totalRevenue,
    recent_orders: orders
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .map((o: any) => ({ ...o, order_code: o.order_code || `#${o.id}` })),
  }

  if (!isMerchant && merchantRes && userCountRes) {
    const merchantsData = merchantRes.data || []
    stats.total_merchants = merchantsData.length
    stats.pending_merchants = merchantsData.filter((m: any) => m.status === 'pending-review').length
    stats.total_customers = userCountRes.count ?? 0
  }

  // Enrich recent orders with customer names
  if (stats.recent_orders.length > 0) {
    const userIds = Array.from(new Set(stats.recent_orders.map((o: any) => o.user_id).filter(Boolean)))
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, username')
        .in('id', userIds)

      const userMap: Record<number, string> = {}
      ;(users || []).forEach((u: any) => {
        userMap[u.id] = u.first_name
          ? `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`
          : u.username || `User #${u.id}`
      })

      stats.recent_orders = stats.recent_orders.map((o: any) => ({
        ...o,
        customer_name: userMap[o.user_id] || '—',
      }))
    }
  }

  return stats
}
