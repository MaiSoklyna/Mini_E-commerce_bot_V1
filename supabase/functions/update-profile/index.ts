import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const jwt = await getUserFromRequest(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  const body = await req.json()
  const allowedFields = ['first_name', 'last_name', 'phone', 'email', 'address', 'language']
  // Support "name" alias → split into first_name / last_name
  const updates: Record<string, unknown> = {}

  if (body.name) {
    const parts = String(body.name).trim().split(' ')
    updates.first_name = parts[0]
    updates.last_name = parts.slice(1).join(' ') || null
  }

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('telegram_id', jwt.telegram_id)
    .select()
    .single()

  if (error) return errorResponse('Update failed: ' + error.message, 500)

  return jsonResponse(data)
})
