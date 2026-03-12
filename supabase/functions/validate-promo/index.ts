import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const { code, merchant_id, cart_total } = await req.json()
  if (!code || !merchant_id) return errorResponse('code and merchant_id required')

  const { data: promo } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('merchant_id', merchant_id)
    .eq('code', code)
    .single()

  if (!promo) return errorResponse('PROMO_NOT_FOUND', 404)
  if (!promo.is_active) return errorResponse('PROMO_NOT_FOUND', 404)

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return errorResponse('PROMO_EXPIRED')
  }

  if (promo.max_uses && promo.used_count >= promo.max_uses) {
    return errorResponse('PROMO_EXHAUSTED')
  }

  const total = parseFloat(cart_total || 0)
  if (total < parseFloat(promo.min_order || 0)) {
    return errorResponse('PROMO_MIN_ORDER')
  }

  let discount_amount = 0
  if (promo.type === 'percent') {
    discount_amount = Math.round(total * parseFloat(promo.value) / 100 * 100) / 100
  } else {
    discount_amount = Math.min(parseFloat(promo.value), total)
  }

  return jsonResponse({
    data: {
      promo_id: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount_amount,
    },
  })
})
