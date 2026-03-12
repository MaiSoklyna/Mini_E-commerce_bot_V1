import { supabase } from '../lib/supabase'

/**
 * List products with optional filters.
 * Queries the products table directly (no views).
 */
export async function listProducts(opts = {}) {
  let q = supabase.from('products').select('*')

  if (opts.search) {
    q = q.ilike('name', `%${opts.search}%`)
  }
  if (opts.category) {
    q = q.eq('category_id', opts.category)
  }
  if (opts.merchant) {
    q = q.eq('merchant_id', opts.merchant)
  }
  if (opts.featured) {
    q = q.eq('is_featured', true)
  }

  q = q.eq('is_active', true)
    .order('created_at', { ascending: false })

  if (opts.limit) q = q.limit(opts.limit)
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 20) - 1)

  const { data, error } = await q
  if (error) throw error

  return await enrichProducts(data || [])
}

/**
 * Get a single product by ID with all related data.
 */
export async function getProduct(id) {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  // Get merchant & category names
  const [merchantRes, categoryRes] = await Promise.all([
    product.merchant_id
      ? supabase.from('merchants').select('id, name').eq('id', product.merchant_id).single()
      : { data: null },
    product.category_id
      ? supabase.from('categories').select('id, name').eq('id', product.category_id).single()
      : { data: null },
  ])

  // Fetch related data — gracefully handle missing tables
  const [imagesRes, variantsRes, reviewsRes] = await Promise.all([
    safeQuery(() => supabase.from('product_images').select('*').eq('product_id', id).order('sort_order')),
    safeQuery(() => supabase.from('product_variants').select('*').eq('product_id', id).order('sort_order')),
    safeQuery(() => supabase.from('reviews').select('*').eq('product_id', id).eq('is_visible', true).order('created_at', { ascending: false }).limit(10)),
  ])

  // If variants exist, get their options
  const variantData = variantsRes || []
  let enrichedVariants = variantData
  if (variantData.length > 0) {
    const variantIds = variantData.map(v => v.id)
    const optionsRes = await safeQuery(() =>
      supabase.from('product_variant_options').select('*').in('variant_id', variantIds).order('sort_order')
    )
    const optionsByVariant = {}
    ;(optionsRes || []).forEach(o => {
      if (!optionsByVariant[o.variant_id]) optionsByVariant[o.variant_id] = []
      optionsByVariant[o.variant_id].push(o)
    })
    enrichedVariants = variantData.map(v => ({
      ...v,
      options: optionsByVariant[v.id] || [],
    }))
  }

  // Get reviewer names
  const reviews = reviewsRes || []
  let enrichedReviews = reviews
  if (reviews.length > 0) {
    const userIds = [...new Set(reviews.map(r => r.user_id))]
    const { data: users } = await supabase.from('users').select('id, first_name, username').in('id', userIds)
    const userMap = {}
    ;(users || []).forEach(u => { userMap[u.id] = u })
    enrichedReviews = reviews.map(r => ({
      ...r,
      first_name: userMap[r.user_id]?.first_name || '',
      username: userMap[r.user_id]?.username || '',
    }))
  }

  const images = imagesRes || []

  return {
    ...product,
    merchant_name: merchantRes.data?.name || '',
    category_name: categoryRes.data?.name || '',
    primary_image: images[0]?.url || product.image_url || product.image || null,
    images,
    variants: enrichedVariants,
    reviews: enrichedReviews,
  }
}

/** Helper: enrich products list with merchant/category names and primary image */
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
    safeQuery(() => supabase.from('product_images').select('product_id, url, sort_order').in('product_id', productIds).order('sort_order')),
  ])

  const merchantMap = {}
  ;(merchantsRes.data || []).forEach(m => { merchantMap[m.id] = m.name })

  const categoryMap = {}
  ;(categoriesRes.data || []).forEach(c => { categoryMap[c.id] = c.name })

  const imageMap = {}
  ;(imagesRes || []).forEach(img => {
    if (!imageMap[img.product_id]) imageMap[img.product_id] = img.url
  })

  return products.map(p => ({
    ...p,
    merchant_name: merchantMap[p.merchant_id] || '',
    category_name: categoryMap[p.category_id] || '',
    primary_image: imageMap[p.id] || p.image_url || p.image || null,
  }))
}

/** Safe query that returns [] on table-not-found errors */
async function safeQuery(fn) {
  try {
    const { data, error } = await fn()
    if (error) {
      // 404 or 42P01 = table doesn't exist
      if (error.code === '42P01' || error.message?.includes('not found')) return []
      console.warn('Query error:', error.message)
      return []
    }
    return data || []
  } catch {
    return []
  }
}
