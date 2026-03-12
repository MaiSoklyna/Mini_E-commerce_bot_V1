import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const body = await req.json()
  const { product_id, quantity = 1 } = body

  if (!product_id) return errorResponse('product_id required')

  // Get user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('telegram_id', jwt.telegram_id)
    .single()
  if (!user) return errorResponse('User not found', 404)

  // Get product with stock
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, merchant_id, base_price, stock, is_active')
    .eq('id', product_id)
    .single()

  if (!product || !product.is_active) return errorResponse('Product not found or inactive', 404)
  if (product.stock < quantity) return errorResponse('Insufficient stock')

  // Get or create cart for this merchant
  let { data: cart } = await supabaseAdmin
    .from('cart')
    .select('id')
    .eq('user_id', user.id)
    .eq('merchant_id', product.merchant_id)
    .single()

  if (!cart) {
    const { data: newCart, error } = await supabaseAdmin
      .from('cart')
      .insert({ user_id: user.id, merchant_id: product.merchant_id })
      .select()
      .single()

    if (error) return errorResponse('Failed to create cart: ' + error.message, 500)
    cart = newCart
  }

  // Check if product already in cart (deduplication)
  const { data: existing } = await supabaseAdmin
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', product_id)
    .single()

  if (existing) {
    // Update quantity
    const { error } = await supabaseAdmin
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id)

    if (error) return errorResponse('Failed to update cart item: ' + error.message, 500)
  } else {
    // Calculate unit price (base_price + variant adjustments in the future)
    const unitPrice = parseFloat(product.base_price)

    const { error } = await supabaseAdmin
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: product_id,
        quantity,
        unit_price: unitPrice,
        selected_variants: body.selected_variants || null,
      })

    if (error) return errorResponse('Failed to add to cart: ' + error.message, 500)
  }

  return jsonResponse({ success: true })
})
