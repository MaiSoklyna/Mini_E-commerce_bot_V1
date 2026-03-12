import { supabase } from '../lib/supabase'

interface ListParams {
  page?: number
  limit?: number
  search?: string
  category_id?: number
  merchant_id?: number
  status?: string
}

/** List products with filters and pagination */
export async function listProducts(params: ListParams = {}) {
  const { page = 1, limit = 20, search, category_id, merchant_id, status } = params

  let query = supabase.from('products').select('*', { count: 'exact' })

  if (search) query = query.ilike('name', `%${search}%`)
  if (category_id) query = query.eq('category_id', category_id)
  if (merchant_id) query = query.eq('merchant_id', merchant_id)
  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  const { data: products, error, count } = await query
  if (error) throw error

  // Enrich with category names and merchant names
  if (products && products.length > 0) {
    const catIds = Array.from(new Set(products.map(p => p.category_id).filter(Boolean)))
    const merchantIds = Array.from(new Set(products.map(p => p.merchant_id).filter(Boolean)))

    const [catsRes, merchantsRes, imagesRes] = await Promise.all([
      catIds.length > 0
        ? supabase.from('categories').select('id, name').in('id', catIds)
        : { data: [] },
      merchantIds.length > 0
        ? supabase.from('merchants').select('id, name').in('id', merchantIds)
        : { data: [] },
      safeQuery(() =>
        supabase
          .from('product_images')
          .select('product_id, url')
          .in('product_id', products.map(p => p.id))
          .order('sort_order')
      ),
    ])

    const catMap: Record<number, string> = {}
    ;(catsRes.data || []).forEach((c: any) => { catMap[c.id] = c.name })

    const merchantMap: Record<number, string> = {}
    ;(merchantsRes.data || []).forEach((m: any) => { merchantMap[m.id] = m.name })

    const imageMap: Record<number, string> = {}
    ;(imagesRes || []).forEach((img: any) => {
      if (!imageMap[img.product_id]) imageMap[img.product_id] = img.url
    })

    products.forEach((p: any) => {
      p.category_name = catMap[p.category_id] || null
      p.merchant_name = merchantMap[p.merchant_id] || null
      p.primary_image = imageMap[p.id] || p.primary_image || null
    })
  }

  return {
    data: products || [],
    meta: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit),
    },
  }
}

/** Create a product */
export async function createProduct(data: any) {
  // Generate slug from name (required by DB)
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now()

  const { data: product, error } = await supabase
    .from('products')
    .insert({ ...data, slug })
    .select()
    .single()

  if (error) throw error
  return product
}

/** Update a product */
export async function updateProduct(id: number, data: any) {
  const { error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)

  if (error) throw error
}

/** Patch product (partial update) */
export async function patchProduct(id: number, data: any) {
  const { error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)

  if (error) throw error
}

/** Delete a product */
export async function deleteProduct(id: number) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/** Upload product image to Supabase Storage */
export async function uploadProductImage(productId: number, file: File) {
  const ext = file.name.split('.').pop()
  const fileName = `${productId}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { contentType: file.type })

  if (error) {
    console.warn('Storage upload failed:', error.message)
    return
  }

  // Build the public URL using the real Supabase URL (not the proxy URL).
  // The proxy URL (NEXT_PUBLIC_API_URL) is only for PostgREST/Storage API calls,
  // but the resulting public image URL must point to Supabase directly.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`

  // Insert into product_images table
  await safeQuery(() =>
    supabase.from('product_images').insert({
      product_id: productId,
      url: publicUrl,
      sort_order: 0,
    })
  )
}

async function safeQuery(fn: () => PromiseLike<any>) {
  try {
    const { data, error } = await fn()
    if (error) return []
    return data || []
  } catch {
    return []
  }
}
