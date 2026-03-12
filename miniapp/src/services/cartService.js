import { supabase, callEdgeFunction } from '../lib/supabase'

/** Get current user's cart (items with details) */
export async function getCart() {
  // Query cart_items via cart, joining product info
  const { data: carts, error: cartError } = await supabase
    .from('cart')
    .select('id, merchant_id')

  if (cartError) {
    // cart table might not exist yet
    console.warn('Cart fetch error:', cartError.message)
    return { items: [], item_count: 0, subtotal: 0 }
  }

  if (!carts || carts.length === 0) {
    return { items: [], item_count: 0, subtotal: 0 }
  }

  const cartIds = carts.map(c => c.id)
  const cartMerchantMap = {}
  carts.forEach(c => { cartMerchantMap[c.id] = c.merchant_id })

  const { data: cartItems, error: itemsError } = await supabase
    .from('cart_items')
    .select('*')
    .in('cart_id', cartIds)
    .order('created_at', { ascending: false })

  if (itemsError) {
    console.warn('Cart items fetch error:', itemsError.message)
    return { items: [], item_count: 0, subtotal: 0 }
  }

  if (!cartItems || cartItems.length === 0) {
    return { items: [], item_count: 0, subtotal: 0 }
  }

  // Enrich with product details
  const productIds = [...new Set(cartItems.map(i => i.product_id))]
  const merchantIds = [...new Set(Object.values(cartMerchantMap))]

  const [productsRes, merchantsRes, imagesRes] = await Promise.all([
    supabase.from('products').select('id, name, stock, is_active, base_price').in('id', productIds),
    supabase.from('merchants').select('id, name').in('id', merchantIds),
    safeQuery(() => supabase.from('product_images').select('product_id, url').in('product_id', productIds)),
  ])

  const productMap = {}
  ;(productsRes.data || []).forEach(p => { productMap[p.id] = p })

  const merchantMap = {}
  ;(merchantsRes.data || []).forEach(m => { merchantMap[m.id] = m.name })

  const imageMap = {}
  ;(imagesRes || []).forEach(img => {
    if (!imageMap[img.product_id]) imageMap[img.product_id] = img.url
  })

  const items = cartItems.map(ci => {
    const product = productMap[ci.product_id] || {}
    const merchantId = cartMerchantMap[ci.cart_id]
    const lineTotal = parseFloat(ci.unit_price) * ci.quantity
    return {
      ...ci,
      product_name: product.name || 'Unknown',
      product_stock: product.stock || 0,
      product_active: product.is_active,
      merchant_id: merchantId,
      merchant_name: merchantMap[merchantId] || 'Shop',
      primary_image: imageMap[ci.product_id] || product.image_url || product.image || null,
      line_total: lineTotal,
    }
  })

  const item_count = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + (i.line_total || 0), 0)

  return { items, item_count, subtotal }
}

/** Add item to cart via Edge Function (handles stock check, price calc, dedup) */
export async function addToCart(token, payload) {
  return callEdgeFunction('cart-add', payload, token)
}

/** Update cart item quantity directly */
export async function updateCartItem(id, quantity) {
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', id)

  if (error) throw error
}

/** Remove a cart item */
export async function removeCartItem(id) {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/** Clear all items from user's cart */
export async function clearCart() {
  const { data: carts } = await supabase.from('cart').select('id')
  if (carts && carts.length > 0) {
    const cartIds = carts.map(c => c.id)
    await supabase.from('cart_items').delete().in('cart_id', cartIds)
    await supabase.from('cart').delete().in('id', cartIds)
  }
}

/** Validate a promo code via Edge Function */
export async function validatePromo(token, payload) {
  return callEdgeFunction('validate-promo', payload, token)
}

/** Safe query helper */
async function safeQuery(fn) {
  try {
    const { data, error } = await fn()
    if (error) return []
    return data || []
  } catch {
    return []
  }
}
