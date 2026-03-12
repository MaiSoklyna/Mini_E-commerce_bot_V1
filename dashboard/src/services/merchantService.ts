import { supabase } from '../lib/supabase'

interface ListParams {
  limit?: number
  search?: string
  status?: string
}

/** List merchants with filters */
export async function listMerchants(params: ListParams = {}) {
  const { limit = 100, search, status } = params

  let query = supabase.from('merchants').select('*')

  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(`name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  query = query.order('created_at', { ascending: false }).limit(limit)

  const { data: merchants, error } = await query
  if (error) throw error

  // Enrich with product_count, order_count, total_revenue
  if (merchants && merchants.length > 0) {
    const ids = merchants.map(m => m.id)

    const [productsRes, ordersRes] = await Promise.all([
      supabase.from('products').select('merchant_id').in('merchant_id', ids),
      supabase.from('orders').select('merchant_id, total').in('merchant_id', ids),
    ])

    const productCounts: Record<number, number> = {}
    ;(productsRes.data || []).forEach((p: any) => {
      productCounts[p.merchant_id] = (productCounts[p.merchant_id] || 0) + 1
    })

    const orderCounts: Record<number, number> = {}
    const revenues: Record<number, number> = {}
    ;(ordersRes.data || []).forEach((o: any) => {
      orderCounts[o.merchant_id] = (orderCounts[o.merchant_id] || 0) + 1
      revenues[o.merchant_id] = (revenues[o.merchant_id] || 0) + parseFloat(o.total || 0)
    })

    merchants.forEach((m: any) => {
      m.product_count = productCounts[m.id] || 0
      m.order_count = orderCounts[m.id] || 0
      m.total_revenue = revenues[m.id] || 0
    })
  }

  return merchants || []
}

/** Get single merchant */
export async function getMerchant(id: number) {
  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  // Get counts
  const [productsRes, ordersRes] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('merchant_id', id),
    supabase.from('orders').select('total').eq('merchant_id', id),
  ])

  data.product_count = productsRes.count || 0
  data.order_count = (ordersRes.data || []).length
  data.total_revenue = (ordersRes.data || []).reduce((s: number, o: any) => s + parseFloat(o.total || 0), 0)

  return data
}

/** Create merchant */
export async function createMerchant(data: any) {
  // Generate slug from name
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data: merchant, error } = await supabase
    .from('merchants')
    .insert({ ...data, slug })
    .select()
    .single()

  if (error) throw error
  return merchant
}

/** Update merchant */
export async function updateMerchant(id: number, data: any) {
  const { error } = await supabase
    .from('merchants')
    .update(data)
    .eq('id', id)

  if (error) throw error
}

/** Change merchant status */
export async function changeMerchantStatus(id: number, status: string) {
  const { error } = await supabase
    .from('merchants')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
