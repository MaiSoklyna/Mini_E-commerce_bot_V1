import { supabase } from '../lib/supabase'

/** List all active merchants */
export async function listMerchants() {
  const { data: merchants, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Count products per merchant in a separate query
  const ids = (merchants || []).map(m => m.id)
  let countMap = {}
  if (ids.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('merchant_id')
      .eq('is_active', true)
      .in('merchant_id', ids)

    ;(products || []).forEach(p => {
      countMap[p.merchant_id] = (countMap[p.merchant_id] || 0) + 1
    })
  }

  return (merchants || []).map(m => ({
    ...m,
    product_count: countMap[m.id] || 0,
  }))
}

/** Get a single merchant by ID */
export async function getMerchant(id) {
  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  // Count products
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('merchant_id', id)
    .eq('is_active', true)

  return { ...data, product_count: products?.length || 0 }
}

/** Get all products for a merchant (with merchant & category names) */
export async function getMerchantProducts(merchantId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Enrich with merchant name and primary image
  return await enrichProducts(data || [])
}

/** List active promo codes across all merchants */
export async function listActivePromos() {
  const { data: promos, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Filter expired and exhausted in JS
  const now = new Date().toISOString().split('T')[0]
  const active = (promos || []).filter(p => {
    if (p.expires_at && p.expires_at < now) return false
    if (p.max_uses && p.used_count >= p.max_uses) return false
    return true
  })

  // Get merchant names
  const merchantIds = [...new Set(active.map(p => p.merchant_id))]
  let merchantMap = {}
  if (merchantIds.length > 0) {
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, name')
      .in('id', merchantIds)

    ;(merchants || []).forEach(m => { merchantMap[m.id] = m.name })
  }

  return active.map(p => ({
    ...p,
    merchant_name: merchantMap[p.merchant_id] || 'Shop',
  }))
}

/** Helper: enrich products with merchant/category names and primary image */
async function enrichProducts(products) {
  if (products.length === 0) return products

  const merchantIds = [...new Set(products.map(p => p.merchant_id).filter(Boolean))]
  const categoryIds = [...new Set(products.map(p => p.category_id).filter(Boolean))]
  const productIds = products.map(p => p.id)

  const [merchantsRes, categoriesRes, imagesRes] = await Promise.all([
    merchantIds.length > 0
      ? supabase.from('merchants').select('id, name').in('id', merchantIds)
      : { data: [] },
    categoryIds.length > 0
      ? supabase.from('categories').select('id, name').in('id', categoryIds)
      : { data: [] },
    // Try product_images table; if it doesn't exist, just return empty
    supabase.from('product_images').select('product_id, url, sort_order').in('product_id', productIds).order('sort_order').then(
      res => res,
      () => ({ data: [] })
    ),
  ])

  const merchantMap = {}
  ;(merchantsRes.data || []).forEach(m => { merchantMap[m.id] = m.name })

  const categoryMap = {}
  ;(categoriesRes.data || []).forEach(c => { categoryMap[c.id] = c.name })

  // First image per product
  const imageMap = {}
  ;(imagesRes.data || []).forEach(img => {
    if (!imageMap[img.product_id]) imageMap[img.product_id] = img.url
  })

  return products.map(p => ({
    ...p,
    merchant_name: merchantMap[p.merchant_id] || '',
    category_name: categoryMap[p.category_id] || '',
    primary_image: imageMap[p.id] || p.image_url || p.image || null,
  }))
}
