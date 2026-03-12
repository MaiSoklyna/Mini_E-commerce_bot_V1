import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('telegram_id', jwt.telegram_id)
    .single()

  if (error || !user) return errorResponse('User not found', 404)

  return jsonResponse(user)
})
