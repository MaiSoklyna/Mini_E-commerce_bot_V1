import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const body = await req.json()
  const { product_id, order_id, rating, comment } = body

  if (!product_id || !rating) return errorResponse('product_id and rating required')
  if (rating < 1 || rating > 5) return errorResponse('Rating must be 1-5')

  // Get user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('telegram_id', jwt.telegram_id)
    .single()
  if (!user) return errorResponse('User not found', 404)

  // Insert review
  const { data: review, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      product_id,
      user_id: user.id,
      order_id: order_id || null,
      rating,
      comment: comment || null,
    })
    .select()
    .single()

  if (error) return errorResponse('Failed to create review: ' + error.message, 500)

  // Update product rating_avg and review_count
  const { data: stats } = await supabaseAdmin
    .from('reviews')
    .select('rating')
    .eq('product_id', product_id)
    .eq('is_visible', true)

  if (stats && stats.length > 0) {
    const avg = stats.reduce((sum, r) => sum + r.rating, 0) / stats.length
    await supabaseAdmin
      .from('products')
      .update({
        rating_avg: Math.round(avg * 100) / 100,
        review_count: stats.length,
      })
      .eq('id', product_id)
  }

  return jsonResponse({ success: true, data: review })
})
